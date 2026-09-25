import * as z from "zod";

/**
 * Holidays, official and personal.
 *
 * The official-holiday form had no validation at all — a blank name reached
 * the insert and only the database refused it, as an error boundary. The two
 * personal forms threw a single message ("Give the holiday a name and a
 * date.") with nothing to say which of the two was missing.
 */

const nameField = z
  .string({ error: "Give the holiday a name." })
  .trim()
  .min(1, { error: "Give the holiday a name." })
  .min(2, { error: "A name needs at least 2 characters." })
  .max(120, { error: "That name is too long." });

const dateField = z
  .string({ error: "Choose a date." })
  .min(1, { error: "Choose a date." })
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Choose a valid date." });

export const holidaySchema = z.object({
  name: nameField,
  holidayDate: dateField,
  isOptional: z.boolean().default(false),
});

export const officialHolidaySchema = z
  .object({
    name: nameField,
    holidayDate: dateField,
    scope: z.enum(["GLOBAL", "PROFILE"], { error: "Choose who this applies to." }),
    profileId: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null)),
    isGovernment: z.boolean().default(false),
    isOptional: z.boolean().default(false),
    isRecurringYearly: z.boolean().default(false),
  })
  // A profile-scoped holiday without a profile would be saved as applying to
  // nobody — silently, since profile_id is nullable.
  .refine((d) => d.scope !== "PROFILE" || d.profileId !== null, {
    error: "Choose the profile this holiday applies to.",
    path: ["profileId"],
  });

export const updateHolidaySchema = holidaySchema.extend({
  id: z.uuid({ error: "That holiday no longer exists." }),
});

export const updateOfficialHolidaySchema = officialHolidaySchema.extend({
  id: z.uuid({ error: "That holiday no longer exists." }),
});

export function holidayValuesFromForm(formData: FormData) {
  return {
    name: formData.get("name") ?? "",
    holidayDate: formData.get("holidayDate") ?? "",
    isOptional:
      formData.get("isOptional") === "on" ||
      formData.get("isOptional") === "true",
  };
}

export function officialHolidayValuesFromForm(formData: FormData) {
  return {
    name: formData.get("name") ?? "",
    holidayDate: formData.get("holidayDate") ?? "",
    scope: formData.get("scope") ?? "GLOBAL",
    profileId: (formData.get("profileId") as string) || undefined,
    isGovernment: formData.get("isGovernment") === "on" || formData.get("isGovernment") === "true",
    isOptional: formData.get("isOptional") === "on" || formData.get("isOptional") === "true",
    isRecurringYearly: formData.get("isRecurringYearly") === "on" || formData.get("isRecurringYearly") === "true",
  };
}

export function updateHolidayValuesFromForm(formData: FormData) {
  return {
    id: formData.get("id") ?? "",
    name: formData.get("name") ?? "",
    holidayDate: formData.get("holidayDate") ?? "",
    isOptional:
      formData.get("isOptional") === "on" ||
      formData.get("isOptional") === "true",
  };
}

export function updateOfficialHolidayValuesFromForm(formData: FormData) {
  return {
    id: formData.get("id") ?? "",
    name: formData.get("name") ?? "",
    holidayDate: formData.get("holidayDate") ?? "",
    scope: formData.get("scope") ?? "GLOBAL",
    profileId: (formData.get("profileId") as string) || undefined,
    isGovernment: formData.get("isGovernment") === "on" || formData.get("isGovernment") === "true",
    isOptional: formData.get("isOptional") === "on" || formData.get("isOptional") === "true",
    isRecurringYearly: formData.get("isRecurringYearly") === "on" || formData.get("isRecurringYearly") === "true",
  };
}
