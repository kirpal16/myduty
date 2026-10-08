import { isSunday, isSecondOrFourthSaturday } from "./weekendRules";
import { toDateKey } from "@/lib/format/datetime";
import type { HolidayScope } from "@/types/database";

/**
 * Holiday classification, and whether working it earns extra pay.
 *
 * Two rules govern everything here:
 *
 * R1 — classification is server-authoritative, and pay requires *worked*.
 *   A holiday on its own pays nothing. `resolveHoliday` answers only "what
 *   kind of day is this?"; the duty layer decides pay, because a duty row's
 *   existence is the proof that the officer actually worked it.
 *
 * R2 — "holiday" is three distinct business concepts. A public holiday, a
 *   weekly off and a personal day-off are not the same thing, and the
 *   calendar accordion, the row badges and the reports all need to tell them
 *   apart even though all three currently earn the same allowance.
 */
export type HolidayKind = "public_holiday" | "optional_holiday" | "weekend" | "day_off";

export type HolidayResolution = {
  /** Display and classification. Never use this to decide money. */
  isHoliday: boolean;
  /**
   * Money. Currently identical to `isHoliday` — all three kinds qualify —
   * but kept separate so the rule is one line to change if they diverge.
   */
  qualifiesForHolidayAllowance: boolean;
  kind?: HolidayKind;
  name?: string;
  source?: "db" | "sunday" | "saturday";
};

/** The subset of a `holidays` row this resolver needs. */
export type HolidayRecord = {
  name: string;
  holiday_date: string;
  scope: HolidayScope;
  is_government?: boolean | null;
  is_optional?: boolean | null;
};

const NOT_A_HOLIDAY: HolidayResolution = {
  isHoliday: false,
  qualifiesForHolidayAllowance: false,
};

function resolved(
  kind: HolidayKind,
  source: NonNullable<HolidayResolution["source"]>,
  name?: string,
): HolidayResolution {
  return {
    isHoliday: true,
    // All three regular kinds qualify when worked. Change this single expression if
    // that business rule ever splits.
    qualifiesForHolidayAllowance: kind !== "optional_holiday",
    kind,
    source,
    name,
  };
}

/**
 * Precedence, highest first:
 *
 *   1. a `holidays` row for the date  (GLOBAL/government -> public_holiday,
 *                                      is_optional       -> optional_holiday,
 *                                      PROFILE/USER      -> day_off)
 *   2. the weekend rule               -> weekend
 *
 * An explicit database row wins over the weekend rule so an office that
 * works a particular Sunday, or grants an extra day, can say so.
 *
 * Pure and synchronous: the caller loads the `holidays` rows for the range
 * once and passes them in, so resolving 30 days costs one query, not 30.
 * `isWeekendHoliday` never queried that table at all, which is why a
 * hand-added holiday used to be invisible to the duty form.
 */
export function resolveHoliday(
  date: Date | string,
  dbHolidays: readonly HolidayRecord[] = [],
): HolidayResolution {
  const key = toDateKey(date);
  const [y, m, dayNum] = key.split("-").map(Number);
  const d = !Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(dayNum)
    ? new Date(y, m - 1, dayNum)
    : (typeof date === "string" ? new Date(date) : date);
  if (Number.isNaN(d.getTime())) return NOT_A_HOLIDAY;

  // 1. Explicit database rows.
  // A real holiday row wins over an optional one on the same date, whatever
  // order the query returned them in — the same rule holiday_dates_for_year
  // (0032) applies, so the app and the HL entitlement cannot disagree.
  const sameDay = dbHolidays.filter((h) => h.holiday_date.slice(0, 10) === key);
  const row = sameDay.find((h) => !h.is_optional) ?? sameDay[0];
  if (row) {
    if (row.is_optional) {
      // Optional Holiday (મરજિયાત રજા): offices are open, regular working day
      // unless it falls on a Sunday or 2nd/4th Saturday.
      if (isSunday(d)) return resolved("weekend", "sunday", "Sunday");
      if (isSecondOrFourthSaturday(d)) {
        const which = Math.ceil(d.getDate() / 7) === 2 ? "2nd" : "4th";
        return resolved("weekend", "saturday", `${which} Saturday`);
      }
      return {
        isHoliday: true,
        qualifiesForHolidayAllowance: false,
        kind: "optional_holiday",
        source: "db",
        name: row.name,
      };
    }
    const isPublic = row.scope === "GLOBAL" || row.is_government === true;
    return resolved(isPublic ? "public_holiday" : "day_off", "db", row.name);
  }

  // 2. Weekend rule: Sundays, plus the 2nd and 4th Saturday only. The 1st,
  //    3rd and 5th Saturdays are ordinary working days.
  if (isSunday(d)) return resolved("weekend", "sunday", "Sunday");
  if (isSecondOrFourthSaturday(d)) {
    const which = Math.ceil(d.getDate() / 7) === 2 ? "2nd" : "4th";
    return resolved("weekend", "saturday", `${which} Saturday`);
  }

  return NOT_A_HOLIDAY;
}

/**
 * Resolve every calendar day in an inclusive range, keyed by local date
 * ("2026-09-08"). Used by the multi-day duty split and by the month KPIs, so
 * both classify N days from a single holidays query.
 */
export function resolveHolidaysForRange(
  from: Date | string,
  to: Date | string,
  dbHolidays: readonly HolidayRecord[] = [],
): Map<string, HolidayResolution> {
  const start = typeof from === "string" ? new Date(from) : from;
  const end = typeof to === "string" ? new Date(to) : to;
  const out = new Map<string, HolidayResolution>();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return out;

  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  while (cursor.getTime() <= last.getTime()) {
    out.set(toDateKey(cursor), resolveHoliday(cursor, dbHolidays));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/** How many days in a resolved range are holidays (excluding optional holidays). */
export function countHolidays(range: Map<string, HolidayResolution>): number {
  let n = 0;
  for (const r of range.values()) {
    if (r.isHoliday && r.kind !== "optional_holiday") n++;
  }
  return n;
}

/** Human label for a badge or accordion heading. */
export function holidayKindLabel(kind: HolidayKind | undefined): string {
  switch (kind) {
    case "public_holiday":
      return "Public Holiday";
    case "optional_holiday":
      return "Optional Holiday";
    case "weekend":
      return "Weekend Off";
    case "day_off":
      return "Day Off";
    default:
      return "Working Day";
  }
}
