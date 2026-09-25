import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/format/currency";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { hasPermission } from "@/lib/permissions/hasPermission";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ColorDot } from "@/components/ui/color-dot";
import { DutyStatusBadge } from "@/components/duty/duty-badges";
import { FilterSelect } from "@/components/ui/filter-select";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import {
  FileSpreadsheet,
  Download,
  Briefcase,
  Compass,
  IndianRupee,
  Sparkles,
  CalendarOff,
  Route,
  CalendarDays,
  Clock,
} from "lucide-react";
import {
  buildMonthlyReport,
  formatReportCell,
  isEmptyReportCell,
  REPORT_TYPES,
  type ColumnDef,
  type ReportType,
} from "@/lib/reports/buildMonthlyReport";
import { getYearOptions, clampYear } from "@/lib/format/year";
import { formatDays } from "@/lib/leave/leaveDays";
import { getUserSettings } from "@/lib/settings/getUserSettings";
import { ReportPrintView } from "@/components/reports/report-print-view";
import { PrintReportButton } from "@/components/reports/print-report-button";
import {
  buildPrintReport,
  isPrintableReport,
  type PrintOfficer,
} from "@/lib/reports/printReport";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Monthly reports.
 *
 * The rows, columns and totals all come from `buildMonthlyReport`, which the
 * CSV route calls with the same parameters — so the export always matches
 * what is on screen. Previously each built its own query and they drifted.
 *
 * Access: every officer can report on their OWN data, which is what makes a
 * monthly report useful to them. The page used to hard-redirect anyone
 * without REPORT_VIEW, which most officers lack, so the feature was
 * unreachable. REPORT_VIEW now unlocks the officer picker and, through RLS,
 * other people's rows.
 */
/**
 * One report cell, as a Badge where the column asks for one.
 *
 * Shared by the desktop table and the mobile card list on purpose: rendering
 * the two separately is how they drift, and a row that reads differently
 * depending on screen width is worse than no badge at all.
 */
function ReportCell({
  column,
  value,
  color,
  compact = false,
}: {
  column: ColumnDef;
  value: string | number | null;
  /** Hex from the row, when the column names a `colorKey`. */
  color?: string | null;
  /**
   * Drops the TA amount to the icon alone, for the mobile badge cluster where
   * the figure already appears as its own row below.
   */
  compact?: boolean;
}) {
  if (column.key === "date") {
    const raw = String(value ?? "").trim();
    if (!raw || raw === "—") return <>—</>;
    if (raw.includes(" to ")) {
      const [start, end] = raw.split(" to ");
      return (
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-foreground">{start}</span>
          <span className="text-muted-foreground/60 text-[10px] font-bold">→</span>
          <span className="font-semibold text-foreground">{end}</span>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 font-bold border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10"
          >
            Next Day
          </Badge>
        </span>
      );
    }
    return <>{raw}</>;
  }

  const text = formatReportCell(column, value);
  if (!column.badge || text === "—") return <>{text}</>;

  // Status reuses the duty log's own badge, so the report and the log agree
  // on what COMPLETED and CANCELLED look like instead of inventing colours.
  if (column.badge === "status") return <DutyStatusBadge status={String(value)} />;

  if (column.badge === "ta") {
    return (
      <Badge variant="success" aria-label={`TA ${text}`} title={`TA ${text}`}>
        <Route className="size-3" />
        {!compact && text}
      </Badge>
    );
  }

  if (column.badge === "holiday") {
    const amount = Number(value ?? 0);
    if (!amount) return <>—</>;
    return (
      <Badge
        variant="warning"
        aria-label={`Holiday Pay ${text}`}
        title={`Holiday Pay ${text}`}
      >
        <Sparkles className="size-3" />
        {!compact && text}
      </Badge>
    );
  }

  if (column.badge === "distance") {
    const km = Number(value ?? 0);
    if (!km) return <>—</>;
    return (
      <Badge
        variant="info"
        aria-label={`Distance ${km} km`}
        title={`Distance ${km} km`}
      >
        <Compass className="size-3" />
        {!compact && `${km.toLocaleString()} km`}
      </Badge>
    );
  }

  if (column.badge === "dayType") {
    // dayTypeOf() returns "Working Day", "Working Day (Optional Holiday)",
    // or a holiday-kind label. Both working-day forms are styled as work.
    const isWorkingDay = text.startsWith("Working Day");
    if (compact && isWorkingDay) {
      return <Badge variant="secondary">{text}</Badge>;
    }
    if (compact) {
      // Icon alone, matching the duty log's holiday mark. The name is on
      // aria-label/title so it is neither silent nor a guess.
      return (
        <Badge variant="warning" aria-label={text} title={text}>
          <Sparkles className="size-3" />
        </Badge>
      );
    }
    return <Badge variant={isWorkingDay ? "secondary" : "warning"}>{text}</Badge>;
  }

  if (column.badge === "time") {
    const raw = String(value ?? "").trim();
    if (!raw) return <>—</>;

    const isNextDay = raw.includes("(Next Day)");
    const cleanRaw = raw.replace(/\s*\(Next Day\)/i, "").trim();

    const parts = cleanRaw.split(/\s*[-–]\s*/);
    const start = parts[0];
    const end = parts[1];

    if (!start) return <>—</>;

    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/60 dark:bg-muted/40 border border-border/60 text-xs font-medium text-foreground shadow-2xs">
        <Clock className="size-3 text-muted-foreground shrink-0" />
        <span className="font-semibold text-foreground">{start}</span>
        {end ? (
          <>
            <span className="text-muted-foreground/60 text-[10px] font-bold">→</span>
            <span className="font-semibold text-foreground">{end}</span>
          </>
        ) : null}
        {isNextDay && (
          <span className="inline-flex items-center text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-1.5 py-0.2 rounded border border-amber-500/30">
            Next Day
          </span>
        )}
      </span>
    );
  }

  return (
    <Badge variant="success">
      <ColorDot color={color} label={text} />
      {text}
    </Badge>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    userId?: string;
    year?: string;
    month?: string;
    page?: string;
    limit?: string;
  }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const [canViewAll, canExport] = await Promise.all([
    hasPermission(PERMISSIONS.REPORT_VIEW),
    hasPermission(PERMISSIONS.REPORT_EXPORT),
  ]);

  const now = new Date();
  const year = clampYear(params.year);
  const monthParam = params.month ?? String(now.getMonth() + 1);
  const month =
    monthParam === "all"
      ? null
      : Math.min(12, Math.max(1, Number(monthParam) || now.getMonth() + 1));

  const type = (REPORT_TYPES.map((t) => t.value) as string[]).includes(
    params.type ?? "",
  )
    ? (params.type as ReportType)
    : "duty";

  // Without REPORT_VIEW the report is pinned to the caller's own records.
  const userId = canViewAll ? params.userId : user?.id;

  const report = await buildMonthlyReport({ type, year, month, userId });

  // Unpaid leave is priced with the viewer's own daily rate, so it is only
  // shown on a report they are looking at for themselves -- pricing another
  // officer's Binpagari days with this officer's rate would be a wrong number
  // stated confidently.
  const isOwnReport = !userId || userId === user?.id;
  const { dailySalaryRate } = await getUserSettings();
  const binpagariDays = isOwnReport ? report.totals.binpagariDays ?? 0 : 0;
  const binpagariDeduction = binpagariDays * dailySalaryRate;

  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const pageSize = Math.max(5, parseInt(params.limit ?? "20", 10) || 20);
  const totalItems = report.rows.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const pageRows = report.rows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const supabase = await createClient();
  const { data: usersList } = canViewAll
    ? await supabase.from("users").select("id, full_name").order("full_name")
    : { data: [] };

  const exportQuery = new URLSearchParams({
    type,
    year: String(year),
    month: month ? String(month) : "all",
    ...(userId ? { userId } : {}),
  }).toString();

  const isHolidayReport = type === "holiday";
  const isLeaveReport = type === "leave";

  // Print: every report type (TA, Holiday Worked, Duty, Leave), with every
  // row and no amounts. The letter names the officer and their post; an admin
  // viewing "All Officers" gets an Officer column instead.
  const printUserId = userId || null;
  let printOfficer: PrintOfficer | null = null;
  if (isPrintableReport(type) && printUserId) {
    const { data: officerRow } = await supabase
      .from("users")
      .select("full_name, designation, employee_code, current_posting, departments(name)")
      .eq("id", printUserId)
      .maybeSingle();
    printOfficer = officerRow
      ? {
          name: officerRow.full_name,
          post: officerRow.designation ?? null,
          employeeCode: officerRow.employee_code ?? null,
          posting: officerRow.current_posting ?? null,
          department:
            (officerRow.departments as unknown as { name: string } | null)?.name ?? null,
        }
      : {
          name:
            printUserId === user?.id
              ? (user?.fullName ?? "Officer")
              : ((usersList ?? []).find((u) => u.id === printUserId)?.full_name ?? "Officer"),
          post: null,
        };
  }

  let userPrintSettings = null;
  if (printUserId) {
    const { data: sRow } = await supabase
      .from("user_settings")
      .select("print_recipient_title, print_station_name, print_signatory_name, print_default_vehicle, print_use_gujarati_digits")
      .eq("user_id", printUserId)
      .maybeSingle();
    userPrintSettings = sRow;
    if (userPrintSettings?.print_station_name && printOfficer) {
      printOfficer.posting = userPrintSettings.print_station_name;
    }
  }

  const printReport = isPrintableReport(type)
    ? buildPrintReport({
        type,
        rows: report.rows,
        periodLabel: report.periodLabel,
        includeOfficer: !printUserId,
        language: "gu",
        officer: printOfficer,
        useGujaratiDigits: userPrintSettings?.print_use_gujarati_digits ?? true,
        printSettings: userPrintSettings
          ? {
              recipientTitle: userPrintSettings.print_recipient_title,
              stationName: userPrintSettings.print_station_name,
              signatoryName: userPrintSettings.print_signatory_name,
              footerPlace: userPrintSettings.print_station_name
                ? userPrintSettings.print_station_name.split(",")[0].trim()
                : undefined,
            }
          : undefined,
      })
    : null;

  return (
    <main className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-7xl 2xl:max-w-full mx-auto space-y-6 print:max-w-none print:p-0">
      {/* Everything on screen; the printer gets ReportPrintView instead. */}
      <div className="space-y-6 print:hidden">
      <PageHeader
        title="Monthly Reports"
        subtitle="Duty, travelling allowance, holiday and leave records for any month or year."
        badge={<Badge variant="purple" dot>{report.periodLabel}</Badge>}
        compactActions
        actions={
          canExport || printReport ? (
            <div className="flex items-center gap-2">
              {printReport && (
                <PrintReportButton report={printReport} officer={printOfficer} />
              )}
              {canExport && (
                <a
                  href={`/api/reports/export?${exportQuery}`}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-indigo-600 px-2.5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 transition-colors hover:bg-indigo-500 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm"
                >
                  <Download className="size-4 shrink-0" />
                  <span className="sm:hidden">CSV</span>
                  <span className="hidden sm:inline">Export CSV</span>
                </a>
              )}
            </div>
          ) : undefined
        }
      />

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="w-full sm:w-48">
            <FilterSelect
              paramName="type"
              placeholder={REPORT_TYPES.find((t) => t.value === type)?.label}
              value={type}
              clearable={false}
              icon="briefcase"
              options={REPORT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            />
          </div>
          <div className="w-full sm:w-36">
            <FilterSelect
              paramName="month"
              placeholder="Whole year"
              value={month ? String(month) : "all"}
              icon="calendar"
              options={[
                { value: "all", label: "Whole year" },
                ...MONTH_NAMES.map((m, i) => ({ value: String(i + 1), label: m })),
              ]}
            />
          </div>
          <div className="w-full sm:w-28">
            <FilterSelect
              paramName="year"
              placeholder={String(year)}
              value={String(year)}
              clearable={false}
              icon="calendar"
              options={getYearOptions(4, 1)}
            />
          </div>
          {canViewAll && (usersList ?? []).length > 0 && (
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
          {!canViewAll && (
            <span className="text-[11px] text-muted-foreground">
              Showing your own records.
            </span>
          )}
        </div>
      </Card>

      {/* Unified Monthly Pay Breakdown & Duty Summary (Single Card) */}
      {!isLeaveReport && (
        <div className="rounded-xl border border-border/80 bg-card p-3 sm:px-4 sm:py-3 shadow-2xs">
          <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
            {/* Left: Title & Period */}
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <IndianRupee className="size-3.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-bold text-foreground">
                    Monthly Pay Breakdown
                  </h3>
                  <span className="rounded-md border border-border/80 bg-muted/50 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {report.periodLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Right on Desktop / 2x2 Grid on Mobile: Duty Records + Financial Equation Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:flex xl:items-center gap-1.5 sm:gap-2">
              {/* Duty Records Chip */}
              <div className="flex flex-col justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-2.5 py-1.5 xl:min-w-24">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 truncate flex items-center gap-1">
                  <Briefcase className="size-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  {isHolidayReport ? "Holiday Duties" : type === "ta" ? "TA Records" : "Duty Records"}
                </span>
                <span className="text-xs sm:text-sm font-black text-indigo-600 dark:text-indigo-400">
                  {report.totals.rowCount}
                </span>
                <span className="text-[9px] text-muted-foreground truncate">
                  Logged in month
                </span>
              </div>

              {/* Separator / Divider on desktop */}
              <span className="hidden xl:inline-block h-6 w-px bg-border/80 mx-0.5" />

              {/* TA Claimed Chip */}
              <div className="flex flex-col justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-2.5 py-1.5 xl:min-w-28">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 truncate flex items-center gap-1">
                  <Route className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  TA Claimed
                </span>
                <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(report.totals.taAmount ?? 0)}
                </span>
                <span className="text-[9px] text-muted-foreground truncate">
                  {(report.totals.taDistance ?? 0).toLocaleString()} km
                </span>
              </div>

              {/* Plus Sign on Desktop */}
              <span className="hidden xl:inline-block text-xs font-bold text-muted-foreground/60">+</span>

              {/* Holiday Pay Chip */}
              <div className="flex flex-col justify-center rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-2.5 py-1.5 xl:min-w-28">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 truncate flex items-center gap-1">
                  <Sparkles className="size-3 text-amber-600 dark:text-amber-400 shrink-0" />
                  Holiday Pay
                </span>
                <span className="text-xs sm:text-sm font-black text-amber-600 dark:text-amber-400">
                  {formatCurrency(report.totals.holidayExtraPay ?? 0)}
                </span>
                <span className="text-[9px] text-muted-foreground truncate">
                  {report.totals.holidaysWorked ?? 0} worked
                </span>
              </div>

              {/* Equals Sign on Desktop */}
              <span className="hidden xl:inline-block text-xs font-bold text-muted-foreground/60">=</span>

              {/* Total Extra Pay Chip */}
              <div className="flex flex-col justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/[0.08] dark:bg-indigo-500/15 px-2.5 py-1.5 xl:min-w-32 shadow-2xs">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 truncate flex items-center gap-1">
                  <IndianRupee className="size-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  Total Extra Pay
                </span>
                <span className="text-xs sm:text-sm font-black text-indigo-600 dark:text-indigo-400">
                  {formatCurrency(
                    report.totals.totalExtraPay ??
                      ((report.totals.taAmount ?? 0) + (report.totals.holidayExtraPay ?? 0))
                  )}
                </span>
                <span className="text-[9px] text-muted-foreground truncate">
                  TA + Holiday
                </span>
              </div>

              {/* Binpagari: a deduction, so it sits after the total rather
                  than inside it -- unpaid leave is not extra pay, and adding
                  it to the sum would misstate both. Full width below xl so a
                  fifth chip cannot leave a ragged half-row. */}
              {binpagariDays > 0 && (
                <>
                  <span className="hidden xl:inline-block text-xs font-bold text-muted-foreground/60">
                    &minus;
                  </span>
                  <div className="col-span-2 sm:col-span-4 xl:col-span-1 flex flex-col justify-center rounded-lg border border-rose-500/30 bg-rose-500/[0.06] px-2.5 py-1.5 xl:min-w-28">
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 truncate flex items-center gap-1">
                      <CalendarOff className="size-3 text-rose-600 dark:text-rose-400 shrink-0" />
                      Binpagari
                    </span>
                    <span className="text-xs sm:text-sm font-black text-rose-600 dark:text-rose-400">
                      {dailySalaryRate > 0
                        ? `-${formatCurrency(binpagariDeduction)}`
                        : formatDays(binpagariDays)}
                    </span>
                    <span className="text-[9px] text-muted-foreground truncate">
                      {dailySalaryRate > 0
                        ? `${formatDays(binpagariDays)} unpaid`
                        : "Set daily rate in Settings"}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary Stat Cards (Leave Report Only) */}
      {isLeaveReport && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {/* Days deducted in the period, not the number of entries. */}
          <Tile
            icon={CalendarOff}
            label="Leave"
            value={formatDays(report.totals.leaveDays ?? 0)}
            tone="rose"
          />
          {binpagariDays > 0 && (
            <Tile
              icon={IndianRupee}
              label="Binpagari"
              value={
                dailySalaryRate > 0
                  ? `-${formatCurrency(binpagariDeduction)}`
                  : formatDays(binpagariDays)
              }
              hint={
                dailySalaryRate > 0
                  ? `${formatDays(binpagariDays)} unpaid at ${formatCurrency(dailySalaryRate)}/day`
                  : "Set daily rate in Settings"
              }
              tone="rose"
            />
          )}
        </div>
      )}

      {/* Rows */}
      <Card className="p-0 overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-border bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                {report.columns.map((c) => (
                  <th
                    key={c.key}
                    className={`px-4 py-3.5 whitespace-nowrap ${c.numeric ? "text-right" : ""}`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {pageRows.map((row, i) => (
                <tr key={i} className="transition-colors hover:bg-muted/30">
                  {report.columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-4 py-3 whitespace-nowrap ${
                        c.numeric ? "text-right font-semibold text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      <ReportCell
                        column={c}
                        value={row[c.key]}
                        color={c.colorKey ? (row[c.colorKey] as string | null) : null}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {pageRows.length > 0 && (
              <tfoot className="border-t-2 border-border bg-muted/60 text-xs font-bold text-foreground">
                <tr>
                  {report.columns.map((c, index) => {
                    if (c.key === "holiday_allowance") {
                      return (
                        <td
                          key={c.key}
                          className="px-4 py-3 text-right font-extrabold text-amber-600 dark:text-amber-400"
                        >
                          {formatCurrency(report.totals.holidayExtraPay ?? 0)}
                        </td>
                      );
                    }
                    if (c.key === "ta_amount") {
                      return (
                        <td
                          key={c.key}
                          className="px-4 py-3 text-right font-extrabold text-emerald-600 dark:text-emerald-400"
                        >
                          {formatCurrency(report.totals.taAmount ?? 0)}
                        </td>
                      );
                    }
                    if (c.key === "ta_distance_km") {
                      return (
                        <td key={c.key} className="px-4 py-3 text-right font-bold">
                          {(report.totals.taDistance ?? 0).toLocaleString()} km
                        </td>
                      );
                    }
                    if (c.key === "days") {
                      return (
                        <td key={c.key} className="px-4 py-3 text-right font-bold text-rose-600 dark:text-rose-400">
                          {report.totals.leaveDays ?? 0}d
                        </td>
                      );
                    }
                    if (index === 0) {
                      return (
                        <td
                          key={c.key}
                          className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
                        >
                          Total ({report.rows.length} {report.rows.length === 1 ? "entry" : "entries"})
                        </td>
                      );
                    }
                    return <td key={c.key} className="px-4 py-3" />;
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Mobile: the same rows as label/value pairs, since a wide table is
            unreadable on a phone. */}
        {/* Mobile: a card per row, not a transposed table.
            Two differences from the desktop columns, both about height on a
            phone. The badge columns are lifted into a cluster top-right, so
            status, day type and TA read at a glance instead of as three more
            label/value lines. And a field with nothing in it is dropped
            entirely — an office shift used to spend four lines saying "—" for
            travel it never made. */}
        <div className="flex flex-col divide-y divide-border/60 md:hidden">
          {pageRows.map((row, i) => {
            /* Only badges that say something.
               "SCHEDULED" and "Working Day" are what almost every row holds,
               so as badges they were decoration repeated down the whole list
               — the exceptions are what a reader is scanning for. Status
               still appears when it is NOT the default, so a cancelled duty
               does not go silent on a phone. */
            const badgeColumns = report.columns.filter((c) => {
              if (!c.badge || isEmptyReportCell(row[c.key])) return false;
              if (c.badge === "time" || c.badge === "holiday" || c.badge === "distance") return false; // Time, Holiday Pay, and Distance render as dedicated rows in detailColumns
              if (c.badge === "status") return String(row[c.key]) !== "SCHEDULED";
              if (c.badge === "dayType") return String(row[c.key]) !== "Working Day";
              return true;
            });
            const [headColumn, ...restColumns] = report.columns.filter(
              (c) => !c.badge || c.badge === "time",
            );
            const detailColumns = [
              ...restColumns,
              // Distance, TA and Holiday Pay come back as rows with their full styled badges
              ...report.columns.filter(
                (c) => c.badge === "ta" || c.badge === "holiday" || c.badge === "distance",
              ),
            ].filter((c) => !isEmptyReportCell(row[c.key]));

            return (
              <div key={i} className="space-y-2.5 p-4">
                {/* Wraps rather than truncating: the officer's name is the one
                    thing that must stay readable, so when three badges will
                    not share the line the cluster drops below it whole. */}
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                  <span className="text-sm font-bold text-foreground">
                    {headColumn ? formatReportCell(headColumn, row[headColumn.key]) : ""}
                  </span>
                  {badgeColumns.length > 0 && (
                    <div className="ml-auto flex flex-wrap items-center gap-1.5">
                      {badgeColumns.map((c) => (
                        <ReportCell
                          key={c.key}
                          column={c}
                          value={row[c.key]}
                          color={c.colorKey ? (row[c.colorKey] as string | null) : null}
                          compact
                        />
                      ))}
                    </div>
                  )}
                </div>

                {detailColumns.length > 0 && (
                  <div className="space-y-2 pt-0.5">
                    {detailColumns.map((c) => (
                      <div
                        key={c.key}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {c.label}
                        </span>
                        <div className="text-right text-xs font-medium text-foreground">
                          <ReportCell
                            column={c}
                            value={row[c.key]}
                            color={c.colorKey ? (row[c.colorKey] as string | null) : null}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {pageRows.length === 0 && (
          <div className="p-10 text-center text-xs text-muted-foreground">
            <FileSpreadsheet className="mx-auto mb-3 size-8 text-slate-300 dark:text-slate-700" />
            No records for {report.periodLabel}.
          </div>
        )}

        {totalItems > 0 && (
          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
          />
        )}
      </Card>

      {/* Holidays nobody worked. Listed as context, always at zero — closed by default */}
      {isHolidayReport && report.unworkedHolidays.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <details className="group">
            <summary className="flex items-center justify-between p-4 sm:p-5 cursor-pointer list-none select-none hover:bg-muted/40 transition-colors">
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <CalendarOff className="size-4 text-amber-500" />
                  Holidays not worked ({report.unworkedHolidays.length})
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Taken as time off, so they earn no extra pay and are excluded from the totals above.
                </p>
              </div>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 group-open:rotate-180 transition-transform duration-200 ml-2">
                ▼
              </span>
            </summary>
            <div className="p-4 sm:p-5 pt-0 border-t border-border/40">
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 mt-3">
                {report.unworkedHolidays.map((h) => (
                  <li
                    key={h.date}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground">{h.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {h.date} · {h.kind}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                      {formatCurrency(0)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </Card>
      )}
      </div>

      {printReport && (
        <ReportPrintView report={printReport} officer={printOfficer} />
      )}
    </main>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  tone: "indigo" | "amber" | "sky" | "emerald" | "rose";
}) {
  const tones = {
    indigo: "border-indigo-500/20 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400",
    amber: "border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400",
    sky: "border-sky-500/20 bg-sky-500/5 text-sky-600 dark:text-sky-400",
    emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
    rose: "border-rose-500/20 bg-rose-500/5 text-rose-600 dark:text-rose-400",
  };

  return (
    <div className={`flex items-center gap-3.5 rounded-2xl border p-4 shadow-xs min-w-0 ${tones[tone]}`}>
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-current/10">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-lg font-bold text-foreground sm:text-xl">{value}</p>
        {hint && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
