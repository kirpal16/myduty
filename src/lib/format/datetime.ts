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
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    timeZone: "UTC",
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
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
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
 * Converts a <input type="datetime-local"> value ("2026-09-08T18:00")
 * to a UTC ISO string ("2026-09-08T18:00:00.000Z") preserving the exact wall-clock instant.
 */
export function localInputToISO(value: string): string {
  if (!value) return "";
  if (value.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(value)) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new Error(`Not a valid datetime value: ${value}`);
    return d.toISOString();
  }
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/.exec(value);
  if (!m) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new Error(`Not a valid datetime-local value: ${value}`);
    }
    return d.toISOString();
  }
  const [, date, time, sec = "00"] = m;
  return `${date}T${time}:${sec}.000Z`;
}

/** The inverse, for pre-filling the same input from a stored instant. */
export function isoToLocalInput(iso: string | Date): string {
  if (!iso) return "";
  if (typeof iso === "string") {
    const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
    if (m) return `${m[1]}T${m[2]}`;
  }
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  );
}

/**
 * Converts a Date or string to an ISO string with the wall-clock time preserved as UTC.
 */
export function toWallClockISO(d: Date | string): string {
  if (typeof d === "string") return localInputToISO(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00.000Z`;
}

/** Local calendar-day key ("2026-09-08"), never shifted across timezones. */
export function toDateKey(value: string | Date): string {
  if (typeof value === "string") {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(value);
    if (m) return m[1];
  }
  const d = typeof value === "string" ? new Date(value) : value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The first and last instant of a calendar day, as ISO strings for a
 * timestamptz range filter.
 */
export function localDayStart(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(y)}-${pad(m)}-${pad(d)}T00:00:00.000Z`;
}

export function localDayEnd(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(y)}-${pad(m)}-${pad(d)}T23:59:59.999Z`;
}
