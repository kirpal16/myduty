import { describe, it, expect } from "vitest";
import {
  validateDayAllocation,
  type BalanceInfo,
  type DayChoice,
  type LeaveTypeInfo,
} from "./validateDayAllocation";
import type { HolidayRecord } from "@/lib/holidays/resolveHoliday";

/** September 2026: Tue 8th, Wed 9th, Thu 10th, Sat 12th (2nd Sat), Sun 13th. */
const TYPES: LeaveTypeInfo[] = [
  { id: "cl", name: "Casual Leave", code: "CL", is_system: false },
  { id: "pl", name: "Privilege Leave", code: "PL", is_system: false },
  { id: "med", name: "Medical", code: "MEDICAL", is_system: false },
  { id: "hl", name: "Holiday Leave", code: "HL", is_system: true },
  { id: "oh", name: "Optional Holiday", code: "OH", is_system: true },
];

const HOLIDAYS: HolidayRecord[] = [
  { name: "Festival", holiday_date: "2026-09-09", scope: "GLOBAL", is_government: true },
  { name: "Optional A", holiday_date: "2026-09-10", scope: "GLOBAL", is_optional: true },
  { name: "Optional B", holiday_date: "2026-09-08", scope: "GLOBAL", is_optional: true },
  { name: "Optional C", holiday_date: "2026-09-11", scope: "GLOBAL", is_optional: true },
];

const day = (date: string, leaveTypeId: string): DayChoice => ({ date, leaveTypeId, fraction: 1 });

function run(
  days: DayChoice[],
  engine: Record<string, string>,
  balances: Record<string, BalanceInfo> = {},
  worked: string[] = [],
) {
  return validateDayAllocation({
    days,
    engineTypeByDate: engine,
    types: TYPES,
    dbHolidays: HOLIDAYS,
    workedDates: new Set(worked),
    balanceFor: (id) => balances[id],
  });
}

const PLENTY: Record<string, BalanceInfo> = {
  cl: { remaining: 10, allocationExists: true },
  pl: { remaining: 10, allocationExists: true },
  oh: { remaining: 2, allocationExists: true },
};

describe("validateDayAllocation", () => {
  it("accepts the engine's own proposal", () => {
    expect(
      run([day("2026-09-12", "hl"), day("2026-09-13", "hl"), day("2026-09-14", "cl")], {
        "2026-09-12": "hl",
        "2026-09-13": "hl",
        "2026-09-14": "cl",
      }, PLENTY),
    ).toEqual([]);
  });

  it("blocks HL on a working day", () => {
    const issues = run([day("2026-09-14", "hl")], { "2026-09-14": "cl" }, PLENTY);
    expect(issues).toHaveLength(1);
    expect(issues[0].date).toBe("2026-09-14");
  });

  it("blocks HL on an Optional Holiday — OH is never HL", () => {
    const issues = run([day("2026-09-10", "hl")], { "2026-09-10": "oh" }, PLENTY);
    expect(issues[0]).toMatchObject({ date: "2026-09-10" });
  });

  it("blocks HL on a holiday the officer worked", () => {
    const issues = run([day("2026-09-09", "hl")], { "2026-09-09": "cl" }, PLENTY, ["2026-09-09"]);
    expect(issues[0].message).toMatch(/duty/i);
  });

  it("blocks OH on a day that is not a declared optional holiday", () => {
    const issues = run([day("2026-09-14", "oh")], { "2026-09-14": "cl" }, PLENTY);
    expect(issues[0].date).toBe("2026-09-14");
  });

  it("blocks a day changed to OH with no leave next to it", () => {
    // 10th is optional; 8th is also leave but not adjacent (9th is missing).
    const issues = run(
      [day("2026-09-08", "cl"), day("2026-09-10", "oh")],
      { "2026-09-08": "cl", "2026-09-10": "cl" },
      PLENTY,
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].date).toBe("2026-09-10");
    expect(issues[0].message).toMatch(/cannot be taken alone/);
  });

  it("allows a day changed to OH when the next day is part of the same leave", () => {
    expect(
      run(
        [day("2026-09-10", "oh"), day("2026-09-11", "cl")],
        { "2026-09-10": "cl", "2026-09-11": "cl" },
        PLENTY,
      ),
    ).toEqual([]);
  });

  it("blocks OH beyond the year's quota", () => {
    // Adjacent optional days, so only the quota rule is in play.
    const issues = run(
      [day("2026-09-10", "oh"), day("2026-09-11", "oh")],
      { "2026-09-10": "oh", "2026-09-11": "cl" },
      { ...PLENTY, oh: { remaining: 1, allocationExists: true } },
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].date).toBe("2026-09-11");
    expect(issues[0].message).toMatch(/quota/i);
  });

  it("blocks a day changed to a type without enough balance", () => {
    const issues = run(
      [day("2026-09-14", "pl"), day("2026-09-15", "pl")],
      { "2026-09-14": "cl", "2026-09-15": "cl" },
      { ...PLENTY, pl: { remaining: 1, allocationExists: true } },
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/Privilege Leave balance for 2026: 1 Day left, 2 Days chosen/);
  });

  it("blocks an unchanged CL that runs past its balance", () => {
    // Previously allowed, which drove the balance negative. The quota applies
    // however the day got there, not only where the officer changed one.
    const issues = run(
      [day("2026-09-14", "cl"), day("2026-09-15", "cl")],
      { "2026-09-14": "cl", "2026-09-15": "cl" },
      { ...PLENTY, cl: { remaining: 0, allocationExists: true } },
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/Casual Leave balance for 2026: 0 Day left, 2 Days chosen/);
    // Nothing was changed, so the issue anchors to the group's first day.
    expect(issues[0].date).toBe("2026-09-14");
  });

  it("allows an unchanged leave that fits exactly inside its balance", () => {
    expect(
      run(
        [day("2026-09-14", "cl"), day("2026-09-15", "cl")],
        { "2026-09-14": "cl", "2026-09-15": "cl" },
        { ...PLENTY, cl: { remaining: 2, allocationExists: true } },
      ),
    ).toEqual([]);
  });

  it("does not cap a type with no allowance set", () => {
    expect(run([day("2026-09-14", "med")], { "2026-09-14": "cl" }, PLENTY)).toEqual([]);
  });

  it("uses the add-back already folded into remaining when editing", () => {
    // Editing a log that already held 2 PL days: remaining 0 + 2 added back.
    expect(
      run(
        [day("2026-09-14", "pl"), day("2026-09-15", "pl")],
        { "2026-09-14": "cl", "2026-09-15": "cl" },
        { ...PLENTY, pl: { remaining: 2, allocationExists: true } },
      ),
    ).toEqual([]);
  });

  it("rejects a type the user cannot see", () => {
    expect(run([day("2026-09-14", "nope")], { "2026-09-14": "cl" }, PLENTY)[0].message).toMatch(
      /not available/,
    );
  });
});
