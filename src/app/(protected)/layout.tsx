import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { isUserOnlyPath, ADMIN_HOME } from "@/lib/permissions/routeAccess";
import { PATHNAME_HEADER } from "@/proxy";
import { hasPermission } from "@/lib/permissions/hasPermission";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { AppShell, type NavSection } from "@/components/layout/app-shell";

/**
 * The real (DB-backed) authorization gate for every route under this group.
 * Proxy (src/proxy.ts) only does an optimistic, cookie-only redirect for
 * unauthenticated visitors — it can't see PENDING/APPROVED/REJECTED status,
 * since that lives in public.users, not the auth session.
 *
 * Nav is computed here (server-side) from role + permissions, so the sidebar
 * never advertises a screen the user would just be bounced from.
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (user.status !== "APPROVED") redirect("/pending-approval");

  // Role-based routing (R4, layer 2). /admin/** has its own gate in
  // admin/layout.tsx; this is the mirror for the officer-facing areas, so a
  // super admin who types /dashboard or /calendar lands on the admin
  // equivalent instead of an empty view of a duty log they do not keep.
  // Done here rather than in proxy.ts because the role lives in public.users:
  // checking it there would cost a DB round trip on every request, including
  // prefetches. This layout already loaded the user.
  const pathname = (await headers()).get(PATHNAME_HEADER) ?? "";
  if (user.role === "SUPER_ADMIN" && pathname && isUserOnlyPath(pathname)) {
    redirect(ADMIN_HOME);
  }

  const [canManageHolidays, canAccessStorage] = await Promise.all([
    hasPermission(PERMISSIONS.HOLIDAY_CREATE),
    hasPermission(PERMISSIONS.STORAGE_VIEW_ALL),
  ]);

  const sections: NavSection[] = [];

  if (user.role === "SUPER_ADMIN") {
    // Pure Management and System Administration for Super Admins
    sections.push({
      title: "Operations & Oversight",
      items: [
        { href: "/admin/dashboard", label: "Admin Overview" },
        { href: "/admin/users", label: "Officer Directory" },
        { href: "/duty", label: "Duty Roster & Logs" },
        { href: "/leave", label: "Leave Records" },
        { href: "/holidays", label: "Official Holidays" },
        { href: "/storage", label: "Document Vault" },
        { href: "/reports", label: "Reports & Analytics" },
      ],
    });

    sections.push({
      title: "System Administration",
      items: [
        { href: "/admin/permissions", label: "Storage & Permissions" },
        { href: "/admin/profiles", label: "Officer Profiles" },
        { href: "/admin/departments", label: "Departments" },
        { href: "/admin/duty-types", label: "Duty Types" },
        { href: "/admin/leave-types", label: "Leave Types" },
        { href: "/settings", label: "System Settings" },
      ],
    });
  } else {
    // Personal Duty/Leave Logging for standard Officers
    sections.push({
      title: "Main Menu",
      items: [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/duty", label: "Duty Log" },
        { href: "/leave", label: "Leave Log" },
        { href: "/leave/balance", label: "Leave Balance" },
        { href: "/calendar", label: "Calendar" },
        // Reports are no longer permission-gated: every officer can report on
        // their own records, and REPORT_VIEW only widens that to other people.
        { href: "/reports", label: "Reports" },
        ...(canAccessStorage ? [{ href: "/storage", label: "Files" }] : []),
        ...(canManageHolidays
          ? [{ href: "/holidays", label: "Holidays" }]
          : []),
        { href: "/profile", label: "Officer Profile" },
        // Settings last, so the menu order does not shift with permissions.
        { href: "/settings", label: "Settings" },
      ],
    });
  }

  return (
    <AppShell
      sections={sections}
      userName={user.fullName}
      userRole={user.role}
      userAvatar={user.avatarUrl}
    >
      {children}
    </AppShell>
  );
}
