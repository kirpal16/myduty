import { NavLink as Link } from "@/components/ui/nav-link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setLeaveAllowance } from "@/actions/leave";
import { approveUser, rejectUser, changeUserRole } from "@/actions/users";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LeaveAllowanceRow } from "@/components/leave/leave-allowance-row";
import { isHolidayLeaveType } from "@/lib/leave/holidayLeaveRules";
import {
  ArrowLeft,
  User,
  Shield,
  CheckCircle,
  XCircle,
  Scale,
  AlertTriangle,
} from "lucide-react";
import { PendingButton } from "@/components/ui/pending-button";
import { FilterSelect } from "@/components/ui/filter-select";
import { clampYear, getYearOptions } from "@/lib/format/year";
import { ActionButton } from "@/components/ui/action-button";
import { DeleteUserModal } from "@/components/admin/delete-user-modal";

export default async function AdminUserConfigPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { id } = await params;
  const { year: rawYear } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  // An admin has to be able to set NEXT year's grant — that is exactly what
  // the January prompt asks officers to do, and this page could only ever
  // edit the clock year.
  const currentYear = clampYear(rawYear);
  const yearOptions = getYearOptions(3, 1);

  const [
    { data: user },
    { data: leaveTypes },
    { data: balances },
    { data: rawBalances },
  ] = await Promise.all([
    supabase
      .from("users")
      .select(
        "id, full_name, employee_code, phone, role, status, time_format, profiles(name), departments(name)",
      )
      .eq("id", id)
      .single(),
    supabase
      .from("leave_types")
      .select("id, name, color, code, is_system")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("leave_balance_view")
      .select(
        "leave_type_id, allocated, carried_in, capped_away, max_accumulated, carry_forward, total_available, used, remaining",
      )
      .eq("user_id", id)
      .eq("year", currentYear),
    supabase
      .from("user_leave_balances")
      .select("leave_type_id, carried_override")
      .eq("user_id", id)
      .eq("year", currentYear),
  ]);

  if (!user) notFound();

  const overrideMap = new Map(
    (rawBalances ?? []).map((rb) => [rb.leave_type_id, rb.carried_override]),
  );
  const balanceByType = new Map(
    (balances ?? []).map((b) => [
      b.leave_type_id,
      {
        ...b,
        carried_override: overrideMap.get(b.leave_type_id) ?? null,
      },
    ]),
  );
  const profile = user.profiles as unknown as { name: string } | null;
  const department = user.departments as unknown as { name: string } | null;

  return (
    <main className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-7xl 2xl:max-w-full mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Officer Directory</span>
        </Link>
      </div>

      <PageHeader
        title={`Officer Profile: ${user.full_name}`}
        subtitle="Manage access permissions, system role, and customized leave allowances."
        badge={
          <Badge
            variant={
              user.status === "APPROVED"
                ? "success"
                : user.status === "REJECTED"
                  ? "danger"
                  : "warning"
            }
            dot
          >
            {user.status}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Officer Information Card */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
              <User className="size-4 text-indigo-500" />
              <span>Officer Details</span>
            </h3>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="flex justify-between py-1.5 border-b border-border/60">
                <span className="text-muted-foreground">Assigned Profile:</span>
                <span className="font-semibold text-foreground">
                  {profile?.name ?? "—"}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/60">
                <span className="text-muted-foreground">Department:</span>
                <span className="font-semibold text-foreground">
                  {department?.name ?? "—"}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/60">
                <span className="text-muted-foreground">Employee Code:</span>
                <span className="font-mono text-foreground">
                  {user.employee_code ?? "—"}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/60">
                <span className="text-muted-foreground">Phone:</span>
                <span className="text-foreground">{user.phone ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/60">
                <span className="text-muted-foreground">System Role:</span>
                <Badge
                  variant={user.role === "SUPER_ADMIN" ? "purple" : "outline"}
                >
                  {user.role.replace("_", " ")}
                </Badge>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Time Format:</span>
                <span className="font-medium text-foreground">
                  {user.time_format}
                </span>
              </div>
            </div>

            {/* Admin Action Buttons */}
            <div className="mt-6 pt-4 border-t border-border flex flex-col gap-2.5">
              <span className="text-xs font-semibold text-muted-foreground mb-1">
                Account Status Controls:
              </span>
              <div className="flex flex-wrap gap-2">
                {user.status !== "APPROVED" && (
                  <ActionButton
                    action={approveUser.bind(null, user.id)}
                    className={
                      "w-full flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 py-2 px-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors cursor-pointer"
                    }
                    successMessage={"Officer approved."}
                  >
                    <CheckCircle className="size-3.5" />
                    <span>Approve Account</span>
                  </ActionButton>
                )}
                {user.status !== "REJECTED" && (
                  <ActionButton
                    action={rejectUser.bind(null, user.id)}
                    className={
                      "w-full flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 py-2 px-3 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors cursor-pointer"
                    }
                    successMessage={"Officer rejected."}
                  >
                    <XCircle className="size-3.5" />
                    <span>Reject Account</span>
                  </ActionButton>
                )}
              </div>

              <form
                action={changeUserRole.bind(
                  null,
                  user.id,
                  user.role === "USER" ? "SUPER_ADMIN" : "USER",
                )}
              >
                <PendingButton className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2 px-3 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer">
                  <Shield className="size-3.5 text-indigo-500" />
                  <span>
                    {user.role === "USER"
                      ? "Promote to Super Admin"
                      : "Demote to Standard User"}
                  </span>
                </PendingButton>
              </form>
            </div>
          </Card>
        </div>

        {/* Leave Allowance Management */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-2">
              <Scale className="size-4 text-indigo-500" />
              <span>Annual Leave Allowances ({currentYear})</span>
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Configure customized entitlements specifically for this officer.
            </p>

            {/* Which year is being configured. Without it an admin could only
                ever set the current year, so next year's grant — the number
                the January prompt asks for — was unreachable. */}
            <div className="mb-4 w-32">
              <FilterSelect
                paramName="year"
                placeholder={String(currentYear)}
                value={String(currentYear)}
                icon="calendar"
                options={yearOptions}
                clearable={false}
              />
            </div>

            {/* Cards rather than a table, matching the officer's own
                settings screen — the same controls in the same shape, so an
                admin and an officer are not looking at two different UIs for
                one setting. */}
            <div className="grid gap-3">
              {(leaveTypes ?? []).map((t) => (
                <LeaveAllowanceRow
                  key={t.id}
                  type={{
                    id: t.id,
                    name: t.name,
                    color: t.color,
                    isSystem: isHolidayLeaveType(t),
                  }}
                  balance={balanceByType.get(t.id)}
                  year={currentYear}
                  userId={user.id}
                  action={setLeaveAllowance}
                  saveLabel="Update"
                />
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Danger Zone: Delete Officer & Data */}
      {currentUser?.id !== user.id && (
        <Card className="p-6 border-rose-200 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="size-4" />
                <span>Danger Zone: Delete Officer Account & Records</span>
              </h3>
              <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
                Permanently remove this officer&apos;s account, duty records, leave logs, uploaded attachments, and timeline milestones. Cleanup strictly isolates to this officer and leaves all other database records untouched.
              </p>
            </div>
            <DeleteUserModal
              userId={user.id}
              userName={user.full_name}
              userRole={user.role}
              variant="detail-danger"
              redirectTo="/admin/users"
            />
          </div>
        </Card>
      )}
    </main>
  );
}
