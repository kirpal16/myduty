"use client";

import { useState, useEffect } from "react";
import type { PrintOfficer, PrintReport } from "@/lib/reports/printReport";
import {
  formatGujaratiDate,
  getGujaratiReportHeaders,
  toGujaratiNumerals,
  formatGujaratiBuckleNumber,
  transliterateToGujarati,
  formatGujaratiPoliceRank,
  parseApplicantLineSegments,
} from "@/lib/reports/gujaratiReportUtils";

/**
 * What the printer sees: invisible on screen (`hidden print:block`), the only
 * thing on the page when printing. Laid out like an office record:
 * letterhead, report title, a boxed block of officer details, then every row
 * (not just the page on screen). No amounts, no status, no totals.
 *
 * The outer table's empty thead/tfoot rows repeat on every printed page and
 * act as the top and bottom margins. That lets `@page { margin: 0 }` remove
 * the browser's own date/URL header and footer while every page still keeps
 * proper white space (styles: `.rp-*` in globals.css).
 */
export function ReportPrintView({
  report,
  officer,
}: {
  report: PrintReport;
  /** null = an admin printing all officers. */
  officer: PrintOfficer | null;
}) {
  const [config, setConfig] = useState<{
    headerLine1?: string;
    headerLine2?: string;
    headerLine1En?: string;
    headerLine2En?: string;
    recipientTitle?: string;
    stationName?: string;
    signatoryName?: string;
    footerPlace?: string;
    footerNote?: string;
  }>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem("duty_print_config");
      if (raw) setConfig(JSON.parse(raw));
    } catch {}
  }, []);

  const isGujarati = report.language === "gu";
  const fallbackHeaders = getGujaratiReportHeaders({
    reportType: report.type ?? "ta",
    periodLabel: report.rawPeriodLabel ?? report.periodLabel,
    officer,
    useGujaratiDigits: report.useGujaratiDigits ?? true,
    printSettings: {
      recipientTitle: config.recipientTitle,
      stationName: config.stationName,
      signatoryName: config.signatoryName,
    },
  });
  const printDateStr = formatGujaratiDate(new Date(), {
    useGujaratiDigits: report.useGujaratiDigits ?? true,
  });

  const header1 = config.headerLine1 || report.headerLine1 || "ગુજરાત પોલીસ (GUJARAT POLICE)";
  const header2 = config.headerLine2 || report.headerLine2 || config.stationName || officer?.posting || officer?.department || "QRT અરવલ્લી પોલીસ";
  const header1En = config.headerLine1En || report.headerLine1En || "Gujarat Police";
  const header2En = config.headerLine2En || report.headerLine2En || officer?.department || "Duty & Roster Records";
  const footerPlace = config.footerPlace || report.footerPlace || (officer?.posting?.split(",")[0] ?? "") || "અરવલ્લી";
  const footerNote = config.footerNote || report.footerNote || "";

  const toLines = (config.recipientTitle || config.stationName)
    ? `પ્રતિ,\n${config.recipientTitle || "પોલીસ સબ ઇન્સપેક્ટરશ્રી"},\n${config.stationName || officer?.posting || "પોલીસ સ્ટેશન"}`
    : (report.toLines || fallbackHeaders.toLines);

  const details: { label: string; value: string }[] = officer
    ? [
        { label: "Officer Name", value: officer.name },
        { label: "Post", value: officer.post ?? "—" },
        ...(officer.department ? [{ label: "Department", value: officer.department }] : []),
        ...(officer.employeeCode ? [{ label: "Employee Code", value: officer.employeeCode }] : []),
        ...(officer.posting ? [{ label: "Posting", value: officer.posting }] : []),
        { label: "Report Month", value: report.periodLabel },
      ]
    : [
        { label: "Officers", value: "All Officers" },
        { label: "Report Month", value: report.periodLabel },
      ];

  return (
    <div id="report-print-root" className="report-print hidden print:block" aria-hidden="true">
      <table className="rp-page">
        <thead>
          <tr>
            <td className="rp-space" />
          </tr>
        </thead>
        <tfoot>
          <tr>
            <td className="rp-space" />
          </tr>
        </tfoot>
        <tbody>
          <tr>
            <td className="rp-body">
              {isGujarati ? (
                <div className="rp-gujarati-layout text-black font-['Shruti',_'Gujarati_Saral',_var(--font-gujarati),_'Noto_Sans_Gujarati',_'Nirmala_UI',_sans-serif]">
                  {/* Gujarat Police Official Header */}
                  <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/Gujarat-police.png" alt="Gujarat Police" width={40} height={52} className="rp-logo object-contain" style={{ width: "40px", height: "52px", aspectRatio: "1542/2000" }} />
                    <div className="text-center flex-1 mx-4">
                      <h2 className="text-xl font-bold tracking-wide">{header1}</h2>
                      <p className="text-sm font-semibold text-gray-800">
                        {header2}
                      </p>
                    </div>
                    <div className="text-right text-xs">
                      <span className="block text-gray-600">રિપોર્ટ માસ:</span>
                      <strong className="text-sm font-bold">{report.periodLabel}</strong>
                    </div>
                  </div>

                  {/* Main Title */}
                  <h1 className="rp-title text-center text-lg font-bold underline mb-5 tracking-wide">
                    {report.title}
                  </h1>

                  {/* To Block */}
                  {toLines && (
                    <div className="mb-3 text-sm leading-relaxed whitespace-pre-line font-medium">
                      {toLines}
                    </div>
                  )}

                  {/* Applicant Line (Rank, Name, Buckle No) - Directly Above Subject */}
                  {(report.fromLines || fallbackHeaders.fromLines) && (
                    <div className="mb-3 text-sm text-gray-900 tracking-wide">
                      {parseApplicantLineSegments(report.fromLines || fallbackHeaders.fromLines).map((seg, i) =>
                        seg.isBold ? (
                          <strong key={i} className="font-bold text-black">
                            {seg.text}
                          </strong>
                        ) : (
                          <span key={i} className="font-normal">
                            {seg.text}
                          </span>
                        ),
                      )}
                    </div>
                  )}

                  {/* Subject */}
                  <div className="mb-3 text-sm font-bold">
                    <span>વિષય: </span>
                    <span>{report.subject || fallbackHeaders.subject}</span>
                  </div>

                  {/* Salutation & Intro */}
                  <div className="mb-4 text-sm leading-relaxed text-gray-900">
                    <p className="font-semibold">મહેરબાન સાહેબ,</p>
                    <p className="indent-6 mt-1">{report.salutation || fallbackHeaders.salutation}</p>
                  </div>

                  {/* Table */}
                  {(() => {
                    const hasOfficer = report.columns.some((c) => c.key === "officer");
                    const isHolidayReport = report.columns.some((c) => c.key === "dateDay" || c.key === "remarks" || c.key === "holiday");
                    const getPrintColStyle = (key: string, align?: string) => {
                      if (key === "officer") return { width: "12%", textAlign: "left" as const };
                      if (isHolidayReport) {
                        if (key === "dateDay" || key === "date")
                          return { width: hasOfficer ? "22%" : "25%", textAlign: "left" as const };
                        if (key === "time")
                          return { width: hasOfficer ? "16%" : "18%", textAlign: "left" as const };
                        if (key === "details" || key === "duty")
                          return { width: hasOfficer ? "24%" : "27%", textAlign: "left" as const };
                        if (key === "remarks" || key === "holiday")
                          return { width: hasOfficer ? "22%" : "25%", textAlign: "left" as const };
                        if (key === "station")
                          return { width: hasOfficer ? "12%" : "14%", textAlign: "left" as const };
                        if (key === "travel")
                          return { width: hasOfficer ? "14%" : "16%", textAlign: "left" as const };
                      }
                      if (key === "startDate" || key === "endDate")
                        return { width: hasOfficer ? "17.5%" : "19.5%", textAlign: "left" as const };
                      if (key === "route")
                        return { width: hasOfficer ? "19%" : "21%", textAlign: "left" as const };
                      if (key === "reason" || key === "duty" || key === "details")
                        return { width: hasOfficer ? "20%" : "23%", textAlign: "left" as const };
                      if (key === "vehicle")
                        return { width: hasOfficer ? "4.5%" : "5%", textAlign: "center" as const };
                      if (key === "distance")
                        return { width: hasOfficer ? "6.5%" : "7%", textAlign: "right" as const };
                      return {
                        width: "auto",
                        textAlign: (align === "right" ? "right" : align === "center" ? "center" : "left") as "right" | "center" | "left",
                      };
                    };

                    return report.rows.length === 0 ? (
                      <p className="rp-empty py-8 text-center text-sm font-semibold">
                        માહે {report.periodLabel} માટે કોઈ રેકોર્ડ મળેલ નથી.
                      </p>
                    ) : (
                      <table className="rp-table w-full border-collapse text-xs table-fixed">
                        <thead>
                          <tr>
                            <th className="rp-idx text-center whitespace-nowrap" style={{ width: hasOfficer ? "4%" : "5%" }}>
                              અ.નં.
                            </th>
                            {report.columns.map((c) => {
                              const col = getPrintColStyle(c.key, c.align);
                              const isRight = c.align === "right" || col.textAlign === "right";
                              const isCenter = c.align === "center" || col.textAlign === "center" || c.key === "vehicle";
                              return (
                                <th
                                  key={c.key}
                                  style={{ width: col.width, textAlign: col.textAlign }}
                                  className={
                                    isRight
                                      ? "rp-num text-right"
                                      : isCenter
                                        ? "rp-center text-center"
                                        : "text-left"
                                  }
                                >
                                  {c.label}
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {report.rows.map((row, i) => (
                            <tr key={i}>
                              <td
                                className="rp-idx text-center font-semibold align-top whitespace-nowrap"
                                style={{ width: hasOfficer ? "4%" : "5%", verticalAlign: "top" }}
                              >
                                {report.useGujaratiDigits
                                  ? String(i + 1).replace(/\d/g, (d) => "૦૧૨૩૪૫૬૭૮૯"[Number(d)])
                                  : i + 1}
                              </td>
                              {report.columns.map((c) => {
                                const col = getPrintColStyle(c.key, c.align);
                                const isRight = c.align === "right" || col.textAlign === "right";
                                const isCenter = c.align === "center" || col.textAlign === "center" || c.key === "vehicle";
                                return (
                                  <td
                                    key={c.key}
                                    style={{ width: col.width, textAlign: col.textAlign, verticalAlign: "top" }}
                                    className={`align-top ${
                                      isRight
                                        ? "rp-num text-right font-medium whitespace-pre"
                                        : isCenter
                                          ? "rp-center text-center whitespace-pre-line"
                                          : "whitespace-pre-line text-left"
                                    }`}
                                  >
                                    {row[c.key] ?? "—"}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}

                  {/* Footer & Signature */}
                  <div className="mt-8 pt-4 flex justify-between items-end text-xs break-inside-avoid">
                    <div className="space-y-1">
                      <p>તારીખ: {printDateStr}</p>
                      <p>સ્થળ: {footerPlace}</p>
                      {footerNote && <p className="text-[10px] text-gray-600">{footerNote}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold">લિ. સહી</p>
                      <div className="pt-0.5">
                        {config.signatoryName ? (
                          <p className="font-bold whitespace-pre-line">
                            {report.useGujaratiDigits ?? true
                              ? toGujaratiNumerals(config.signatoryName.trim())
                              : config.signatoryName.trim()}
                          </p>
                        ) : (
                          <>
                            <p className="font-bold">{transliterateToGujarati(officer?.name) || (officer?.name ?? "____________________")}</p>
                            <p className="text-gray-700">
                              {formatGujaratiPoliceRank(officer?.post) || (officer?.post ?? "પોલીસ અધિકારી")}
                              {officer?.employeeCode ? ` બ.નં. ${formatGujaratiBuckleNumber(officer.employeeCode, report.useGujaratiDigits ?? true)}` : ""}
                            </p>
                            {officer?.posting && <p className="text-gray-600">{officer.posting}</p>}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Standard English Layout */
                <div>
                  <header className="rp-letterhead">
                    {/* eslint-disable-next-line @next/next/no-img-element -- a plain img prints reliably; next/image lazy-loads and can miss the print snapshot */}
                    <img src="/Gujarat-police.png" alt="" className="rp-logo" />
                    <div className="rp-org">
                      <p className="rp-org-name">{header1En}</p>
                      <p className="rp-org-sub">{header2En}</p>
                    </div>
                    <div className="rp-period">
                      <span>Report Period</span>
                      <strong>{report.periodLabel}</strong>
                    </div>
                  </header>

                  <h1 className="rp-title">{report.title}</h1>

                  <dl className="rp-details">
                    {details.map((d) => (
                      <div key={d.label}>
                        <dt>{d.label}</dt>
                        <dd>{d.value}</dd>
                      </div>
                    ))}
                  </dl>

                  {report.rows.length === 0 ? (
                    <p className="rp-empty">No records for {report.periodLabel}.</p>
                  ) : (
                    <table className="rp-table">
                      <thead>
                        <tr>
                          <th className="rp-idx">#</th>
                          {report.columns.map((c) => {
                            const isRight = c.align === "right";
                            const isCenter = c.align === "center" || c.key === "vehicle";
                            return (
                              <th
                                key={c.key}
                                className={
                                  isRight
                                    ? "rp-num whitespace-nowrap min-w-[75px]"
                                    : isCenter
                                      ? "rp-center text-center"
                                      : undefined
                                }
                              >
                                {c.label}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {report.rows.map((row, i) => (
                          <tr key={i}>
                            <td className="rp-idx align-top">{i + 1}</td>
                            {report.columns.map((c) => {
                              const isRight = c.align === "right";
                              const isCenter = c.align === "center" || c.key === "vehicle";
                              return (
                                <td
                                  key={c.key}
                                  className={`align-top ${
                                    isRight
                                      ? "rp-num text-right font-medium whitespace-pre min-w-[75px]"
                                      : isCenter
                                        ? "rp-center text-center whitespace-pre-line"
                                        : "whitespace-pre-line text-left"
                                  }`}
                                >
                                  {row[c.key] ?? "—"}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* English Footer */}
                  <div className="mt-8 pt-4 flex justify-between items-end text-xs break-inside-avoid">
                    <div className="space-y-1">
                      <p>Date: {new Date().toLocaleDateString("en-IN")}</p>
                      <p>Place: {footerPlace}</p>
                      {footerNote && <p className="text-[10px] text-gray-600">{footerNote}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold">Signature</p>
                      <div className="pt-0.5">
                        {config.signatoryName ? (
                          <p className="font-bold whitespace-pre-line">{config.signatoryName.trim()}</p>
                        ) : (
                          <>
                            <p className="font-bold">{officer?.name ?? "____________________"}</p>
                            <p className="text-gray-700">
                              {officer?.post ?? "Police Officer"}
                              {officer?.employeeCode ? ` (${officer.employeeCode})` : ""}
                            </p>
                            {officer?.posting && <p className="text-gray-600">{officer.posting}</p>}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
