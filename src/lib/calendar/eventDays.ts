/**
 * Which calendar cells an event occupies.
 *
 * Shared by the month grid and the day-details modal, which previously each
 * carried their own copy of this comparison and so could disagree.
 *
 * The rule is inclusive-by-midnight — an event covers every day from its
 * start's midnight to its end's midnight — with one correction: an end that
 * lands exactly on midnight belongs to the previous day. A duty running
 * 8 Sep 22:00 to 9 Sep 00:00 finished ON the 8th; treating that boundary as
 * inclusive is what painted a single-evening duty across two dates.
 *
 * All-day events (leave spans, holidays) are unaffected: `leave_logs.end_date`
 * is inclusive by design.
 *
 * NOTE ON TIMEZONES / IST:
 * Duties in the database store the officer's wall-clock instant formatted
 * with a trailing "Z" (via toWallClockISO, e.g. "2026-10-06T23:00:00.000Z").
 * Calling `new Date(event.start)` in a browser running in Indian Standard Time
 * (IST, UTC+05:30) or any non-UTC timezone would shift 23:00 into 04:30 AM the
 * following morning, causing single-day duties to bleed into the next day.
 * We parse the wall-clock calendar date and clock time directly from the string.
 */
export type DaySpanEvent = {
  start: string;
  end?: string;
  allDay?: boolean;
};

type WallClockParts = {
  year: number;
  month: number; // 0-indexed
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
};

export function parseWallClock(str: string): WallClockParts | null {
  if (!str || typeof str !== "string") return null;
  // Match "YYYY-MM-DD" optionally followed by "THH:mm(:ss)?"
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(str);
  if (m) {
    return {
      year: Number(m[1]),
      month: Number(m[2]) - 1,
      day: Number(m[3]),
      hours: m[4] !== undefined ? Number(m[4]) : 0,
      minutes: m[5] !== undefined ? Number(m[5]) : 0,
      seconds: m[6] !== undefined ? Number(m[6]) : 0,
    };
  }
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return null;
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes(),
    seconds: d.getUTCSeconds(),
  };
}

function midnightOf(d: Date | string): number {
  if (typeof d === "string") {
    const p = parseWallClock(d);
    if (p) return new Date(p.year, p.month, p.day).getTime();
    const parsed = new Date(d);
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
  }
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** The inclusive [firstDay, lastDay] midnights an event covers. */
export function eventDayRange(event: DaySpanEvent): { from: number; to: number } | null {
  const startParsed = parseWallClock(event.start);
  if (!startParsed) return null;

  const endParsed = event.end ? parseWallClock(event.end) : startParsed;
  if (!endParsed) {
    const from = new Date(startParsed.year, startParsed.month, startParsed.day).getTime();
    return { from, to: from };
  }

  const from = new Date(startParsed.year, startParsed.month, startParsed.day).getTime();
  const toDate = new Date(endParsed.year, endParsed.month, endParsed.day);

  // A timed event ending at exactly midnight (00:00:00) belongs to the day before,
  // provided it spans past the start day.
  const isMidnight =
    endParsed.hours === 0 &&
    endParsed.minutes === 0 &&
    endParsed.seconds === 0;

  if (!event.allDay && isMidnight && toDate.getTime() > from) {
    toDate.setDate(toDate.getDate() - 1);
  }

  const to = toDate.getTime();
  return { from, to: Math.max(from, to) };
}

/** Whether an event should render on a given calendar day. */
export function eventCoversDay(event: DaySpanEvent, day: Date): boolean {
  const range = eventDayRange(event);
  if (!range) return false;
  const target = midnightOf(day);
  return target >= range.from && target <= range.to;
}

/** Filter helper, so callers read as intent rather than arithmetic. */
export function eventsForDay<T extends DaySpanEvent>(events: readonly T[], day: Date): T[] {
  return events.filter((e) => eventCoversDay(e, day));
}
