import { describe, it, expect } from "vitest";
import { eventCoversDay, eventsForDay } from "./eventDays";

const day = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const local = (s: string) => new Date(s).toISOString();

describe("eventCoversDay — item 1", () => {
  it("a single-evening duty covers only its own day", () => {
    const e = { start: local("2026-09-08T10:00"), end: local("2026-09-08T18:00") };
    expect(eventCoversDay(e, day("2026-09-08"))).toBe(true);
    expect(eventCoversDay(e, day("2026-09-09"))).toBe(false);
  });

  it("a duty ending at exactly midnight does NOT bleed into the next day", () => {
    // The reported bug: 8 Sep 22:00 -> 9 Sep 00:00 painted both cells.
    const e = { start: local("2026-09-08T22:00"), end: local("2026-09-09T00:00") };
    expect(eventCoversDay(e, day("2026-09-08"))).toBe(true);
    expect(eventCoversDay(e, day("2026-09-09"))).toBe(false);
  });

  it("a duty genuinely running past midnight still covers both days", () => {
    const e = { start: local("2026-09-08T22:00"), end: local("2026-09-09T06:00") };
    expect(eventCoversDay(e, day("2026-09-08"))).toBe(true);
    expect(eventCoversDay(e, day("2026-09-09"))).toBe(true);
    expect(eventCoversDay(e, day("2026-09-10"))).toBe(false);
  });

  it("does not match the day before the start", () => {
    const e = { start: local("2026-09-08T10:00"), end: local("2026-09-08T18:00") };
    expect(eventCoversDay(e, day("2026-09-07"))).toBe(false);
  });

  it("an evening duty stored with trailing Z (e.g. 06:00 to 23:00) does NOT bleed into the next day in IST", () => {
    // 23:00 wall-clock instant stored as UTC (toWallClockISO)
    const e = { start: "2026-10-06T06:00:00.000Z", end: "2026-10-06T23:00:00.000Z" };
    expect(eventCoversDay(e, day("2026-10-06"))).toBe(true);
    expect(eventCoversDay(e, day("2026-10-07"))).toBe(false);
  });

  it("an evening duty on the 7th (07:00 to 22:00) does NOT show on the 8th", () => {
    const e = { start: "2026-10-07T07:00:00.000Z", end: "2026-10-07T22:00:00.000Z" };
    expect(eventCoversDay(e, day("2026-10-07"))).toBe(true);
    expect(eventCoversDay(e, day("2026-10-08"))).toBe(false);
  });
});

describe("eventCoversDay — all-day events keep an inclusive end", () => {
  it("a multi-day leave covers its final day", () => {
    // leave_logs.end_date is inclusive; this must not lose 10 Sep.
    const e = { start: "2026-09-08", end: "2026-09-10", allDay: true };
    for (const d of ["2026-09-08", "2026-09-09", "2026-09-10"]) {
      expect(eventCoversDay(e, day(d))).toBe(true);
    }
    expect(eventCoversDay(e, day("2026-09-11"))).toBe(false);
  });

  it("a single-day holiday covers exactly one day", () => {
    const e = { start: "2026-09-08", allDay: true };
    expect(eventCoversDay(e, day("2026-09-08"))).toBe(true);
    expect(eventCoversDay(e, day("2026-09-09"))).toBe(false);
  });

  it("a one-day all-day span where start equals end does not vanish", () => {
    const e = { start: "2026-09-08", end: "2026-09-08", allDay: true };
    expect(eventCoversDay(e, day("2026-09-08"))).toBe(true);
  });
});

describe("eventCoversDay — malformed input", () => {
  it("an unparseable start matches nothing", () => {
    expect(eventCoversDay({ start: "nope" }, day("2026-09-08"))).toBe(false);
  });

  it("an unparseable end falls back to a single day", () => {
    const e = { start: local("2026-09-08T10:00"), end: "nope" };
    expect(eventCoversDay(e, day("2026-09-08"))).toBe(true);
    expect(eventCoversDay(e, day("2026-09-09"))).toBe(false);
  });

  it("an end before the start does not produce an empty range", () => {
    const e = { start: local("2026-09-08T10:00"), end: local("2026-09-07T10:00") };
    expect(eventCoversDay(e, day("2026-09-08"))).toBe(true);
  });
});

describe("eventsForDay", () => {
  it("filters a mixed list", () => {
    const events = [
      { id: "a", start: local("2026-09-08T10:00"), end: local("2026-09-08T18:00") },
      { id: "b", start: local("2026-09-08T22:00"), end: local("2026-09-09T00:00") },
      { id: "c", start: "2026-09-08", end: "2026-09-10", allDay: true },
    ];
    expect(eventsForDay(events, day("2026-09-08")).map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(eventsForDay(events, day("2026-09-09")).map((e) => e.id)).toEqual(["c"]);
  });
});
