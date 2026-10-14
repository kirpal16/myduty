"use client";

import { useState } from "react";
import {
  ChevronDown,
  Sun,
  CalendarDays,
  Sparkles,
  Minus,
  Palmtree,
  Info,
} from "lucide-react";
import { formatSafeDateFull } from "@/lib/format/safeDate";
import type { HolidayDay, HolidayYearSummary } from "@/lib/holidays/holidayYearSummary";
import { useLanguage } from "@/lib/i18n/language-context";
import { toGujaratiNumerals } from "@/lib/reports/gujaratiReportUtils";

/**
 * Where the Holiday Leave total comes from, itemised.
 *
 * Public holidays (Sundays, 2nd & 4th Saturdays, and gazetted festivals) form the
 * general Holiday Leave allocation.
 *
 * Optional holidays (મરજિયાત રજા) are strictly separated: employees can take
 * any 2 days per year from the declared optional list, and they do NOT inflate
 * the general Holiday Leave total.
 */
export function HolidayBreakdown({ summary }: { summary: HolidayYearSummary }) {
  const { isGujarati, t } = useLanguage();
  const [open, setOpen] = useState<string | null>(null);
  const [showOptionalList, setShowOptionalList] = useState(false);

  const rows: {
    id: string;
    label: string;
    hint: string;
    icon: React.ElementType;
    accent: string;
    days: HolidayDay[];
    signed: string;
  }[] = [
    {
      id: "sundays",
      label: t.settings.sundays,
      hint: t.settings.everySunday,
      icon: Sun,
      accent: "text-purple-500",
      days: summary.sundays,
      signed: `+${isGujarati ? toGujaratiNumerals(summary.sundays.length) : summary.sundays.length}`,
    },
    {
      id: "saturdays",
      label: t.settings.secondFourthSaturdays,
      hint: t.settings.secondFourthSaturdaysHint,
      icon: CalendarDays,
      accent: "text-sky-500",
      days: summary.weekendSaturdays,
      signed: `+${isGujarati ? toGujaratiNumerals(summary.weekendSaturdays.length) : summary.weekendSaturdays.length}`,
    },
    {
      id: "festivals",
      label: t.settings.festivalsGazetted,
      hint: t.settings.festivalsGazettedHint,
      icon: Sparkles,
      accent: "text-amber-500",
      days: summary.festivals,
      signed: `+${isGujarati ? toGujaratiNumerals(summary.festivals.length) : summary.festivals.length}`,
    },
    {
      id: "overlaps",
      label: t.settings.alreadyCounted,
      hint: t.settings.alreadyCountedHint,
      icon: Minus,
      accent: "text-rose-500",
      days: summary.overlaps,
      signed: `−${isGujarati ? toGujaratiNumerals(summary.overlaps.length) : summary.overlaps.length}`,
    },
  ];

  return (
    <div className="space-y-4">
      {/* 1. Public Holidays Breakdown (Statutory Holiday Leave) */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border bg-muted/30 px-3 py-2.5 sm:px-4">
          <p className="text-xs font-bold text-foreground">
            {t.settings.publicHolidaysBreakdown}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {t.settings.publicHolidaysBreakdownSubtitle}
          </p>
        </div>

        <div className="divide-y divide-border">
          {rows.map((r) => {
            const isOpen = open === r.id;
            const Icon = r.icon;
            return (
              <div key={r.id}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : r.id)}
                  aria-expanded={isOpen}
                  disabled={r.days.length === 0}
                  className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left transition-colors hover:bg-muted disabled:cursor-default disabled:opacity-60 sm:gap-3 sm:px-4"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Icon className={`size-4 shrink-0 ${r.accent}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground">{r.label}</p>
                      <p className="text-[11px] leading-snug text-muted-foreground">{r.hint}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-sm font-bold text-foreground">
                      {r.signed}
                    </span>
                    {r.days.length > 0 && (
                      <ChevronDown
                        className={`size-4 text-muted-foreground transition-transform ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    )}
                  </div>
                </button>

                {isOpen && r.days.length > 0 && (
                  <ul className="max-h-64 divide-y divide-border/60 overflow-y-auto border-t border-border/60 bg-muted/30">
                    {r.days.map((d) => (
                      <li
                        key={`${r.id}-${d.date}`}
                        className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 px-3 py-2 sm:px-4"
                      >
                        <span className="text-[11px] font-semibold text-foreground">
                          {formatSafeDateFull(new Date(`${d.date}T12:00:00`), isGujarati)}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {d.label}
                          {d.alsoCountedAs ? ` · also ${d.alsoCountedAs}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3 border-t-2 border-border bg-muted/50 px-3 py-3 sm:px-4">
          <div>
            <p className="text-xs font-bold text-foreground">
              {isGujarati
                ? `${t.settings.totalPublicHolidaysInYear} ${toGujaratiNumerals(summary.year)}`
                : `Total Public Holidays in ${summary.year}`}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t.settings.totalPublicHolidaysHint}
            </p>
          </div>
          <span className="font-mono text-xl font-bold text-foreground">
            {isGujarati ? toGujaratiNumerals(summary.total) : summary.total}
          </span>
        </div>
      </div>

      {/* 2. Optional Holidays (મરજિયાત રજા) Card */}
      <div className="overflow-hidden rounded-2xl border border-purple-500/30 bg-purple-500/5">
        <div className="p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400">
                <Palmtree className="size-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                  {t.settings.optionalHolidaysTitle}
                  <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-300">
                    {t.settings.maxTwoPerYear}
                  </span>
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {t.settings.optionalHolidaysChoice}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowOptionalList((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-xl border border-purple-500/30 bg-card px-2.5 py-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 transition-colors hover:bg-purple-500/10"
            >
              <span>
                {isGujarati ? toGujaratiNumerals(summary.optionalHolidays.length) : summary.optionalHolidays.length}{" "}
                {t.settings.declaredCount}
              </span>
              <ChevronDown
                className={`size-3.5 transition-transform ${
                  showOptionalList ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>

          <div className="mt-2.5 flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0 text-purple-500" />
            <span>
              {isGujarati ? (
                <>
                  મરજિયાત રજાઓને ૨ દિવસના વાર્ષિક ક્વોટા સાથે અલગ રજા પ્રકાર (OH) તરીકે ગણવામાં આવે છે.
                  તેઓ ઉપરના {toGujaratiNumerals(summary.total)} સામાન્ય રજા દિવસોમાં <strong>ગણવામાં આવતા નથી</strong>.
                </>
              ) : (
                <>
                  Optional holidays are treated as a separate leave type (OH) with a yearly quota of 2 days.
                  They are <strong>not counted</strong> in the {summary.total} general Holiday Leave days above.
                </>
              )}
            </span>
          </div>
        </div>

        {showOptionalList && (
          <div className="border-t border-purple-500/20 bg-background/50">
            {summary.optionalHolidays.length === 0 ? (
              <p className="px-4 py-4 text-center text-xs text-muted-foreground">
                {t.settings.optionalHolidaysEmptyHint.replace(
                  "{year}",
                  isGujarati ? toGujaratiNumerals(summary.year) : String(summary.year),
                )}
              </p>
            ) : (
              <ul className="max-h-64 divide-y divide-purple-500/10 overflow-y-auto">
                {summary.optionalHolidays.map((d) => (
                  <li
                    key={`optional-${d.date}`}
                    className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 px-3 py-2 sm:px-4"
                  >
                    <span className="text-[11px] font-semibold text-foreground">
                      {formatSafeDateFull(new Date(`${d.date}T12:00:00`), isGujarati)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {d.label}
                      {d.alsoCountedAs ? ` · also ${d.alsoCountedAs}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
