"use client";

import { useState, useMemo } from "react";
import {
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  Table2,
  AlignLeft,
  Check,
  Loader2,
  Tag,
  Clock,
} from "lucide-react";
import {
  type LeaveSegment,
  type DbLeaveTypeItem,
  mapDbLeaveTypesToOptions,
  calculateInclusiveDays,
  generateMergedLeaveSubject,
  formatSegmentsAsNarrativeParagraph,
} from "@/lib/reports/reportTemplates";
import { toGujaratiNumerals } from "@/lib/reports/gujaratiReportUtils";
import { FormSelect } from "@/components/ui/form-select";

interface LeaveSegmentBuilderProps {
  segments: LeaveSegment[];
  useGujaratiDigits: boolean;
  displayFormat?: "table" | "paragraph";
  reasonMode?: "same" | "different";
  commonReason?: string;
  dbLeaveTypes?: DbLeaveTypeItem[];
  onChange: (
    updatedSegments: LeaveSegment[],
    newSubject?: string,
    narrativeParagraph?: string,
    reasonMode?: "same" | "different",
    commonReason?: string,
  ) => void;
  onFormatChange?: (format: "table" | "paragraph") => void;
  onReasonModeChange?: (mode: "same" | "different", commonReason?: string) => void;
  onSyncSubject?: (newSubject: string) => void;
}

export function LeaveSegmentBuilder({
  segments,
  useGujaratiDigits,
  displayFormat = "table",
  reasonMode = "same",
  commonReason = "અંગત તથા કૌટુંબિક કામ સબબ",
  dbLeaveTypes,
  onChange,
  onFormatChange,
  onReasonModeChange,
  onSyncSubject,
}: LeaveSegmentBuilderProps) {
  const [autoUpdateSubject, setAutoUpdateSubject] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  // Sync leave type dropdown options dynamically from database with deduplication & colors
  const leaveOptions = useMemo(() => {
    return mapDbLeaveTypesToOptions(dbLeaveTypes);
  }, [dbLeaveTypes]);

  // Options formatted for FormSelect (with Search and ColorDot)
  const formSelectOptions = useMemo(() => {
    return leaveOptions.map((opt) => ({
      value: opt.code,
      label: opt.label,
      color: opt.color,
    }));
  }, [leaveOptions]);

  const numFn = (val: number | string) => {
    const num = Number(val);
    if (!isNaN(num)) {
      const rounded = Math.round(num * 10) / 10;
      return useGujaratiDigits ? toGujaratiNumerals(rounded) : String(rounded);
    }
    return useGujaratiDigits ? toGujaratiNumerals(val) : String(val);
  };

  const totalDays = segments.reduce((sum, s) => sum + (Number(s.days) || 0), 0);

  const handleToggleHalfDay = (index: number) => {
    const updated = segments.map((item, i) => {
      if (i !== index) return item;
      const nextHalf = !item.isHalfDay;
      const next: LeaveSegment = {
        ...item,
        isHalfDay: nextHalf,
        days: nextHalf ? 0.5 : calculateInclusiveDays(item.startDate, item.endDate || item.startDate),
        endDate: nextHalf ? item.startDate : (item.endDate || item.startDate),
        halfDaySession: nextHalf ? (item.halfDaySession || "PM") : undefined,
        halfDayTime: nextHalf ? (item.halfDayTime || "બપોરે ૧૨:૦૦ થી ૧૬:૦૦") : undefined,
      };
      return next;
    });

    const newSubject = autoUpdateSubject
      ? generateMergedLeaveSubject(updated, useGujaratiDigits)
      : undefined;

    const narrative = formatSegmentsAsNarrativeParagraph(
      updated,
      useGujaratiDigits,
      reasonMode,
      commonReason,
    );

    onChange(updated, newSubject, narrative, reasonMode, commonReason);
  };

  const handleUpdateSegment = (
    index: number,
    field: keyof LeaveSegment,
    value: string | number | boolean | undefined,
  ) => {
    const updated = segments.map((item, i) => {
      if (i !== index) return item;
      const next = { ...item, [field]: value };

      if (next.isHalfDay) {
        if (field === "startDate") {
          next.endDate = String(value);
        }
        next.days = 0.5;
      } else if (field === "startDate" || field === "endDate") {
        next.days = calculateInclusiveDays(next.startDate, next.endDate);
      }

      // Re-apply short label and full name if type changed
      if (field === "leaveTypeCode") {
        const found = leaveOptions.find(
          (p) =>
            p.code === value ||
            p.id === value ||
            p.rawCode?.toLowerCase() === String(value).toLowerCase(),
        );
        if (found) {
          next.leaveTypeCode = found.code;
          next.leaveTypeName = found.label;
          next.shortLabel = found.shortLabel;
          if (reasonMode === "different" && (!next.reason || next.reason === "અંગત કામ સબબ")) {
            next.reason = found.defaultReason;
          }
        }
      }

      return next;
    });

    const newSubject = autoUpdateSubject
      ? generateMergedLeaveSubject(updated, useGujaratiDigits)
      : undefined;

    const narrative = formatSegmentsAsNarrativeParagraph(
      updated,
      useGujaratiDigits,
      reasonMode,
      commonReason,
    );

    onChange(updated, newSubject, narrative, reasonMode, commonReason);
  };

  const handleAddSegment = () => {
    const lastSeg = segments[segments.length - 1];
    let nextStart = new Date();
    if (lastSeg?.endDate) {
      const d = new Date(`${lastSeg.endDate}T12:00:00`);
      d.setDate(d.getDate() + 1);
      nextStart = d;
    }
    const nextStartStr = nextStart.toISOString().split("T")[0];

    // Pick first available leave option (defaults to CL / કે.લીવ)
    const firstOption = leaveOptions[0] || {
      code: "cl",
      id: "cl",
      rawCode: "CL",
      fullName: "કે.લીવ - કેઝ્યુઅલ લીવ (CL)",
      label: "Casual Leave",
      shortLabel: "કે.લીવ",
      color: "#2563eb",
      defaultReason: "અંગત કામ સબબ",
    };

    const newSeg: LeaveSegment = {
      id: `seg_${Date.now()}`,
      startDate: nextStartStr,
      endDate: nextStartStr,
      leaveTypeCode: firstOption.code,
      leaveTypeName: firstOption.label,
      shortLabel: firstOption.shortLabel,
      days: 1,
      reason: reasonMode === "same" ? commonReason : firstOption.defaultReason,
    };

    const updated = [...segments, newSeg];
    const newSubject = autoUpdateSubject
      ? generateMergedLeaveSubject(updated, useGujaratiDigits)
      : undefined;

    const narrative = formatSegmentsAsNarrativeParagraph(
      updated,
      useGujaratiDigits,
      reasonMode,
      commonReason,
    );

    onChange(updated, newSubject, narrative, reasonMode, commonReason);
  };

  const handleRemoveSegment = (index: number) => {
    if (segments.length <= 1) return;
    const updated = segments.filter((_, i) => i !== index);
    const newSubject = autoUpdateSubject
      ? generateMergedLeaveSubject(updated, useGujaratiDigits)
      : undefined;

    const narrative = formatSegmentsAsNarrativeParagraph(
      updated,
      useGujaratiDigits,
      reasonMode,
      commonReason,
    );

    onChange(updated, newSubject, narrative, reasonMode, commonReason);
  };

  const handleSyncSubjectNow = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncSuccess(true);
      const newSubject = generateMergedLeaveSubject(segments, useGujaratiDigits);
      const narrative = formatSegmentsAsNarrativeParagraph(
        segments,
        useGujaratiDigits,
        reasonMode,
        commonReason,
      );
      onChange(segments, newSubject, narrative, reasonMode, commonReason);
      if (onSyncSubject) {
        onSyncSubject(newSubject);
      }
      setTimeout(() => {
        setSyncSuccess(false);
      }, 1800);
    }, 250);
  };

  const handleReasonModeToggle = (mode: "same" | "different") => {
    if (onReasonModeChange) {
      onReasonModeChange(mode, commonReason);
    }
    const updated = segments.map((s) => ({
      ...s,
      reason: mode === "same" ? commonReason : s.reason || "અંગત કામ સબબ",
    }));
    const newSubject = autoUpdateSubject
      ? generateMergedLeaveSubject(updated, useGujaratiDigits)
      : undefined;
    const narrative = formatSegmentsAsNarrativeParagraph(
      updated,
      useGujaratiDigits,
      mode,
      commonReason,
    );
    onChange(updated, newSubject, narrative, mode, commonReason);
  };

  const handleCommonReasonChange = (newVal: string) => {
    if (onReasonModeChange) {
      onReasonModeChange("same", newVal);
    }
    const updated = segments.map((s) => ({
      ...s,
      reason: newVal,
    }));
    const newSubject = autoUpdateSubject
      ? generateMergedLeaveSubject(updated, useGujaratiDigits)
      : undefined;
    const narrative = formatSegmentsAsNarrativeParagraph(
      updated,
      useGujaratiDigits,
      "same",
      newVal,
    );
    onChange(updated, newSubject, narrative, "same", newVal);
  };

  return (
    <div className="space-y-3.5 rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-50/70 via-indigo-50/30 to-purple-50/20 dark:from-indigo-950/30 dark:via-background dark:to-purple-950/20 p-3 sm:p-4 shadow-xs">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-indigo-200/70 dark:border-indigo-800/50 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/25">
            <Calendar className="size-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
              <span>રજા વિગત (Leave Details)</span>
              <span className="rounded-full bg-indigo-600/10 dark:bg-indigo-400/20 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                કુલ: {numFn(totalDays)} દિવસ
              </span>
            </h4>
            <p className="text-[11px] text-muted-foreground">
              તારીખવાર રજા ઉમેરો • કોષ્ટક અથવા ફકરો પસંદ કરો
            </p>
          </div>
        </div>

        {/* Display Format & Reason Mode Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Display Format Switcher: Table vs Paragraph */}
          {onFormatChange && (
            <div className="flex items-center rounded-xl bg-card p-1 border border-indigo-200/90 dark:border-indigo-800 shadow-2xs text-xs">
              <button
                type="button"
                onClick={() => onFormatChange("table")}
                className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  displayFormat === "table"
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="કોષ્ટક દર્શાવો (Table Format)"
              >
                <Table2 className="size-3.5 shrink-0" />
                <span>કોષ્ટક (Table)</span>
              </button>
              <button
                type="button"
                onClick={() => onFormatChange("paragraph")}
                className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  displayFormat === "paragraph"
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="ફકરો દર્શાવો (Paragraph Format)"
              >
                <AlignLeft className="size-3.5 shrink-0" />
                <span>ફકરો (Paragraph)</span>
              </button>
            </div>
          )}

          {/* Sync Subject Button with Live Feedback */}
          <button
            type="button"
            onClick={handleSyncSubjectNow}
            disabled={isSyncing}
            title="વિષય લાઇન ઓટો-અપડેટ કરો"
            className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer shadow-2xs whitespace-nowrap ${
              syncSuccess
                ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-400"
                : "border-indigo-300/80 dark:border-indigo-700/60 bg-card hover:bg-indigo-50/80 dark:hover:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
            }`}
          >
            {isSyncing ? (
              <>
                <Loader2 className="size-3.5 text-indigo-600 animate-spin shrink-0" />
                <span>અપડેટ થાય છે...</span>
              </>
            ) : syncSuccess ? (
              <>
                <Check className="size-3.5 text-emerald-600 shrink-0" />
                <span>વિષય અપડેટ થયો!</span>
              </>
            ) : (
              <>
                <Sparkles className="size-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>વિષય અપડેટ કરો</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* REASON MODE SELECTION & COMMON REASON BAR */}
      <div className="rounded-xl border border-indigo-200/90 dark:border-indigo-800/70 bg-card p-3 space-y-2.5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Tag className="size-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="text-xs font-bold text-foreground">
              રજાનું કારણ પદ્ધતિ (Reason Mode):
            </span>
          </div>

          {/* Reason Mode Pills */}
          <div className="inline-flex items-center rounded-lg bg-muted p-0.5 border border-border text-xs">
            <button
              type="button"
              onClick={() => handleReasonModeToggle("same")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                reasonMode === "same"
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="બધી રજા માટે એક જ સામાન્ય કારણ રાખો"
            >
              બધી રજા માટે એક જ કારણ (Same Reason)
            </button>
            <button
              type="button"
              onClick={() => handleReasonModeToggle("different")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                reasonMode === "different"
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="દરેક રજા ગાળા માટે અલગ અલગ કારણ દાખલ કરો"
            >
              અલગ અલગ કારણ (Different Reasons)
            </button>
          </div>
        </div>

        {/* If 'same' mode: Single prominent common reason input + quick preset chips */}
        {reasonMode === "same" && (
          <div className="space-y-2 pt-1 border-t border-border/60">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                તમામ રજાનું સામાન્ય કારણ / શેરો (Reason for all leaves)
              </label>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded">
                બધા ગાળામાં લાગુ પડશે
              </span>
            </div>

            <input
              type="text"
              value={commonReason}
              onChange={(e) => handleCommonReasonChange(e.target.value)}
              placeholder="અંગત તથા કૌટુંબિક કામ સબબ..."
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 shadow-2xs"
            />

            {/* Quick chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground font-semibold">ઝડપી પસંદગી:</span>
              {[
                "અંગત તથા કૌટુંબિક કામ સબબ",
                "તહેવાર સબબ",
                "લગ્ન પ્રસંગ સબબ",
                "માંદગી / બીમારી સબબ",
                "સામાજિક કામ સબબ",
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleCommonReasonChange(chip)}
                  className={`text-[10px] px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                    commonReason === chip
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                      : "bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border-border/80"
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Segments List with Responsive, Wide Desktop Columns */}
      <div className="space-y-3">
        {segments.map((seg, idx) => {
          // Resolve current leave type value for FormSelect
          const matchedOpt = leaveOptions.find(
            (p) =>
              p.code === seg.leaveTypeCode ||
              p.id === seg.leaveTypeCode ||
              p.rawCode?.toLowerCase() === seg.leaveTypeCode?.toLowerCase(),
          );
          const currentVal = matchedOpt ? matchedOpt.code : seg.leaveTypeCode;

          return (
            <div
              key={seg.id || idx}
              className="rounded-xl border border-border/80 bg-card p-3 sm:p-3.5 shadow-2xs transition-all hover:border-indigo-300 dark:hover:border-indigo-600/70 space-y-2.5"
            >
              {/* Segment top status bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <span className="flex size-5 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-extrabold">
                    {numFn(idx + 1)}
                  </span>
                  <span>રજા ગાળો {numFn(idx + 1)}</span>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50">
                    {seg.shortLabel}
                  </span>
                </span>

                <div className="flex items-center gap-1.5">
                  {/* Half Day Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleHalfDay(idx)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer shadow-2xs ${
                      seg.isHalfDay
                        ? "bg-amber-600 text-white border-amber-600 shadow-amber-600/20"
                        : "bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border-border/80"
                    }`}
                    title="અડધો દિવસ રજા ચાલુ / બંધ કરો"
                  >
                    <Clock className="size-3 shrink-0" />
                    <span>અડધો દિવસ</span>
                    <span
                      className={`text-[9px] font-bold px-1 rounded ${
                        seg.isHalfDay ? "bg-white/20 text-white" : "bg-card text-muted-foreground"
                      }`}
                    >
                      {seg.isHalfDay ? "ON" : "OFF"}
                    </span>
                  </button>

                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                    seg.isHalfDay
                      ? "text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/20"
                      : "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                  }`}>
                    {numFn(seg.days)} દિવસ
                  </span>

                  {segments.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSegment(idx)}
                      className="p-1 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                      title="આ રજા દૂર કરો"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Dedicated Half-Day Session & Time Panel when active */}
              {seg.isHalfDay && (
                <div className="rounded-xl border border-amber-400/50 dark:border-amber-700/60 bg-amber-50/50 dark:bg-amber-950/20 p-2.5 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-amber-950 dark:text-amber-200 font-bold text-[11px]">
                      <Clock className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>અડધો દિવસ સત્ર &amp; સમય:</span>
                    </div>

                    {/* Session Switcher AM vs PM */}
                    <div className="inline-flex rounded-lg bg-card p-0.5 border border-amber-300 dark:border-amber-800 text-[11px]">
                      <button
                        type="button"
                        onClick={() => handleUpdateSegment(idx, "halfDaySession", "AM")}
                        className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                          seg.halfDaySession !== "PM" && seg.halfDaySession !== "second_half"
                            ? "bg-amber-600 text-white shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        પ્રથમ સત્ર / સવાર (AM)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateSegment(idx, "halfDaySession", "PM")}
                        className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                          seg.halfDaySession === "PM" || seg.halfDaySession === "second_half"
                            ? "bg-amber-600 text-white shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        દ્વિતીય સત્ર / બપોર (PM)
                      </button>
                    </div>
                  </div>

                  {/* Half-Day Time input & Quick chips */}
                  <div className="space-y-1.5 pt-0.5">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                        સમય વિગત (Time):
                      </label>
                      <input
                        type="text"
                        value={seg.halfDayTime || ""}
                        onChange={(e) => handleUpdateSegment(idx, "halfDayTime", e.target.value)}
                        placeholder="દા.ત. બપોરે ૧૨:૦૦ થી ૧૬:૦૦ કલાક"
                        className="flex-1 rounded-lg border border-input bg-background px-2.5 py-1 text-xs font-semibold focus:border-amber-500 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-1 text-[10px]">
                      <span className="text-muted-foreground font-semibold">ઝડપી સમય પસંદગી:</span>
                      {[
                        "બપોરે ૧૨:૦૦ થી ૧૬:૦૦",
                        "સવારે ૦૮:૦૦ થી ૧૨:૦૦",
                        "બપોર ૧૨:૦૦ પછી",
                        "સાંજે ૧૭:૦૦ કલાકે",
                      ].map((timeChip) => (
                        <button
                          key={timeChip}
                          type="button"
                          onClick={() => handleUpdateSegment(idx, "halfDayTime", timeChip)}
                          className={`px-2 py-0.5 rounded border transition-all cursor-pointer ${
                            seg.halfDayTime === timeChip
                              ? "bg-amber-600 text-white border-amber-600"
                              : "bg-card hover:bg-muted text-muted-foreground hover:text-foreground border-border"
                          }`}
                        >
                          {timeChip}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Grid of Inputs */}
              {reasonMode === "same" ? (
                /* SAME REASON MODE */
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 text-xs">
                  {/* Leave Type Selector */}
                  <div className="sm:col-span-6 space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                      રજાનો પ્રકાર (Type)
                    </label>
                    <FormSelect
                      id={`seg-leave-type-${seg.id || idx}`}
                      options={formSelectOptions}
                      value={currentVal}
                      onChange={(val) => handleUpdateSegment(idx, "leaveTypeCode", val)}
                      placeholder="Select Leave Type…"
                      className="w-full"
                    />
                  </div>

                  {/* Start Date */}
                  <div className={seg.isHalfDay ? "sm:col-span-6 space-y-1" : "sm:col-span-3 space-y-1"}>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                      {seg.isHalfDay ? "રજા તારીખ (Date)" : "શરૂ તારીખ (From)"}
                    </label>
                    <input
                      type="date"
                      value={seg.startDate}
                      onChange={(e) => handleUpdateSegment(idx, "startDate", e.target.value)}
                      className="w-full rounded-xl border border-input bg-card px-2.5 py-2 text-xs font-medium focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 shadow-2xs"
                    />
                  </div>

                  {/* End Date (hidden or disabled if half day) */}
                  {!seg.isHalfDay && (
                    <div className="sm:col-span-3 space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                        અંત તારીખ (To)
                      </label>
                      <input
                        type="date"
                        value={seg.endDate}
                        onChange={(e) => handleUpdateSegment(idx, "endDate", e.target.value)}
                        className="w-full rounded-xl border border-input bg-card px-2.5 py-2 text-xs font-medium focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 shadow-2xs"
                      />
                    </div>
                  )}
                </div>
              ) : (
                /* DIFFERENT REASONS MODE */
                <div className="space-y-2.5 text-xs">
                  {/* Row 1: Type + Reason */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    <div className="sm:col-span-5 space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                        રજાનો પ્રકાર (Type)
                      </label>
                      <FormSelect
                        id={`seg-leave-type-${seg.id || idx}`}
                        options={formSelectOptions}
                        value={currentVal}
                        onChange={(val) => handleUpdateSegment(idx, "leaveTypeCode", val)}
                        placeholder="Select Leave Type…"
                        className="w-full"
                      />
                    </div>

                    <div className="sm:col-span-7 space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                        કારણ / શેરો (Reason)
                      </label>
                      <input
                        type="text"
                        value={seg.reason || ""}
                        placeholder="અંગત કામ, લાભ રજા સબબ..."
                        onChange={(e) => handleUpdateSegment(idx, "reason", e.target.value)}
                        className="w-full rounded-xl border border-input bg-card px-3 py-2 text-xs font-medium focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Row 2: Dates */}
                  <div className={`grid grid-cols-1 ${seg.isHalfDay ? "sm:grid-cols-1" : "sm:grid-cols-2"} gap-2.5`}>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                        {seg.isHalfDay ? "રજા તારીખ (Date)" : "શરૂ તારીખ (From Date)"}
                      </label>
                      <input
                        type="date"
                        value={seg.startDate}
                        onChange={(e) => handleUpdateSegment(idx, "startDate", e.target.value)}
                        className="w-full rounded-xl border border-input bg-card px-2.5 py-2 text-xs font-medium focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 shadow-2xs"
                      />
                    </div>

                    {!seg.isHalfDay && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                          અંત તારીખ (To Date)
                        </label>
                        <input
                          type="date"
                          value={seg.endDate}
                          onChange={(e) => handleUpdateSegment(idx, "endDate", e.target.value)}
                          className="w-full rounded-xl border border-input bg-card px-2.5 py-2 text-xs font-medium focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 shadow-2xs"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Segment Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={handleAddSegment}
          className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-indigo-400 dark:border-indigo-600 bg-card hover:bg-indigo-50 dark:hover:bg-indigo-950/40 px-3.5 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 transition-colors cursor-pointer shadow-2xs"
        >
          <Plus className="size-3.5" />
          <span>+ નવી રજા ઉમેરો (Add Leave Segment)</span>
        </button>

        <div
          onClick={() => setAutoUpdateSubject(!autoUpdateSubject)}
          className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-border/80 bg-card hover:bg-muted/50 cursor-pointer select-none transition-colors shadow-2xs"
        >
          <div
            role="switch"
            aria-checked={autoUpdateSubject}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out ${
              autoUpdateSubject ? "bg-indigo-600" : "bg-muted-foreground/30"
            }`}
          >
            <span
              className={`inline-block size-3.5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                autoUpdateSubject ? "translate-x-4.5" : "translate-x-1"
              }`}
            />
          </div>
          <span className="text-[11px] font-semibold text-foreground">
            રજા બદલાતાં વિષય આપમેળે અપડેટ કરો
          </span>
        </div>
      </div>
    </div>
  );
}
