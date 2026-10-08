import "server-only";
import { createClient } from "@/lib/supabase/server";
import { toDateKey, localDayStart, localDayEnd } from "@/lib/format/datetime";
import { leaveDaysWithin, summariseBreakdown } from "@/lib/leave/leaveDays";
import type { ColumnDef } from "./reportCells";

// Re-exported so callers keep importing report types from one place.
export type { ColumnDef } from "./reportCells";
export { formatReportCell, isEmptyReportCell } from "./reportCells";
import {
  resolveHolidaysForRange,
  holidayKindLabel,
  type HolidayRecord,
} from "@/lib/holidays/resolveHoliday";

/**
 * One query layer for reports, used by BOTH the report page and the CSV
 * export route.
 *
 * They used to build their own queries: the page applied officer, year and
 * date-range filters, while the route read only `userId` and silently ignored
 * the rest — so the CSV never matched what was on screen. Anything that
 * changes here changes both.
 */
export type ReportType = "duty" | "ta" | "holiday" | "leave";

export const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: "duty", label: "All Duty Data" },
  { value: "ta", label: "TA Data" },
  { value: "holiday", label: "Holiday Worked" },
  { value: "leave", label: "Leave Data" },
];

export type ReportParams = {
  type: ReportType;
  year: number;
  /** 1-12, or null for the whole year. */
  month: number | null;
  /** Restrict to one officer. Ignored unless the caller may see others. */
  userId?: string;
};


export type ReportRow = Record<string, string | number | null>;

export type ReportTotals = {
  rowCount: number;
  /** Only the keys meaningful for the chosen type are filled. */
  taAmount?: number;
  taDistance?: number;
  holidaysInPeriod?: number;
  holidaysWorked?: number;
  holidayExtraPay?: number;
  totalExtraPay?: number;
  leaveDays?: number;
  /**
   * Binpagari (LWP) days inside the period. Days only -- the daily salary
   * rate is the officer's own setting, so the page prices it rather than the
   * builder reaching for user settings.
   */
  binpagariDays?: number;
  /** Leave report: days charged to each leave type inside the period. */
  leaveByType?: { code: string; name: string; days: number }[];
};

export type ReportResult = {
  columns: ColumnDef[];
  rows: ReportRow[];
  totals: ReportTotals;
  /** Holidays in the period that were NOT worked — context, never pay. */
  unworkedHolidays: { date: string; kind: string; name: string }[];
  periodLabel: string;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function reportPeriod(year: number, month: number | null) {
  const start = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
  const end = month
    ? new Date(year, month, 0, 23, 59, 59, 999)
    : new Date(year, 11, 31, 23, 59, 59, 999);
  const label = month ? `${MONTHS[month - 1]} ${year}` : String(year);
  return { start, end, label };
}

const DUTY_COLUMNS: ColumnDef[] = [
  { key: "officer", label: "Officer" },
  { key: "duty_type", label: "Duty Type" },
  { key: "date", label: "Date" },
  { key: "shift_time", label: "Time", badge: "time" },
  { key: "location", label: "Location" },
  { key: "day_type", label: "Day Type", badge: "dayType" },
  { key: "status", label: "Status", badge: "status" },
  { key: "ta_distance_km", label: "Distance", numeric: true, badge: "distance" },
  { key: "ta_amount", label: "TA", numeric: true, badge: "ta" },
  { key: "holiday_allowance", label: "Holiday Pay", numeric: true, badge: "holiday" },
];

const TA_COLUMNS: ColumnDef[] = [
  { key: "officer", label: "Officer" },
  { key: "date", label: "Date" },
  { key: "shift_time", label: "Time", badge: "time" },
  { key: "ta_from", label: "From" },
  { key: "ta_to", label: "To" },
  { key: "ta_distance_km", label: "Distance", numeric: true, badge: "distance" },
  { key: "ta_amount", label: "TA", numeric: true, badge: "ta" },
];

const HOLIDAY_COLUMNS: ColumnDef[] = [
  { key: "officer", label: "Officer" },
  { key: "date", label: "Date" },
  { key: "day_type", label: "Holiday Type", badge: "dayType" },
  { key: "duty_type", label: "Duty Type" },
  { key: "shift_time", label: "Time", badge: "time" },
  { key: "holiday_allowance", label: "Extra Pay", numeric: true, badge: "holiday" },
];

const LEAVE_COLUMNS: ColumnDef[] = [
  { key: "officer", label: "Officer" },
  { key: "leave_type", label: "Leave Type", badge: "leaveType", colorKey: "leave_type_color" },
  { key: "start_date", label: "From" },
  { key: "end_date", label: "To" },
  { key: "days", label: "Days", numeric: true },
  { key: "reason", label: "Reason" },
];

const hhmm = (iso: string) => {
  const m = /T(\d{2}:\d{2})/.exec(iso);
  if (m) return m[1];
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};

const named = (v: unknown) => (v as { name: string } | null)?.name ?? null;
const officerName = (v: unknown) => (v as { full_name: string } | null)?.full_name ?? null;

export async function buildMonthlyReport(p: ReportParams): Promise<ReportResult> {
  const supabase = await createClient();
  const { start, end, label } = reportPeriod(p.year, p.month);

  // RLS decides visibility: an officer without DUTY_VIEW_ALL/LEAVE_VIEW_ALL
  // sees only their own rows whatever is asked for here, so the report is
  // safe to expose to every officer without a separate permission gate.
  const { data: holidayRows } = await supabase
    .from("holidays")
    .select("name, holiday_date, scope, is_government, is_optional")
    .gte("holiday_date", toDateKey(start))
    .lte("holiday_date", toDateKey(end));

  const resolved = resolveHolidaysForRange(start, end, (holidayRows ?? []) as HolidayRecord[]);
  const holidaysInPeriod = [...resolved.values()].filter((r) => r.isHoliday && r.kind !== "optional_holiday").length;

  if (p.type === "leave") {
    let q = supabase
      .from("leave_logs")
      .select(
        "id, start_date, end_date, is_half_day, half_day_session, reason, leave_types(name, code, color), users!leave_requests_user_id_fkey(full_name)",
      )
      // Overlap, not start date: a leave from 28 Jan to 3 Feb is part of
      // February's report too. Its days are clipped to the period below.
      .lte("start_date", toDateKey(end))
      .gte("end_date", toDateKey(start))
      .order("start_date", { ascending: false });
    if (p.userId) q = q.eq("user_id", p.userId);

    const { data } = await q;
    const leaveLogs = data ?? [];
    const leaveIds = leaveLogs.map((l) => l.id);
    const { data: dayRows } = await supabase
      .from("leave_log_days")
      .select("leave_log_id, leave_date, fraction, leave_types(code, name, color)")
      .in("leave_log_id", leaveIds.length > 0 ? leaveIds : ["00000000-0000-0000-0000-000000000000"]);

    const periodFrom = toDateKey(start);
    const periodTo = toDateKey(end);
    const daysByLog = new Map<string, { code: string; color: string | null; fraction: number }[]>();
    // Days per type INSIDE the period, for the printed report's totals box.
    const byType = new Map<string, { code: string; name: string; days: number }>();
    const addTypeDays = (code: string, name: string, days: number) => {
      const cur = byType.get(code) ?? { code, name, days: 0 };
      cur.days += days;
      byType.set(code, cur);
    };
    for (const r of dayRows ?? []) {
      const t = r.leave_types as unknown as { code: string | null; name: string; color: string | null } | null;
      const code = t?.code || t?.name || "Leave";
      const list = daysByLog.get(r.leave_log_id) ?? [];
      list.push({ code, color: t?.color ?? null, fraction: Number(r.fraction ?? 1) });
      daysByLog.set(r.leave_log_id, list);
      const day = String(r.leave_date ?? "");
      if (day >= periodFrom && day <= periodTo) {
        addTypeDays(code, t?.name ?? code, Number(r.fraction ?? 1));
      }
    }

    const rows: ReportRow[] = leaveLogs.map((l) => {
      const days = leaveDaysWithin(
        l.start_date,
        l.end_date,
        l.is_half_day,
        toDateKey(start),
        toDateKey(end),
      );
      const breakdown = summariseBreakdown(daysByLog.get(l.id) ?? []);
      const isMulti = breakdown.length > 1;
      const leaveTypeName = isMulti
        ? `Multi-Type (${breakdown.map((b) => `${b.days} ${b.code}`).join(", ")})`
        : named(l.leave_types);
      const ownType = l.leave_types as unknown as { name: string; code: string | null } | null;
      // A log with no per-day rows counts under its own type.
      if (!daysByLog.has(l.id)) {
        const code = ownType?.code || ownType?.name || "Leave";
        addTypeDays(code, ownType?.name ?? code, days);
      }

      return {
        officer: officerName(l.users),
        leave_type: leaveTypeName,
        // Print-only fields: the plain type, its code, half-day session and
        // the per-type day split ("3 CL + 2 HL").
        leave_type_name: ownType?.name ?? null,
        leave_code: ownType?.code ?? null,
        is_half_day: l.is_half_day ? 1 : 0,
        half_day_session: l.half_day_session ?? null,
        split: breakdown.map((b) => `${b.days} ${b.code}`).join(" + ") || null,
        // Not a column — LEAVE_COLUMNS never lists it — so it reaches the
        // badge without appearing in the table or the CSV.
        leave_type_color:
          (l.leave_types as unknown as { color: string | null } | null)?.color ?? null,
        start_date: l.start_date,
        end_date: l.end_date,
        days,
        reason: l.reason,
      };
    });

    return {
      columns: LEAVE_COLUMNS,
      rows,
      totals: {
        rowCount: rows.length,
        leaveDays: rows.reduce((a, r) => a + Number(r.days ?? 0), 0),
        leaveByType: [...byType.values()].sort((a, b) => b.days - a.days),
        binpagariDays: byType.get("LWP")?.days ?? 0,
        holidaysInPeriod,
        holidaysWorked: 0,
        holidayExtraPay: 0,
        taAmount: 0,
        taDistance: 0,
        totalExtraPay: 0,
      },
      unworkedHolidays: [],
      periodLabel: label,
    };
  }

  let q = supabase
    .from("duties")
    .select(
      "id, user_id, starts_at, ends_at, status, location, notes, ta_from_place, ta_to_place, ta_vehicle_type, ta_distance_km, ta_amount, is_holiday, is_holiday_duty, manual_holiday_claim, holiday_allowance, duty_types(name), users!duties_user_id_fkey(full_name)",
    )
    .gte("starts_at", localDayStart(toDateKey(start)))
    .lte("starts_at", localDayEnd(toDateKey(end)))
    .order("starts_at", { ascending: false });

  if (p.userId) q = q.eq("user_id", p.userId);
  // "TA Data" means journeys, so rows with no claim are not part of it.
  if (p.type === "ta") q = q.not("ta_amount", "is", null);
  // "Holiday Worked" is exactly that: holidays the officer WORKED.
  if (p.type === "holiday") q = q.eq("is_holiday_duty", true);

  const { data } = await q;
  const duties = data ?? [];

  /**
   * Binpagari days in the same period, for the pay breakdown.
   *
   * A duty report knows nothing about leave, but unpaid leave is a pay fact:
   * the breakdown adds up what the month earned, and this is what it lost.
   * Read from the per-day rows so a range split across leave types charges
   * only the days actually taken as Binpagari, half days included.
   */
  let binpagariDays = 0;
  {
    let lq = supabase
      .from("leave_log_days")
      .select("fraction, leave_types!inner(code)")
      .gte("leave_date", toDateKey(start))
      .lte("leave_date", toDateKey(end))
      .eq("leave_types.code", "LWP");
    if (p.userId) lq = lq.eq("user_id", p.userId);
    const { data: lwpRows } = await lq;
    binpagariDays = (lwpRows ?? []).reduce(
      (a, r) => a + Number(r.fraction ?? 1),
      0,
    );
  }

  const dayTypeOf = (startsAt: string) => {
    const r = resolved.get(toDateKey(startsAt));
    // An Optional Holiday is a working day for pay — say so, rather than
    // labelling it like a holiday that earns extra.
    if (r?.kind === "optional_holiday") return "Working Day (Optional Holiday)";
    return r?.isHoliday ? holidayKindLabel(r.kind) : "Working Day";
  };

  const rows: ReportRow[] = duties.map((d) => {
    const startDateKey = toDateKey(d.starts_at);
    const endDateKey = toDateKey(d.ends_at);
    const startTime = hhmm(d.starts_at);
    const endTime = hhmm(d.ends_at);
    const isNextDay = startDateKey !== endDateKey;
    const shiftTime =
      startTime && endTime
        ? isNextDay
          ? `${startTime} - ${endTime} (Next Day)`
          : `${startTime} - ${endTime}`
        : isNextDay
          ? (startTime ? `${startTime} (Next Day)` : endTime ? `${endTime} (Next Day)` : "(Next Day)")
          : startTime || endTime || "";
    const dateDisplay = isNextDay ? `${startDateKey} to ${endDateKey}` : startDateKey;

    return {
      officer: officerName(d.users),
      duty_type: named(d.duty_types),
      notes: d.notes,
      date: dateDisplay,
      start_date: startDateKey,
      end_date: endDateKey,
      is_next_day: isNextDay ? 1 : 0,
      shift_time: shiftTime,
      starts_at: startTime,
      ends_at: endTime,
      location: d.location,
      day_type: dayTypeOf(d.starts_at),
      // The holiday's own name ("Diwali", "Sunday"), for the printed report.
      holiday_name: resolved.get(toDateKey(d.starts_at))?.name ?? null,
      status: d.status,
      ta_from: d.ta_from_place,
      ta_to: d.ta_to_place,
      ta_vehicle_type: d.ta_vehicle_type ?? "private",
      ta_distance_km: d.ta_distance_km,
      ta_amount: d.ta_amount,
      holiday_allowance: d.holiday_allowance ? Number(d.holiday_allowance) : null,
    };
  });

  const workedKeys = new Set(
    duties.filter((d) => d.is_holiday_duty).map((d) => toDateKey(d.starts_at)),
  );

  /**
   * Holidays nobody worked, listed as context at zero. They must never enter
   * the pay total: a month can hold 15 holidays while only 3 were worked, and
   * extra pay is the sum of those 3 rows — never 15 x a rate.
   */
  const unworkedHolidays = [...resolved.entries()]
    .filter(([key, r]) => r.isHoliday && r.kind !== "optional_holiday" && !workedKeys.has(key))
    .map(([date, r]) => ({
      date,
      kind: holidayKindLabel(r.kind),
      name: r.name ?? holidayKindLabel(r.kind),
    }));

  const columns =
    p.type === "ta" ? TA_COLUMNS : p.type === "holiday" ? HOLIDAY_COLUMNS : DUTY_COLUMNS;

  const taAmount = rows.reduce((a, r) => a + Number(r.ta_amount ?? 0), 0);
  const taDistance = rows.reduce((a, r) => a + Number(r.ta_distance_km ?? 0), 0);
  const holidayExtraPay = rows.reduce((a, r) => a + Number(r.holiday_allowance ?? 0), 0);
  const totalExtraPay = taAmount + holidayExtraPay;

  return {
    columns,
    rows,
    totals: {
      rowCount: rows.length,
      taAmount,
      taDistance,
      holidaysInPeriod,
      holidaysWorked: duties.filter((d) => d.is_holiday_duty).length,
      holidayExtraPay,
      totalExtraPay,
      binpagariDays,
    },
    unworkedHolidays,
    periodLabel: label,
  };
}

/** Presentation for a cell, shared by the table and the CSV's number columns. */

