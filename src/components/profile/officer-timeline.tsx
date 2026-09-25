"use client";

import { useState, useTransition } from "react";
import {
  Shield,
  GraduationCap,
  Building2,
  ArrowRightLeft,
  Award,
  Flame,
  Trophy,
  Bookmark,
  Calendar,
  MapPin,
  Clock,
  Plus,
  Pencil,
  Trash2,
  Filter,
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import { NavLink as Link } from "@/components/ui/nav-link";
import { Card } from "@/components/ui/card";
import {
  formatTimelineSpan,
  formatTimelineDate,
  EVENT_TYPE_META,
} from "@/lib/profile/timelineUtils";
import {
  TimelineEventModal,
  type TimelineEventItem,
} from "./timeline-event-modal";
import { AwardModal } from "./award-modal";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { deleteTimelineEventAction } from "@/actions/profile";

export interface OfficerTimelineProps {
  events: TimelineEventItem[];
  canEdit?: boolean;
  variant?: "full" | "dashboard" | "compact";
  maxEvents?: number;
  showHeader?: boolean;
  className?: string;
}

const ICON_MAP = {
  Shield,
  GraduationCap,
  Building2,
  ArrowRightLeft,
  Award,
  Flame,
  Trophy,
  Bookmark,
};

type FilterCategory = "ALL" | "POSTINGS" | "TRANSFERS" | "TRAININGS" | "ACHIEVEMENTS";

export function OfficerTimeline({
  events: initialEvents,
  canEdit = true,
  variant = "full",
  maxEvents = 5,
  showHeader = true,
  className = "",
}: OfficerTimelineProps) {
  const [filter, setFilter] = useState<FilterCategory>("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<TimelineEventItem | null>(null);
  const [isAwardModalOpen, setIsAwardModalOpen] = useState(false);
  const [awardToEdit, setAwardToEdit] = useState<TimelineEventItem | null>(null);
  const [eventToDelete, setEventToDelete] = useState<TimelineEventItem | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isDashboardOpen, setIsDashboardOpen] = useState(true);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const toggleEventExpand = (id: string) => {
    setExpandedEventId((curr) => (curr === id ? null : id));
  };

  const sortedEvents = [...initialEvents].sort(
    (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  );

  // Active current posting (if flagged current, or newest posting)
  const currentEvent =
    sortedEvents.find((e) => e.is_current) ||
    sortedEvents.find((e) => e.event_type === "POSTING");

  const filteredEvents = sortedEvents.filter((ev) => {
    if (filter === "ALL") return true;
    if (filter === "POSTINGS") return ev.event_type === "POSTING";
    if (filter === "TRANSFERS") return ev.event_type === "TRANSFER";
    if (filter === "TRAININGS") return ev.event_type === "TRAINING";
    if (filter === "ACHIEVEMENTS")
      return ev.event_type === "ACHIEVEMENT" || ev.event_type === "PROMOTION";
    return true;
  });

  // Dashboard: pin current posting first, then fill remaining slots with latest events
  const displayEvents = (() => {
    if (variant !== "dashboard") return filteredEvents;
    if (!currentEvent) return filteredEvents.slice(0, maxEvents);
    const rest = filteredEvents.filter((e) => e.id !== currentEvent.id);
    return [currentEvent, ...rest.slice(0, maxEvents - 1)];
  })();

  const handleEdit = (event: TimelineEventItem) => {
    if (event.event_type === "ACHIEVEMENT") {
      setAwardToEdit(event);
      setIsAwardModalOpen(true);
    } else {
      setEventToEdit(event);
      setIsModalOpen(true);
    }
  };

  const handleDeleteConfirm = () => {
    if (!eventToDelete) return;
    startDeleteTransition(async () => {
      await deleteTimelineEventAction(eventToDelete.id);
      setEventToDelete(null);
    });
  };

  // Content for the timeline stream
  const timelineContent = (
    <div className="space-y-4">
      {/* Current Station Beacon (All-in-one current status callout) */}
      {currentEvent && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative flex size-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  Current Posting
                </span>
                {currentEvent.designation && (
                  <span className="text-[11px] font-semibold text-foreground/80">
                    • {currentEvent.designation}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm font-bold text-foreground truncate">
                {currentEvent.title}
                {currentEvent.location && (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    ({currentEvent.location})
                  </span>
                )}
              </p>
            </div>
          </div>
          {currentEvent.start_date && (
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 shrink-0 bg-emerald-500/20 px-2 py-0.5 rounded-md">
              Active
            </span>
          )}
        </div>
      )}

      {/* Filter Tabs (Full / Compact variants) */}
      {variant !== "dashboard" && sortedEvents.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <Filter className="size-3 text-muted-foreground shrink-0 mr-1" />
          {[
            { id: "ALL", label: `All (${sortedEvents.length})` },
            {
              id: "POSTINGS",
              label: `Postings (${
                sortedEvents.filter((e) => e.event_type === "POSTING").length
              })`,
            },
            {
              id: "TRANSFERS",
              label: `Transfers (${
                sortedEvents.filter((e) => e.event_type === "TRANSFER").length
              })`,
            },
            {
              id: "TRAININGS",
              label: `Trainings (${
                sortedEvents.filter((e) => e.event_type === "TRAINING").length
              })`,
            },
            {
              id: "ACHIEVEMENTS",
              label: `Honours (${
                sortedEvents.filter(
                  (e) =>
                    e.event_type === "ACHIEVEMENT" || e.event_type === "PROMOTION"
                ).length
              })`,
            },
          ].map((tab) => {
            const isActive = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id as FilterCategory)}
                className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Timeline Stream */}
      {displayEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-6 text-center rounded-2xl border border-dashed border-border bg-muted/20 space-y-2">
          <div className="size-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Calendar className="size-5" />
          </div>
          <p className="text-xs sm:text-sm font-semibold text-foreground">
            No milestones recorded yet
          </p>
          <p className="text-[11px] text-muted-foreground max-w-xs">
            Record your station postings, transfers, and honours to build your career history.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setEventToEdit(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-[0.98] cursor-pointer mt-1"
            >
              <Plus className="size-3.5" />
              <span>Record First Milestone</span>
            </button>
          )}
        </div>
      ) : (
        <div className="relative pl-5 sm:pl-6 space-y-3 before:absolute before:left-[9px] sm:before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-linear-to-b before:from-indigo-500 before:via-border before:to-transparent">
          {displayEvents.map((event) => {
            const meta = EVENT_TYPE_META[event.event_type] ?? EVENT_TYPE_META.OTHER;
            const IconComponent =
              ICON_MAP[meta.iconName as keyof typeof ICON_MAP] ?? Shield;
            const { dateRange, duration } = formatTimelineSpan(
              event.start_date,
              event.end_date,
              event.is_current
            );
            const isGst =
              event.title.toLowerCase().includes("gst") ||
              event.title.toLowerCase().includes("good service");

            return (
              <div key={event.id} className="relative group">
                {/* Compact Node Dot */}
                <div
                  className={`absolute -left-5 sm:-left-6 top-2 flex size-5 sm:size-5.5 items-center justify-center rounded-full bg-card border ${
                    event.is_current
                      ? "border-emerald-500 ring-3 ring-emerald-500/20"
                      : isGst
                      ? "border-amber-500 ring-2 ring-amber-500/20"
                      : "border-border ring-2 ring-border/50"
                  }`}
                >
                  <div
                    className={`size-1.5 sm:size-2 rounded-full ${
                      event.is_current ? "bg-emerald-500" : meta.dotColor
                    }`}
                  />
                </div>

                {/* Compact Event Card */}
                <div
                  className={`rounded-xl border p-3 sm:p-3.5 transition-all bg-card hover:border-indigo-500/40 hover:shadow-2xs ${
                    event.is_current
                      ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/10"
                      : "border-border/80"
                  }`}
                >
                  {/* Row 1: Header tags & Actions */}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}
                      >
                        <IconComponent className="size-3" />
                        <span>{meta.label}</span>
                      </span>

                      {event.is_current && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[9px] font-bold uppercase tracking-wider">
                          <span className="size-1 rounded-full bg-emerald-500 animate-pulse" />
                          Current
                        </span>
                      )}

                      {isGst && (
                        <span className="px-1.5 py-0.2 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[9px] font-bold uppercase tracking-wider">
                          GST
                        </span>
                      )}
                    </div>

                    {/* Date pill & Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                        {dateRange}
                      </span>

                      {canEdit && (
                        <div className="flex items-center gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity ml-1">
                          <button
                            type="button"
                            title="Edit Milestone"
                            onClick={() => handleEdit(event)}
                            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                          >
                            <Pencil className="size-3" />
                          </button>
                          <button
                            type="button"
                            title="Delete Milestone"
                            onClick={() => setEventToDelete(event)}
                            className="p-1 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Title & Designation */}
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <h4 className="text-xs sm:text-sm font-bold text-foreground tracking-tight">
                      {event.title}
                    </h4>
                    {event.designation && (
                      <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        • {event.designation}
                      </span>
                    )}
                  </div>

                  {/* Transfer Order Inline Banner */}
                  {event.event_type === "TRANSFER" &&
                    (event.from_location || event.to_location) && (
                      <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-xs text-cyan-800 dark:text-cyan-200">
                        <span className="font-semibold truncate max-w-[120px] sm:max-w-[160px]">
                          {event.from_location || "Previous Unit"}
                        </span>
                        <ArrowRight className="size-3 text-cyan-600 dark:text-cyan-400 shrink-0" />
                        <span className="font-bold text-foreground truncate max-w-[120px] sm:max-w-[160px]">
                          {event.to_location || "New Unit"}
                        </span>
                      </div>
                    )}

                  {/* Row 3: Meta (Department, Location, Duration) */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    {duration && (
                      <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
                        <Clock className="size-3 text-muted-foreground" />
                        {duration}
                      </span>
                    )}
                    {event.department && (
                      <span className="inline-flex items-center gap-1 truncate max-w-[180px]">
                        <Building2 className="size-3 text-muted-foreground shrink-0" />
                        {event.department}
                      </span>
                    )}
                    {event.location && event.event_type !== "TRANSFER" && (
                      <span className="inline-flex items-center gap-1 truncate max-w-[180px]">
                        <MapPin className="size-3 text-muted-foreground shrink-0" />
                        {event.location}
                      </span>
                    )}
                  </div>

                  {/* Description preview */}
                  {event.description && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground/85 italic bg-muted/30 rounded-lg px-2.5 py-1 border border-border/40 line-clamp-2">
                      &ldquo;{event.description}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dashboard Footer */}
      {variant === "dashboard" && sortedEvents.length > maxEvents && (
        <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {displayEvents.length} of {sortedEvents.length} milestones
          </span>
          <Link
            href="/profile"
            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            <span>View Full Timeline</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <div className={className}>
      {/* Variant: Dashboard Full-Row Card (Ultra-Compact, Space-Efficient) */}
      {variant === "dashboard" ? (
        <Card className="overflow-hidden border border-border/80 bg-card shadow-xs transition-all p-0">
          {/* Header - Slim & Clean */}
          <div className="flex items-center justify-between gap-3 px-3.5 sm:px-4 py-2 bg-card border-b border-border/60">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                <Clock className="size-3.5" />
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-foreground truncate tracking-tight">
                  Career Timeline
                </h3>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 shrink-0">
                  {sortedEvents.length}
                </span>
                <span className="text-[11px] text-muted-foreground hidden md:inline truncate">
                  Service milestones &amp; postings
                </span>
              </div>
            </div>

            {/* Right: Collapse */}
            <div className="flex items-center shrink-0">
              <button
                type="button"
                onClick={() => setIsDashboardOpen((prev) => !prev)}
                aria-label={isDashboardOpen ? "Collapse timeline" : "Expand timeline"}
                className="size-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <ChevronDown
                  className={`size-3.5 transition-transform duration-200 ${
                    isDashboardOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Body */}
          {isDashboardOpen && (
            <div className="animate-in fade-in-50 duration-150">
              {/* Active Posting Callout - Slim Single Line */}
              {currentEvent && (
                <div className="px-3.5 sm:px-4 py-1.5 bg-emerald-500/10 dark:bg-emerald-500/8 border-b border-emerald-500/20 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="relative flex size-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
                    </span>
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-emerald-700 dark:text-emerald-400 shrink-0">
                      Active
                    </span>
                    <span className="text-[11px] font-bold text-foreground truncate">
                      {currentEvent.title}
                    </span>
                    {(currentEvent.designation || currentEvent.location) && (
                      <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">
                        · {[currentEvent.designation, currentEvent.location].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </div>
                  {currentEvent.start_date && (
                    <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 shrink-0 whitespace-nowrap bg-emerald-500/15 px-1.5 py-0.5 rounded-md">
                      Since {formatTimelineDate(currentEvent.start_date, true)}
                    </span>
                  )}
                </div>
              )}

              {/* Milestone Rows - Ultra-Compact List */}
              {displayEvents.length === 0 ? (
                <div className="px-4 py-4 text-center text-xs text-muted-foreground">
                  No career milestones recorded yet.
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {displayEvents.map((event) => {
                    const meta = EVENT_TYPE_META[event.event_type] ?? EVENT_TYPE_META.OTHER;
                    const IconComponent =
                      ICON_MAP[meta.iconName as keyof typeof ICON_MAP] ?? Shield;
                    const { dateRange, duration } = formatTimelineSpan(
                      event.start_date,
                      event.end_date,
                      event.is_current
                    );
                    const isGst =
                      event.title.toLowerCase().includes("gst") ||
                      event.title.toLowerCase().includes("good service");
                    const is26Jan =
                      event.title.toLowerCase().includes("26 jan") ||
                      event.title.toLowerCase().includes("republic");
                    const is15Aug =
                      event.title.toLowerCase().includes("15 aug") ||
                      event.title.toLowerCase().includes("independence");
                    const isEkta =
                      event.title.toLowerCase().includes("ekta") ||
                      event.title.toLowerCase().includes("31 oct");
                    const isParade = event.title.toLowerCase().includes("parade");
                    const isExpanded = expandedEventId === event.id;

                    return (
                      <div
                        key={event.id}
                        className={`transition-colors ${
                          isExpanded ? "bg-muted/20" : ""
                        }`}
                      >
                        {/* Compact Row */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleEventExpand(event.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleEventExpand(event.id);
                            }
                          }}
                          className="group flex items-center justify-between gap-2.5 px-3.5 sm:px-4 py-2 hover:bg-muted/40 cursor-pointer select-none"
                        >
                          {/* Left: Icon + Type Badge + Title + Subtext */}
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className={`size-6 rounded-md flex items-center justify-center shrink-0 ${
                                event.is_current
                                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                  : isGst
                                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                  : event.event_type === "TRANSFER"
                                  ? "bg-cyan-500/12 text-cyan-600 dark:text-cyan-400"
                                  : event.event_type === "TRAINING"
                                  ? "bg-violet-500/12 text-violet-600 dark:text-violet-400"
                                  : event.event_type === "JOINING"
                                  ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                                  : "bg-indigo-500/12 text-indigo-600 dark:text-indigo-400"
                              }`}
                            >
                              <IconComponent className="size-3" />
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.2 rounded-[4px] text-[8.5px] font-extrabold uppercase tracking-wide border shrink-0 ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}
                              >
                                {meta.label}
                              </span>

                              {isGst && (
                                <span className="px-1.5 py-0.2 rounded-[4px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[8.5px] font-extrabold uppercase shrink-0">
                                  GST
                                </span>
                              )}

                              {is26Jan && (
                                <span className="px-1.5 py-0.2 rounded-[4px] bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30 text-[8.5px] font-extrabold uppercase shrink-0">
                                  26 Jan
                                </span>
                              )}

                              {is15Aug && (
                                <span className="px-1.5 py-0.2 rounded-[4px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[8.5px] font-extrabold uppercase shrink-0">
                                  15 Aug
                                </span>
                              )}

                              {isEkta && (
                                <span className="px-1.5 py-0.2 rounded-[4px] bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 text-[8.5px] font-extrabold uppercase shrink-0">
                                  Ekta Diwas
                                </span>
                              )}

                              {isParade && (
                                <span className="px-1.5 py-0.2 rounded-[4px] bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 text-[8.5px] font-extrabold uppercase shrink-0">
                                  Parade
                                </span>
                              )}

                              <span className="text-xs font-semibold text-foreground truncate max-w-[140px] sm:max-w-[200px] md:max-w-xs leading-tight">
                                {event.title}
                              </span>

                              {/* Transfer route or location inline */}
                              {event.event_type === "TRANSFER" &&
                              (event.from_location || event.to_location) ? (
                                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium truncate max-w-[180px]">
                                  <span>{event.from_location || "Prev"}</span>
                                  <ArrowRight className="size-2.5 text-cyan-500 shrink-0" />
                                  <span className="font-semibold text-foreground">
                                    {event.to_location || "New"}
                                  </span>
                                </span>
                              ) : (
                                (event.designation || event.location) && (
                                  <span className="hidden sm:inline text-[11px] text-muted-foreground truncate max-w-[180px]">
                                    · {[event.designation, event.location].filter(Boolean).join(" · ")}
                                  </span>
                                )
                              )}
                            </div>
                          </div>

                          {/* Right: Date + duration + chevron */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[11px] text-muted-foreground whitespace-nowrap tabular-nums font-medium">
                              {dateRange}
                            </span>
                            {duration && (
                              <span className="hidden md:inline text-[10px] text-muted-foreground/80 bg-muted px-1.5 py-0.5 rounded">
                                {duration}
                              </span>
                            )}
                            <div
                              className={`size-4 rounded flex items-center justify-center text-muted-foreground/60 transition-transform duration-200 ${
                                isExpanded ? "rotate-180 text-foreground" : ""
                              }`}
                            >
                              <ChevronDown className="size-3" />
                            </div>
                          </div>
                        </div>

                        {/* Expanded Drawer (Compact) */}
                        {isExpanded && (
                          <div className="mx-3.5 sm:mx-4 mb-2 p-2 rounded-lg bg-muted/40 border border-border/50 text-xs space-y-1.5 animate-in fade-in-50 duration-150">
                            {event.description && (
                              <p className="text-[11px] text-muted-foreground italic bg-background/60 p-2 rounded border border-border/40">
                                &ldquo;{event.description}&rdquo;
                              </p>
                            )}

                            <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap">
                              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-muted-foreground">
                                {event.department && (
                                  <span className="inline-flex items-center gap-1">
                                    <Building2 className="size-2.5" />
                                    {event.department}
                                  </span>
                                )}
                                {duration && (
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="size-2.5" />
                                    {duration}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Footer - Slim & Read-only */}
              <div className="px-3.5 sm:px-4 py-1.5 border-t border-border/50 bg-muted/20 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">
                  {displayEvents.length} of {sortedEvents.length} milestones
                </span>
                <Link
                  href="/profile"
                  className="inline-flex items-center gap-0.5 font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <span>View all</span>
                  <ArrowRight className="size-2.5" />
                </Link>
              </div>
            </div>
          )}
        </Card>
      ) : (
        // Variant: Full / Standard Profile View
        <div className="space-y-4">
          {showHeader && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/80">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-foreground">
                  Job &amp; Service Career Timeline
                </h3>
                <p className="text-xs text-muted-foreground">
                  Chronological record of induction, academy training, station postings, and transfers.
                </p>
              </div>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    if (filter === "ACHIEVEMENTS") {
                      setAwardToEdit(null);
                      setIsAwardModalOpen(true);
                    } else {
                      setEventToEdit(null);
                      setIsModalOpen(true);
                    }
                  }}
                  className="self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
                >
                  <Plus className="size-4" />
                  <span>
                    {filter === "ACHIEVEMENTS" ? "Add Honour / Award" : "Add Milestone"}
                  </span>
                </button>
              )}
            </div>
          )}

          {timelineContent}
        </div>
      )}

      {/* Add / Edit Milestone Modal */}
      <TimelineEventModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEventToEdit(null);
        }}
        eventToEdit={eventToEdit}
      />

      {/* Dedicated Award Modal for Honours & Awards */}
      <AwardModal
        isOpen={isAwardModalOpen}
        onClose={() => {
          setIsAwardModalOpen(false);
          setAwardToEdit(null);
        }}
        eventToEdit={awardToEdit}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(eventToDelete)}
        onClose={() => setEventToDelete(null)}
        onConfirm={handleDeleteConfirm}
        isPending={isDeleting}
        title="Delete Career Milestone?"
        description={`Are you sure you want to delete "${eventToDelete?.title}" from your timeline? This action cannot be undone.`}
        confirmLabel="Delete Milestone"
      />
    </div>
  );
}
