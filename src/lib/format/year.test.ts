import { describe, it, expect } from "vitest";
import {
  getYearOptions,
  clampYear,
  getCurrentYear,
  isYearInWindow,
  YEAR_MIN_OFFSET,
  YEAR_MAX_OFFSET,
} from "./year";

// Every test pins the base year. Without it the suite starts failing on
// 1 January, which is the worst possible morning to debug a year helper.
const BASE = 2026;

describe("getYearOptions", () => {
  it("lists newest first, inclusive of both ends", () => {
    expect(getYearOptions(3, 2, BASE).map((o) => o.value)).toEqual([
      "2028",
      "2027",
      "2026",
      "2025",
      "2024",
      "2023",
    ]);
  });

  it("uses the same string for value and label", () => {
    expect(getYearOptions(1, 0, BASE)).toEqual([
      { value: "2026", label: "2026" },
      { value: "2025", label: "2025" },
    ]);
  });

  it("returns just the base year when asked for no span", () => {
    expect(getYearOptions(0, 0, BASE).map((o) => o.value)).toEqual(["2026"]);
  });

  it("treats a negative span as zero rather than producing a reversed list", () => {
    expect(getYearOptions(-5, -5, BASE).map((o) => o.value)).toEqual(["2026"]);
  });

  it("defaults to the current year when no base is given", () => {
    const opts = getYearOptions(1, 1);
    expect(opts.map((o) => Number(o.value))).toContain(getCurrentYear());
  });
});

describe("clampYear", () => {
  it("keeps a year already inside the window", () => {
    expect(clampYear(2025, YEAR_MIN_OFFSET, YEAR_MAX_OFFSET, BASE)).toBe(2025);
  });

  it("pulls a far-past year up to the oldest allowed", () => {
    expect(clampYear("1900", YEAR_MIN_OFFSET, YEAR_MAX_OFFSET, BASE)).toBe(2022);
  });

  it("pulls a far-future year down to the newest allowed", () => {
    expect(clampYear("99999", YEAR_MIN_OFFSET, YEAR_MAX_OFFSET, BASE)).toBe(2028);
  });

  // The URL delivers whatever someone typed. None of these may throw, and
  // none may silently become year zero.
  it("falls back to the base year for junk input", () => {
    expect(clampYear("2026abc", YEAR_MIN_OFFSET, YEAR_MAX_OFFSET, BASE)).toBe(BASE);
    expect(clampYear("abc", YEAR_MIN_OFFSET, YEAR_MAX_OFFSET, BASE)).toBe(BASE);
    expect(clampYear(NaN, YEAR_MIN_OFFSET, YEAR_MAX_OFFSET, BASE)).toBe(BASE);
    expect(clampYear(Infinity, YEAR_MIN_OFFSET, YEAR_MAX_OFFSET, BASE)).toBe(BASE);
  });

  it("falls back for empty, null and undefined rather than clamping to the oldest", () => {
    // Number("") and Number(null) are both 0, which would otherwise clamp to
    // the window's floor and quietly show the wrong year.
    expect(clampYear("", YEAR_MIN_OFFSET, YEAR_MAX_OFFSET, BASE)).toBe(BASE);
    expect(clampYear(null, YEAR_MIN_OFFSET, YEAR_MAX_OFFSET, BASE)).toBe(BASE);
    expect(clampYear(undefined, YEAR_MIN_OFFSET, YEAR_MAX_OFFSET, BASE)).toBe(BASE);
  });

  it("truncates a float to a whole year", () => {
    expect(clampYear("2025.9", YEAR_MIN_OFFSET, YEAR_MAX_OFFSET, BASE)).toBe(2025);
  });

  it("honours a narrower window than the default", () => {
    expect(clampYear(2028, -1, 0, BASE)).toBe(2026);
    expect(clampYear(2020, -1, 0, BASE)).toBe(2025);
  });
});

describe("the helper and the database agree", () => {
  it("clamps into exactly the window leave_balance_view produces", () => {
    // 0029 generates now()-4 .. now()+2. A UI offering more renders blank
    // pages for years the database has no rows for.
    expect(YEAR_MIN_OFFSET).toBe(-4);
    expect(YEAR_MAX_OFFSET).toBe(2);
  });

  it("every option a full-width selector offers survives the clamp unchanged", () => {
    const options = getYearOptions(-YEAR_MIN_OFFSET, YEAR_MAX_OFFSET, BASE);
    for (const o of options) {
      expect(clampYear(o.value, YEAR_MIN_OFFSET, YEAR_MAX_OFFSET, BASE)).toBe(
        Number(o.value),
      );
    }
  });

  it("isYearInWindow agrees with the clamp at both edges", () => {
    expect(isYearInWindow(2022, BASE)).toBe(true);
    expect(isYearInWindow(2028, BASE)).toBe(true);
    expect(isYearInWindow(2021, BASE)).toBe(false);
    expect(isYearInWindow(2029, BASE)).toBe(false);
  });
});
