"use server";

import { revalidatePath } from "next/cache";
import {
  holidaySchema,
  officialHolidaySchema,
  updateHolidaySchema,
  updateOfficialHolidaySchema,
  holidayValuesFromForm,
  officialHolidayValuesFromForm,
  updateHolidayValuesFromForm,
  updateOfficialHolidayValuesFromForm,
} from "@/lib/validations/holiday";
import {
  fieldErrors,
  failed,
  invalid,
  succeeded,
  type FormState,
} from "@/lib/forms/formState";
import { createClient } from "@/lib/supabase/server";
import {
  ForbiddenError,
  hasPermission,
  isSuperAdmin,
} from "@/lib/permissions/hasPermission";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { recomputeDutyPayForDates } from "@/lib/duty/recomputeDutyPay";

// GLOBAL/PROFILE holidays: RLS requires HOLIDAY_CREATE/HOLIDAY_DELETE or
// super admin. USER holidays: RLS requires user_id = auth.uid(), no
// permission needed — that's the actual boundary in both cases, these
// actions just relay the form data through it.

export async function createGlobalOrProfileHoliday(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = officialHolidaySchema.safeParse(
    officialHolidayValuesFromForm(formData),
  );
  if (!parsed.success) return invalid(fieldErrors(parsed.error));

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new ForbiddenError("Not authenticated");

  const { error } = await supabase.from("holidays").insert({
    name: parsed.data.name,
    holiday_date: parsed.data.holidayDate,
    scope: parsed.data.scope,
    profile_id: parsed.data.scope === "PROFILE" ? parsed.data.profileId : null,
    is_government: parsed.data.isGovernment,
    is_optional: parsed.data.isOptional,
    is_recurring_yearly: parsed.data.isRecurringYearly,
    created_by: auth.user.id,
  });
  if (error) {
    return failed(
      error.code === "23505"
        ? "A holiday with that name already exists on that date."
        : error.message,
    );
  }

  await recomputeDutyPayForDates(supabase, [parsed.data.holidayDate]);
  revalidatePath("/admin/holidays");
  revalidateHolidays();
  return succeeded("Holiday added.");
}

/**
 * A USER-scope holiday is the officer's own; GLOBAL/PROFILE ones need the
 * HOLIDAY_DELETE grant. RLS enforces both, but the check is repeated here so
 * a forbidden delete fails loudly instead of quietly affecting zero rows.
 */
export async function deleteHoliday(id: string, redirectPath: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new ForbiddenError("Not authenticated");

  const { data: holiday } = await supabase
    .from("holidays")
    .select("id, scope, user_id, holiday_date")
    .eq("id", id)
    .maybeSingle();
  if (!holiday) throw new ForbiddenError("That holiday no longer exists.");

  if (holiday.scope === "USER") {
    if (holiday.user_id !== auth.user.id) {
      throw new ForbiddenError("You can only remove your own holidays.");
    }
  } else if (!(await hasPermission(PERMISSIONS.HOLIDAY_DELETE)) && !(await isSuperAdmin())) {
    throw new ForbiddenError("You cannot remove official holidays.");
  }

  const { error } = await supabase.from("holidays").delete().eq("id", id);
  if (error) throw error;

  await recomputeDutyPayForDates(supabase, [holiday.holiday_date]);
  revalidatePath(redirectPath);
  revalidateHolidays();
}

/**
 * Every screen a holiday change is visible on. Holidays now feed the Holiday
 * Leave allocation as well as the calendar, so a change moves a balance too.
 */
function revalidateHolidays() {
  revalidatePath("/holidays");
  revalidatePath("/calendar");
  revalidatePath("/settings");
  revalidatePath("/leave/balance");
  revalidatePath("/leave/new");
  revalidatePath("/duty/new");
  revalidatePath("/dashboard");
  // Duty pay is recomputed on a holiday change, so the duty screens move too.
  revalidatePath("/duty");
  revalidatePath("/reports");
}

export async function createMyHoliday(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = holidaySchema.safeParse(holidayValuesFromForm(formData));
  // Previously one message for both fields ("Give the holiday a name and a
  // date."), which never said which one was missing.
  if (!parsed.success) return invalid(fieldErrors(parsed.error));

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new ForbiddenError("Not authenticated");

  const { error } = await supabase.from("holidays").insert({
    name: parsed.data.name,
    holiday_date: parsed.data.holidayDate,
    scope: "USER",
    user_id: auth.user.id,
    created_by: auth.user.id,
    is_optional: parsed.data.isOptional,
  });
  // 23505 is the unique index added in 0025 — a duplicate is a no-op, not a crash.
  if (error && error.code !== "23505") return failed(error.message);

  await recomputeDutyPayForDates(supabase, [parsed.data.holidayDate]);
  revalidateHolidays();
  return succeeded("Holiday added.");
}

/**
 * Editing a holiday was impossible before 0025: the table had SELECT, INSERT
 * and DELETE policies and no UPDATE, so an update matched zero rows and
 * reported success. A wrong gazetted date needed a code change to correct.
 */
export async function updateHoliday(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = updateHolidaySchema.safeParse(updateHolidayValuesFromForm(formData));
  if (!parsed.success) return invalid(fieldErrors(parsed.error));
  const { id, name, holidayDate, isOptional } = parsed.data;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new ForbiddenError("Not authenticated");

  const { data: existing } = await supabase
    .from("holidays")
    .select("id, scope, user_id, holiday_date")
    .eq("id", id)
    .maybeSingle();
  if (!existing) throw new ForbiddenError("That holiday no longer exists.");

  // Same split as delete: your own personal day is yours; the official list
  // needs the grant.
  if (existing.scope === "USER") {
    if (existing.user_id !== auth.user.id) {
      throw new ForbiddenError("You can only edit your own holidays.");
    }
  } else if (
    !(await hasPermission(PERMISSIONS.HOLIDAY_CREATE)) &&
    !(await isSuperAdmin())
  ) {
    throw new ForbiddenError("You cannot edit official holidays.");
  }

  const { error } = await supabase
    .from("holidays")
    .update({ name, holiday_date: holidayDate, is_optional: isOptional })
    .eq("id", id);
  if (error) {
    // Returned rather than thrown: this form has an error slot now, and a
    // duplicate name is something the officer fixes by editing the field.
    // The ForbiddenError checks above still throw -- a permission problem is
    // not fixable from the form.
    return failed(
      error.code === "23505"
        ? "A holiday with that name already exists on that date."
        : error.message,
    );
  }

  // Both dates: the one it left and the one it moved to (or became optional on).
  await recomputeDutyPayForDates(supabase, [existing.holiday_date, holidayDate]);
  revalidateHolidays();
  return succeeded("Holiday updated.");
}

export async function updateOfficialHoliday(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = updateOfficialHolidaySchema.safeParse(
    updateOfficialHolidayValuesFromForm(formData),
  );
  if (!parsed.success) return invalid(fieldErrors(parsed.error));
  const { id, name, holidayDate, scope, profileId, isGovernment, isOptional, isRecurringYearly } = parsed.data;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new ForbiddenError("Not authenticated");

  if (!(await hasPermission(PERMISSIONS.HOLIDAY_CREATE)) && !(await isSuperAdmin())) {
    throw new ForbiddenError("You cannot edit official holidays.");
  }

  const { data: before } = await supabase
    .from("holidays")
    .select("holiday_date")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("holidays")
    .update({
      name,
      holiday_date: holidayDate,
      scope,
      profile_id: scope === "PROFILE" ? profileId : null,
      is_government: isGovernment,
      is_optional: isOptional,
      is_recurring_yearly: isRecurringYearly,
    })
    .eq("id", id);

  if (error) {
    return failed(
      error.code === "23505"
        ? "A holiday with that name already exists on that date."
        : error.message,
    );
  }

  await recomputeDutyPayForDates(supabase, [before?.holiday_date, holidayDate]);
  revalidateHolidays();
  return succeeded("Holiday updated.");
}

import {
  GUJARAT_GOVT_HOLIDAYS_CATALOG,
  GUJARAT_GOVT_OPTIONAL_HOLIDAYS_CATALOG,
} from "@/lib/holidays/weekendRules";

export async function importGujaratGovernmentHolidays(year: number, scope: "GLOBAL" | "USER" = "GLOBAL") {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");

  // No fallback to another year: the gazetted dates follow lunar calendars and
  // move annually, so borrowing 2026's list for 2028 would invent holidays that
  // do not exist — and those now feed the Holiday Leave allocation.
  const catalog = GUJARAT_GOVT_HOLIDAYS_CATALOG[year] ?? [];
  if (catalog.length === 0) return { count: 0, alreadyPresent: 0, available: 0 };

  // Every holiday for this year that the officer can already see — at ANY
  // scope, which is the fix for a real duplication bug.
  const { data: existing } = await supabase
    .from("holidays")
    .select("holiday_date, name")
    .gte("holiday_date", `${year}-01-01`)
    .lte("holiday_date", `${year}-12-31`);

  const existingDates = new Set(
    (existing ?? []).map((h) => `${h.holiday_date}_${h.name.toLowerCase().trim()}`),
  );

  const toInsert = catalog
    .filter((h) => !existingDates.has(`${h.date}_${h.name.toLowerCase().trim()}`))
    .map((h) => ({
      name: h.name,
      holiday_date: h.date,
      scope: scope,
      user_id: scope === "USER" ? auth.user!.id : null,
      profile_id: null,
      is_government: true,
      is_optional: false,
      is_recurring_yearly: true,
      created_by: auth.user!.id,
    }));

  if (toInsert.length > 0) {
    const { error } = await supabase.from("holidays").insert(toInsert);
    if (error) throw error;
  }

  revalidateHolidays();

  return {
    count: toInsert.length,
    alreadyPresent: catalog.length - toInsert.length,
    available: catalog.length,
  };
}

export async function importGujaratOptionalHolidays(year: number, scope: "GLOBAL" | "USER" = "GLOBAL") {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");

  const catalog = GUJARAT_GOVT_OPTIONAL_HOLIDAYS_CATALOG[year] ?? [];
  if (catalog.length === 0) return { count: 0, alreadyPresent: 0, available: 0 };

  const { data: existing } = await supabase
    .from("holidays")
    .select("holiday_date, name")
    .gte("holiday_date", `${year}-01-01`)
    .lte("holiday_date", `${year}-12-31`);

  const existingDates = new Set(
    (existing ?? []).map((h) => `${h.holiday_date}_${h.name.toLowerCase().trim()}`),
  );

  const toInsert = catalog
    .filter((h) => !existingDates.has(`${h.date}_${h.name.toLowerCase().trim()}`))
    .map((h) => ({
      name: h.name,
      holiday_date: h.date,
      scope: scope,
      user_id: scope === "USER" ? auth.user!.id : null,
      profile_id: null,
      is_government: true,
      is_optional: true,
      is_recurring_yearly: false,
      created_by: auth.user!.id,
    }));

  if (toInsert.length > 0) {
    const { error } = await supabase.from("holidays").insert(toInsert);
    if (error) throw error;
  }

  revalidateHolidays();

  return {
    count: toInsert.length,
    alreadyPresent: catalog.length - toInsert.length,
    available: catalog.length,
  };
}

/**
 * Delete bound to the settings panel, which passes only the id — the generic
 * deleteHoliday also takes a path to revalidate, which a client component
 * would have to know and duplicate.
 */
export async function deleteMyHoliday(id: string) {
  return deleteHoliday(id, "/settings");
}
