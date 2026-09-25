/**
 * Which areas belong to which role (R4, layer 2).
 *
 * Authorization is enforced in four places and this is only one of them:
 *
 *   proxy.ts               authentication only, no role logic, no DB read
 *   (protected)/layout.tsx role-based routing  <- this table
 *   admin/layout.tsx       admin authorization for /admin/**
 *   server actions         final, independent enforcement
 *
 * Hiding a nav item is a UX affordance, never a control: every sensitive
 * server action re-verifies on its own regardless of what any layout decided.
 */

/**
 * Officer-facing areas. A super admin lands on the admin equivalents instead,
 * so sending them here would show an empty or misleading view of their own
 * (non-existent) duty log.
 */
export const USER_ONLY_PREFIXES = [
  "/dashboard",
  "/calendar",
  "/holidays/mine",
  "/leave/balance",
] as const;

export function isUserOnlyPath(pathname: string): boolean {
  return USER_ONLY_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/** Where a role belongs when it lands somewhere it should not be. */
export const ADMIN_HOME = "/admin/dashboard";
export const USER_HOME = "/dashboard";
