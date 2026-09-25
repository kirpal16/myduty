import { describe, it, expect } from "vitest";
import {
  isHolidayLeaveType,
  datesInRange,
  findHolidayLeaveViolation,
  holidayOptionsForYear,
  holidayLeaveDays,
  HOLIDAY_LEAVE_CODE,
} from "./holidayLeaveRules";
import type { HolidayRecord } from "@/lib/holidays/resolveHoliday";

const DIWALI: HolidayRecord = {
  name: "Diwali",
  holiday_date: "2026-11-10",
  scope: "GLOBAL",
  is_government: true,
};

describe("isHolidayLeaveType", () => {
  it("recognises only the seeded system row", () => {
    expect(isHolidayLeaveType({ code: "HL", is_system: true })).toBe(true);
  });

  it("ignores a personal type that merely shares the code", () => {
    // An officer may create their own type called HL; that one is ordinary leave.
    expect(isHolidayLeaveType({ code: "HL", is_system: false })).toBe(false);
    expect(isHolidayLeaveType({ code: "CL", is_system: true })).toBe(false);
    expect(isHolidayLeaveType(null)).toBe(false);
    expect(isHolidayLeaveType(undefined)).toBe(false);
  });

  it("exports the code the migration seeds", () => {
    expect(HOLIDAY_LEAVE_CODE).toBe("HL");
  });
});

describe("datesInRange", () => {
  it("is inclusive of both ends", () => {
    expect(datesInRange("2026-09-08", "2026-09-10")).toEqual([
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
    ]);
  });

  it("returns one date for a single day", () => {
    expect(datesInRange("2026-09-08", "2026-09-08")).toEqual(["2026-09-08"]);
  });

  it("crosses a month boundary", () => {
    expect(datesInRange("2026-08-31", "2026-09-01")).toEqual(["2026-08-31", "2026-09-01"]);
  });

  it("returns nothing for an inverted or invalid range", () => {
    expect(datesInRange("2026-09-10", "2026-09-08")).toEqual([]);
    expect(datesInRange("nope", "2026-09-08")).toEqual([]);
  });
});

describe("findHolidayLeaveViolation", () => {
  const none = new Set<string>();

  it("accepts a Sunday", () => {
    // 2026-09-06 is a Sunday.
    expect(findHolidayLeaveViolation("2026-09-06", "2026-09-06", [], none)).toBeNull();
  });

  it("accepts a 2nd Saturday", () => {
    expect(findHolidayLeaveViolation("2026-09-12", "2026-09-12", [], none)).toBeNull();
  });

  it("accepts a gazetted day supplied as a DB row", () => {
    expect(findHolidayLeaveViolation("2026-11-10", "2026-11-10", [DIWALI], none)).toBeNull();
  });

  it("rejects a 1st Saturday", () => {
    expect(findHolidayLeaveViolation("2026-09-05", "2026-09-05", [], none)).toEqual({
      kind: "not_a_holiday",
      date: "2026-09-05",
    });
  });

  it("rejects an ordinary weekday", () => {
    expect(findHolidayLeaveViolation("2026-09-08", "2026-09-08", [], none)).toEqual({
      kind: "not_a_holiday",
      date: "2026-09-08",
    });
  });

  it("names the FIRST offending date in a range", () => {
    // 6th Sunday ok, 7th Monday not.
    expect(findHolidayLeaveViolation("2026-09-06", "2026-09-08", [], none)).toEqual({
      kind: "not_a_holiday",
      date: "2026-09-07",
    });
  });

  it("rejects a holiday that was worked — it already earns pay", () => {
    expect(
      findHolidayLeaveViolation("2026-09-06", "2026-09-06", [], new Set(["2026-09-06"])),
    ).toEqual({ kind: "worked", date: "2026-09-06" });
  });

  it("accepts a run of consecutive holidays", () => {
    // A gazetted day sandwiched between a Saturday and a Sunday.
    const rows: HolidayRecord[] = [
      { name: "Festival", holiday_date: "2026-09-13", scope: "GLOBAL" },
    ];
    // 12 = 2nd Sat, 13 = Sunday (and a row), so both qualify.
    expect(findHolidayLeaveViolation("2026-09-12", "2026-09-13", rows, none)).toBeNull();
  });

  it("rejects an optional holiday for regular Holiday Leave (HL)", () => {
    const rows: HolidayRecord[] = [
      { name: "Parsi New Year", holiday_date: "2026-09-08", scope: "GLOBAL", is_optional: true },
    ];
    // 2026-09-08 is a Tuesday Optional Holiday; HL cannot be claimed on it
    expect(findHolidayLeaveViolation("2026-09-08", "2026-09-08", rows, none)).toEqual({
      kind: "not_a_holiday",
      date: "2026-09-08",
    });
  });
});

describe("holidayOptionsForYear", () => {
  it("offers only holidays, and never a 1st/3rd/5th Saturday", () => {
    const opts = holidayOptionsForYear(2026, [], new Set(), new Set());
    const dates = new Set(opts.map((o) => o.date));
    expect(dates.has("2026-09-06")).toBe(true); // Sunday
    expect(dates.has("2026-09-12")).toBe(true); // 2nd Saturday
    expect(dates.has("2026-09-26")).toBe(true); // 4th Saturday
    expect(dates.has("2026-09-05")).toBe(false); // 1st Saturday
    expect(dates.has("2026-09-19")).toBe(false); // 3rd Saturday
    expect(dates.has("2026-09-08")).toBe(false); // Tuesday
  });

  it("names a gazetted day rather than calling it a weekend", () => {
    const opts = holidayOptionsForYear(2026, [DIWALI], new Set(), new Set());
    expect(opts.find((o) => o.date === "2026-11-10")?.label).toBe("Diwali");
  });

  it("keeps worked and taken days visible but disabled, with the reason", () => {
    const opts = holidayOptionsForYear(
      2026,
      [],
      new Set(["2026-09-06"]),
      new Set(["2026-09-13"]),
    );
    expect(opts.find((o) => o.date === "2026-09-06")?.disabledReason).toMatch(/Duty logged/);
    expect(opts.find((o) => o.date === "2026-09-13")?.disabledReason).toMatch(/Already taken/);
    expect(opts.find((o) => o.date === "2026-09-20")?.disabledReason).toBeUndefined();
  });

  it("counts a gazetted day falling on a Sunday only once", () => {
    const onASunday: HolidayRecord[] = [
      { name: "Diwali", holiday_date: "2026-11-08", scope: "GLOBAL" },
    ];
    const opts = holidayOptionsForYear(2026, onASunday, new Set(), new Set());
    expect(opts.filter((o) => o.date === "2026-11-08")).toHaveLength(1);
  });
});

describe("holidayLeaveDays", () => {
  it("counts each day of the range", () => {
    expect(holidayLeaveDays("2026-09-06", "2026-09-06", false)).toBe(1);
    expect(holidayLeaveDays("2026-09-06", "2026-09-08", false)).toBe(3);
  });

  it("a half day costs half", () => {
    expect(holidayLeaveDays("2026-09-06", "2026-09-06", true)).toBe(0.5);
  });
});
