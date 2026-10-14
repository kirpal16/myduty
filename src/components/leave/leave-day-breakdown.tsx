"use client";

import { useState } from "react";
import { AlertCircle, CalendarDays, Check, Loader2, Pencil, RotateCcw, Sparkles } from "lucide-react";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { ColorDot } from "@/components/ui/color-dot";
import { formatSafeDateShort } from "@/lib/format/safeDate";
import { formatDays } from "@/lib/leave/leaveDays";
import { useLanguage } from "@/lib/i18n/language-context";
import { toGujaratiNumerals } from "@/lib/reports/gujaratiReportUtils";
import { getPureGujaratiLeaveTypeName } from "@/lib/leave/leaveTranslation";
import type { AllocationPreview } from "@/actions/leave";

type LeaveTypeOption = {
  id: string;
  name: string;
  code?: string | null;
  color?: string | null;
};

function formatDayLabel(label: string, isGujarati: boolean, workingDayText: string): string {
  if (!label) return "";
  if (!isGujarati) return label;
  const trimmed = label.trim();
  if (trimmed.toLowerCase() === "working day") return workingDayText;
  if (trimmed.toLowerCase() === "sunday") return "રવિવાર";
  if (trimmed.toLowerCase() === "saturday") return "શનિવાર";
  if (trimmed.toLowerCase().startsWith("optional holiday:")) {
    return trimmed.replace(/^optional holiday:\s*/i, "મરજિયાત રજા: ");
  }
  if (trimmed.toLowerCase() === "optional holiday") {
    return "મરજિયાત રજા";
  }
  return trimmed;
}

/**
 * The day-by-day split of one leave, as cards the officer can change.
 *
 * The engine SUGGESTS a type for every date (CL, HL on holidays, OH on
 * optional holidays while quota lasts, SPL …). Each card shows that
 * suggestion as a coloured chip; "Change" opens every leave type as chips,
 * and whatever the officer picks is final — it replaces the suggestion. The
 * server still checks each choice against the same rules (HL only on a real
 * holiday, OH only on a declared optional holiday within quota, other types
 * only while balance remains) and the issues it reports appear on the card.
 *
 * Only CHANGED days are posted (hidden `dayType.<date>` inputs); a day left
 * as suggested follows the engine.
 */
export function LeaveDayBreakdown({
  preview,
  leaveTypes,
  overrides,
  onChange,
  open,
  onToggle,
  loading = false,
}: {
  preview: AllocationPreview;
  leaveTypes: readonly LeaveTypeOption[];
  /** date -> leave type id, for the days the officer changed. */
  overrides: Readonly<Record<string, string>>;
  /** `null` resets the day to the suggestion. */
  onChange: (date: string, leaveTypeId: string | null) => void;
  open: boolean;
  onToggle: () => void;
  /** A newer split is being worked out; the cards show the previous one. */
  loading?: boolean;
}) {
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const { dictionary, isGujarati } = useLanguage();
  const t = dictionary?.leave;

  const dayByDaySplit = t?.dayByDaySplit || (isGujarati ? "દિવસ મુજબ વિભાજન" : "Day-by-day split");
  const yourChoice = t?.yourChoice || (isGujarati ? "તમારી પસંદગી" : "Your choice");
  const suggested = t?.suggested || (isGujarati ? "સૂચવેલ" : "Suggested");
  const workingDay = t?.workingDay || (isGujarati ? "કામકાજનો દિવસ" : "Working day");
  const resetSuggestion = t?.resetSuggestion || (isGujarati ? "રીસેટ" : "Reset");
  const backToSuggestion = t?.backToSuggestion || (isGujarati ? "મૂળ સૂચન પર પાછા જાઓ" : "Back to the suggestion");
  const changeText = t?.change || (isGujarati ? "બદલો" : "Change");
  const doneText = t?.done || (isGujarati ? "પૂર્ણ" : "Done");
  const toFix = t?.toFix || (isGujarati ? "સુધારવા જરૂરી" : "to fix");
  const dayChangedByYou = t?.dayChangedByYou || (isGujarati ? "દિવસ તમે બદલેલ છે." : "day changed by you.");
  const daysChangedByYou = t?.daysChangedByYou || (isGujarati ? "દિવસો તમે બદલેલ છે." : "days changed by you.");
  const dayBreakdownHelp =
    t?.dayBreakdownHelp ||
    (isGujarati
      ? "રજા કેલેન્ડરમાંથી સૂચવેલ — જાહેર રજાઓ 'લાભ રજા (HL)' તરીકે, ૨-દિવસના ક્વોટા સુધી જાહેર કરેલ મરજિયાત રજાઓ 'OH' તરીકે, અને બાકીના દિવસો તમે પસંદ કરેલ રજા મુજબ. કોઈપણ દિવસ પર બદલો ટેપ કરો; તમારી પસંદગી આખરી રહેશે."
      : "Suggested from the holiday calendar — holidays as Holiday Leave (HL), declared optional holidays as OH while your 2-day quota lasts, the rest as the leave you picked. Tap Change on any day; your choice is final.");

  const typeById = new Map(leaveTypes.map((t) => [t.id, t]));
  const typeFor = (id: string, fallbackCode: string): LeaveTypeOption =>
    typeById.get(id) ?? { id, name: fallbackCode, code: fallbackCode, color: null };

  const issuesByDate = new Map<string, string[]>();
  const generalIssues: string[] = [];
  for (const issue of preview.issues) {
    if (issue.date) {
      issuesByDate.set(issue.date, [...(issuesByDate.get(issue.date) ?? []), issue.message]);
    } else {
      generalIssues.push(issue.message);
    }
  }

  // Colour for each code in the summary, from the type it came from.
  const colorByCode = new Map<string, string | null | undefined>();
  for (const d of preview.days) {
    if (!colorByCode.has(d.code)) colorByCode.set(d.code, typeById.get(d.leaveTypeId)?.color);
  }

  const changedCount = preview.days.filter(
    (d) => (overrides[d.date] ?? d.engineTypeId) !== d.engineTypeId,
  ).length;

  const summary =
    preview.issues.length > 0 ? (
      <span className="text-rose-600 dark:text-rose-400">
        {isGujarati ? toGujaratiNumerals(preview.issues.length) : preview.issues.length} {toFix}
      </span>
    ) : (
      <span className="flex flex-wrap items-center gap-1">
        {loading && <Loader2 className="size-3 animate-spin text-emerald-600" />}
        {preview.breakdown.map((b) => (
          <span
            key={b.code}
            className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-card px-1.5 py-0.5 normal-case text-foreground"
          >
            <ColorDot color={colorByCode.get(b.code)} label={b.code} />
            {isGujarati
              ? toGujaratiNumerals(Number.isInteger(b.days) ? b.days : b.days.toFixed(1))
              : Number.isInteger(b.days)
                ? b.days
                : b.days.toFixed(1)}{" "}
            {b.code}
          </span>
        ))}
      </span>
    );

  return (
    <div
      className={`rounded-2xl border px-4 py-1.5 transition-opacity ${
        preview.issues.length > 0 ? "border-rose-500/40 bg-rose-500/5" : "border-border bg-card"
      } ${loading ? "opacity-70" : ""}`}
      aria-busy={loading}
    >
      <CollapsibleSection
        title={`${dayByDaySplit} · ${formatDays(preview.totalDays, isGujarati)}`}
        icon={CalendarDays}
        summary={summary}
        open={open}
        onToggle={onToggle}
      >
        <div className="space-y-3 pb-3">
          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
            <span>
              {dayBreakdownHelp}
              {changedCount > 0 && (
                <strong className="text-foreground">
                  {" "}
                  {isGujarati ? toGujaratiNumerals(changedCount) : changedCount}{" "}
                  {changedCount === 1 ? dayChangedByYou : daysChangedByYou}
                </strong>
              )}
            </span>
          </p>

          {generalIssues.map((m) => (
            <p key={m} className="flex items-start gap-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              {m}
            </p>
          ))}

          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {preview.days.map((d) => {
              const chosenId = overrides[d.date] ?? d.engineTypeId;
              const chosen = typeFor(chosenId, d.code);
              const changed = chosenId !== d.engineTypeId;
              const dayIssues = issuesByDate.get(d.date) ?? [];
              const isEditing = editingDate === d.date;
              const options = typeById.has(chosenId) ? leaveTypes : [...leaveTypes, chosen];

              return (
                <li
                  key={d.date}
                  className={`space-y-2 rounded-xl border p-3 ${
                    dayIssues.length > 0
                      ? "border-rose-500/60 bg-rose-500/5"
                      : changed
                        ? "border-indigo-500/40 bg-indigo-500/5"
                        : "border-border/80 bg-muted/20"
                  }`}
                >
                  {/* Date and what kind of day it is */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block text-xs font-bold text-foreground">
                        {formatSafeDateShort(new Date(`${d.date}T12:00:00`), isGujarati)}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {formatDayLabel(d.dayLabel, isGujarati, workingDay)}
                      </span>
                    </div>
                    {changed ? (
                      <span className="shrink-0 rounded-md bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                        {yourChoice}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                        {suggested}
                      </span>
                    )}
                  </div>

                  {/* The type this day is charged to */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="inline-flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold text-foreground"
                      style={
                        chosen.color
                          ? { borderColor: `${chosen.color}66`, backgroundColor: `${chosen.color}1a` }
                          : undefined
                      }
                    >
                      <ColorDot color={chosen.color} label={chosen.name} />
                      <span className="truncate">
                        {isGujarati ? getPureGujaratiLeaveTypeName(chosen.name) : chosen.name}
                      </span>
                      {chosen.code && chosen.code !== chosen.name && (
                        <span className="text-[10px] font-medium text-muted-foreground">({chosen.code})</span>
                      )}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      {changed && (
                        <button
                          type="button"
                          onClick={() => onChange(d.date, null)}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                          title={backToSuggestion}
                        >
                          <RotateCcw className="size-3" />
                          {resetSuggestion}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditingDate(isEditing ? null : d.date)}
                        aria-expanded={isEditing}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
                      >
                        <Pencil className="size-3" />
                        {isEditing ? doneText : changeText}
                      </button>
                    </div>
                  </div>

                  {/* Every leave type, as coloured chips */}
                  {isEditing && (
                    <div
                      className="flex flex-wrap gap-1.5 border-t border-border/60 pt-2"
                      role="radiogroup"
                      aria-label={`${isGujarati ? "રજાનો પ્રકાર" : "Leave type for"} ${d.date}`}
                    >
                      {options.map((tOpt) => {
                        const selected = tOpt.id === chosenId;
                        return (
                          <button
                            key={tOpt.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => {
                              onChange(d.date, tOpt.id === d.engineTypeId ? null : tOpt.id);
                              setEditingDate(null);
                            }}
                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors ${
                              selected
                                ? "border-indigo-600 bg-indigo-500/10 text-foreground ring-2 ring-indigo-500/20"
                                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                          >
                            <ColorDot color={tOpt.color} label={tOpt.name} />
                            {isGujarati
                              ? getPureGujaratiLeaveTypeName(tOpt.name || tOpt.code || "")
                              : tOpt.code || tOpt.name}
                            {tOpt.id === d.engineTypeId && (
                              <span className="text-[9px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                                {suggested}
                              </span>
                            )}
                            {selected && <Check className="size-3 text-indigo-600" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {dayIssues.map((m) => (
                    <p
                      key={m}
                      role="alert"
                      className="flex items-start gap-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-400"
                    >
                      <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                      {m}
                    </p>
                  ))}
                </li>
              );
            })}
          </ul>
        </div>
      </CollapsibleSection>

      {/* Posted with the form; outside the collapsible so they always exist. */}
      {Object.entries(overrides).map(([date, id]) => (
        <input key={date} type="hidden" name={`dayType.${date}`} value={id} />
      ))}
    </div>
  );
}
