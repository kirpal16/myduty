import { resolveHoliday, type HolidayRecord } from "@/lib/holidays/resolveHoliday";
import { datesInRange } from "./holidayLeaveRules";
import { isValidOptionalHolidayDate } from "./optionalHolidayRules";

/**
 * The Smart Leave Engine: which leave each day of a request is charged to.
 *
 * An officer logs ONE leave (one application, one letter), but the days
 * inside it are not all the same kind:
 *
 *   Casual Leave (CL)
 *     holiday (Sunday, 2nd/4th Saturday, gazetted, office day-off) -> HL
 *       ...unless the officer worked it: that day already earned holiday
 *          pay, so it cannot also be Holiday Leave -> CL
 *     declared optional holiday, while OH quota remains -> OH
 *       ...quota spent -> CL
 *     every other day -> CL
 *
 *   Special Leave (SPL)
 *     holidays at the START of the range, before the first working day -> HL
 *     everything from the first working day on -> SPL, holidays included.
 *     Special leave is sanctioned as one continuous block, so a holiday in
 *     the middle or at the end is part of it; only the run of holidays the
 *     officer was off anyway before it began stays Holiday Leave.
 *     Never routed to OH or CL.
 *
 *   Every other type, any half-day, and ANY single-day leave -> the requested
 *   type, unchanged. For one day the dropdown is the answer; suggestions
 *   start at two days.
 *
 * Pure: the caller loads holidays, worked dates and the OH balance once.
 */

export const CASUAL_LEAVE_CODE = "CL";
export const SPECIAL_LEAVE_CODE = "SPL";

export type AllocationMode = "casual" | "special" | "plain";

/** Where one day's leave goes. "requested" is the type the officer picked. */
export type AllocationTarget = "requested" | "HL" | "OH";

export type AllocatedDay = {
  date: string;
  target: AllocationTarget;
  fraction: number;
};

export type AllocationInput = {
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  mode: AllocationMode;
  dbHolidays: readonly HolidayRecord[];
  /** Dates carrying a non-cancelled duty. */
  workedDates?: ReadonlySet<string>;
  /** Optional Holidays still available, per calendar year. Missing = 0. */
  ohRemainingByYear?: Readonly<Record<number, number>>;
};

/** The mode for a leave type. Only the seeded system CL/SPL rows are routed. */
export function allocationModeFor(
  type: { code?: string | null; is_system?: boolean | null } | null | undefined,
): AllocationMode {
  const code = type?.code?.toUpperCase();
  if (code === SPECIAL_LEAVE_CODE && type?.is_system) return "special";
  // CL predates the system flag (seeded in 0010 as an ordinary global type),
  // so it is recognised by code alone.
  if (code === CASUAL_LEAVE_CODE) return "casual";
  return "plain";
}

/**
 * Half-day leave is a Casual Leave concept: only CL may be taken as a half
 * day (AM/PM). Every other type is whole days.
 */
export function isHalfDayAllowed(
  type: { code?: string | null; is_system?: boolean | null } | null | undefined,
): boolean {
  return allocationModeFor(type) === "casual";
}

function isHolidayLeaveDay(date: string, dbHolidays: readonly HolidayRecord[]): boolean {
  const r = resolveHoliday(new Date(`${date}T12:00:00`), dbHolidays);
  return r.isHoliday && r.kind !== "optional_holiday";
}

export function allocateLeaveDays(input: AllocationInput): AllocatedDay[] {
  const { startDate, endDate, isHalfDay, mode, dbHolidays } = input;
  const worked = input.workedDates ?? new Set<string>();
  const dates = datesInRange(startDate, endDate);

  // A single day is exactly the type the officer picked — no suggestion.
  // That also keeps an Optional Holiday from ever being taken alone: the
  // engine only routes to OH inside a multi-day leave, where the neighbouring
  // day is part of the same leave.
  if (isHalfDay || mode === "plain" || dates.length < 2) {
    const fraction = isHalfDay ? 0.5 : 1;
    return dates.map((date) => ({ date, target: "requested", fraction }));
  }

  if (mode === "special") {
    const out: AllocatedDay[] = [];
    let leading = true;
    for (const date of dates) {
      if (leading && isHolidayLeaveDay(date, dbHolidays) && !worked.has(date)) {
        out.push({ date, target: "HL", fraction: 1 });
        continue;
      }
      leading = false;
      out.push({ date, target: "requested", fraction: 1 });
    }
    return out;
  }

  // casual
  const ohLeft = new Map<number, number>(
    Object.entries(input.ohRemainingByYear ?? {}).map(([y, n]) => [Number(y), n]),
  );

  return dates.map((date): AllocatedDay => {
    if (isHolidayLeaveDay(date, dbHolidays)) {
      return { date, target: worked.has(date) ? "requested" : "HL", fraction: 1 };
    }
    if (isValidOptionalHolidayDate(date, dbHolidays)) {
      const year = Number(date.slice(0, 4));
      const left = ohLeft.get(year) ?? 0;
      if (left >= 1) {
        ohLeft.set(year, left - 1);
        return { date, target: "OH", fraction: 1 };
      }
    }
    return { date, target: "requested", fraction: 1 };
  });
}

/** Days per target, e.g. { requested: 5, HL: 2, OH: 1 }. */
export function countAllocation(days: readonly AllocatedDay[]): Record<AllocationTarget, number> {
  const out: Record<AllocationTarget, number> = { requested: 0, HL: 0, OH: 0 };
  for (const d of days) out[d.target] += d.fraction;
  return out;
}
