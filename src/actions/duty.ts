"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin, requireOwnership } from "@/lib/permissions/hasPermission";
import { dutySchema, dutyValuesFromForm } from "@/lib/validations/duty";
import {
  createDutyTypeSchema,
  updateDutyTypeSchema,
  dutyTypeValuesFromForm,
} from "@/lib/validations/admin";
import {
  fieldErrors as toFieldErrors,
  failed,
  invalid,
  succeeded,
  type FormState,
} from "@/lib/forms/formState";
import { splitIntoDailyDuties, type DutyDaySlot } from "@/lib/duty/splitDuty";
import { resolveHolidayPay } from "@/lib/duty/holidayPay";
import {
  resolveHoliday,
  type HolidayRecord,
} from "@/lib/holidays/resolveHoliday";
import { getUserSettings } from "@/lib/settings/getUserSettings";
import {
  isHolidayLeaveType,
  holidayLeaveConflictMessage,
  datesInRange,
} from "@/lib/leave/holidayLeaveRules";
import { toDateKey } from "@/lib/format/datetime";
import type { DutyStatus } from "@/types/database";

export type DutyFormState =
  | {
      errors?: Record<string, string[]>;
      message?: string;
    }
  | undefined;

// Postgres exclusion-constraint violation (the overlap-prevention constraint
// on duties) — surfaced as a friendly message instead of a raw DB error.
const EXCLUSION_VIOLATION = "23P01";

/**
 * The `holidays` rows covering a date range. resolveHoliday is pure, so the
 * caller loads them once and classifies every day from that one query rather
 * than hitting the database per day.
 */
async function loadHolidays(
  supabase: Awaited<ReturnType<typeof createClient>>,
  from: Date,
  to: Date,
): Promise<HolidayRecord[]> {
  const { data } = await supabase
    .from("holidays")
    .select("name, holiday_date, scope, is_government, is_optional")
    .gte("holiday_date", toDateKey(from))
    .lte("holiday_date", toDateKey(to));
  return data ?? [];
}

/**
 * A day already taken as Holiday Leave cannot also be worked (R1) — the two
 * branches of a holiday are mutually exclusive, and allowing both would claim
 * the same day as rest and as paid duty.
 *
 * Returns a message naming the clashing date, or null.
 */
async function findHolidayLeaveClash(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  slots: readonly DutyDaySlot[],
): Promise<string | null> {
  const first = slots[0].dateKey;
  const last = slots[slots.length - 1].dateKey;

  // Holiday Leave is either a whole HL entry, or HL days the leave engine
  // carved out of a longer Casual/Special Leave (leave_log_days, 0036).
  const [{ data: logs }, { data: dayRows }] = await Promise.all([
    supabase
      .from("leave_logs")
      .select("start_date, end_date, leave_types(code, is_system)")
      .eq("user_id", userId)
      .lte("start_date", last)
      .gte("end_date", first),
    supabase
      .from("leave_log_days")
      .select("leave_date, leave_types(code, is_system)")
      .eq("user_id", userId)
      .gte("leave_date", first)
      .lte("leave_date", last),
  ]);

  type TypeFlags = { code: string; is_system: boolean } | null;
  const takenDates = new Set<string>();
  for (const log of logs ?? []) {
    if (!isHolidayLeaveType(log.leave_types as unknown as TypeFlags)) continue;
    for (const day of datesInRange(log.start_date, log.end_date)) {
      takenDates.add(day);
    }
  }
  for (const row of dayRows ?? []) {
    if (isHolidayLeaveType(row.leave_types as unknown as TypeFlags)) {
      takenDates.add(row.leave_date);
    }
  }

  const clash = slots.find((s) => takenDates.has(s.dateKey));
  return clash ? holidayLeaveConflictMessage(clash.dateKey) : null;
}

function fieldErrors(error: {
  issues: { path: PropertyKey[]; message: string }[];
}) {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

const CONFLICT_MESSAGE =
  "This overlaps a duty you've already logged for that time.";

import { saveFormAttachment } from "@/lib/storage/uploadAttachment";

/**
 * Self-logging: the officer records the duty they worked. user_id is always
 * the caller — there is no officer picker and no permission gate, because
 * your own log line is inherently yours. RLS enforces the same rule.
 */
/**
 * Self-logging: the officer records the duty they worked. user_id is always
 * the caller — there is no officer picker and no permission gate, because
 * your own log line is inherently yours. RLS enforces the same rule, and the
 * explicit check below means the action does not depend on it.
 *
 * A multi-day entry becomes ONE ROW PER DAY (see splitIntoDailyDuties): the
 * officer means "three 10-18 shifts", not one 56-hour block, and each day
 * needs its own TA and its own holiday classification. The rows share a
 * duty_group_id so the batch stays identifiable, but each is independently
 * editable and deletable afterwards.
 */
export async function createDuty(
  _prevState: DutyFormState,
  formData: FormData,
): Promise<DutyFormState> {
  const validated = dutySchema.safeParse(dutyValuesFromForm(formData));
  if (!validated.success) return { errors: fieldErrors(validated.error) };

  const d = validated.data;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { message: "Not authenticated" };

  const slots = splitIntoDailyDuties(new Date(d.startsAt), new Date(d.endsAt));
  const settings = await getUserSettings();
  const holidays = await loadHolidays(
    supabase,
    slots[0].startsAt,
    slots[slots.length - 1].endsAt,
  );

  // Per-day overrides, keyed by the day they belong to. A day the officer
  // never expanded falls back to the top-level TA fields.
  const clash = await findHolidayLeaveClash(supabase, auth.user.id, slots);
  if (clash) return { message: clash };

  const overrides = new Map((d.perDay ?? []).map((row) => [row.date, row]));
  const groupId = crypto.randomUUID();
  const status: DutyStatus = "SCHEDULED";

  const rows = slots.map((slot: DutyDaySlot) => {
    const o = overrides.get(slot.dateKey);
    // Classification comes from the DATE, never from the payload — otherwise
    // a client could mark a plain Tuesday a holiday and pay itself.
    const resolution = resolveHoliday(slot.startsAt, holidays);
    const pay = resolveHolidayPay({
      resolution,
      status,
      holidayDayRate: settings.holidayDayRate,
      submittedAllowance: o?.holidayAllowance ?? (slots.length === 1 ? d.holidayAllowance : undefined),
      manualClaim: o?.manualHolidayClaim ?? (slots.length === 1 ? d.manualHolidayClaim : false),
    });

    return {
      user_id: auth.user!.id,
      duty_type_id: d.dutyTypeId,
      starts_at: slot.startsAt.toISOString(),
      ends_at: slot.endsAt.toISOString(),
      location: d.location ?? null,
      notes: d.notes ?? null,
      status,
      duty_group_id: groupId,
      ta_from_place: o?.taFromPlace ?? d.taFromPlace ?? null,
      ta_to_place: o?.taToPlace ?? d.taToPlace ?? null,
      ta_distance_km: o?.taDistanceKm ?? d.taDistanceKm ?? null,
      ta_amount: o?.taAmount ?? d.taAmount ?? null,
      ta_vehicle_type: o?.taVehicleType ?? d.taVehicleType ?? "private",
      is_holiday: pay.isHoliday,
      is_holiday_duty: pay.isHolidayDuty,
      manual_holiday_claim: pay.manualHolidayClaim,
      holiday_allowance: pay.holidayAllowance,
      created_by: auth.user!.id,
    };
  });

  // One insert, so a collision on any day rolls the whole batch back rather
  // than leaving half a multi-day duty behind.
  const { data: createdDuties, error } = await supabase
    .from("duties")
    .insert(rows)
    .select("id");

  if (error) {
    return {
      message: error.code === EXCLUSION_VIOLATION ? CONFLICT_MESSAGE : error.message,
    };
  }

  // The attachment belongs to the entry as a whole; it hangs off the first day.
  const file = formData.get("file");
  const firstId = createdDuties?.[0]?.id;
  if (file instanceof File && file.size > 0 && firstId) {
    try {
      await saveFormAttachment({
        file,
        relatedEntityType: "duties",
        relatedEntityId: firstId,
        userId: auth.user.id,
      });
    } catch (err: unknown) {
      return { message: (err as Error).message };
    }
  }

  revalidateDuty();
  redirect("/duty");
}

function revalidateDuty(dutyId?: string) {
  revalidatePath("/duty");
  if (dutyId) revalidatePath(`/duty/${dutyId}`);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/storage");
  revalidatePath("/leave");
  revalidatePath("/leave/new");
  revalidatePath("/leave/balance");
}

/**
 * Editing one day of a multi-day entry edits ONLY that day. There is no
 * cascade to its siblings and no re-split: once the batch exists, each row is
 * an independent shift with its own route, amount and classification.
 *
 * The date can move, so the holiday classification is recomputed here too —
 * dragging a duty onto a Sunday earns the allowance, dragging it off loses it.
 */
export async function updateDuty(
  dutyId: string,
  _prevState: DutyFormState,
  formData: FormData,
): Promise<DutyFormState> {
  const validated = dutySchema.safeParse(dutyValuesFromForm(formData));
  if (!validated.success) return { errors: fieldErrors(validated.error) };

  const d = validated.data;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { message: "Not authenticated" };

  // Owner check in the action as well as in RLS: authorization should not
  // depend on a policy staying correct.
  const { data: existing } = await supabase
    .from("duties")
    .select("id, user_id, status")
    .eq("id", dutyId)
    .maybeSingle();
  if (!existing) return { message: "That duty no longer exists." };
  if (existing.user_id !== auth.user.id) {
    return { message: "You can only edit your own duty log." };
  }

  const startsAt = new Date(d.startsAt);
  const endsAt = new Date(d.endsAt);

  // Editing can move the duty onto a day already taken as Holiday Leave, so
  // the same exclusion applies here as on create.
  const clash = await findHolidayLeaveClash(supabase, auth.user.id, [
    { dateKey: toDateKey(startsAt), startsAt, endsAt },
  ]);
  if (clash) return { message: clash };

  const settings = await getUserSettings();
  const holidays = await loadHolidays(supabase, startsAt, endsAt);

  const status = existing.status as DutyStatus;
  const resolution = resolveHoliday(startsAt, holidays);
  const pay = resolveHolidayPay({
    resolution,
    status,
    holidayDayRate: settings.holidayDayRate,
    submittedAllowance: d.holidayAllowance,
    manualClaim: d.manualHolidayClaim,
  });

  const { error } = await supabase
    .from("duties")
    .update({
      duty_type_id: d.dutyTypeId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      location: d.location ?? null,
      notes: d.notes ?? null,
      ta_from_place: d.taFromPlace ?? null,
      ta_to_place: d.taToPlace ?? null,
      ta_distance_km: d.taDistanceKm ?? null,
      ta_amount: d.taAmount ?? null,
      ta_vehicle_type: d.taVehicleType ?? "private",
      is_holiday: pay.isHoliday,
      is_holiday_duty: pay.isHolidayDuty,
      manual_holiday_claim: pay.manualHolidayClaim,
      holiday_allowance: pay.holidayAllowance,
    })
    .eq("id", dutyId);

  if (error) {
    return {
      message: error.code === EXCLUSION_VIOLATION ? CONFLICT_MESSAGE : error.message,
    };
  }

  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    try {
      await saveFormAttachment({
        file,
        relatedEntityType: "duties",
        relatedEntityId: dutyId,
        userId: auth.user.id,
      });
    } catch (err: unknown) {
      return { message: (err as Error).message };
    }
  }

  revalidateDuty(dutyId);
  redirect(`/duty/${dutyId}`);
}

/**
 * Cancelling is not deleting: the entry stays on the record, but the officer
 * did not work it, so the holiday flag and the allowance are cleared (R1).
 * A DB check constraint enforces the same invariant.
 */
export async function setDutyStatus(dutyId: string, status: DutyStatus) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");

  const { data: existing } = await supabase
    .from("duties")
    .select("id, user_id, starts_at, ends_at, holiday_allowance")
    .eq("id", dutyId)
    .maybeSingle();
  if (!existing) throw new Error("That duty no longer exists.");
  if (existing.user_id !== auth.user.id) {
    throw new Error("You can only change your own duty log.");
  }

  const settings = await getUserSettings();
  const startsAt = new Date(existing.starts_at);
  const holidays = await loadHolidays(supabase, startsAt, new Date(existing.ends_at));
  const pay = resolveHolidayPay({
    resolution: resolveHoliday(startsAt, holidays),
    status,
    holidayDayRate: settings.holidayDayRate,
    // Cancelling zeroes the allowance, so a re-instated duty has nothing to
    // restore and falls back to the officer's configured rate.
    submittedAllowance: Number(existing.holiday_allowance) || undefined,
  });

  const { error } = await supabase
    .from("duties")
    .update({
      status,
      is_holiday: pay.isHoliday,
      is_holiday_duty: pay.isHolidayDuty,
      holiday_allowance: pay.holidayAllowance,
    })
    .eq("id", dutyId);
  if (error) throw error;

  revalidateDuty(dutyId);
}

/**
 * Deletes one row only. A day of a multi-day entry is an independent shift
 * (R3), so removing it leaves its siblings alone.
 *
 * No redirect: this is called from the calendar and the day modal as well as
 * the detail page, and a redirect thrown from here surfaced inside the
 * caller's try/catch and raced its router.refresh() — deleting several rows
 * quickly crashed the page. The detail page navigates away itself.
 */
export async function deleteDuty(dutyId: string) {
  await requireOwnership("duties", dutyId);
  const supabase = await createClient();
  const { error } = await supabase.from("duties").delete().eq("id", dutyId);
  if (error) throw error;

  revalidateDuty();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BULK_DELETE = 200;

/**
 * Deletes several of the caller's own duties in one statement.
 *
 * Scoped to `user_id` explicitly as well as by RLS, so an id belonging to
 * someone else is skipped rather than deleted. Returns how many rows went,
 * which the caller reports.
 */
export async function deleteDuties(ids: string[]): Promise<{ deleted: number }> {
  const unique = [...new Set(Array.isArray(ids) ? ids : [])].filter(
    (id): id is string => typeof id === "string" && UUID_RE.test(id),
  );
  if (unique.length === 0) return { deleted: 0 };
  if (unique.length > MAX_BULK_DELETE) {
    throw new Error(`Select at most ${MAX_BULK_DELETE} duties at a time.`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("duties")
    .delete()
    .in("id", unique)
    .eq("user_id", user.id)
    .select("id");
  if (error) throw error;

  revalidateDuty();
  return { deleted: data?.length ?? 0 };
}

export async function createDutyType(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSuperAdmin();

  const parsed = createDutyTypeSchema.safeParse(dutyTypeValuesFromForm(formData));
  if (!parsed.success) return invalid(toFieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.from("duty_types").insert({
    profile_id: parsed.data.profileId,
    name: parsed.data.name,
    code: parsed.data.code,
  });
  if (error) {
    return failed(
      error.code === "23505"
        ? "A duty type with that code already exists for this profile."
        : error.message,
    );
  }

  revalidatePath("/admin/duty-types");
  return succeeded("Duty type created.");
}

export async function toggleDutyTypeActive(id: string, isActive: boolean) {
  await requireSuperAdmin();

  const supabase = await createClient();
  const { error } = await supabase
    .from("duty_types")
    .update({ is_active: !isActive })
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/admin/duty-types");
}

export async function updateDutyType(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSuperAdmin();

  const parsed = updateDutyTypeSchema.safeParse(dutyTypeValuesFromForm(formData));
  if (!parsed.success) return invalid(toFieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase
    .from("duty_types")
    .update({
      profile_id: parsed.data.profileId,
      name: parsed.data.name,
      code: parsed.data.code,
    })
    .eq("id", id);

  if (error) {
    return failed(
      error.code === "23505"
        ? "A duty type with that code already exists for this profile."
        : error.message,
    );
  }

  revalidatePath("/admin/duty-types");
  return succeeded("Duty type updated.");
}

export async function deleteDutyType(
  id: string,
): Promise<{ success: boolean; error?: string; message?: string }> {
  await requireSuperAdmin();

  const supabase = await createClient();

  // Check if any duty records reference this duty type
  const { count, error: countError } = await supabase
    .from("duties")
    .select("id", { count: "exact", head: true })
    .eq("duty_type_id", id);

  if (countError) {
    return { success: false, error: countError.message };
  }

  if (count && count > 0) {
    return {
      success: false,
      error: `Cannot delete: this duty type is currently used in ${count} logged duty record${count > 1 ? "s" : ""}. You can deactivate it instead.`,
    };
  }

  const { error: deleteError } = await supabase
    .from("duty_types")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return { success: false, error: deleteError.message };
  }

  revalidatePath("/admin/duty-types");
  return { success: true, message: "Duty type deleted successfully." };
}

