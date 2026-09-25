"use client";

import { useState } from "react";
import { ChevronDown, Sparkles, CalendarOff, Coffee } from "lucide-react";
import { formatSafeDateFull, formatSafeWeekdayFull } from "@/lib/format/safeDate";
import type { HolidayKind } from "@/lib/holidays/resolveHoliday";

export type AccordionDay = {
  dateKey: string;
  kind: HolidayKind;
  name?: string;
  /** Whether the officer logged a duty on this day. */
  worked: boolean;
};

/**
 * The month's non-working days and declared observances, grouped by what kind of day they are.
 *
 * Separate from `holiday/holiday-accordions.tsx`, which groups the officer's
 * saved holiday ROWS (with delete buttons and a search box). This groups
 * resolved calendar DAYS by R2 kind — including Sundays and 2nd/4th
 * Saturdays, which are computed rather than stored and so have no row to
 * delete.
 *
 * Each day says whether it was worked, because that is what decides pay: a
 * holiday taken off earns nothing extra, a holiday worked does.
 */
const SECTIONS: {
  kind: HolidayKind;
  title: string;
  hint: string;
  icon: React.ElementType;
  accent: string;
}[] = [
  {
    kind: "public_holiday",
    title: "Public Holidays",
    hint: "Gazetted and department-wide holidays",
    icon: Sparkles,
    accent: "text-rose-500",
  },
  {
    kind: "weekend",
    title: "Weekend Offs",
    hint: "Sundays and the 2nd & 4th Saturday",
    icon: CalendarOff,
    accent: "text-sky-500",
  },
  {
    kind: "day_off",
    title: "Day Offs",
    hint: "Role off-days and your own personal dates",
    icon: Coffee,
    accent: "text-amber-500",
  },
];

export function HolidayDayOffAccordion({ days }: { days: AccordionDay[] }) {
  const [open, setOpen] = useState<HolidayKind | null>("public_holiday");

  // Filter out optional holidays since they have their own dedicated card & tab.
  // Public holidays, weekends, and day-offs are non-working days; any duty worked earns holiday allowance.
  const filteredDays = days.filter((d) => d.kind !== "optional_holiday");
  const workedCount = filteredDays.filter((d) => d.worked).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Holidays &amp; Day Offs This Month
        </h3>
        <p className="text-[11px] text-muted-foreground">
          <span className="font-bold text-foreground">{filteredDays.length}</span> non-working
          days &amp; observances · <span className="font-bold text-amber-600 dark:text-amber-400">
            {workedCount}
          </span>{" "}
          holiday duties worked
        </p>
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {SECTIONS.map((section) => {
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
                        ({items.length})
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
                    return (
                      <li
                        key={d.dateKey}
                        /* No flex-wrap: with a long festival name the badge
                           used to drop to its own line below the date. It now
                           holds the right of the date's own row, and the name
                           truncates instead. `items-start` aligns it with the
                           date line rather than centring it across both. */
                        className="flex items-start justify-between gap-2 px-4 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-foreground">
                            {formatSafeDateFull(date)}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {formatSafeWeekdayFull(date)}
                            {d.name ? ` · ${d.name}` : ""}
                          </p>
                        </div>
                        {d.worked ? (
                          <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                            <Sparkles className="size-3" />
                            Worked
                          </span>
                        ) : (
                          <span className="shrink-0 whitespace-nowrap rounded-lg border border-border bg-card px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            Off
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
