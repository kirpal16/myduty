"use server";

import { revalidatePath } from "next/cache";
import {
  createProfileSchema,
  createDepartmentSchema,
  profileValuesFromForm,
  departmentValuesFromForm,
} from "@/lib/validations/admin";
import {
  fieldErrors,
  failed,
  invalid,
  succeeded,
  type FormState,
} from "@/lib/forms/formState";
import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/permissions/hasPermission";

export async function createProfile(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  // Authorisation still throws: a permission failure is not something the
  // officer fixes by editing a field.
  await requireSuperAdmin();

  const parsed = createProfileSchema.safeParse(profileValuesFromForm(formData));
  if (!parsed.success) return invalid(fieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").insert({
    name: parsed.data.name,
    code: parsed.data.code,
    description: parsed.data.description,
  });
  if (error) return failed(duplicateOr(error, "profile", "code"));

  revalidatePath("/admin/profiles");
  return succeeded("Profile created.");
}

export async function toggleProfileActive(id: string, isActive: boolean) {
  await requireSuperAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: !isActive })
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/admin/profiles");
}

export async function createDepartment(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSuperAdmin();

  const parsed = createDepartmentSchema.safeParse(
    departmentValuesFromForm(formData),
  );
  if (!parsed.success) return invalid(fieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.from("departments").insert({
    name: parsed.data.name,
    code: parsed.data.code,
  });
  if (error) return failed(duplicateOr(error, "department", "code"));

  revalidatePath("/admin/departments");
  return succeeded("Department created.");
}

export async function toggleDepartmentActive(id: string, isActive: boolean) {
  await requireSuperAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("departments")
    .update({ is_active: !isActive })
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/admin/departments");
}

/**
 * A friendlier line for the one database error an officer can actually cause.
 *
 * 23505 is a unique violation, which here always means the code is taken.
 * Everything else keeps the raw message: an unexpected failure should not be
 * disguised as a validation problem.
 */
function duplicateOr(
  error: { code?: string; message: string },
  what: string,
  field: string,
): string {
  return error.code === "23505"
    ? `A ${what} with that ${field} already exists.`
    : error.message;
}
