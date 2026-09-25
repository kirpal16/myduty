import { describe, it, expect } from "vitest";
import { summariseHolidayYear } from "./holidayYearSummary";
import type { HolidayRecord } from "./resolveHoliday";

const global = (name: string, date: string): HolidayRecord => ({
  name,
  holiday_date: date,
  scope: "GLOBAL",
  is_government: true,
});

describe("summariseHolidayYear — weekend arithmetic", () => {
  it("counts every Sunday in 2026", () => {
    // 2026 starts on a Thursday and is not a leap year: 52 Sundays.
    expect(summariseHolidayYear(2026).sundays.length).toBe(52);
  });

  it("counts two Saturdays per month", () => {
    // The 2nd and 4th of twelve months.
    expect(summariseHolidayYear(2026).weekendSaturdays.length).toBe(24);
  });

  it("excludes 1st, 3rd and 5th Saturdays", () => {
    const s = summariseHolidayYear(2026);
    // 2026 has 52 Saturdays; only 24 of them qualify.
    expect(s.weekendSaturdays.length).toBeLessThan(52);
    expect(s.weekendSaturdays.length).toBe(24);
  });

  it("with no festivals, the total is just the weekend days", () => {
    const s = summariseHolidayYear(2026);
    expect(s.festivals.length).toBe(0);
    expect(s.overlaps.length).toBe(0);
    expect(s.total).toBe(s.sundays.length + s.weekendSaturdays.length);
    expect(s.total).toBe(76);
  });
});

describe("summariseHolidayYear — festivals and overlap", () => {
  it("adds a festival that falls on a working day", () => {
    // 2026-01-26 (Republic Day) is a Monday.
    const s = summariseHolidayYear(2026, [global("Republic Day", "2026-01-26")]);
    expect(s.festivals.length).toBe(1);
    expect(s.overlaps.length).toBe(0);
    expect(s.total).toBe(77);
  });

  it("does not double-count a festival falling on a Sunday", () => {
    // 2026-11-08 (Diwali) is a Sunday.
    const s = summariseHolidayYear(2026, [global("Diwali", "2026-11-08")]);
    expect(s.festivals.length).toBe(1);
    expect(s.overlaps.length).toBe(1);
    expect(s.total).toBe(76); // unchanged
  });

  it("does not double-count a festival on a 2nd Saturday", () => {
    // 2026-09-12 is a 2nd Saturday.
    const s = summariseHolidayYear(2026, [global("Festival", "2026-09-12")]);
    expect(s.overlaps.length).toBe(1);
    expect(s.total).toBe(76);
  });

  it("treats two rows naming the same day as one festival", () => {
    const s = summariseHolidayYear(2026, [
      global("Republic Day", "2026-01-26"),
      global("Republic Day (duplicate row)", "2026-01-26"),
    ]);
    expect(s.festivals.length).toBe(1);
    expect(s.total).toBe(77);
  });

  it("ignores rows from another year", () => {
    const s = summariseHolidayYear(2026, [global("Next year", "2027-01-26")]);
    expect(s.festivals.length).toBe(0);
    expect(s.total).toBe(76);
  });
});

describe("summariseHolidayYear — the arithmetic the UI shows", () => {
  it("parts minus overlap always equals the total", () => {
    const cases: HolidayRecord[][] = [
      [],
      [global("A", "2026-01-26")],
      [global("A", "2026-11-08")], // Sunday
      [global("A", "2026-09-12")], // 2nd Saturday
      [
        global("A", "2026-01-26"),
        global("B", "2026-11-08"),
        global("C", "2026-09-12"),
        global("D", "2026-03-04"),
      ],
    ];
    for (const rows of cases) {
      const s = summariseHolidayYear(2026, rows);
      expect(s.sundays.length + s.weekendSaturdays.length + s.festivals.length - s.overlaps.length).toBe(s.total);
    }
  });

  it("the real 2026 gazetted list gives a checkable total", () => {
    // The 27 dates migration 0025 seeds for 2026.
    const gazetted2026 = [
      "2026-01-14", "2026-01-15", "2026-01-26", "2026-02-15", "2026-03-04",
      "2026-03-20", "2026-03-21", "2026-03-28", "2026-03-31", "2026-04-03",
      "2026-04-14", "2026-05-01", "2026-05-28", "2026-06-26", "2026-08-15",
      "2026-08-28", "2026-09-04", "2026-09-14", "2026-09-25", "2026-10-02",
      "2026-10-20", "2026-10-31", "2026-11-08", "2026-11-10", "2026-11-11",
      "2026-11-24", "2026-12-25",
    ].map((d, i) => global(`Festival ${i}`, d));

    const s = summariseHolidayYear(2026, gazetted2026);
    expect(s.sundays.length).toBe(52);
    expect(s.weekendSaturdays.length).toBe(24);
    expect(s.festivals.length).toBe(27);
    // Every part accounted for, and the overlap explains the shortfall.
    expect(s.sundays.length + s.weekendSaturdays.length + s.festivals.length - s.overlaps.length).toBe(s.total);
    expect(s.total).toBeLessThan(103);
    expect(s.total).toBeGreaterThan(90);
  });

  it("excludes optional holidays from total and puts them in optionalHolidays", () => {
    const baseSummary = summariseHolidayYear(2026);
    const optionalRecord: HolidayRecord = {
      name: "Maha Shivratri (Optional)",
      holiday_date: "2026-02-16", // Monday
      scope: "GLOBAL",
      is_government: true,
      is_optional: true,
    };

    const s = summariseHolidayYear(2026, [optionalRecord]);
    // Total should remain unchanged by an optional holiday on a working day
    expect(s.total).toBe(baseSummary.total);
    expect(s.festivals.length).toBe(0);
    expect(s.optionalHolidays.length).toBe(1);
    expect(s.optionalHolidays[0].label).toBe("Maha Shivratri (Optional)");
    expect(s.optionalMaxAllowed).toBe(2);
  });
});
