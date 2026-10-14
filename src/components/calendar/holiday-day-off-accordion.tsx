"use client";

import { useState } from "react";
import { ChevronDown, Sparkles, CalendarOff, Coffee } from "lucide-react";
import { formatSafeDateFull, formatSafeWeekdayFull } from "@/lib/format/safeDate";
import type { HolidayKind } from "@/lib/holidays/resolveHoliday";
import { useLanguage } from "@/lib/i18n/language-context";
import { translateDutyTypeToGujarati, toGujaratiNumerals } from "@/lib/reports/gujaratiReportUtils";

export type AccordionDay = {
  dateKey: string;
  kind: HolidayKind;
  name?: string;
  /** Whether the officer logged a duty on this day. */
  worked: boolean;
};

export function HolidayDayOffAccordion({ days }: { days: AccordionDay[] }) {
  const { t, isGujarati } = useLanguage();
  const [open, setOpen] = useState<HolidayKind | null>("public_holiday");

  const sections = [
    {
      kind: "public_holiday" as const,
      title: t.calendar.publicHolidays,
      hint: t.calendar.publicHolidaysHint,
      icon: Sparkles,
      accent: "text-rose-500",
    },
    {
      kind: "weekend" as const,
      title: t.calendar.weekendOffs,
      hint: t.calendar.weekendOffsHint,
      icon: CalendarOff,
      accent: "text-sky-500",
    },
    {
      kind: "day_off" as const,
      title: t.calendar.dayOffs,
      hint: t.calendar.dayOffsHint,
      icon: Coffee,
      accent: "text-amber-500",
    },
  ];

  // Filter out optional holidays since they have their own dedicated card & tab.
  // Public holidays, weekends, and day-offs are non-working days; any duty worked earns holiday allowance.
  const filteredDays = days.filter((d) => d.kind !== "optional_holiday");
  const workedCount = filteredDays.filter((d) => d.worked).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {t.calendar.holidaysAndOffsThisMonth}
        </h3>
        <p className="text-[11px] text-muted-foreground">
          <span className="font-bold text-foreground">
            {isGujarati ? toGujaratiNumerals(filteredDays.length) : filteredDays.length}
          </span>{" "}
          {t.calendar.nonWorkingDaysAndObservances} ·{" "}
          <span className="font-bold text-amber-600 dark:text-amber-400">
            {isGujarati ? toGujaratiNumerals(workedCount) : workedCount}
          </span>{" "}
          {t.calendar.holidayDutiesWorked}
        </p>
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {sections.map((section) => {
          const items = filteredDays.filter((d) => d.kind === section.kind);
          const isOpen = open === section.kind;
          const Icon = section.icon;

          return (
            <div key={section.kind}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : section.kind)}
                aria-expanded={isOpen}
                disabled={items.length === 0}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted disabled:cursor-default disabled:opacity-60"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Icon className={`size-4 shrink-0 ${section.accent}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">
                      {section.title}
                      <span className="ml-1.5 font-semibold text-muted-foreground">
                        ({isGujarati ? toGujaratiNumerals(items.length) : items.length})
                      </span>
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {section.hint}
                    </p>
                  </div>
                </div>
                {items.length > 0 && (
                  <ChevronDown
                    className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                )}
              </button>

              {isOpen && items.length > 0 && (
                <ul className="divide-y divide-border/60 border-t border-border/60 bg-muted/30">
                  {items.map((d) => {
                    const date = new Date(`${d.dateKey}T12:00:00`);

                    let localizedName = d.name;
                    if (isGujarati && d.name) {
                      const lower = d.name.toLowerCase().trim();
                      if (lower === "2nd saturday" || lower === "second saturday") {
                        localizedName = t.calendar.secondSaturday;
                      } else if (lower === "4th saturday" || lower === "fourth saturday") {
                        localizedName = t.calendar.fourthSaturday;
                      } else if (lower === "sunday") {
                        localizedName = t.calendar.weekdays.sunday;
                      } else if (lower === "saturday") {
                        localizedName = t.calendar.weekdays.saturday;
                      } else if (lower === "monday") {
                        localizedName = t.calendar.weekdays.monday;
                      } else if (lower === "tuesday") {
                        localizedName = t.calendar.weekdays.tuesday;
                      } else if (lower === "wednesday") {
                        localizedName = t.calendar.weekdays.wednesday;
                      } else if (lower === "thursday") {
                        localizedName = t.calendar.weekdays.thursday;
                      } else if (lower === "friday") {
                        localizedName = t.calendar.weekdays.friday;
                      } else {
                        const translated = translateDutyTypeToGujarati(d.name);
                        if (translated && translated !== d.name) {
                          localizedName = translated;
                        }
                      }
                    }

                    return (
                      <li
                        key={d.dateKey}
                        className="flex items-start justify-between gap-2 px-4 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-foreground">
                            {formatSafeDateFull(date, isGujarati)}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {formatSafeWeekdayFull(date, isGujarati)}
                            {localizedName ? ` · ${localizedName}` : ""}
                          </p>
                        </div>
                        {d.worked ? (
                          <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                            <Sparkles className="size-3" />
                            {t.calendar.workedBadge}
                          </span>
                        ) : (
                          <span className="shrink-0 whitespace-nowrap rounded-lg border border-border bg-card px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            {t.calendar.offBadge}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
