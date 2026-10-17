import * as z from "zod";

/**
 * Per-day overrides for a multi-day entry.
 *
 * A three-day duty is three separate shifts, and TA genuinely differs for each
 * one — different route, different distance, different amount — so each day
 * carries its own values rather than inheriting a single set from the parent.
 */
export const dutyDaySchema = z.object({
  /** Local calendar day, "YYYY-MM-DD". Identifies which slot this row edits. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Bad day key." }),
  dutyTypeId: z.uuid().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  location: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  taFromPlace: z.string().trim().optional(),
  taToPlace: z.string().trim().optional(),
  taVehicleType: z.string().trim().optional(),
  taDistanceKm: z
    .number({ error: "Distance must be a number." })
    .min(0, { error: "Distance can't be negative." })
    .optional(),
  taAmount: z
    .number({ error: "Amount must be a number." })
    .min(0, { error: "Amount can't be negative." })
    .optional(),
  holidayAllowance: z
    .number({ error: "Holiday allowance must be a number." })
    .min(0, { error: "Allowance can't be negative." })
    .optional(),
  /**
   * Claiming holiday pay on a day the calendar does NOT classify as a holiday.
   * Whether the day IS a holiday is never accepted from the client — the
   * server derives that from the date (see R1 / resolveHoliday).
   */
  manualHolidayClaim: z.boolean().optional(),
});

export const additionalShiftSchema = z
  .object({
    id: z.uuid().optional(),
    dutyTypeId: z.uuid({ error: "Select a duty type." }),
    startsAt: z.iso.datetime({ error: "Enter a start time.", local: true }),
    endsAt: z.iso.datetime({ error: "Enter an end time.", local: true }),
    location: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    taFromPlace: z.string().trim().optional(),
    taToPlace: z.string().trim().optional(),
    taVehicleType: z.string().trim().optional(),
    taDistanceKm: z
      .number({ error: "Distance must be a number." })
      .min(0, { error: "Distance can't be negative." })
      .optional(),
    taAmount: z
      .number({ error: "Amount must be a number." })
      .min(0, { error: "Amount can't be negative." })
      .optional(),
    holidayAllowance: z
      .number({ error: "Holiday allowance must be a number." })
      .min(0, { error: "Allowance can't be negative." })
      .optional(),
    manualHolidayClaim: z.boolean().optional(),
  })
  .refine((data) => new Date(data.endsAt) > new Date(data.startsAt), {
    error: "End time must be after start time.",
    path: ["endsAt"],
  });

export type AdditionalShiftInput = z.infer<typeof additionalShiftSchema>;

export const dutySchema = z
  .object({
    dutyTypeId: z.uuid({ error: "Select a duty type." }),
    startsAt: z.iso.datetime({ error: "Enter a start time.", local: true }),
    endsAt: z.iso.datetime({ error: "Enter an end time.", local: true }),
    location: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    // TA (Travelling Allowance) — the single-day path, and the values a
    // multi-day entry pre-fills every day with.
    taFromPlace: z.string().trim().optional(),
    taToPlace: z.string().trim().optional(),
    taVehicleType: z.string().trim().optional(),
    taDistanceKm: z
      .number({ error: "Distance must be a number." })
      .min(0, { error: "Distance can't be negative." })
      .optional(),
    taAmount: z
      .number({ error: "Amount must be a number." })
      .min(0, { error: "Amount can't be negative." })
      .optional(),
    // Holiday Duty Extra Payment / Allowance (રજાના દિવસનું વધારાનું ભથ્થું).
    // Note there is deliberately NO `isHolidayDuty` field: that is derived
    // from the date on the server and must not be assertable by the client.
    holidayAllowance: z
      .number({ error: "Holiday allowance must be a number." })
      .min(0, { error: "Allowance can't be negative." })
      .optional(),
    manualHolidayClaim: z.boolean().optional(),
    /** Present only when the entry spans more than one calendar day. */
    perDay: z.array(dutyDaySchema).optional(),
    /** Additional non-overlapping shifts logged for the same operational session. */
    additionalShifts: z.array(additionalShiftSchema).optional(),
  })
  .refine((data) => new Date(data.endsAt) > new Date(data.startsAt), {
    error: "End time must be after start time.",
    path: ["endsAt"],
  });

export type DutyInput = z.infer<typeof dutySchema>;
export type DutyDayInput = z.infer<typeof dutyDaySchema>;

/**
 * A duty form's values, shaped for `dutySchema`.
 *
 * Lives beside the schema rather than inside the server action because the
 * CLIENT needs it too: re-validating a field on blur has to build exactly the
 * same object the server will, or the two disagree about what is valid and
 * the officer is told one thing and then another.
 */
const num = (v: FormDataEntryValue | null) =>
  v === null || v === "" ? undefined : Number(v);

const checked = (v: FormDataEntryValue | null) => v === "on" || v === "true";

/**
 * A multi-day entry posts one set of TA fields per day, named
 * `perDay.<YYYY-MM-DD>.<field>`. Days the officer never touched simply carry
 * the values the form pre-filled them with.
 */
function parsePerDay(formData: FormData) {
  const byDate = new Map<string, Record<string, unknown>>();

  for (const [key, value] of formData.entries()) {
    const m = /^perDay\.(\d{4}-\d{2}-\d{2})\.(\w+)$/.exec(key);
    if (!m) continue;
    const [, date, field] = m;
    const row = byDate.get(date) ?? { date };
    switch (field) {
      case "taDistanceKm":
      case "taAmount":
      case "holidayAllowance":
        row[field] = num(value);
        break;
      case "manualHolidayClaim":
        row[field] = checked(value);
        break;
      default:
        row[field] = value === "" ? undefined : value;
    }
    byDate.set(date, row);
  }

  return byDate.size > 0 ? [...byDate.values()] : undefined;
}

/**
 * Additional shifts for split duty days (e.g. morning + evening) post fields named
 * `shifts.<index>.<field>`.
 */
function parseAdditionalShifts(formData: FormData) {
  const byIndex = new Map<number, Record<string, unknown>>();

  for (const [key, value] of formData.entries()) {
    const m = /^shifts\.(\d+)\.(\w+)$/.exec(key);
    if (!m) continue;
    const [, indexStr, field] = m;
    const index = parseInt(indexStr, 10);
    const row = byIndex.get(index) ?? {};
    switch (field) {
      case "taDistanceKm":
      case "taAmount":
      case "holidayAllowance":
        row[field] = num(value);
        break;
      case "manualHolidayClaim":
        row[field] = checked(value);
        break;
      default:
        row[field] = value === "" ? undefined : value;
    }
    byIndex.set(index, row);
  }

  if (byIndex.size === 0) return undefined;
  return [...byIndex.entries()].sort(([a], [b]) => a - b).map(([, r]) => r);
}

export function dutyValuesFromForm(formData: FormData) {
  return {
    dutyTypeId: formData.get("dutyTypeId"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    location: formData.get("location") || undefined,
    notes: formData.get("notes") || undefined,
    taFromPlace: formData.get("taFromPlace") || undefined,
    taToPlace: formData.get("taToPlace") || undefined,
    taVehicleType: formData.get("taVehicleType") || undefined,
    taDistanceKm: num(formData.get("taDistanceKm")),
    taAmount: num(formData.get("taAmount")),
    holidayAllowance: num(formData.get("holidayAllowance")),
    manualHolidayClaim: checked(formData.get("manualHolidayClaim")),
    perDay: parsePerDay(formData),
    additionalShifts: parseAdditionalShifts(formData),
  };
}
