"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Keeps an end date following a start date until the officer takes over.
 *
 * Both forms made you type the end value by hand every time, even though it is
 * almost always the same day — the duty form at the shift's end time, the leave
 * form the same date. Auto-filling it unconditionally would be worse, though:
 * it would overwrite a deliberate multi-day entry every time the start moved.
 *
 * So the link is one-way and gives up permanently the moment the end is edited
 * directly. After that the field is the officer's, and nothing moves it.
 */
export function useLinkedEndDate({
  initialEnd = "",
  deriveEnd,
}: {
  initialEnd?: string;
  /** Given a new start value, what the end should become. */
  deriveEnd: (start: string) => string;
}) {
  const [endValue, setEndValue] = useState(initialEnd);
  // A ref, not state: changing it must not re-render, and it is never read
  // during render — only inside the change handlers.
  const detached = useRef(false);

  const onStartChange = useCallback(
    (start: string) => {
      if (detached.current || !start) return;
      const next = deriveEnd(start);
      if (next) setEndValue(next);
    },
    [deriveEnd],
  );

  /**
   * The officer edited the end. Only a real value takes control of it: the
   * browser reports "" while a date is half-typed or cleared, and that must
   * not permanently stop the end following the start.
   */
  const onEndChange = useCallback((value: string) => {
    if (value) detached.current = true;
    setEndValue(value);
  }, []);

  /** Set the end from code (a type switch, a holiday picker) without detaching it. */
  const setEnd = useCallback((value: string) => {
    setEndValue(value);
  }, []);

  /** Let the end follow the start again. */
  const relink = useCallback(() => {
    detached.current = false;
  }, []);

  /** True once the officer has taken control of the end field. */
  const isDetached = () => detached.current;

  return { endValue, onStartChange, onEndChange, setEnd, relink, isDetached };
}

/**
 * `datetime-local` end value for a duty: the officer's configured shift end,
 * on the start's own day — or the next day when the shift runs past midnight.
 *
 * The overnight case is why this is not a one-liner. Pinning the end to the
 * start's calendar day meant a night shift beginning at 22:00 got an end of
 * 18:00 THAT SAME DAY, before its own start; the form then refused to submit
 * with "End time must be after start time", blaming a field the officer never
 * touched. Night duty is routine, so this was not an edge case.
 *
 * The `<=` rule matches `splitIntoDailyDuties` in @/lib/duty/splitDuty
 * exactly, so the form's guess and the server's day-splitting agree on what
 * counts as overnight instead of contradicting each other.
 */
export function deriveDutyEnd(shiftEnd: string) {
  return (start: string) => {
    const day = start.slice(0, 10);
    if (!day) return "";

    const startMinutes = minutesOfDay(start.slice(11, 16));
    const endMinutes = minutesOfDay(shiftEnd);
    if (startMinutes === null || endMinutes === null) return `${day}T${shiftEnd}`;

    if (endMinutes <= startMinutes) return `${nextDay(day)}T${shiftEnd}`;
    return `${day}T${shiftEnd}`;
  };
}

/** "HH:MM" (or "HH:MM:SS") to minutes past midnight; null if unparseable. */
function minutesOfDay(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})/.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * "YYYY-MM-DD" one day later. Built through Date so month and year rollovers
 * (and leap days) come from the calendar rather than from string arithmetic.
 */
function nextDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1, d + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A leave's end date defaults to the day it starts. */
export function deriveLeaveEnd(start: string) {
  return start;
}
