import * as z from "zod";

/**
 * Profiles and departments.
 *
 * These actions previously read `formData.get(...) as string` and inserted the
 * result, so a blank name reached the database and a missing code hit
 * `code.toUpperCase()` on undefined. There was no validation of any kind, and
 * no slot to report one in.
 */

/** Shared: a code is stored upper-case with spaces collapsed to underscores. */
export const codeField = z
  .string({ error: "Enter a code." })
  .trim()
  .min(2, { error: "A code needs at least 2 characters." })
  .max(30, { error: "That code is too long." })
  .regex(/^[A-Za-z0-9 _-]+$/, {
    error: "Use letters, numbers, spaces, hyphens or underscores only.",
  })
  .transform((v) => v.toUpperCase().replace(/\s+/g, "_"));

const nameField = z
  .string({ error: "Enter a name." })
  .trim()
  .min(2, { error: "A name needs at least 2 characters." })
  .max(80, { error: "That name is too long." });

export const createProfileSchema = z.object({
  name: nameField,
  code: codeField,
  description: z
    .string()
    .trim()
    .max(300, { error: "Keep the description under 300 characters." })
    .optional()
    .transform((v) => (v ? v : null)),
});

export const createDepartmentSchema = z.object({
  name: nameField,
  code: codeField,
});

export const createDutyTypeSchema = z.object({
  name: nameField,
  code: codeField,
  // Required: `duty_types.profile_id` is NOT NULL, so a type must belong to a
  // profile. The form always asked for one; nothing enforced it.
  profileId: z.uuid({ error: "Choose the profile this duty type belongs to." }),
});

export const updateDutyTypeSchema = z.object({
  name: nameField,
  code: codeField,
  profileId: z.uuid({ error: "Choose the profile this duty type belongs to." }),
});

export function profileValuesFromForm(formData: FormData) {
  return {
    name: formData.get("name") ?? "",
    code: formData.get("code") ?? "",
    description: (formData.get("description") as string) || undefined,
  };
}

export function departmentValuesFromForm(formData: FormData) {
  return {
    name: formData.get("name") ?? "",
    code: formData.get("code") ?? "",
  };
}

export function dutyTypeValuesFromForm(formData: FormData) {
  return {
    name: formData.get("name") ?? "",
    code: formData.get("code") ?? "",
    profileId: (formData.get("profileId") as string) || "",
  };
}
