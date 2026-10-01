"use client";

import { useState, useId, useEffect, useMemo } from "react";
import {
  Printer,
  X,
  Plus,
  Trash2,
  RotateCcw,
  Check,
  Sparkles,
  FileText,
  Clock,
  Car,
  Loader2,
} from "lucide-react";
import {
  buildPrintReport,
  consolidateLeaveRows,
  consolidateReportRows,
  printFileName,
  type PrintOfficer,
  type PrintReport,
} from "@/lib/reports/printReport";
import { useToast } from "@/components/ui/toast";
import {
  translateEnglishMonthsInText,
  formatGujaratiDate,
  getGujaratiReportHeaders,
  toGujaratiNumerals,
  toAsciiNumerals,
} from "@/lib/reports/gujaratiReportUtils";

import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import { useModalBackClose } from "@/lib/hooks/useModalBackClose";

/** Escapes text written into the print HTML. */
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function ReportEditModal({
  initialReport,
  officer,
  isOpen,
  onClose,
}: {
  initialReport: PrintReport;
  officer: PrintOfficer | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  useBodyScrollLock(isOpen);
  useModalBackClose(isOpen, onClose);

  const [useGujaratiDigits, setUseGujaratiDigits] = useState<boolean>(
    initialReport.useGujaratiDigits ?? true,
  );

  // Letter text for whichever report this is (TA, holiday, duty or leave).
  const defaultHeaders = (digits: boolean) =>
    getGujaratiReportHeaders({
      reportType: initialReport.type ?? "ta",
      periodLabel: initialReport.rawPeriodLabel ?? initialReport.periodLabel,
      officer,
      useGujaratiDigits: digits,
    });

  const getSubjectText = (digits = useGujaratiDigits) =>
    initialReport.subject
      ? translateEnglishMonthsInText(initialReport.subject, digits)
      : defaultHeaders(digits).subject;

  const getSalutationText = (digits = useGujaratiDigits) =>
    initialReport.salutation
      ? translateEnglishMonthsInText(initialReport.salutation, digits)
      : defaultHeaders(digits).salutation;

  const getSavedConfig = (): Record<string, any> => {
    try {
      if (typeof window !== "undefined") {
        const raw = localStorage.getItem("duty_print_config");
        if (raw) return JSON.parse(raw);
      }
    } catch {}
    return {};
  };

  const getInitialHeader1 = (saved = getSavedConfig()) => {
    return saved.headerLine1 || initialReport.headerLine1 || "ગુજરાત પોલીસ (GUJARAT POLICE)";
  };

  const getInitialHeader2 = (saved = getSavedConfig()) => {
    return (
      saved.headerLine2 ||
      saved.stationName ||
      initialReport.headerLine2 ||
      officer?.posting ||
      "QRT અરવલ્લી પોલીસ"
    );
  };

  const getInitialToLines = (saved = getSavedConfig()) => {
    if (saved.toLines) return saved.toLines;
    if (saved.recipientTitle || saved.stationName) {
      const rec = saved.recipientTitle || "પોલીસ સબ ઇન્સપેક્ટરશ્રી";
      const sta = saved.stationName || officer?.posting || "પોલીસ સ્ટેશન";
      return `પ્રતિ,\n${rec},\n${sta}`;
    }
    return (
      initialReport.toLines ||
      `પ્રતિ,\nપોલીસ સબ ઇન્સપેક્ટરશ્રી,\n${officer?.posting || "પોલીસ સ્ટેશન"}`
    );
  };

  const getInitialPlace = (saved = getSavedConfig()) => {
    if (saved.footerPlace) return saved.footerPlace;
    if (initialReport.footerPlace) return initialReport.footerPlace;
    if (officer?.posting) return officer.posting.split(",")[0].trim();
    return "અરવલ્લી";
  };

  const getInitialSignatory = (saved = getSavedConfig()) => {
    if (saved.signatoryName) return saved.signatoryName.trim();
    return `${officer?.name ?? "પોલીસ અધિકારી"}\n${officer?.post ?? ""}${officer?.employeeCode ? ` બ.નં. ${officer.employeeCode}` : ""}\n${officer?.posting ?? ""}`.trim();
  };

  const [toLines, setToLines] = useState<string>(getInitialToLines);
  const [subject, setSubject] = useState<string>(getSubjectText());
  const [salutation, setSalutation] = useState<string>(getSalutationText());
  const [rows, setRows] = useState<Record<string, string>[]>(() =>
    initialReport.rows.map((r) => ({ ...r })),
  );
  const [columns, setColumns] = useState(initialReport.columns);
  const [place, setPlace] = useState<string>(getInitialPlace);
  const [reportDate, setReportDate] = useState<string>(() =>
    formatGujaratiDate(new Date(), {
      useGujaratiDigits: initialReport.useGujaratiDigits ?? true,
    }),
  );
  const [signatory, setSignatory] = useState<string>(getInitialSignatory);
  const [consolidatedMode, setConsolidatedMode] = useState<boolean>(false);
  const [isSwitchingMode, setIsSwitchingMode] = useState<boolean>(false);

  const [header1, setHeader1] = useState<string>(getInitialHeader1);
  const [header2, setHeader2] = useState<string>(getInitialHeader2);
  /**
   * Columns the officer removed for this printout. Kept by key, so the choice
   * survives the detailed/merged switch (which rebuilds the column list).
   */
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<string[]>([]);
  const visibleColumns = columns.filter((c) => !hiddenColumnKeys.includes(c.key));

  const hideColumn = (key: string) => {
    if (visibleColumns.length <= 1) {
      toast("ઓછામાં ઓછી એક કોલમ રાખવી જરૂરી છે. (Keep at least one column)", "error");
      return;
    }
    setHiddenColumnKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  };
  const showColumn = (key: string) =>
    setHiddenColumnKeys((prev) => prev.filter((k) => k !== key));

  /** A column the officer adds by hand (e.g. "સહી", "રિમાર્ક્સ"); cells start empty. */
  const [newColumnLabel, setNewColumnLabel] = useState("");
  const [addingColumn, setAddingColumn] = useState(false);
  /** Returns false when there was no name to add. */
  const addColumn = (): boolean => {
    const label = newColumnLabel.trim();
    if (!label) {
      toast("કોલમનું નામ લખો. (Enter a column name)", "error");
      return false;
    }
    const key = `custom_${Date.now()}`;
    setColumns((prev) => [...prev, { key, label }]);
    setRows((prev) => prev.map((r) => ({ ...r, [key]: "" })));
    setNewColumnLabel("");
    toast(`"${label}" કોલમ ઉમેરી. (Column added)`);
    return true;
  };
  const deleteCustomColumn = (key: string) => {
    setColumns((prev) => prev.filter((c) => c.key !== key));
    setHiddenColumnKeys((prev) => prev.filter((k) => k !== key));
  };

  const canMerge = useMemo(() => {
    if (!initialReport.rawRows || initialReport.rawRows.length <= 1) return false;
    const consolidated =
      initialReport.type === "leave"
        ? consolidateLeaveRows(initialReport.rawRows)
        : consolidateReportRows(initialReport.rawRows, initialReport.language ?? "gu");
    return consolidated.length < initialReport.rawRows.length;
  }, [initialReport.rawRows, initialReport.language, initialReport.type]);

  const pdfFileName = printFileName(initialReport, officer);

  // Sync state if initialReport or modal open state changes
  useEffect(() => {
    if (!isOpen) return;
    const saved = getSavedConfig();
    setHeader1(getInitialHeader1(saved));
    setHeader2(getInitialHeader2(saved));
    setToLines(getInitialToLines(saved));
    setPlace(getInitialPlace(saved));
    setSignatory(getInitialSignatory(saved));
    setRows(initialReport.rows.map((r) => ({ ...r })));
    // Columns the officer added survive a digits switch.
    setColumns((prev) => [
      ...initialReport.columns,
      ...prev.filter((c) => c.key.startsWith("custom_")),
    ]);
    setSubject(getSubjectText(useGujaratiDigits));
    setSalutation(getSalutationText(useGujaratiDigits));
  }, [isOpen, initialReport, officer, useGujaratiDigits]);

  if (!isOpen) return null;

  const toggleGujaratiDigits = () => {
    const nextVal = !useGujaratiDigits;
    setUseGujaratiDigits(nextVal);
    setReportDate((prev) =>
      nextVal ? toGujaratiNumerals(prev) : toAsciiNumerals(prev),
    );
  };

  const handleReset = () => {
    const saved = getSavedConfig();
    setHeader1(getInitialHeader1(saved));
    setHeader2(getInitialHeader2(saved));
    setToLines(getInitialToLines(saved));
    setPlace(getInitialPlace(saved));
    setSignatory(getInitialSignatory(saved));
    setRows(initialReport.rows.map((r) => ({ ...r })));
    setColumns(initialReport.columns);
    setSubject(getSubjectText(initialReport.useGujaratiDigits ?? true));
    setSalutation(getSalutationText(initialReport.useGujaratiDigits ?? true));
    setUseGujaratiDigits(initialReport.useGujaratiDigits ?? true);
    setReportDate(
      formatGujaratiDate(new Date(), {
        useGujaratiDigits: initialReport.useGujaratiDigits ?? true,
      }),
    );
    setConsolidatedMode(false);
    setIsSwitchingMode(false);
    setHiddenColumnKeys([]);
    toast("ઓરિજિનલ ડેટા રીસેટ કર્યો. (Reset to template)");
  };

  const handleToggleConsolidated = (consolidated: boolean) => {
    if (consolidated && !canMerge) return;
    if (consolidated === consolidatedMode || isSwitchingMode) return;

    setIsSwitchingMode(true);
    setConsolidatedMode(consolidated);

    setTimeout(() => {
      if (initialReport.rawRows && initialReport.rawRows.length > 0) {
        const rep = buildPrintReport({
          type: initialReport.type ?? "ta",
          rows: initialReport.rawRows,
          periodLabel: initialReport.rawPeriodLabel ?? initialReport.periodLabel,
          includeOfficer: !officer,
          language: initialReport.language,
          officer,
          useGujaratiDigits,
          consolidateSameDuties: consolidated,
        });

        // Keep any columns the officer added; their cells start empty again
        // because the rows themselves were rebuilt.
        setColumns((prev) => [...rep.columns, ...prev.filter((c) => c.key.startsWith("custom_"))]);
        setRows(rep.rows.map((r) => ({ ...r })));
      }
      setIsSwitchingMode(false);
      toast(
        consolidated
          ? "સમાન સ્થળ/ફરજ એક જ રો માં સંક્ષિપ્ત કરી (Consolidated into 1 row)"
          : "તમામ દિવસો વિગતવાર દર્શાવ્યા (Detailed all days)",
      );
    }, 200);
  };

  const handleCellChange = (rowIndex: number, colKey: string, val: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [colKey]: val };
      return next;
    });
  };

  const handleDeleteRow = (rowIndex: number) => {
    setRows((prev) => prev.filter((_, i) => i !== rowIndex));
  };

  const handleAddRow = () => {
    const emptyRow: Record<string, string> = {};
    columns.forEach((c) => {
      if (c.key === "vehicle") emptyRow[c.key] = "ખ.વા.";
      else emptyRow[c.key] = "";
    });
    setRows((prev) => [...prev, emptyRow]);
  };

  const handlePrint = () => {
    // 1. Write the edited content into the print container DOM
    const printRoot = document.getElementById("report-print-root");
    if (printRoot) {
      const numFn = (i: number) =>
        useGujaratiDigits
          ? String(i).replace(/\d/g, (d) => "૦૧૨૩૪૫૬૭૮૯"[Number(d)])
          : String(i);

      printRoot.innerHTML = `
        <table class="rp-page">
          <thead><tr><td class="rp-space"></td></tr></thead>
          <tfoot><tr><td class="rp-space"></td></tr></tfoot>
          <tbody>
            <tr>
              <td class="rp-body">
                <div class="rp-gujarati-layout font-sans text-black">
                  <div class="flex items-center justify-between border-b-2 border-black pb-3 mb-4">
                    <img src="/Gujarat-police.png" alt="Gujarat Police" class="rp-logo h-16 w-16 object-contain" />
                    <div class="text-center flex-1 mx-4">
                      <h2 class="text-xl font-bold tracking-wide">${esc(header1)}</h2>
                      <p class="text-sm font-semibold text-gray-800">${esc(header2)}</p>
                    </div>
                    <div class="text-right text-xs">
                      <span class="block text-gray-600">રિપોર્ટ માસ:</span>
                      <strong class="text-sm font-bold">${esc(initialReport.periodLabel)}</strong>
                    </div>
                  </div>

                  <h1 class="rp-title text-center text-lg font-bold underline mb-5 tracking-wide">
                    ${esc(initialReport.title)}
                  </h1>

                  <div class="mb-3 text-sm leading-relaxed whitespace-pre-line font-medium">
                    ${esc(toLines)}
                  </div>

                  <div class="mb-3 text-sm font-bold">
                    <span>વિષય: </span>
                    <span>${esc(subject)}</span>
                  </div>

                  <div class="mb-4 text-xs leading-relaxed text-gray-900">
                    <p class="font-semibold">મહેરબાન સાહેબ,</p>
                    <p class="indent-6 mt-1">${esc(salutation)}</p>
                  </div>

                  <table class="rp-table w-full border-collapse text-xs">
                    <thead>
                      <tr>
                        <th class="rp-idx text-center w-8">અ.નં.</th>
                        ${visibleColumns.map((c) => `<th class="${c.align === "right" ? "rp-num text-right" : "text-left"}">${esc(c.label)}</th>`).join("")}
                      </tr>
                    </thead>
                    <tbody>
                      ${rows
          .map(
            (row, idx) => `
                        <tr>
                          <td class="rp-idx text-center font-semibold">${numFn(idx + 1)}</td>
                          ${visibleColumns
                .map(
                  (c) =>
                    `<td class="${c.align === "right" ? "rp-num text-right font-medium" : "text-left"}">${esc(row[c.key] || "—")}</td>`,
                )
                .join("")}
                        </tr>
                      `,
          )
          .join("")}
                    </tbody>
                  </table>

                  <div class="mt-8 pt-4 flex justify-between items-end text-xs break-inside-avoid">
                    <div class="space-y-1">
                      <p>તારીખ: ${esc(reportDate)}</p>
                      <p>સ્થળ: ${esc(place)}</p>
                    </div>
                    <div class="text-right">
                      <p class="font-bold">લિ. સહી</p>
                      <div class="pt-0.5 whitespace-pre-line font-semibold">
                        ${esc(signatory.trim())}
                      </div>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      `;
    }

    // 2. Set document.title so browser's "Save as PDF" dialog suggests the exact report filename
    const originalTitle = document.title;
    const baseName = pdfFileName.replace(/\.pdf$/i, "");
    document.title = baseName;

    const restoreTitle = () => {
      document.title = originalTitle;
      window.removeEventListener("afterprint", restoreTitle);
    };
    window.addEventListener("afterprint", restoreTitle);

    // 3. Trigger native browser print
    try {
      window.print();
    } catch {
      toast("પ્રિન્ટ ઉપલબ્ધ નથી (Print failed)", "error");
    } finally {
      setTimeout(() => {
        document.title = originalTitle;
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs print:hidden">
      <div className="flex h-[95vh] w-full max-w-5xl flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top App Bar */}
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5 bg-muted/40 sm:px-6 sm:py-3 shrink-0 gap-1.5 sm:gap-4 overflow-hidden">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400">
              <Printer className="size-4 sm:size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-base font-bold text-foreground flex items-center gap-1.5 truncate">
                <span className="truncate">
                  <span className="sm:hidden">પ્રિન્ટ / એડિટ</span>
                  <span className="hidden sm:inline">પ્રિન્ટ રિવ્યુ અને એડિટ (Print &amp; Edit Report)</span>
                </span>
                <span className="text-[10px] bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full font-semibold shrink-0">
                  {initialReport.periodLabel}
                </span>
                <span
                  className="text-[10px] bg-muted text-muted-foreground border border-border px-1.5 py-0.5 rounded font-mono shrink-0 hidden md:inline"
                  title="ડાઉનલોડ / સેવ કરવા માટેનું PDF નામ"
                >
                  PDF: {pdfFileName}
                </span>
              </h2>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                પ્રિન્ટ કરતા પહેલા કોઈ પણ લખાણ, તારીખ, વાહન કે રીમાર્ક્સ સીધા એડિટ કરી શકો છો.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleGujaratiDigits}
              className="px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl border border-border text-xs font-semibold hover:bg-muted text-foreground transition-colors cursor-pointer shrink-0"
              title="અંકોનું સ્વરૂપ બદલો"
            >
              <span className="sm:hidden">{useGujaratiDigits ? "૧૨૩" : "123"}</span>
              <span className="hidden sm:inline">{useGujaratiDigits ? "૧ ૨ ૩ (ગુજરાતી)" : "1 2 3 (English)"}</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer flex items-center gap-1 shrink-0"
              title="રીસેટ કરો"
            >
              <RotateCcw className="size-3.5" />
              <span className="hidden sm:inline">રીસેટ</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1 sm:gap-1.5 rounded-xl bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 transition-all cursor-pointer sm:text-sm sm:px-4 sm:py-2 shrink-0"
              title="પ્રિન્ટ કરો"
            >
              <Printer className="size-3.5 sm:size-4" />
              <span className="sm:hidden">પ્રિન્ટ</span>
              <span className="hidden sm:inline">પ્રિન્ટ કરો (Print)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 sm:p-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer shrink-0"
              title="બંધ કરો (Close)"
            >
              <X className="size-4 sm:size-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Letterhead Canvas */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5 bg-background">
          <div className="max-w-4xl mx-auto rounded-xl border border-border bg-card p-5 sm:p-8 shadow-sm space-y-5">
            {/* Header Title Preview */}
            <div className="text-center pb-4 border-b border-border/80 space-y-1">
              <div className="flex items-center justify-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/Gujarat-police.png" alt="Gujarat Police" className="h-14 w-14 object-contain shrink-0" />
                <div className="text-left flex-1 max-w-md">
                  <input
                    type="text"
                    value={header1}
                    onChange={(e) => setHeader1(e.target.value)}
                    placeholder="ગુજરાત પોલીસ (GUJARAT POLICE)"
                    className="w-full text-base sm:text-lg font-bold text-foreground bg-transparent border-b border-border/50 hover:border-indigo-500 focus:border-indigo-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={header2}
                    onChange={(e) => setHeader2(e.target.value)}
                    placeholder="QRT અરવલ્લી પોલીસ"
                    className="w-full text-xs sm:text-sm font-semibold text-muted-foreground bg-transparent border-b border-border/30 hover:border-indigo-500 focus:border-indigo-500 focus:outline-none mt-1"
                  />
                </div>
              </div>
              <h4 className="text-sm font-bold text-indigo-600 dark:text-indigo-400 underline pt-2">
                {initialReport.title}
              </h4>
            </div>

            {/* Editable Addressee (પ્રતિ) & Subject */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  પ્રતિ (To Address - Editable):
                </label>
                <textarea
                  rows={3}
                  value={toLines}
                  onChange={(e) => setToLines(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs font-medium text-foreground focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    વિષય (Subject - Editable):
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    સ્થળ (Place):
                  </label>
                  <input
                    type="text"
                    value={place}
                    onChange={(e) => setPlace(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
            </div>

            {/* Salutation Intro */}
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">
                અરજી વિગત (Body Text):
              </label>
              <textarea
                rows={2}
                value={salutation}
                onChange={(e) => setSalutation(e.target.value)}
                className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {/* Editable Table Rows */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-foreground">
                    પત્રક વિગતો ({rows.length} {rows.length === 1 ? "Row" : "Rows"}):
                  </span>
                  {/* Two print options toggle */}
                  <div
                    className={`inline-flex rounded-xl border border-border bg-muted/60 p-0.5 text-xs shadow-2xs ${
                      !canMerge ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                    title={
                      !canMerge
                        ? "ભેગી કરવા યોગ્ય કોઈ સમાન ફરજ નથી (No mergeable identical duties)"
                        : "પ્રિન્ટ પદ્ધતિ પસંદ કરો"
                    }
                  >
                    <button
                      type="button"
                      disabled={isSwitchingMode}
                      onClick={() => handleToggleConsolidated(false)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        !consolidatedMode
                          ? "bg-card text-foreground shadow-2xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title="દરેક દિવસની અલગ રો (All Days Detailed)"
                    >
                      {isSwitchingMode && !consolidatedMode && (
                        <Loader2 className="size-3 animate-spin text-indigo-600" />
                      )}
                      <span>વિગતવાર (તમામ દિવસો)</span>
                    </button>
                    <button
                      type="button"
                      disabled={!canMerge || isSwitchingMode}
                      onClick={() => handleToggleConsolidated(true)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        !canMerge
                          ? "opacity-50 cursor-not-allowed text-muted-foreground"
                          : consolidatedMode
                            ? "bg-indigo-600 text-white shadow-2xs cursor-pointer"
                            : "text-muted-foreground hover:text-foreground cursor-pointer"
                      }`}
                      title={
                        !canMerge
                          ? "ભેગી કરવા યોગ્ય કોઈ સમાન ફરજ નથી (No mergeable identical duties)"
                          : "સમાન ફરજ, વાહન અને સ્થળ એક જ રો માં સંક્ષિપ્ત કરો (Combine same duties into 1 row)"
                      }
                    >
                      {isSwitchingMode && consolidatedMode && (
                        <Loader2 className="size-3 animate-spin text-white" />
                      )}
                      <span>સંક્ષિપ્ત (એક જ રો માં)</span>
                      {!canMerge && (
                        <span className="text-[10px] text-muted-foreground/70 font-normal hidden sm:inline">
                          (અશક્ય)
                        </span>
                      )}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer ml-auto sm:ml-0"
                >
                  <Plus className="size-3.5" />
                  <span>નવી લાઇન ઉમેરો (Add Row)</span>
                </button>
              </div>

              {/* The one place columns are managed: each chip has a small ×
                  to remove it, removed ones wait as dashed "+ name" chips,
                  and the last chip adds a column of your own. Wraps on a
                  phone, so nothing needs sideways scrolling. */}
              <div className="rounded-xl border border-border bg-muted/30 p-2.5">
                <p className="mb-2 text-xs font-bold text-foreground">
                  કોલમ (Columns)
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {columns.map((c) => {
                    const shown = !hiddenColumnKeys.includes(c.key);
                    const custom = c.key.startsWith("custom_");
                    return shown ? (
                      <span
                        key={c.key}
                        className="inline-flex max-w-full items-center gap-1 rounded-lg border border-indigo-500/40 bg-indigo-600/10 py-1 pl-2 pr-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300"
                      >
                        <span className="truncate">{c.label}</span>
                        <button
                          type="button"
                          onClick={() => (custom ? deleteCustomColumn(c.key) : hideColumn(c.key))}
                          className="shrink-0 cursor-pointer rounded p-0.5 hover:bg-rose-500/15 hover:text-rose-600"
                          title="કોલમ હટાવો (Remove column)"
                          aria-label={`Remove column ${c.label}`}
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ) : (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => showColumn(c.key)}
                        className="inline-flex max-w-full cursor-pointer items-center gap-1 rounded-lg border border-dashed border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="ફરી ઉમેરો (Add back)"
                      >
                        <Plus className="size-3 shrink-0" />
                        <span className="truncate">{c.label}</span>
                      </button>
                    );
                  })}

                  {/* Add your own column: a "+" chip that opens a small field */}
                  {addingColumn ? (
                    <form
                      className="inline-flex w-full items-center gap-1 sm:w-auto"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (addColumn()) setAddingColumn(false);
                      }}
                    >
                      <input
                        type="text"
                        autoFocus
                        value={newColumnLabel}
                        onChange={(e) => setNewColumnLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setAddingColumn(false);
                            setNewColumnLabel("");
                          }
                        }}
                        placeholder="કોલમનું નામ"
                        className="min-w-0 flex-1 rounded-lg border border-indigo-500 bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:w-36 sm:flex-none"
                      />
                      <button
                        type="submit"
                        className="shrink-0 cursor-pointer rounded-lg bg-indigo-600 p-1.5 text-white hover:bg-indigo-500"
                        title="ઉમેરો (Add)"
                        aria-label="Add column"
                      >
                        <Check className="size-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddingColumn(false);
                          setNewColumnLabel("");
                        }}
                        className="shrink-0 cursor-pointer rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted"
                        title="રદ કરો (Cancel)"
                        aria-label="Cancel"
                      >
                        <X className="size-3" />
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingColumn(true)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-indigo-500/40 bg-card px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-600/10 dark:text-indigo-400"
                      title="નવી કોલમ ઉમેરો (Add column)"
                    >
                      <Plus className="size-3" />
                      <span>કોલમ</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="relative overflow-x-auto rounded-xl border border-border bg-background min-h-[140px]">
                {/* Loader Overlay when switching mode */}
                {isSwitchingMode && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/80 backdrop-blur-xs animate-in fade-in-0 duration-150">
                    <Loader2 className="size-6 animate-spin text-indigo-600 mb-2" />
                    <span className="text-xs font-bold text-foreground">
                      પત્રક અપડેટ થઈ રહ્યું છે... (Updating table)
                    </span>
                  </div>
                )}
                <table className="w-full text-xs text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 font-bold text-muted-foreground">
                      <th className="p-2.5 text-center w-10">અ.નં.</th>
                      {visibleColumns.map((c) => (
                        <th key={c.key} className="p-2.5">
                          {c.label}
                        </th>
                      ))}
                      <th className="p-2.5 text-center w-10">ક્રિયા</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-muted/20">
                        <td className="p-2 text-center font-bold text-muted-foreground">
                          {useGujaratiDigits
                            ? String(idx + 1).replace(/\d/g, (d) => "૦૧૨૩૪૫૬૭૮૯"[Number(d)])
                            : idx + 1}
                        </td>
                        {visibleColumns.map((c) => {
                          const val = row[c.key] ?? "";
                          if (c.key === "vehicle") {
                            const isGovt = val === "સ.વા." || val?.includes("સરકારી");
                            return (
                              <td key={c.key} className="p-1.5 text-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCellChange(idx, c.key, isGovt ? "ખ.વા." : "સ.વા.")
                                  }
                                  className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border shadow-2xs cursor-pointer select-none whitespace-nowrap ${isGovt
                                      ? "bg-indigo-600/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-600/20"
                                      : "bg-amber-600/10 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-600/20"
                                    }`}
                                  title="વાહન પ્રકાર બદલવા ક્લિક કરો (Click to toggle vehicle)"
                                >
                                  <Car className="size-3 shrink-0" />
                                  <span>{isGovt ? "સ.વા. (સરકારી)" : "ખ.વા. (ખાનગી)"}</span>
                                </button>
                              </td>
                            );
                          }
                          return (
                            <td key={c.key} className="p-1.5">
                              <input
                                type="text"
                                value={val}
                                onChange={(e) =>
                                  handleCellChange(idx, c.key, e.target.value)
                                }
                                className={`w-full rounded-lg border border-border/70 bg-background px-2 py-1 text-xs text-foreground focus:border-indigo-500 focus:outline-none ${c.align === "right" ? "text-right font-medium" : ""
                                  }`}
                              />
                            </td>
                          );
                        })}
                        <td className="p-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(idx)}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer"
                            title="આ લાઇન હટાવો"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Editable Place, Date & Signatory Footer */}
            <div className="pt-4 border-t border-border/80 flex flex-col sm:flex-row justify-between gap-4">
              <div className="space-y-3 sm:w-80">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    સ્થળ (Place):
                  </label>
                  <input
                    type="text"
                    value={place}
                    onChange={(e) => setPlace(e.target.value)}
                    placeholder="દા.ત. અરવલ્લી અથવા સુરત"
                    className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground focus:border-indigo-500 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-foreground">
                      તારીખ (Date):
                    </label>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                      ડિફોલ્ટ આજની તારીખ
                    </span>
                  </div>
                  <input
                    type="text"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    placeholder="દા.ત. ૧૪/૦૯/૨૦૨૬ અથવા 14/09/2026"
                    className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground focus:border-indigo-500 focus:outline-none transition-colors"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    ગુજરાતી અથવા અંગ્રેજી બંને ફોર્મેટમાં તારીખ એડિટ કરી શકાય છે.
                  </p>
                </div>
              </div>

              <div className="sm:text-right flex-1 sm:max-w-xs">
                <label className="block text-xs font-bold text-foreground mb-1">
                  લિ. સહી કરનાર વિગત (Signature):
                </label>
                <textarea
                  rows={4}
                  value={signatory}
                  onChange={(e) => setSignatory(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background p-2 text-xs font-medium text-foreground focus:border-indigo-500 focus:outline-none text-left sm:text-right leading-relaxed"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-border px-4 py-3 bg-muted/30 sm:px-6 gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>A4 સાઇઝમાં સત્તાવાર લેટરહેડ સાથે પ્રિન્ટ થશે.</span>
            <span className="hidden sm:inline">•</span>
            <span className="font-mono text-[11px] text-foreground/80 font-medium">
              PDF: {pdfFileName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              બંધ કરો (Close)
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 transition-all cursor-pointer sm:text-sm"
            >
              <Printer className="size-4" />
              <span>પ્રિન્ટ કરો (Print Letterhead)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
