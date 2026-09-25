import { NavLink as Link } from "@/components/ui/nav-link";
import { createClient } from "@/lib/supabase/server";
import { leaveDaysWithin, formatDays } from "@/lib/leave/leaveDays";
import { PageHeader } from "@/components/ui/page-header";
import { Card, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  UserCheck,
  ShieldCheck,
  Building2,
  Layers,
  FileText,
  Sun,
  Clock,
  Briefcase,
  CalendarOff,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const now = new Date();
  const startOfMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  ).toISOString();
  const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();

  const [
    { count: pendingCount },
    { count: approvedCount },
    { count: dutiesThisMonth },
    { data: leaveRowsThisYear },
  ] = await Promise.all([
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING"),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("status", "APPROVED"),
    supabase
      .from("duties")
      .select("id", { count: "exact", head: true })
      .gte("starts_at", startOfMonth),
    supabase
      .from("leave_logs")
      .select("start_date, end_date, is_half_day")
      .gte("end_date", startOfYear.slice(0, 10)),
  ]);

  // Days of leave taken this year, not entries: one week off is seven days.
  const leaveDaysThisYear = (leaveRowsThisYear ?? []).reduce(
    (a, l) =>
      a +
      leaveDaysWithin(
        l.start_date,
        l.end_date,
        l.is_half_day,
        startOfYear.slice(0, 10),
        `${startOfYear.slice(0, 4)}-12-31`,
      ),
    0,
  );

  const adminModules = [
    {
      title: "Officer Management",
      desc: "Review registrations, approve accounts, and configure permissions.",
      href: "/admin/users",
      icon: Users,
      color: "indigo",
      badge: (pendingCount ?? 0) > 0 ? `${pendingCount} Pending` : undefined,
    },
    {
      title: "Storage & Permissions",
      desc: "Authorize officers for Document Vault (/storage) and duty/leave file attachment uploading.",
      href: "/admin/permissions",
      icon: ShieldCheck,
      color: "purple",
    },
    {
      title: "Officer Profiles",
      desc: "Configure role designations and rank profile templates.",
      href: "/admin/profiles",
      icon: UserCheck,
      color: "sky",
    },
    {
      title: "Departments",
      desc: "Organize organizational structures and division scopes.",
      href: "/admin/departments",
      icon: Building2,
      color: "emerald",
    },
    {
      title: "Duty Types",
      desc: "Manage roster shift classifications and duty requirements.",
      href: "/admin/duty-types",
      icon: Layers,
      color: "amber",
    },
    {
      title: "Leave Classifications",
      desc: "Define quota types, entitlement policies, and balance rules.",
      href: "/admin/leave-types",
      icon: FileText,
      color: "rose",
    },
    {
      title: "Official Holidays",
      desc: "Manage national holidays and profile-specific non-working dates.",
      href: "/holidays",
      icon: Sun,
      color: "amber",
    },
  ];

  return (
    <main className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-7xl 2xl:max-w-full mx-auto space-y-8">
      <PageHeader
        title="Super Admin Control Center"
        subtitle="Manage agency configurations, approve officers, and maintain system settings."
        badge={<Badge variant="purple">Super Admin Scope</Badge>}
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          title="Pending Approvals"
          value={pendingCount ?? 0}
          icon={Clock}
          color="amber"
          trend="Awaiting admin action"
        />
        <StatCard
          title="Active Officers"
          value={approvedCount ?? 0}
          icon={Users}
          color="indigo"
          trend="Authorized active users"
        />
        <StatCard
          title="Duties This Month"
          value={dutiesThisMonth ?? 0}
          icon={Briefcase}
          color="emerald"
          trend="Current calendar month"
        />
        <StatCard
          title="Total Leaves (Year)"
          value={formatDays(leaveDaysThisYear)}
          icon={CalendarOff}
          color="sky"
          trend="Yearly absence requests"
        />
      </div>

      {/* Administration Modules Grid */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-foreground">
          Administrative Modules
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {adminModules.map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={m.href}
                href={m.href}
                className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-xs hover:border-indigo-500/50 hover:shadow-md transition-all duration-200"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <Icon className="size-5" />
                    </div>
                    {m.badge && <Badge variant="warning">{m.badge}</Badge>}
                  </div>
                  <h3 className="font-bold text-sm text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {m.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {m.desc}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  <span>Manage</span>
                  <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
