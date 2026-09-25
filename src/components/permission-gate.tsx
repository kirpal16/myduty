import { hasPermission } from "@/lib/permissions/hasPermission";
import type { PermissionCode } from "@/lib/permissions/constants";

/**
 * UI convenience layer only — hides/shows content based on a permission.
 * Never the actual security boundary: every mutation still goes through
 * requirePermission() server-side and RLS regardless of what this renders.
 */
export async function PermissionGate({
  permission,
  children,
  fallback = null,
}: {
  permission: PermissionCode;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const allowed = await hasPermission(permission);
  return allowed ? children : fallback;
}
