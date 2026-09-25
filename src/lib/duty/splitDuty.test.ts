import { describe, it, expect } from "vitest";
import { splitIntoDailyDuties, isMultiDay } from "./splitDuty";

const at = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min, 0, 0);

const shape = (slots: ReturnType<typeof splitIntoDailyDuties>) =>
  slots.map((s) => [
    s.dateKey,
    `${String(s.startsAt.getHours()).padStart(2, "0")}:${String(s.startsAt.getMinutes()).padStart(2, "0")}`,
    `${String(s.endsAt.getHours()).padStart(2, "0")}:${String(s.endsAt.getMinutes()).padStart(2, "0")}`,
  ]);

describe("splitIntoDailyDuties", () => {
  it("leaves a single-day duty as one slot", () => {
    const slots = splitIntoDailyDuties(at(2026, 9, 8, 10), at(2026, 9, 8, 18));
    expect(shape(slots)).toEqual([["2026-09-08", "10:00", "18:00"]]);
    expect(isMultiDay(at(2026, 9, 8, 10), at(2026, 9, 8, 18))).toBe(false);
  });

  it("repeats the same shift window across a 3-day span", () => {
    const slots = splitIntoDailyDuties(at(2026, 9, 8, 10), at(2026, 9, 10, 18));
    expect(shape(slots)).toEqual([
      ["2026-09-08", "10:00", "18:00"],
      ["2026-09-09", "10:00", "18:00"],
      ["2026-09-10", "10:00", "18:00"],
    ]);
  });

  it("keeps minutes, not just hours", () => {
    const slots = splitIntoDailyDuties(at(2026, 9, 8, 9, 30), at(2026, 9, 9, 17, 45));
    expect(shape(slots)).toEqual([
      ["2026-09-08", "09:30", "17:45"],
      ["2026-09-09", "09:30", "17:45"],
    ]);
  });

  it("runs an overnight window into the following morning", () => {
    const slots = splitIntoDailyDuties(at(2026, 9, 8, 22), at(2026, 9, 10, 6));
    expect(shape(slots)).toEqual([
      ["2026-09-08", "22:00", "06:00"],
      ["2026-09-09", "22:00", "06:00"],
    ]);
    // The last shift starts on the 9th and ends on the 10th.
    expect(slots[1].endsAt.getDate()).toBe(10);
    expect(slots.every((s) => s.endsAt > s.startsAt)).toBe(true);
  });

  it("treats a single overnight shift as one slot", () => {
    const slots = splitIntoDailyDuties(at(2026, 9, 8, 22), at(2026, 9, 9, 6));
    expect(shape(slots)).toEqual([["2026-09-08", "22:00", "06:00"]]);
    expect(slots[0].endsAt.getDate()).toBe(9);
  });

  it("crosses a month boundary", () => {
    const slots = splitIntoDailyDuties(at(2026, 8, 30, 10), at(2026, 9, 2, 18));
    expect(shape(slots).map((s) => s[0])).toEqual([
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
    ]);
  });

  it("crosses a year boundary", () => {
    const slots = splitIntoDailyDuties(at(2026, 12, 31, 10), at(2027, 1, 2, 18));
    expect(shape(slots).map((s) => s[0])).toEqual([
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
  });

  it("handles a leap day", () => {
    const slots = splitIntoDailyDuties(at(2028, 2, 28, 10), at(2028, 3, 1, 18));
    expect(shape(slots).map((s) => s[0])).toEqual([
      "2028-02-28",
      "2028-02-29",
      "2028-03-01",
    ]);
  });

  it("every slot ends after it starts", () => {
    const slots = splitIntoDailyDuties(at(2026, 9, 1, 10), at(2026, 9, 30, 18));
    expect(slots).toHaveLength(30);
    expect(slots.every((s) => s.endsAt.getTime() > s.startsAt.getTime())).toBe(true);
  });

  it("rejects an invalid date", () => {
    expect(() => splitIntoDailyDuties(new Date("nope"), at(2026, 9, 8, 18))).toThrow();
  });
});
