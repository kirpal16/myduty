// Deterministic date formatting helpers to prevent SSR / Client hydration mismatch
import { toGujaratiNumerals } from "@/lib/reports/gujaratiReportUtils";

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

export const GUJARATI_MONTH_NAMES = [
  "જાન્યુ",
  "ફેબ્રુ",
  "માર્ચ",
  "એપ્રિલ",
  "મે",
  "જૂન",
  "જુલાઈ",
  "ઓગસ્ટ",
  "સપ્ટે",
  "ઓક્ટો",
  "નવે",
  "ડિસે",
];

export const GUJARATI_MONTH_FULL_NAMES = [
  "જાન્યુઆરી",
  "ફેબ્રુઆરી",
  "માર્ચ",
  "એપ્રિલ",
  "મે",
  "જૂન",
  "જુલાઈ",
  "ઓગસ્ટ",
  "સપ્ટેમ્બર",
  "ઓક્ટોબર",
  "નવેમ્બર",
  "ડિસેમ્બર",
];

export const GUJARATI_WEEKDAY_NAMES = ["રવિ", "સોમ", "મંગળ", "બુધ", "ગુરુ", "શુક્ર", "શનિ"];
export const GUJARATI_WEEKDAY_FULL_NAMES = [
  "રવિવાર",
  "સોમવાર",
  "મંગળવાર",
  "બુધવાર",
  "ગુરુવાર",
  "શુક્રવાર",
  "શનિવાર",
];

export function formatSafeWeekdayShort(d: Date, isGujarati = false): string {
  return (isGujarati ? GUJARATI_WEEKDAY_NAMES : WEEKDAY_NAMES)[d.getDay()] || "";
}

export function formatSafeWeekdayFull(d: Date, isGujarati = false): string {
  return (isGujarati ? GUJARATI_WEEKDAY_FULL_NAMES : WEEKDAY_FULL_NAMES)[d.getDay()] || "";
}

export function formatSafeMonthShort(d: Date, isGujarati = false): string {
  return (isGujarati ? GUJARATI_MONTH_NAMES : MONTH_NAMES)[d.getMonth()] || "";
}

export function formatSafeMonthFull(d: Date, isGujarati = false): string {
  return (isGujarati ? GUJARATI_MONTH_FULL_NAMES : MONTH_FULL_NAMES)[d.getMonth()] || "";
}

/**
 * Returns deterministic "Tue, Sep 8" or "મંગળ, 8 સપ્ટે" without locale mismatch
 */
export function formatSafeDateShort(dateInput: string | Date | number, isGujarati = false): string {
  const d = typeof dateInput === "object" ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  if (isGujarati) {
    return `${GUJARATI_WEEKDAY_NAMES[d.getDay()]}, ${toGujaratiNumerals(d.getDate())} ${GUJARATI_MONTH_NAMES[d.getMonth()]}`;
  }
  return `${WEEKDAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

/**
 * Returns deterministic "Tuesday, September 8, 2026" or "મંગળવાર, 8 સપ્ટેમ્બર, 2026"
 */
export function formatSafeDateFull(dateInput: string | Date | number, isGujarati = false): string {
  const d = typeof dateInput === "object" ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  if (isGujarati) {
    return `${GUJARATI_WEEKDAY_FULL_NAMES[d.getDay()]}, ${toGujaratiNumerals(d.getDate())} ${GUJARATI_MONTH_FULL_NAMES[d.getMonth()]}, ${toGujaratiNumerals(d.getFullYear())}`;
  }
  return `${WEEKDAY_FULL_NAMES[d.getDay()]}, ${MONTH_FULL_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/**
 * Returns deterministic "Sep 8, 2026" or "8 સપ્ટેમ્બર, 2026"
 */
export function formatSafeDateMonthYear(dateInput: string | Date | number, isGujarati = false): string {
  const d = typeof dateInput === "object" ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  if (isGujarati) {
    return `${toGujaratiNumerals(d.getDate())} ${GUJARATI_MONTH_FULL_NAMES[d.getMonth()]}, ${toGujaratiNumerals(d.getFullYear())}`;
  }
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
