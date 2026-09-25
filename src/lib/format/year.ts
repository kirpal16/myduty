/**
 * One year window for the whole app.
 *
 * Every screen used to hand-roll its own list, and they disagreed: six offered
 * the current year and three back, the leave balance offered -3..+1, the
 * settings holiday stepper -2..+3, and the gazetted importer a hardcoded
 * [2026, 2027]. An officer moving between screens met a different set of years
 * on each.
 *
 * The bounds here are not arbitrary. `leave_balance_view` materialises
 * `now()-4 .. now()+2` (migration 0029), and offering a year outside that
 * renders a page that is blank for a reason nobody can see. Change the
 * migration and these defaults together, or not at all.
 */

/** The window the database actually produces. Keep in step with 0029. */
export const YEAR_MIN_OFFSET = -4;
export const YEAR_MAX_OFFSET = 2;

export function getCurrentYear(): number {
  return new Date().getFullYear();
}

export type YearOption = { value: string; label: string };

/**
 * Years for a `<FilterSelect>`, newest first.
 *
 * `baseYear` exists so tests do not depend on the clock — without it, a suite
 * asserting "2023..2028" starts failing on 1 January.
 */
export function getYearOptions(
  pastYears = 3,
  futureYears = 2,
  baseYear: number = getCurrentYear(),
): YearOption[] {
  const newest = baseYear + Math.max(0, futureYears);
  const oldest = baseYear - Math.max(0, pastYears);

  return Array.from({ length: newest - oldest + 1 }, (_, i) => {
    const year = newest - i;
    return { value: String(year), label: String(year) };
  });
}

/**
 * A year from a URL, forced into range.
 *
 * A query string delivers whatever someone types, so this has to survive
 * `undefined`, `""`, `"2026abc"`, `"1900"`, `"99999"` and floats. Anything
 * unparseable falls back to the current year: a malformed link should show
 * this year, not an error page.
 */
export function clampYear(
  year: number | string | null | undefined,
  minOffset: number = YEAR_MIN_OFFSET,
  maxOffset: number = YEAR_MAX_OFFSET,
  baseYear: number = getCurrentYear(),
): number {
  const min = baseYear + minOffset;
  const max = baseYear + maxOffset;

  // Number("") is 0 and Number(null) is 0, so both would otherwise clamp to
  // the oldest year rather than falling back to today.
  if (year === null || year === undefined || year === "") return baseYear;

  const parsed = typeof year === "number" ? year : Number(year);
  if (!Number.isFinite(parsed)) return baseYear;

  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

/** True when a year is inside the window the database can answer for. */
export function isYearInWindow(
  year: number,
  baseYear: number = getCurrentYear(),
): boolean {
  return year >= baseYear + YEAR_MIN_OFFSET && year <= baseYear + YEAR_MAX_OFFSET;
}
