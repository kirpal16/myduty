"use client";

import { useState, useMemo } from "react";
import { eventsForDay, eventDayRange } from "@/lib/calendar/eventDays";
import { eventTimeRange } from "@/lib/calendar/eventTimeRange";
import {
  DutyHolidayBadge,
  DutyTaBadge,
  type DutyBadgeRow,
} from "@/components/duty/duty-badges";
import {
  resolveHolidaysForRange,
  type HolidayRecord,
} from "@/lib/holidays/resolveHoliday";
import { toDateKey } from "@/lib/format/datetime";
import { leaveDayCount, leaveDaysWithin, formatDays } from "@/lib/leave/leaveDays";
import {
  HolidayDayOffAccordion,
  type AccordionDay,
} from "./holiday-day-off-accordion";
import { NavLink as Link } from "@/components/ui/nav-link";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  Briefcase,
  CalendarOff,
  Sparkles,
  Palmtree,
  Clock,
  MapPin,
  Filter,
  Coffee,
  Check,
  LayoutGrid,
  CalendarDays,
  List,
  Sun,
  AlertCircle,
  Tag,
  ArrowRight,
} from "lucide-react";
import { DayDetailsModal } from "./day-details-modal";
import { DeleteLeaveButton } from "@/components/leave/delete-leave-button";
import { DeleteDutyButton } from "@/components/duty/delete-duty-button";
import { Badge } from "@/components/ui/badge";
import { ColorDot } from "@/components/ui/color-dot";
import type { TimeFormat } from "@/types/database";
import {
  formatSafeDateShort,
  formatSafeDateFull,
  formatSafeMonthFull,
  formatSafeMonthShort,
  formatSafeWeekdayFull,
  formatSafeWeekdayShort,
  formatSafeTime,
} from "@/lib/format/safeDate";
import {
  isSunday,
  isSecondOrFourthSaturday,
  isWeekendHoliday,
  getMonthWeekendHolidays,
} from "@/lib/holidays/weekendRules";

export type CalendarEventType =
  | "duty"
  | "leave"
  | "holiday-global"
  | "holiday-optional"
  | "holiday-profile"
  | "holiday-user";

export type CalendarEvent = {
  id: string;
  logId?: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  type: CalendarEventType;
  details?: string;
  rawType?: string;
  /**
   * Per-leave-type colour from `leave_types.color`. When present it overrides
   * the category default below, so two different kinds of leave are
   * distinguishable instead of both rendering the same green.
   */
  color?: string | null;
  /**
   * Duty facts the calendar shows as badges: whether the officer worked a
   * holiday, whether they claimed holiday pay on an ordinary day, and any
   * travelling allowance.
   *
   * Carried on the event rather than re-derived here, because the same three
   * badges appear in the duty log and must mean exactly the same thing in
   * both places.
   */
  isHolidayDuty?: boolean | null;
  manualHolidayClaim?: boolean | null;
  taAmount?: number | null;
  /** Leave only: a half-day counts 0.5 towards the day totals. */
  isHalfDay?: boolean | null;
};

/**
 * A calendar event as the shared duty badges expect it. Returns null for
 * anything that is not a duty, so leave and holiday rows render no badges.
 */
function dutyBadgeRow(e: CalendarEvent): DutyBadgeRow | null {
  if (e.type !== "duty") return null;
  return {
    is_holiday_duty: e.isHolidayDuty,
    manual_holiday_claim: e.manualHolidayClaim,
    ta_amount: e.taAmount,
  };
}

const EVENT_STYLES: Record<
  CalendarEventType,
  {
    pillBg: string;
    pillBorder: string;
    pillText: string;
    dotBg: string;
    label: string;
    icon: typeof Briefcase;
  }
> = {
  duty: {
    pillBg: "bg-indigo-50 dark:bg-indigo-950/60",
    pillBorder: "border-indigo-200 dark:border-indigo-800/80",
    pillText: "text-indigo-700 dark:text-indigo-300",
    dotBg: "bg-indigo-600",
    label: "Duty Shift",
    icon: Briefcase,
  },
  leave: {
    pillBg: "bg-emerald-50 dark:bg-emerald-950/60",
    pillBorder: "border-emerald-200 dark:border-emerald-800/80",
    pillText: "text-emerald-700 dark:text-emerald-300",
    dotBg: "bg-emerald-600",
    label: "Leave / Absence",
    icon: CalendarOff,
  },
  "holiday-global": {
    pillBg: "bg-rose-50 dark:bg-rose-950/60",
    pillBorder: "border-rose-200 dark:border-rose-800/80",
    pillText: "text-rose-700 dark:text-rose-300",
    dotBg: "bg-rose-600",
    label: "Public Holiday",
    icon: Sparkles,
  },
  "holiday-optional": {
    pillBg: "bg-purple-50 dark:bg-purple-950/60",
    pillBorder: "border-purple-200 dark:border-purple-800/80",
    pillText: "text-purple-700 dark:text-purple-300",
    dotBg: "bg-purple-600",
    label: "Optional Holiday",
    icon: Palmtree,
  },
  "holiday-profile": {
    pillBg: "bg-amber-50 dark:bg-amber-950/60",
    pillBorder: "border-amber-200 dark:border-amber-800/80",
    pillText: "text-amber-700 dark:text-amber-300",
    dotBg: "bg-amber-600",
    label: "Role Off-Day",
    icon: Coffee,
  },
  "holiday-user": {
    pillBg: "bg-sky-50 dark:bg-sky-950/60",
    pillBorder: "border-sky-200 dark:border-sky-800/80",
    pillText: "text-sky-700 dark:text-sky-300",
    dotBg: "bg-sky-600",
    label: "Personal / Weekend Off",
    icon: CalendarOff,
  },
};

/**
 * Returns a fallback color for a leave type if none was explicitly configured in the database,
 * ensuring each distinct leave type has an easily recognizable color dot.
 */
export function getLeaveColor(color?: string | null, rawType?: string | null): string {
  if (color && /^#[0-9a-fA-F]{6}$/.test(color)) return color;
  if (!rawType) return "#10b981";
  const lower = rawType.toLowerCase();
  if (lower.includes("casual") || lower === "cl") return "#3b82f6"; // blue
  if (lower.includes("optional") || lower === "oh" || lower.includes("મરજિયાત")) return "#8b5cf6"; // violet
  if (lower.includes("privilege") || lower.includes("earned") || lower === "pl" || lower === "el") return "#a855f7"; // purple
  if (lower.includes("medical") || lower === "ml") return "#ef4444"; // red
  if (lower.includes("sick") || lower === "sl") return "#f59e0b"; // amber
  if (lower.includes("compensatory") || lower.includes("commuted") || lower.includes("c-off")) return "#14b8a6"; // teal
  if (lower.includes("holiday") || lower === "hl") return "#059669"; // emerald
  if (lower.includes("maternity") || lower.includes("paternity")) return "#ec4899"; // pink
  return "#10b981";
}

/**
 * A per-leave-type colour, applied inline because it comes from the database
 * and so cannot be a Tailwind class. Mid-tone hexes are used for the text on
 * a low-alpha wash of the same hue, which stays legible in both themes.
 */
function customEventStyle(color?: string | null): React.CSSProperties | undefined {
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) return undefined;
  return {
    backgroundColor: `${color}1f`,
    borderColor: `${color}59`,
    color,
  };
}

const WEEKDAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ModernCalendar({
  events,
  timeFormat = "24h",
  dbHolidays = [],
}: {
  events: CalendarEvent[];
  timeFormat?: TimeFormat;
  /**
   * The stored holiday rows, so the month's non-working days can be resolved
   * with the same precedence the duty form and the server use.
   */
  dbHolidays?: HolidayRecord[];
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedMobileDate, setSelectedMobileDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week" | "agenda">("month");
  const [activeFilter, setActiveFilter] = useState<"all" | "duty" | "leave" | "holiday">("all");
  const [bottomTab, setBottomTab] = useState<"holidays" | "optional" | "leaves" | "duties">("holidays");

  const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(null);
  const [isDayDetailsOpen, setIsDayDetailsOpen] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = formatSafeMonthFull(currentDate);

  // Navigation Handlers
  const handlePrev = () => {
    if (viewMode === "month") {
      setCurrentDate(new Date(year, month - 1, 1));
    } else if (viewMode === "week") {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    } else {
      setCurrentDate(new Date(year, month - 1, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === "month") {
      setCurrentDate(new Date(year, month + 1, 1));
    } else if (viewMode === "week") {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    } else {
      setCurrentDate(new Date(year, month + 1, 1));
    }
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedMobileDate(now);
  };

  // Combine DB events with automated Sundays + 2nd and 4th Saturday off-days
  const allEvents = useMemo(() => {
    const currentWeekends = getMonthWeekendHolidays(year, month);
    const prevWeekends = getMonthWeekendHolidays(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1);
    const nextWeekends = getMonthWeekendHolidays(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1);
    const allWeekends = [...prevWeekends, ...currentWeekends, ...nextWeekends];

    // An Optional Holiday on a Sunday / 2nd-4th Saturday does not replace the
    // weekend off — the day is still a weekend holiday (resolveHoliday says
    // so too) — so it must not hide the automatic weekend pill.
    const existingHolidayDates = new Set(
      events
        .filter((e) => e.type.startsWith("holiday") && e.type !== "holiday-optional")
        .map((e) => e.start.slice(0, 10))
    );

    const autoWeekendEvents: CalendarEvent[] = allWeekends
      .filter((w) => !existingHolidayDates.has(w.date))
      .map((w) => ({
        id: w.id,
        title: w.name,
        start: w.date,
        allDay: true,
        type: "holiday-user" as CalendarEventType,
        details: w.type === "sunday" ? "Official Sunday Weekly Off" : "Official Government Saturday Off",
      }));

    return [...events, ...autoWeekendEvents];
  }, [events, year, month]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    if (activeFilter === "all") return allEvents;
    if (activeFilter === "duty") return allEvents.filter((e) => e.type === "duty");
    if (activeFilter === "leave") return allEvents.filter((e) => e.type === "leave");
    if (activeFilter === "holiday") return allEvents.filter((e) => e.type.startsWith("holiday"));
    return allEvents;
  }, [allEvents, activeFilter]);

  // Current Month Summary Events.
  // Bucketed by OVERLAP, not by start date: a leave running 28 Aug - 3 Sep is
  // part of September too, and filtering on `start` alone dropped it from the
  // KPI tiles and the bottom panels even though the grid drew it correctly.
  const monthEvents = useMemo(() => {
    const monthStart = new Date(year, month, 1).getTime();
    const monthEnd = new Date(year, month + 1, 0).getTime();
    return allEvents.filter((e) => {
      const range = eventDayRange(e);
      return range !== null && range.from <= monthEnd && range.to >= monthStart;
    });
  }, [allEvents, year, month]);

  const monthLeaves = monthEvents.filter((e) => e.type === "leave");

  // Days off in THIS month: each leave's days, clipped to the month, so a
  // five-day leave is five, and one spilling into next month counts only
  // the days that fall here.
  const leaveStartKey = (l: CalendarEvent) => l.start.slice(0, 10);
  const leaveEndKey = (l: CalendarEvent) => (l.end ?? l.start).slice(0, 10);
  const monthLeaveDays = monthLeaves.reduce(
    (a, l) =>
      a +
      leaveDaysWithin(
        leaveStartKey(l),
        leaveEndKey(l),
        Boolean(l.isHalfDay),
        toDateKey(new Date(year, month, 1)),
        toDateKey(new Date(year, month + 1, 0)),
      ),
    0,
  );
  const monthDuties = monthEvents.filter((e) => e.type === "duty");
  const monthHolidays = monthEvents.filter((e) => e.type.startsWith("holiday"));

  /**
   * Every non-working day in the visible month, and whether a duty was logged
   * on it. "Worked" is what decides pay: a holiday taken off earns nothing,
   * a holiday worked earns the allowance.
   */
  const accordionDays = useMemo(() => {
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    const resolved = resolveHolidaysForRange(monthStart, monthEnd, dbHolidays);

    const workedKeys = new Set(
      allEvents
        .filter((e) => e.type === "duty")
        .map((e) => toDateKey(new Date(e.start))),
    );

    const out: AccordionDay[] = [];
    for (const [dateKey, r] of resolved) {
      if (!r.isHoliday || !r.kind) continue;
      out.push({ dateKey, kind: r.kind, name: r.name, worked: workedKeys.has(dateKey) });
    }
    return out.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [year, month, dbHolidays, allEvents]);

  const standardAccordionDays = useMemo(
    () => accordionDays.filter((d) => d.kind !== "optional_holiday"),
    [accordionDays]
  );

  const optionalAccordionDays = useMemo(
    () => accordionDays.filter((d) => d.kind === "optional_holiday"),
    [accordionDays]
  );

  // Compute 35 or 42 grid cells for the month view
  const monthGridDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: {
      date: Date;
      isCurrentMonth: boolean;
      isToday: boolean;
      isWeekend: boolean;
      dayNumber: number;
    }[] = [];

    const todayStr = new Date().toDateString();

    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      days.push({
        date: d,
        isCurrentMonth: false,
        isToday: d.toDateString() === todayStr,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        dayNumber: daysInPrevMonth - i,
      });
    }

    for (let i = 1; i <= daysInCurrentMonth; i++) {
      const d = new Date(year, month, i);
      days.push({
        date: d,
        isCurrentMonth: true,
        isToday: d.toDateString() === todayStr,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        dayNumber: i,
      });
    }

    const totalCells = days.length > 35 ? 42 : 35;
    const remaining = totalCells - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({
        date: d,
        isCurrentMonth: false,
        isToday: d.toDateString() === todayStr,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        dayNumber: i,
      });
    }

    return days;
  }, [year, month]);

  // Helper to get events for a date. The span rule lives in
  // lib/calendar/eventDays so this and DayDetailsModal cannot drift apart.
  const getEventsForDay = (d: Date) => eventsForDay(filteredEvents, d);

  const handleOpenDay = (d: Date) => {
    setSelectedDayDate(d);
    setIsDayDetailsOpen(true);
  };


  const mobileSelectedEvents = getEventsForDay(selectedMobileDate);
  const pad = (n: number) => String(n).padStart(2, "0");
  const selectedMobileDateStr = `${selectedMobileDate.getFullYear()}-${pad(selectedMobileDate.getMonth() + 1)}-${pad(selectedMobileDate.getDate())}`;

  return (
    <div className="w-full space-y-6">
      {/* 1. Sleek Monthly KPI Bar (Full Width Banner: 4 Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* Metric 1: Monthly Leaves */}
        <div
          onClick={() => setBottomTab("leaves")}
          className={`p-3 sm:p-4 rounded-2xl sm:rounded-3xl border transition-all cursor-pointer bg-card shadow-xs flex items-center justify-between gap-2 sm:gap-3 ${
            bottomTab === "leaves"
              ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/[0.03]"
              : "border-border hover:border-emerald-500/40 hover:bg-muted/20"
          }`}
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex size-9 sm:size-11 items-center justify-center rounded-xl sm:rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
              <CalendarOff className="size-4 sm:size-5" />
            </div>
            <div className="min-w-0">
              <span className="block text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
                Leaves
              </span>
              <div className="flex items-baseline gap-1 sm:gap-1.5">
                <span className="text-lg sm:text-2xl font-black text-foreground">
                  {monthLeaveDays}
                </span>
                <span className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">
                  Days Off
                </span>
              </div>
            </div>
          </div>
          <Link
            href="/leave/new"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors shrink-0"
            title="Log Leave"
          >
            <Plus className="size-3.5 sm:size-4" />
          </Link>
        </div>

        {/* Metric 2: Holidays & Weekend Offs (Excluding Optional) */}
        <div
          onClick={() => setBottomTab("holidays")}
          className={`p-3 sm:p-4 rounded-2xl sm:rounded-3xl border transition-all cursor-pointer bg-card shadow-xs flex items-center justify-between gap-2 sm:gap-3 ${
            bottomTab === "holidays"
              ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/[0.03]"
              : "border-border hover:border-amber-500/40 hover:bg-muted/20"
          }`}
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex size-9 sm:size-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
              <Sparkles className="size-4 sm:size-5" />
            </div>
            <div className="min-w-0">
              <span className="block text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
                Holidays &amp; Offs
              </span>
              <div className="flex items-baseline gap-1 sm:gap-1.5">
                <span className="text-lg sm:text-2xl font-black text-foreground">
                  {standardAccordionDays.length}
                </span>
                <span className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">
                  Observances
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Metric 3: Optional Holidays (Marjiyat / મરજિયાત રજા) */}
        <div
          onClick={() => setBottomTab("optional")}
          className={`p-3 sm:p-4 rounded-2xl sm:rounded-3xl border transition-all cursor-pointer bg-card shadow-xs flex items-center justify-between gap-2 sm:gap-3 ${
            bottomTab === "optional"
              ? "border-purple-500 ring-2 ring-purple-500/20 bg-purple-500/[0.03]"
              : "border-border hover:border-purple-500/40 hover:bg-muted/20"
          }`}
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex size-9 sm:size-11 items-center justify-center rounded-xl sm:rounded-2xl bg-purple-500/15 text-purple-600 dark:text-purple-400 shrink-0">
              <Palmtree className="size-4 sm:size-5" />
            </div>
            <div className="min-w-0">
              <span className="block text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
                Optional (મરજિયાત)
              </span>
              <div className="flex items-baseline gap-1 sm:gap-1.5">
                <span className="text-lg sm:text-2xl font-black text-foreground">
                  {optionalAccordionDays.length}
                </span>
                <span className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">
                  Available
                </span>
              </div>
            </div>
          </div>
          <Link
            href="/leave/new?type=OH"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 transition-colors shrink-0"
            title="Apply Optional Leave"
          >
            <Plus className="size-3.5 sm:size-4" />
          </Link>
        </div>

        {/* Metric 4: Duty Shifts */}
        <div
          onClick={() => setBottomTab("duties")}
          className={`p-3 sm:p-4 rounded-2xl sm:rounded-3xl border transition-all cursor-pointer bg-card shadow-xs flex items-center justify-between gap-2 sm:gap-3 ${
            bottomTab === "duties"
              ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-500/[0.03]"
              : "border-border hover:border-indigo-500/40 hover:bg-muted/20"
          }`}
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex size-9 sm:size-11 items-center justify-center rounded-xl sm:rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 shrink-0">
              <Briefcase className="size-4 sm:size-5" />
            </div>
            <div className="min-w-0">
              <span className="block text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
                Duties
              </span>
              <div className="flex items-baseline gap-1 sm:gap-1.5">
                <span className="text-lg sm:text-2xl font-black text-foreground">
                  {monthDuties.length}
                </span>
                <span className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">
                  Shifts Active
                </span>
              </div>
            </div>
          </div>
          <Link
            href="/duty/new"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm transition-colors shrink-0"
            title="Log Duty"
          >
            <Plus className="size-3.5 sm:size-4" />
          </Link>
        </div>
      </div>

      {/* 2. Main Full-Width Calendar Card */}
      <div className="rounded-3xl border border-border bg-card shadow-xs overflow-hidden flex flex-col">
        {/* Navigation & Controls Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-muted/20 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Left: Navigator (< Today > Month Year) */}
          <div className="flex items-center justify-between sm:justify-start gap-3">
            <div className="flex items-center gap-1 border border-border bg-card rounded-2xl p-1 shadow-2xs">
              <button
                type="button"
                onClick={handlePrev}
                className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="size-4.5" />
              </button>
              <button
                type="button"
                onClick={handleToday}
                className="px-3.5 py-1 text-xs font-bold text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="size-4.5" />
              </button>
            </div>

            <div className="flex items-baseline gap-2">
              <h2 className="text-lg sm:text-2xl font-black text-foreground tracking-tight">
                {monthName}
              </h2>
              <span className="text-sm font-bold text-muted-foreground">
                {year}
              </span>
            </div>
          </div>

          {/* Right: View Switcher (Month / Week / Agenda) */}
          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5">
            <div className="flex items-center bg-muted/60 p-1 rounded-2xl border border-border/80">
              <button
                type="button"
                onClick={() => setViewMode("month")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === "month"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-card"
                }`}
              >
                <LayoutGrid className="size-3.5" />
                <span>Month</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === "week"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-card"
                }`}
              >
                <CalendarDays className="size-3.5" />
                <span>Week</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("agenda")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === "agenda"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-card"
                }`}
              >
                <List className="size-3.5" />
                <span>Agenda</span>
              </button>
            </div>
          </div>
        </div>

        {/* Category Filters Bar */}
        <div className="px-4 py-2.5 border-b border-border bg-card flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mr-1 flex items-center gap-1">
              <Filter className="size-3" /> Filter:
            </span>
            {[
              { id: "all", label: "All Items" },
              { id: "duty", label: "Duties", dot: "bg-indigo-600" },
              { id: "leave", label: "Leaves", dot: "bg-emerald-600" },
              { id: "holiday", label: "Holidays / Off-Days", dot: "bg-amber-500" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFilter(f.id as typeof activeFilter)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeFilter === f.id
                    ? "bg-foreground text-background shadow-xs font-bold"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
                }`}
              >
                {f.dot && <span className={`size-2 rounded-full ${f.dot}`} />}
                <span>{f.label}</span>
              </button>
            ))}
          </div>

          <span className="text-[11px] text-muted-foreground hidden lg:inline">
            Hover or tap any date to inspect details or declare off-days
          </span>
        </div>

        {/* VIEW 1: MONTH GRID (Responsive: Full Pills on Desktop, Compact Dots on Mobile) */}
        {viewMode === "month" && (
          <div className="flex flex-col">
            {/* Weekday Labels Header */}
            <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center">
              {WEEKDAYS.map((day, idx) => {
                const isWeekend = idx === 0 || idx === 6;
                return (
                  <div
                    key={day}
                    className={`py-2 sm:py-2.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider ${
                      isWeekend
                        ? "text-amber-600 dark:text-amber-400 bg-amber-500/5"
                        : "text-muted-foreground"
                    }`}
                  >
                    <span className="hidden sm:inline">{day}</span>
                    <span className="sm:hidden">{day.slice(0, 2)}</span>
                  </div>
                );
              })}
            </div>

            {/* 7-Column Grid */}
            <div className="grid grid-cols-7 divide-x divide-y divide-border/60">
              {monthGridDays.map((cell, idx) => {
                const dayEvents = getEventsForDay(cell.date);
                const isSelectedOnMobile =
                  cell.date.toDateString() === selectedMobileDate.toDateString();

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedMobileDate(cell.date);
                      if (window.innerWidth >= 640) {
                        handleOpenDay(cell.date);
                      }
                    }}
                    className={`group relative min-h-[64px] sm:min-h-[110px] md:min-h-[125px] p-1.5 sm:p-2 flex flex-col transition-all cursor-pointer select-none ${
                      !cell.isCurrentMonth
                        ? "bg-muted/10 opacity-40 hover:opacity-80"
                        : cell.isWeekend
                        ? "bg-amber-500/[0.02] dark:bg-amber-500/[0.04] hover:bg-muted/40"
                        : "bg-card hover:bg-muted/30"
                    } ${cell.isToday ? "ring-2 ring-indigo-500/40 bg-indigo-500/[0.04]" : ""} ${
                      isSelectedOnMobile ? "sm:ring-0 ring-2 ring-indigo-600 bg-indigo-500/10" : ""
                    }`}
                  >
                    {/* Day Number Header */}
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span
                        className={`size-6 sm:size-7 flex items-center justify-center rounded-full text-xs font-bold transition-transform ${
                          cell.isToday
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-105"
                            : cell.isCurrentMonth
                            ? "text-foreground group-hover:text-indigo-600"
                            : "text-muted-foreground"
                        }`}
                      >
                        {cell.dayNumber}
                      </span>

                    </div>

                    {/* Desktop: Rich Event Pill Badges */}
                    <div className="hidden sm:flex flex-1 flex-col space-y-1 overflow-hidden">
                      {dayEvents.slice(0, 3).map((e) => {
                        const style = EVENT_STYLES[e.type] || EVENT_STYLES.duty;
                        const leaveColor = e.type === "leave" ? getLeaveColor(e.color, e.rawType) : null;
                        const custom = customEventStyle(leaveColor || e.color);
                        const shortTitle = e.title
                          .replace("Duty: ", "")
                          .replace("Leave: ", "")
                          .replace("Holiday: ", "")
                          .replace("My holiday: ", "")
                          .replace("Optional Holiday: ", "");

                        return (
                          <div
                            key={e.id}
                            style={custom}
                            className={`flex items-center gap-1.5 px-2 py-0.5 md:py-1 rounded-xl border text-[10px] sm:text-[11px] font-semibold truncate transition-transform hover:scale-[1.02] shadow-2xs ${
                              custom ? "" : `${style.pillBg} ${style.pillBorder} ${style.pillText}`
                            }`}
                            title={e.title}
                          >
                            {leaveColor ? (
                              <span
                                className="size-2 rounded-full shrink-0 border border-black/10 dark:border-white/20"
                                style={{ backgroundColor: leaveColor }}
                                title={e.rawType ?? undefined}
                              />
                            ) : (
                              <span className={`size-1.5 rounded-full ${style.dotBg} shrink-0`} />
                            )}
                            <span className="truncate">{shortTitle}</span>
                          </div>
                        );
                      })}

                      {dayEvents.length > 3 && (
                        <div className="text-[10px] font-bold text-muted-foreground pl-1">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>

                    {/* Mobile: Compact Event Dots Indicator */}
                    <div className="sm:hidden flex items-center justify-center gap-1 mt-auto pb-0.5">
                      {dayEvents.slice(0, 4).map((e) => {
                        const style = EVENT_STYLES[e.type] || EVENT_STYLES.duty;
                        const leaveColor = e.type === "leave" ? getLeaveColor(e.color, e.rawType) : null;
                        return (
                          <span
                            key={e.id}
                            className={`size-1.5 rounded-full ${leaveColor ? "" : style.dotBg}`}
                            style={leaveColor ? { backgroundColor: leaveColor } : undefined}
                            title={e.title}
                          />
                        );
                      })}
                      {dayEvents.length > 4 && (
                        <span className="text-[8px] font-bold text-muted-foreground">
                          +
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW 2: WEEK VIEW */}
        {viewMode === "week" && (
          <div className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
              {Array.from({ length: 7 }).map((_, idx) => {
                const curr = new Date(currentDate);
                const dayOfWeek = curr.getDay();
                const startOfWeek = new Date(curr.setDate(curr.getDate() - dayOfWeek + idx));
                const weekEvents = getEventsForDay(startOfWeek);
                const isToday = startOfWeek.toDateString() === new Date().toDateString();

                return (
                  <div
                    key={idx}
                    onClick={() => handleOpenDay(startOfWeek)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col min-h-[200px] ${
                      isToday
                        ? "border-indigo-500 bg-indigo-500/5 ring-2 ring-indigo-500/20"
                        : "border-border bg-card hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-border pb-2 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {WEEKDAYS[idx]}
                      </span>
                      <span
                        className={`size-6 flex items-center justify-center rounded-full text-xs font-bold ${
                          isToday ? "bg-indigo-600 text-white" : "text-foreground"
                        }`}
                      >
                        {startOfWeek.getDate()}
                      </span>
                    </div>

                    <div className="flex-1 space-y-1.5">
                      {weekEvents.map((e) => {
                        const style = EVENT_STYLES[e.type] || EVENT_STYLES.duty;
                        const leaveColor = e.type === "leave" ? getLeaveColor(e.color, e.rawType) : null;
                        const custom = customEventStyle(leaveColor || e.color);
                        return (
                          <div
                            key={e.id}
                            style={custom}
                            className={`p-2 rounded-xl border text-xs font-semibold ${
                              custom ? "" : `${style.pillBg} ${style.pillBorder} ${style.pillText}`
                            }`}
                          >
                            <div className="flex items-center gap-1.5 truncate font-bold">
                              {leaveColor ? (
                                <span
                                  className="size-2 rounded-full shrink-0 border border-black/10 dark:border-white/20"
                                  style={{ backgroundColor: leaveColor }}
                                  title={e.rawType ?? undefined}
                                />
                              ) : (
                                <span className={`size-1.5 rounded-full ${style.dotBg} shrink-0`} />
                              )}
                              <span className="truncate">{e.title}</span>
                            </div>
                          </div>
                        );
                      })}

                      {weekEvents.length === 0 && (
                        <div className="h-full flex items-center justify-center text-[11px] text-muted-foreground/60 italic">
                          No events
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW 3: AGENDA TIMELINE */}
        {viewMode === "agenda" && (
          <div className="p-4 sm:p-6 divide-y divide-border">
            {filteredEvents
              .slice()
              .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
              .map((e) => {
                const style = EVENT_STYLES[e.type] || EVENT_STYLES.duty;
                const Icon = style.icon;
                const eventDate = new Date(e.start);
                const listBadgeRow = dutyBadgeRow(e);
                const leaveColor = e.type === "leave" ? getLeaveColor(e.color, e.rawType) : null;

                return (
                  <div
                    key={e.id}
                    className="py-3.5 flex items-start gap-4 hover:bg-muted/20 px-3 rounded-2xl transition-colors group"
                  >
                    <div className="flex flex-col items-center justify-center size-12 rounded-2xl bg-muted/60 border border-border text-center shrink-0">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">
                        {formatSafeMonthShort(eventDate)}
                      </span>
                      <span className="text-base font-extrabold text-foreground">
                        {eventDate.getDate()}
                      </span>
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-lg border flex items-center gap-1.5 ${style.pillBg} ${style.pillBorder} ${style.pillText}`}
                          style={customEventStyle(leaveColor || e.color)}
                        >
                          {leaveColor ? (
                            <span
                              className="size-2 rounded-full shrink-0 border border-black/10 dark:border-white/20"
                              style={{ backgroundColor: leaveColor }}
                            />
                          ) : (
                            <span className={`size-1.5 rounded-full ${style.dotBg} shrink-0`} />
                          )}
                          <span>{e.type === "leave" && e.rawType ? e.rawType : style.label}</span>
                        </span>
                        <span className="text-xs font-semibold text-muted-foreground">
                          {formatSafeWeekdayFull(eventDate)}
                        </span>
                        {/* Labelled here — a desktop row has the width, and
                            the amount is worth reading. */}
                        {listBadgeRow && (
                          <>
                            <DutyHolidayBadge duty={listBadgeRow} />
                            <DutyTaBadge duty={listBadgeRow} />
                          </>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-foreground">
                        {e.title}
                      </h4>
                      {e.details && (
                        <p className="text-xs text-muted-foreground">
                          {e.details}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

            {filteredEvents.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                No events found in this category.
              </div>
            )}
          </div>
        )}

        {/* Mobile-Only Selected Day Schedule Inspector (Inline below grid) */}
        <div className="sm:hidden border-t border-border p-4 bg-muted/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="size-4 text-indigo-500" />
              <span className="text-xs font-bold text-foreground">
                {formatSafeDateShort(selectedMobileDate)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {mobileSelectedEvents.map((e) => {
              const style = EVENT_STYLES[e.type] || EVENT_STYLES.duty;
              const Icon = style.icon;
              /* Times are worked out relative to the day being viewed, not
                 printed raw: a night shift or a multi-day duty would
                 otherwise show the same "22:00 – 06:00" on every day it
                 touches, as if it started afresh each morning. */
              const timeLabel = eventTimeRange(e, selectedMobileDate, timeFormat);
              const badgeRow = dutyBadgeRow(e);
              return (
                <div
                  key={e.id}
                  className={`p-3 rounded-2xl border ${style.pillBg} ${style.pillBorder} ${style.pillText} space-y-1`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-bold">
                      {e.type === "leave" ? (
                        <ColorDot color={getLeaveColor(e.color, e.rawType)} label={e.rawType} />
                      ) : (
                        <span className={`size-2 rounded-full ${style.dotBg} shrink-0`} />
                      )}
                      <span className="min-w-0">{e.title}</span>
                    </div>
                    {badgeRow && (
                      /* Icons only: the card is 343px wide and already carries
                         a title, a time and a station. */
                      <div className="flex shrink-0 items-center gap-1">
                        <DutyHolidayBadge duty={badgeRow} iconOnly />
                        <DutyTaBadge duty={badgeRow} iconOnly />
                      </div>
                    )}
                  </div>
                  {timeLabel && (
                    <p className="flex items-center gap-1 text-[11px] font-semibold opacity-90">
                      <Clock className="size-3 shrink-0" />
                      <span>{timeLabel}</span>
                    </p>
                  )}
                  {e.details && (
                    <p className="text-[11px] opacity-80">{e.details}</p>
                  )}
                </div>
              );
            })}

            {mobileSelectedEvents.length === 0 && (
              <div className="p-3 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                No duties or leaves on this date.
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Link
              href={`/leave/new?startDate=${selectedMobileDateStr}&endDate=${selectedMobileDateStr}`}
              className="flex items-center justify-center gap-1 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
            >
              <CalendarOff className="size-3" />
              <span>Log Leave</span>
            </Link>
            <Link
              href={`/duty/new?startsAt=${selectedMobileDateStr}T09:00`}
              className="flex items-center justify-center gap-1 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold shadow-xs"
            >
              <Plus className="size-3" />
              <span>Log Duty</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 3. Full-Width Bottom Panels (Holidays, Optional, Leaves, Duties Tabs) */}
      <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
        {/* Tab Headers: Clean Segmented Control (2x2 on mobile, 4 in a row on sm+) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border/70 pb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-2xl bg-muted/60 border border-border/60 flex-1">
            <button
              type="button"
              onClick={() => setBottomTab("holidays")}
              className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                bottomTab === "holidays"
                  ? "bg-card text-amber-600 dark:text-amber-400 font-bold shadow-xs border border-amber-500/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50 font-medium"
              }`}
            >
              <Sparkles className="size-3.5 shrink-0 text-amber-500" />
              <span className="truncate">
                <span className="sm:hidden">Holidays</span>
                <span className="hidden sm:inline">Holidays &amp; Offs</span>{" "}
                <span className="text-[11px] opacity-80">({standardAccordionDays.length})</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setBottomTab("optional")}
              className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                bottomTab === "optional"
                  ? "bg-card text-purple-600 dark:text-purple-400 font-bold shadow-xs border border-purple-500/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50 font-medium"
              }`}
            >
              <Palmtree className="size-3.5 shrink-0 text-purple-500" />
              <span className="truncate">
                <span className="sm:hidden">Optional</span>
                <span className="hidden sm:inline">Optional Holidays</span>{" "}
                <span className="text-[11px] opacity-80">({optionalAccordionDays.length})</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setBottomTab("leaves")}
              className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                bottomTab === "leaves"
                  ? "bg-card text-emerald-600 dark:text-emerald-400 font-bold shadow-xs border border-emerald-500/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50 font-medium"
              }`}
            >
              <CalendarOff className="size-3.5 shrink-0 text-emerald-500" />
              <span className="truncate">
                <span className="sm:hidden">Leaves</span>
                <span className="hidden sm:inline">Monthly Leaves</span>{" "}
                <span className="text-[11px] opacity-80">({formatDays(monthLeaveDays)})</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setBottomTab("duties")}
              className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                bottomTab === "duties"
                  ? "bg-card text-indigo-600 dark:text-indigo-400 font-bold shadow-xs border border-indigo-500/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50 font-medium"
              }`}
            >
              <Briefcase className="size-3.5 shrink-0 text-indigo-500" />
              <span className="truncate">
                <span className="sm:hidden">Duties</span>
                <span className="hidden sm:inline">Duty Roster</span>{" "}
                <span className="text-[11px] opacity-80">({monthDuties.length})</span>
              </span>
            </button>
          </div>

          {/* Action Button */}
          {bottomTab === "optional" && (
            <Link
              href="/leave/new?type=OH"
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 text-xs font-semibold text-white shadow-xs hover:bg-purple-500 transition-colors shrink-0"
            >
              <Plus className="size-3.5" />
              <span>Apply Optional Leave</span>
            </Link>
          )}
          {bottomTab === "leaves" && (
            <Link
              href="/leave/new"
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-xs font-semibold text-white shadow-xs hover:opacity-90 transition-opacity shrink-0"
            >
              <Plus className="size-3.5" />
              <span>Log Leave</span>
            </Link>
          )}
          {bottomTab === "duties" && (
            <Link
              href="/duty/new"
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 transition-colors shrink-0"
            >
              <Plus className="size-3.5" />
              <span>Log Duty</span>
            </Link>
          )}
        </div>

        {/* Tab 1 Content: Holidays & Off-Days */}
        {bottomTab === "holidays" && (
          <div className="animate-in fade-in-0 duration-150">
            <HolidayDayOffAccordion days={standardAccordionDays} />
          </div>
        )}

        {/* Tab 2 Content: Optional Holidays (મરજિયાત રજા) */}
        {bottomTab === "optional" && (
          <div className="space-y-3 animate-in fade-in-0 duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-2xl bg-purple-500/5 border border-purple-500/20 text-xs text-muted-foreground">
              <div className="flex items-center gap-2.5">
                <Palmtree className="size-4 text-purple-600 dark:text-purple-400 shrink-0" />
                <span>
                  <strong>Optional Holidays (મરજિયાત રજા):</strong> Regular working days by default. Eligible government employees may opt for up to 2 optional leaves per year.
                </span>
              </div>
              <Link
                href="/leave/new?type=OH"
                className="inline-flex items-center gap-1 font-semibold text-purple-600 dark:text-purple-400 hover:underline shrink-0"
              >
                <span>Apply Optional Leave</span>
                <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {optionalAccordionDays.map((d) => {
                const date = new Date(`${d.dateKey}T12:00:00`);
                const leaveOnDate = monthLeaves.find((l) => {
                  const lRange = eventDayRange(l);
                  if (!lRange) return false;
                  const dTime = new Date(`${d.dateKey}T00:00:00`).getTime();
                  return dTime >= lRange.from && dTime <= lRange.to;
                });

                return (
                  <div
                    key={d.dateKey}
                    className="p-3.5 rounded-2xl border border-border/80 bg-muted/20 hover:bg-muted/40 transition-colors flex items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                      <div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
                        <Palmtree className="size-4" />
                      </div>
                      <div className="flex flex-col truncate">
                        <span className="text-xs font-bold text-foreground truncate">
                          {d.name || "Optional Holiday"}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {formatSafeDateFull(date)} · {formatSafeWeekdayFull(date)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {leaveOnDate ? (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                          Leave Taken
                        </span>
                      ) : d.worked ? (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-slate-500/20 bg-slate-500/10 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Regular Duty
                        </span>
                      ) : (
                        <Link
                          href={`/leave/new?startDate=${d.dateKey}&endDate=${d.dateKey}&type=OH`}
                          className="inline-flex items-center gap-1 rounded-lg border border-purple-500/30 bg-purple-500/15 hover:bg-purple-500/25 px-2 py-1 text-[10px] font-semibold text-purple-700 dark:text-purple-300 transition-colors"
                        >
                          <Plus className="size-3" />
                          <span>Take Leave</span>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}

              {optionalAccordionDays.length === 0 && (
                <div className="col-span-full py-8 text-center text-xs text-muted-foreground border-2 border-dashed border-border rounded-2xl p-6">
                  No declared optional holidays (મરજિયાત રજા) in {monthName}.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2 Content: Leaves */}
        {bottomTab === "leaves" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in-0 duration-150">
            {monthLeaves.map((l) => {
              const leaveColor = getLeaveColor(l.color, l.rawType);
              return (
                <div
                  key={l.id}
                  className="p-3.5 rounded-2xl border border-border/80 bg-muted/20 hover:bg-muted/40 transition-colors flex flex-col gap-3"
                >
                  {/* Header: who / what, type, delete. One leave = one card. */}
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className="flex size-9 items-center justify-center rounded-xl shrink-0"
                        style={{
                          backgroundColor: `${leaveColor}1f`,
                          color: leaveColor,
                          border: `1px solid ${leaveColor}40`,
                        }}
                      >
                        <CalendarOff className="size-4" />
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <ColorDot color={leaveColor} label={l.rawType} />
                        <span
                          className="text-xs font-bold text-foreground truncate"
                          title={l.title.replace("Leave: ", "")}
                        >
                          {l.title.replace("Leave: ", "")}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: `${leaveColor}60`,
                          color: leaveColor,
                          backgroundColor: `${leaveColor}15`,
                        }}
                      >
                        {l.rawType || "Leave"}
                      </Badge>
                      <DeleteLeaveButton id={l.id} iconOnly size="sm" />
                    </div>
                  </div>

                  {/* Start / End / Total — full width, never truncated. */}
                  <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/60 bg-card/60 p-2.5 text-xs">
                    <div className="min-w-0">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Start Date
                      </span>
                      <span className="block font-semibold text-foreground">
                        {formatSafeDateShort(leaveStartKey(l))}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        End Date
                      </span>
                      <span className="block font-semibold text-foreground">
                        {formatSafeDateShort(leaveEndKey(l))}
                      </span>
                    </div>
                    <div className="min-w-0 text-right">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Total Days
                      </span>
                      <span className="block font-black" style={{ color: leaveColor }}>
                        {formatDays(
                          leaveDayCount(leaveStartKey(l), leaveEndKey(l), Boolean(l.isHalfDay)),
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {monthLeaves.length === 0 && (
              <div className="col-span-full py-8 text-center text-xs text-muted-foreground border-2 border-dashed border-border rounded-2xl p-6">
                No officer leaves scheduled for {monthName}.
              </div>
            )}
          </div>
        )}

        {/* Tab 3 Content: Duties */}
        {bottomTab === "duties" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in-0 duration-150">
            {monthDuties.map((d) => {
              const dutyDate = new Date(d.start);
              const isDutyOnHoliday = isSunday(dutyDate) || isSecondOrFourthSaturday(dutyDate);

              return (
                <div
                  key={d.id}
                  className="p-3.5 rounded-2xl border border-border/80 bg-muted/20 hover:bg-muted/40 transition-colors flex items-center justify-between gap-2.5"
                >
                  <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                      <Briefcase className="size-4" />
                    </div>
                    <div className="flex flex-col truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground truncate">
                          {d.title.replace("Duty: ", "")}
                        </span>
                        {isDutyOnHoliday && (
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded-md">
                            Holiday Duty
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {formatSafeDateShort(d.start)}
                        {d.details ? ` • ${d.details}` : ""}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="purple">Active</Badge>
                    <DeleteDutyButton id={d.id} iconOnly size="sm" />
                  </div>
                </div>
              );
            })}

            {monthDuties.length === 0 && (
              <div className="col-span-full py-8 text-center text-xs text-muted-foreground border-2 border-dashed border-border rounded-2xl p-6">
                No shifts scheduled for {monthName}.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Day Inspector Modal (Desktop click) */}
      {selectedDayDate && (
        <DayDetailsModal
          isOpen={isDayDetailsOpen}
          onClose={() => {
            setIsDayDetailsOpen(false);
            setSelectedDayDate(null);
          }}
          date={selectedDayDate}
          events={events}
        />
      )}

      {/* Declare Holiday / Weekend Off Modal */}
    </div>
  );
}
