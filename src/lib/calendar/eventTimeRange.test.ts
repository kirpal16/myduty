import { describe, it, expect } from "vitest";
import { eventTimeRange } from "./eventTimeRange";

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);
const at = (y: number, m: number, d: number, hh: number, mm = 0) =>
  new Date(y, m - 1, d, hh, mm).toISOString();

describe("eventTimeRange", () => {
  it("shows plain times for a duty inside one day", () => {
    const out = eventTimeRange(
      { start: at(2026, 9, 8, 10), end: at(2026, 9, 8, 18) },
      day(2026, 9, 8),
      "24h",
    );
    expect(out).toBe("10:00 – 18:00");
  });

  it("honours the 12h preference", () => {
    const out = eventTimeRange(
      { start: at(2026, 9, 8, 10), end: at(2026, 9, 8, 18) },
      day(2026, 9, 8),
      "12h",
    );
    expect(out).toMatch(/10:00\s?AM – 06:00\s?PM/i);
  });

  it("dates the far side of a night shift", () => {
    // The date half is locale-formatted (en-US "Sep 9", en-GB "9 Sept"), so
    // these assert the shape rather than one locale's spelling.

    // Seen from the evening it starts: only the end carries a date.
    const fromStartDay = eventTimeRange(
      { start: at(2026, 9, 8, 22), end: at(2026, 9, 9, 6) },
      day(2026, 9, 8),
      "24h",
    );
    expect(fromStartDay).toMatch(/^22:00 – .*9.*06:00$/);
    expect(fromStartDay).toMatch(/Sep/i);

    // Seen from the morning it ends: the start must not read as today.
    const fromEndDay = eventTimeRange(
      { start: at(2026, 9, 8, 22), end: at(2026, 9, 9, 6) },
      day(2026, 9, 9),
      "24h",
    );
    expect(fromEndDay).toMatch(/^.*8.*22:00 – 06:00$/);
    expect(fromEndDay).toMatch(/Sep/i);
  });

  it("says 'ongoing' for a day wholly inside a multi-day duty", () => {
    const out = eventTimeRange(
      { start: at(2026, 9, 7, 9), end: at(2026, 9, 10, 17) },
      day(2026, 9, 8),
      "24h",
    );
    expect(out).toBe("All day (ongoing)");
  });

  it("reports all-day entries without a clock", () => {
    const out = eventTimeRange(
      { start: "2026-09-08", allDay: true },
      day(2026, 9, 8),
      "24h",
    );
    expect(out).toBe("All day");
  });

  it("falls back to the start alone when there is no end", () => {
    const out = eventTimeRange(
      { start: at(2026, 9, 8, 7, 30) },
      day(2026, 9, 8),
      "24h",
    );
    expect(out).toBe("07:30");
  });

  it("returns nothing for an unparseable start", () => {
    expect(eventTimeRange({ start: "not-a-date" }, day(2026, 9, 8), "24h")).toBe("");
  });
});
