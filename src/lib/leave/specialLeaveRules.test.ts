import { describe, it, expect } from "vitest";
import {
  calculateSpecialLeaveCommittedDays,
  calculateSpecialLeaveAvailableToApply,
  calculateFifoDeduction,
  validateSpecialLeaveApplication,
  validateSpecialLeaveLogging,
  computeSpecialLeaveExpiry,
  isSpecialLeaveSanctionExpired,
  sanctionRangeDays,
} from "./specialLeaveRules";

describe("specialLeaveRules", () => {
  describe("calculateSpecialLeaveCommittedDays", () => {
    it("locks applied_days for PENDING applications", () => {
      const committed = calculateSpecialLeaveCommittedDays([
        { status: "PENDING", applied_days: 5 },
      ]);
      expect(committed).toBe(5);
    });

    it("counts only the requested leave type when one is given", () => {
      // Binpagari has no annual quota, so its commitments must not be
      // subtracted from the Special Leave balance.
      const apps = [
        { leave_type_id: "spl", status: "PENDING", applied_days: 5 },
        { leave_type_id: "lwp", status: "PENDING", applied_days: 4 },
      ];
      expect(calculateSpecialLeaveCommittedDays(apps, new Date(), "spl")).toBe(5);
      expect(calculateSpecialLeaveCommittedDays(apps, new Date(), "lwp")).toBe(4);
      // No filter still totals everything, as the overview cards want.
      expect(calculateSpecialLeaveCommittedDays(apps)).toBe(9);
    });

    it("locks unlogged approved days for APPROVED applications", () => {
      const committed = calculateSpecialLeaveCommittedDays([
        { status: "APPROVED", applied_days: 10, approved_days: 8, logged_days: 3 },
      ]);
      expect(committed).toBe(5); // 8 - 3
    });

    it("ignores REJECTED and CANCELLED applications", () => {
      const committed = calculateSpecialLeaveCommittedDays([
        { status: "REJECTED", applied_days: 10 },
        { status: "CANCELLED", applied_days: 7, approved_days: 5 },
      ]);
      expect(committed).toBe(0);
    });

    it("aggregates multiple mixed applications correctly", () => {
      const committed = calculateSpecialLeaveCommittedDays([
        { status: "PENDING", applied_days: 4 },
        { status: "APPROVED", applied_days: 10, approved_days: 8, logged_days: 2 }, // 6 remaining
        { status: "REJECTED", applied_days: 5 },
        { status: "CANCELLED", applied_days: 3 },
      ]);
      expect(committed).toBe(10); // 4 + 6
    });

    it("filters committed days by leave_type_id when provided", () => {
      const apps = [
        { status: "PENDING" as const, applied_days: 5, leave_type_id: "spl-id" },
        { status: "PENDING" as const, applied_days: 12, leave_type_id: "lwp-id" },
        { status: "APPROVED" as const, applied_days: 8, approved_days: 6, logged_days: 1, leave_type_id: "spl-id" },
      ];
      expect(calculateSpecialLeaveCommittedDays(apps, new Date(), "spl-id")).toBe(10); // 5 + 5
      expect(calculateSpecialLeaveCommittedDays(apps, new Date(), "lwp-id")).toBe(12);
    });
  });

  describe("calculateSpecialLeaveAvailableToApply", () => {
    it("deducts used days and committed days from total available", () => {
      // Total available: 15 (e.g. 10 current + 5 carry)
      // Used: 3
      // Committed: 4 (pending) + 4 (approved unlogged) = 8
      // Available = 15 - 3 - 8 = 4
      const available = calculateSpecialLeaveAvailableToApply(15, 3, 8);
      expect(available).toBe(4);
    });

    it("does not go below 0", () => {
      const available = calculateSpecialLeaveAvailableToApply(10, 8, 5);
      expect(available).toBe(0);
    });
  });

  describe("calculateFifoDeduction", () => {
    it("consumes Carry Forward before Current Year", () => {
      // Carried in: 5, Allocated: 10
      // Days taken: 3
      // Expected: 3 from Carry Forward, 0 from Current Year
      const result = calculateFifoDeduction(3, 5, 10);
      expect(result).toEqual({
        fromCarryForward: 3,
        fromCurrentYear: 0,
        remainingCarryForward: 2,
        remainingCurrentYear: 10,
      });
    });

    it("overflows to Current Year when Carry Forward is exhausted", () => {
      // Carried in: 5, Allocated: 10
      // Days taken: 8
      // Expected: 5 from Carry Forward, 3 from Current Year
      const result = calculateFifoDeduction(8, 5, 10);
      expect(result).toEqual({
        fromCarryForward: 5,
        fromCurrentYear: 3,
        remainingCarryForward: 0,
        remainingCurrentYear: 7,
      });
    });

    it("handles 0 carry forward", () => {
      const result = calculateFifoDeduction(4, 0, 10);
      expect(result).toEqual({
        fromCarryForward: 0,
        fromCurrentYear: 4,
        remainingCarryForward: 0,
        remainingCurrentYear: 6,
      });
    });
  });

  describe("validateSpecialLeaveApplication", () => {
    it("allows application within available quota", () => {
      const result = validateSpecialLeaveApplication(5, 8);
      expect(result.valid).toBe(true);
    });

    it("rejects application exceeding available quota", () => {
      const result = validateSpecialLeaveApplication(10, 8);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Only 8 uncommitted Special Leave days available");
    });

    it("rejects 0 or negative days", () => {
      const result = validateSpecialLeaveApplication(0, 10);
      expect(result.valid).toBe(false);
    });
  });

  describe("validateSpecialLeaveLogging", () => {
    it("allows logging within remaining approved days", () => {
      // 8 approved, 3 already logged -> 5 remaining
      const result = validateSpecialLeaveLogging(3, 8, 3);
      expect(result.valid).toBe(true);
      expect(result.remainingApproved).toBe(5);
    });

    it("rejects logging more than remaining approved days", () => {
      // 8 approved, 6 already logged -> 2 remaining, tries to log 3
      const result = validateSpecialLeaveLogging(3, 8, 6);
      expect(result.valid).toBe(false);
      expect(result.remainingApproved).toBe(2);
      expect(result.error).toContain("only 2 days remain out of 8 approved days");
    });
  });

  describe("computeSpecialLeaveExpiry & isSpecialLeaveSanctionExpired", () => {
    it("computes 6-month expiry correctly", () => {
      expect(computeSpecialLeaveExpiry("2026-03-21")).toBe("2026-09-21");
      expect(computeSpecialLeaveExpiry("2026-08-31")).toBe("2027-02-28");
      expect(computeSpecialLeaveExpiry("2026-01-15")).toBe("2026-07-15");
    });

    it("detects expired sanctions accurately", () => {
      const app = {
        approved_date: "2026-01-01",
        expires_at: "2026-07-01",
      };
      // Before expiry
      expect(isSpecialLeaveSanctionExpired(app, "2026-06-30")).toBe(false);
      expect(isSpecialLeaveSanctionExpired(app, "2026-07-01")).toBe(false);
      // After expiry
      expect(isSpecialLeaveSanctionExpired(app, "2026-07-02")).toBe(true);
    });

    it("excludes expired sanctions from committed days (lapsed quota)", () => {
      const committed = calculateSpecialLeaveCommittedDays(
        [
          {
            status: "APPROVED",
            applied_days: 10,
            approved_days: 8,
            logged_days: 2,
            approved_date: "2026-01-01",
            expires_at: "2026-07-01",
          },
          {
            status: "APPROVED",
            applied_days: 5,
            approved_days: 5,
            logged_days: 1,
            approved_date: "2026-08-01",
            expires_at: "2027-02-01",
          },
        ],
        "2026-09-01", // as of Sept 1, the first sanction has expired
      );
      // First sanction has lapsed (0 committed)
      // Second sanction has 5 - 1 = 4 committed
      expect(committed).toBe(4);
    });

    it("validates leave logging against sanction expiration date", () => {
      const app = {
        approved_date: "2026-01-01",
        expires_at: "2026-07-01",
      };
      const result = validateSpecialLeaveLogging(2, 5, 0, {
        app,
        leaveStartDate: "2026-07-10",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Special Leave sanction expired");
    });

    it("validates leave logging against valid_from and valid_to date range", () => {
      const app = {
        approved_date: "2026-05-01",
        expires_at: "2026-11-01",
        valid_from: "2026-06-01",
        valid_to: "2026-06-15",
      };

      // Valid within range
      const validRes = validateSpecialLeaveLogging(3, 5, 0, {
        app,
        leaveStartDate: "2026-06-05",
        leaveEndDate: "2026-06-07",
      });
      expect(validRes.valid).toBe(true);

      // Start date before valid_from
      const earlyRes = validateSpecialLeaveLogging(3, 5, 0, {
        app,
        leaveStartDate: "2026-05-25",
        leaveEndDate: "2026-06-02",
      });
      expect(earlyRes.valid).toBe(false);
      expect(earlyRes.error).toContain("cannot be before the sanction valid from date");

      // End date after valid_to
      const lateRes = validateSpecialLeaveLogging(3, 5, 0, {
        app,
        leaveStartDate: "2026-06-10",
        leaveEndDate: "2026-06-20",
      });
      expect(lateRes.valid).toBe(false);
      expect(lateRes.error).toContain("cannot be after the sanction valid to date");
    });
  });

  describe("sanctionRangeDays", () => {
    it("counts an inclusive range", () => {
      expect(sanctionRangeDays("2026-09-21", "2026-09-25")).toBe(5);
    });

    it("counts a single-day range as one", () => {
      expect(sanctionRangeDays("2026-09-21", "2026-09-21")).toBe(1);
    });

    it("spans month and year boundaries", () => {
      expect(sanctionRangeDays("2026-01-30", "2026-02-02")).toBe(4);
      expect(sanctionRangeDays("2026-12-30", "2027-01-02")).toBe(4);
    });

    it("is unaffected by a DST-style shift (UTC arithmetic)", () => {
      expect(sanctionRangeDays("2026-03-28", "2026-03-30")).toBe(3);
    });

    // A sanction recorded without dates must leave the day count alone.
    it("returns null when either date is missing", () => {
      expect(sanctionRangeDays(null, "2026-09-25")).toBeNull();
      expect(sanctionRangeDays("2026-09-21", null)).toBeNull();
      expect(sanctionRangeDays(undefined, undefined)).toBeNull();
      expect(sanctionRangeDays("", "")).toBeNull();
    });

    it("returns null when the range runs backwards", () => {
      expect(sanctionRangeDays("2026-09-25", "2026-09-21")).toBeNull();
    });
  });
});
