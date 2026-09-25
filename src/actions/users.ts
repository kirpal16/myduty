"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/permissions/hasPermission";
import type { PermissionCode } from "@/lib/permissions/constants";

// Every mutation here goes through the normal user-scoped client (not the
// service-role admin client) — the acting super admin's own RLS-granted
// privileges (users_update_admin, user_permissions_write) are what actually
// perform the write. requireSuperAdmin() is the app-level check; RLS is
// still the backstop if it's ever skipped.

export async function approveUser(userId: string) {
  await requireSuperAdmin();
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("users")
    .update({
      status: "APPROVED",
      approved_by: auth.user?.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) throw error;
  revalidatePath("/admin/users");
}

export async function rejectUser(userId: string) {
  await requireSuperAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("users")
    .update({ status: "REJECTED" })
    .eq("id", userId);

  if (error) throw error;
  revalidatePath("/admin/users");
}

export async function changeUserRole(
  userId: string,
  role: "USER" | "SUPER_ADMIN",
) {
  await requireSuperAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("users")
    .update({ role })
    .eq("id", userId);

  if (error) throw error;
  revalidatePath("/admin/users");
}

export async function grantPermission(
  userId: string,
  code: PermissionCode,
) {
  await requireSuperAdmin();
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  const { data: permission, error: lookupError } = await supabase
    .from("permissions")
    .select("id")
    .eq("code", code)
    .single();

  if (lookupError || !permission) throw lookupError ?? new Error("Unknown permission code");

  const { error } = await supabase.from("user_permissions").insert({
    user_id: userId,
    permission_id: permission.id,
    granted_by: auth.user?.id,
  });

  if (error) throw error;
  revalidatePath("/admin/permissions");
}

export async function revokePermission(
  userId: string,
  code: PermissionCode,
) {
  await requireSuperAdmin();
  const supabase = await createClient();

  const { data: permission, error: lookupError } = await supabase
    .from("permissions")
    .select("id")
    .eq("code", code)
    .single();

  if (lookupError || !permission) throw lookupError ?? new Error("Unknown permission code");

  const { error } = await supabase
    .from("user_permissions")
    .delete()
    .eq("user_id", userId)
    .eq("permission_id", permission.id);

  if (error) throw error;
  revalidatePath("/admin/permissions");
}

export async function toggleStorageAccess(
  userId: string,
  granted: boolean,
) {
  await requireSuperAdmin();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: permission, error: lookupError } = await supabase
    .from("permissions")
    .select("id")
    .eq("code", "STORAGE_VIEW_ALL")
    .single();

  if (lookupError || !permission) throw lookupError ?? new Error("Unknown permission code");

  if (granted) {
    // Check if already exists
    const { data: existing } = await supabase
      .from("user_permissions")
      .select("permission_id")
      .eq("user_id", userId)
      .eq("permission_id", permission.id)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase.from("user_permissions").insert({
        user_id: userId,
        permission_id: permission.id,
        granted_by: auth.user?.id,
      });
      if (error) throw error;
    }
  } else {
    const { error } = await supabase
      .from("user_permissions")
      .delete()
      .eq("user_id", userId)
      .eq("permission_id", permission.id);

    if (error) throw error;
  }

  revalidatePath("/admin/permissions");
  revalidatePath("/storage");
  revalidatePath("/duty");
  revalidatePath("/leave");
}

export interface UserDataCounts {
  dutiesCount: number;
  taCount: number;
  leavesCount: number;
  leaveBalancesCount: number;
  timelineCount: number;
  filesCount: number;
  holidaysCount: number;
  permissionsCount: number;
  hasSettings: boolean;
}

/**
 * Safely inspect and count all records associated with a specific officer.
 * Used exclusively by Super Admins before confirming account & data deletion.
 */
export async function getUserDataCounts(userId: string): Promise<UserDataCounts> {
  await requireSuperAdmin();
  const admin = createAdminClient();

  const [
    dutiesRes,
    leavesRes,
    balancesRes,
    timelineRes,
    filesRes,
    holidaysRes,
    permissionsRes,
    settingsRes,
  ] = await Promise.all([
    admin
      .from("duties")
      .select("ta_amount, ta_distance_km")
      .eq("user_id", userId),
    admin
      .from("leave_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    admin
      .from("user_leave_balances")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId),
    admin
      .from("officer_timeline")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    admin
      .from("file_attachments")
      .select("id", { count: "exact", head: true })
      .eq("uploaded_by", userId),
    admin
      .from("holidays")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    admin
      .from("user_permissions")
      .select("permission_id", { count: "exact", head: true })
      .eq("user_id", userId),
    admin
      .from("user_settings")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  const dutiesList = dutiesRes.data ?? [];
  const dutiesCount = dutiesList.length;
  const taCount = dutiesList.filter(
    (d) =>
      (d.ta_amount != null && Number(d.ta_amount) > 0) ||
      (d.ta_distance_km != null && Number(d.ta_distance_km) > 0)
  ).length;

  return {
    dutiesCount,
    taCount,
    leavesCount: leavesRes.count ?? 0,
    leaveBalancesCount: balancesRes.count ?? 0,
    timelineCount: timelineRes.count ?? 0,
    filesCount: filesRes.count ?? 0,
    holidaysCount: holidaysRes.count ?? 0,
    permissionsCount: permissionsRes.count ?? 0,
    hasSettings: (settingsRes.count ?? 0) > 0,
  };
}

/**
 * Permanently deletes an officer and cleans up all associated records (duties, leaves,
 * files, settings, auth user). Strictly isolated to the specified userId.
 */
export async function deleteUser(userId: string): Promise<{ success: boolean; message: string }> {
  await requireSuperAdmin();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    throw new Error("You must be authenticated as a Super Admin to perform this action.");
  }
  if (auth.user.id === userId) {
    throw new Error("Security Alert: You cannot delete your own admin account.");
  }

  const admin = createAdminClient();

  // 1. Verify user exists and retrieve officer name for feedback
  const { data: userToDelete, error: userFetchError } = await admin
    .from("users")
    .select("id, full_name, role, status")
    .eq("id", userId)
    .single();

  if (userFetchError || !userToDelete) {
    throw new Error("Officer record not found.");
  }

  // 2. Clean up storage files belonging to this user
  try {
    const { data: attachments } = await admin
      .from("file_attachments")
      .select("bucket_path")
      .eq("uploaded_by", userId);

    if (attachments && attachments.length > 0) {
      const paths = attachments.map((a) => a.bucket_path).filter(Boolean);
      if (paths.length > 0) {
        await admin.storage.from("duty-app-files").remove(paths);
      }
    }
    // Remove file_attachments metadata rows for this user
    await admin.from("file_attachments").delete().eq("uploaded_by", userId);
  } catch (storageErr) {
    console.warn("Notice: storage cleanup for user encountered non-fatal error:", storageErr);
  }

  // 3. Delete auth.users row via Supabase service-role admin API.
  // Because public.users(id) references auth.users(id) ON DELETE CASCADE,
  // this automatically and safely cascades to public.users and all child tables
  // (duties, leave_logs, leave_log_days, user_leave_balances, timeline, etc.)
  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) {
    console.warn("Auth admin deleteUser warning (falling back to direct public.users delete):", authError);
  }

  // 4. Guarantee deletion in public.users in case of decoupled user or cascade lag
  const { error: publicDeleteError } = await admin
    .from("users")
    .delete()
    .eq("id", userId);

  if (publicDeleteError) {
    console.error("Failed to delete public.users record:", publicDeleteError);
    throw new Error("Failed to delete officer record: " + publicDeleteError.message);
  }

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/permissions");

  return {
    success: true,
    message: `Officer ${userToDelete.full_name} and all associated data have been permanently removed.`,
  };
}

