import { describe, it, expect } from "vitest";
import {
  allocateLeaveDays,
  allocationModeFor,
  countAllocation,
  isHalfDayAllowed,
  type AllocatedDay,
} from "./allocateLeaveDays";
import type { HolidayRecord } from "@/lib/holidays/resolveHoliday";

/**
 * September 2026: Tue 1st, Sat 5th (1st Saturday, working), Fri 11th,
 * Sat 12th (2nd Saturday, off), Sun 13th, Sat 19th (3rd Saturday, working).
 */
const gazetted = (date: string, name = "Festival"): HolidayRecord => ({
  name,
  holiday_date: date,
  scope: "GLOBAL",
  is_government: true,
});
const optional = (date: string, name = "Optional"): HolidayRecord => ({
  name,
  holiday_date: date,
  scope: "GLOBAL",
  is_government: true,
  is_optional: true,
});

// One declared optional holiday elsewhere in the year switches the
// hard-coded catalog fallback off, so only the rows below count.
const DECLARED_ELSEWHERE = optional("2026-03-02", "Unrelated");

const targets = (days: AllocatedDay[]) => days.map((d) => `${d.date.slice(8)}:${d.target}`);

describe("isHalfDayAllowed", () => {
  it("allows a half day only for Casual Leave", () => {
    expect(isHalfDayAllowed({ code: "CL", is_system: false })).toBe(true);
    expect(isHalfDayAllowed({ code: "cl" })).toBe(true);
    expect(isHalfDayAllowed({ code: "PL" })).toBe(false);
    expect(isHalfDayAllowed({ code: "HL", is_system: true })).toBe(false);
    expect(isHalfDayAllowed({ code: "SPL", is_system: true })).toBe(false);
    expect(isHalfDayAllowed(null)).toBe(false);
  });
});

describe("allocationModeFor", () => {
  it("routes CL and the system SPL only", () => {
    expect(allocationModeFor({ code: "CL", is_system: false })).toBe("casual");
    expect(allocationModeFor({ code: "SPL", is_system: true })).toBe("special");
    expect(allocationModeFor({ code: "SPL", is_system: false })).toBe("plain");
    expect(allocationModeFor({ code: "PL", is_system: false })).toBe("plain");
    expect(allocationModeFor(null)).toBe("plain");
  });
});

describe("allocateLeaveDays — Casual Leave", () => {
  it("moves a gazetted holiday inside the span to HL", () => {
    const days = allocateLeaveDays({
      startDate: "2026-09-08",
      endDate: "2026-09-10",
      isHalfDay: false,
      mode: "casual",
      dbHolidays: [DECLARED_ELSEWHERE, gazetted("2026-09-09")],
    });
    expect(targets(days)).toEqual(["08:requested", "09:HL", "10:requested"]);
  });

  it("moves the 2nd Saturday and Sunday to HL (sandwich)", () => {
    const days = allocateLeaveDays({
      startDate: "2026-09-11",
      endDate: "2026-09-14",
      isHalfDay: false,
      mode: "casual",
      dbHolidays: [DECLARED_ELSEWHERE],
    });
    expect(targets(days)).toEqual(["11:requested", "12:HL", "13:HL", "14:requested"]);
    expect(countAllocation(days)).toEqual({ requested: 2, HL: 2, OH: 0 });
  });

  it("uses remaining OH quota, then falls back to CL", () => {
    const days = allocateLeaveDays({
      startDate: "2026-09-15",
      endDate: "2026-09-17",
      isHalfDay: false,
      mode: "casual",
      dbHolidays: [optional("2026-09-15"), optional("2026-09-16"), optional("2026-09-17")],
      ohRemainingByYear: { 2026: 1 },
    });
    expect(targets(days)).toEqual(["15:OH", "16:requested", "17:requested"]);
  });

  it("caps OH at two per year", () => {
    const days = allocateLeaveDays({
      startDate: "2026-09-15",
      endDate: "2026-09-17",
      isHalfDay: false,
      mode: "casual",
      dbHolidays: [optional("2026-09-15"), optional("2026-09-16"), optional("2026-09-17")],
      ohRemainingByYear: { 2026: 2 },
    });
    expect(countAllocation(days)).toEqual({ requested: 1, HL: 0, OH: 2 });
  });

  it("keeps a worked holiday as CL — it already earned holiday pay", () => {
    const days = allocateLeaveDays({
      startDate: "2026-09-08",
      endDate: "2026-09-10",
      isHalfDay: false,
      mode: "casual",
      dbHolidays: [DECLARED_ELSEWHERE, gazetted("2026-09-09")],
      workedDates: new Set(["2026-09-09"]),
    });
    expect(targets(days)).toEqual(["08:requested", "09:requested", "10:requested"]);
  });

  it("treats the 1st Saturday as a working day", () => {
    const days = allocateLeaveDays({
      startDate: "2026-09-05",
      endDate: "2026-09-05",
      isHalfDay: false,
      mode: "casual",
      dbHolidays: [DECLARED_ELSEWHERE],
    });
    expect(targets(days)).toEqual(["05:requested"]);
  });

  it("a single CL day on an optional holiday stays CL — OH is never taken alone", () => {
    const days = allocateLeaveDays({
      startDate: "2026-09-15",
      endDate: "2026-09-15",
      isHalfDay: false,
      mode: "casual",
      dbHolidays: [optional("2026-09-15")],
      ohRemainingByYear: { 2026: 2 },
    });
    expect(targets(days)).toEqual(["15:requested"]);
  });

  it("a single CL day on a Sunday stays CL — one day is what the officer picked", () => {
    const days = allocateLeaveDays({
      startDate: "2026-09-13",
      endDate: "2026-09-13",
      isHalfDay: false,
      mode: "casual",
      dbHolidays: [DECLARED_ELSEWHERE],
    });
    expect(targets(days)).toEqual(["13:requested"]);
  });

  it("routes an optional holiday to OH inside a multi-day leave", () => {
    const days = allocateLeaveDays({
      startDate: "2026-09-14",
      endDate: "2026-09-15",
      isHalfDay: false,
      mode: "casual",
      dbHolidays: [optional("2026-09-15")],
      ohRemainingByYear: { 2026: 2 },
    });
    expect(targets(days)).toEqual(["14:requested", "15:OH"]);
  });

  it("never splits a half-day", () => {
    const days = allocateLeaveDays({
      startDate: "2026-09-13",
      endDate: "2026-09-13",
      isHalfDay: true,
      mode: "casual",
      dbHolidays: [DECLARED_ELSEWHERE],
    });
    expect(days).toEqual([{ date: "2026-09-13", target: "requested", fraction: 0.5 }]);
  });
});

describe("allocateLeaveDays — Special Leave", () => {
  it("starts on the 2nd Saturday: 2 HL, then 6 SPL", () => {
    const days = allocateLeaveDays({
      startDate: "2026-09-12",
      endDate: "2026-09-19",
      isHalfDay: false,
      mode: "special",
      dbHolidays: [DECLARED_ELSEWHERE],
    });
    expect(days).toHaveLength(8);
    expect(countAllocation(days)).toEqual({ requested: 6, HL: 2, OH: 0 });
    expect(targets(days).slice(0, 3)).toEqual(["12:HL", "13:HL", "14:requested"]);
  });

  it("a single SPL day on the 2nd Saturday stays SPL", () => {
    const days = allocateLeaveDays({
      startDate: "2026-09-12",
      endDate: "2026-09-12",
      isHalfDay: false,
      mode: "special",
      dbHolidays: [DECLARED_ELSEWHERE],
    });
    expect(countAllocation(days)).toEqual({ requested: 1, HL: 0, OH: 0 });
  });

  it("Friday through the weekend is all SPL", () => {
    const days = allocateLeaveDays({
      startDate: "2026-09-11",
      endDate: "2026-09-13",
      isHalfDay: false,
      mode: "special",
      dbHolidays: [DECLARED_ELSEWHERE],
    });
    expect(countAllocation(days)).toEqual({ requested: 3, HL: 0, OH: 0 });
  });

  it("a holiday in the middle stays SPL", () => {
    const days = allocateLeaveDays({
      startDate: "2026-09-08",
      endDate: "2026-09-10",
      isHalfDay: false,
      mode: "special",
      dbHolidays: [DECLARED_ELSEWHERE, gazetted("2026-09-09")],
    });
    expect(countAllocation(days)).toEqual({ requested: 3, HL: 0, OH: 0 });
  });

  it("never routes to OH", () => {
    const days = allocateLeaveDays({
      startDate: "2026-09-15",
      endDate: "2026-09-16",
      isHalfDay: false,
      mode: "special",
      dbHolidays: [optional("2026-09-15")],
      ohRemainingByYear: { 2026: 2 },
    });
    expect(countAllocation(days)).toEqual({ requested: 2, HL: 0, OH: 0 });
  });
});

describe("allocateLeaveDays — other types", () => {
  it("charges every day to the requested type", () => {
    const days = allocateLeaveDays({
      startDate: "2026-09-11",
      endDate: "2026-09-14",
      isHalfDay: false,
      mode: "plain",
      dbHolidays: [gazetted("2026-09-14")],
    });
    expect(countAllocation(days)).toEqual({ requested: 4, HL: 0, OH: 0 });
  });
});
