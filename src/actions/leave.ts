"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toDateKey } from "@/lib/format/datetime";
import {
  applyLeaveSchema,
  setAllowanceSchema,
  leaveTypeSchema,
  leaveTypeValuesFromForm,
  leaveValuesFromForm,
  dayTypesFromForm,
} from "@/lib/validations/leave";
import { requireSuperAdmin, requireOwnership } from "@/lib/permissions/hasPermission";
import {
  isHolidayLeaveType,
  findHolidayLeaveViolation,
  holidayLeaveViolationMessage,
  datesInRange,
  HOLIDAY_LEAVE_CODE,
} from "@/lib/leave/holidayLeaveRules";
import {
  isOptionalHolidayType,
  findOptionalHolidayViolation,
  optionalHolidayViolationMessage,
  OPTIONAL_HOLIDAY_CODE,
  MAX_OPTIONAL_HOLIDAYS_PER_YEAR,
} from "@/lib/leave/optionalHolidayRules";
import {
  allocateLeaveDays,
  allocationModeFor,
  isHalfDayAllowed,
} from "@/lib/leave/allocateLeaveDays";
import { summariseBreakdown, type DayBreakdownEntry } from "@/lib/leave/leaveDays";
import {
  validateDayAllocation,
  type BalanceInfo,
  type DayIssue,
} from "@/lib/leave/validateDayAllocation";
import {
  resolveHoliday,
  holidayKindLabel,
  type HolidayRecord,
} from "@/lib/holidays/resolveHoliday";
import {
  calculateSpecialLeaveCommittedDays,
  calculateSpecialLeaveAvailableToApply,
  validateSpecialLeaveApplication,
  validateSpecialLeaveLogging,
  computeSpecialLeaveExpiry,
} from "@/lib/leave/specialLeaveRules";
import type { LeaveDayAllocation } from "@/types/database";
import {
  fieldErrors,
  failed,
  invalid,
  succeeded,
  type FormState,
} from "@/lib/forms/formState";

/**
 * Kept as a name so existing imports still work; the shape is now shared.
 * It was one of three independent declarations of the same object.
 */
export type LeaveFormState = FormState;

function parseLeaveForm(formData: FormData) {
  return applyLeaveSchema.safeParse(leaveValuesFromForm(formData));
}

import { saveFormAttachment } from "@/lib/storage/uploadAttachment";

/**
 * Holiday Leave may only be taken on a holiday, and only on one that was not
 * worked (R1). Both are checked here rather than in the zod schema, because
 * both need the holiday calendar and the officer's duty log — context a schema
 * does not have.
 *
 * Returns an error message, or null when the entry is allowed.
 */
async function checkHolidayLeave(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leaveTypeId: string,
  startDate: string,
  endDate: string,
  excludeLogId?: string,
): Promise<string | null> {
  const { data: type } = await supabase
    .from("leave_types")
    .select("code, is_system")
    .eq("id", leaveTypeId)
    .maybeSingle();

  if (!isHolidayLeaveType(type)) return null;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return "Not authenticated";

  const [{ data: holidays }, { data: duties }] = await Promise.all([
    supabase
      .from("holidays")
      .select("name, holiday_date, scope, is_government, is_optional")
      .gte("holiday_date", startDate)
      .lte("holiday_date", endDate),
    // A cancelled duty was not worked, so it does not block the leave.
    supabase
      .from("duties")
      .select("starts_at")
      .eq("user_id", auth.user.id)
      .neq("status", "CANCELLED")
      .gte("starts_at", `${startDate}T00:00:00`)
      .lte("starts_at", `${endDate}T23:59:59`),
  ]);

  const workedDates = new Set(
    (duties ?? []).map((d) => toDateKey(new Date(d.starts_at))),
  );

  const violation = findHolidayLeaveViolation(
    startDate,
    endDate,
    (holidays ?? []) as HolidayRecord[],
    workedDates,
  );

  void excludeLogId; // the edited row is a leave, never a duty — nothing to exclude
  return violation ? holidayLeaveViolationMessage(violation) : null;
}

/**
 * Optional Holiday Rule:
 * 1. Must be taken on a declared Optional Holiday date.
 * 2. Max 2 days per calendar year.
 * 3. Cannot be taken alone: must have an extra leave (CL, HL, PL etc) before or after.
 */
async function checkOptionalHolidayLeave(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leaveTypeId: string,
  startDate: string,
  endDate: string,
  pairedLeaveTypeId?: string | null,
  pairedLeaveDate?: string | null,
  excludeLogId?: string,
): Promise<string | null> {
  const { data: type } = await supabase
    .from("leave_types")
    .select("code, is_system")
    .eq("id", leaveTypeId)
    .maybeSingle();

  if (!isOptionalHolidayType(type)) return null;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return "Not authenticated";

  if (startDate !== endDate) {
    return "Optional Holiday can only be taken 1 day at a time (paired with an adjacent leave).";
  }

  const year = parseInt(startDate.slice(0, 4), 10);

  const [{ data: holidays }, { data: balances }, { data: existingLeaves }] = await Promise.all([
    supabase
      .from("holidays")
      .select("name, holiday_date, scope, is_government, is_optional")
      .eq("is_optional", true)
      .gte("holiday_date", `${year}-01-01`)
      .lte("holiday_date", `${year}-12-31`),
    supabase
      .from("leave_balance_view")
      .select("remaining")
      .eq("user_id", auth.user.id)
      .eq("leave_type_id", leaveTypeId)
      .eq("year", year)
      .maybeSingle(),
    supabase
      .from("leave_logs")
      .select("id, start_date, end_date")
      .eq("user_id", auth.user.id)
      .gte("start_date", `${year}-01-01`)
      .lte("end_date", `${year}-12-31`),
  ]);

  const loggedDates = new Set<string>();
  for (const l of existingLeaves ?? []) {
    if (excludeLogId && l.id === excludeLogId) continue;
    for (const d of datesInRange(l.start_date, l.end_date)) {
      loggedDates.add(d);
    }
  }

  const hasPaired = Boolean(pairedLeaveTypeId && pairedLeaveDate);
  const remaining = balances?.remaining ?? 2;

  const violation = findOptionalHolidayViolation(
    startDate,
    (holidays ?? []) as HolidayRecord[],
    loggedDates,
    remaining,
    hasPaired,
  );

  return violation ? optionalHolidayViolationMessage(violation) : null;
}

const HALF_DAY_CL_ONLY = "Half-day is only available for Casual Leave (CL).";

/** Half-day is CL-only; the form hides the option, this is the real check. */
async function checkHalfDayAllowed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leaveTypeId: string,
  isHalfDay: boolean,
): Promise<string | null> {
  if (!isHalfDay) return null;
  const { data: type } = await supabase
    .from("leave_types")
    .select("code, is_system")
    .eq("id", leaveTypeId)
    .maybeSingle();
  return isHalfDayAllowed(type) ? null : HALF_DAY_CL_ONLY;
}

export type AllocationPreviewDay = {
  date: string;
  /** The type this day is charged to, after the officer's changes. */
  leaveTypeId: string;
  /** What the engine proposed, so the UI can mark and reset a changed day. */
  engineTypeId: string;
  code: string;
  /** "Sunday", "Diwali", "Optional Holiday: …", "Working day". */
  dayLabel: string;
};

export type AllocationPreview = {
  totalDays: number;
  breakdown: DayBreakdownEntry[];
  days: AllocationPreviewDay[];
  /** Why the current breakdown cannot be saved. Empty when it can. */
  issues: DayIssue[];
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Runs the Smart Leave Engine for one request: loads the holiday calendar,
 * the officer's worked dates and their Optional Holiday quota, and returns
 * the leave type each day is charged to.
 *
 * When editing, `excludeLogId`'s own OH days are handed back to the quota —
 * otherwise re-saving an unchanged leave would find its own OH day "used".
 */
async function buildAllocation(
  supabase: Supabase,
  userId: string,
  input: {
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    isHalfDay: boolean;
    excludeLogId?: string;
    /** The officer's per-day changes: date -> leave type id. */
    overrides?: Readonly<Record<string, string>>;
  },
): Promise<{ days: LeaveDayAllocation[]; preview: AllocationPreview; issues: DayIssue[] }> {
  const { leaveTypeId, startDate, endDate, isHalfDay, excludeLogId, overrides } = input;

  // RLS returns the global types plus this officer's own.
  const { data: types } = await supabase
    .from("leave_types")
    .select("id, name, code, is_system, user_id, is_active");

  const requested = (types ?? []).find((t) => t.id === leaveTypeId);
  const mode = allocationModeFor(requested);
  const systemTypeId = (code: string) =>
    (types ?? []).find((t) => t.is_system && t.code === code && t.user_id === null)?.id;
  const hlId = systemTypeId(HOLIDAY_LEAVE_CODE);
  const ohId = systemTypeId(OPTIONAL_HOLIDAY_CODE);

  const firstYear = Number(startDate.slice(0, 4));
  const lastYear = Number(endDate.slice(0, 4));
  const years: number[] = [];
  for (let y = firstYear; y <= lastYear; y++) years.push(y);

  type OwnDay = { leave_date: string; leave_type_id: string; fraction: number };
  type BalanceRow = { leave_type_id: string; year: number; remaining: number; allocation_exists: boolean };
  let dbHolidays: HolidayRecord[] = [];
  let workedDates = new Set<string>();
  let balanceRows: BalanceRow[] = [];
  let ownDays: OwnDay[] = [];

  // A half-day is never split or overridden, so it needs none of this.
  if (!isHalfDay) {
    const [{ data: holidays }, { data: duties }, { data: balances }, { data: own }] =
      await Promise.all([
        // Whole years, not just the span: whether the optional-holiday catalog
        // applies depends on whether the year has ANY declared optional rows.
        supabase
          .from("holidays")
          .select("name, holiday_date, scope, is_government, is_optional")
          .gte("holiday_date", `${firstYear}-01-01`)
          .lte("holiday_date", `${lastYear}-12-31`),
        supabase
          .from("duties")
          .select("starts_at")
          .eq("user_id", userId)
          .neq("status", "CANCELLED")
          .gte("starts_at", `${startDate}T00:00:00`)
          .lte("starts_at", `${endDate}T23:59:59`),
        supabase
          .from("leave_balance_view")
          .select("leave_type_id, year, remaining, allocation_exists")
          .eq("user_id", userId)
          .in("year", years),
        // When editing, this log's own days are handed back to each balance —
        // otherwise re-saving an unchanged leave would find its own days "used".
        excludeLogId
          ? supabase
              .from("leave_log_days")
              .select("leave_date, leave_type_id, fraction")
              .eq("leave_log_id", excludeLogId)
          : Promise.resolve({ data: [] as OwnDay[] }),
      ]);

    dbHolidays = (holidays ?? []) as HolidayRecord[];
    workedDates = new Set((duties ?? []).map((d) => toDateKey(new Date(d.starts_at))));
    balanceRows = (balances ?? []).map((b) => ({
      leave_type_id: b.leave_type_id,
      year: Number(b.year),
      remaining: Number(b.remaining),
      allocation_exists: Boolean(b.allocation_exists),
    }));
    ownDays = (own ?? []).map((d) => ({
      leave_date: d.leave_date,
      leave_type_id: d.leave_type_id,
      fraction: Number(d.fraction),
    }));
  }

  const balanceFor = (typeId: string, year: number): BalanceInfo | undefined => {
    const own = ownDays
      .filter((d) => d.leave_type_id === typeId && d.leave_date.startsWith(`${year}-`))
      .reduce((a, d) => a + d.fraction, 0);
    const row = balanceRows.find((b) => b.leave_type_id === typeId && b.year === year);
    if (typeId === ohId) {
      return {
        remaining: (row ? row.remaining : MAX_OPTIONAL_HOLIDAYS_PER_YEAR) + own,
        allocationExists: true,
      };
    }
    if (!row) return undefined;
    return { remaining: row.remaining + own, allocationExists: row.allocation_exists };
  };

  const ohRemainingByYear: Record<number, number> = {};
  if (ohId) for (const y of years) ohRemainingByYear[y] = balanceFor(ohId, y)?.remaining ?? 0;

  const allocated = allocateLeaveDays({
    startDate,
    endDate,
    isHalfDay,
    mode,
    dbHolidays,
    workedDates,
    ohRemainingByYear,
  });

  const engineDays: LeaveDayAllocation[] = allocated.map((d) => ({
    date: d.date,
    leave_type_id:
      d.target === "HL" && hlId ? hlId : d.target === "OH" && ohId ? ohId : leaveTypeId,
    fraction: d.fraction,
  }));
  const engineTypeByDate: Record<string, string> = Object.fromEntries(
    engineDays.map((d) => [d.date, d.leave_type_id]),
  );

  // The officer's changes, applied on top of the engine's proposal.
  // No per-day changes for a single day: the dropdown IS its type.
  const days: LeaveDayAllocation[] = isHalfDay || engineDays.length < 2
    ? engineDays
    : engineDays.map((d) => {
        const chosen = overrides?.[d.date];
        return chosen && chosen !== d.leave_type_id ? { ...d, leave_type_id: chosen } : d;
      });

  // Active types, plus the requested one (an edit may keep a since-disabled type).
  const selectableTypes = (types ?? []).filter(
    (t) => t.is_active !== false || t.id === leaveTypeId,
  );
  const issues: DayIssue[] = isHalfDay
    ? []
    : validateDayAllocation({
        days: days.map((d) => ({ date: d.date, leaveTypeId: d.leave_type_id, fraction: d.fraction })),
        engineTypeByDate,
        types: selectableTypes,
        dbHolidays,
        workedDates,
        balanceFor,
      });

  const codeOf = (id: string) => {
    const t = (types ?? []).find((x) => x.id === id);
    return t?.code || t?.name || "Leave";
  };
  const dayLabel = (date: string) => {
    const r = resolveHoliday(new Date(`${date}T12:00:00`), dbHolidays);
    if (r.kind === "optional_holiday") return `Optional Holiday${r.name ? `: ${r.name}` : ""}`;
    if (r.isHoliday) return r.name ?? holidayKindLabel(r.kind);
    return "Working day";
  };

  return {
    days,
    issues,
    preview: {
      totalDays: days.reduce((a, d) => a + d.fraction, 0),
      breakdown: summariseBreakdown(
        days.map((d) => ({ code: codeOf(d.leave_type_id), fraction: d.fraction })),
      ),
      days: days.map((d) => ({
        date: d.date,
        leaveTypeId: d.leave_type_id,
        engineTypeId: engineTypeByDate[d.date],
        code: codeOf(d.leave_type_id),
        dayLabel: dayLabel(d.date),
      })),
      issues,
    },
  };
}

/** A breakdown that breaks a rule: nothing is saved, and the form says why. */
function breakdownFailure(issues: readonly DayIssue[]): LeaveFormState {
  const lines = issues.map((i) => (i.date ? `${i.date}: ${i.message}` : i.message));
  return {
    message: `Fix the day-by-day breakdown first. ${lines[0]}`,
    errors: { breakdown: lines },
  };
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Read-only: what a leave WOULD be charged to, for the form's live preview.
 * Runs the same engine as the save, so the preview cannot disagree with it.
 */
export async function previewLeaveAllocation(input: {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  logId?: string;
  overrides?: Record<string, string>;
}): Promise<AllocationPreview | null> {
  const { leaveTypeId, startDate, endDate, isHalfDay, logId, overrides } = input;
  if (!leaveTypeId || !DATE_KEY.test(startDate) || !DATE_KEY.test(endDate)) return null;
  if (endDate < startDate) return null;
  // A year and a day is already an unrealistic single leave; beyond that the
  // preview would just be an expensive way to render nothing useful.
  if (datesInRange(startDate, endDate).length > 366) return null;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { preview } = await buildAllocation(supabase, auth.user.id, {
    leaveTypeId,
    startDate,
    endDate: isHalfDay ? startDate : endDate,
    isHalfDay,
    excludeLogId: logId,
    overrides,
  });
  return preview;
}

/**
 * Logging or editing leave moves the balance, and the balance is shown on
 * three other screens. Only deleteLeaveLog used to revalidate them, so a
 * freshly logged day left a stale figure behind it.
 */
function revalidateLeave(logId?: string) {
  revalidatePath("/leave");
  if (logId) revalidatePath(`/leave/${logId}`);
  revalidatePath("/leave/new");
  revalidatePath("/leave/[id]/edit", "page");
  revalidatePath("/leave/balance");
  revalidatePath("/settings");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/storage");
}

/**
 * Records leave that was already taken. There is no approval step and no
 * balance rejection — logging more than the configured allowance is allowed
 * and simply shows as a negative remaining balance, because the log has to
 * reflect what actually happened.
 */
export async function logLeave(
  _prevState: LeaveFormState,
  formData: FormData,
): Promise<LeaveFormState> {
  const validated = parseLeaveForm(formData);
  if (!validated.success) return { errors: fieldErrors(validated.error) };

  const { leaveTypeId, startDate, endDate, isHalfDay, halfDaySession, reason } =
    validated.data;

  const supabase = await createClient();

  const halfDayError = await checkHalfDayAllowed(supabase, leaveTypeId, isHalfDay);
  if (halfDayError) return { errors: { isHalfDay: [halfDayError] }, message: halfDayError };

  const holidayError = await checkHolidayLeave(supabase, leaveTypeId, startDate, endDate);
  if (holidayError) return { message: holidayError };

  const pairedLeaveTypeId = (formData.get("pairedLeaveTypeId") as string) || null;
  const pairedLeaveDate = (formData.get("pairedLeaveDate") as string) || null;
  const pairedReason = (formData.get("pairedReason") as string) || null;

  const optionalError = await checkOptionalHolidayLeave(
    supabase,
    leaveTypeId,
    startDate,
    endDate,
    pairedLeaveTypeId,
    pairedLeaveDate,
  );
  if (optionalError) return { message: optionalError };

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { message: "Not authenticated" };

  // One log, many day types: the engine decides which days are CL, HL, OH
  // or SPL, and the log and its days are saved in one transaction.
  const allocation = await buildAllocation(supabase, auth.user.id, {
    leaveTypeId,
    startDate,
    endDate,
    isHalfDay,
    overrides: dayTypesFromForm(formData),
  });
  // The same gate updateLeaveLog has always had. Without it a create could
  // save a breakdown the edit form would refuse, over-quota days included.
  if (allocation.issues.length > 0) return breakdownFailure(allocation.issues);

  const specialLeaveApplicationId =
    (formData.get("specialLeaveApplicationId") as string) || null;

  // Special Leave and Binpagari Leave both require an approved sanction
  const { data: pickedType } = await supabase
    .from("leave_types")
    .select("code, is_system")
    .eq("id", leaveTypeId)
    .maybeSingle();

  const pickedCode = pickedType?.code?.toUpperCase();
  const isSpecialLeave = pickedCode === "SPL" && Boolean(pickedType?.is_system);
  const isBinpagariLeave = pickedCode === "LWP" && Boolean(pickedType?.is_system);
  const requiresSanction = isSpecialLeave || isBinpagariLeave;
  const sanctionLabel = isBinpagariLeave ? "Binpagari Leave" : "Special Leave";

  if (requiresSanction) {
    if (!specialLeaveApplicationId) {
      return {
        errors: {
          specialLeaveApplicationId: [
            `An approved sanction is required for ${sanctionLabel}.`,
          ],
        },
        message: `Please select an approved ${sanctionLabel} sanction.`,
      };
    }

    const { data: splApp } = await supabase
      .from("special_leave_applications")
      .select("status, approved_days, approved_date, expires_at, valid_from, valid_to")
      .eq("id", specialLeaveApplicationId)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (!splApp || splApp.status !== "APPROVED") {
      return { message: `Selected ${sanctionLabel} sanction is not approved.` };
    }

    const { data: existingLogs } = await supabase
      .from("leave_logs")
      .select("start_date, end_date, is_half_day")
      .eq("special_leave_application_id", specialLeaveApplicationId);

    const loggedDays = (existingLogs ?? []).reduce(
      (acc, l) =>
        acc +
        (l.is_half_day
          ? 0.5
          : Math.round(
              (new Date(l.end_date).getTime() -
                new Date(l.start_date).getTime()) /
                (1000 * 60 * 60 * 24),
            ) + 1),
      0,
    );

    const daysInThisRequest = allocation.days
      .filter((d) => d.leave_type_id === leaveTypeId)
      .reduce((acc, d) => acc + d.fraction, 0);

    const check = validateSpecialLeaveLogging(
      daysInThisRequest,
      splApp.approved_days ?? 0,
      loggedDays,
      {
        app: splApp,
        leaveStartDate: startDate,
        leaveEndDate: endDate,
      },
    );
    if (!check.valid) {
      return { message: check.error };
    }
  }

  const { data: createdLog, error } = await supabase.rpc("log_leave_with_days", {
    p_leave_type_id: leaveTypeId,
    p_start_date: startDate,
    p_end_date: endDate,
    p_is_half_day: isHalfDay,
    p_half_day_session: isHalfDay ? (halfDaySession ?? null) : null,
    p_reason: reason ?? null,
    p_days: allocation.days,
    p_special_leave_application_id: specialLeaveApplicationId,
  });

  if (error) return { message: error.message };

  // Paired regular leave for Optional Holiday (CL, PL, etc.)
  if (pairedLeaveTypeId && pairedLeaveDate) {
    const paired = await buildAllocation(supabase, auth.user.id, {
      leaveTypeId: pairedLeaveTypeId,
      startDate: pairedLeaveDate,
      endDate: pairedLeaveDate,
      isHalfDay: false,
    });
    const { error: pairedError } = await supabase.rpc("log_leave_with_days", {
      p_leave_type_id: pairedLeaveTypeId,
      p_start_date: pairedLeaveDate,
      p_end_date: pairedLeaveDate,
      p_is_half_day: false,
      p_half_day_session: null,
      p_reason: pairedReason ?? "Paired with Optional Holiday leave",
      p_days: paired.days,
    });
    if (pairedError) return { message: pairedError.message };
  }

  const file = formData.get("file");
  if (file instanceof File && file.size > 0 && createdLog?.id) {
    try {
      await saveFormAttachment({
        file,
        relatedEntityType: "leave_logs",
        relatedEntityId: createdLog.id,
        userId: auth.user.id,
      });
    } catch (err: unknown) {
      return { message: (err as Error).message };
    }
  }

  revalidateLeave();
  redirect("/leave");
}

export async function updateLeaveLog(
  logId: string,
  _prevState: LeaveFormState,
  formData: FormData,
): Promise<LeaveFormState> {
  const validated = parseLeaveForm(formData);
  if (!validated.success) return { errors: fieldErrors(validated.error) };

  const { leaveTypeId, startDate, endDate, isHalfDay, halfDaySession, reason } =
    validated.data;

  const supabase = await createClient();

  const halfDayError = await checkHalfDayAllowed(supabase, leaveTypeId, isHalfDay);
  if (halfDayError) return { errors: { isHalfDay: [halfDayError] }, message: halfDayError };

  // RLS scopes the update to the caller's own row, but an explicit check makes
  // the refusal loud instead of a silent zero-row update.
  await requireOwnership("leave_logs", logId);

  // The RPC that logLeave uses carries this validation; a direct table update
  // bypassed it entirely, so an edit could put Holiday Leave on a working day
  // that creating it would have refused.
  const holidayError = await checkHolidayLeave(
    supabase,
    leaveTypeId,
    startDate,
    endDate,
    logId,
  );
  if (holidayError) return { message: holidayError };

  const optionalHolidayError = await checkOptionalHolidayLeave(
    supabase,
    leaveTypeId,
    startDate,
    endDate,
    null,
    null,
    logId,
  );
  if (optionalHolidayError) return { message: optionalHolidayError };

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { message: "Not authenticated" };

  // Worked out before the update, while this log's own OH days can still be
  // handed back to the quota.
  const allocation = await buildAllocation(supabase, auth.user.id, {
    leaveTypeId,
    startDate,
    endDate,
    isHalfDay,
    excludeLogId: logId,
    overrides: dayTypesFromForm(formData),
  });
  if (allocation.issues.length > 0) return breakdownFailure(allocation.issues);

  const specialLeaveApplicationId =
    (formData.get("specialLeaveApplicationId") as string) || null;

  // An edit must not be a way to drop the sanction a type requires.
  const { data: editedType } = await supabase
    .from("leave_types")
    .select("code, is_system")
    .eq("id", leaveTypeId)
    .maybeSingle();

  const editedCode = editedType?.code?.toUpperCase();
  const editIsBinpagari = editedCode === "LWP" && Boolean(editedType?.is_system);
  const editRequiresSanction =
    (editedCode === "SPL" && Boolean(editedType?.is_system)) || editIsBinpagari;
  const editSanctionLabel = editIsBinpagari ? "Binpagari Leave" : "Special Leave";

  if (editRequiresSanction && !specialLeaveApplicationId) {
    return {
      errors: {
        specialLeaveApplicationId: [
          `An approved sanction is required for ${editSanctionLabel}.`,
        ],
      },
      message: `Please select an approved ${editSanctionLabel} sanction.`,
    };
  }

  if (specialLeaveApplicationId) {
    const { data: splApp } = await supabase
      .from("special_leave_applications")
      .select("status, approved_days, approved_date, expires_at, valid_from, valid_to")
      .eq("id", specialLeaveApplicationId)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (!splApp || splApp.status !== "APPROVED") {
      return { message: `Selected ${editSanctionLabel} sanction is not approved.` };
    }

    const { data: existingLogs } = await supabase
      .from("leave_logs")
      .select("start_date, end_date, is_half_day")
      .eq("special_leave_application_id", specialLeaveApplicationId)
      .neq("id", logId);

    const loggedDays = (existingLogs ?? []).reduce(
      (acc, l) =>
        acc +
        (l.is_half_day
          ? 0.5
          : Math.round(
              (new Date(l.end_date).getTime() -
                new Date(l.start_date).getTime()) /
                (1000 * 60 * 60 * 24),
            ) + 1),
      0,
    );

    const daysInThisRequest = allocation.days
      .filter((d) => d.leave_type_id === leaveTypeId)
      .reduce((acc, d) => acc + d.fraction, 0);

    const check = validateSpecialLeaveLogging(
      daysInThisRequest,
      splApp.approved_days ?? 0,
      loggedDays,
      {
        app: splApp,
        leaveStartDate: startDate,
        leaveEndDate: endDate,
      },
    );
    if (!check.valid) {
      return { message: check.error };
    }
  }

  const { error } = await supabase
    .from("leave_logs")
    .update({
      leave_type_id: leaveTypeId,
      start_date: startDate,
      end_date: endDate,
      is_half_day: isHalfDay,
      half_day_session: isHalfDay ? (halfDaySession ?? null) : null,
      reason: reason ?? null,
      special_leave_application_id: specialLeaveApplicationId,
    })
    .eq("id", logId);

  if (error) return { message: error.message };

  const { error: daysError } = await supabase.rpc("set_leave_log_days", {
    p_leave_log_id: logId,
    p_days: allocation.days,
  });
  if (daysError) return { message: daysError.message };

  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    try {
      await saveFormAttachment({
        file,
        relatedEntityType: "leave_logs",
        relatedEntityId: logId,
        userId: auth.user.id,
      });
    } catch (err: unknown) {
      return { message: (err as Error).message };
    }
  }

  revalidateLeave(logId);
  redirect("/leave");
}

export async function deleteLeaveLog(logId: string) {
  await requireOwnership("leave_logs", logId);
  const supabase = await createClient();
  const { error } = await supabase.from("leave_logs").delete().eq("id", logId);
  if (error) throw error;

  revalidateLeave();
}

export async function removeOwnLeaveAllowance(leaveTypeId: string, year: number) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("user_leave_balances")
    .delete()
    .eq("user_id", auth.user.id)
    .eq("leave_type_id", leaveTypeId)
    .eq("year", year);
  if (error) throw error;

  revalidatePath("/settings");
  revalidatePath("/leave/balance");
}

const DEFAULT_LEAVE_COLOR = "#10b981";

/** Codes are the stable identifier, so they are normalised the same way everywhere. */
function normaliseCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "_");
}

function readColor(formData: FormData): string {
  const raw = (formData.get("color") as string | null)?.trim() ?? "";
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : DEFAULT_LEAVE_COLOR;
}

function revalidateLeaveTypes() {
  revalidatePath("/admin/leave-types");
  revalidatePath("/settings");
  revalidatePath("/leave");
  revalidatePath("/leave/new");
  revalidatePath("/leave/[id]/edit", "page");
  revalidatePath("/leave/balance");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

/**
 * A leave type that has been used cannot be deleted without orphaning the
 * logs that reference it, so deletion is refused and deactivation offered
 * instead — a deactivated type disappears from the picker but keeps history
 * readable.
 */
async function leaveTypeUsageMessage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leaveTypeId: string,
): Promise<string | null> {
  // A type is "used" if a leave was logged as it, OR if the leave engine
  // charged a day of some other leave to it (e.g. an HL day inside a CL).
  const [{ count: logs }, { count: days }] = await Promise.all([
    supabase
      .from("leave_logs")
      .select("id", { count: "exact", head: true })
      .eq("leave_type_id", leaveTypeId),
    supabase
      .from("leave_log_days")
      .select("id", { count: "exact", head: true })
      .eq("leave_type_id", leaveTypeId),
  ]);

  if ((logs ?? 0) > 0) {
    return `This leave type is used by ${logs} leave log${logs === 1 ? "" : "s"}. Deactivate it instead of deleting it.`;
  }
  if ((days ?? 0) > 0) {
    return `${days} logged leave day${days === 1 ? " is" : "s are"} charged to this leave type. Deactivate it instead of deleting it.`;
  }
  return null;
}

/** What a delete returns: an error to show, or nothing on success. */
export type DeleteLeaveTypeResult = { error?: string } | undefined;

const FOREIGN_KEY_VIOLATION = "23503";

/**
 * Shared delete for global (admin) and personal (officer) types.
 *
 * Returns the reason rather than throwing it: a message thrown from a Server
 * Action is replaced by a generic one in production builds, so the officer
 * would only ever see "An error occurred".
 */
async function deleteLeaveTypeRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  scope: { global: true } | { userId: string },
): Promise<DeleteLeaveTypeResult> {
  const { data: type } = await supabase
    .from("leave_types")
    .select("id, name, is_system, user_id")
    .eq("id", id)
    .maybeSingle();

  if (!type) return { error: "That leave type no longer exists." };
  // A Super Admin may delete a system type (HL / OH / SPL) like any other
  // global type, once nothing uses it; an officer's own types are never system.
  if (type.is_system && !("global" in scope)) {
    return { error: `${type.name} is a system leave type and can only be removed by an administrator.` };
  }

  const usage = await leaveTypeUsageMessage(supabase, id);
  if (usage) return { error: usage };

  let q = supabase.from("leave_types").delete().eq("id", id);
  q = "global" in scope ? q.is("user_id", null) : q.eq("user_id", scope.userId);
  const { data: deleted, error } = await q.select("id");

  if (error) {
    return {
      error:
        error.code === FOREIGN_KEY_VIOLATION
          ? `${type.name} is still referenced by other records (such as officers' allowances), so it cannot be deleted yet. Deactivate it instead.`
          : error.message,
    };
  }
  // RLS turns a forbidden delete into "0 rows, no error". Say so instead of
  // reporting a success that did nothing.
  if (!deleted || deleted.length === 0) {
    return { error: `${type.name} could not be deleted — you do not have permission to remove it.` };
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Admin: the global leave types, available to every officer.
// ---------------------------------------------------------------------------

export async function createLeaveType(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSuperAdmin();
  const parsed = leaveTypeSchema.safeParse(leaveTypeValuesFromForm(formData));
  if (!parsed.success) return invalid(fieldErrors(parsed.error));
  const { name } = parsed.data;
  const code = normaliseCode(parsed.data.code || name);

  const supabase = await createClient();
  const { error } = await supabase.from("leave_types").insert({
    name,
    code,
    color: parsed.data.color ?? readColor(formData),
  });
  if (error) return failed(error.message);

  revalidateLeaveTypes();
  return succeeded("Leave type saved.");
}

export async function updateLeaveType(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSuperAdmin();
  const id = formData.get("id") as string;
  const parsed = leaveTypeSchema.safeParse(leaveTypeValuesFromForm(formData));
  if (!parsed.success) return invalid(fieldErrors(parsed.error));
  const { name } = parsed.data;

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("leave_types")
    .select("code, is_system")
    .eq("id", id)
    .maybeSingle();
  if (!current) return failed("That leave type no longer exists.");

  // A system type's code is how the leave rules find it (HL, OH, SPL), so it
  // is kept whatever the form sent; its name and colour are the admin's.
  const code = current.is_system
    ? current.code
    : normaliseCode(parsed.data.code || name);

  const { data: updated, error } = await supabase
    .from("leave_types")
    .update({ name, code, color: readColor(formData) })
    .eq("id", id)
    .is("user_id", null)
    .select("id");
  if (error) return failed(error.message);
  // RLS answers a refused write with "0 rows, no error" — say so.
  if (!updated || updated.length === 0) {
    return failed("This leave type could not be saved — you do not have permission to change it.");
  }

  revalidateLeaveTypes();
  return succeeded("Leave type saved.");
}

export async function deleteLeaveType(id: string): Promise<DeleteLeaveTypeResult> {
  await requireSuperAdmin();
  const supabase = await createClient();
  const result = await deleteLeaveTypeRow(supabase, id, { global: true });
  if (result?.error) return result;

  revalidateLeaveTypes();
}

export async function toggleLeaveTypeActive(id: string, isActive: boolean) {
  await requireSuperAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("leave_types")
    .update({ is_active: !isActive })
    .eq("id", id);
  if (error) throw error;

  revalidateLeaveTypes();
}

// ---------------------------------------------------------------------------
// Officers: their own leave types, layered on top of the admin's.
//
// The global set stays read-only to them; these actions only ever touch rows
// where user_id = auth.uid(), which RLS enforces independently.
// ---------------------------------------------------------------------------

async function requireSelf() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");
  return { supabase, userId: auth.user.id };
}

export async function createMyLeaveType(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, userId } = await requireSelf();
  const parsed = leaveTypeSchema.safeParse(leaveTypeValuesFromForm(formData));
  if (!parsed.success) return invalid(fieldErrors(parsed.error));
  const { name } = parsed.data;
  const code = normaliseCode(parsed.data.code || name);

  const { error } = await supabase.from("leave_types").insert({
    user_id: userId,
    name,
    code,
    color: parsed.data.color ?? readColor(formData),
  });
  if (error) return failed(error.message);

  revalidateLeaveTypes();
  return succeeded("Leave type saved.");
}

export async function updateMyLeaveType(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, userId } = await requireSelf();
  const id = formData.get("id") as string;
  const parsed = leaveTypeSchema.safeParse(leaveTypeValuesFromForm(formData));
  if (!parsed.success) return invalid(fieldErrors(parsed.error));
  const { name } = parsed.data;
  const code = normaliseCode(parsed.data.code || name);

  const { error } = await supabase
    .from("leave_types")
    .update({
      name,
      code,
      color: parsed.data.color ?? readColor(formData),
    })
    .eq("id", id)
    // Scoped to the caller in the action as well as in RLS, so an id from
    // the global set cannot be edited by guessing it.
    .eq("user_id", userId);
  if (error) return failed(error.message);

  revalidateLeaveTypes();
  return succeeded("Leave type saved.");
}

export async function deleteMyLeaveType(id: string): Promise<DeleteLeaveTypeResult> {
  const { supabase, userId } = await requireSelf();
  const result = await deleteLeaveTypeRow(supabase, id, { userId });
  if (result?.error) return result;

  revalidateLeaveTypes();
}

/**
 * Officers can enable/disable any leave type (department global or personal) for themselves.
 * When disabled, the leave type is excluded from their leave log creation dropdown and active lists.
 */
export async function toggleUserLeaveType(
  leaveTypeId: string,
  currentlyDisabled: boolean,
) {
  const { supabase, userId } = await requireSelf();

  if (currentlyDisabled) {
    // Enable: remove from user_disabled_leave_types
    const { error } = await supabase
      .from("user_disabled_leave_types")
      .delete()
      .eq("user_id", userId)
      .eq("leave_type_id", leaveTypeId);

    if (error) {
      throw new Error(error.message);
    }

    // If it's a personal type, also set is_active = true
    await supabase
      .from("leave_types")
      .update({ is_active: true })
      .eq("id", leaveTypeId)
      .eq("user_id", userId);
  } else {
    // Disable: upsert into user_disabled_leave_types
    const { error } = await supabase
      .from("user_disabled_leave_types")
      .upsert(
        { user_id: userId, leave_type_id: leaveTypeId },
        { onConflict: "user_id,leave_type_id" },
      );

    if (error) {
      throw new Error(error.message);
    }

    // If it's a personal type, also set is_active = false
    await supabase
      .from("leave_types")
      .update({ is_active: false })
      .eq("id", leaveTypeId)
      .eq("user_id", userId);
  }

  revalidateLeaveTypes();
}

/** Super Admin setting someone's allowance from that user's config screen. */
export async function setLeaveAllowance(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  // Authorisation still throws. A permission failure is not something the
  // officer fixes by editing a field, so it belongs on the error boundary.
  await requireSuperAdmin();
  return upsertAllowance(formData);
}

/** A user setting their own allowance in /settings — RLS scopes it to self. */
export async function setOwnLeaveAllowance(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");

  const withSelf = new FormData();
  for (const [k, v] of formData.entries()) withSelf.set(k, v);
  withSelf.set("userId", auth.user.id);
  return upsertAllowance(withSelf, "/settings");
}

/**
 * An optional number field: blank stays null rather than becoming 0.
 *
 * The distinction carries meaning in both places it is used. A blank maximum
 * means "no ceiling", not "cap at zero"; a blank carried-days override means
 * "use the computed figure", not "carry nothing".
 */
function optionalNumber(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const text = String(value).trim();
  if (text === "") return null;
  return Number(text);
}

async function upsertAllowance(
  formData: FormData,
  path = "/admin/users",
): Promise<FormState> {
  const parsed = setAllowanceSchema.safeParse({
    userId: formData.get("userId"),
    leaveTypeId: formData.get("leaveTypeId"),
    year: Number(formData.get("year")),
    allocated: Number(formData.get("allocated")),
    // An unchecked checkbox posts nothing at all.
    carryForward: formData.get("carryForward") === "on",
    maxAccumulated: optionalNumber(formData.get("maxAccumulated")),
    carriedOverride: optionalNumber(formData.get("carriedOverride")),
  });

  if (!parsed.success) {
    // Returned, not thrown. This used to blow the whole page up on the error
    // boundary because "these forms post directly with no error slot to render
    // into" -- they have one now, under the field that is wrong.
    return invalid(fieldErrors(parsed.error));
  }

  const {
    userId,
    leaveTypeId,
    year,
    allocated,
    carryForward,
    maxAccumulated,
    carriedOverride,
  } = parsed.data;

  const supabase = await createClient();

  const { error } = await supabase
    .from("user_leave_balances")
    .upsert(
      {
        user_id: userId,
        leave_type_id: leaveTypeId,
        year,
        allocated,
        carried_override: carriedOverride,
      },
      { onConflict: "user_id,leave_type_id,year" },
    );
  if (error) return failed(error.message);

  // The carry rule is per (officer, type) and deliberately NOT per year, so
  // it is a separate upsert against its own table rather than another column
  // on the row above.
  const { error: ruleError } = await supabase
    .from("user_leave_carry_rules")
    .upsert(
      {
        user_id: userId,
        leave_type_id: leaveTypeId,
        carry_forward: carryForward,
        // Blank means no ceiling. Storing 0 here would silently zero the
        // officer's whole balance.
        max_accumulated: carryForward ? maxAccumulated : null,
      },
      { onConflict: "user_id,leave_type_id" },
    );
  if (ruleError) return failed(ruleError.message);

  revalidatePath(path);
  // The admin form posts from /admin/users/[id] but only the list path was
  // revalidated, so the page you saved from kept showing the old value.
  revalidatePath("/admin/users/[id]", "page");
  revalidatePath("/leave/balance");
  revalidatePath("/dashboard");

  return succeeded("Allowance saved.");
}

/**
 * Submits a new Special Leave (SPL) application or records an approved sanction.
 * Validates available uncommitted balance (subtracting used days, pending requests,
 * and unlogged approved days).
 */
export async function applySpecialLeave(
  _prevState: LeaveFormState,
  formData: FormData,
): Promise<LeaveFormState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { message: "Not authenticated" };

  const appliedDate = (formData.get("appliedDate") as string)?.trim();
  const appliedDays = Number(formData.get("appliedDays"));
  const reason = (formData.get("reason") as string)?.trim() || null;
  const year = appliedDate ? new Date(appliedDate).getFullYear() : new Date().getFullYear();

  if (!appliedDate || !DATE_KEY.test(appliedDate)) {
    return { message: "Please provide a valid application date (YYYY-MM-DD)." };
  }
  if (!appliedDays || appliedDays <= 0) {
    return { message: "Applied days must be greater than 0." };
  }

  // Optional date range
  const validFrom = (formData.get("validFrom") as string)?.trim() || null;
  const validTo = (formData.get("validTo") as string)?.trim() || null;

  if (validFrom && !DATE_KEY.test(validFrom)) {
    return { message: "Please provide a valid 'Valid From' date (YYYY-MM-DD)." };
  }
  if (validTo && !DATE_KEY.test(validTo)) {
    return { message: "Please provide a valid 'Valid To' date (YYYY-MM-DD)." };
  }
  if (validFrom && validTo && validTo < validFrom) {
    return { message: "'Valid To' date cannot be before 'Valid From' date." };
  }

  // Direct approval option if the officer already holds the sanction order
  const isApproved = formData.get("isApproved") === "true";
  const approvedDate = (formData.get("approvedDate") as string)?.trim() || null;
  const approvedBy = (formData.get("approvedBy") as string)?.trim() || null;
  const approvedDaysRaw = formData.get("approvedDays");
  const approvedDays = approvedDaysRaw ? Number(approvedDaysRaw) : null;
  const orderNo = (formData.get("orderNo") as string)?.trim() || null;

  if (isApproved) {
    if (!approvedDate || !DATE_KEY.test(approvedDate)) {
      return { message: "Please provide a valid approval date." };
    }
    if (!approvedBy) {
      return { message: "Please enter the approving authority or office." };
    }
    if (approvedDays === null || approvedDays <= 0) {
      return { message: "Approved days must be greater than 0." };
    }
    if (approvedDays > appliedDays) {
      return {
        message: `Approved days (${approvedDays}) cannot exceed applied days (${appliedDays}).`,
      };
    }
  }

  // Lookup target leave type (SPL or LWP)
  const requestedLeaveTypeId = (formData.get("leaveTypeId") as string)?.trim();
  let targetLeaveType: { id: string; name: string; code: string } | null = null;
  if (requestedLeaveTypeId) {
    const { data: lt } = await supabase
      .from("leave_types")
      .select("id, name, code")
      .eq("id", requestedLeaveTypeId)
      .maybeSingle();
    targetLeaveType = lt;
  }
  if (!targetLeaveType) {
    const { data: splType } = await supabase
      .from("leave_types")
      .select("id, name, code")
      .eq("code", "SPL")
      .is("user_id", null)
      .maybeSingle();
    targetLeaveType = splType;
  }

  if (!targetLeaveType) {
    return { message: "Leave classification not found in system." };
  }

  const [{ data: balance }, { data: existingApps }] = await Promise.all([
    supabase
      .from("leave_balance_view")
      .select("total_available, used")
      .eq("user_id", auth.user.id)
      .eq("leave_type_id", targetLeaveType.id)
      .eq("year", year)
      .maybeSingle(),
    supabase
      .from("special_leave_applications")
      .select("id, leave_type_id, status, applied_days, approved_days, approved_date, expires_at, valid_from, valid_to")
      .eq("user_id", auth.user.id)
      .eq("year", year),
  ]);

  // Filter apps matching this leave type
  const matchingApps = (existingApps ?? []).filter(
    (a) => !a.leave_type_id || a.leave_type_id === targetLeaveType.id,
  );

  const totalAvailable = Number(balance?.total_available ?? 0);
  const usedDays = Number(balance?.used ?? 0);

  // Compute days already logged for existing approved apps
  const approvedAppIds = matchingApps
    .filter((a) => a.status === "APPROVED")
    .map((a) => a.id);

  const appLoggedMap = new Map<string, number>();
  if (approvedAppIds.length > 0) {
    const { data: logs } = await supabase
      .from("leave_logs")
      .select("special_leave_application_id, start_date, end_date, is_half_day")
      .in("special_leave_application_id", approvedAppIds);

    for (const log of logs ?? []) {
      if (log.special_leave_application_id) {
        const days = log.is_half_day
          ? 0.5
          : Math.round(
              (new Date(log.end_date).getTime() -
                new Date(log.start_date).getTime()) /
                (1000 * 60 * 60 * 24),
            ) + 1;
        appLoggedMap.set(
          log.special_leave_application_id,
          (appLoggedMap.get(log.special_leave_application_id) ?? 0) + days,
        );
      }
    }
  }

  const appRecords = matchingApps.map((a) => ({
    leave_type_id: a.leave_type_id,
    status: a.status,
    applied_days: Number(a.applied_days),
    approved_days: a.approved_days ? Number(a.approved_days) : null,
    logged_days: appLoggedMap.get(a.id) ?? 0,
    approved_date: a.approved_date,
    expires_at: a.expires_at,
    valid_from: a.valid_from,
    valid_to: a.valid_to,
  }));

  const committedDays = calculateSpecialLeaveCommittedDays(
    appRecords,
    new Date(),
    targetLeaveType.id,
  );

  // If this is Binpagari Leave (LWP) and no quota is configured, allow application
  const isLwp = targetLeaveType.code?.toUpperCase() === "LWP";
  const availableToApply =
    isLwp && totalAvailable <= 0
      ? 365
      : calculateSpecialLeaveAvailableToApply(
          totalAvailable,
          usedDays,
          committedDays,
        );

  const check = validateSpecialLeaveApplication(appliedDays, availableToApply);
  if (!check.valid) {
    return { message: check.error };
  }

  const expiresAt = isApproved && approvedDate ? computeSpecialLeaveExpiry(approvedDate) : null;

  const { error: insertError } = await supabase
    .from("special_leave_applications")
    .insert({
      user_id: auth.user.id,
      leave_type_id: targetLeaveType.id,
      year,
      applied_date: appliedDate,
      applied_days: appliedDays,
      reason,
      status: isApproved ? "APPROVED" : "PENDING",
      approved_date: isApproved ? approvedDate : null,
      approved_by: isApproved ? approvedBy : null,
      approved_days: isApproved ? approvedDays : null,
      order_no: isApproved ? orderNo : null,
      valid_from: validFrom,
      valid_to: validTo,
      expires_at: expiresAt,
    });

  if (insertError) return { message: insertError.message };

  revalidateLeave();
  return succeeded(
    isApproved
      ? `Approved ${targetLeaveType.name} sanction recorded.`
      : `${targetLeaveType.name} application submitted for approval.`,
  );
}

/**
 * Updates a PENDING Special Leave application to APPROVED with sanction details.
 */
export async function approveSpecialLeave(
  applicationId: string,
  _prevState: LeaveFormState,
  formData: FormData,
): Promise<LeaveFormState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { message: "Not authenticated" };

  const approvedDate = (formData.get("approvedDate") as string)?.trim();
  const approvedBy = (formData.get("approvedBy") as string)?.trim();
  const approvedDays = Number(formData.get("approvedDays"));
  const orderNo = (formData.get("orderNo") as string)?.trim() || null;
  const validFrom = (formData.get("validFrom") as string)?.trim() || null;
  const validTo = (formData.get("validTo") as string)?.trim() || null;

  if (!approvedDate || !DATE_KEY.test(approvedDate)) {
    return { message: "Please provide a valid approval date." };
  }
  if (!approvedBy) {
    return { message: "Please enter the approving authority or office." };
  }
  if (!approvedDays || approvedDays <= 0) {
    return { message: "Approved days must be greater than 0." };
  }
  if (validFrom && !DATE_KEY.test(validFrom)) {
    return { message: "Please provide a valid 'Valid From' date (YYYY-MM-DD)." };
  }
  if (validTo && !DATE_KEY.test(validTo)) {
    return { message: "Please provide a valid 'Valid To' date (YYYY-MM-DD)." };
  }
  if (validFrom && validTo && validTo < validFrom) {
    return { message: "'Valid To' date cannot be before 'Valid From' date." };
  }

  const { data: app } = await supabase
    .from("special_leave_applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();

  if (!app) return { message: "Special Leave application not found." };
  if (app.user_id !== auth.user.id) {
    // Check permission if someone else is approving
    const isSuper = auth.user.role === "SUPER_ADMIN";
    if (!isSuper) return { message: "Permission denied." };
  }

  if (approvedDays > Number(app.applied_days)) {
    return {
      message: `Approved days (${approvedDays}) cannot exceed applied days (${app.applied_days}).`,
    };
  }

  const expiresAt = computeSpecialLeaveExpiry(approvedDate);

  const { error: updateError } = await supabase
    .from("special_leave_applications")
    .update({
      status: "APPROVED",
      approved_date: approvedDate,
      approved_by: approvedBy,
      approved_days: approvedDays,
      order_no: orderNo,
      expires_at: expiresAt,
      valid_from: validFrom !== null ? validFrom : app.valid_from,
      valid_to: validTo !== null ? validTo : app.valid_to,
    })
    .eq("id", applicationId);

  if (updateError) return { message: updateError.message };

  revalidateLeave();
  return succeeded("Special Leave application approved.");
}

/**
 * Edits an existing application or sanction in place.
 *
 * Only the fields the officer can see are writable, and a sanction already
 * partly taken cannot be cut below the days it has committed -- that would
 * leave the ledger with more logged days than were ever approved.
 */
export async function editSpecialLeaveApplication(
  applicationId: string,
  _prevState: LeaveFormState,
  formData: FormData,
): Promise<LeaveFormState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { message: "Not authenticated" };

  const appliedDate = (formData.get("appliedDate") as string)?.trim();
  const appliedDays = Number(formData.get("appliedDays"));
  const reason = (formData.get("reason") as string)?.trim() || null;
  const orderNo = (formData.get("orderNo") as string)?.trim() || null;
  const validFrom = (formData.get("validFrom") as string)?.trim() || null;
  const validTo = (formData.get("validTo") as string)?.trim() || null;
  const approvedDateRaw = (formData.get("approvedDate") as string)?.trim() || null;
  const approvedBy = (formData.get("approvedBy") as string)?.trim() || null;
  const approvedDaysRaw = formData.get("approvedDays");
  const leaveTypeIdRaw = (formData.get("leaveTypeId") as string)?.trim() || null;

  if (!appliedDate || !DATE_KEY.test(appliedDate)) {
    return { message: "Please provide a valid application date." };
  }
  if (!appliedDays || appliedDays <= 0) {
    return { message: "Applied days must be greater than 0." };
  }
  if (validFrom && !DATE_KEY.test(validFrom)) {
    return { message: "Please provide a valid 'Valid From' date (YYYY-MM-DD)." };
  }
  if (validTo && !DATE_KEY.test(validTo)) {
    return { message: "Please provide a valid 'Valid To' date (YYYY-MM-DD)." };
  }
  if (validFrom && validTo && validTo < validFrom) {
    return { message: "'Valid To' date cannot be before 'Valid From' date." };
  }

  const { data: app } = await supabase
    .from("special_leave_applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();

  if (!app) return { message: "Leave sanction not found." };
  if (app.user_id !== auth.user.id && auth.user.role !== "SUPER_ADMIN") {
    return { message: "Permission denied." };
  }
  if (app.status === "CANCELLED" || app.status === "REJECTED") {
    return { message: `A ${String(app.status).toLowerCase()} application cannot be edited.` };
  }

  const isApproved = app.status === "APPROVED";
  const approvedDays = isApproved
    ? Number(approvedDaysRaw ?? app.approved_days ?? 0)
    : null;
  const approvedDate = isApproved ? approvedDateRaw || app.approved_date : null;

  if (isApproved) {
    if (!approvedDate || !DATE_KEY.test(approvedDate)) {
      return { message: "Please provide a valid sanction date." };
    }
    if (!approvedBy) {
      return { message: "Please enter the approving authority or office." };
    }
    if (!approvedDays || approvedDays <= 0) {
      return { message: "Approved days must be greater than 0." };
    }
    if (approvedDays > appliedDays) {
      return {
        message: `Approved days (${approvedDays}) cannot exceed applied days (${appliedDays}).`,
      };
    }

    // Days already logged against this sanction are a floor on its size.
    const { data: attached } = await supabase
      .from("leave_logs")
      .select("start_date, end_date, is_half_day")
      .eq("special_leave_application_id", applicationId);

    const loggedDays = (attached ?? []).reduce(
      (acc, l) =>
        acc +
        (l.is_half_day
          ? 0.5
          : Math.round(
              (new Date(l.end_date).getTime() - new Date(l.start_date).getTime()) /
                (1000 * 60 * 60 * 24),
            ) + 1),
      0,
    );

    if (approvedDays < loggedDays) {
      return {
        message: `Cannot reduce to ${approvedDays} days: ${loggedDays} day${
          loggedDays === 1 ? " is" : "s are"
        } already logged against this sanction.`,
      };
    }
  }

  // Reclassifying between Special and Binpagari is allowed while the sanction
  // is untouched. Once days are logged the leave_logs point at a type of their
  // own, so moving the sanction underneath them would desync the two.
  let nextLeaveTypeId: string = app.leave_type_id;
  if (leaveTypeIdRaw && leaveTypeIdRaw !== app.leave_type_id) {
    const { count: loggedCount } = await supabase
      .from("leave_logs")
      .select("id", { count: "exact", head: true })
      .eq("special_leave_application_id", applicationId);
    if (loggedCount && loggedCount > 0) {
      return {
        message: `Cannot change the leave type: ${loggedCount} leave log${
          loggedCount === 1 ? " is" : "s are"
        } already attached.`,
      };
    }

    const { data: newType } = await supabase
      .from("leave_types")
      .select("id, code, is_system")
      .eq("id", leaveTypeIdRaw)
      .eq("is_active", true)
      .maybeSingle();

    const newCode = newType?.code?.toUpperCase();
    if (!newType || !newType.is_system || (newCode !== "SPL" && newCode !== "LWP")) {
      return { message: "That leave classification does not take sanctions." };
    }
    nextLeaveTypeId = newType.id;
  }

  const { error } = await supabase
    .from("special_leave_applications")
    .update({
      leave_type_id: nextLeaveTypeId,
      applied_date: appliedDate,
      applied_days: appliedDays,
      reason,
      order_no: orderNo,
      valid_from: validFrom,
      valid_to: validTo,
      ...(isApproved
        ? {
            approved_date: approvedDate,
            approved_by: approvedBy,
            approved_days: approvedDays,
            expires_at: computeSpecialLeaveExpiry(approvedDate as string),
          }
        : {}),
    })
    .eq("id", applicationId);

  if (error) return { message: error.message };

  revalidateLeave();
  return succeeded("Leave sanction updated.");
}

/**
 * Removes an application outright. Cancelling keeps the record and releases
 * the quota; deleting is for entries that should never have existed, so it is
 * refused while any leave log still points at it.
 */
export async function deleteSpecialLeaveApplication(
  applicationId: string,
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { success: false, message: "Not authenticated" };

  const { data: app } = await supabase
    .from("special_leave_applications")
    .select("user_id")
    .eq("id", applicationId)
    .maybeSingle();

  if (!app) return { success: false, message: "Application not found." };
  if (app.user_id !== auth.user.id && auth.user.role !== "SUPER_ADMIN") {
    return { success: false, message: "Permission denied." };
  }

  const { count } = await supabase
    .from("leave_logs")
    .select("id", { count: "exact", head: true })
    .eq("special_leave_application_id", applicationId);

  if (count && count > 0) {
    return {
      success: false,
      message: `Cannot delete: ${count} leave log${
        count === 1 ? " is" : "s are"
      } still attached. Delete the leave log${count === 1 ? "" : "s"} first.`,
    };
  }

  const { error } = await supabase
    .from("special_leave_applications")
    .delete()
    .eq("id", applicationId);

  if (error) return { success: false, message: error.message };

  revalidateLeave();
  return { success: true };
}

/**
 * Cancels a Special Leave application if no leave logs are attached to it.
 */
export async function cancelSpecialLeaveApplication(
  applicationId: string,
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { success: false, message: "Not authenticated" };

  const { data: app } = await supabase
    .from("special_leave_applications")
    .select("user_id, status")
    .eq("id", applicationId)
    .maybeSingle();

  if (!app) return { success: false, message: "Application not found." };
  if (app.user_id !== auth.user.id && auth.user.role !== "SUPER_ADMIN") {
    return { success: false, message: "Permission denied." };
  }

  // Check if any leave logs are attached
  const { count } = await supabase
    .from("leave_logs")
    .select("id", { count: "exact", head: true })
    .eq("special_leave_application_id", applicationId);

  if (count && count > 0) {
    return {
      success: false,
      message: `Cannot cancel: ${count} leave log${
        count === 1 ? " is" : "s are"
      } already attached to this application. Delete the leave log${
        count === 1 ? "" : "s"
      } first.`,
    };
  }

  const { error } = await supabase
    .from("special_leave_applications")
    .update({ status: "CANCELLED" })
    .eq("id", applicationId);

  if (error) return { success: false, message: error.message };

  revalidateLeave();
  return { success: true };
}

