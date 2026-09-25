import type { TimeFormat } from "@/types/database";
import { formatTime, toDateKey } from "@/lib/format/datetime";
import { formatSafeMonthShort } from "@/lib/format/safeDate";

/**
 * The clock line for one event as seen from one particular day.
 *
 * A calendar event is not always contained by the day you are looking at: a
 * night shift runs into tomorrow, and a multi-day duty covers days that
 * contain neither its start nor its end. Printing the raw start and end on
 * every day would then be a lie — "22:00 – 06:00" on the second day of a
 * night shift reads as if the duty began that evening.
 *
 * So each side is labelled with its date whenever it falls outside the day
 * being viewed, and a day sitting wholly inside a longer duty says so instead
 * of inventing times it does not have.
 */
export function eventTimeRange(
  event: { start: string; end?: string; allDay?: boolean },
  viewedDay: Date,
  timeFormat: TimeFormat,
): string {
  // Leaves and holidays carry a date and no meaningful clock time.
  if (event.allDay) return "All day";

  const start = new Date(event.start);
  if (Number.isNaN(start.getTime())) return "";

  const dayKey = toDateKey(viewedDay);
  const startKey = toDateKey(start);

  const end = event.end ? new Date(event.end) : null;
  const endValid = end && !Number.isNaN(end.getTime());
  const endKey = endValid ? toDateKey(end) : null;

  // Deterministic "Sep 11", never toLocaleDateString(undefined): the server
  // (Node, en-US) and the browser (e.g. en-IN, "11 Sept") disagree, and this
  // label is rendered on both — a hydration mismatch on the calendar.
  const shortDate = (d: Date) => `${formatSafeMonthShort(d)} ${d.getDate()}`;

  // A day in the middle of a longer duty: no start, no end, just cover.
  if (startKey < dayKey && endKey && endKey > dayKey) return "All day (ongoing)";

  const startLabel =
    startKey === dayKey
      ? formatTime(start, timeFormat)
      : `${shortDate(start)} ${formatTime(start, timeFormat)}`;

  if (!endValid || !endKey) return startLabel;

  const endLabel =
    endKey === dayKey
      ? formatTime(end, timeFormat)
      : `${shortDate(end)} ${formatTime(end, timeFormat)}`;

  return `${startLabel} – ${endLabel}`;
}
