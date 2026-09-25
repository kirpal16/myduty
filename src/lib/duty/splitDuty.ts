import { toDateKey } from "@/lib/format/datetime";

export type DutyDaySlot = {
  /** Local calendar day this slot belongs to ("2026-09-08"). */
  dateKey: string;
  startsAt: Date;
  endsAt: Date;
};

/**
 * A duty spanning several days becomes one duty per day.
 *
 * The officer enters "8 Sep 10:00 -> 10 Sep 18:00" meaning three 10-18
 * shifts, not one 56-hour block. Storing it as a single row made the calendar
 * paint a solid bar across three days, made per-day TA impossible (each day
 * has its own route and amount), and made a holiday falling in the middle
 * invisible.
 *
 * The window is taken from the time-of-day of the two inputs and repeated on
 * every calendar day in between:
 *
 *   8 Sep 10:00 -> 10 Sep 18:00   becomes   8 Sep 10:00-18:00
 *                                           9 Sep 10:00-18:00
 *                                          10 Sep 10:00-18:00
 *
 * When the end time is at or before the start time the shift is an overnight
 * one, so each slot runs into the following morning (22:00 -> 06:00).
 */
export function splitIntoDailyDuties(startsAt: Date, endsAt: Date): DutyDaySlot[] {
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new Error("splitIntoDailyDuties: invalid date");
  }

  const startH = startsAt.getHours();
  const startM = startsAt.getMinutes();
  const endH = endsAt.getHours();
  const endM = endsAt.getMinutes();

  // An overnight window ends the next morning, so the last calendar day the
  // officer STARTS a shift is the day before the entered end date.
  const overnight = endH * 60 + endM <= startH * 60 + startM;

  const firstDay = new Date(
    startsAt.getFullYear(),
    startsAt.getMonth(),
    startsAt.getDate(),
  );
  const lastDay = new Date(endsAt.getFullYear(), endsAt.getMonth(), endsAt.getDate());
  if (overnight) lastDay.setDate(lastDay.getDate() - 1);

  // A same-day entry always produces exactly one slot, even if the overnight
  // adjustment would otherwise walk the range backwards.
  if (lastDay.getTime() < firstDay.getTime()) {
    lastDay.setTime(firstDay.getTime());
  }

  const slots: DutyDaySlot[] = [];
  const cursor = new Date(firstDay);

  while (cursor.getTime() <= lastDay.getTime()) {
    const s = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate(),
      startH,
      startM,
      0,
      0,
    );
    const e = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() + (overnight ? 1 : 0),
      endH,
      endM,
      0,
      0,
    );
    slots.push({ dateKey: toDateKey(s), startsAt: s, endsAt: e });
    cursor.setDate(cursor.getDate() + 1);
  }

  return slots;
}

/** Whether the entry spans more than one calendar day. */
export function isMultiDay(startsAt: Date, endsAt: Date): boolean {
  return splitIntoDailyDuties(startsAt, endsAt).length > 1;
}
