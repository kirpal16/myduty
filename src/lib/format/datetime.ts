import type { TimeFormat } from "@/types/database";
import { formatSafeTime } from "./safeDate";

/**
 * Single place the per-user 12h/24h preference is applied. Every screen
 * formats through these instead of calling toLocaleString() ad hoc, so the
 * toggle in /settings actually reaches the whole app.
 *
 * Note `hour12` is set explicitly rather than left to the locale — that's
 * the entire point of the preference.
 */
function timeOptions(timeFormat: TimeFormat): Intl.DateTimeFormatOptions {
  return {
    hour: "2-digit",
    minute: "2-digit",
    hour12: timeFormat === "12h",
  };
}

export function formatDateTime(
  value: string | Date,
  timeFormat: TimeFormat,
): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...timeOptions(timeFormat),
  });
}

export function formatTime(
  value: string | Date,
  timeFormat: TimeFormat,
): string {
  // Deterministic, not toLocaleTimeString(undefined): this renders inside
  // client components on both the server and the browser, and locales
  // disagree ("04:30 PM" vs "4:30 pm"), which breaks hydration.
  return formatSafeTime(value, timeFormat === "12h");
}

/** Dates carry no time, so the preference doesn't apply here. */
export function formatDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** A leave log's date span, collapsing a single-date entry to one date. */
export function formatDateRange(startDate: string, endDate: string): string {
  return startDate === endDate
    ? formatDate(startDate)
    : `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

/**
 * <input type="datetime-local"> speaks wall-clock with no offset
 * ("2026-09-08T18:00"). Handing that straight to a timestamptz column makes
 * Postgres resolve it against UTC, so an 18:00 IST duty was stored as 18:00Z
 * and read back as 23:30 IST — which is what pushed evening duties onto the
 * next day in the calendar.
 *
 * Every write path converts through here, so the instant that reaches the
 * database is the one the officer meant.
 */
export function localInputToISO(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Not a valid datetime-local value: ${value}`);
  }
  return d.toISOString();
}

/** The inverse, for pre-filling the same input from a stored instant. */
export function isoToLocalInput(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/** Local calendar-day key ("2026-09-08"), never UTC-shifted. */
export function toDateKey(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The first and last instant of a local calendar day, as ISO strings for a
 * timestamptz range filter.
 *
 * Date filters used to append a literal "Z" to the date, which asked Postgres
 * for the UTC day. In IST that window starts 5h30m late, so an evening duty
 * fell outside its own day's range and vanished from the filtered list.
 */
export function localDayStart(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

export function localDayEnd(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}
