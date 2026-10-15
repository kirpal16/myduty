import { NavLink as Link } from "@/components/ui/nav-link";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/format/currency";
import {
  formatDateTime,
  formatTime,
  toDateKey,
  localDayStart,
  localDayEnd,
} from "@/lib/format/datetime";
import { type Filterable, sanitizeSearch } from "@/lib/supabase/filters";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DutyHolidayBadge,
  DutyStatusBadge,
  DutyTaBadge,
} from "@/components/duty/duty-badges";
import { PageHeader } from "@/components/ui/page-header";
import { groupDutiesByDayOrGroup } from "@/lib/duty/groupDuties";
import { getUserSettings } from "@/lib/settings/getUserSettings";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { SearchInput } from "@/components/ui/search-input";
import { FilterSelect } from "@/components/ui/filter-select";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { CollapsibleFilterBar } from "@/components/ui/collapsible-filter-bar";
import {
  DutySelectionProvider,
  DutyRowCheckbox,
  DutySelectAllCheckbox,
  DutyTableSelectHeader,
  DutyTableSelectCell,
  DutyBulkActionBar,
} from "@/components/duty/duty-bulk-select";
import { DutySelectModeToggle } from "@/components/duty/duty-select-mode-toggle";
import { DutyRefreshButton } from "@/components/duty/duty-refresh-button";
import {
  Briefcase,
  Plus,
  Compass,
  IndianRupee,
  MapPin,
  ArrowRight,
  User,
  Sparkles,
  Route,
  Clock,
} from "lucide-react";
import { getYearOptions, clampYear } from "@/lib/format/year";
import {
  formatDutyTypeDropdownLabel,
  sortDutyTypesForDropdown,
  translateDutyTypeToGujarati,
  toGujaratiNumerals,
} from "@/lib/reports/gujaratiReportUtils";
import { getServerTranslations } from "@/lib/i18n/server";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const GUJARATI_MONTH_NAMES = [
  "જાન્યુઆરી", "ફેબ્રુઆરી", "માર્ચ", "એપ્રિલ", "મે", "જૂન",
  "જુલાઈ", "ઓગસ્ટ", "સપ્ટેમ્બર", "ઓક્ટોબર", "નવેમ્બર", "ડિસેમ્બર",
];

export default async function DutyListPage({
  searchParams,
}: {
  searchParams: Promise<{
    dayType?: string;
    search?: string;
    dutyTypeId?: string;
    userId?: string;
    month?: string;
    year?: string;
    from?: string;
    to?: string;
    page?: string;
    limit?: string;
  }>;
}) {
  const {
    dayType,
    search,
    dutyTypeId,
    userId,
    month: rawMonth,
    year,
    from: rawFrom,
    to: rawTo,
    page = "1",
    limit = "15",
  } = await searchParams;
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.max(5, parseInt(limit, 10) || 15);

  /**
   * One place decides the window, because three controls can now describe it
   * and they must not disagree:
   *
   *   explicit from/to        -> wins, and the month select shows "All months"
   *   month + year            -> that month
   *   year only (month "all") -> the whole year
   *   nothing                 -> the current month
   *
   * The current month was already the default, but nothing on screen said so —
   * the range was computed silently, which made a filtered list look like the
   * whole log with rows missing.
   */
  const now = new Date();
  const { lang, t } = await getServerTranslations();
  const isGu = lang === "gu";
  const monthNames = isGu ? GUJARATI_MONTH_NAMES : MONTH_NAMES;
  const hasExplicitRange = Boolean(rawFrom || rawTo);
  const selectedYear = clampYear(year);

  // "all" is a deliberate choice; absent means nobody has chosen yet.
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

  const user = await getCurrentUser();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const timeFormat = user?.timeFormat ?? "24h";
  const supabase = await createClient();

  const yearOptions = getYearOptions(3, 1);

  // Load duty types and users for filter dropdowns
  const [{ data: dutyTypes }, { data: usersList }] = await Promise.all([
    supabase.from("duty_types").select("id, name").order("name"),
    isSuperAdmin
      ? supabase.from("users").select("id, full_name").order("full_name")
      : Promise.resolve({ data: [] }),
  ]);

  const SELECT_COLUMNS =
    "id, user_id, duty_group_id, starts_at, ends_at, status, location, ta_from_place, ta_to_place, ta_distance_km, ta_amount, is_holiday, is_holiday_duty, manual_holiday_claim, holiday_allowance, duty_types(name), users!duties_user_id_fkey(full_name)";

  /**
   * Every filter in one place, applied identically to the paged rows and to
   * the KPI aggregates. The tiles previously came from a separate, unfiltered
   * query, so changing a filter moved the table but left the numbers above it
   * showing totals for every duty in the database.
   */
  const applyFilters = <T extends Filterable<T>>(q: T): T => {
    let out = q;
    if (dayType === "holiday") out = out.eq("is_holiday_duty", true);
    if (dayType === "working") out = out.eq("is_holiday_duty", false);
    if (dutyTypeId) out = out.eq("duty_type_id", dutyTypeId);
    if (userId) out = out.eq("user_id", userId);

    // Bounds are the officer's LOCAL day, not UTC. Appending a literal "Z"
    // once made an IST evening duty fall outside its own day's range.
    //
    // Only fromDate/toDate are applied: the year is already folded into them
    // above, and filtering on both would put two overlapping bounds on the
    // same column.
    if (fromDate) out = out.gte("starts_at", localDayStart(fromDate));
    if (toDate) out = out.lte("starts_at", localDayEnd(toDate));

    if (search) {
      const safe = sanitizeSearch(search);
      if (safe) {
        out = out.or(
          `location.ilike.%${safe}%,ta_from_place.ilike.%${safe}%,ta_to_place.ilike.%${safe}%`,
        );
      }
    }
    return out;
  };

  // Pagination bounds
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  const [{ data: duties, count: totalCount }, { data: filteredAggregate }] =
    await Promise.all([
      applyFilters(
        supabase.from("duties").select(SELECT_COLUMNS, { count: "exact" }),
      )
        .order("starts_at", { ascending: false })
        .range(from, to),
      applyFilters(
        supabase
          .from("duties")
          .select("ta_amount, ta_distance_km, holiday_allowance, is_holiday_duty"),
      ),
    ]);

  const totalItems = totalCount ?? 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  const aggregate = filteredAggregate ?? [];
  const totalTaAmount = aggregate.reduce((sum, d) => sum + (d.ta_amount ?? 0), 0);
  const totalTaDistance = aggregate.reduce((sum, d) => sum + (d.ta_distance_km ?? 0), 0);
  // Holiday duties WORKED, and what they actually paid. Never holidays x rate:
  // a month can hold 15 holidays while the officer worked 3 of them.
  const holidayDutiesWorked = aggregate.filter((d) => d.is_holiday_duty).length;
  const totalHolidayPay = aggregate.reduce(
    (sum, d) => sum + Number(d.holiday_allowance ?? 0),
    0,
  );
  const totalExtraPay = totalTaAmount + totalHolidayPay;

  // Only the caller's own rows can be deleted, so only they get a checkbox.
  const userSettings = await getUserSettings();
  const ownIds = (duties ?? []).filter((d) => d.user_id === user?.id).map((d) => d.id);
  const groupedDuties = groupDutiesByDayOrGroup(duties ?? [], isGu, userSettings.enableMultiDuty);

  return (
    <main className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-7xl 2xl:max-w-full mx-auto space-y-6">
      <DutySelectionProvider selectableIds={ownIds}>
        {/* Page Header */}
        <PageHeader
          title={t.duty.pageTitle}
          subtitle={t.duty.pageSubtitle}
          badge={
            <Badge variant="purple" dot>
              {isGu ? toGujaratiNumerals(totalItems) : totalItems} {t.common.records}
            </Badge>
          }
          compactActions
          actions={
            <div className="flex items-center gap-1.5 sm:gap-2">
              <DutyRefreshButton iconOnly />
              <Link
                href="/duty/new"
                className="flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-2.5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 transition-all hover:from-indigo-500 hover:to-indigo-600 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm"
              >
                <Plus className="size-4 shrink-0" />
                <span>{t.duty.addDuty}</span>
              </Link>
            </div>
          }
        />

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="flex items-center gap-3.5 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 shadow-xs">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
            <Briefcase className="size-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.dashboard.dutyLogs}</p>
            <p className="text-xl sm:text-2xl font-bold text-foreground">
              {isGu ? toGujaratiNumerals(totalItems) : totalItems}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4 shadow-xs">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
            <Compass className="size-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.dashboard.travelDistance}</p>
            <p className="text-xl sm:text-2xl font-bold text-foreground">
              {isGu
                ? `${toGujaratiNumerals(totalTaDistance.toLocaleString())} કિ.મી.`
                : `${totalTaDistance.toLocaleString()} km`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-xs">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <IndianRupee className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.dashboard.taAllowance}</p>
            <p className="text-xl sm:text-2xl font-bold text-foreground">
              {isGu ? toGujaratiNumerals(formatCurrency(totalTaAmount)) : formatCurrency(totalTaAmount)}
            </p>
          </div>
        </div>

        {/* Holiday Pay */}
        <div className="flex items-center gap-3.5 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-xs">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t.dashboard.holidaysWorked}
            </p>
            <p className="text-xl sm:text-2xl font-bold text-foreground">
              {isGu ? toGujaratiNumerals(formatCurrency(totalHolidayPay)) : formatCurrency(totalHolidayPay)}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {isGu ? toGujaratiNumerals(holidayDutiesWorked) : holidayDutiesWorked} {t.duty.holidayDuty}
            </p>
          </div>
        </div>

        {/* Total Extra Pay */}
        <div className="col-span-2 sm:col-span-1 flex items-center gap-3.5 rounded-2xl border border-indigo-500/30 bg-indigo-500/[0.08] dark:bg-indigo-500/15 p-4 shadow-xs">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600/15 text-indigo-600 dark:text-indigo-400">
            <IndianRupee className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
              {t.dashboard.extraPay}
            </p>
            <p className="text-xl sm:text-2xl font-black text-foreground">
              {isGu ? toGujaratiNumerals(formatCurrency(totalExtraPay)) : formatCurrency(totalExtraPay)}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              TA + {t.duty.holidayDuty}
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar with Collapsible Filter Options */}
      <CollapsibleFilterBar
        activeCount={
          [
            Boolean(dayType),
            Boolean(dutyTypeId),
            Boolean(userId),
            Boolean(monthParam && monthParam !== "all"),
            Boolean(year),
            Boolean(rawFrom || rawTo),
          ].filter(Boolean).length
        }
        searchSlot={
          <SearchInput
            placeholder="Search location or route..."
            defaultValue={search}
          />
        }
        actionsSlot={
          <div className="flex items-center gap-2">
            <DutyRefreshButton key="action-duty-refresh" />
            <DutySelectModeToggle key="action-duty-select" />
          </div>
        }
        resetSlot={
          (search || dayType || dutyTypeId || userId || monthParam || year || rawFrom || rawTo) ? (
            <Link
              href="/duty"
              className="h-9 inline-flex items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors shrink-0"
              title={t.common.resetFilters}
            >
              {t.common.resetFilters}
            </Link>
          ) : null
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* Officer Filter for Admins */}
          {isSuperAdmin && (usersList ?? []).length > 0 && (
            <div className="w-full sm:w-44">
              <FilterSelect
                paramName="userId"
                placeholder={t.profile.officerName}
                icon="user"
                options={(usersList ?? []).map((u) => ({
                  value: u.id,
                  label: u.full_name,
                }))}
              />
            </div>
          )}

          {/* Duty Type Filter */}
          {(dutyTypes ?? []).length > 0 && (
            <div className="w-full sm:w-36">
              <FilterSelect
                paramName="dutyTypeId"
                placeholder={t.duty.allDutyTypes}
                icon="briefcase"
                options={sortDutyTypesForDropdown(dutyTypes ?? []).map((dt) => ({
                  value: dt.id,
                  label: isGu
                    ? translateDutyTypeToGujarati(dt.name)
                    : formatDutyTypeDropdownLabel(dt.name),
                }))}
              />
            </div>
          )}

          {/* Working vs holiday days */}
          <div className="w-full sm:w-36">
            <FilterSelect
              paramName="dayType"
              placeholder={t.common.all}
              icon="calendar"
              options={[
                { value: "working", label: t.dashboard.workingDays },
                { value: "holiday", label: t.dashboard.holidaysWorked },
              ]}
            />
          </div>

          {/* Month */}
          <div className="w-full sm:w-36">
            <FilterSelect
              paramName="month"
              placeholder={t.dashboard.wholeYear}
              value={monthParam}
              icon="calendar"
              clearable={true}
              options={[
                { value: "all", label: t.dashboard.wholeYear },
                ...monthNames.map((m, i) => ({ value: String(i + 1), label: m })),
              ]}
            />
          </div>

          {/* Year Filter */}
          <div className="w-full sm:w-28">
            <FilterSelect
              paramName="year"
              placeholder={isGu ? toGujaratiNumerals(selectedYear) : String(selectedYear)}
              value={hasExplicitRange && !year ? undefined : String(selectedYear)}
              icon="calendar"
              clearable={false}
              options={yearOptions.map((opt) => ({
                value: opt.value,
                label: isGu ? toGujaratiNumerals(opt.value) : opt.label,
              }))}
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
      </CollapsibleFilterBar>

      {/* Data Container with Desktop Table AND Mobile Card View */}
      <Card className="p-0 overflow-visible md:overflow-hidden">
        <DutyBulkActionBar />
        {/* Desktop Table: Hidden on Mobile */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[11px] font-semibold tracking-wider">
              <tr>
                <DutyTableSelectHeader />
                <th className="py-3.5 px-4 sm:px-6">{t.profile.officerName}</th>
                <th className="py-3.5 px-4">{t.duty.dutyType}</th>
                <th className="py-3.5 px-4">{t.duty.startTime}</th>
                <th className="py-3.5 px-4">{t.duty.endTime}</th>
                <th className="py-3.5 px-4">{t.duty.location}</th>
                <th className="py-3.5 px-4">{t.duty.taClaim}</th>
                <th className="py-3.5 px-4 text-center">{t.dashboard.travelDistance}</th>
                <th className="py-3.5 px-4">{t.duty.taAmount}</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {(groupedDuties ?? []).map((g) => {
                return (
                  <tr
                    key={g.groupKey}
                    className="hover:bg-muted/30 transition-colors group"
                  >
                    <DutyTableSelectCell
                      id={g.primaryId}
                      ids={g.allIds}
                      label={`${g.combinedDutyTypeLabel} duty on ${formatDateTime(g.earliestStart, timeFormat, isGu ? "gu" : "en-US")}`}
                    />
                    <td className="py-3.5 px-4 sm:px-6 font-semibold text-foreground whitespace-nowrap">
                      <Link
                        href={`/duty/${g.primaryId}`}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1.5"
                      >
                        {g.officerName}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {g.dutyTypeNames.map((name, idx) => (
                          <Badge key={idx} variant="secondary">
                            {name}
                          </Badge>
                        ))}
                        {g.isMultiShift && (
                          <Badge variant="purple" className="text-[10px] py-0 px-1.5 font-bold">
                            {isGu ? `${toGujaratiNumerals(g.shiftCount)} શિફ્ટ` : `${g.shiftCount} shifts`}
                          </Badge>
                        )}
                        {g.isHolidayDuty && (
                          <DutyHolidayBadge duty={g.primaryDuty} isGujarati={isGu} />
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {formatDateTime(g.earliestStart, timeFormat, isGu ? "gu" : "en-US")}
                        </span>
                        {g.isMultiShift && (
                          <span className="text-[10px] text-muted-foreground">
                            {isGu
                              ? `પ્રથમ: ${formatTime(g.earliestStart, timeFormat, "gu")}`
                              : `1st: ${formatTime(g.earliestStart, timeFormat, "en-US")}`}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {formatDateTime(g.latestEnd, timeFormat, isGu ? "gu" : "en-US")}
                        </span>
                        {g.isMultiShift && (
                          <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                            {g.totalDurationLabel}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">
                      {g.locationDisplay !== "—" ? (
                        <div className="flex items-center gap-1">
                          <MapPin className="size-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[150px]">{g.locationDisplay}</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground whitespace-nowrap">
                      {g.taRouteDisplay !== "—" ? (
                        <span className="inline-flex items-center gap-1 font-medium text-foreground">
                          {g.taRouteDisplay}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center font-medium">
                      {g.totalTaDistanceKm > 0 ? (
                        <Badge variant="info">
                          <Compass className="size-3" />
                          {isGu
                            ? `${toGujaratiNumerals(g.totalTaDistanceKm)} કિ.મી.`
                            : `${g.totalTaDistanceKm} km`}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-semibold">
                      {g.totalTaAmount > 0 ? (
                        <Badge variant="success">
                          {isGu ? toGujaratiNumerals(formatCurrency(g.totalTaAmount)) : formatCurrency(g.totalTaAmount)}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                      <Link
                        href={`/duty/${g.primaryId}`}
                        className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-2xs"
                      >
                        {t.common.details}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {(duties ?? []).length > 0 && (
              <tfoot className="border-t-2 border-border bg-muted/60 text-xs font-bold text-foreground">
                <tr>
                  <td />
                  <td className="py-3 px-4 sm:px-6 uppercase tracking-wider text-[11px] text-muted-foreground">
                    {t.common.total} ({isGu ? toGujaratiNumerals(totalItems) : totalItems} {t.common.records})
                  </td>
                  <td colSpan={5} />
                  <td className="py-3 px-4 text-center font-bold">
                    {isGu
                      ? `${toGujaratiNumerals(totalTaDistance.toLocaleString())} કિ.મી.`
                      : `${totalTaDistance.toLocaleString()} km`}
                  </td>
                  <td className="py-3 px-4 font-black text-emerald-600 dark:text-emerald-400">
                    {isGu ? toGujaratiNumerals(formatCurrency(totalTaAmount)) : formatCurrency(totalTaAmount)}
                  </td>
                  <td className="py-3 px-4 sm:px-6" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Mobile Card List: Shown ONLY on mobile screens (< md) */}
        <div className="md:hidden flex flex-col divide-y divide-border/60">
          {(groupedDuties ?? []).map((g) => {
            return (
              <div key={g.groupKey} className="p-3.5 space-y-2.5 bg-card hover:bg-muted/20 transition-colors">
                {/* Header row: Checkbox, Officer name, duty types, and badges */}
                <div className="flex items-start justify-between gap-2">
                  <DutyRowCheckbox
                    id={g.primaryId}
                    ids={g.allIds}
                    label={`${g.combinedDutyTypeLabel} duty on ${formatDateTime(g.earliestStart, timeFormat)}`}
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/duty/${g.primaryId}`}
                      className="flex items-center gap-1.5 text-sm font-bold text-foreground hover:text-indigo-600 transition-colors"
                    >
                      <User className="size-3.5 shrink-0 text-indigo-500" />
                      <span className="truncate">{g.officerName}</span>
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <span className="text-xs text-muted-foreground font-medium">
                        {g.combinedDutyTypeLabel}
                      </span>
                      {g.isMultiShift && (
                        <Badge variant="purple" className="text-[10px] py-0 px-1 font-bold">
                          {isGu ? `${toGujaratiNumerals(g.shiftCount)} શિફ્ટ` : `${g.shiftCount} shifts`}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <DutyStatusBadge status={g.status} isGujarati={isGu} />
                    {g.isHolidayDuty && (
                      <DutyHolidayBadge duty={g.primaryDuty} iconOnly isGujarati={isGu} />
                    )}
                    {g.totalTaAmount > 0 && (
                      <Badge variant="success" className="text-[10px] py-0.5 px-1.5 font-bold">
                        {isGu ? toGujaratiNumerals(formatCurrency(g.totalTaAmount)) : formatCurrency(g.totalTaAmount)}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Start & End Date-Time strip (shown on all cards like others) */}
                <div className="flex items-center justify-between gap-1.5 text-[11px] sm:text-xs text-muted-foreground bg-muted/40 px-2.5 py-1.5 rounded-lg border border-border/50">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Clock className="size-3.5 text-indigo-500 shrink-0" />
                    <span className="font-medium text-foreground truncate">
                      {formatDateTime(g.earliestStart, timeFormat, isGu ? "gu" : "en-US")}
                    </span>
                  </div>
                  <span className="text-muted-foreground/60 shrink-0">→</span>
                  <div className="flex items-center gap-1.5 min-w-0 text-right">
                    <span className="font-medium text-foreground truncate">
                      {formatDateTime(g.latestEnd, timeFormat, isGu ? "gu" : "en-US")}
                    </span>
                  </div>
                </div>

                {/* If multiple shifts on this day, also show the shift breakdown */}
                {g.isMultiShift && (
                  <div className="space-y-1 bg-muted/30 p-2 rounded-lg border border-border/50 text-[11px]">
                    <div className="flex items-center justify-between text-muted-foreground font-semibold pb-1 border-b border-border/40">
                      <span>{isGu ? "દૈનિક શિફ્ટ્સ" : "Daily Shifts"}</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">{g.totalDurationLabel}</span>
                    </div>
                    {g.shifts.map((s, idx) => (
                      <div key={s.id} className="flex items-center justify-between pt-0.5 text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {isGu ? `શિફ્ટ ${toGujaratiNumerals(idx + 1)}: ${s.typeName}` : `Shift ${idx + 1}: ${s.typeName}`}
                        </span>
                        <span className="font-mono text-[11px]">
                          {formatTime(s.startsAt, timeFormat, isGu ? "gu" : "en-US")} → {formatTime(s.endsAt, timeFormat, isGu ? "gu" : "en-US")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {g.locationDisplay !== "—" && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3 text-rose-500 shrink-0" />
                    <span className="truncate">{g.locationDisplay}</span>
                  </div>
                )}

                {g.hasTa && (
                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border/40 gap-2">
                    <span className="text-muted-foreground flex items-center gap-1.5 flex-wrap">
                      <span>{g.taRouteDisplay}</span>
                      {g.totalTaDistanceKm > 0 && (
                        <Badge variant="info" className="text-[10px] py-0 px-1.5">
                          <Compass className="size-3" />
                          {isGu
                            ? `${toGujaratiNumerals(g.totalTaDistanceKm)} કિ.મી.`
                            : `${g.totalTaDistanceKm} km`}
                        </Badge>
                      )}
                    </span>
                    {g.totalTaAmount > 0 && (
                      <Badge variant="success" className="text-[10px] py-0 px-1.5">
                        <Route className="size-3" />
                        {isGu ? toGujaratiNumerals(formatCurrency(g.totalTaAmount)) : formatCurrency(g.totalTaAmount)}
                      </Badge>
                    )}
                  </div>
                )}

                {g.totalHolidayAllowance > 0 && (
                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border/40">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Sparkles className="size-3 text-amber-500 shrink-0" />
                      {isGu ? "રજા ડ્યુટી ભથ્થું" : "Holiday Pay"}
                    </span>
                    <Badge variant="warning" className="text-[10px] py-0 px-1.5">
                      <Sparkles className="size-3" />
                      {isGu ? toGujaratiNumerals(formatCurrency(g.totalHolidayAllowance)) : formatCurrency(g.totalHolidayAllowance)}
                    </Badge>
                  </div>
                )}

                <Link
                  href={`/duty/${g.primaryId}`}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card py-1.5 text-xs font-semibold text-foreground hover:bg-muted/70 shadow-2xs transition-colors"
                >
                  <span>{t.common.details}</span>
                  <ArrowRight className="size-3 text-muted-foreground" />
                </Link>
              </div>
            );
          })}
        </div>

        {(duties ?? []).length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <div className="flex flex-col items-center justify-center gap-2">
              <Briefcase className="size-8 text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-medium text-foreground">
                {t.duty.noDutiesFound}
              </p>
              <p className="text-xs text-muted-foreground">
                {t.duty.noDutiesHelp}
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
      </DutySelectionProvider>
    </main>
  );
}
