import * as z from "zod";

/**
 * The officer's own profile and duty defaults.
 *
 * Both forms had no schema, no `required` on any field, and no error slot —
 * they accepted anything. The duty-defaults action quietly coerced bad input
 * instead: a negative rate became 0 and a malformed time became "10:00", so a
 * typo was saved as a plausible-looking wrong value rather than refused.
 */

const TIME_HHMM = /^\d{2}:\d{2}$/;

export const updateOwnProfileSchema = z.object({
  fullName: z
    .string({ error: "Enter your name." })
    .trim()
    .min(2, { error: "A name needs at least 2 characters." })
    .max(80, { error: "That name is too long." }),
  phone: z
    .string()
    .trim()
    .max(20, { error: "That phone number is too long." })
    .refine((v) => v === "" || /^[\d+\-() ]{6,}$/.test(v), {
      error: "Enter a valid phone number.",
    })
    .optional()
    .transform((v) => (v ? v : null)),
  departmentId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || z.uuid().safeParse(v).success, {
      error: "Choose a valid department.",
    }),
});

export const userSettingsSchema = z
  .object({
    holidayDayRate: z
      .number({ error: "Enter an amount." })
      .min(0, { error: "A rate cannot be negative." })
      .max(1_000_000, { error: "That rate looks wrong." }),
    dailySalaryRate: z
      .number({ error: "Enter an amount." })
      .min(0, { error: "A salary rate cannot be negative." })
      .max(1_000_000, { error: "That rate looks wrong." })
      .optional(),
    defaultShiftStart: z
      .string({ error: "Enter a start time." })
      .regex(TIME_HHMM, { error: "Use a 24-hour time such as 10:00." }),
    defaultShiftEnd: z
      .string({ error: "Enter an end time." })
      .regex(TIME_HHMM, { error: "Use a 24-hour time such as 18:00." }),
    printRecipientTitle: z.string().trim().optional(),
    printStationName: z.string().trim().optional(),
    printSignatoryName: z.string().trim().optional(),
    printDefaultVehicle: z.enum(["private", "government"]).optional(),
    printUseGujaratiDigits: z.boolean().optional(),
  })
  // Equal times are allowed: that is a shift running right round to the next
  // day, which `deriveDutyEnd` and `splitIntoDailyDuties` both handle.
  .refine((d) => d.defaultShiftStart !== "" && d.defaultShiftEnd !== "", {
    error: "Both shift times are needed.",
    path: ["defaultShiftEnd"],
  });

export function ownProfileValuesFromForm(formData: FormData) {
  return {
    fullName: formData.get("fullName") ?? "",
    phone: (formData.get("phone") as string) || undefined,
    departmentId: (formData.get("departmentId") as string) || undefined,
  };
}

export function userSettingsValuesFromForm(formData: FormData) {
  const rate = formData.get("holidayDayRate");
  const dailyRate = formData.get("dailySalaryRate");
  const rawUseGuj = formData.get("printUseGujaratiDigits");
  return {
    // A blank rate means "not set", which is 0 — but anything else that is
    // not a number must fail rather than silently become 0.
    holidayDayRate: rate === null || String(rate).trim() === "" ? 0 : Number(rate),
    dailySalaryRate: dailyRate === null || String(dailyRate).trim() === "" ? 0 : Number(dailyRate),
    defaultShiftStart: String(formData.get("defaultShiftStart") ?? "").trim(),
    defaultShiftEnd: String(formData.get("defaultShiftEnd") ?? "").trim(),
    printRecipientTitle: formData.has("printRecipientTitle")
      ? String(formData.get("printRecipientTitle") ?? "").trim()
      : undefined,
    printStationName: formData.has("printStationName")
      ? String(formData.get("printStationName") ?? "").trim()
      : undefined,
    printSignatoryName: formData.has("printSignatoryName")
      ? String(formData.get("printSignatoryName") ?? "").trim()
      : undefined,
    printDefaultVehicle: (formData.get("printDefaultVehicle") as "private" | "government") || undefined,
    printUseGujaratiDigits: formData.has("printUseGujaratiDigits")
      ? rawUseGuj === "true" || rawUseGuj === "on" || rawUseGuj === "1"
      : undefined,
  };
}
