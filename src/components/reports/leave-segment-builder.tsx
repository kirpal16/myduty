"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2, Calendar, Sparkles, Table2, AlignLeft } from "lucide-react";
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
  dbLeaveTypes?: DbLeaveTypeItem[];
  onChange: (
    updatedSegments: LeaveSegment[],
    newSubject?: string,
    narrativeParagraph?: string,
  ) => void;
  onFormatChange?: (format: "table" | "paragraph") => void;
}

export function LeaveSegmentBuilder({
  segments,
  useGujaratiDigits,
  displayFormat = "table",
  dbLeaveTypes,
  onChange,
  onFormatChange,
}: LeaveSegmentBuilderProps) {
  const [autoUpdateSubject, setAutoUpdateSubject] = useState(true);

  // Sync leave type dropdown options dynamically from database with deduplication & colors
  const leaveOptions = useMemo(() => {
    return mapDbLeaveTypesToOptions(dbLeaveTypes);
  }, [dbLeaveTypes]);

  // Options formatted for FormSelect (with Search and ColorDot matching Image 3)
  const formSelectOptions = useMemo(() => {
    return leaveOptions.map((opt) => ({
      value: opt.code,
      label: opt.label,
      color: opt.color,
    }));
  }, [leaveOptions]);

  const numFn = (val: number | string) =>
    useGujaratiDigits ? toGujaratiNumerals(val) : String(val);

  const totalDays = segments.reduce((sum, s) => sum + (Number(s.days) || 0), 0);

  const handleUpdateSegment = (
    index: number,
    field: keyof LeaveSegment,
    value: string | number,
  ) => {
    const updated = segments.map((item, i) => {
      if (i !== index) return item;
      const next = { ...item, [field]: value };

      // Re-calculate days if start or end date changed
      if (field === "startDate" || field === "endDate") {
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
          if (!next.reason || next.reason === "અંગત કામ સબબ") {
            next.reason = found.defaultReason;
          }
        }
      }

      return next;
    });

    const newSubject = autoUpdateSubject
      ? generateMergedLeaveSubject(updated, useGujaratiDigits)
      : undefined;

    const narrative = formatSegmentsAsNarrativeParagraph(updated, useGujaratiDigits);

    onChange(updated, newSubject, narrative);
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
      reason: firstOption.defaultReason,
    };

    const updated = [...segments, newSeg];
    const newSubject = autoUpdateSubject
      ? generateMergedLeaveSubject(updated, useGujaratiDigits)
      : undefined;

    const narrative = formatSegmentsAsNarrativeParagraph(updated, useGujaratiDigits);

    onChange(updated, newSubject, narrative);
  };

  const handleRemoveSegment = (index: number) => {
    if (segments.length <= 1) return;
    const updated = segments.filter((_, i) => i !== index);
    const newSubject = autoUpdateSubject
      ? generateMergedLeaveSubject(updated, useGujaratiDigits)
      : undefined;

    const narrative = formatSegmentsAsNarrativeParagraph(updated, useGujaratiDigits);

    onChange(updated, newSubject, narrative);
  };

  const handleSyncSubjectNow = () => {
    const newSubject = generateMergedLeaveSubject(segments, useGujaratiDigits);
    const narrative = formatSegmentsAsNarrativeParagraph(segments, useGujaratiDigits);
    onChange(segments, newSubject, narrative);
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

        {/* Display Format Switcher: Table vs Paragraph only */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
          {onFormatChange && (
            <div className="grid grid-cols-2 sm:flex sm:items-center rounded-xl bg-card p-1 border border-indigo-200/90 dark:border-indigo-800 shadow-2xs text-xs w-full sm:w-auto">
              <button
                type="button"
                onClick={() => onFormatChange("table")}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
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
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
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

          <button
            type="button"
            onClick={handleSyncSubjectNow}
            title="વિષય લાઇન ઓટો-અપડેટ કરો"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-indigo-300/80 dark:border-indigo-700/60 bg-card hover:bg-indigo-50/80 dark:hover:bg-indigo-900/30 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 transition-colors cursor-pointer shadow-2xs whitespace-nowrap w-full sm:w-auto"
          >
            <Sparkles className="size-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>વિષય અપડેટ કરો</span>
          </button>
        </div>
      </div>

      {/* Segments List */}
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
              className="rounded-xl border border-border/80 bg-card p-3 sm:p-3.5 shadow-2xs transition-all hover:border-indigo-300 dark:hover:border-indigo-600/70"
            >
              {/* Segment top status bar */}
              <div className="flex items-center justify-between gap-2 mb-2.5">
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
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
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

              {/* Grid of Inputs: Responsive & Spacious */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 text-xs">
                {/* Leave Type Selector - FormSelect matching Image 3 with Search & ColorDot */}
                <div className="sm:col-span-2 lg:col-span-4 space-y-1">
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
                <div className="sm:col-span-1 lg:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                    શરૂ તારીખ (From)
                  </label>
                  <input
                    type="date"
                    value={seg.startDate}
                    onChange={(e) => handleUpdateSegment(idx, "startDate", e.target.value)}
                    className="w-full rounded-xl border border-input bg-card px-2.5 py-2 text-xs font-medium focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 shadow-2xs"
                  />
                </div>

                {/* End Date */}
                <div className="sm:col-span-1 lg:col-span-2 space-y-1">
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

                {/* Remarks / Reason */}
                <div className="sm:col-span-2 lg:col-span-4 space-y-1">
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
