import { isSunday, isSecondOrFourthSaturday } from "./weekendRules";
import { resolveHoliday, type HolidayRecord } from "./resolveHoliday";
import { toDateKey } from "@/lib/format/datetime";

/**
 * Where the holiday total actually comes from.
 *
 * The count on its own is unverifiable — "100 holidays" is impossible to
 * check by hand and impossible to spot as wrong. Broken into its sources it
 * can be reasoned about: 52 Sundays is right for a normal year, 24 is right
 * for two Saturdays a month, and the overlap line explains why the three
 * numbers do not simply add up.
 *
 * The three sources deliberately OVERLAP, because a festival can land on a
 * Sunday. `total` is the number of distinct dates, which is what Holiday
 * Leave is worth — never the sum of the parts.
 */
export type HolidayDay = {
  date: string;
  /** "Sunday", "2nd Saturday", or the festival's name. */
  label: string;
  /** Set when this date is also claimed by another source. */
  alsoCountedAs?: string;
};

export type HolidayYearSummary = {
  year: number;
  /** Every Sunday in the year. */
  sundays: HolidayDay[];
  /** 2nd and 4th Saturdays. The 1st, 3rd and 5th are working days. */
  weekendSaturdays: HolidayDay[];
  /** Distinct dates carrying a public/gazetted holiday row the officer can see. Excludes optional holidays. */
  festivals: HolidayDay[];
  /** Dates claimed by more than one source, counted once in `total`. */
  overlaps: HolidayDay[];
  /** Declared optional holidays (મરજિયાત રજા). Separate from public holiday leave. */
  optionalHolidays: HolidayDay[];
  /** Distinct public holiday dates — the statutory Holiday Leave allocation. */
  total: number;
  /** Maximum optional leaves an employee may take per calendar year (statutory: 2). */
  optionalMaxAllowed: number;
};

export function summariseHolidayYear(
  year: number,
  dbHolidays: readonly HolidayRecord[] = [],
): HolidayYearSummary {
  const sundays: HolidayDay[] = [];
  const weekendSaturdays: HolidayDay[] = [];
  const overlaps: HolidayDay[] = [];
  let total = 0;

  // Distinct dates, separated by non-optional vs optional
  const festivalNames = new Map<string, string>();
  const optionalNames = new Map<string, string>();

  for (const h of dbHolidays) {
    const key = h.holiday_date.slice(0, 10);
    if (key.startsWith(`${year}-`)) {
      if (h.is_optional) {
        if (!optionalNames.has(key)) {
          optionalNames.set(key, h.name);
        }
      } else {
        if (!festivalNames.has(key)) {
          festivalNames.set(key, h.name);
        }
      }
    }
  }

  const cursor = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);

  while (cursor.getTime() <= end.getTime()) {
    const key = toDateKey(cursor);
    const sunday = isSunday(cursor);
    const saturday = isSecondOrFourthSaturday(cursor);
    const festivalName = festivalNames.get(key);

    const weekendLabel = sunday
      ? "Sunday"
      : saturday
        ? `${Math.ceil(cursor.getDate() / 7) === 2 ? "2nd" : "4th"} Saturday`
        : undefined;

    if (sunday) {
      sundays.push({ date: key, label: "Sunday", alsoCountedAs: festivalName });
    }
    if (saturday) {
      weekendSaturdays.push({
        date: key,
        label: weekendLabel as string,
        alsoCountedAs: festivalName,
      });
    }
    if (festivalName && weekendLabel) {
      overlaps.push({ date: key, label: festivalName, alsoCountedAs: weekendLabel });
    }

    // Public Holiday Leave allocation:
    // Sundays, 2nd & 4th Saturdays, or any non-optional festival.
    // Optional holidays do NOT count towards general Holiday Leave.
    if (sunday || saturday || festivalName) total++;

    cursor.setDate(cursor.getDate() + 1);
  }

  const festivals: HolidayDay[] = [...festivalNames.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, label]) => {
      const clash =
        sundays.find((d) => d.date === date) ??
        weekendSaturdays.find((d) => d.date === date);
      return { date, label, alsoCountedAs: clash?.label };
    });

  const optionalHolidays: HolidayDay[] = [...optionalNames.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, label]) => {
      const clash =
        sundays.find((d) => d.date === date) ??
        weekendSaturdays.find((d) => d.date === date);
      return { date, label, alsoCountedAs: clash?.label };
    });

  return {
    year,
    sundays,
    weekendSaturdays,
    festivals,
    overlaps,
    optionalHolidays,
    total,
    optionalMaxAllowed: 2,
  };
}
