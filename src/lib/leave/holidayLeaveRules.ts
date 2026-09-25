import {
  resolveHoliday,
  resolveHolidaysForRange,
  holidayKindLabel,
  type HolidayRecord,
  type HolidayResolution,
} from "@/lib/holidays/resolveHoliday";
import { toDateKey } from "@/lib/format/datetime";

/**
 * The rules that tie Holiday Leave to the duty log.
 *
 * A holiday date can go exactly one of three ways, and the first two are
 * mutually exclusive:
 *
 *   worked        -> a duty row, extra pay, HL untouched
 *   logged as HL  -> a leave_log, no pay,   HL - 1
 *   neither       -> nothing recorded at all
 *
 * Pure functions with no database access: the caller loads the rows once and
 * passes them in, so both the leave action and the duty action can reach the
 * same verdict without either owning the rule.
 */

/** The system leave type's code. Matches migration 0026. */
export const HOLIDAY_LEAVE_CODE = "HL";

export type LeaveTypeLike = { code?: string | null; is_system?: boolean | null };

/**
 * Only the seeded system row counts. An officer may legitimately create a
 * personal type they also call "HL", and that one is ordinary leave.
 */
export function isHolidayLeaveType(type: LeaveTypeLike | null | undefined): boolean {
  return type?.is_system === true && type?.code === HOLIDAY_LEAVE_CODE;
}

/** Every calendar day in an inclusive range, as local date keys. */
export function datesInRange(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${startDate}T12:00:00`);
  const last = new Date(`${endDate}T12:00:00`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime())) return out;

  while (cursor.getTime() <= last.getTime()) {
    out.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export type HolidayLeaveViolation =
  | { kind: "not_a_holiday"; date: string }
  | { kind: "worked"; date: string };

/**
 * Holiday Leave may only be taken on a holiday, and only on one that was not
 * worked — working it already paid, so taking it as leave as well would claim
 * the same day twice.
 *
 * `workedDates` is the set of dates carrying a non-cancelled duty.
 */
export function findHolidayLeaveViolation(
  startDate: string,
  endDate: string,
  dbHolidays: readonly HolidayRecord[],
  workedDates: ReadonlySet<string>,
): HolidayLeaveViolation | null {
  for (const date of datesInRange(startDate, endDate)) {
    const res = resolveHoliday(new Date(`${date}T12:00:00`), dbHolidays);
    if (!res.isHoliday || res.kind === "optional_holiday") {
      return { kind: "not_a_holiday", date };
    }
    if (workedDates.has(date)) {
      return { kind: "worked", date };
    }
  }
  return null;
}

/** The message an officer sees. Names the date, so it is actionable. */
export function holidayLeaveViolationMessage(v: HolidayLeaveViolation): string {
  const pretty = new Date(`${v.date}T12:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return v.kind === "not_a_holiday"
    ? `Holiday Leave can only be taken on a holiday, and ${pretty} is a working day. Use another leave type for it.`
    : `You logged duty on ${pretty}, so it already earns holiday pay — it cannot also be taken as Holiday Leave.`;
}

/**
 * The mirror rule, for the duty side: a day already taken as Holiday Leave
 * cannot then be worked.
 */
export function holidayLeaveConflictMessage(date: string): string {
  const pretty = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${pretty} is already recorded as Holiday Leave. Remove that leave first if you actually worked the day.`;
}

export type HolidayOption = {
  date: string;
  /** "Sunday", "2nd Saturday", "Diwali" … */
  label: string;
  kindLabel: string;
  /** Set when the date cannot be chosen, explaining why. */
  disabledReason?: string;
};

/**
 * The dates a Holiday Leave may be logged against, for the form's picker.
 * Worked and already-taken days are returned too, disabled with a reason —
 * an option that silently vanishes is harder to understand than one that
 * explains itself.
 */
export function holidayOptionsForYear(
  year: number,
  dbHolidays: readonly HolidayRecord[],
  workedDates: ReadonlySet<string>,
  takenDates: ReadonlySet<string>,
): HolidayOption[] {
  const range = resolveHolidaysForRange(
    new Date(year, 0, 1),
    new Date(year, 11, 31),
    dbHolidays,
  );

  const out: HolidayOption[] = [];
  for (const [date, r] of range) {
    // An Optional Holiday is a working day: it is taken as OH, never as HL.
    // (One falling on a Sunday/2nd-4th Saturday resolves as a weekend and
    // stays in.)
    if (!r.isHoliday || r.kind === "optional_holiday") continue;
    out.push({
      date,
      label: r.name ?? holidayKindLabel(r.kind),
      kindLabel: holidayKindLabel(r.kind),
      disabledReason: workedDates.has(date)
        ? "Duty logged — already earns holiday pay"
        : takenDates.has(date)
          ? "Already taken as Holiday Leave"
          : undefined,
    });
  }
  return out;
}

/** How many days in a range count against the HL balance. */
export function holidayLeaveDays(
  startDate: string,
  endDate: string,
  isHalfDay: boolean,
): number {
  if (isHalfDay) return 0.5;
  return datesInRange(startDate, endDate).length;
}

export type { HolidayResolution };

/**
 * The end dates a Holiday Leave may run to, given its start.
 *
 * A Holiday Leave covers holidays and nothing else, so a range is only valid
 * while every day inside it is a selectable holiday. Two consecutive holidays
 * — Sunday the 4th and a festival on the 5th — may be logged as one entry;
 * Sunday the 4th and the 2nd Saturday on the 10th may not, because the six
 * working days between them are not holidays.
 *
 * The picker previously offered every holiday in the year as an end date, so
 * that invalid span was one click away and was only refused on submit.
 *
 * Returns the run of consecutive selectable dates beginning at `startDate`,
 * starting with `startDate` itself. An empty array means the start is not a
 * selectable holiday at all.
 */
export function holidayEndOptions(
  options: readonly HolidayOption[],
  startDate: string,
): HolidayOption[] {
  if (!startDate) return [];

  const selectable = new Map(
    options.filter((o) => !o.disabledReason).map((o) => [o.date, o]),
  );

  const first = selectable.get(startDate);
  if (!first) return [];

  const run: HolidayOption[] = [first];
  const cursor = new Date(`${startDate}T12:00:00`);
  if (Number.isNaN(cursor.getTime())) return run;

  // Walk forward one calendar day at a time. The moment a day is not a
  // selectable holiday the run ends — that gap is exactly what makes a longer
  // span invalid.
  for (;;) {
    cursor.setDate(cursor.getDate() + 1);
    const next = selectable.get(toDateKey(cursor));
    if (!next) break;
    run.push(next);
  }

  return run;
}
