"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  officerProfileDetailsSchema,
  officerTimelineEventSchema,
  createDepartmentSchema,
  officerProfileValuesFromForm,
  timelineValuesFromForm,
} from "@/lib/validations/profile";
import {
  fieldErrors,
  failed,
  invalid,
  succeeded,
  type FormState,
} from "@/lib/forms/formState";

export async function updateOfficerProfileDetails(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = officerProfileDetailsSchema.safeParse(
    officerProfileValuesFromForm(formData)
  );
  if (!parsed.success) return invalid(fieldErrors(parsed.error));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return failed("You must be logged in to update your profile.");

  const {
    fullName,
    phone,
    departmentId,
    designation,
    employeeCode,
    joiningDate,
    joiningPlace,
    currentPosting,
    dateOfBirth,
    bloodGroup,
    emergencyContact,
    homeDistrict,
    bio,
  } = parsed.data;

  const { error: rpcError } = await supabase.rpc("update_own_officer_profile", {
    p_full_name: fullName,
    p_phone: phone,
    p_department_id: departmentId,
    p_designation: designation,
    p_employee_code: employeeCode,
    p_joining_date: joiningDate,
    p_joining_place: joiningPlace,
    p_current_posting: currentPosting,
    p_date_of_birth: dateOfBirth,
    p_blood_group: bloodGroup,
    p_emergency_contact: emergencyContact,
    p_home_district: homeDistrict,
    p_bio: bio,
  });

  if (rpcError) {
    console.error("update_own_officer_profile RPC error:", rpcError);
    const { error: updateError } = await supabase
      .from("users")
      .update({
        full_name: fullName,
        phone,
        department_id: departmentId,
        designation,
        employee_code: employeeCode,
        joining_date: joiningDate,
        joining_place: joiningPlace,
        current_posting: currentPosting,
        date_of_birth: dateOfBirth,
        blood_group: bloodGroup,
        emergency_contact: emergencyContact,
        home_district: homeDistrict,
        bio,
      })
      .eq("id", user.id);

    if (updateError) {
      const { error: fallbackError } = await supabase.rpc(
        "update_own_profile_info",
        {
          p_full_name: fullName,
          p_phone: phone,
          p_department_id: departmentId,
          p_time_format: null,
        }
      );
      if (fallbackError) return failed(fallbackError.message);
    }
  }

  revalidatePath("/settings");
  revalidatePath("/profile");
  return succeeded("Officer profile updated successfully.");
}

export async function createOrGetDepartmentAction(name: string): Promise<{
  success: boolean;
  data?: { id: string; name: string; code: string; is_new: boolean };
  error?: string;
}> {
  const parsed = createDepartmentSchema.safeParse({ name });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid department name",
    };
  }

  const supabase = await createClient();
  const trimmed = parsed.data.name;

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "create_or_get_department",
    { p_name: trimmed }
  );

  if (!rpcError && rpcData) {
    const dept = rpcData as {
      id: string;
      name: string;
      code: string;
      is_new: boolean;
    };
    revalidatePath("/settings");
    revalidatePath("/profile");
    return { success: true, data: dept };
  }

  const { data: existing } = await supabase
    .from("departments")
    .select("id, name, code")
    .ilike("name", trimmed)
    .maybeSingle();

  if (existing) {
    return {
      success: true,
      data: { id: existing.id, name: existing.name, code: existing.code, is_new: false },
    };
  }

  const code =
    trimmed
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 20) || "DEPT";

  const { data: inserted, error: insertError } = await supabase
    .from("departments")
    .insert({ name: trimmed, code, is_active: true })
    .select("id, name, code")
    .single();

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  revalidatePath("/settings");
  revalidatePath("/profile");
  return {
    success: true,
    data: { id: inserted.id, name: inserted.name, code: inserted.code, is_new: true },
  };
}

export async function createTimelineEventAction(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = officerTimelineEventSchema.safeParse(
    timelineValuesFromForm(formData)
  );
  if (!parsed.success) return invalid(fieldErrors(parsed.error));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return failed("You must be logged in to add a milestone.");

  const {
    eventType,
    title,
    designation,
    department,
    location,
    fromLocation,
    toLocation,
    startDate,
    endDate,
    isCurrent,
    description,
  } = parsed.data;

  const { error } = await supabase.from("officer_timeline").insert({
    user_id: user.id,
    event_type: eventType,
    title,
    designation,
    department,
    location,
    from_location: fromLocation,
    to_location: toLocation,
    start_date: startDate,
    end_date: isCurrent ? null : endDate,
    is_current: isCurrent,
    description,
  });

  if (error) return failed(error.message);

  revalidatePath("/settings");
  revalidatePath("/profile");
  return succeeded("Milestone added to career timeline.");
}

export async function updateTimelineEventAction(
  id: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = officerTimelineEventSchema.safeParse(
    timelineValuesFromForm(formData)
  );
  if (!parsed.success) return invalid(fieldErrors(parsed.error));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return failed("You must be logged in to edit this milestone.");

  const {
    eventType,
    title,
    designation,
    department,
    location,
    fromLocation,
    toLocation,
    startDate,
    endDate,
    isCurrent,
    description,
  } = parsed.data;

  const { error } = await supabase
    .from("officer_timeline")
    .update({
      event_type: eventType,
      title,
      designation,
      department,
      location,
      from_location: fromLocation,
      to_location: toLocation,
      start_date: startDate,
      end_date: isCurrent ? null : endDate,
      is_current: isCurrent,
      description,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return failed(error.message);

  revalidatePath("/settings");
  revalidatePath("/profile");
  return succeeded("Timeline milestone updated.");
}

export async function deleteTimelineEventAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("officer_timeline")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/profile");
  return { success: true };
}

export async function updateOfficerAvatarAction(
  avatarUrl: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { error: rpcError } = await supabase.rpc("update_own_avatar", {
    p_avatar_url: avatarUrl,
  });

  if (rpcError) {
    // Direct admin update fallback
    const admin = createAdminClient();
    const { error: updateError } = await admin
      .from("users")
      .update({ avatar_url: avatarUrl })
      .eq("id", user.id);

    if (updateError) {
      console.error("Failed to update avatar:", updateError);
      return { success: false, error: updateError.message };
    }
  }

  revalidatePath("/profile");
  revalidatePath("/settings");
  return { success: true };
}
