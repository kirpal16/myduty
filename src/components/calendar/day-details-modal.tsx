"use client";

import { NavLink as Link } from "@/components/ui/nav-link";
import { eventsForDay } from "@/lib/calendar/eventDays";
import {
  X,
  Calendar,
  Briefcase,
  CalendarOff,
  Sparkles,
  Clock,
  MapPin,
  IndianRupee,
  Plus,
  User,
  Coffee,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ColorDot } from "@/components/ui/color-dot";
import { DeleteLeaveButton } from "@/components/leave/delete-leave-button";
import { DeleteDutyButton } from "@/components/duty/delete-duty-button";
import { DutyHolidayBadge, DutyTaBadge } from "@/components/duty/duty-badges";
import { formatSafeDateFull, formatSafeTime } from "@/lib/format/safeDate";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import { useModalBackClose } from "@/lib/hooks/useModalBackClose";
import type { CalendarEvent } from "./modern-calendar";

export interface DayDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  events: CalendarEvent[];
}

const cleanHolidayTitle = (title: string) =>
  title
    .replace(/^Holiday:\s*/i, "")
    .replace(/^My holiday:\s*/i, "")
    .replace(/^Optional Holiday:\s*/i, "")
    .replace(/\s*-\s*કૃષ્ણ જન્મોત્સવ/gi, "")
    .trim();

export function DayDetailsModal({
  isOpen,
  onClose,
  date,
  events,
}: DayDetailsModalProps) {
  useBodyScrollLock(isOpen);
  useModalBackClose(isOpen, onClose);

  if (!isOpen) return null;

  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  // Format date display
  const formattedDate = formatSafeDateFull(date);

  const isToday =
    new Date().toDateString() === date.toDateString();

  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

  // Same span rule as the month grid — shared so the two cannot disagree
  // about which day an event belongs to.
  const dayEvents = eventsForDay(events, date);

  const duties = dayEvents.filter((e) => e.type === "duty");
  const leaves = dayEvents.filter((e) => e.type === "leave");
  const holidays = dayEvents.filter((e) => e.type.startsWith("holiday"));

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in-0 duration-150 print:hidden"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-3xl bg-card border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[88vh]"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold">
              <Calendar className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">
                  {formattedDate}
                </h3>
                {isToday && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                    Today
                  </span>
                )}
                {isWeekend && !isToday && (
                  <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                    Weekend
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {dayEvents.length === 0
                  ? "No duties, leaves, or holidays logged for this day."
                  : `${dayEvents.length} scheduled item${dayEvents.length > 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable Event List */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-6 space-y-4 custom-scrollbar">
          {/* Holidays / Off-Days Section */}
          {holidays.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-rose-500" />
                <span>Holidays & Off-Days ({holidays.length})</span>
              </span>
              <div className="space-y-2">
                {holidays.map((h) => {
                  const isOptional = h.type === "holiday-optional";
                  return (
                    <div
                      key={h.id}
                      className={`flex items-start justify-between gap-3 p-3.5 rounded-2xl border ${
                        isOptional
                          ? "border-purple-500/30 bg-purple-500/5 dark:bg-purple-950/20"
                          : "border-rose-500/30 bg-rose-500/5 dark:bg-rose-950/20"
                      }`}
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-foreground">
                            {cleanHolidayTitle(h.title)}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border ${
                              isOptional
                                ? "border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400"
                                : h.type === "holiday-global"
                                ? "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                : h.type === "holiday-profile"
                                ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400"
                            }`}
                          >
                            {isOptional
                              ? "Optional Holiday (મરજિયાત)"
                              : h.type === "holiday-global"
                              ? "Public Holiday"
                              : h.type === "holiday-profile"
                              ? "Role Holiday"
                              : "Personal Off-Day"}
                          </span>
                        </div>
                      {h.details && (
                        <p className="text-xs text-muted-foreground">
                          {h.details}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}

          {/* Duty Shifts Section */}
          {duties.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Briefcase className="size-3.5 text-indigo-500" />
                <span>Duty Shifts ({duties.length})</span>
              </span>
              <div className="space-y-2">
                {duties.map((d) => (
                  <div
                    key={d.id}
                    className="p-3.5 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 dark:bg-indigo-950/20 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-foreground">
                        {d.title.replace("Duty: ", "")}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Same badges as the duty log and the agenda list,
                            icon-only because "Active Shift" and the delete
                            control already share this row. */}
                        <DutyHolidayBadge
                          duty={{
                            is_holiday_duty: d.isHolidayDuty,
                            manual_holiday_claim: d.manualHolidayClaim,
                          }}
                          iconOnly
                        />
                        <DutyTaBadge duty={{ ta_amount: d.taAmount }} iconOnly />
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                          Active Shift
                        </span>
                        <DeleteDutyButton id={d.id} iconOnly size="sm" />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1 border-t border-border/50">
                      {d.start && (
                        <div className="flex items-center gap-1">
                          <Clock className="size-3 text-indigo-500" />
                          <span>
                            {formatSafeTime(d.start)}
                            {d.end && ` → ${formatSafeTime(d.end)}`}
                          </span>
                        </div>
                      )}
                      {d.details && (
                        <div className="flex items-center gap-1">
                          <MapPin className="size-3 text-rose-500" />
                          <span>{d.details}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Leaves & Absences Section */}
          {leaves.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <CalendarOff className="size-3.5 text-emerald-500" />
                <span>Leaves & Absences ({leaves.length})</span>
              </span>
              <div className="space-y-2">
                {leaves.map((l) => (
                  <div
                    key={l.id}
                    className="p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-foreground">
                        {/* The type's own colour. The card's border and tint
                            stay emerald — that is the "leave" category — but
                            the dot says WHICH leave, which is the whole point
                            of letting a type carry a colour. */}
                        <ColorDot color={l.color} label={l.rawType} />
                        <span className="min-w-0">{l.title.replace("Leave: ", "")}</span>
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          Approved Leave
                        </span>
                        <DeleteLeaveButton id={l.logId ?? l.id.replace(/^leave-/, "")} iconOnly size="sm" />
                      </div>
                    </div>
                    {l.details && (
                      <p className="text-xs text-muted-foreground">
                        Reason: {l.details}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {dayEvents.length === 0 && (
            <div className="py-8 text-center text-muted-foreground border-2 border-dashed border-border rounded-3xl p-6 space-y-2">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-muted mx-auto text-muted-foreground">
                <Calendar className="size-6" />
              </div>
              <p className="text-xs sm:text-sm font-semibold text-foreground">
                No events or off-days on this date
              </p>
              <p className="text-[11px] text-muted-foreground">
                Use the actions below to log a shift, record an absence, or declare an off-day.
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons in Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-2">
            <Link
              href={`/leave/new?startDate=${dateStr}&endDate=${dateStr}`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 shadow-2xs transition-colors"
            >
              <CalendarOff className="size-3.5" />
              <span>Log Leave</span>
            </Link>

            <Link
              href={`/duty/new?startsAt=${dateStr}T09:00`}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 hover:bg-indigo-500 transition-colors"
            >
              <Plus className="size-3.5" />
              <span>Log Duty</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
