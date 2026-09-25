/**
 * Which calendar cells an event occupies.
 *
 * Shared by the month grid and the day-details modal, which previously each
 * carried their own copy of this comparison and so could disagree.
 *
 * The rule is inclusive-by-midnight — an event covers every day from its
 * start's midnight to its end's midnight — with one correction: an end that
 * lands exactly on local midnight belongs to the previous day. A duty running
 * 8 Sep 22:00 to 9 Sep 00:00 finished ON the 8th; treating that boundary as
 * inclusive is what painted a single-evening duty across two dates.
 *
 * All-day events (leave spans, holidays) are unaffected: `leave_logs.end_date`
 * is inclusive by design, and a date-only string never parses to local
 * midnight outside UTC. The guard below keeps it inclusive even when it does.
 */
export type DaySpanEvent = {
  start: string;
  end?: string;
  allDay?: boolean;
};

function midnightOf(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function isLocalMidnight(d: Date): boolean {
  return (
    d.getHours() === 0 &&
    d.getMinutes() === 0 &&
    d.getSeconds() === 0 &&
    d.getMilliseconds() === 0
  );
}

/** The inclusive [firstDay, lastDay] midnights an event covers. */
export function eventDayRange(event: DaySpanEvent): { from: number; to: number } | null {
  const start = new Date(event.start);
  if (Number.isNaN(start.getTime())) return null;

  const end = event.end ? new Date(event.end) : start;
  if (Number.isNaN(end.getTime())) return { from: midnightOf(start), to: midnightOf(start) };

  const from = midnightOf(start);
  let to = midnightOf(end);

  // A timed event ending at exactly midnight ends on the day before.
  if (!event.allDay && isLocalMidnight(end) && to > from) {
    to -= 24 * 60 * 60 * 1000;
  }

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
