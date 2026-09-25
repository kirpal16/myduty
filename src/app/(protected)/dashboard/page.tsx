import { NavLink as Link } from "@/components/ui/nav-link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import type { TimeFormat } from "@/types/database";
import { DashboardBodySkeleton } from "@/components/ui/skeletons";
import { formatCurrency } from "@/lib/format/currency";
import { toDateKey } from "@/lib/format/datetime";
import { leaveDaysWithin, formatDays, summariseBreakdown } from "@/lib/leave/leaveDays";
import {
  resolveHolidaysForRange,
  countHolidays,
} from "@/lib/holidays/resolveHoliday";
import { FilterSelect } from "@/components/ui/filter-select";
import {
  DutyTypeDonut,
  WorkedDaysDonut,
  LeaveUsageBar,
  MonthlyTaBar,
} from "@/components/charts/lazy-charts";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { formatDateTime, formatDateRange } from "@/lib/format/datetime";
import { Card, CardHeader, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ColorDot } from "@/components/ui/color-dot";
import { LeaveYearAlerts } from "@/components/leave/leave-year-alerts";
import { isHolidayLeaveType } from "@/lib/leave/holidayLeaveRules";
import { getUserSettings } from "@/lib/settings/getUserSettings";
import { getUserDisabledLeaveTypeIds } from "@/lib/leave/userDisabledLeaveTypes";
import {
  Briefcase,
  CalendarOff,
  Plus,
  ArrowRight,
  MapPin,
  Clock,
  Compass,
  IndianRupee,
  Calendar,
  Sparkles,
} from "lucide-react";

import { redirect } from "next/navigation";
import { getYearOptions, clampYear } from "@/lib/format/year";
import {
  CompactCareerTimeline,
  type TimelineEventItem,
} from "@/components/profile/compact-career-timeline";


/**
 * How many recent records each card loads, and how many are visible before it
 * starts scrolling inside itself. Showing ten in a card that tall would push
 * everything below it off the page, so the list keeps its own scrollbar.
 */
const RECENT_LIMIT = 10;
/**
 * Caps sized to about five entries, measured rather than guessed: a table row
 * renders at 44px plus a 29px header, a stacked mobile card at 87px plus its
 * gap. One shared value cannot show five of both, so they differ.
 *
 * A max-height, not a row count, so an entry that wraps onto two lines still
 * sits inside the scroll area instead of being clipped.
 */
const SCROLL_BASE = "overflow-y-auto overscroll-contain";
/** ~5 table rows (5 x 44 + 29 header = 249px). */
const RECENT_SCROLL_TABLE = `max-h-[16rem] ${SCROLL_BASE}`;
/** ~5 stacked cards (5 x 87 + gaps = 467px). */
const RECENT_SCROLL_CARDS = `max-h-[29rem] ${SCROLL_BASE}`;

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * The data-dependent half of the dashboard, split out so it can stream.
 *
 * The page used to await every query before returning any markup, so a slow
 * connection showed the route-level skeleton and nothing else — including the
 * period filter, which needs no data at all. Now the header and the filter
 * paint immediately and stay usable while the numbers arrive behind them.
 */
async function DashboardBody({
  userId,
  periodStart,
  periodEnd,
  periodLabel,
  isWholeYear,
  year,
  now,
  timeFormat,
  dutyLinkParams,
}: {
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;
  isWholeYear: boolean;
  year: number;
  now: Date;
  timeFormat: TimeFormat;
  dutyLinkParams: string;
}) {
  const supabase = await createClient();
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
  void isWholeYear;
  void now;

  const [
    { data: recentDuties },
    { data: recentLeaves },
    { data: periodDuties },
    { data: periodLeaves },
    { data: yearDuties },
    { data: balances },
    { data: holidayRows },
    { data: nextYearBalances },
    { data: allLeaveTypes },
    disabledTypeIds,
    { data: timelineEvents },
    { data: periodLeaveDays },
    userSettings,
  ] = await Promise.all([
    supabase
      .from("duties")
      .select(
        "id, starts_at, ends_at, location, status, ta_amount, ta_distance_km, is_holiday_duty, manual_holiday_claim, duty_types(name)",
      )
      .eq("user_id", userId)
      // Bounded to the selected year. Without this the "Recent" cards showed
      // the newest rows in the table regardless of the year above them —
      // viewing 2024 listed 2026 entries under a 2024 heading.
      .gte("starts_at", startOfYear.toISOString())
      .lte("starts_at", endOfYear.toISOString())
      .order("starts_at", { ascending: false })
      .limit(RECENT_LIMIT),
    supabase
      .from("leave_logs")
      .select(
        "id, start_date, end_date, is_half_day, half_day_session, reason, leave_types(name, color)",
      )
      .eq("user_id", userId)
      .gte("start_date", toDateKey(startOfYear))
      .lte("start_date", toDateKey(endOfYear))
      .order("start_date", { ascending: false })
      .limit(RECENT_LIMIT),
    // Everything the KPI tiles and the donuts need, for the selected period.
    supabase
      .from("duties")
      .select(
        "id, starts_at, ta_distance_km, ta_amount, is_holiday_duty, holiday_allowance, duty_types(name)",
      )
      .eq("user_id", userId)
      .gte("starts_at", periodStart.toISOString())
      .lte("starts_at", periodEnd.toISOString()),
    supabase
      .from("leave_logs")
      .select("id, start_date, end_date, is_half_day, leave_types(name, color)")
      .eq("user_id", userId)
      // Overlap: a leave that began last month still has days in this one.
      .lte("start_date", toDateKey(periodEnd))
      .gte("end_date", toDateKey(periodStart)),
    // A separate query for the year: the monthly TA bar spans all 12 months
    // regardless of which month the tiles are showing.
    supabase
      .from("duties")
      .select("starts_at, ta_amount, is_holiday_duty")
      .eq("user_id", userId)
      .gte("starts_at", startOfYear.toISOString())
      .lte("starts_at", endOfYear.toISOString()),
    supabase
      .from("leave_balance_view")
      .select(
        "leave_type_id, allocated, allocation_exists, carried_in, carry_forward, max_accumulated, used, remaining",
      )
      .eq("year", year),
    supabase
      .from("holidays")
      .select("name, holiday_date, scope, is_government, is_optional")
      .gte("holiday_date", toDateKey(periodStart))
      .lte("holiday_date", toDateKey(periodEnd)),
    // Next year's rows, so the "will be lost" figure can be exact rather than
    // estimated wherever the officer has already been given next year's grant.
    supabase
      .from("leave_balance_view")
      .select("leave_type_id, allocated, allocation_exists")
      .eq("year", year + 1),
    supabase.from("leave_types").select("id, name, color, code, is_system, is_active"),
    getUserDisabledLeaveTypeIds(userId),
    supabase
      .from("officer_timeline")
      .select("*")
      .eq("user_id", userId)
      .order("start_date", { ascending: false })
      .limit(6),
    supabase
      .from("leave_log_days")
      .select("leave_date, fraction, leave_types(code, name, color)")
      .eq("user_id", userId)
      .gte("leave_date", toDateKey(periodStart))
      .lte("leave_date", toDateKey(periodEnd)),
    // The officer's own daily salary rate, for the Binpagari deduction.
    getUserSettings(),
  ]);

  const recentLeaveIds = (recentLeaves ?? []).map((l) => l.id);
  const { data: recentDayRows } = await supabase
    .from("leave_log_days")
    .select("leave_log_id, fraction, leave_types(code, name, color)")
    .in("leave_log_id", recentLeaveIds.length > 0 ? recentLeaveIds : ["00000000-0000-0000-0000-000000000000"]);

  const recentDaysByLog = new Map<string, { code: string; color: string | null; fraction: number }[]>();
  for (const r of recentDayRows ?? []) {
    const t = r.leave_types as unknown as { code: string | null; name: string; color: string | null } | null;
    const list = recentDaysByLog.get(r.leave_log_id) ?? [];
    list.push({
      code: t?.code || t?.name || "Leave",
      color: t?.color ?? null,
      fraction: Number(r.fraction ?? 1),
    });
    recentDaysByLog.set(r.leave_log_id, list);
  }
  const recentBreakdownFor = (logId: string) => {
    const rows = recentDaysByLog.get(logId) ?? [];
    const summary = summariseBreakdown(rows);
    return summary.length > 1 ? summary : null;
  };

  const duties = periodDuties ?? [];
  const dutyCount = duties.length;
  // Days, not entries: one five-day leave is five days off.
  const periodFromKey = toDateKey(periodStart);
  const periodToKey = toDateKey(periodEnd);
  const leaveDaysOf = (l: { start_date: string; end_date: string; is_half_day: boolean }) =>
    leaveDaysWithin(l.start_date, l.end_date, l.is_half_day, periodFromKey, periodToKey);
  const leaveDaysTotal = (periodLeaves ?? []).reduce((a, l) => a + leaveDaysOf(l), 0);

  const totalDistance = duties.reduce((acc, d) => acc + (d.ta_distance_km ?? 0), 0);
  const totalTaAmount = duties.reduce((acc, d) => acc + (d.ta_amount ?? 0), 0);

  /**
   * Three different numbers, deliberately kept apart (R1):
   *   holidaysInPeriod  - holidays that OCCURRED, from the calendar
   *   holidayDutyCount  - holidays the officer WORKED, from duty rows
   *   holidayExtraPay   - what those worked days actually paid
   *
   * The old count classified by weekday alone, so gazetted holidays and
   * personal day-offs were invisible, and a holiday taken off counted the
   * same as one worked. Extra pay is summed from the rows, never
   * holidays x rate.
   */
  const holidaysInPeriod = countHolidays(
    resolveHolidaysForRange(periodStart, periodEnd, holidayRows ?? []),
  );
  const holidayDutyCount = duties.filter((d) => d.is_holiday_duty).length;
  const holidayExtraPay = duties.reduce(
    (acc, d) => acc + Number(d.holiday_allowance ?? 0),
    0,
  );

  /**
   * Binpagari Leave is the mirror image of a worked holiday: one earns extra
   * pay, the other costs a day's salary. Counted from the per-day rows, so a
   * range split across leave types only charges the days actually taken as
   * Binpagari, and a half day costs half a day's pay.
   *
   * The rate is the officer's own from Settings; at 0 the tile reports the
   * days and says the rate is unset rather than claiming a cut of zero.
   */
  const binpagariDays = (periodLeaveDays ?? []).reduce((acc, d) => {
    const lt = d.leave_types as unknown as { code: string | null } | null;
    return lt?.code?.toUpperCase() === "LWP" ? acc + Number(d.fraction ?? 1) : acc;
  }, 0);
  const dailySalaryRate = userSettings.dailySalaryRate;
  const binpagariDeduction = binpagariDays * dailySalaryRate;

  // ---- chart data -------------------------------------------------------

  const dutyTypeCounts = new Map<string, number>();
  for (const d of duties) {
    const name =
      (d.duty_types as unknown as { name: string } | null)?.name ?? "Other";
    dutyTypeCounts.set(name, (dutyTypeCounts.get(name) ?? 0) + 1);
  }
  const dutyTypeData = [...dutyTypeCounts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const leaveUsage = new Map<string, { value: number; color: string | null }>();
  if ((periodLeaveDays ?? []).length > 0) {
    for (const d of periodLeaveDays ?? []) {
      const lt = d.leave_types as unknown as { name: string; color: string | null } | null;
      const name = lt?.name ?? "Leave";
      const days = Number(d.fraction ?? 1);
      const prev = leaveUsage.get(name);
      leaveUsage.set(name, {
        value: (prev?.value ?? 0) + days,
        color: lt?.color ?? null,
      });
    }
  } else {
    for (const l of periodLeaves ?? []) {
      const lt = l.leave_types as unknown as {
        name: string;
        color: string | null;
      } | null;
      const name = lt?.name ?? "Leave";
      const days = leaveDaysOf(l);
      const prev = leaveUsage.get(name);
      leaveUsage.set(name, {
        value: (prev?.value ?? 0) + days,
        color: lt?.color ?? null,
      });
    }
  }
  const leaveUsageData = [...leaveUsage.entries()]
    .map(([name, v]) => ({ name, value: v.value, color: v.color }))
    .sort((a, b) => b.value - a.value);

  const monthlyTa = MONTH_NAMES.map((name) => ({ name, value: 0 }));
  for (const d of yearDuties ?? []) {
    monthlyTa[new Date(d.starts_at).getMonth()].value += d.ta_amount ?? 0;
  }

  const activeBalances = (balances ?? []).filter(
    (b) => !disabledTypeIds.has(b.leave_type_id),
  );
  const activeNextYearBalances = (nextYearBalances ?? []).filter(
    (b) => !disabledTypeIds.has(b.leave_type_id),
  );
  const activeLeaveTypes = (allLeaveTypes ?? []).filter(
    (t) => !disabledTypeIds.has(t.id) && t.is_active !== false,
  );

  const holidayLeaveType = (allLeaveTypes ?? []).find((t) => isHolidayLeaveType(t));
  const holidayLeaveTypeId = holidayLeaveType?.id;
  const yearHolidayDutyCount = (yearDuties ?? []).filter((d) => d.is_holiday_duty).length;

  const totalAllocated = activeBalances.reduce(
    (a, b) => a + Number(b.allocated ?? 0),
    0,
  );
  // For Holiday Leave, leave_balance_view adds worked holidays into b.used.
  // We subtract yearHolidayDutyCount so that "Taken" reflects actual leaves taken by the officer,
  // preventing worked holidays from inflating the leave taken tally.
  const totalUsed = activeBalances.reduce((a, b) => {
    if (holidayLeaveTypeId && b.leave_type_id === holidayLeaveTypeId) {
      return a + Math.max(0, Number(b.used ?? 0) - yearHolidayDutyCount);
    }
    return a + Number(b.used ?? 0);
  }, 0);
  // Remaining quota available = Allocated - Leaves Taken - Worked Holidays
  const totalRemaining = Math.max(0, totalAllocated - totalUsed - yearHolidayDutyCount);

  // Working days in the period = duties that were not worked holidays.
  const workingDutyCount = dutyCount - holidayDutyCount;

  return (
    <>
      {/* Leave-year alerts. Both render nothing when there is nothing to say,
          so this is an empty node for most of the year. It sits above the
          tiles because acting on it is more urgent than reading them. */}
      <LeaveYearAlerts
        rows={activeBalances}
        nextYearRows={activeNextYearBalances}
        types={activeLeaveTypes.map((t) => ({
          id: t.id,
          name: t.name,
          color: t.color,
          isSystem: isHolidayLeaveType(t),
        }))}
        year={year}
      />

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4.5">
        <StatCard
          title="Duty Logs"
          value={dutyCount}
          icon={Briefcase}
          color="indigo"
          trend={periodLabel}
          href={`/duty?${dutyLinkParams}`}
        />
        {/* Holidays that OCCURRED vs holidays WORKED are different numbers,
            and only the worked ones earn pay — so the tile leads with the
            worked count and shows the total behind it. */}
        <StatCard
          title="Holidays Worked"
          value={`${holidayDutyCount} of ${holidaysInPeriod}`}
          icon={Calendar}
          color="amber"
          trend={`${formatCurrency(holidayExtraPay)} extra pay`}
          href={`/duty?dayType=holiday&${dutyLinkParams}`}
        />
        <StatCard
          title="Total Leaves"
          value={formatDays(leaveDaysTotal)}
          icon={CalendarOff}
          color="rose"
          trend={periodLabel}
          href="/leave"
        />
        <StatCard
          title="Travel Distance"
          value={`${totalDistance.toLocaleString()} km`}
          icon={Compass}
          color="sky"
          trend={periodLabel}
          href={`/duty?${dutyLinkParams}`}
        />
        <StatCard
          title="TA Allowance"
          value={formatCurrency(totalTaAmount)}
          icon={IndianRupee}
          color="emerald"
          trend={periodLabel}
          // Five tiles leave an odd one out on a two-column phone and six do
          // not, so this stretches only when the Binpagari tile is absent.
          className={binpagariDays > 0 ? undefined : "col-span-2 sm:col-span-1"}
          href={`/duty?${dutyLinkParams}`}
        />
        {/* Only when there is unpaid leave to report: a permanent "0 days"
            tile would push a real figure off a phone screen for nothing. */}
        {binpagariDays > 0 && (
          <StatCard
            title="Binpagari"
            value={formatDays(binpagariDays)}
            icon={IndianRupee}
            color="rose"
            trend={
              dailySalaryRate > 0
                ? `-${formatCurrency(binpagariDeduction)} salary`
                : "Set daily rate in Settings"
            }
            // A sixth tile would sit alone at the end of a five-column row.
            // Measured: widening the grid to six instead starts truncating
            // the tiles that were already there, so this one takes the last
            // row whole -- which also leaves the deduction room to read in
            // full rather than as "-₹5,000 salar…".
            // Half width on a phone so six tiles make three even rows. At xl
            // a sixth tile would sit alone at the end of a five-column row,
            // and widening the grid to six truncates the tiles that were
            // already there -- so it takes that last row whole instead.
            className="xl:col-span-5"
            href="/leave"
          />
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DutyTypeDonut data={dutyTypeData} />
        <WorkedDaysDonut working={workingDutyCount} holiday={holidayDutyCount} />
        <LeaveUsageBar data={leaveUsageData} />
        <MonthlyTaBar data={monthlyTa} />
      </div>

      {/* Whole-year leave position, independent of the period filter above. */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-foreground">
              Leave Position for {year}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Entitlement against days taken, across every leave type.
            </p>
          </div>
          <Link
            href="/leave/balance"
            className="text-[11px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Full breakdown
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Allocated
            </p>
            <p className="text-xl font-bold text-foreground">{totalAllocated}</p>
            <span className="mt-0.5 block text-[10px] font-medium text-muted-foreground">
              total quota
            </span>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Taken
            </p>
            <p className="text-xl font-bold text-foreground">{totalUsed}</p>
            <span className="mt-0.5 block text-[10px] font-medium text-rose-600 dark:text-rose-400">
              leaves taken
            </span>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Worked
            </p>
            <p className="text-xl font-bold text-foreground">{yearHolidayDutyCount}</p>
            <span className="mt-0.5 block text-[10px] font-medium text-amber-600 dark:text-amber-400">
              holiday {yearHolidayDutyCount === 1 ? "duty" : "duties"}
            </span>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Remaining
            </p>
            <p
              className={`text-xl font-bold ${
                totalRemaining < 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground"
              }`}
            >
              {totalRemaining}
            </p>
            <span className="mt-0.5 block text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              available quota
            </span>
          </div>
        </div>
      </div>

      {/* Duty & Allowance Summary Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-indigo-500/10 via-amber-500/10 to-emerald-500/10 border border-indigo-500/20 shadow-xs">
        <div className="space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
            <IndianRupee className="size-3.5" />
            <span>Duty & Allowance Breakdown (ભથ્થાં અને રજાના દિવસની ગણતરી)</span>
          </span>
          <p className="text-xs sm:text-sm font-semibold text-foreground">
            {/* Reads the selected period rather than hardcoding "Year-to-date".
                The figures always followed the filter; only this sentence did
                not, so a month's numbers were presented as a year's. */}
            <span className="text-foreground">{periodLabel}</span>:{" "}
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalTaAmount)}
            </span>{" "}
            claimed in Travelling Allowance across {totalDistance.toLocaleString()} km,
            with{" "}
            <span className="font-bold text-amber-600 dark:text-amber-400">
              {holidayDutyCount} holiday{holidayDutyCount === 1 ? "" : "s"} worked
            </span>{" "}
            for{" "}
            <span className="font-bold text-amber-600 dark:text-amber-400">
              {formatCurrency(holidayExtraPay)}
            </span>{" "}
            extra pay
            {binpagariDays > 0 && (
              <>
                , and{" "}
                <span className="font-bold text-rose-600 dark:text-rose-400">
                  {formatDays(binpagariDays)} Binpagari
                </span>{" "}
                {dailySalaryRate > 0 ? (
                  <>
                    cutting{" "}
                    <span className="font-bold text-rose-600 dark:text-rose-400">
                      {formatCurrency(binpagariDeduction)}
                    </span>{" "}
                    from salary at {formatCurrency(dailySalaryRate)}/day
                  </>
                ) : (
                  <>unpaid (set a daily salary rate in Settings to price it)</>
                )}
              </>
            )}
            .
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/calendar"
            className="px-3.5 py-2 rounded-xl bg-card border border-border text-xs font-bold text-foreground hover:bg-muted shadow-2xs transition-colors"
          >
            View Calendar
          </Link>
          <Link
            href="/duty"
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-xs transition-colors"
          >
            Duty Register
          </Link>
        </div>
      </div>

      {/* Main Grid: Recent Duties & Recent Leaves */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Duties (2 columns wide on desktop) */}
        <div className="lg:col-span-2">
          <Card className="h-full flex flex-col justify-between">
            <div>
              <CardHeader
                title="My Recent Duty Logs"
                description="Latest shift assignments and travel records"
                action={
                  <Link
                    href="/duty"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <span>View all</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                }
              />

              {/* Mobile gets stacked cards; the five-column table only appears
                  where there is room for it. It used to be the table at every
                  width with overflow-x-auto, which on a phone squeezed every
                  column to a few characters and hid the rest sideways. */}
              <div className={`flex flex-col gap-2 md:hidden ${RECENT_SCROLL_CARDS}`}>
                {(recentDuties ?? []).map((d) => {
                  const typeName =
                    (d.duty_types as unknown as { name: string } | null)?.name ??
                    "Standard Duty";
                  return (
                    <Link
                      key={d.id}
                      href={`/duty/${d.id}`}
                      className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-muted/30 p-3 transition-colors hover:bg-muted/60"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-foreground">
                          {typeName}
                        </span>
                        {d.ta_amount ? (
                          <Badge variant="success">{formatCurrency(d.ta_amount)}</Badge>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Clock className="size-3 shrink-0 text-slate-400" />
                        <span>{formatDateTime(d.starts_at, timeFormat)}</span>
                      </div>
                      {d.location && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <MapPin className="size-3 shrink-0 text-slate-400" />
                          <span className="truncate">{d.location}</span>
                        </div>
                      )}
                    </Link>
                  );
                })}
                {(recentDuties ?? []).length === 0 && (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    No duties logged yet this year.
                  </p>
                )}
              </div>

              <div className={`hidden md:block ${RECENT_SCROLL_TABLE}`}>
                <table className="w-full text-left text-xs sm:text-sm">
                  {/* sticky, so the columns stay labelled once the list
                      scrolls past the first few rows */}
                  <thead className="sticky top-0 z-10 bg-card">
                    <tr className="border-b border-border/60 text-muted-foreground font-medium">
                      <th className="pb-3 font-medium">Duty Type</th>
                      <th className="pb-3 font-medium">Timing</th>
                      <th className="pb-3 font-medium">Location</th>
                      <th className="pb-3 font-medium">TA</th>
                      <th className="pb-3 font-medium text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {(recentDuties ?? []).map((d) => (
                      <tr key={d.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3.5 font-medium text-foreground">
                          {(d.duty_types as unknown as { name: string } | null)?.name ?? "Standard Duty"}
                        </td>
                        <td className="py-3.5 text-muted-foreground whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Clock className="size-3.5 text-slate-400" />
                            <span>{formatDateTime(d.starts_at, timeFormat)}</span>
                          </div>
                        </td>
                        <td className="py-3.5 text-muted-foreground">
                          {d.location ? (
                            <div className="flex items-center gap-1">
                              <MapPin className="size-3 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[140px]">{d.location}</span>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-3.5">
                          {d.ta_amount ? (
                            <Badge variant="success">
                              {formatCurrency(d.ta_amount)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3.5 text-right">
                          <Link
                            href={`/duty/${d.id}`}
                            className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-2xs"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {(recentDuties ?? []).length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                          No duties logged yet this year.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-4 mt-auto border-t border-border/60 flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                Showing most recent {(recentDuties ?? []).length} record
                {(recentDuties ?? []).length === 1 ? "" : "s"}
              </span>
              <Link
                href="/duty/new"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 flex items-center gap-1"
              >
                <Plus className="size-3.5" />
                <span>Log shift</span>
              </Link>
            </div>
          </Card>
        </div>

        {/* Recent Leaves & Quick Shortcuts */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Recent Leave Logs"
              description="Your absence records"
              action={
                <Link
                  href="/leave"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <span>Balance</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              }
            />

            <div className={`flex flex-col gap-2.5 ${RECENT_SCROLL_TABLE}`}>
              {(recentLeaves ?? []).map((l) => {
                const leaveType = l.leave_types as unknown as {
                  name: string;
                  color: string | null;
                } | null;
                const breakdown = recentBreakdownFor(l.id);
                return (
                <div
                  key={l.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-xl bg-muted/40 border border-border/60 hover:bg-muted/70 transition-colors"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    {breakdown ? (
                      <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        <Sparkles className="size-3 text-indigo-500 shrink-0" />
                        <span className="truncate">Multi-Type ({breakdown.map((b) => `${b.days} ${b.code}`).join(", ")})</span>
                      </span>
                    ) : (
                      <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-foreground">
                        <ColorDot color={leaveType?.color} label={leaveType?.name ?? "Leave"} />
                        <span className="truncate">{leaveType?.name ?? "Leave"}</span>
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDateRange(l.start_date, l.end_date)}
                      {l.is_half_day ? ` (${l.half_day_session} half-day)` : ""}
                    </span>
                  </div>
                  <Badge variant="purple">Logged</Badge>
                </div>
                );
              })}

              {(recentLeaves ?? []).length === 0 && (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No leave requests recorded recently.
                </div>
              )}
            </div>
          </Card>

          {/* Quick Hub Card */}
          <Card className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white border-indigo-800/60 p-5">
            <h4 className="text-sm font-bold text-white mb-1">Roster & Calendar</h4>
            <p className="text-xs text-slate-300 mb-4">
              Check upcoming departmental duty schedules and government holidays.
            </p>
            <Link
              href="/calendar"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-white text-indigo-900 py-2.5 px-4 text-xs font-semibold hover:bg-indigo-50 transition-colors shadow-sm"
            >
              <Calendar className="size-4 text-indigo-600" />
              <span>Open Calendar View</span>
            </Link>
          </Card>
        </div>
      </div>

      {/* Career Timeline & Postings (Full-width row across dashboard) */}
      <div className="w-full">
        <CompactCareerTimeline
          events={(timelineEvents ?? []) as unknown as TimelineEventItem[]}
          canEdit={false}
        />
      </div>
    </>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const user = await getCurrentUser();

  if (user?.role === "SUPER_ADMIN") {
    redirect("/admin/dashboard");
  }

  // Nothing here touches the database: the shell and the filter must paint
  // before any query runs, which is the whole point of the split below.
  const params = await searchParams;
  const timeFormat = user?.timeFormat ?? "24h";
  const now = new Date();
  const userId = user?.id ?? "";

  // The overview defaults to the current month; "all" widens it to the year.
  // Clamped, not trusted: a hand-typed ?year=1900 must not reach the queries,
  // and must not ask leave_balance_view for a year it does not materialise.
  const year = clampYear(params.year);
  const monthParam = params.month ?? String(now.getMonth() + 1);
  const isWholeYear = monthParam === "all";
  const month = isWholeYear
    ? null
    : Math.min(12, Math.max(1, Number(monthParam) || now.getMonth() + 1));

  const periodStart = isWholeYear
    ? new Date(year, 0, 1)
    : new Date(year, (month as number) - 1, 1);
  const periodEnd = isWholeYear
    ? new Date(year, 11, 31, 23, 59, 59, 999)
    : new Date(year, month as number, 0, 23, 59, 59, 999);

  const periodLabel = isWholeYear
    ? String(year)
    : `${MONTH_NAMES[(month as number) - 1]} ${year}`;

  const thisMonth = now.getMonth() + 1;
  const thisYear = now.getFullYear();
  const PERIOD_PRESETS = [
    {
      label: "This month",
      query: new URLSearchParams({
        month: String(thisMonth),
        year: String(thisYear),
      }).toString(),
      active: !isWholeYear && month === thisMonth && year === thisYear,
    },
    {
      label: "This year",
      query: new URLSearchParams({ month: "all", year: String(thisYear) }).toString(),
      active: isWholeYear && year === thisYear,
    },
  ];

  // Every KPI tile links into the duty log filtered to the same period, so
  // the number you clicked is the list you land on.
  const dutyLinkParams = new URLSearchParams({
    from: toDateKey(periodStart),
    to: toDateKey(periodEnd),
  }).toString();

  return (
    <main className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-7xl 2xl:max-w-full mx-auto space-y-8">
      {/* Top Page Header (Responsive layout: on mobile, user badge & action buttons share one row) */}
      <div className="flex flex-col gap-2.5 pb-3 border-b border-border/70 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/* Row 1: Welcome title + Desktop Badge */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-balance text-foreground sm:text-2xl xl:text-3xl">
              Welcome back, {user?.fullName}
            </h1>
            <span className="hidden sm:inline-flex shrink-0">
              <Badge variant="purple" dot>
                {user?.role?.replace("_", " ") ?? "Officer"}
              </Badge>
            </span>
          </div>

          {/* Row 2 on Mobile: Badge on Left, Action buttons on Right in one row */}
          <div className="flex items-center justify-between gap-2 sm:hidden pt-0.5">
            <span className="shrink-0">
              <Badge variant="purple" dot>
                {user?.role?.replace("_", " ") ?? "Officer"}
              </Badge>
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/leave/new"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted shadow-xs transition-colors"
              >
                <CalendarOff className="size-3.5 text-purple-500" />
                <span>Log Leave</span>
              </Link>
              <Link
                href="/duty/new"
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-indigo-600/25 hover:bg-indigo-500 transition-colors"
              >
                <Plus className="size-3.5" />
                <span>Log New Duty</span>
              </Link>
            </div>
          </div>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm text-muted-foreground">
            Manage and monitor your duty shifts, travel claims, and leave schedule.
          </p>
        </div>

        {/* Desktop Actions (Hidden on mobile since rendered in row 2 above) */}
        <div className="hidden sm:flex items-center gap-2.5 shrink-0">
          <Link
            href="/leave/new"
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs sm:text-sm font-medium text-foreground hover:bg-muted hover:text-foreground shadow-xs transition-colors"
          >
            <CalendarOff className="size-4 text-purple-500" />
            <span>Log Leave</span>
          </Link>
          <Link
            href="/duty/new"
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-md shadow-indigo-600/25 hover:bg-indigo-500 transition-colors"
          >
            <Plus className="size-4" />
            <span>Log New Duty</span>
          </Link>
        </div>
      </div>

      {/* Period filter. The whole overview below reflects it, and every tile
          links into the duty log filtered to the same window. */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-xs">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Overview period
        </span>

        {/* The dropdowns can already express these, but the two periods people
            actually want should not need two selections to reach. */}
        <div className="flex items-center gap-1.5">
          {PERIOD_PRESETS.map((preset) => (
            <Link
              key={preset.label}
              href={`/dashboard?${preset.query}`}
              aria-current={preset.active ? "true" : undefined}
              className={`rounded-xl px-3 py-1.5 text-[11px] font-bold transition-colors ${
                preset.active
                  ? "bg-indigo-600 text-white shadow-xs shadow-indigo-600/25"
                  : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {preset.label}
            </Link>
          ))}
        </div>

        <div className="w-36">
          <FilterSelect
            paramName="month"
            placeholder="Whole year"
            value={monthParam}
            icon="calendar"
            options={[
              { value: "all", label: "Whole year" },
              ...MONTH_NAMES.map((m, i) => ({
                value: String(i + 1),
                label: m,
              })),
            ]}
          />
        </div>
        <div className="w-28">
          <FilterSelect
            paramName="year"
            placeholder={String(year)}
            value={String(year)}
            clearable={false}
            icon="calendar"
            options={getYearOptions(3, 1)}
          />
        </div>
        <span className="ml-auto text-[11px] text-muted-foreground">
          Showing <span className="font-bold text-foreground">{periodLabel}</span>
        </span>
      </div>

      {/* The skeleton here is the same one the route-level loading.tsx uses,
          so the transition from one to the other is invisible. */}
      <Suspense
        key={`${year}-${monthParam}`}
        fallback={<DashboardBodySkeleton />}
      >
        <DashboardBody
          userId={userId}
          periodStart={periodStart}
          periodEnd={periodEnd}
          periodLabel={periodLabel}
          isWholeYear={isWholeYear}
          year={year}
          now={now}
          timeFormat={timeFormat}
          dutyLinkParams={dutyLinkParams}
        />
      </Suspense>
    </main>
  );
}
