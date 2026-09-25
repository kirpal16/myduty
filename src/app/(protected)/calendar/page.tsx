import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  ModernCalendar,
  type CalendarEvent,
} from "@/components/calendar/modern-calendar";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { NavLink as Link } from "@/components/ui/nav-link";
import { Plus, CalendarOff, Palmtree } from "lucide-react";

export default async function CalendarPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const [
    { data: duties },
    { data: leaves },
    { data: holidays },
    { data: leaveDays },
  ] = await Promise.all([
    supabase
      .from("duties")
      .select(
        "id, starts_at, ends_at, status, location, notes, is_holiday_duty, manual_holiday_claim, ta_amount, duty_types(name), users!duties_user_id_fkey(full_name)",
      )
      .neq("status", "CANCELLED"),
    supabase
      .from("leave_logs")
      .select(
        "id, start_date, end_date, is_half_day, half_day_session, reason, leave_types(name, color), users!leave_requests_user_id_fkey(full_name)",
      ),
    supabase
      .from("holidays")
      .select("id, name, holiday_date, scope, is_government, is_optional"),
    supabase
      .from("leave_log_days")
      .select("id, leave_log_id, leave_date, fraction, leave_types(name, code, color)"),
  ]);

  // Index leave days by log id for fast lookup
  const leaveDaysByLog = new Map<
    string,
    {
      leave_date: string;
      fraction: number;
      typeName: string;
      color: string | null;
    }[]
  >();

  for (const d of leaveDays ?? []) {
    const lt = d.leave_types as unknown as {
      name: string;
      code: string | null;
      color: string | null;
    } | null;
    const list = leaveDaysByLog.get(d.leave_log_id) ?? [];
    list.push({
      leave_date: d.leave_date,
      fraction: Number(d.fraction ?? 1),
      typeName: lt?.name ?? "Leave",
      color: lt?.color ?? null,
    });
    leaveDaysByLog.set(d.leave_log_id, list);
  }

  const leaveEvents: CalendarEvent[] = [];
  for (const l of leaves ?? []) {
    const officer = (l.users as unknown as { full_name: string } | null)?.full_name ?? "";
    const parentLeaveType = l.leave_types as unknown as {
      name: string;
      color: string | null;
    } | null;
    const daysForLog = leaveDaysByLog.get(l.id) ?? [];

    if (daysForLog.length === 0) {
      // Fallback for logs without day rows
      const typeName = parentLeaveType?.name ?? "Leave";
      leaveEvents.push({
        id: `leave-${l.id}`,
        logId: l.id,
        title: `Leave: ${typeName} — ${officer}${l.is_half_day ? ` (${l.half_day_session ?? "Half-Day"})` : ""}`,
        start: l.start_date,
        end: l.end_date,
        allDay: true,
        isHalfDay: l.is_half_day,
        type: "leave",
        rawType: typeName,
        color: parentLeaveType?.color ?? null,
        details: l.reason || undefined,
      });
    } else {
      // Group contiguous days sharing the same leave type
      const sorted = [...daysForLog].sort((a, b) => a.leave_date.localeCompare(b.leave_date));
      let currentSeg = {
        startDate: sorted[0].leave_date,
        endDate: sorted[0].leave_date,
        typeName: sorted[0].typeName,
        color: sorted[0].color,
      };

      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        const prevDate = new Date(`${prev.leave_date}T12:00:00`);
        const currDate = new Date(`${curr.leave_date}T12:00:00`);
        const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 1 && curr.typeName === currentSeg.typeName && curr.color === currentSeg.color) {
          currentSeg.endDate = curr.leave_date;
        } else {
          leaveEvents.push({
            id: `leave-${l.id}-${currentSeg.startDate}`,
            logId: l.id,
            title: `Leave: ${currentSeg.typeName} — ${officer}${l.is_half_day ? ` (${l.half_day_session ?? "Half-Day"})` : ""}`,
            start: currentSeg.startDate,
            end: currentSeg.endDate,
            allDay: true,
            isHalfDay: l.is_half_day,
            type: "leave",
            rawType: currentSeg.typeName,
            color: currentSeg.color,
            details: l.reason || undefined,
          });
          currentSeg = {
            startDate: curr.leave_date,
            endDate: curr.leave_date,
            typeName: curr.typeName,
            color: curr.color,
          };
        }
      }

      leaveEvents.push({
        id: `leave-${l.id}-${currentSeg.startDate}`,
        logId: l.id,
        title: `Leave: ${currentSeg.typeName} — ${officer}${l.is_half_day ? ` (${l.half_day_session ?? "Half-Day"})` : ""}`,
        start: currentSeg.startDate,
        end: currentSeg.endDate,
        allDay: true,
        isHalfDay: l.is_half_day,
        type: "leave",
        rawType: currentSeg.typeName,
        color: currentSeg.color,
        details: l.reason || undefined,
      });
    }
  }

  const events: CalendarEvent[] = [
    ...(duties ?? []).map((d) => {
      const typeName = (d.duty_types as unknown as { name: string } | null)?.name ?? "Duty";
      const officer = (d.users as unknown as { full_name: string } | null)?.full_name ?? "";
      return {
        id: `duty-${d.id}`,
        title: `Duty: ${typeName} — ${officer}`,
        start: d.starts_at,
        end: d.ends_at,
        type: "duty" as const,
        rawType: typeName,
        // Carried through so the calendar's badges say the same thing as the
        // duty log's, rather than each screen deciding for itself.
        isHolidayDuty: d.is_holiday_duty,
        manualHolidayClaim: d.manual_holiday_claim,
        taAmount: d.ta_amount,
        details: d.location ? `Station: ${d.location}${d.notes ? ` • ${d.notes}` : ""}` : d.notes || undefined,
      };
    }),
    ...leaveEvents,
    ...(holidays ?? []).map((h) => ({
      id: `holiday-${h.id}`,
      title: `${
        h.is_optional
          ? "Optional Holiday"
          : h.scope === "USER"
            ? "My holiday"
            : "Holiday"
      }: ${h.name}`,
      start: h.holiday_date,
      allDay: true,
      rawType: h.name,
      type:
        h.is_optional
          ? ("holiday-optional" as const)
          : h.scope === "USER"
            ? ("holiday-user" as const)
            : h.scope === "PROFILE"
              ? ("holiday-profile" as const)
              : ("holiday-global" as const),
    })),
  ];

  return (
    <main className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-7xl 2xl:max-w-full mx-auto space-y-6">
      <PageHeader
        title="Interactive Duty & Roster Calendar"
        subtitle="Live month schedule tracking officer shifts, leaves, weekend off-patterns, and festivals."
        badge={<Badge variant="purple" dot>{events.length} Events Total</Badge>}
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:flex-nowrap lg:gap-2.5">
            {/* Icon only, at every width. The name is carried by the tooltip
                below, by `title` (so it also appears on a long-press) and by
                `aria-label` — an unlabelled icon would otherwise be silent to
                a screen reader and a guess for everyone else.
                `shrink-0` rather than `flex-1`: a square button stretched
                across a third of a phone row looked like a mistake, and the
                two labelled buttons put the freed width to better use. */}
            <div className="group relative shrink-0">
              <Link
                href="/settings?tab=holidays"
                aria-label="Personal Holidays"
                title="Personal Holidays"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs font-semibold text-amber-700 shadow-2xs transition-colors hover:bg-amber-500/20 dark:text-amber-300 sm:py-2.5 sm:text-sm"
              >
                <Palmtree className="size-4 shrink-0" />
              </Link>
              {/* Fades in on hover. Kept to opacity + pointer-events-none
                  rather than a hover-media query: an arbitrary variant that
                  silently compiles to nothing has bitten this file before,
                  and on a touch screen the tap navigates away regardless. */}
              <span
                role="tooltip"
                className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 dark:bg-slate-700"
              >
                Personal Holidays
              </span>
            </div>
            <Link
              href="/leave/new"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 shadow-2xs transition-colors hover:bg-emerald-500/20 dark:text-emerald-300 lg:flex-none sm:px-3.5 sm:text-sm"
            >
              <CalendarOff className="size-4 shrink-0 text-emerald-500" />
              <span>Log Leave</span>
            </Link>
            <Link
              href="/duty/new"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-transparent bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 transition-colors hover:bg-indigo-500 lg:flex-none sm:px-4 sm:text-sm"
            >
              <Plus className="size-4 shrink-0" />
              <span>Log Duty</span>
            </Link>
          </div>
        }
      />

      <ModernCalendar
        events={events}
        timeFormat={user?.timeFormat ?? "24h"}
        dbHolidays={holidays ?? []}
      />
    </main>
  );
}
