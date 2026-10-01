// Deterministic date formatting helpers to prevent SSR / Client hydration mismatch

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTH_FULL_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_FULL_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function formatSafeWeekdayShort(d: Date): string {
  return WEEKDAY_NAMES[d.getDay()] || "";
}

export function formatSafeWeekdayFull(d: Date): string {
  return WEEKDAY_FULL_NAMES[d.getDay()] || "";
}

export function formatSafeMonthShort(d: Date): string {
  return MONTH_NAMES[d.getMonth()] || "";
}

export function formatSafeMonthFull(d: Date): string {
  return MONTH_FULL_NAMES[d.getMonth()] || "";
}

/**
 * Returns deterministic "Tue, Sep 8" without locale mismatch
 */
export function formatSafeDateShort(dateInput: string | Date | number): string {
  const d = typeof dateInput === "object" ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  return `${WEEKDAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

/**
 * Returns deterministic "Tuesday, September 8, 2026"
 */
export function formatSafeDateFull(dateInput: string | Date | number): string {
  const d = typeof dateInput === "object" ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  return `${WEEKDAY_FULL_NAMES[d.getDay()]}, ${MONTH_FULL_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/**
 * Returns deterministic "Sep 8, 2026"
 */
export function formatSafeDateMonthYear(dateInput: string | Date | number): string {
  const d = typeof dateInput === "object" ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/**
 * Returns deterministic time "09:30 AM" or "14:30" without timezone offset jumping
 */
export function formatSafeTime(dateInput: string | Date | number, format12h = false): string {
  if (!dateInput && dateInput !== 0) return "";
  let hours: number;
  let minutes: string;

  if (typeof dateInput === "string") {
    const m = /T(\d{2}):(\d{2})/.exec(dateInput);
    if (m) {
      hours = Number(m[1]);
      minutes = m[2];
    } else {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return "";
      hours = d.getUTCHours();
      minutes = String(d.getUTCMinutes()).padStart(2, "0");
    }
  } else {
    const d = typeof dateInput === "object" ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return "";
    hours = d.getUTCHours();
    minutes = String(d.getUTCMinutes()).padStart(2, "0");
  }

  if (!format12h) {
    return `${String(hours).padStart(2, "0")}:${minutes}`;
  }

  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${minutes} ${ampm}`;
}
