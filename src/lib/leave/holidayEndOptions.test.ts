import { describe, it, expect } from "vitest";
import { holidayEndOptions, type HolidayOption } from "./holidayLeaveRules";

const opt = (date: string, label: string, disabledReason?: string): HolidayOption => ({
  date,
  label,
  kindLabel: label,
  ...(disabledReason ? { disabledReason } : {}),
});

/**
 * The real shape of a January: Sundays on the 4th and 11th, a festival on the
 * 5th (so the 4th–5th are consecutive), and the 2nd Saturday on the 10th —
 * six working days after the 4th.
 */
const january: HolidayOption[] = [
  opt("2026-01-04", "Sunday"),
  opt("2026-01-05", "Makar Sankranti"),
  opt("2026-01-10", "2nd Saturday"),
  opt("2026-01-11", "Sunday"),
];

describe("holidayEndOptions", () => {
  it("offers the run of consecutive holidays from the start", () => {
    const dates = holidayEndOptions(january, "2026-01-04").map((o) => o.date);
    expect(dates).toEqual(["2026-01-04", "2026-01-05"]);
  });

  it("stops at the gap — a later holiday is not a valid end", () => {
    const dates = holidayEndOptions(january, "2026-01-04").map((o) => o.date);
    // The 2nd Saturday is six working days later; that span is not all holiday.
    expect(dates).not.toContain("2026-01-10");
  });

  it("offers the start alone when the next day is a working day", () => {
    const dates = holidayEndOptions(january, "2026-01-05").map((o) => o.date);
    expect(dates).toEqual(["2026-01-05"]);
  });

  it("joins a weekend pair", () => {
    const dates = holidayEndOptions(january, "2026-01-10").map((o) => o.date);
    expect(dates).toEqual(["2026-01-10", "2026-01-11"]);
  });

  it("treats a disabled day as a gap, not a bridge", () => {
    // The 5th was worked, so it cannot be taken — and it cannot connect the
    // 4th to the 6th either.
    const withWorked = [
      opt("2026-01-04", "Sunday"),
      opt("2026-01-05", "Makar Sankranti", "You worked this day"),
      opt("2026-01-06", "Festival"),
    ];
    const dates = holidayEndOptions(withWorked, "2026-01-04").map((o) => o.date);
    expect(dates).toEqual(["2026-01-04"]);
  });

  it("returns nothing when the start is not a selectable holiday", () => {
    expect(holidayEndOptions(january, "2026-01-07")).toEqual([]);
    expect(
      holidayEndOptions([opt("2026-01-04", "Sunday", "Already taken")], "2026-01-04"),
    ).toEqual([]);
  });

  it("returns nothing for an empty start", () => {
    expect(holidayEndOptions(january, "")).toEqual([]);
  });

  it("walks across a YEAR boundary", () => {
    // Only reachable since loadHolidayOptions started loading the next year
    // too. Before that the option list stopped at 31 December, so a New Year
    // run silently truncated there.
    const newYear = [
      opt("2026-12-31", "Thursday"),
      opt("2027-01-01", "New Year"),
      opt("2027-01-03", "Sunday"),
    ];
    const dates = holidayEndOptions(newYear, "2026-12-31").map((o) => o.date);
    expect(dates).toEqual(["2026-12-31", "2027-01-01"]);
    // The 3rd is two days later, so the run must not reach it.
    expect(dates).not.toContain("2027-01-03");
  });

  it("walks across a month boundary", () => {
    const monthEnd = [
      opt("2026-01-31", "Saturday"),
      opt("2026-02-01", "Sunday"),
    ];
    const dates = holidayEndOptions(monthEnd, "2026-01-31").map((o) => o.date);
    expect(dates).toEqual(["2026-01-31", "2026-02-01"]);
  });
});
