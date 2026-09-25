import { describe, it, expect } from "vitest";
import {
  isOptionalHolidayType,
  isValidOptionalHolidayDate,
  getAdjacentDates,
  findOptionalHolidayViolation,
  optionalHolidayViolationMessage,
  OPTIONAL_HOLIDAY_CODE,
  MAX_OPTIONAL_HOLIDAYS_PER_YEAR,
} from "./optionalHolidayRules";
import type { HolidayRecord } from "@/lib/holidays/resolveHoliday";

const SAMPLE_DB_OH: HolidayRecord = {
  name: "Christian New Year Day",
  holiday_date: "2026-01-01",
  scope: "GLOBAL",
  is_government: true,
  is_optional: true,
};

describe("optionalHolidayRules", () => {
  it("recognises only the system OH type", () => {
    expect(isOptionalHolidayType({ code: "OH", is_system: true })).toBe(true);
    expect(isOptionalHolidayType({ code: "OH", is_system: false })).toBe(false);
    expect(isOptionalHolidayType({ code: "CL", is_system: true })).toBe(false);
    expect(isOptionalHolidayType(null)).toBe(false);
    expect(OPTIONAL_HOLIDAY_CODE).toBe("OH");
    expect(MAX_OPTIONAL_HOLIDAYS_PER_YEAR).toBe(2);
  });

  it("calculates adjacent dates correctly", () => {
    const { before, after } = getAdjacentDates("2026-01-05");
    expect(before).toBe("2026-01-04");
    expect(after).toBe("2026-01-06");
  });

  it("validates optional holiday date from catalog or DB", () => {
    // 2026-01-01 is in the catalog and DB
    expect(isValidOptionalHolidayDate("2026-01-01", [SAMPLE_DB_OH])).toBe(true);
    // 2026-01-15 is Vasi Uttarayan in catalog
    expect(isValidOptionalHolidayDate("2026-01-15", [])).toBe(true);
    // 2026-01-03 is not an optional holiday
    expect(isValidOptionalHolidayDate("2026-01-03", [])).toBe(false);
  });

  it("rejects non-optional holiday dates", () => {
    const violation = findOptionalHolidayViolation(
      "2026-01-03",
      [],
      new Set(["2026-01-02"]),
      2,
    );
    expect(violation).toEqual({ kind: "not_an_optional_holiday", date: "2026-01-03" });
    expect(optionalHolidayViolationMessage(violation!)).toContain("not on the declared Gujarat Government Optional Holidays list");
  });

  it("rejects when annual quota of 2 is exceeded", () => {
    const violation = findOptionalHolidayViolation(
      "2026-01-01",
      [SAMPLE_DB_OH],
      new Set(["2026-01-02"]),
      0, // 0 remaining
    );
    expect(violation).toEqual({ kind: "exceeds_annual_limit", requested: 1, remaining: 0 });
    expect(optionalHolidayViolationMessage(violation!)).toContain("already used your quota of Optional Holidays");
  });

  it("rejects standalone Optional Holiday without adjacent leave", () => {
    const violation = findOptionalHolidayViolation(
      "2026-01-15",
      [],
      new Set(), // no adjacent leaves
      2,
    );
    expect(violation).toEqual({ kind: "missing_adjacent_leave", date: "2026-01-15" });
    expect(optionalHolidayViolationMessage(violation!)).toContain("cannot be taken alone");
  });

  it("allows Optional Holiday when preceded by another leave", () => {
    const violation = findOptionalHolidayViolation(
      "2026-01-15", // OH date
      [],
      new Set(["2026-01-14"]), // adjacent leave on day before
      2,
    );
    expect(violation).toBeNull();
  });

  it("allows Optional Holiday when succeeded by another leave", () => {
    const violation = findOptionalHolidayViolation(
      "2026-01-15", // OH date
      [],
      new Set(["2026-01-16"]), // adjacent leave on day after
      2,
    );
    expect(violation).toBeNull();
  });

  it("allows Optional Holiday when paired in the same submission", () => {
    const violation = findOptionalHolidayViolation(
      "2026-01-15",
      [],
      new Set(), // empty set, but hasPairedLeave is true
      2,
      true,
    );
    expect(violation).toBeNull();
  });
});
