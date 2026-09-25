"use server";

import { revalidatePath } from "next/cache";
import {
  updateOwnProfileSchema,
  userSettingsSchema,
  ownProfileValuesFromForm,
  userSettingsValuesFromForm,
} from "@/lib/validations/settings";
import {
  fieldErrors,
  failed,
  invalid,
  succeeded,
  type FormState,
} from "@/lib/forms/formState";
import { createClient } from "@/lib/supabase/server";
import type { TimeFormat } from "@/types/database";

/**
 * Both go through update_own_profile_info(), the security-definer RPC that
 * whitelists exactly which columns a user may change about themselves —
 * role and status are structurally unreachable from here.
 */
export async function updateTimeFormat(timeFormat: TimeFormat) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_own_profile_info", {
    p_full_name: null,
    p_phone: null,
    p_department_id: null,
    p_time_format: timeFormat,
  });
  if (error) throw error;

  // The preference affects rendering on essentially every screen.
  revalidatePath("/", "layout");
}

export async function updateOwnProfile(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = updateOwnProfileSchema.safeParse(ownProfileValuesFromForm(formData));
  if (!parsed.success) return invalid(fieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_own_profile_info", {
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone,
    p_department_id: parsed.data.departmentId,
    p_time_format: null,
  });
  if (error) return failed(error.message);

  revalidatePath("/settings");
  return succeeded("Profile updated.");
}

/**
 * The officer's duty defaults. Written as an upsert because no row exists
 * until the first save — reads fall back to the column defaults, so there is
 * nothing to create at signup.
 */
export async function updateUserSettings(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");

  // Previously these values were coerced rather than checked: a negative rate
  // silently became 0 and a malformed time silently became "10:00", so a typo
  // was saved as a plausible wrong value instead of being refused.
  const parsed = userSettingsSchema.safeParse(userSettingsValuesFromForm(formData));
  if (!parsed.success) return invalid(fieldErrors(parsed.error));

  const upsertData: Record<string, unknown> = {
    user_id: auth.user.id,
    holiday_day_rate: parsed.data.holidayDayRate,
    daily_salary_rate: parsed.data.dailySalaryRate ?? 0,
    default_shift_start: parsed.data.defaultShiftStart,
    default_shift_end: parsed.data.defaultShiftEnd,
  };
  if (parsed.data.printRecipientTitle !== undefined) {
    upsertData.print_recipient_title = parsed.data.printRecipientTitle;
  }
  if (parsed.data.printStationName !== undefined) {
    upsertData.print_station_name = parsed.data.printStationName;
  }
  if (parsed.data.printSignatoryName !== undefined) {
    upsertData.print_signatory_name = parsed.data.printSignatoryName;
  }
  if (parsed.data.printDefaultVehicle !== undefined) {
    upsertData.print_default_vehicle = parsed.data.printDefaultVehicle;
  }
  if (parsed.data.printUseGujaratiDigits !== undefined) {
    upsertData.print_use_gujarati_digits = parsed.data.printUseGujaratiDigits;
  }

  const { error } = await supabase.from("user_settings").upsert(
    upsertData as any,
    { onConflict: "user_id" },
  );
  if (error) return failed(error.message);

  revalidatePath("/settings");
  revalidatePath("/duty/new");
  return succeeded("Defaults saved.");
}
