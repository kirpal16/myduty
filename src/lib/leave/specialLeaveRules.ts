/**
 * Special Leave (SPL) Approval and Balance Quota Rules
 *
 * Rules:
 * 1. An officer applies for Special Leave (status PENDING) for Z days.
 * 2. An official sanction/approval is granted for ZX days (status APPROVED).
 * 3. Over-Apply Protection:
 *    Committed Days = Pending applied days + (Approved days - Already logged days).
 *    Available To Apply = Total Available (X + Y) - Used SPL Days - Committed Days.
 *    Any new application exceeding Available To Apply is blocked.
 * 4. Over-Log Protection:
 *    Officers can only log leave against an APPROVED application, up to its remaining approved days.
 * 5. FIFO Deduction Priority:
 *    Carry Forward (Y) days are always consumed first before Current Year allocated (X) days.
 * 6. State Reversion:
 *    CANCELLED and REJECTED applications do not lock quota.
 */

export type SpecialLeaveAppRecord = {
  leave_type_id?: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | string;
  applied_days: number;
  approved_days?: number | null;
  logged_days?: number;
  valid_from?: string | null;
  valid_to?: string | null;
  approved_date?: string | null;
  expires_at?: string | null;
};

/**
 * Computes the 6-month expiration date from an approval date (YYYY-MM-DD).
 * Clamps to the last day of the target month if needed.
 */
export function computeSpecialLeaveExpiry(approvedDateStr: string): string {
  if (!approvedDateStr) return "";
  const parts = approvedDateStr.split("-");
  if (parts.length < 3) return "";
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);

  let targetYear = y;
  let targetMonth = m + 6;
  if (targetMonth > 12) {
    targetYear += Math.floor((targetMonth - 1) / 12);
    targetMonth = ((targetMonth - 1) % 12) + 1;
  }

  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const clampedDay = Math.min(d, daysInTargetMonth);

  const mm = String(targetMonth).padStart(2, "0");
  const dd = String(clampedDay).padStart(2, "0");
  return `${targetYear}-${mm}-${dd}`;
}

/**
 * The inclusive day span of a sanction's date range, or null when the range is
 * incomplete or malformed.
 *
 * A sanction order may fix the window the leave must fall in. When it does, the
 * day count follows from the dates, so the forms use this to fill the count in.
 * A sanction recorded without dates has no span, and nothing is filled in.
 */
export function sanctionRangeDays(
  validFrom?: string | null,
  validTo?: string | null,
): number | null {
  if (!validFrom || !validTo) return null;
  const from = Date.UTC(
    Number(validFrom.slice(0, 4)),
    Number(validFrom.slice(5, 7)) - 1,
    Number(validFrom.slice(8, 10)),
  );
  const to = Date.UTC(
    Number(validTo.slice(0, 4)),
    Number(validTo.slice(5, 7)) - 1,
    Number(validTo.slice(8, 10)),
  );
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return null;
  return Math.round((to - from) / 86_400_000) + 1;
}

/**
 * Checks if a Special Leave sanction has expired (after 6 months from approval date).
 */
export function isSpecialLeaveSanctionExpired(
  app: Pick<SpecialLeaveAppRecord, "expires_at" | "approved_date">,
  asOfDate: Date | string = new Date(),
): boolean {
  const expiryDate =
    app.expires_at || (app.approved_date ? computeSpecialLeaveExpiry(app.approved_date) : null);
  if (!expiryDate) return false;

  const checkDateStr =
    typeof asOfDate === "string" ? asOfDate : asOfDate.toISOString().split("T")[0];

  return checkDateStr > expiryDate;
}

/**
 * Calculates days currently locked by pending applications and unlogged approved grants.
 * Lapsed/expired approved applications no longer commit quota.
 */
export function calculateSpecialLeaveCommittedDays(
  applications: readonly SpecialLeaveAppRecord[],
  asOfDate: Date | string = new Date(),
  filterLeaveTypeId?: string,
): number {
  return applications.reduce((acc, app) => {
    if (filterLeaveTypeId && app.leave_type_id && app.leave_type_id !== filterLeaveTypeId) {
      return acc;
    }
    if (app.status === "PENDING") {
      return acc + (Number(app.applied_days) || 0);
    }
    if (app.status === "APPROVED") {
      // Once expired, unlogged days are lapsed ("used or not, it's gone")
      if (isSpecialLeaveSanctionExpired(app, asOfDate)) {
        return acc;
      }
      const approved = Number(app.approved_days) || 0;
      const logged = Number(app.logged_days) || 0;
      return acc + Math.max(0, approved - logged);
    }
    return acc; // REJECTED, CANCELLED do not commit quota
  }, 0);
}

/**
 * Calculates remaining Special Leave days available for a new application.
 */
export function calculateSpecialLeaveAvailableToApply(
  totalAvailable: number,
  usedDays: number,
  committedDays: number,
): number {
  const remaining = totalAvailable - usedDays - committedDays;
  return Math.max(0, Number(remaining.toFixed(1)));
}

/**
 * FIFO consumption order:
 * Carry Forward days (Y) are always debited before Current Year days (X).
 */
export type FifoDeductionResult = {
  fromCarryForward: number;
  fromCurrentYear: number;
  remainingCarryForward: number;
  remainingCurrentYear: number;
};

export function calculateFifoDeduction(
  daysTaken: number,
  carriedIn: number,
  allocated: number,
): FifoDeductionResult {
  const safeCarriedIn = Math.max(0, carriedIn);
  const safeAllocated = Math.max(0, allocated);
  const safeDays = Math.max(0, daysTaken);

  const fromCarryForward = Math.min(safeDays, safeCarriedIn);
  const remainingDays = safeDays - fromCarryForward;
  const fromCurrentYear = Math.min(remainingDays, safeAllocated);

  return {
    fromCarryForward: Number(fromCarryForward.toFixed(1)),
    fromCurrentYear: Number(fromCurrentYear.toFixed(1)),
    remainingCarryForward: Number(Math.max(0, safeCarriedIn - fromCarryForward).toFixed(1)),
    remainingCurrentYear: Number(Math.max(0, safeAllocated - fromCurrentYear).toFixed(1)),
  };
}

/**
 * Validates whether an officer can apply for the requested number of days.
 */
export function validateSpecialLeaveApplication(
  requestedDays: number,
  availableToApply: number,
): { valid: boolean; error?: string } {
  if (requestedDays <= 0) {
    return { valid: false, error: "Requested days must be greater than 0." };
  }
  if (requestedDays > availableToApply) {
    return {
      valid: false,
      error: `Cannot apply for ${requestedDays} days. Only ${availableToApply} uncommitted Special Leave day${
        availableToApply === 1 ? "" : "s"
      } available.`,
    };
  }
  return { valid: true };
}

/**
 * Validates whether an officer can log the specified number of days against an approved sanction.
 */
export function validateSpecialLeaveLogging(
  daysToLog: number,
  approvedDays: number,
  alreadyLoggedDays: number,
  options?: {
    app?: Pick<SpecialLeaveAppRecord, "expires_at" | "approved_date" | "valid_from" | "valid_to">;
    leaveStartDate?: string;
    leaveEndDate?: string;
  },
): { valid: boolean; remainingApproved: number; error?: string } {
  const remainingApproved = Math.max(0, Number((approvedDays - alreadyLoggedDays).toFixed(1)));

  if (daysToLog <= 0) {
    return { valid: false, remainingApproved, error: "Days to log must be greater than 0." };
  }
  if (daysToLog > remainingApproved) {
    return {
      valid: false,
      remainingApproved,
      error: `Cannot log ${daysToLog} days: only ${remainingApproved} day${
        remainingApproved === 1 ? "" : "s"
      } remain out of ${approvedDays} approved days for this sanction.`,
    };
  }

  if (options?.app) {
    const expiry =
      options.app.expires_at ||
      (options.app.approved_date ? computeSpecialLeaveExpiry(options.app.approved_date) : null);
    const targetDate = options.leaveStartDate || new Date().toISOString().split("T")[0];

    if (expiry && targetDate > expiry) {
      return {
        valid: false,
        remainingApproved,
        error: `Cannot log leave: Special Leave sanction expired on ${expiry} (valid for 6 months from approval date).`,
      };
    }

    if (options.leaveStartDate && options.app.valid_from && options.leaveStartDate < options.app.valid_from) {
      return {
        valid: false,
        remainingApproved,
        error: `Leave start date (${options.leaveStartDate}) cannot be before the sanction valid from date (${options.app.valid_from}).`,
      };
    }

    if (options.leaveEndDate && options.app.valid_to && options.leaveEndDate > options.app.valid_to) {
      return {
        valid: false,
        remainingApproved,
        error: `Leave end date (${options.leaveEndDate}) cannot be after the sanction valid to date (${options.app.valid_to}).`,
      };
    }
  }

  return { valid: true, remainingApproved };
}
