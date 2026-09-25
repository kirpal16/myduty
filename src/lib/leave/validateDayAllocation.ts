import { resolveHoliday, type HolidayRecord } from "@/lib/holidays/resolveHoliday";
import {
  isHolidayLeaveType,
  holidayLeaveViolationMessage,
} from "./holidayLeaveRules";
import {
  getAdjacentDates,
  isOptionalHolidayType,
  isValidOptionalHolidayDate,
  optionalHolidayViolationMessage,
} from "./optionalHolidayRules";
import { formatDays } from "./leaveDays";

/**
 * Checks a per-day leave breakdown after the officer has edited it.
 *
 * The engine (allocateLeaveDays) proposes a type for every day; the officer
 * may change any of them. Each day must still obey the same rules a whole
 * leave of that type would:
 *
 *   HL  only on a real holiday (never an Optional Holiday), never one worked
 *   OH  only on a declared Optional Holiday, at most the year's quota
 *   any other type with an allowance  -> no more days than remain. This used
 *       to apply only where the officer CHANGED a day to that type, so a leave
 *       the engine itself proposed could run past its balance and drive it
 *       negative. It now applies to every day in the group: the quota is the
 *       quota however the day got there.
 *
 * Pure: the caller loads holidays, worked dates and balances once.
 */

export type DayChoice = { date: string; leaveTypeId: string; fraction: number };

export type LeaveTypeInfo = {
  id: string;
  name: string;
  code?: string | null;
  is_system?: boolean | null;
};

export type BalanceInfo = {
  /** Days left this year, with the edited log's own days already added back. */
  remaining: number;
  /** False when the officer never set an allowance: such a type is uncapped. */
  allocationExists: boolean;
};

export type DayIssue = { date?: string; message: string };

export function validateDayAllocation(input: {
  days: readonly DayChoice[];
  /** The engine's choice per date, to tell changed days from proposed ones. */
  engineTypeByDate: Readonly<Record<string, string>>;
  types: readonly LeaveTypeInfo[];
  dbHolidays: readonly HolidayRecord[];
  workedDates: ReadonlySet<string>;
  balanceFor: (leaveTypeId: string, year: number) => BalanceInfo | undefined;
}): DayIssue[] {
  const { days, engineTypeByDate, types, dbHolidays, workedDates, balanceFor } = input;
  const typeById = new Map(types.map((t) => [t.id, t]));
  const requestDates = new Set(days.map((d) => d.date));
  const issues: DayIssue[] = [];

  // Per-date rules.
  for (const d of days) {
    const type = typeById.get(d.leaveTypeId);
    if (!type) {
      issues.push({ date: d.date, message: "That leave type is not available to you." });
      continue;
    }

    if (isHolidayLeaveType(type)) {
      const r = resolveHoliday(new Date(`${d.date}T12:00:00`), dbHolidays);
      if (!r.isHoliday || r.kind === "optional_holiday") {
        issues.push({
          date: d.date,
          message: holidayLeaveViolationMessage({ kind: "not_a_holiday", date: d.date }),
        });
      } else if (workedDates.has(d.date)) {
        issues.push({
          date: d.date,
          message: holidayLeaveViolationMessage({ kind: "worked", date: d.date }),
        });
      }
    } else if (isOptionalHolidayType(type)) {
      if (!isValidOptionalHolidayDate(d.date, dbHolidays)) {
        issues.push({
          date: d.date,
          message: optionalHolidayViolationMessage({ kind: "not_an_optional_holiday", date: d.date }),
        });
      } else if (engineTypeByDate[d.date] !== d.leaveTypeId) {
        // An OH the officer chose must sit next to another day of this leave:
        // an Optional Holiday cannot be taken alone. (A leave logged AS OH
        // keeps its own pairing check in the action.)
        const { before, after } = getAdjacentDates(d.date);
        if (!requestDates.has(before) && !requestDates.has(after)) {
          issues.push({
            date: d.date,
            message: optionalHolidayViolationMessage({ kind: "missing_adjacent_leave", date: d.date }),
          });
        }
      }
    }
  }

  // Per (type, year) balance rules.
  const groups = new Map<
    string,
    { typeId: string; year: number; total: number; changed: string[]; firstDate: string }
  >();
  for (const d of days) {
    const year = Number(d.date.slice(0, 4));
    const key = `${d.leaveTypeId}|${year}`;
    const g = groups.get(key) ?? {
      typeId: d.leaveTypeId,
      year,
      total: 0,
      changed: [],
      firstDate: d.date,
    };
    g.total += d.fraction;
    if (engineTypeByDate[d.date] !== d.leaveTypeId) g.changed.push(d.date);
    groups.set(key, g);
  }

  for (const g of groups.values()) {
    const type = typeById.get(g.typeId);
    if (!type || isHolidayLeaveType(type)) continue; // HL is capped by the calendar itself

    const balance = balanceFor(g.typeId, g.year);

    if (isOptionalHolidayType(type)) {
      const remaining = balance?.remaining ?? 0;
      if (g.total > remaining) {
        issues.push({
          date: g.changed[0],
          message: optionalHolidayViolationMessage({
            kind: "exceeds_annual_limit",
            requested: g.total,
            remaining: Math.max(0, remaining),
          }),
        });
      }
      continue;
    }

    if (!balance?.allocationExists) continue;
    if (g.total > balance.remaining) {
      issues.push({
        // An engine-proposed overrun has no "changed" day to point at, so the
        // issue attaches to the group's first day instead.
        date: g.changed[0] ?? g.firstDate,
        message: `Not enough ${type.name} balance for ${g.year}: ${formatDays(
          Math.max(0, balance.remaining),
        )} left, ${formatDays(g.total)} chosen. Pick another leave type for ${
          g.changed.length === 1 ? "this day" : "some of these days"
        }.`,
      });
    }
  }

  return issues;
}
