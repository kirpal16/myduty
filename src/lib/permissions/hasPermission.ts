import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PermissionCode } from "./constants";

/**
 * The one reusable server-side authorization check, used everywhere instead
 * of scattered `if (role === ...)` branches. Wraps the has_permission()/
 * is_super_admin() SQL functions (supabase/migrations/0002_auth_helpers.sql)
 * — the same functions RLS policies use — so the app-level check and the
 * database-level check are never able to drift apart.
 */
export async function hasPermission(code: PermissionCode): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_permission", {
    perm_code: code,
  });
  if (error) return false;
  return data === true;
}

export async function isSuperAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_super_admin");
  if (error) return false;
  return data === true;
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Throws ForbiddenError if the caller lacks the permission. Callers decide
 * how to handle that: a Server Component/layout catches it and redirects,
 * a Route Handler catches it and returns 403, a Server Action lets it
 * surface as an error. This is the actual enforcement point for Server
 * Actions and Route Handlers — RLS is the backstop if this is ever
 * accidentally skipped, not a substitute for calling it.
 */
export async function requirePermission(code: PermissionCode): Promise<void> {
  if (!(await hasPermission(code))) {
    throw new ForbiddenError(`Missing permission: ${code}`);
  }
}

export async function requireSuperAdmin(): Promise<void> {
  if (!(await isSuperAdmin())) {
    throw new ForbiddenError("Super admin only");
  }
}

/**
 * Assert the caller owns a row before writing to it (R4, layer 4).
 *
 * RLS already scopes these tables to `user_id = auth.uid()`, but a policy
 * mismatch shows up as a delete or update that quietly affects zero rows and
 * reports success — the officer sees the entry "deleted" and it is still
 * there on refresh. Checking here turns that into a real error, and means
 * authorization does not depend on a policy staying correct.
 */
export async function requireOwnership(
  table: "duties" | "leave_logs",
  id: string,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ForbiddenError("Not authenticated");

  const { data } = await supabase
    .from(table)
    .select("user_id")
    .eq("id", id)
    .maybeSingle();

  if (!data) throw new ForbiddenError("That record no longer exists.");
  if (data.user_id !== user.id) {
    throw new ForbiddenError("You can only change your own records.");
  }
}

/**
 * Attachments are owned by their uploader, but a super admin may remove any
 * of them — they can already see every file via STORAGE_VIEW_ALL, and being
 * unable to delete one was an oversight rather than a policy.
 */
export async function canDeleteAttachment(attachmentId: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("file_attachments")
    .select("uploaded_by")
    .eq("id", attachmentId)
    .maybeSingle();

  if (!data) return false;
  return data.uploaded_by === user.id || (await isSuperAdmin());
}
