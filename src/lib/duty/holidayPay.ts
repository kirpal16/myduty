import type { HolidayResolution } from "@/lib/holidays/resolveHoliday";
import type { DutyStatus } from "@/types/database";

/**
 * The R1 decision, isolated as a pure function so it can be tested directly
 * and so every write path reaches the same answer.
 *
 * A holiday DATE pays nothing. Pay is earned by working it:
 *
 *   Public holiday   + worked  -> auto rate
 *   Weekend off      + worked  -> auto rate
 *   Personal day off + worked  -> auto rate
 *   Normal day       + worked  -> nothing, unless manually claimed
 *   Anything         + cancelled -> nothing
 *
 * `isHoliday` is derived from the date and is never read from the form —
 * otherwise a client could mark a plain Tuesday as a holiday and pay itself.
 * The officer's only input is the AMOUNT, and (off a holiday) whether they
 * are claiming at all.
 */
export type HolidayPayInput = {
  resolution: HolidayResolution;
  status: DutyStatus;
  /** Officer's default rate, from user_settings. */
  holidayDayRate: number;
  /** Explicit per-duty override. Undefined means "use the default". */
  submittedAllowance?: number | null;
  /** Claiming holiday pay on a day the calendar does not call a holiday. */
  manualClaim?: boolean;
};

export type HolidayPayResult = {
  isHoliday: boolean;
  isHolidayDuty: boolean;
  manualHolidayClaim: boolean;
  holidayAllowance: number;
};

export function resolveHolidayPay(input: HolidayPayInput): HolidayPayResult {
  const { resolution, status, holidayDayRate, submittedAllowance, manualClaim } = input;

  const isHoliday = resolution.isHoliday;
  const cancelled = status === "CANCELLED";

  // The duty row's existence is the proof of work — except once it is
  // cancelled, which is exactly when pay must stop.
  // Optional holidays (મરજિયાત) are normal working days, not holiday duties.
  const isHolidayDuty =
    isHoliday && !cancelled && resolution.qualifiesForHolidayAllowance !== false;

  // A manual claim is only meaningful off a holiday; on one the allowance is
  // automatic, so the flag would be redundant (and the DB constraint rejects it).
  const manualHolidayClaim = !isHoliday && !cancelled && manualClaim === true;

  if (cancelled) {
    return { isHoliday, isHolidayDuty: false, manualHolidayClaim: false, holidayAllowance: 0 };
  }

  const earns =
    (isHolidayDuty && resolution.qualifiesForHolidayAllowance) || manualHolidayClaim;

  if (!earns) {
    return { isHoliday, isHolidayDuty, manualHolidayClaim, holidayAllowance: 0 };
  }

  // The officer's amount wins when supplied — TA and allowances genuinely
  // vary — and the configured rate is only the starting point.
  const allowance =
    submittedAllowance != null && Number.isFinite(submittedAllowance) && submittedAllowance >= 0
      ? submittedAllowance
      : holidayDayRate;

  return { isHoliday, isHolidayDuty, manualHolidayClaim, holidayAllowance: allowance };
}
