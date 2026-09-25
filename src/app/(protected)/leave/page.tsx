import { NavLink as Link } from "@/components/ui/nav-link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { formatDateRange } from "@/lib/format/datetime";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ColorDot } from "@/components/ui/color-dot";
import { PageHeader } from "@/components/ui/page-header";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { SearchInput } from "@/components/ui/search-input";
import { FilterSelect } from "@/components/ui/filter-select";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { DeleteLeaveButton } from "@/components/leave/delete-leave-button";
import {
  CalendarOff,
  Plus,
  Scale,
  Calendar,
  Clock,
  Edit2,
  Trash2,
  User,
  ArrowRight,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { SpecialLeaveManager } from "@/components/leave/special-leave-manager";
import { LeaveNavTabs } from "./leave-nav-tabs";
import { getYearOptions, clampYear } from "@/lib/format/year";
import { isSpecialLeaveSanctionExpired } from "@/lib/leave/specialLeaveRules";
import { toDateKey } from "@/lib/format/datetime";
import {
  leaveDayCount,
  leaveDaysWithin,
  formatDays,
  summariseBreakdown,
} from "@/lib/leave/leaveDays";

type ChargedEntry = { code: string; days: number; color: string | null };

/** "Charged as ● 3 CL ● 2 HL" — each type in its own leave colour. */
function ChargedAs({ entries, label }: { entries: ChargedEntry[] | null; label?: string }) {
  if (!entries) return null;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-medium text-muted-foreground">
      {label && <span>{label}</span>}
      {entries.map((e) => (
        <span
          key={e.code}
          className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-card px-1.5 py-0.5 font-semibold text-foreground whitespace-nowrap"
        >
          <ColorDot color={e.color} label={e.code} />
          {Number.isInteger(e.days) ? e.days : e.days.toFixed(1)} {e.code}
        </span>
      ))}
    </span>
  );
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    search?: string;
    leaveTypeId?: string;
    userId?: string;
    month?: string;
    year?: string;
    from?: string;
    to?: string;
    page?: string;
    limit?: string;
    /** Set by the header's "Apply for Sanction" button. */
    apply?: string;
  }>;
}) {
  const {
    tab = "logs",
    search,
    leaveTypeId,
    userId,
    month: rawMonth,
    year,
    from: rawFrom,
    to: rawTo,
    page = "1",
    limit = "15",
    apply,
  } = await searchParams;
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.max(5, parseInt(limit, 10) || 15);

  const now = new Date();
  const hasExplicitRange = Boolean(rawFrom || rawTo);
  const selectedYear = clampYear(year);

  // "all" is a deliberate choice; absent means nobody has chosen yet -> current month default!
  const monthParam = rawMonth ?? (hasExplicitRange || year ? "all" : String(now.getMonth() + 1));
  const selectedMonth =
    monthParam === "all" ? null : Math.min(12, Math.max(1, Number(monthParam) || 1));

  let fromDate = rawFrom;
  let toDate = rawTo;
  if (!hasExplicitRange) {
    const start = selectedMonth
      ? new Date(selectedYear, selectedMonth - 1, 1)
      : new Date(selectedYear, 0, 1);
    const end = selectedMonth
      ? new Date(selectedYear, selectedMonth, 0)
      : new Date(selectedYear, 11, 31);
    fromDate = toDateKey(start);
    toDate = toDateKey(end);
  }

  const supabase = await createClient();
  const me = await getCurrentUser();
  const isSuperAdmin = me?.role === "SUPER_ADMIN";

  const yearOptions = getYearOptions(3, 1);

  // Fetch leave types, users, and Special Leave data
  const [
    { data: leaveTypes },
    { data: usersList },
    { data: splApplications },
    { data: approvalTypesData },
  ] = await Promise.all([
    supabase.from("leave_types").select("id, name").order("name"),
    isSuperAdmin
      ? supabase.from("users").select("id, full_name").order("full_name")
      : Promise.resolve({ data: [] }),
    supabase
      .from("special_leave_applications")
      .select("id, leave_type_id, year, applied_date, applied_days, reason, status, approved_date, approved_by, approved_days, order_no, valid_from, valid_to, expires_at, leave_types(name, code, color)")
      .eq("user_id", me?.id ?? "")
      // A sanction is stamped with the year it was applied for, but it stays
      // valid for 6 months from approval -- so one approved late in a year is
      // still usable well into the next. Pulling the prior year too lets a
      // still-live sanction follow the officer across 31 December; six months
      // can only ever cross one New Year, so one year back is the whole set.
      .in("year", [selectedYear, selectedYear - 1])
      .order("applied_date", { ascending: false }),
    supabase
      .from("leave_types")
      .select("id, name, code, color")
      .in("code", ["SPL", "LWP"])
      .order("code", { ascending: false }),
  ]);

  const approvalLeaveTypes = (approvalTypesData ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    code: t.code,
    color: t.color,
  }));
  const splTypeId = approvalLeaveTypes.find((t) => t.code === "SPL")?.id;
  const { data: splBalance } = splTypeId
    ? await supabase
        .from("leave_balance_view")
        .select("allocated, carried_in, total_available, used, remaining")
        .eq("user_id", me?.id ?? "")
        .eq("leave_type_id", splTypeId)
        .eq("year", selectedYear)
        .maybeSingle()
    : { data: null };

  const splAppIds = (splApplications ?? []).map((a) => a.id);
  const splLogsMap = new Map<string, number>();
  if (splAppIds.length > 0) {
    const { data: splLogs } = await supabase
      .from("leave_logs")
      .select("special_leave_application_id, start_date, end_date, is_half_day")
      .in("special_leave_application_id", splAppIds);

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

  const specialLeaveAppsWithLogged = (splApplications ?? [])
    .map((a: any) => ({
      id: a.id,
      leave_type_id: a.leave_type_id,
      leave_type: a.leave_types,
      applied_date: a.applied_date,
      applied_days: Number(a.applied_days),
      reason: a.reason,
      status: a.status as any,
      approved_date: a.approved_date,
      approved_by: a.approved_by,
      approved_days: a.approved_days ? Number(a.approved_days) : null,
      order_no: a.order_no,
      valid_from: a.valid_from,
      valid_to: a.valid_to,
      expires_at: a.expires_at,
      logged_days: splLogsMap.get(a.id) ?? 0,
      year: Number(a.year ?? selectedYear),
    }))
    .filter((a) => {
      // This year's own records all stay, whatever their state -- the tab is
      // the register, and a used-up or refused application is still history.
      if (a.year === selectedYear) return true;
      // A record from last year only follows the officer forward while it is
      // still worth something: approved, unexpired, and with days left. Once
      // it is spent or lapsed it belongs to the year it was filed under.
      if (a.status !== "APPROVED") return false;
      if (isSpecialLeaveSanctionExpired(a)) return false;
      return Number(a.approved_days ?? 0) - a.logged_days > 0;
    });

  const pendingSplCount = specialLeaveAppsWithLogged.filter(
    (a) => a.status === "PENDING",
  ).length;

  // Build query
  let query = supabase
    .from("leave_logs")
    .select(
      "id, user_id, start_date, end_date, is_half_day, half_day_session, reason, special_leave_application_id, leave_types(name, color), users!leave_requests_user_id_fkey(full_name)",
      { count: "exact" }
    )
    .order("start_date", { ascending: false });

  if (leaveTypeId) {
    const [{ data: matchingDays }, { data: matchingParentLogs }] = await Promise.all([
      supabase.from("leave_log_days").select("leave_log_id").eq("leave_type_id", leaveTypeId),
      supabase.from("leave_logs").select("id").eq("leave_type_id", leaveTypeId),
    ]);
    const matchingLogIds = Array.from(
      new Set([
        ...(matchingDays ?? []).map((d) => d.leave_log_id),
        ...(matchingParentLogs ?? []).map((l) => l.id),
      ]),
    );
    query = query.in(
      "id",
      matchingLogIds.length > 0 ? matchingLogIds : ["00000000-0000-0000-0000-000000000000"],
    );
  }

  if (userId) {
    query = query.eq("user_id", userId);
  }

  if (fromDate) {
    query = query.gte("end_date", fromDate);
  }

  if (toDate) {
    query = query.lte("start_date", toDate);
  }

  if (search) {
    query = query.ilike("reason", `%${search}%`);
  }

  // Pagination range
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data: logs, count: totalCount } = await query;
  const totalItems = totalCount ?? 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  // The headline is DAYS across every filtered entry, not the row count of
  // this page: a single week off is one entry but seven days.
  let totalLeaveDays = 0;
  if (leaveTypeId) {
    let dayTotalsQuery = supabase
      .from("leave_log_days")
      .select("fraction, leave_date")
      .eq("leave_type_id", leaveTypeId);
    if (userId) dayTotalsQuery = dayTotalsQuery.eq("user_id", userId);
    if (fromDate) dayTotalsQuery = dayTotalsQuery.gte("leave_date", fromDate);
    if (toDate) dayTotalsQuery = dayTotalsQuery.lte("leave_date", toDate);
    const { data: matchedDayRows } = await dayTotalsQuery;
    totalLeaveDays = (matchedDayRows ?? []).reduce((a, d) => a + Number(d.fraction ?? 1), 0);
  } else {
    let totalsQuery = supabase.from("leave_logs").select("start_date, end_date, is_half_day");
    if (userId) totalsQuery = totalsQuery.eq("user_id", userId);
    if (fromDate) totalsQuery = totalsQuery.gte("end_date", fromDate);
    if (toDate) totalsQuery = totalsQuery.lte("start_date", toDate);
    if (search) totalsQuery = totalsQuery.ilike("reason", `%${search}%`);
    const { data: totalsRows } = await totalsQuery;
    totalLeaveDays = (totalsRows ?? []).reduce(
      (a, l) => a + leaveDaysWithin(l.start_date, l.end_date, l.is_half_day, fromDate, toDate),
      0,
    );
  }

  const pageIds = (logs ?? []).map((l) => l.id);
  const [{ data: dayRows }] = await Promise.all([
    // How the engine split each entry on this page (CL / HL / OH / SPL).
    supabase
      .from("leave_log_days")
      .select("leave_log_id, fraction, leave_types(code, name, color)")
      .in("leave_log_id", pageIds.length > 0 ? pageIds : ["00000000-0000-0000-0000-000000000000"]),
  ]);

  const daysByLog = new Map<string, { code: string; color: string | null; fraction: number }[]>();
  for (const r of dayRows ?? []) {
    const t = r.leave_types as unknown as {
      code: string | null;
      name: string;
      color: string | null;
    } | null;
    const list = daysByLog.get(r.leave_log_id) ?? [];
    list.push({
      code: t?.code || t?.name || "Leave",
      color: t?.color ?? null,
      fraction: Number(r.fraction),
    });
    daysByLog.set(r.leave_log_id, list);
  }
  /** [{3 CL, colour}, {2 HL, colour}] when an entry spans more than one type, else null. */
  const breakdownFor = (logId: string): ChargedEntry[] | null => {
    const rows = daysByLog.get(logId) ?? [];
    const summary = summariseBreakdown(rows);
    if (summary.length <= 1) return null;
    const colorOf = new Map(rows.map((r) => [r.code, r.color]));
    return summary.map((s) => ({ ...s, color: colorOf.get(s.code) ?? null }));
  };

  return (
    <main className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-7xl 2xl:max-w-full mx-auto space-y-6">
      {/* Top Header with Emerald / Teal Theme */}
      <PageHeader
        title={isSuperAdmin ? "Officer Leave Records" : "Leave Log Book"}
        subtitle={
          isSuperAdmin
            ? "Master register of all officer leave applications, absence records, and sessions."
            : "Manage and track officer absence requests, entitlements, and sessions."
        }
        badge={
          /* The badge describes whatever the tab is showing. "Total Leaves"
             counts days off from the leave logs, which says nothing about a
             list of sanction applications -- on that tab it read as a day
             count of records that are not days at all. */
          tab === "special" ? (
            /* Badge is whitespace-nowrap inside a shrink-0 wrapper, so it can
               neither wrap nor shrink: a long string here runs off a narrow
               phone rather than reflowing. The pending half is dropped below
               `sm`, where the tab's own badge already carries that count. */
            <Badge variant="info" dot>
              {specialLeaveAppsWithLogged.length}{" "}
              {specialLeaveAppsWithLogged.length === 1 ? "Sanction" : "Sanctions"}
              {pendingSplCount > 0 && (
                <span className="hidden sm:inline">
                  {/* &nbsp;, not a plain space: JSX trims the whitespace at
                      the start of a line, which ran this straight into the
                      word before it. */}
                  &nbsp;&middot; {pendingSplCount} pending
                </span>
              )}
            </Badge>
          ) : (
            <Badge variant="success" dot>
              Total Leaves: {formatDays(totalLeaveDays)}
            </Badge>
          )
        }
        compactActions
        actions={
          /* Both buttons ride on the title's row, so the label shortens on a
             phone rather than the pair wrapping to a row of their own. */
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {!isSuperAdmin && (
              <Link
                href="/leave/balance"
                aria-label="My Leave Balance"
                title="My Leave Balance"
                className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2 text-xs font-semibold text-emerald-700 shadow-2xs transition-colors hover:bg-emerald-500/20 dark:text-emerald-300 sm:gap-2 sm:px-3.5 sm:py-2.5 sm:text-sm"
              >
                <Scale className="size-4 shrink-0" />
                {/* Icon only on a phone. Measured: even the short label
                    "Balance" left the title 4px too little room and pushed
                    "Leave Log Book" onto a second line. The name is carried by
                    aria-label/title so it is neither silent to a screen reader
                    nor a guess on hover. */}
                <span className="hidden sm:inline">My Leave Balance</span>
              </Link>
            )}
            {/* The primary action follows the tab: logging leave belongs to
                the records tab, recording a sanction to the approvals tab. */}
            {tab === "special" ? (
              <Link
                href={`/leave?tab=special&year=${selectedYear}&apply=1`}
                scroll={false}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-transparent bg-gradient-to-r from-indigo-600 to-violet-600 px-2.5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 transition-all hover:from-indigo-500 hover:to-violet-500 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm"
              >
                <Plus className="size-4 shrink-0" />
                <span className="sm:hidden">Sanction</span>
                <span className="hidden sm:inline">Apply for Sanction</span>
              </Link>
            ) : (
              <Link
                href="/leave/new"
                className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-transparent bg-gradient-to-r from-emerald-600 to-teal-600 px-2.5 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-600/30 transition-all hover:from-emerald-500 hover:to-teal-500 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm"
              >
                <Plus className="size-4 shrink-0" />
                <span>Log Leave</span>
              </Link>
            )}
          </div>
        }
      />

      {/* Navigation Tabs between Leave Records and Special Leave Approvals in strictly ONE ROW */}
      <LeaveNavTabs
        activeTab={tab === "special" ? "special" : "records"}
        selectedYear={selectedYear}
        pendingSplCount={pendingSplCount}
      />

      {tab === "special" ? (
        <>
          {/* The sanctions query is already scoped to `year`; until now the
              only control for it lived in the records filter bar, which this
              tab hides -- so the year was fixed at whatever it happened to be. */}
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Sanction year
            </span>
            <div className="w-32">
              <FilterSelect
                paramName="year"
                placeholder={String(selectedYear)}
                value={String(selectedYear)}
                icon="calendar"
                clearable={false}
                options={yearOptions}
              />
            </div>
          </div>
          <SpecialLeaveManager
          applications={specialLeaveAppsWithLogged}
          balance={{
            year: selectedYear,
            allocated: Number(splBalance?.allocated ?? 0),
            carriedIn: Number(splBalance?.carried_in ?? 0),
            totalAvailable: Number(splBalance?.total_available ?? 0),
            used: Number(splBalance?.used ?? 0),
            remaining: Number(splBalance?.remaining ?? 0),
            splTypeId,
          }}
          approvalLeaveTypes={approvalLeaveTypes}
          autoOpenApply={apply === "1"}
        />
        </>
      ) : (
        <>
          {/* Filter and Search Bar */}
          <Card className="p-3.5 sm:p-4 space-y-3">
            {/* Top Tier: Search Bar & Clear Filter Action */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="w-full sm:max-w-md">
                <SearchInput
                  placeholder="Search by reason..."
                  defaultValue={search}
                />
              </div>

          {(search || leaveTypeId || userId || rawMonth || year || rawFrom || rawTo) && (
            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <Link
                href="/leave"
                className="h-9 inline-flex items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors shrink-0"
                title="Reset all filters"
              >
                Reset Filters
              </Link>
            </div>
          )}
        </div>

        {/* Bottom Tier: Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-border/50">
          {/* Officer Filter for Admins */}
          {isSuperAdmin && (usersList ?? []).length > 0 && (
            <div className="w-full sm:w-44">
              <FilterSelect
                paramName="userId"
                placeholder="All Officers"
                icon="user"
                options={(usersList ?? []).map((u) => ({
                  value: u.id,
                  label: u.full_name,
                }))}
              />
            </div>
          )}

          {/* Leave Type Filter */}
          {(leaveTypes ?? []).length > 0 && (
            <div className="w-full sm:w-36">
              <FilterSelect
                paramName="leaveTypeId"
                placeholder="All Types"
                icon="calendar"
                options={(leaveTypes ?? []).map((lt) => ({
                  value: lt.id,
                  label: lt.name,
                }))}
              />
            </div>
          )}

          {/* Month Filter - defaults to current month */}
          <div className="w-full sm:w-36">
            <FilterSelect
              paramName="month"
              placeholder="All months"
              value={monthParam}
              icon="calendar"
              clearable={false}
              options={[
                { value: "all", label: "All months" },
                ...MONTH_NAMES.map((m, i) => ({ value: String(i + 1), label: m })),
              ]}
            />
          </div>

          {/* Year Filter */}
          <div className="w-full sm:w-28">
            <FilterSelect
              paramName="year"
              placeholder={String(selectedYear)}
              value={hasExplicitRange && !year ? undefined : String(selectedYear)}
              icon="calendar"
              clearable={false}
              options={yearOptions}
            />
          </div>

          {/* Date Range Filter */}
          <div className="w-full sm:w-44">
            <DateRangeFilter
              fromParamName="from"
              toParamName="to"
              label="Date Range"
            />
          </div>
        </div>
      </Card>

      {/* Container with Desktop Table AND Mobile Card View */}
      <Card className="p-0 overflow-hidden">
        {/* Desktop Table: Hidden on Mobile */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[11px] font-semibold tracking-wider">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">Officer</th>
                <th className="py-3.5 px-4">Leave Type</th>
                <th className="py-3.5 px-4">Period / Dates</th>
                <th className="py-3.5 px-4">Days</th>
                <th className="py-3.5 px-4">Session</th>
                <th className="py-3.5 px-4">Reason / Notes</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {(logs ?? []).map((l) => {
                const officer = l.users as unknown as { full_name: string } | null;
                const leaveType = l.leave_types as unknown as {
                  name: string;
                  color: string | null;
                } | null;
                const isOwn = l.user_id === me?.id;
                const breakdown = breakdownFor(l.id);
                const isMultiType = breakdown && breakdown.length > 1;

                return (
                  <tr
                    key={l.id}
                    className="hover:bg-muted/30 transition-colors group"
                  >
                    <td className="py-3.5 px-4 sm:px-6 font-semibold text-foreground whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <User className="size-3.5 text-slate-400" />
                        <span>{officer?.full_name ?? "—"}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {isMultiType ? (
                        <Badge
                          variant="secondary"
                          className="border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-semibold inline-flex items-center gap-1.5"
                          title={`Multi-Type: ${breakdown.map((b) => `${b.days} ${b.code}`).join(", ")}`}
                        >
                          <Sparkles className="size-3 text-indigo-500 shrink-0" />
                          <span>Multi-Type</span>
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <ColorDot
                            color={leaveType?.color}
                            label={leaveType?.name ?? "Leave"}
                          />
                          {leaveType?.name ?? "Leave"}
                        </Badge>
                      )}
                      {l.special_leave_application_id && (
                        <Badge variant="info" className="ml-1.5 text-[10px]">
                          Sanctioned
                        </Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="size-3.5 text-slate-400" />
                        <span>{formatDateRange(l.start_date, l.end_date)}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Badge variant="info">
                          {formatDays(leaveDayCount(l.start_date, l.end_date, l.is_half_day))}
                        </Badge>
                        <ChargedAs entries={breakdown} />
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {l.is_half_day ? (
                        <Badge variant="warning">
                          {l.half_day_session} Half-Day
                        </Badge>
                      ) : (
                        <Badge variant="outline">Full Day</Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">
                      <span className="truncate max-w-[220px] block">
                        {l.reason ?? "—"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                      {isOwn ? (
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/leave/${l.id}/edit`}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-2xs"
                          >
                            <Edit2 className="size-3" />
                            <span>Edit</span>
                          </Link>
                          <DeleteLeaveButton id={l.id} />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View: Shown ONLY on mobile (< md) */}
        <div className="md:hidden flex flex-col divide-y divide-border/60">
          {(logs ?? []).map((l) => {
            const officer = l.users as unknown as { full_name: string } | null;
            const leaveType = l.leave_types as unknown as {
              name: string;
              color: string | null;
            } | null;
            const isOwn = l.user_id === me?.id;
            const breakdown = breakdownFor(l.id);
            const isMultiType = breakdown && breakdown.length > 1;

            return (
              <div key={l.id} className="p-4 space-y-3 bg-card hover:bg-muted/20 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <User className="size-3.5 text-emerald-500" />
                      <span>{officer?.full_name ?? "Officer"}</span>
                    </span>
                    {isMultiType ? (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        <Sparkles className="size-3 text-indigo-500 shrink-0" />
                        <span>Multi-Type ({breakdown.map((b) => `${b.days} ${b.code}`).join(", ")})</span>
                      </span>
                    ) : (
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <ColorDot
                          color={leaveType?.color}
                          label={leaveType?.name ?? "Leave"}
                        />
                        <span className="truncate">{leaveType?.name ?? "Leave"}</span>
                      </span>
                    )}
                    {l.special_leave_application_id && (
                      <Badge variant="info" className="mt-1 text-[10px] py-0 px-1">
                        Sanctioned SPL
                      </Badge>
                    )}
                  </div>
                  {l.is_half_day ? (
                    <Badge variant="warning">{l.half_day_session} Half-Day</Badge>
                  ) : (
                    <Badge variant="outline">Full Day</Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs font-medium text-foreground bg-muted/40 p-2.5 rounded-xl border border-border/60">
                  <Calendar className="size-3.5 text-emerald-500 shrink-0" />
                  <span className="flex-1">{formatDateRange(l.start_date, l.end_date)}</span>
                  <Badge variant="info">
                    {formatDays(leaveDayCount(l.start_date, l.end_date, l.is_half_day))}
                  </Badge>
                </div>
                <ChargedAs entries={breakdownFor(l.id)} label="Charged as" />

                {l.reason && (
                  <p className="text-xs text-muted-foreground bg-muted/20 p-2.5 rounded-xl border border-border/40">
                    &quot;{l.reason}&quot;
                  </p>
                )}

                {isOwn && (
                  <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                    <Link
                      href={`/leave/${l.id}/edit`}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2 text-xs font-semibold text-foreground hover:bg-muted shadow-2xs transition-colors"
                    >
                      <Edit2 className="size-3" />
                      <span>Edit</span>
                    </Link>
                    <DeleteLeaveButton id={l.id} className="flex-1 py-2" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {(logs ?? []).length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <div className="flex flex-col items-center justify-center gap-2">
              <CalendarOff className="size-8 text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-medium text-foreground">
                No leave entries recorded
              </p>
              <p className="text-xs text-muted-foreground">
                Try modifying your search or log a new leave entry.
              </p>
            </div>
          </div>
        )}

        {/* Pagination Controls */}
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
        />
      </Card>
      </>
      )}
    </main>
  );
}
