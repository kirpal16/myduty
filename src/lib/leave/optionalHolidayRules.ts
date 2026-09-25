import { toDateKey } from "@/lib/format/datetime";
import {
  getOptionalHolidays,
  type GujaratGovtHoliday,
} from "@/lib/holidays/weekendRules";
import type { HolidayRecord } from "@/lib/holidays/resolveHoliday";
import type { LeaveTypeLike } from "./holidayLeaveRules";

/** The system leave type's code for Optional Holiday. */
export const OPTIONAL_HOLIDAY_CODE = "OH";

/** Max days an officer can take per calendar year under Gujarat Government service rules. */
export const MAX_OPTIONAL_HOLIDAYS_PER_YEAR = 2;

/**
 * Recognises only the system row for Optional Holiday ('OH').
 */
export function isOptionalHolidayType(type: LeaveTypeLike | null | undefined): boolean {
  return type?.is_system === true && type?.code === OPTIONAL_HOLIDAY_CODE;
}

export type OptionalHolidayViolation =
  | { kind: "not_an_optional_holiday"; date: string }
  | { kind: "exceeds_annual_limit"; requested: number; remaining: number }
  | { kind: "missing_adjacent_leave"; date: string };

/**
 * Calculate adjacent date keys (the day immediately before and day immediately after).
 */
export function getAdjacentDates(dateStr: string): { before: string; after: string } {
  const dBefore = new Date(`${dateStr}T12:00:00`);
  dBefore.setDate(dBefore.getDate() - 1);

  const dAfter = new Date(`${dateStr}T12:00:00`);
  dAfter.setDate(dAfter.getDate() + 1);

  return {
    before: toDateKey(dBefore),
    after: toDateKey(dAfter),
  };
}

/**
 * Checks if a given date is a valid declared Optional Holiday in Gujarat Government list,
 * either in the database records or in the hardcoded catalog.
 */
export function isValidOptionalHolidayDate(
  dateStr: string,
  dbHolidays: readonly HolidayRecord[] = [],
): boolean {
  // 1. Check database holidays marked as is_optional
  const dbMatch = dbHolidays.find(
    (h) => h.holiday_date.slice(0, 10) === dateStr && h.is_optional === true,
  );
  if (dbMatch) return true;

  // 2. If DB already has declared optional holidays for this year, only those count
  const year = parseInt(dateStr.slice(0, 4), 10);
  if (Number.isNaN(year)) return false;
  const hasDbOptional = dbHolidays.some(
    (h) => h.is_optional && h.holiday_date.startsWith(`${year}-`),
  );
  if (hasDbOptional) return false;

  // 3. Fallback to catalog only if no DB optional holidays exist at all for that year
  const catalog = getOptionalHolidays(year);
  return catalog.some((h) => h.date === dateStr);
}

/**
 * Returns the declared Optional Holiday options for a year.
 * If the database has declared optional holidays, returns ONLY those.
 */
export function optionalHolidayOptionsForYear(
  year: number,
  dbHolidays: readonly HolidayRecord[] = [],
): { date: string; name: string }[] {
  const map = new Map<string, string>();

  // Check if DB has declared optional holidays for this year
  const dbOptional = dbHolidays.filter(
    (h) => h.is_optional && h.holiday_date.startsWith(`${year}-`),
  );

  if (dbOptional.length > 0) {
    // Show ONLY the optional holidays declared by admin in the database
    for (const h of dbOptional) {
      map.set(h.holiday_date.slice(0, 10), h.name);
    }
  } else {
    // Fallback to catalog only if DB has none declared
    for (const h of getOptionalHolidays(year)) {
      map.set(h.date, h.name);
    }
  }

  return Array.from(map.entries())
    .map(([date, name]) => ({ date, name }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Optional Holiday Rule:
 * 1. Must be taken on a declared Optional Holiday date.
 * 2. Cannot exceed 2 days per year.
 * 3. Cannot be taken alone: must have another leave (CL, HL, etc.) on either
 *    the day immediately before or the day immediately after.
 */
export function findOptionalHolidayViolation(
  date: string,
  dbHolidays: readonly HolidayRecord[],
  loggedLeaveDates: ReadonlySet<string>,
  remainingBalance: number,
  hasPairedLeave?: boolean,
): OptionalHolidayViolation | null {
  // 1. Declared date check
  if (!isValidOptionalHolidayDate(date, dbHolidays)) {
    return { kind: "not_an_optional_holiday", date };
  }

  // 2. Quota check
  if (remainingBalance < 1) {
    return {
      kind: "exceeds_annual_limit",
      requested: 1,
      remaining: Math.max(0, remainingBalance),
    };
  }

  // 3. Adjacent leave rule: Must be preceded or succeeded by another leave
  if (!hasPairedLeave) {
    const { before, after } = getAdjacentDates(date);
    const hasAdjacent = loggedLeaveDates.has(before) || loggedLeaveDates.has(after);
    if (!hasAdjacent) {
      return { kind: "missing_adjacent_leave", date };
    }
  }

  return null;
}

/**
 * Human-friendly error message for violations.
 */
export function optionalHolidayViolationMessage(v: OptionalHolidayViolation): string {
  switch (v.kind) {
    case "not_an_optional_holiday": {
      const pretty = new Date(`${v.date}T12:00:00`).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      return `${pretty} is not on the declared Gujarat Government Optional Holidays list (મરજિયાત રજા). Please select a declared optional holiday.`;
    }
    case "exceeds_annual_limit":
      return `You have already used your quota of Optional Holidays for this year (maximum ${MAX_OPTIONAL_HOLIDAYS_PER_YEAR} days allowed per year).`;
    case "missing_adjacent_leave":
      return `Optional Holiday (મરજિયાત રજા) cannot be taken alone. Under Gujarat Government rules, you must take at least one extra leave (such as CL or HL) directly before or after the Optional Holiday (minimum 2 consecutive days of leave required).`;
  }
}
