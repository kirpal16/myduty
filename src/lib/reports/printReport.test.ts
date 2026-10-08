import { describe, it, expect } from "vitest";
import {
  buildPrintReport,
  consolidateLeaveRows,
  isPrintableReport,
  printFileName,
} from "./printReport";
import type { ReportRow } from "./buildMonthlyReport";

const TA_ROWS: ReportRow[] = [
  {
    officer: "Ramesh Patel",
    duty_type: "Bandobast",
    date: "2026-09-14",
    shift_time: "08:00 - 18:00",
    starts_at: "08:00",
    location: "Gandhinagar",
    status: "COMPLETED",
    ta_from: "Ahmedabad",
    ta_to: "Gandhinagar",
    ta_distance_km: 32,
    ta_amount: 450,
  },
  {
    officer: "Ramesh Patel",
    duty_type: "Patrol",
    date: "2026-09-02",
    shift_time: "09:00 - 17:00",
    starts_at: "09:00",
    location: null,
    status: "SCHEDULED",
    ta_from: "Ahmedabad",
    ta_to: null,
    ta_distance_km: 12.5,
    ta_amount: 120,
  },
];

const HOLIDAY_ROWS: ReportRow[] = [
  {
    officer: "Ramesh Patel",
    duty_type: "Bandobast",
    date: "2026-11-08",
    shift_time: "07:00 - 15:00",
    starts_at: "07:00",
    location: "Rajkot",
    day_type: "Public Holiday",
    holiday_name: "Diwali",
    status: "COMPLETED",
    ta_from: null,
    ta_to: null,
    ta_distance_km: null,
    holiday_allowance: 900,
  },
  {
    officer: "Ramesh Patel",
    duty_type: "Patrol",
    date: "2026-09-13",
    shift_time: "10:00 - 18:00",
    starts_at: "10:00",
    location: null,
    day_type: "Weekend Off",
    holiday_name: "Sunday",
    status: "COMPLETED",
    ta_from: "Surat",
    ta_to: "Navsari",
    ta_distance_km: 40,
    holiday_allowance: 900,
  },
];

const everything = (r: ReturnType<typeof buildPrintReport>) =>
  [...r.rows.flatMap((row) => Object.values(row)), ...r.columns.map((c) => c.label)].join(" ");

describe("buildPrintReport — TA", () => {
  const report = buildPrintReport({
    type: "ta",
    rows: TA_ROWS,
    periodLabel: "September 2026",
    includeOfficer: false,
  });

  it("lists every duty detail, oldest first", () => {
    expect(report.title).toBe("Travelling Allowance (TA) Report");
    expect(report.columns.map((c) => c.key)).toEqual([
      "date", "day", "duty", "time", "station", "route", "distance",
    ]);
    expect(report.rows[0]).toEqual({
      date: "Sep 2, 2026",
      day: "Wed",
      duty: "Patrol",
      time: "09:00 - 17:00",
      station: "—",
      route: "Ahmedabad → ?",
      distance: "12.5 km",
    });
    expect(report.rows[1]).toMatchObject({ route: "Ahmedabad → Gandhinagar", distance: "32 km" });
  });

  it("prints no money, no status and no totals", () => {
    expect(everything(report)).not.toMatch(/₹|450|120|Status|Completed|Scheduled/i);
    expect(report).not.toHaveProperty("footer");
  });

  it("has no Officer column for one officer", () => {
    expect(report.columns.some((c) => c.key === "officer")).toBe(false);
  });
});

describe("buildPrintReport — Holiday Worked", () => {
  const report = buildPrintReport({
    type: "holiday",
    rows: HOLIDAY_ROWS,
    periodLabel: "2026",
    includeOfficer: true,
  });

  it("names each holiday with its kind and shows any travel", () => {
    expect(report.title).toBe("Holiday Worked Report");
    expect(report.rows[0]).toMatchObject({
      officer: "Ramesh Patel",
      date: "Sun, Sep 13, 2026",
      holiday: "Sunday · Weekend Off",
      travel: "Surat → Navsari · 40 km",
    });
    expect(report.rows[1]).toMatchObject({ holiday: "Diwali · Public Holiday", travel: "—" });
  });

  it("adds the Officer column when printing all officers", () => {
    expect(report.columns[0]).toEqual({ key: "officer", label: "Officer" });
  });

  it("prints no pay and no status", () => {
    expect(everything(report)).not.toMatch(/₹|900|Status|Completed/i);
  });
});

describe("helpers", () => {
  it("every report type is printable", () => {
    expect(isPrintableReport("ta")).toBe(true);
    expect(isPrintableReport("holiday")).toBe(true);
    expect(isPrintableReport("duty")).toBe(true);
    expect(isPrintableReport("leave")).toBe(true);
    expect(isPrintableReport("other")).toBe(false);
  });

  it("builds a safe file name", () => {
    const report = buildPrintReport({ type: "ta", rows: [], periodLabel: "September 2026", includeOfficer: false });
    expect(printFileName(report, { name: "Ramesh K. Patel", post: "PSI" })).toBe(
      "TA-Report-September-2026-Ramesh-K-Patel.pdf",
    );
    expect(printFileName(report, null)).toBe("TA-Report-September-2026-All-Officers.pdf");
  });

  it("builds PDF filename according to report type and month for Gujarati reports", () => {
    const gujTaReport = buildPrintReport({
      type: "ta",
      rows: [],
      periodLabel: "September 2026",
      includeOfficer: false,
      language: "gu",
    });
    expect(printFileName(gujTaReport, { name: "Ramesh Patel", post: "PSI" })).toBe(
      "TA-Report-September-2026-Ramesh-Patel.pdf",
    );

    const gujHolidayReport = buildPrintReport({
      type: "holiday",
      rows: [],
      periodLabel: "March 2026",
      includeOfficer: false,
      language: "gu",
    });
    expect(printFileName(gujHolidayReport, { name: "Ramesh Patel", post: "PSI" })).toBe(
      "Holiday-Worked-Report-March-2026-Ramesh-Patel.pdf",
    );
  });

  it("handles Gujarati period labels and Unicode names correctly in PDF filename", () => {
    const reportWithGuPeriod = {
      type: "ta" as const,
      title: "મુસાફરી ભથ્થાનું બીલ (TA Report)",
      periodLabel: "સપ્ટેમ્બર ૨૦૨૬",
      columns: [],
      rows: [],
    };
    expect(printFileName(reportWithGuPeriod, { name: "રમેશ પટેલ", post: "PSI" })).toBe(
      "TA-Report-September-2026-રમેશ-પટેલ.pdf",
    );
  });

  it("accurately reflects different dates for Next Day overnight duties in Gujarati TA report", () => {
    const overnightRow: ReportRow = {
      officer: "Ramesh Patel",
      duty_type: "Night Bandobast",
      date: "2026-09-01 to 2026-09-02",
      start_date: "2026-09-01",
      end_date: "2026-09-02",
      is_next_day: 1,
      shift_time: "11:00 - 03:00 (Next Day)",
      starts_at: "11:00",
      ends_at: "03:00",
      ta_from: "Surat",
      ta_to: "Navsari",
      ta_distance_km: 35,
      ta_vehicle_type: "private",
    };

    const gujReport = buildPrintReport({
      type: "ta",
      rows: [overnightRow],
      periodLabel: "September 2026",
      includeOfficer: false,
      language: "gu",
      useGujaratiDigits: false,
    });

    // Start date must be 01/09/2026 and End date must be 02/09/2026 with (બીજે દિવસે)
    expect(gujReport.rows[0].startDate).toBe("01/09/2026 11/00");
    expect(gujReport.rows[0].endDate).toBe("02/09/2026 03/00 (બીજે દિવસે)");
    expect(gujReport.rows[0].time).toBe("11/00 થી 03/00 (બીજે દિવસે)");

    // Test with Gujarati digits
    const gujReportDigits = buildPrintReport({
      type: "ta",
      rows: [overnightRow],
      periodLabel: "September 2026",
      includeOfficer: false,
      language: "gu",
      useGujaratiDigits: true,
    });
    expect(gujReportDigits.rows[0].endDate).toBe("૦૨/૦૯/૨૦૨૬ ૦૩/૦૦ (બીજે દિવસે)");

    const engReport = buildPrintReport({
      type: "ta",
      rows: [overnightRow],
      periodLabel: "September 2026",
      includeOfficer: false,
      language: "en",
    });

    expect(engReport.rows[0].date).toBe("Sep 1, 2026 → Sep 2, 2026");
    expect(engReport.rows[0].day).toBe("Tue → Wed");
    expect(engReport.rows[0].time).toBe("11:00 - 03:00 (Next Day)");
  });

  it("consolidates multi-day identical duties (e.g. 25 days in Ahmedabad) into a single concise row for print", () => {
    // Generate 25 consecutive daily duties at Ahmedabad
    const multiDayRows: ReportRow[] = Array.from({ length: 25 }, (_, i) => {
      const dayNum = String(i + 1).padStart(2, "0");
      const dateStr = `2026-08-${dayNum}`;
      return {
        officer: "Ramesh Patel",
        duty_type: "Bandobast",
        notes: "15 August Preparation",
        date: dateStr,
        start_date: dateStr,
        end_date: dateStr,
        starts_at: "08:00",
        ends_at: "20:00",
        ta_from: "Surat",
        ta_to: "Ahmedabad",
        ta_distance_km: 280,
        ta_vehicle_type: "govt",
        ta_amount: 1500,
      };
    });

    // Add 5 different duties with different places/duties at the end of the month
    const differentRows: ReportRow[] = [
      { day: 26, duty: "Court", to: "Surat Court" },
      { day: 27, duty: "Patrol", to: "Station Area" },
      { day: 28, duty: "Investigation", to: "Varachha" },
      { day: 29, duty: "VIP Escort", to: "Airport" },
      { day: 30, duty: "Station Duty", to: "Police Station" },
    ].map((d) => ({
      officer: "Ramesh Patel",
      duty_type: d.duty,
      notes: `${d.duty} Duty`,
      date: `2026-08-${d.day}`,
      start_date: `2026-08-${d.day}`,
      end_date: `2026-08-${d.day}`,
      starts_at: "09:00",
      ends_at: "17:00",
      ta_from: "Surat",
      ta_to: d.to,
      ta_distance_km: 15,
      ta_vehicle_type: "private",
    }));

    const allMonthRows = [...multiDayRows, ...differentRows];

    // 1. Detailed mode (default) -> 25 + 5 = 30 separate rows
    const detailed = buildPrintReport({
      type: "ta",
      rows: allMonthRows,
      periodLabel: "August 2026",
      includeOfficer: false,
      language: "gu",
      useGujaratiDigits: false,
      consolidateSameDuties: false,
    });
    expect(detailed.rows.length).toBe(30);

    // 2. Consolidated mode -> 25 same days collapse to 1 row + 5 different days = 6 total entries!
    const consolidated = buildPrintReport({
      type: "ta",
      rows: allMonthRows,
      periodLabel: "August 2026",
      includeOfficer: false,
      language: "gu",
      useGujaratiDigits: false,
      consolidateSameDuties: true,
    });
    expect(consolidated.rows.length).toBe(6);

    const mergedRow = consolidated.rows[0];
    expect(mergedRow.startDate).toBe("01/08/2026 08/00");
    expect(mergedRow.endDate).toBe("25/08/2026 20/00");
    expect(mergedRow.route).toBe("Surat થી Ahmedabad");
    expect(mergedRow.reason).toContain("(25 દિવસ)");
    expect(mergedRow.vehicle).toBe("સ.વા.");
    // KM is NOT summed/plus; it is the single journey distance (280 કિ.મી.)
    expect(mergedRow.distance).toBe("280 કિ.મી.");

    // And the remaining 5 entries remain individual rows
    expect(consolidated.rows[1].startDate).toBe("26/08/2026 09/00");
    expect(consolidated.rows[5].startDate).toBe("30/08/2026 09/00");
  });
});


// ---------------------------------------------------------------------------
// Duty and Leave registers
// ---------------------------------------------------------------------------

const DUTY_ROWS: ReportRow[] = [
  {
    officer: "Ramesh Patel",
    duty_type: "Patrol",
    notes: null,
    date: "2026-09-13",
    start_date: "2026-09-13",
    end_date: "2026-09-13",
    shift_time: "10:00 - 18:00",
    starts_at: "10:00",
    ends_at: "18:00",
    location: "Surat",
    day_type: "Weekend Off",
    holiday_name: "Sunday",
    status: "COMPLETED",
    ta_from: "Surat",
    ta_to: "Navsari",
    ta_vehicle_type: "private",
    ta_distance_km: 40,
    ta_amount: 700,
    holiday_allowance: 900,
  },
  {
    officer: "Ramesh Patel",
    duty_type: "Bandobast",
    notes: null,
    date: "2026-09-02",
    start_date: "2026-09-02",
    end_date: "2026-09-02",
    shift_time: "08:00 - 16:00",
    starts_at: "08:00",
    ends_at: "16:00",
    location: null,
    day_type: "Working Day",
    holiday_name: null,
    status: "SCHEDULED",
    ta_from: null,
    ta_to: null,
    ta_distance_km: null,
    ta_amount: null,
    holiday_allowance: null,
  },
];

const LEAVE_ROWS: ReportRow[] = [
  {
    officer: "Ramesh Patel",
    leave_type: "Multi-Type (3 CL, 2 HL)",
    leave_type_name: "Casual Leave",
    leave_code: "CL",
    start_date: "2026-09-10",
    end_date: "2026-09-14",
    days: 5,
    is_half_day: 0,
    half_day_session: null,
    split: "3 CL + 2 HL",
    reason: "Family function",
  },
  {
    officer: "Ramesh Patel",
    leave_type: "Casual Leave",
    leave_type_name: "Casual Leave",
    leave_code: "CL",
    start_date: "2026-09-15",
    end_date: "2026-09-16",
    days: 2,
    is_half_day: 0,
    half_day_session: null,
    split: "2 CL",
    reason: "Family function",
  },
  {
    officer: "Ramesh Patel",
    leave_type: "Casual Leave",
    leave_type_name: "Casual Leave",
    leave_code: "CL",
    start_date: "2026-09-22",
    end_date: "2026-09-22",
    days: 0.5,
    is_half_day: 1,
    half_day_session: "PM",
    split: "0.5 CL",
    reason: null,
  },
];

describe("buildPrintReport — Duty register", () => {
  const en = buildPrintReport({ type: "duty", rows: DUTY_ROWS, periodLabel: "September 2026", includeOfficer: false });

  it("lists every duty, oldest first, with day type and travel", () => {
    expect(en.title).toBe("Duty Register");
    expect(en.columns.map((c) => c.key)).toEqual(["dateDay", "time", "details", "station", "dayType", "travel"]);
    expect(en.rows[0]).toMatchObject({ dateDay: "Wed, Sep 2, 2026", travel: "—", dayType: "Working Day" });
    expect(en.rows[1]).toMatchObject({
      dayType: "Weekend Off (Sunday)",
      travel: "Surat → Navsari · 40 km",
    });
  });

  it("never prints money", () => {
    const all = [...en.rows.flatMap((r) => Object.values(r)), ...en.columns.map((c) => c.label)].join(" ");
    expect(all).not.toMatch(/₹|700|900|amount|allowance|pay/i);
  });

  it("builds a Gujarati letter with duty wording", () => {
    const gu = buildPrintReport({
      type: "duty",
      rows: DUTY_ROWS,
      periodLabel: "September 2026",
      includeOfficer: false,
      language: "gu",
      useGujaratiDigits: false,
    });
    expect(gu.title).toContain("ફરજ પત્રક");
    expect(gu.subject).toContain("બજાવેલ ફરજ");
    expect(gu.rows[1].dayType).toContain("સાપ્તાહિક રજા");
  });

  it("merges same consecutive duties into one row with a date range", () => {
    const same = Array.from({ length: 3 }, (_, i) => ({
      ...DUTY_ROWS[1],
      date: `2026-09-0${i + 2}`,
      start_date: `2026-09-0${i + 2}`,
      end_date: `2026-09-0${i + 2}`,
    }));
    const merged = buildPrintReport({
      type: "duty",
      rows: same,
      periodLabel: "September 2026",
      includeOfficer: false,
      consolidateSameDuties: true,
    });
    expect(merged.rows).toHaveLength(1);
    expect(merged.rows[0].dateDay).toContain("→");
  });

  it("names the file Duty-Report", () => {
    expect(printFileName(en, { name: "Ramesh Patel", post: "PSI" })).toBe(
      "Duty-Report-September-2026-Ramesh-Patel.pdf",
    );
  });
});

describe("buildPrintReport — Leave register", () => {
  const report = buildPrintReport({
    type: "leave",
    rows: LEAVE_ROWS,
    periodLabel: "September 2026",
    includeOfficer: false,
  });

  it("shows dates, days, half-day session, split and reason", () => {
    expect(report.title).toBe("Leave Register");
    expect(report.columns.map((c) => c.key)).toEqual(["leaveType", "from", "to", "days", "split", "reason"]);
    expect(report.rows[0]).toMatchObject({
      leaveType: "Casual Leave (CL)",
      days: "5",
      split: "3 CL + 2 HL",
      reason: "Family function",
    });
    expect(report.rows[1].split).toBe("—");
    expect(report.rows[2].days).toBe("½ (PM)");
  });

  it("prints no totals box", () => {
    expect(report).not.toHaveProperty("summaryLines");
  });

  it("uses Gujarati leave wording and ½ session labels", () => {
    const gu = buildPrintReport({
      type: "leave",
      rows: LEAVE_ROWS,
      periodLabel: "September 2026",
      includeOfficer: false,
      language: "gu",
      useGujaratiDigits: true,
    });
    expect(gu.title).toContain("રજા પત્રક");
    expect(gu.rows[2].days).toBe("½ (બપોર)");  });

  it("names the file Leave-Report", () => {
    expect(printFileName(report, null)).toBe("Leave-Report-September-2026-All-Officers.pdf");
  });
});

describe("consolidateLeaveRows", () => {
  it("merges back-to-back leaves of the same type and reason, adding days and splits", () => {
    const merged = consolidateLeaveRows(LEAVE_ROWS);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({
      start_date: "2026-09-10",
      end_date: "2026-09-16",
      days: 7,
      split: "5 CL + 2 HL",
    });
  });

  it("keeps leaves apart when there is a gap or a different reason", () => {
    const gap = { ...LEAVE_ROWS[1], start_date: "2026-09-17", end_date: "2026-09-18" };
    expect(consolidateLeaveRows([LEAVE_ROWS[0], gap])).toHaveLength(2);
    const otherReason = { ...LEAVE_ROWS[1], reason: "Medical" };
    expect(consolidateLeaveRows([LEAVE_ROWS[0], otherReason])).toHaveLength(2);
  });

  it("never merges a half day", () => {
    const halfNext = { ...LEAVE_ROWS[2], start_date: "2026-09-17", end_date: "2026-09-17", reason: "Family function" };
    expect(consolidateLeaveRows([LEAVE_ROWS[1], halfNext])).toHaveLength(2);
  });
});