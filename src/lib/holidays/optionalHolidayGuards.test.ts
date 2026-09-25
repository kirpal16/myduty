import { describe, it, expect } from "vitest";
import { resolveHoliday, type HolidayRecord } from "./resolveHoliday";
import { resolveHolidayPay } from "@/lib/duty/holidayPay";
import { holidayOptionsForYear } from "@/lib/leave/holidayLeaveRules";

/**
 * An Optional Holiday (OH / મરજિયાત) is a working day: it is never Holiday
 * Leave and never earns holiday extra pay. These guard every path that once
 * got it wrong. September 2026: Sun 13th, Tue 15th.
 */
const optional = (date: string, name = "Optional Day"): HolidayRecord => ({
  name,
  holiday_date: date,
  scope: "GLOBAL",
  is_government: true,
  is_optional: true,
});
const gazetted = (date: string, name = "Festival"): HolidayRecord => ({
  name,
  holiday_date: date,
  scope: "GLOBAL",
  is_government: true,
});
const midday = (s: string) => new Date(`${s}T12:00:00`);

describe("resolveHoliday — a real holiday outranks an optional row", () => {
  it("picks the gazetted row whichever order the rows arrive in", () => {
    for (const rows of [
      [optional("2026-09-15"), gazetted("2026-09-15", "Diwali")],
      [gazetted("2026-09-15", "Diwali"), optional("2026-09-15")],
    ]) {
      const r = resolveHoliday(midday("2026-09-15"), rows);
      expect(r).toMatchObject({ kind: "public_holiday", name: "Diwali" });
      expect(r.qualifiesForHolidayAllowance).toBe(true);
    }
  });

  it("an optional row alone stays a working day for pay", () => {
    const r = resolveHoliday(midday("2026-09-15"), [optional("2026-09-15")]);
    expect(r).toMatchObject({ kind: "optional_holiday", qualifiesForHolidayAllowance: false });
  });
});

describe("holidayOptionsForYear — HL can never be taken on an optional day", () => {
  it("excludes an optional weekday but keeps an optional row that falls on a Sunday", () => {
    const options = holidayOptionsForYear(
      2026,
      [optional("2026-09-15"), optional("2026-09-13")],
      new Set(),
      new Set(),
    );
    const dates = new Set(options.map((o) => o.date));
    expect(dates.has("2026-09-15")).toBe(false);
    // Sunday: a weekend off regardless of the optional row.
    expect(dates.has("2026-09-13")).toBe(true);
  });
});

describe("resolveHolidayPay — no extra pay on an optional day", () => {
  it("ignores a submitted allowance and a manual claim", () => {
    const resolution = resolveHoliday(midday("2026-09-15"), [optional("2026-09-15")]);
    expect(
      resolveHolidayPay({
        resolution,
        status: "COMPLETED",
        holidayDayRate: 500,
        submittedAllowance: 900,
        manualClaim: true,
      }),
    ).toMatchObject({ isHolidayDuty: false, manualHolidayClaim: false, holidayAllowance: 0 });
  });
});
