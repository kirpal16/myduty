import { describe, it, expect } from "vitest";
import {
  leaveDayCount,
  leaveDaysWithin,
  formatDays,
  summariseBreakdown,
  formatBreakdown,
} from "./leaveDays";

describe("leaveDayCount", () => {
  it("counts both ends of a multi-day leave", () => {
    expect(leaveDayCount("2026-09-08", "2026-09-12", false)).toBe(5);
  });

  it("counts a single day as 1 and a half-day as 0.5", () => {
    expect(leaveDayCount("2026-09-08", "2026-09-08", false)).toBe(1);
    expect(leaveDayCount("2026-09-08", "2026-09-08", true)).toBe(0.5);
  });

  it("crosses a month boundary", () => {
    expect(leaveDayCount("2026-01-30", "2026-02-02", false)).toBe(4);
  });
});

describe("leaveDaysWithin", () => {
  it("clips a leave to the period it overlaps", () => {
    expect(leaveDaysWithin("2026-01-29", "2026-02-03", false, "2026-01-01", "2026-01-31")).toBe(3);
    expect(leaveDaysWithin("2026-01-29", "2026-02-03", false, "2026-02-01", "2026-02-28")).toBe(3);
  });

  it("is zero outside the period and whole without bounds", () => {
    expect(leaveDaysWithin("2026-03-01", "2026-03-02", false, "2026-01-01", "2026-01-31")).toBe(0);
    expect(leaveDaysWithin("2026-03-01", "2026-03-02", false)).toBe(2);
  });
});

describe("formatDays", () => {
  it("pluralises", () => {
    expect(formatDays(1)).toBe("1 Day");
    expect(formatDays(0.5)).toBe("0.5 Day");
    expect(formatDays(12)).toBe("12 Days");
    expect(formatDays(2.5)).toBe("2.5 Days");
  });
});

describe("summariseBreakdown", () => {
  it("groups by code, largest first", () => {
    const rows = [
      { code: "CL", fraction: 1 },
      { code: "HL", fraction: 1 },
      { code: "CL", fraction: "1" },
      { code: "CL", fraction: 1 },
      { code: "HL", fraction: 1 },
      { code: "OH", fraction: 1 },
    ];
    const summary = summariseBreakdown(rows);
    expect(summary).toEqual([
      { code: "CL", days: 3 },
      { code: "HL", days: 2 },
      { code: "OH", days: 1 },
    ]);
    expect(formatBreakdown(summary)).toBe("3 CL · 2 HL · 1 OH");
  });
});
