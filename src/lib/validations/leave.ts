import * as z from "zod";
import { isYearInWindow } from "@/lib/format/year";

export const applyLeaveSchema = z
  .object({
    leaveTypeId: z.uuid({ error: "Select a leave type." }),
    startDate: z.iso.date({ error: "Enter a start date." }),
    endDate: z.iso.date({ error: "Enter an end date." }),
    isHalfDay: z.boolean(),
    halfDaySession: z.enum(["AM", "PM"]).optional(),
    reason: z.string().trim().optional(),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    error: "End date must be on or after start date.",
    path: ["endDate"],
  })
  .refine((data) => !data.isHalfDay || data.startDate === data.endDate, {
    error: "A half-day request must be a single date.",
    path: ["endDate"],
  })
  .refine((data) => !data.isHalfDay || !!data.halfDaySession, {
    error: "Select AM or PM for a half-day request.",
    path: ["halfDaySession"],
  });

export type ApplyLeaveInput = z.infer<typeof applyLeaveSchema>;

/**
 * Setting an officer's allowance, and their carry-forward rule with it.
 *
 * This path had no validation at all: `year` and `allocated` were read with a
 * bare `Number(...)`, so a missing field became NaN and went straight to the
 * database. A leave allowance is the number an officer plans their year
 * around — it deserves the same checking as a leave request.
 */
export const setAllowanceSchema = z
  .object({
    userId: z.uuid({ error: "Missing officer." }),
    leaveTypeId: z.uuid({ error: "Missing leave type." }),
    // Bounded to the years leave_balance_view actually produces, so a
    // hand-posted year cannot write a row no screen will ever show. The
    // comment used to claim this while the code allowed 2000-2100.
    year: z
      .number({ error: "Enter a year." })
      .int({ error: "Year must be a whole number." })
      .refine((y) => isYearInWindow(y), {
        error: "That year is outside the range this app keeps balances for.",
      }),
    allocated: z
      .number({ error: "Enter a number of days." })
      .min(0, { error: "Days cannot be negative." })
      .max(1000, { error: "That is more days than a year holds." }),
    carryForward: z.boolean(),
    /**
     * Blank means "no ceiling" — NOT "cap at the annual allocation" — so it
     * has to survive as null rather than collapsing to 0.
     */
    maxAccumulated: z
      .number({ error: "Enter a maximum, or leave it blank." })
      .min(0, { error: "The maximum cannot be negative." })
      .max(10000, { error: "That maximum looks wrong." })
      .nullable(),
    /** Null = use the computed carry. 0 = a deliberate "nothing carried". */
    carriedOverride: z
      .number({ error: "Enter a number of days, or leave it blank." })
      .min(0, { error: "Carried days cannot be negative." })
      .max(10000, { error: "That looks wrong." })
      .nullable(),
  })
  .refine((d) => !d.carryForward || d.maxAccumulated === null || d.maxAccumulated >= 0, {
    error: "The maximum accumulated balance cannot be negative.",
    path: ["maxAccumulated"],
  });

export type SetAllowanceInput = z.infer<typeof setAllowanceSchema>;

/**
 * A leave type, global or personal.
 *
 * These four actions read `(formData.get("name") as string).trim()` and threw
 * on a blank one — which meant the whole page was replaced by an error screen
 * because a name was missing.
 */
export const leaveTypeSchema = z.object({
  name: z
    .string({ error: "Give the leave type a name." })
    .trim()
    .min(2, { error: "A name needs at least 2 characters." })
    .max(60, { error: "That name is too long." }),
  code: z
    .string()
    .trim()
    .max(30, { error: "That code is too long." })
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, { error: "Choose a colour." })
    .optional(),
});

export function leaveTypeValuesFromForm(formData: FormData) {
  return {
    name: formData.get("name") ?? "",
    code: (formData.get("code") as string) || undefined,
    color: (formData.get("color") as string) || undefined,
  };
}

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The officer's per-day changes to a leave's breakdown, posted as hidden
 * `dayType.<YYYY-MM-DD>` = leave type id fields. Malformed entries are
 * dropped, not trusted — the server re-validates every kept one anyway.
 */
export function dayTypesFromForm(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  let n = 0;
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("dayType.") || typeof value !== "string") continue;
    const date = key.slice("dayType.".length);
    if (!DAY_KEY_RE.test(date) || !UUID_RE.test(value)) continue;
    out[date] = value;
    if (++n >= 366) break;
  }
  return out;
}

export function leaveValuesFromForm(formData: FormData) {
  const isHalfDay = formData.get("isHalfDay") === "on";
  return {
    leaveTypeId: formData.get("leaveTypeId") ?? "",
    startDate: formData.get("startDate") ?? "",
    endDate: (isHalfDay ? formData.get("startDate") : formData.get("endDate")) ?? "",
    isHalfDay,
    halfDaySession: formData.get("halfDaySession") || undefined,
    reason: formData.get("reason") || undefined,
  };
}

