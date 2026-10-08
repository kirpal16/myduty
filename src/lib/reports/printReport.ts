import type { ReportRow } from "./buildMonthlyReport";
import {
  formatSafeDateMonthYear,
  formatSafeWeekdayShort,
} from "@/lib/format/safeDate";
import {
  getGujaratiReportHeaders,
  formatGujaratiDate,
  formatGujaratiDateWithDay,
  formatGujaratiShiftTime,
  formatDutyReasonWithNotes,
  formatGujaratiRoute,
  formatVehicleAcronym,
  formatGujaratiDistance,
  toGujaratiNumerals,
  toAsciiNumerals,
  parsePeriodLabel,
  translateDutyTypeToGujarati,
  translateDayTypeToGujarati,
} from "./gujaratiReportUtils";

/**
 * The printable version of every report: TA, Holiday Worked, Duty and Leave.
 *
 * A printed report is a record of WORK — which duties, when, where, which
 * journey — not a pay slip, so it carries no money at all: no TA amount, no
 * holiday allowance, no rupee totals. Every cell is a ready-to-print string,
 * so the on-page print view and the iPhone PDF render exactly the same thing
 * from the same data.
 *
 * Pure and client-safe (type-only import of the report builder).
 */

export type PrintableReportType = "ta" | "holiday" | "duty" | "leave";

export function isPrintableReport(type: string): type is PrintableReportType {
  return type === "ta" || type === "holiday" || type === "duty" || type === "leave";
}

export type PrintColumn = { key: string; label: string; align?: "right" };

export type PrintReport = {
  type?: PrintableReportType;
  /** "Travelling Allowance (TA) Report", "Holiday Worked Report" or Gujarati title. */
  title: string;
  periodLabel: string;
  subject?: string;
  salutation?: string;
  toLines?: string;
  fromLines?: string;
  headerLine1?: string;
  headerLine2?: string;
  headerLine1En?: string;
  headerLine2En?: string;
  footerPlace?: string;
  footerNote?: string;
  footerLeft?: string;
  footerRight?: string;
  columns: PrintColumn[];
  rows: Record<string, string>[];
  language?: "en" | "gu";
  useGujaratiDigits?: boolean;
  rawPeriodLabel?: string;
  rawRows?: readonly ReportRow[];
};

export type PrintOfficer = {
  name: string;
  post: string | null;
  employeeCode?: string | null;
  posting?: string | null;
  department?: string | null;
};

const DASH = "—";

const text = (v: unknown): string => {
  if (v === null || v === undefined) return DASH;
  const s = String(v).trim();
  return s ? s : DASH;
};

const km = (v: unknown): string => {
  const n = Number(v ?? 0);
  return n > 0 ? `${n.toLocaleString("en-IN")} km` : DASH;
};

const route = (from: unknown, to: unknown): string => {
  const f = String(from ?? "").trim();
  const t = String(to ?? "").trim();
  if (!f && !t) return DASH;
  return `${f || "?"} → ${t || "?"}`;
};

const noon = (dateKey: unknown) => new Date(`${String(dateKey)}T12:00:00`);

/** "Diwali · Public Holiday", or just the kind when the day has no name. */
const holidayLabel = (name: unknown, kind: unknown): string => {
  const n = String(name ?? "").trim();
  const k = String(kind ?? "").trim();
  if (n && k && n !== k) return `${n} · ${k}`;
  return n || k || DASH;
};

/**
 * Consolidates consecutive rows that share the same officer, duty type, notes,
 * travel route (from -> to) and vehicle type into a single combined row for printing.
 * Keeps print reports concise for long continuous tours (e.g. 25-day Ahmedabad bandobast).
 */
export function consolidateReportRows(
  rawRows: readonly ReportRow[],
  language: "en" | "gu" = "gu",
): ReportRow[] {
  if (rawRows.length <= 1) return [...rawRows];

  const sorted = [...rawRows].sort((a, b) =>
    `${a.start_date ?? a.date ?? ""} ${a.starts_at ?? ""}`.localeCompare(
      `${b.start_date ?? b.date ?? ""} ${b.starts_at ?? ""}`,
    ),
  );

  const consolidated: ReportRow[] = [];
  let currentGroup: ReportRow[] = [];

  const flush = () => {
    if (currentGroup.length === 0) return;
    if (currentGroup.length === 1) {
      consolidated.push(currentGroup[0]);
    } else {
      const first = currentGroup[0];
      const last = currentGroup[currentGroup.length - 1];
      const daysCount = currentGroup.length;
      const countSuffix = language === "gu" ? `(${daysCount} દિવસ)` : `(${daysCount} days)`;

      const startDateKey = String(first.start_date ?? first.date ?? "").split(" to ")[0];
      const lastEndDateRaw = String(last.end_date ?? last.date ?? "");
      const endDateKey = lastEndDateRaw.includes(" to ")
        ? lastEndDateRaw.split(" to ")[1]
        : lastEndDateRaw;

      consolidated.push({
        ...first,
        start_date: startDateKey,
        end_date: endDateKey,
        date: `${startDateKey} to ${endDateKey}`,
        starts_at: first.starts_at,
        ends_at: last.ends_at,
        shift_time: `${first.starts_at || ""} - ${last.ends_at || ""}`,
        notes: first.notes ? `${first.notes} ${countSuffix}` : countSuffix,
        // Since rows are merged into one journey row, keep the single journey distance (do not sum/plus)
        ta_distance_km: first.ta_distance_km,
        ta_amount: first.ta_amount,
        holiday_allowance: first.holiday_allowance,
      });
    }
    currentGroup = [];
  };

  for (const row of sorted) {
    if (currentGroup.length === 0) {
      currentGroup.push(row);
      continue;
    }

    const prev = currentGroup[currentGroup.length - 1];
    const sameOfficer = String(prev.officer ?? "") === String(row.officer ?? "");
    const sameDutyType =
      String(prev.duty_type ?? "").trim().toLowerCase() ===
      String(row.duty_type ?? "").trim().toLowerCase();
    const sameNotes =
      String(prev.notes ?? "").trim().toLowerCase() ===
      String(row.notes ?? "").trim().toLowerCase();
    const sameFrom =
      String(prev.ta_from ?? "").trim().toLowerCase() ===
      String(row.ta_from ?? "").trim().toLowerCase();
    const sameTo =
      String(prev.ta_to ?? "").trim().toLowerCase() ===
      String(row.ta_to ?? "").trim().toLowerCase();
    const sameVehicle =
      String(prev.ta_vehicle_type ?? "private").trim().toLowerCase() ===
      String(row.ta_vehicle_type ?? "private").trim().toLowerCase();

    if (sameOfficer && sameDutyType && sameNotes && sameFrom && sameTo && sameVehicle) {
      currentGroup.push(row);
    } else {
      flush();
      currentGroup.push(row);
    }
  }

  flush();
  return consolidated;
}

const nextDayKey = (dateKey: string): string => {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** "3 CL + 2 HL" -> Map { CL: 3, HL: 2 }. */
const parseSplit = (split: unknown): Map<string, number> => {
  const out = new Map<string, number>();
  for (const part of String(split ?? "").split("+")) {
    const m = part.trim().match(/^([\d.]+)\s+(.+)$/);
    if (m) out.set(m[2], (out.get(m[2]) ?? 0) + Number(m[1]));
  }
  return out;
};

const formatSplit = (map: Map<string, number>): string =>
  [...map.entries()].map(([code, days]) => `${days} ${code}`).join(" + ");

/**
 * Merges back-to-back leaves for the "one row" print mode: the next leave
 * starts the day after the previous one ends, for the same officer, the same
 * leave type and the same reason, and neither is a half day. Days add up and
 * the per-type splits are combined ("3 CL" + "2 CL + 1 HL" -> "5 CL + 1 HL").
 */
export function consolidateLeaveRows(rawRows: readonly ReportRow[]): ReportRow[] {
  const sorted = [...rawRows].sort((a, b) =>
    String(a.start_date ?? "").localeCompare(String(b.start_date ?? "")),
  );
  const out: ReportRow[] = [];
  const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

  for (const row of sorted) {
    const prev = out[out.length - 1];
    const canMerge =
      prev &&
      !Number(prev.is_half_day) &&
      !Number(row.is_half_day) &&
      norm(prev.officer) === norm(row.officer) &&
      norm(prev.leave_type_name ?? prev.leave_type) === norm(row.leave_type_name ?? row.leave_type) &&
      norm(prev.reason) === norm(row.reason) &&
      prev.end_date &&
      row.start_date &&
      nextDayKey(String(prev.end_date)) === String(row.start_date);

    if (!canMerge) {
      out.push({ ...row });
      continue;
    }

    const prevSplit = parseSplit(prev.split);
    const rowSplit = parseSplit(row.split);
    const merged = new Map(prevSplit);
    for (const [code, days] of rowSplit) merged.set(code, (merged.get(code) ?? 0) + days);

    out[out.length - 1] = {
      ...prev,
      end_date: row.end_date,
      days: Number(prev.days ?? 0) + Number(row.days ?? 0),
      split: merged.size > 0 ? formatSplit(merged) : prev.split,
    };
  }
  return out;
}

/** Duty and Leave: their own columns, in either language, no money. */
function buildDutyOrLeaveReport(input: {
  type: "duty" | "leave";
  rows: readonly ReportRow[];
  sourceRows: readonly ReportRow[];
  periodLabel: string;
  includeOfficer: boolean;
  language: "en" | "gu";
  officer?: PrintOfficer | null;
  useGujaratiDigits: boolean;
  printSettings?: {
    recipientTitle?: string | null;
    stationName?: string | null;
    signatoryName?: string | null;
    footerPlace?: string | null;
    headerLine1?: string | null;
    headerLine2?: string | null;
    headerLine1En?: string | null;
    headerLine2En?: string | null;
    footerNote?: string | null;
  } | null;
}): PrintReport {
  const { type, rows, periodLabel, includeOfficer, language, officer, useGujaratiDigits, printSettings } = input;
  const gu = language === "gu";
  const num = (v: string | number) => (gu && useGujaratiDigits ? toGujaratiNumerals(v) : String(v));
  const officerCol: PrintColumn[] = includeOfficer
    ? [{ key: "officer", label: gu ? "પોલીસ કર્મી" : "Officer" }]
    : [];
  const headers = gu
    ? getGujaratiReportHeaders({ reportType: type, periodLabel, officer, useGujaratiDigits, printSettings })
    : null;
  const letter = headers
    ? {
        title: headers.title,
        subject: headers.subject,
        salutation: headers.salutation,
        periodLabel: headers.displayPeriod,
        toLines: headers.toLines,
        fromLines: headers.fromLines,
        footerLeft: headers.footerLeft,
        footerRight: headers.footerRight,
      }
    : {
        title: type === "duty" ? "Duty Register" : "Leave Register",
        periodLabel,
      };

  const base = {
    type,
    rawPeriodLabel: periodLabel,
    language,
    useGujaratiDigits,
    rawRows: input.sourceRows,
    headerLine1: printSettings?.headerLine1 ?? undefined,
    headerLine2: printSettings?.headerLine2 ?? undefined,
    headerLine1En: printSettings?.headerLine1En ?? undefined,
    headerLine2En: printSettings?.headerLine2En ?? undefined,
    footerPlace: printSettings?.footerPlace ?? undefined,
    footerNote: printSettings?.footerNote ?? undefined,
    ...letter,
  };

  if (type === "duty") {
    return {
      ...base,
      columns: gu
        ? [
            ...officerCol,
            { key: "dateDay", label: "તારીખ અને વાર" },
            { key: "time", label: "ફરજનો સમય" },
            { key: "details", label: "ફરજની વિગત" },
            { key: "station", label: "ફરજનું સ્થળ" },
            { key: "dayType", label: "દિવસ" },
            { key: "travel", label: "મુસાફરી" },
          ]
        : [
            ...officerCol,
            { key: "dateDay", label: "Date & Day" },
            { key: "time", label: "Shift Time" },
            { key: "details", label: "Duty" },
            { key: "station", label: "Station" },
            { key: "dayType", label: "Day Type" },
            { key: "travel", label: "Travel" },
          ],
      rows: rows.map((r) => {
        const startKey = r.start_date ? String(r.start_date) : String(r.date ?? "").split(" to ")[0];
        const rawEnd = r.end_date ? String(r.end_date) : String(r.date ?? "");
        const endKey = rawEnd.includes(" to ") ? rawEnd.split(" to ")[1] : rawEnd || startKey;
        const multi = startKey && endKey && startKey !== endKey;
        const details = formatDutyReasonWithNotes(
          r.duty_type ? String(r.duty_type) : null,
          r.notes ? String(r.notes) : null,
        );
        const isWorking = String(r.day_type ?? "").toLowerCase().startsWith("working");
        const holidayName = r.holiday_name ? String(r.holiday_name) : "";
        const hasTrip = Boolean(r.ta_from || r.ta_to);

        if (gu) {
          const dayLabel = translateDayTypeToGujarati(r.day_type ? String(r.day_type) : null);
          const trip = hasTrip
            ? [
                formatGujaratiRoute(r.ta_from ? String(r.ta_from) : null, r.ta_to ? String(r.ta_to) : null),
                r.ta_distance_km ? formatGujaratiDistance(String(r.ta_distance_km), useGujaratiDigits) : null,
                formatVehicleAcronym(r.ta_vehicle_type ? String(r.ta_vehicle_type) : null),
              ]
                .filter(Boolean)
                .join(" · ")
            : DASH;
          return {
            ...(includeOfficer ? { officer: text(r.officer) } : {}),
            dateDay: multi
              ? `${formatGujaratiDateWithDay(startKey, useGujaratiDigits)} થી ${formatGujaratiDateWithDay(endKey, useGujaratiDigits)}`
              : formatGujaratiDateWithDay(startKey, useGujaratiDigits),
            time: formatGujaratiShiftTime(r.shift_time ? String(r.shift_time) : null, useGujaratiDigits),
            details,
            station: text(r.location),
            dayType:
              !isWorking && holidayName
                ? `${dayLabel} (${translateDutyTypeToGujarati(holidayName) || holidayName})`
                : dayLabel,
            travel: trip,
          };
        }

        const dateOf = (k: string) =>
          `${formatSafeWeekdayShort(noon(k))}, ${formatSafeDateMonthYear(noon(k))}`;
        return {
          ...(includeOfficer ? { officer: text(r.officer) } : {}),
          dateDay: multi ? `${dateOf(startKey)} → ${dateOf(endKey)}` : dateOf(startKey),
          time: text(r.shift_time),
          details,
          station: text(r.location),
          dayType: !isWorking && holidayName ? `${text(r.day_type)} (${holidayName})` : text(r.day_type),
          travel: hasTrip
            ? [route(r.ta_from, r.ta_to), r.ta_distance_km ? km(r.ta_distance_km) : null]
                .filter(Boolean)
                .join(" · ")
            : DASH,
        };
      }),
    };
  }

  // Leave register
  return {
    ...base,
    columns: gu
      ? [
          ...officerCol,
          { key: "leaveType", label: "રજાનો પ્રકાર" },
          { key: "from", label: "તારીખથી" },
          { key: "to", label: "તારીખ સુધી" },
          { key: "days", label: "દિવસ", align: "right" },
          { key: "split", label: "વિગત" },
          { key: "reason", label: "કારણ" },
        ]
      : [
          ...officerCol,
          { key: "leaveType", label: "Leave Type" },
          { key: "from", label: "From" },
          { key: "to", label: "To" },
          { key: "days", label: "Days", align: "right" },
          { key: "split", label: "Split" },
          { key: "reason", label: "Reason" },
        ],
    rows: rows.map((r) => {
      const name = String(r.leave_type_name ?? r.leave_type ?? "").trim();
      const code = String(r.leave_code ?? "").trim();
      const typeLabel = name ? (code && code !== name ? `${name} (${code})` : name) : code || DASH;
      const half = Number(r.is_half_day) === 1;
      const session = String(r.half_day_session ?? "");
      const split = parseSplit(r.split);
      const startKey = r.start_date ? String(r.start_date) : null;
      const endKey = r.end_date ? String(r.end_date) : startKey;

      return {
        ...(includeOfficer ? { officer: text(r.officer) } : {}),
        leaveType: typeLabel,
        from: gu ? formatGujaratiDate(startKey, { useGujaratiDigits }) : formatSafeDateMonthYear(noon(startKey)) || DASH,
        to: gu ? formatGujaratiDate(endKey, { useGujaratiDigits }) : formatSafeDateMonthYear(noon(endKey)) || DASH,
        days: half
          ? gu
            ? `½ (${session === "PM" ? "બપોર" : "સવાર"})`
            : `½ (${session || "AM"})`
          : num(Number(r.days ?? 0)),
        split: split.size > 1 ? num(formatSplit(split)) : DASH,
        reason: text(r.reason),
      };
    }),
  };
}

export function buildPrintReport(input: {
  type: PrintableReportType;
  rows: readonly ReportRow[];
  periodLabel: string;
  /** An admin printing every officer: add an Officer column. */
  includeOfficer: boolean;
  language?: "en" | "gu";
  officer?: PrintOfficer | null;
  useGujaratiDigits?: boolean;
  consolidateSameDuties?: boolean;
  printSettings?: {
    recipientTitle?: string | null;
    stationName?: string | null;
    signatoryName?: string | null;
    footerPlace?: string | null;
    headerLine1?: string | null;
    headerLine2?: string | null;
    headerLine1En?: string | null;
    headerLine2En?: string | null;
    footerNote?: string | null;
  } | null;
}): PrintReport {
  const {
    type,
    periodLabel,
    includeOfficer,
    language = "en",
    officer,
    useGujaratiDigits = false,
    consolidateSameDuties = false,
    printSettings,
  } = input;

  const sourceRows = consolidateSameDuties
    ? type === "leave"
      ? consolidateLeaveRows(input.rows)
      : consolidateReportRows(input.rows, language)
    : input.rows;

  if (type === "duty" || type === "leave") {
    const ordered = [...sourceRows].sort((a, b) =>
      `${a.start_date ?? a.date ?? ""} ${a.starts_at ?? ""}`.localeCompare(
        `${b.start_date ?? b.date ?? ""} ${b.starts_at ?? ""}`,
      ),
    );
    return buildDutyOrLeaveReport({
      type,
      rows: ordered,
      sourceRows: input.rows,
      periodLabel,
      includeOfficer,
      language,
      officer,
      useGujaratiDigits,
      printSettings,
    });
  }

  // Oldest first reads like a register; the screen lists newest first.
  const rows = [...sourceRows].sort((a, b) =>
    `${a.start_date ?? a.date ?? ""} ${a.starts_at ?? ""}`.localeCompare(
      `${b.start_date ?? b.date ?? ""} ${b.starts_at ?? ""}`,
    ),
  );

  const officerCol: PrintColumn[] = includeOfficer ? [{ key: "officer", label: language === "gu" ? "પોલીસ કર્મી" : "Officer" }] : [];

  // Gujarati official Gujarat Police formats
  if (language === "gu") {
    const headers = getGujaratiReportHeaders({
      reportType: type,
      periodLabel,
      officer,
      useGujaratiDigits,
      printSettings,
    });

    if (type === "ta") {
      return {
        type,
        title: headers.title,
        subject: headers.subject,
        salutation: headers.salutation,
        periodLabel: headers.displayPeriod,
        rawPeriodLabel: periodLabel,
        toLines: headers.toLines,
        fromLines: headers.fromLines,
        footerLeft: headers.footerLeft,
        footerRight: headers.footerRight,
        headerLine1: printSettings?.headerLine1 ?? undefined,
        headerLine2: printSettings?.headerLine2 ?? undefined,
        headerLine1En: printSettings?.headerLine1En ?? undefined,
        headerLine2En: printSettings?.headerLine2En ?? undefined,
        footerPlace: printSettings?.footerPlace ?? undefined,
        footerNote: printSettings?.footerNote ?? undefined,
        language: "gu",
        useGujaratiDigits,
        columns: [
          ...officerCol,
          { key: "startDate", label: "મુસાફરી શરૂ કર્યા તા.ટા." },
          { key: "endDate", label: "મુસાફરી પૂરૂ કર્યા તા.ટા." },
          { key: "route", label: "ક્યાંથી ક્યાં સુધી" },
          { key: "reason", label: "કારણ" },
          { key: "vehicle", label: "સ.વા. / ખ.વા." },
          { key: "distance", label: "કિ.મી.", align: "right" },
        ],
        rows: rows.map((r) => {
          const startDateKey = r.start_date ? String(r.start_date) : r.date ? String(r.date).split(" to ")[0] : null;
          const endDateKey = r.end_date ? String(r.end_date) : r.date && String(r.date).includes(" to ") ? String(r.date).split(" to ")[1] : startDateKey;
          const isNextDay =
            Number(r.is_next_day) === 1 ||
            Boolean(r.shift_time && /\(next\s*day\)|બીજે\s*દિવસે/i.test(String(r.shift_time))) ||
            (Boolean(startDateKey && endDateKey) &&
              nextDayKey(String(startDateKey)) === String(endDateKey) &&
              !String(r.notes ?? "").includes("દિવસ"));
          const startDateStr = formatGujaratiDate(startDateKey, { useGujaratiDigits });
          const endDateStr = formatGujaratiDate(endDateKey, { useGujaratiDigits });
          const startT = r.starts_at ? formatGujaratiShiftTime(String(r.starts_at), useGujaratiDigits) : "";
          const endT = r.ends_at ? formatGujaratiShiftTime(String(r.ends_at), useGujaratiDigits) : "";
          const combinedReason = formatDutyReasonWithNotes(
            r.duty_type ? String(r.duty_type) : null,
            r.notes ? String(r.notes) : null,
          );

          const nextDayTag = isNextDay ? " (બીજે દિવસે)" : "";
          const endDateFormatted = endT
            ? `${endDateStr} ${endT}${nextDayTag}`
            : (isNextDay ? `${endDateStr}${nextDayTag}` : endDateStr);

          return {
            ...(includeOfficer ? { officer: text(r.officer) } : {}),
            startDate: startT ? `${startDateStr} ${startT}` : startDateStr,
            endDate: endDateFormatted,
            route: formatGujaratiRoute(r.ta_from ? String(r.ta_from) : null, r.ta_to ? String(r.ta_to) : null),
            reason: combinedReason,
            vehicle: formatVehicleAcronym(r.ta_vehicle_type ? String(r.ta_vehicle_type) : null),
            distance: formatGujaratiDistance(r.ta_distance_km ? String(r.ta_distance_km) : null, useGujaratiDigits),
            // Backward-compatible fallback keys
            date: startDateStr !== endDateStr ? `${startDateStr} થી ${endDateStr}` : startDateStr,
            day: formatSafeWeekdayShort(noon(startDateKey)) || DASH,
            duty: combinedReason,
            time: formatGujaratiShiftTime(r.shift_time ? String(r.shift_time) : null, useGujaratiDigits),
            station: text(r.location),
          };
        }),
        rawRows: input.rows,
      };
    }

    // Holiday Claim (Photo 2)
    return {
      type,
      title: headers.title,
      subject: headers.subject,
      salutation: headers.salutation,
      periodLabel: headers.displayPeriod,
      rawPeriodLabel: periodLabel,
      toLines: headers.toLines,
      fromLines: headers.fromLines,
      footerLeft: headers.footerLeft,
      footerRight: headers.footerRight,
      headerLine1: printSettings?.headerLine1 ?? undefined,
      headerLine2: printSettings?.headerLine2 ?? undefined,
      headerLine1En: printSettings?.headerLine1En ?? undefined,
      headerLine2En: printSettings?.headerLine2En ?? undefined,
      footerPlace: printSettings?.footerPlace ?? undefined,
      footerNote: printSettings?.footerNote ?? undefined,
      language: "gu",
      useGujaratiDigits,
      columns: [
        ...officerCol,
        { key: "dateDay", label: "ફરજ બજાવ્યા તારીખ અને વાર" },
        { key: "time", label: "ફરજનો સમય" },
        { key: "details", label: "ફરજની વિગત" },
        { key: "remarks", label: "રિમાર્ક્સ" },
      ],
      rows: rows.map((r, idx) => {
        const sr = useGujaratiDigits ? toGujaratiNumerals(idx + 1) : String(idx + 1);
        const startDateKey = r.start_date ? String(r.start_date) : r.date ? String(r.date).split(" to ")[0] : null;
        const endDateKey = r.end_date ? String(r.end_date) : r.date && String(r.date).includes(" to ") ? String(r.date).split(" to ")[1] : startDateKey;
        const isNextDay = startDateKey && endDateKey && startDateKey !== endDateKey;
        const dateWithDay = isNextDay
          ? `${formatGujaratiDateWithDay(startDateKey, useGujaratiDigits)} થી ${formatGujaratiDateWithDay(endDateKey, useGujaratiDigits)}`
          : formatGujaratiDateWithDay(startDateKey, useGujaratiDigits);
        const shiftT = formatGujaratiShiftTime(r.shift_time ? String(r.shift_time) : null, useGujaratiDigits);
        const combinedReason = formatDutyReasonWithNotes(
          r.duty_type ? String(r.duty_type) : null,
          r.notes ? String(r.notes) : null,
        );
        const vAcronym = formatVehicleAcronym(r.ta_vehicle_type ? String(r.ta_vehicle_type) : null);
        const dist = r.ta_distance_km ? formatGujaratiDistance(String(r.ta_distance_km), useGujaratiDigits) : "";
        const rawHoliday = r.holiday_name ? String(r.holiday_name) : DASH;
        const translatedHoliday = translateDutyTypeToGujarati(rawHoliday) || rawHoliday;
        const hasTa = Boolean(r.ta_from || r.ta_to || r.ta_amount || (r.ta_distance_km && Number(r.ta_distance_km) > 0));
        const routeStr = formatGujaratiRoute(r.ta_from ? String(r.ta_from) : null, r.ta_to ? String(r.ta_to) : null);
        let rem = translatedHoliday;
        if (hasTa) {
          if (routeStr && routeStr !== "—") {
            rem = dist && dist !== "—" ? `${routeStr} (${vAcronym} / ${dist})` : routeStr;
          } else if (dist && dist !== "—") {
            rem = `${vAcronym} / ${dist}`;
          }
        }

        return {
          srNo: sr,
          ...(includeOfficer ? { officer: text(r.officer) } : {}),
          dateDay: dateWithDay,
          time: shiftT,
          details: combinedReason,
          remarks: rem,
          // Backward-compatible keys
          date: dateWithDay,
          holiday: holidayLabel(r.holiday_name, r.day_type),
          duty: combinedReason,
          station: text(r.location),
          travel: dist ? `${route(r.ta_from, r.ta_to)} · ${dist}` : DASH,
        };
      }),
      rawRows: input.rows,
    };
  }

  // English fallback (preserving exact previous structure)
  if (type === "ta") {
    return {
      type,
      title: "Travelling Allowance (TA) Report",
      periodLabel,
      rawPeriodLabel: periodLabel,
      columns: [
        ...officerCol,
        { key: "date", label: "Date" },
        { key: "day", label: "Day" },
        { key: "duty", label: "Duty Type" },
        { key: "time", label: "Shift Time" },
        { key: "station", label: "Station" },
        { key: "route", label: "From → To" },
        { key: "distance", label: "Distance", align: "right" },
      ],
      rows: rows.map((r) => {
        const startDateKey = r.start_date ? String(r.start_date) : r.date ? String(r.date).split(" to ")[0] : null;
        const endDateKey = r.end_date ? String(r.end_date) : r.date && String(r.date).includes(" to ") ? String(r.date).split(" to ")[1] : startDateKey;
        const isNextDay =
          Number(r.is_next_day) === 1 ||
          Boolean(r.shift_time && /\(next\s*day\)|બીજે\s*દિવસે/i.test(String(r.shift_time))) ||
          (Boolean(startDateKey && endDateKey) &&
            nextDayKey(String(startDateKey)) === String(endDateKey) &&
            !String(r.notes ?? "").includes("day"));
        const dateDisplay = isNextDay
          ? `${formatSafeDateMonthYear(noon(startDateKey))} → ${formatSafeDateMonthYear(noon(endDateKey))}`
          : formatSafeDateMonthYear(noon(startDateKey)) || text(startDateKey);
        const dayDisplay = isNextDay
          ? `${formatSafeWeekdayShort(noon(startDateKey))} → ${formatSafeWeekdayShort(noon(endDateKey))}`
          : formatSafeWeekdayShort(noon(startDateKey)) || DASH;

        let timeStr = text(r.shift_time);
        if (isNextDay && timeStr && !/\(next\s*day\)/i.test(timeStr)) {
          timeStr = `${timeStr} (Next Day)`;
        }

        return {
          ...(includeOfficer ? { officer: text(r.officer) } : {}),
          date: dateDisplay,
          day: dayDisplay,
          duty: formatDutyReasonWithNotes(r.duty_type ? String(r.duty_type) : null, r.notes ? String(r.notes) : null),
          time: timeStr,
          station: text(r.location),
          route: route(r.ta_from, r.ta_to),
          distance: km(r.ta_distance_km),
        };
      }),
      rawRows: input.rows,
    };
  }

  return {
    type,
    title: "Holiday Worked Report",
    periodLabel,
    rawPeriodLabel: periodLabel,
    columns: [
      ...officerCol,
      { key: "date", label: "Date" },
      { key: "holiday", label: "Holiday" },
      { key: "duty", label: "Duty Type" },
      { key: "time", label: "Shift Time" },
      { key: "station", label: "Station" },
      { key: "travel", label: "Travel" },
    ],
    rows: rows.map((r) => {
      const trip = route(r.ta_from, r.ta_to);
      const dist = km(r.ta_distance_km);
      const combinedReason = formatDutyReasonWithNotes(
        r.duty_type ? String(r.duty_type) : null,
        r.notes ? String(r.notes) : null,
      );
      const startDateKey = r.start_date ? String(r.start_date) : r.date ? String(r.date).split(" to ")[0] : null;
      const endDateKey = r.end_date ? String(r.end_date) : r.date && String(r.date).includes(" to ") ? String(r.date).split(" to ")[1] : startDateKey;
      const isNextDay = startDateKey && endDateKey && startDateKey !== endDateKey;
      const dateDisplay = isNextDay
        ? `${formatSafeWeekdayShort(noon(startDateKey))}, ${formatSafeDateMonthYear(noon(startDateKey))} → ${formatSafeWeekdayShort(noon(endDateKey))}, ${formatSafeDateMonthYear(noon(endDateKey))}`
        : `${formatSafeWeekdayShort(noon(startDateKey))}, ${formatSafeDateMonthYear(noon(startDateKey))}`;

      return {
        ...(includeOfficer ? { officer: text(r.officer) } : {}),
        date: dateDisplay,
        holiday: holidayLabel(r.holiday_name, r.day_type),
        duty: combinedReason,
        time: text(r.shift_time),
        station: text(r.location),
        travel: trip === DASH ? DASH : dist === DASH ? trip : `${trip} · ${dist}`,
      };
    }),
    rawRows: input.rows,
  };
}

const ENGLISH_MONTHS_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const GUJARATI_MONTH_NAME_TO_ENGLISH: Record<string, string> = {
  "જાન્યુઆરી": "January",
  "ફેબ્રુઆરી": "February",
  "માર્ચ": "March",
  "એપ્રિલ": "April",
  "મે": "May",
  "જૂન": "June",
  "જુલાઈ": "July",
  "ઓગસ્ટ": "August",
  "સપ્ટેમ્બર": "September",
  "ઓક્ટોબર": "October",
  "નવેમ્બર": "November",
  "ડિસેમ્બર": "December",
};

/**
 * Builds a clean, OS-safe file name for the PDF report according to report type and month.
 * e.g. "TA-Report-September-2026-Ramesh-Patel.pdf"
 * e.g. "Holiday-Worked-Report-September-2026-Ramesh-Patel.pdf"
 */
export function printFileName(report: PrintReport, officer: PrintOfficer | null): string {
  const slug = (s: string) =>
    s
      .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "");

  // 1. Report Kind (TA-Report, Holiday-Worked-Report, etc.)
  let kind = "TA-Report";
  if (report.type === "duty") {
    kind = "Duty-Report";
  } else if (report.type === "leave") {
    kind = "Leave-Report";
  } else if (report.type === "holiday") {
    kind = "Holiday-Worked-Report";
  } else if (report.type === "ta") {
    kind = "TA-Report";
  } else if (
    report.title.toLowerCase().includes("holiday") ||
    report.title.includes("રજા") ||
    report.title.startsWith("Holiday")
  ) {
    kind = "Holiday-Worked-Report";
  } else if (
    report.title.toLowerCase().includes("ta") ||
    report.title.includes("મુસાફરી") ||
    report.title.startsWith("Travelling") ||
    report.title.startsWith("TA")
  ) {
    kind = "TA-Report";
  } else if (report.title) {
    kind = slug(report.title) || "Report";
  }

  // 2. Month and Year
  const periodStr = (report.rawPeriodLabel || report.periodLabel || "").trim();
  const asciiPeriod = toAsciiNumerals(periodStr).trim();

  // Try parsing period components
  const parsed = parsePeriodLabel(asciiPeriod) || parsePeriodLabel(periodStr);
  let periodSlug = "";
  if (parsed?.monthIndex && parsed?.year) {
    const engMonth = ENGLISH_MONTHS_NAMES[parsed.monthIndex - 1] || `Month-${parsed.monthIndex}`;
    periodSlug = `${engMonth}-${parsed.year}`;
  } else {
    // Translate any Gujarati month to English
    let translated = asciiPeriod;
    for (const [guMonth, enMonth] of Object.entries(GUJARATI_MONTH_NAME_TO_ENGLISH)) {
      if (translated.includes(guMonth)) {
        translated = translated.replace(guMonth, enMonth);
      }
    }
    periodSlug = slug(translated);
    if (!periodSlug) {
      const yearMatch = asciiPeriod.match(/\d{4}/);
      periodSlug = yearMatch ? yearMatch[0] : slug(periodStr) || "Report-Period";
    }
  }

  // 3. Officer Name or All-Officers
  const officerSlug = officer?.name ? slug(officer.name) || "Officer" : "All-Officers";

  return [kind, periodSlug, officerSlug]
    .filter(Boolean)
    .join("-")
    .concat(".pdf");
}
