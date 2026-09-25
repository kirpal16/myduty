import { datesInRange } from "./holidayLeaveRules";

/**
 * How many days a leave entry covers.
 *
 * An entry is one row with an inclusive start and end, so a 5-day leave is
 * one log but five days. Screens used to show `logs.length`, which counted a
 * week off as "1". Everything that shows a leave total goes through here.
 */
export function leaveDayCount(
  startDate: string,
  endDate: string,
  isHalfDay: boolean,
): number {
  if (isHalfDay) return 0.5;
  return datesInRange(startDate, endDate).length;
}

/**
 * The days of one entry that fall inside a period, both ends inclusive.
 *
 * A leave from 29 Jan to 3 Feb belongs to both months; clipping it keeps
 * January's total at 3 and February's at 3 instead of 6 in each.
 * Date keys ("YYYY-MM-DD") compare correctly as strings.
 */
export function leaveDaysWithin(
  startDate: string,
  endDate: string,
  isHalfDay: boolean,
  from?: string | null,
  to?: string | null,
): number {
  const s = from && from > startDate ? from : startDate;
  const e = to && to < endDate ? to : endDate;
  if (s > e) return 0;
  return leaveDayCount(s, e, isHalfDay);
}

/** "1 Day", "0.5 Day", "12 Days". */
export function formatDays(n: number): string {
  const value = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return `${value} ${n <= 1 ? "Day" : "Days"}`;
}

export type DayBreakdownEntry = { code: string; days: number };

/**
 * Per-day allocation rows collapsed into "3 CL · 2 HL". Ordered largest
 * first so the leave the officer asked for normally leads.
 */
export function summariseBreakdown(
  rows: readonly { code: string | null | undefined; fraction: number | string }[],
): DayBreakdownEntry[] {
  const totals = new Map<string, number>();
  for (const r of rows) {
    const code = r.code ?? "?";
    totals.set(code, (totals.get(code) ?? 0) + Number(r.fraction));
  }
  return [...totals.entries()]
    .map(([code, days]) => ({ code, days }))
    .sort((a, b) => b.days - a.days || a.code.localeCompare(b.code));
}

export function formatBreakdown(entries: readonly DayBreakdownEntry[]): string {
  return entries
    .map((e) => `${Number.isInteger(e.days) ? e.days : e.days.toFixed(1)} ${e.code}`)
    .join(" · ");
}
