import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { hasPermission } from "@/lib/permissions/hasPermission";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { LeaveForm } from "./leave-form";
import { loadHolidayOptions, loadOptionalHolidayOptions } from "@/lib/leave/loadHolidayOptions";
import { getUserDisabledLeaveTypeIds } from "@/lib/leave/userDisabledLeaveTypes";
import { getUserSettings } from "@/lib/settings/getUserSettings";
import { clampYear } from "@/lib/format/year";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ColorDot } from "@/components/ui/color-dot";
import { NavLink as Link } from "@/components/ui/nav-link";
import { ArrowLeft, CalendarOff, Scale, Info, ShieldCheck, CheckCircle2 } from "lucide-react";
import {
  computeSpecialLeaveExpiry,
  isSpecialLeaveSanctionExpired,
} from "@/lib/leave/specialLeaveRules";

export default async function NewLeavePage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    leaveTypeId?: string;
    specialLeaveApplicationId?: string;
  }>;
}) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const {
    year: rawYear,
    leaveTypeId: initialLeaveTypeId,
    specialLeaveApplicationId: initialSplAppId,
  } = await searchParams;
  // Defaults to now, but a link from the balance page can open this form on
  // the year being planned rather than always the clock year.
  const currentYear = clampYear(rawYear ? parseInt(rawYear, 10) : new Date().getFullYear());

  const [
    { data: leaveTypes },
    { data: balances },
    { data: approvedSplApps },
    canAccessStorage,
    disabledTypeIds,
    userSettings,
  ] = await Promise.all([
    supabase
      .from("leave_types")
      // code + is_system so the form can spot the Holiday Leave type.
      // color drives the swatch in the picker and the allowances list.
      .select("id, name, code, is_system, color")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("leave_balance_view")
      .select("leave_type_id, allocated, carried_in, total_available, used, remaining")
      .eq("user_id", user?.id ?? "")
      .eq("year", currentYear),
    supabase
      .from("special_leave_applications")
      .select("id, leave_type_id, applied_date, applied_days, approved_date, approved_by, approved_days, order_no, valid_from, valid_to, expires_at")
      .eq("user_id", user?.id ?? "")
      .eq("status", "APPROVED")
      .eq("year", currentYear),
    user?.role === "SUPER_ADMIN" ? true : hasPermission(PERMISSIONS.STORAGE_VIEW_ALL),
    getUserDisabledLeaveTypeIds(user?.id),
    getUserSettings(),
  ]);

  // Exclude any leave types the officer has disabled for their account
  const enabledLeaveTypes = (leaveTypes ?? []).filter(
    (lt) => !disabledTypeIds.has(lt.id),
  );

  const balanceMap = new Map(
    (balances ?? []).map((b) => [b.leave_type_id, b])
  );

  // Compute logged days for each approved SPL sanction
  const splSanctionIds = (approvedSplApps ?? []).map((a) => a.id);
  const splLoggedMap = new Map<string, number>();

  if (splSanctionIds.length > 0) {
    const { data: splLogs } = await supabase
      .from("leave_logs")
      .select("special_leave_application_id, start_date, end_date, is_half_day")
      .in("special_leave_application_id", splSanctionIds);

    for (const log of splLogs ?? []) {
      if (log.special_leave_application_id) {
        const days = log.is_half_day
          ? 0.5
          : Math.round(
            (new Date(log.end_date).getTime() -
              new Date(log.start_date).getTime()) /
            (1000 * 60 * 60 * 24),
          ) + 1;
        splLoggedMap.set(
          log.special_leave_application_id,
          (splLoggedMap.get(log.special_leave_application_id) ?? 0) + days,
        );
      }
    }
  }

  const specialLeaveSanctions = (approvedSplApps ?? []).map((app) => {
    const approvedDays = Number(app.approved_days ?? 0);
    const loggedDays = splLoggedMap.get(app.id) ?? 0;
    const isExpired = isSpecialLeaveSanctionExpired(app);
    const expiryDate =
      app.expires_at || (app.approved_date ? computeSpecialLeaveExpiry(app.approved_date) : null);

    return {
      id: app.id,
      leaveTypeId: app.leave_type_id,
      appliedDate: app.applied_date,
      appliedDays: Number(app.applied_days),
      approvedDate: app.approved_date ?? app.applied_date,
      approvedBy: app.approved_by ?? "Authority",
      approvedDays,
      orderNo: app.order_no,
      validFrom: app.valid_from,
      validTo: app.valid_to,
      expiresAt: expiryDate,
      isExpired,
      remainingDays: Math.max(0, Number((approvedDays - loggedDays).toFixed(1))),
    };
  });

  /**
   * Sanction-based types have no annual allocation to report, so their real
   * balance is the sanctions themselves. Expired sanctions are left out: their
   * unlogged days have lapsed and are no longer available to take.
   */
  const sanctionTotals = new Map<
    string,
    { sanctioned: number; logged: number; left: number }
  >();
  for (const s of specialLeaveSanctions) {
    if (s.isExpired || !s.leaveTypeId) continue;
    const logged = splLoggedMap.get(s.id) ?? 0;
    const acc = sanctionTotals.get(s.leaveTypeId) ?? {
      sanctioned: 0,
      logged: 0,
      left: 0,
    };
    acc.sanctioned += s.approvedDays;
    acc.logged += logged;
    acc.left += s.remainingDays;
    sanctionTotals.set(s.leaveTypeId, acc);
  }
  const sanctionSummaries = Array.from(sanctionTotals, ([leaveTypeId, t]) => ({
    leaveTypeId,
    sanctioned: Number(t.sanctioned.toFixed(1)),
    logged: Number(t.logged.toFixed(1)),
    left: Number(t.left.toFixed(1)),
  }));

  // Holiday Leave is only valid on a holiday, so the form gets the year's
  // holidays rather than letting the officer pick a working day and be refused.
  const [holidayOptions, optionalHolidayOptions] = await Promise.all([
    user
      ? loadHolidayOptions([currentYear, currentYear + 1], user.id)
      : Promise.resolve([]),
    loadOptionalHolidayOptions(currentYear),
  ]);

  return (
    <main className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-7xl 2xl:max-w-full mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/leave"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Leave Log</span>
        </Link>
      </div>

      <PageHeader
        title="Log Leave Request"
        subtitle="Submit a new absence period, statutory leave entitlement, or half-day session."
        badge={
          <Badge variant="success" dot>
            Year {currentYear}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form Container */}
        <div className="lg:col-span-2">
          <Card className="p-6 sm:p-8">
            <LeaveForm
              leaveTypes={enabledLeaveTypes}
              canUploadFiles={canAccessStorage}
              holidayOptions={holidayOptions}
              optionalHolidayOptions={optionalHolidayOptions}
              specialLeaveSanctions={specialLeaveSanctions}
              sanctionSummaries={sanctionSummaries}
              dailySalaryRate={userSettings.dailySalaryRate}
              defaults={{
                leaveTypeId: initialLeaveTypeId,
                specialLeaveApplicationId: initialSplAppId,
              }}
              balances={(balances ?? []).map((b) => ({
                leaveTypeId: b.leave_type_id,
                allocated: b.allocated,
                carriedIn: b.carried_in,
                totalAvailable: b.total_available,
                used: b.used,
                remaining: b.remaining,
              }))}
            />
          </Card>
        </div>

        {/* Sidebar Insights & Balance Overview */}
        <div className="space-y-6">
          {/* Allowance Balance Summary Card */}
          <Card className="p-5 space-y-4">
            <CardHeader
              title={`Leave Allowances (${currentYear})`}
              description="Your remaining quota for active categories"
            />

            <div className="space-y-2.5">
              {enabledLeaveTypes.map((lt) => {
                const bal = balanceMap.get(lt.id);
                const sanction = sanctionTotals.get(lt.id);
                const code = lt.code?.toUpperCase();
                // Binpagari has no allocation at all, so a "0 / 0 days left"
                // row says nothing. Its sanctions are the whole story.
                const sanctionOnly = code === "LWP" && lt.is_system;
                const remaining = Number(bal?.remaining ?? 0);
                const allocated = Number(bal?.allocated ?? 0);
                const carriedIn = Number(bal?.carried_in ?? 0);
                const totalAvailable = Number(bal?.total_available ?? allocated + carriedIn);
                const quota = totalAvailable > 0 ? totalAvailable : allocated;
                const used = Number(bal?.used ?? 0);
                const percent = quota > 0 ? Math.max(0, Math.min(100, Math.round((used / quota) * 100))) : 0;

                return (
                  <div
                    key={lt.id}
                    className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex min-w-0 items-center gap-1.5 font-semibold text-foreground">
                        <ColorDot color={lt.color} label={lt.name} />
                        <span className="truncate">{lt.name}</span>
                      </span>
                      <div className="text-right shrink-0">
                        {sanctionOnly ? (
                          <span className="font-medium text-muted-foreground">
                            <strong className="text-foreground">{sanction?.left ?? 0}</strong> /{" "}
                            {sanction?.sanctioned ?? 0} days sanctioned
                          </span>
                        ) : (
                          <>
                            <span className="font-medium text-muted-foreground">
                              <strong className="text-foreground">{remaining}</strong> / {quota} days left
                            </span>
                            {carriedIn > 0 && (
                              <span className="block text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold leading-none mt-0.5">
                                {quota} days (incl. {carriedIn} carried)
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    {!sanctionOnly && quota > 0 && (
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${remaining < 0 ? "bg-rose-500" : percent > 80 ? "bg-amber-500" : "bg-emerald-500"
                            }`}
                          style={{ width: `${Math.min(100, percent)}%` }}
                        />
                      </div>
                    )}
                    {/* Special Leave has both an annual quota and sanctions, so
                        it shows the sanction figures alongside, not instead. */}
                    {sanction && !sanctionOnly && (
                      <div className="flex items-center gap-1.5 text-[10px] text-sky-600 dark:text-sky-400 font-semibold">
                        <ShieldCheck className="size-3 shrink-0" />
                        <span>
                          Sanctioned {sanction.sanctioned} d · Logged {sanction.logged} d ·
                          Left {sanction.left} d
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Absence Guidelines Card */}
          <Card className="p-5 bg-gradient-to-br from-indigo-900/10 via-slate-900/5 to-slate-900/10 border-indigo-500/20 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              <Info className="size-4" />
              <span>Leave Policy Highlights</span>
            </div>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>Half-day leaves can be logged for either morning (AM) or afternoon (PM) duties.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>Duty rosters are automatically cross-checked against registered leave periods.</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </main>
  );
}
