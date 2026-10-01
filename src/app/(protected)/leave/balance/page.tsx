import { NavLink as Link } from "@/components/ui/nav-link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { isHolidayLeaveType } from "@/lib/leave/holidayLeaveRules";
import { getUserDisabledLeaveTypeIds } from "@/lib/leave/userDisabledLeaveTypes";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ColorDot } from "@/components/ui/color-dot";
import { FilterSelect } from "@/components/ui/filter-select";
import {
  clampYear,
  getYearOptions,
  YEAR_MIN_OFFSET,
  YEAR_MAX_OFFSET,
} from "@/lib/format/year";
import {
  Scale,
  Settings,
  ArrowLeft,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export default async function LeaveBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const { year: rawYear } = await searchParams;

  // The window lives in one place now (src/lib/format/year.ts) and matches
  // what leave_balance_view materialises. This page used to declare its own
  // -3..+1, which was a fourth window in an app that already had three.
  const selectedYear = clampYear(rawYear);
  const yearOptions = getYearOptions(-YEAR_MIN_OFFSET, YEAR_MAX_OFFSET);

  if (!user) redirect("/login");

  const [
    { data: balances },
    { data: leaveTypes },
    { data: holidayCountResult },
    disabledTypeIds,
    { data: approvedApps },
  ] = await Promise.all([
    supabase
      .from("leave_balance_view")
      .select(
        "leave_type_id, year, allocated, carried_in, total_available, capped_away, max_accumulated, carry_forward, used, remaining",
      )
      // Explicitly this officer. The page relied on RLS alone, so a super
      // admin saw every officer's rows merged together under duplicate keys.
      .eq("user_id", user.id)
      .eq("year", selectedYear),
    supabase.from("leave_types").select("id, name, code, is_system, color, is_active"),
    supabase.rpc("holiday_count_for_year", {
      p_year: selectedYear,
      p_user_id: user.id,
    }),
    getUserDisabledLeaveTypeIds(user.id),
    supabase
      .from("special_leave_applications")
      .select("id, leave_type_id, status, approved_days, expires_at, approved_date")
      .eq("user_id", user.id)
      .eq("year", selectedYear)
      .eq("status", "APPROVED"),
  ]);

  const approvedAppIds = (approvedApps ?? []).map((a) => a.id);
  const splLogsMap = new Map<string, number>();
  if (approvedAppIds.length > 0) {
    const { data: splLogs } = await supabase
      .from("leave_logs")
      .select("special_leave_application_id, start_date, end_date, is_half_day")
      .in("special_leave_application_id", approvedAppIds);

    for (const log of splLogs ?? []) {
      if (log.special_leave_application_id) {
        const days = log.is_half_day
          ? 0.5
          : Math.round(
              (new Date(log.end_date).getTime() -
                new Date(log.start_date).getTime()) /
                (1000 * 60 * 60 * 24),
            ) + 1;
        splLogsMap.set(
          log.special_leave_application_id,
          (splLogsMap.get(log.special_leave_application_id) ?? 0) + days,
        );
      }
    }
  }

  // Group approved days by leave_type_id (default to SPL's id)
  const splTypeObj = (leaveTypes ?? []).find((t) => t.code === "SPL");
  const approvedSummaryByType = new Map<string, { approvedTotal: number; loggedTotal: number; remainingTotal: number }>();

  for (const app of approvedApps ?? []) {
    const typeId = app.leave_type_id || splTypeObj?.id;
    if (!typeId) continue;
    const approved = Number(app.approved_days ?? 0);
    const logged = splLogsMap.get(app.id) ?? 0;
    const remainingToLog = Math.max(0, approved - logged);

    const curr = approvedSummaryByType.get(typeId) ?? { approvedTotal: 0, loggedTotal: 0, remainingTotal: 0 };
    approvedSummaryByType.set(typeId, {
      approvedTotal: curr.approvedTotal + approved,
      loggedTotal: curr.loggedTotal + logged,
      remainingTotal: curr.remainingTotal + remainingToLog,
    });
  }

  const typeById = new Map((leaveTypes ?? []).map((t) => [t.id, t]));

  // Holiday Leave is not allocated by hand — it IS the year's holiday count,
  // so it gets its own card explaining where the number comes from.
  const holidayLeaveType = (leaveTypes ?? []).find((t) =>
    isHolidayLeaveType(t),
  );
  const isHolidayDisabled = holidayLeaveType
    ? disabledTypeIds.has(holidayLeaveType.id) || holidayLeaveType.is_active === false
    : false;
  const holidayLeaveBalance = holidayLeaveType
    ? (balances ?? []).find((b) => b.leave_type_id === holidayLeaveType.id)
    : undefined;
  const holidayCount = Number(holidayCountResult ?? 0);

  const visibleBalances = (balances ?? []).filter((b) => {
    if (disabledTypeIds.has(b.leave_type_id)) return false;
    const type = typeById.get(b.leave_type_id);
    if (type && type.is_active === false) return false;
    return true;
  });

  const [
    { count: holidaysWorked },
    { data: holidayLeaveDayRows },
  ] = await Promise.all([
    supabase
      .from("duties")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_holiday_duty", true)
      .gte("starts_at", `${selectedYear}-01-01T00:00:00`)
      .lte("starts_at", `${selectedYear}-12-31T23:59:59`),
    holidayLeaveType
      ? supabase
          .from("leave_log_days")
          .select("fraction")
          .eq("user_id", user.id)
          .eq("leave_type_id", holidayLeaveType.id)
          .gte("leave_date", `${selectedYear}-01-01`)
          .lte("leave_date", `${selectedYear}-12-31`)
      : Promise.resolve({ data: [] }),
  ]);

  const daysTakenFromRows = (holidayLeaveDayRows ?? []).reduce(
    (sum, d) => sum + Number(d.fraction ?? 1),
    0,
  );
  // Match the leave portion of leave_balance_view (total used minus duties worked), fallback to days rows
  const holidaysTaken = holidayLeaveBalance
    ? Math.max(0, Number(holidayLeaveBalance.used ?? 0) - Number(holidaysWorked ?? 0))
    : daysTakenFromRows;

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
        /* The year is dropped from the title: the picker beside it and the
           "Allowance Ledger (2026)" heading below both state it, and at 375px
           "(2026)" was what pushed this onto a second line. `title` is a
           string prop, so this is all-or-nothing rather than width-dependent. */
        title="My Leave Balance"
        subtitle="Annual quota entitlement and utilized days across all leave classifications."
        compactActions
        actions={
          <div className="flex items-center gap-2">
            {/* Past and future years, not just today's. Everything on the
                page -- the ledger, the holiday count, the worked-holiday
                tally -- reads the same `selectedYear`, so they cannot
                disagree with the title. */}
            {/* The trigger spends ~90px on its icon, clear "x" and chevron
                before the label gets any room, so at w-20 the year itself was
                invisible — a year picker showing no year. */}
            <div className="w-28">
              <FilterSelect
                paramName="year"
                placeholder={String(selectedYear)}
                value={String(selectedYear)}
                icon="calendar"
                options={yearOptions}
                /* No clear "x": the page always needs a year, so clearing
                   only returns to the current one — and the 24px it takes is
                   what pushed "2026" out of the trigger on a phone. */
                clearable={false}
              />
            </div>
            <Link
              href="/settings?tab=leave"
              aria-label="Settings"
              title="Settings"
              className="flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-indigo-600 px-2.5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 transition-colors hover:bg-indigo-500 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm"
            >
              <Settings className="size-4 shrink-0" />
              <span className="hidden sm:inline">Settings</span>
            </Link>
          </div>
        }
      />

      {/* Holiday Leave gets its own card: it is the only balance that is not
          allocated by hand, so the number needs to explain where it came from
          and why working a holiday does not spend it. */}
      {holidayLeaveType && !isHolidayDisabled && (
        <Card className="border-amber-500/30 bg-amber-500/5 p-4 sm:p-5">
          {/* On a phone the icon, heading and the remaining figure share the
              top line, and the explanation sits underneath. Previously the
              right-hand block wrapped below a full-width paragraph but kept
              `text-right`, so the number floated against the edge with
              nothing above it -- the misalignment in the report. */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Sparkles className="size-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-sm font-bold text-foreground">
                    Holiday Leave — derived from your calendar
                  </h2>
                  {/* The figure, on the heading's row. Hidden from `sm` up,
                      where the column below takes over. */}
                  <div className="shrink-0 text-right sm:hidden">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Remaining
                    </p>
                    <p className="text-xl font-bold leading-tight text-foreground">
                      {holidayLeaveBalance?.remaining ?? holidayCount}
                    </p>
                  </div>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  {holidayCount} holidays in {selectedYear} ·{" "}
                  {holidaysTaken} taken as leave ·{" "}
                  {holidaysWorked ?? 0} worked duties
                </p>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Sundays, 2nd and 4th Saturdays and gazetted festivals all
                  count. Working on a holiday or taking Holiday Leave consumes
                  from your quota; removing a duty or leave restores it.
                </p>
                <Link
                  href="/settings?tab=holidays"
                  className="mt-2 inline-block text-[11px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400 sm:hidden"
                >
                  Edit holidays
                </Link>
              </div>
            </div>

            {/* The same figure as its own column from `sm` up. */}
            <div className="hidden shrink-0 text-right sm:block">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Remaining
              </p>
              <p className="text-2xl font-bold text-foreground">
                {holidayLeaveBalance?.remaining ?? holidayCount}
              </p>
              <Link
                href="/settings?tab=holidays"
                className="text-[11px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
              >
                Edit holidays
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* One row per leave type.
          This used to be two blocks stacked on top of each other: a card grid,
          then an "Allowance Ledger Details" table on desktop with a card list
          on mobile. Same numbers, three treatments, and every leave type
          appeared twice on the page. One row now carries all of it, laid out
          differently at each width rather than duplicated. */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border/80 p-4 sm:p-5">
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Allowance Ledger ({selectedYear})
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Entitlement, days taken and what is left
            </p>
          </div>
          <Link
            href="/settings?tab=leave"
            className="shrink-0 text-[11px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Adjust
          </Link>
        </div>

        {visibleBalances.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <Scale className="size-8 text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-medium text-foreground">
              No allowance set for this year yet
            </p>
            <Link
              href="/settings?tab=leave"
              className="text-xs font-semibold text-indigo-600 hover:underline"
            >
              Set your allowances in Settings
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {visibleBalances.map((b) => {
              const type = typeById.get(b.leave_type_id);
              const name = type?.name ?? "Unknown";
              const isHL = isHolidayLeaveType(type);
              const approvedInfo = approvedSummaryByType.get(b.leave_type_id);

              const allocated = Number(b.allocated ?? 0);
              const carriedIn = Number(b.carried_in ?? 0);
              const cappedAway = Number(b.capped_away ?? 0);
              const totalAvailable = Number(b.total_available ?? allocated + carriedIn);
              const used = Number(b.used ?? 0);
              const totalHlWorked = Number(holidaysWorked ?? 0);
              const totalHlUsed = holidaysTaken + totalHlWorked;
              const remaining = isHL
                ? Math.max(0, totalAvailable - totalHlUsed)
                : Number(b.remaining ?? 0);
              const isOver = remaining < 0;
              const percentUsed =
                totalAvailable > 0
                  ? Math.min(100, Math.round(((isHL ? totalHlUsed : used) / totalAvailable) * 100))
                  : 0;

              return (
                <li
                  key={b.leave_type_id}
                  className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:gap-6 sm:p-5"
                >
                  {/* Category identity and status badge */}
                  <div className="flex min-w-0 flex-col gap-1.5 sm:w-60 lg:w-72 shrink-0">
                    <div className="flex items-center gap-2">
                      <ColorDot color={type?.color} label={name} />
                      <span className="text-sm font-bold text-foreground truncate" title={name}>
                        {name}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={isOver ? "danger" : "success"}>
                        {isOver ? `Over by ${Math.abs(remaining)}d` : `${remaining}d left`}
                      </Badge>
                      {approvedInfo && approvedInfo.approvedTotal > 0 && (
                        <Badge variant="info">
                          {approvedInfo.approvedTotal}d sanctioned
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Carried days sit cleanly below Allocated, and duty breakdown sits below Used */}
                  <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/60 bg-muted/40 p-2.5 text-center sm:min-h-[48px] sm:flex-1 sm:border-0 sm:bg-transparent sm:p-0 sm:text-left">
                    <div>
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Allocated
                      </span>
                      {/* The total the officer can actually take, with what
                          carried over from last year folded in: "23 (incl. 8 carried)". */}
                      <span className="text-sm font-bold text-foreground">
                        {carriedIn > 0 ? totalAvailable || allocated + carriedIn : allocated}
                      </span>
                      {approvedInfo && approvedInfo.approvedTotal > 0 && (
                        <span className="block text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 leading-tight">
                          {approvedInfo.approvedTotal}d approved ({approvedInfo.remainingTotal} to log)
                        </span>
                      )}
                      {carriedIn > 0 && (
                        <span className="block text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 leading-tight">
                          incl. {carriedIn} carried
                        </span>
                      )}
                      {cappedAway > 0 && (
                        <span
                          className="block text-[10px] font-medium text-amber-600 dark:text-amber-400 leading-tight"
                          title={`${cappedAway}d above your ${b.max_accumulated}-day maximum were not carried.`}
                        >
                          ({cappedAway}d capped)
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Used
                      </span>
                      <span className="text-sm font-bold text-foreground">
                        {isHL ? totalHlUsed : used}
                      </span>
                      {isHL && totalHlWorked > 0 && (
                        <span className="block text-[10px] font-semibold text-amber-600 dark:text-amber-400 leading-tight">
                          {holidaysTaken} leave + {totalHlWorked} {totalHlWorked === 1 ? "duty worked" : "duties worked"}
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Remaining
                      </span>
                      <span
                        className={`text-sm font-bold ${
                          isOver ? "text-rose-600 dark:text-rose-400" : "text-foreground"
                        }`}
                      >
                        {remaining}
                      </span>
                      {approvedInfo && approvedInfo.approvedTotal > 0 && (
                        <span className="block text-[10px] font-semibold text-sky-600 dark:text-sky-400 leading-tight">
                          {approvedInfo.remainingTotal} to log
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Usage bar: full width on a phone, a fixed column beside
                      the figures on wider screens. */}
                  <div className="sm:w-44 sm:shrink-0">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isOver ? "bg-rose-500" : isHL ? "bg-amber-500" : "bg-indigo-500"
                        }`}
                        style={{ width: `${allocated > 0 ? percentUsed : 0}%` }}
                      />
                    </div>
                    <span className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>
                        {totalAvailable > 0
                          ? isHL && (holidaysWorked ?? 0) > 0
                            ? holidaysTaken > 0
                              ? `${percentUsed}% of ${totalAvailable}d (${holidaysTaken} leave + ${holidaysWorked} duty)`
                              : `${percentUsed}% of ${totalAvailable}d (${holidaysWorked} ${(holidaysWorked ?? 0) === 1 ? "duty" : "duties"} worked)`
                            : `${percentUsed}% of ${totalAvailable}d used`
                          : "No allowance set"}
                      </span>
                      {(type?.code === "SPL" || type?.code === "LWP") && (
                        <Link
                          href={`/leave?tab=special&year=${selectedYear}`}
                          className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          <span>Sanctions</span>
                          <ArrowRight className="size-2.5" />
                        </Link>
                      )}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </main>
  );
}
