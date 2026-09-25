import { describe, it, expect } from "vitest";
import { resolveHolidayPay } from "./holidayPay";
import type { HolidayResolution } from "@/lib/holidays/resolveHoliday";

const HOLIDAY: HolidayResolution = {
  isHoliday: true,
  qualifiesForHolidayAllowance: true,
  kind: "public_holiday",
  source: "db",
  name: "Diwali",
};
const WEEKEND: HolidayResolution = {
  isHoliday: true,
  qualifiesForHolidayAllowance: true,
  kind: "weekend",
  source: "sunday",
};
const DAY_OFF: HolidayResolution = {
  isHoliday: true,
  qualifiesForHolidayAllowance: true,
  kind: "day_off",
  source: "db",
};
const WORKING: HolidayResolution = {
  isHoliday: false,
  qualifiesForHolidayAllowance: false,
};

const RATE = 500;

describe("resolveHolidayPay — R1", () => {
  it.each([
    ["public holiday", HOLIDAY],
    ["weekend", WEEKEND],
    ["day off", DAY_OFF],
  ])("%s worked earns the configured rate", (_l, resolution) => {
    expect(
      resolveHolidayPay({ resolution, status: "COMPLETED", holidayDayRate: RATE }),
    ).toEqual({
      isHoliday: true,
      isHolidayDuty: true,
      manualHolidayClaim: false,
      holidayAllowance: 500,
    });
  });

  it("a working day worked earns nothing", () => {
    expect(
      resolveHolidayPay({ resolution: WORKING, status: "COMPLETED", holidayDayRate: RATE }),
    ).toEqual({
      isHoliday: false,
      isHolidayDuty: false,
      manualHolidayClaim: false,
      holidayAllowance: 0,
    });
  });

  it("a working day with a manual claim earns the rate", () => {
    expect(
      resolveHolidayPay({
        resolution: WORKING,
        status: "SCHEDULED",
        holidayDayRate: RATE,
        manualClaim: true,
      }),
    ).toEqual({
      isHoliday: false,
      isHolidayDuty: false,
      manualHolidayClaim: true,
      holidayAllowance: 500,
    });
  });

  it("a manual claim is ignored on a real holiday — the allowance is already automatic", () => {
    const r = resolveHolidayPay({
      resolution: HOLIDAY,
      status: "COMPLETED",
      holidayDayRate: RATE,
      manualClaim: true,
    });
    // The DB constraint rejects manual_holiday_claim on a holiday, so this
    // must be normalised away rather than passed through.
    expect(r.manualHolidayClaim).toBe(false);
    expect(r.isHolidayDuty).toBe(true);
    expect(r.holidayAllowance).toBe(500);
  });

  it("cancelling a holiday duty stops the pay but keeps the classification", () => {
    expect(
      resolveHolidayPay({
        resolution: HOLIDAY,
        status: "CANCELLED",
        holidayDayRate: RATE,
        submittedAllowance: 900,
      }),
    ).toEqual({
      isHoliday: true, // the date is still a holiday
      isHolidayDuty: false, // but it was not worked
      manualHolidayClaim: false,
      holidayAllowance: 0,
    });
  });

  it("cancelling also voids a manual claim", () => {
    expect(
      resolveHolidayPay({
        resolution: WORKING,
        status: "CANCELLED",
        holidayDayRate: RATE,
        manualClaim: true,
        submittedAllowance: 900,
      }),
    ).toMatchObject({ manualHolidayClaim: false, holidayAllowance: 0 });
  });

  it("an explicit amount overrides the configured rate", () => {
    expect(
      resolveHolidayPay({
        resolution: HOLIDAY,
        status: "COMPLETED",
        holidayDayRate: RATE,
        submittedAllowance: 750,
      }).holidayAllowance,
    ).toBe(750);
  });

  it("an explicit zero is honoured, not treated as missing", () => {
    expect(
      resolveHolidayPay({
        resolution: HOLIDAY,
        status: "COMPLETED",
        holidayDayRate: RATE,
        submittedAllowance: 0,
      }).holidayAllowance,
    ).toBe(0);
  });

  it("falls back to the rate for null/undefined/negative/NaN amounts", () => {
    for (const submitted of [null, undefined, -5, NaN]) {
      expect(
        resolveHolidayPay({
          resolution: HOLIDAY,
          status: "COMPLETED",
          holidayDayRate: RATE,
          submittedAllowance: submitted,
        }).holidayAllowance,
      ).toBe(500);
    }
  });

  it("an unset rate pays nothing rather than guessing", () => {
    expect(
      resolveHolidayPay({ resolution: HOLIDAY, status: "COMPLETED", holidayDayRate: 0 })
        .holidayAllowance,
    ).toBe(0);
  });

  it("never returns isHolidayDuty without isHoliday (DB constraint)", () => {
    const cases = [HOLIDAY, WEEKEND, DAY_OFF, WORKING].flatMap((resolution) =>
      (["SCHEDULED", "COMPLETED", "CANCELLED"] as const).map((status) =>
        resolveHolidayPay({ resolution, status, holidayDayRate: RATE, manualClaim: true }),
      ),
    );
    for (const r of cases) {
      if (r.isHolidayDuty) expect(r.isHoliday).toBe(true);
      if (r.manualHolidayClaim) expect(r.isHoliday).toBe(false);
      expect(r.holidayAllowance).toBeGreaterThanOrEqual(0);
    }
  });
});
