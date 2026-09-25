import type { OfficerTimelineEventType } from "@/types/database";

export interface TimelineEventMeta {
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  ringColor: string;
  dotColor: string;
  iconName: string;
}

export const EVENT_TYPE_META: Record<OfficerTimelineEventType, TimelineEventMeta> = {
  JOINING: {
    label: "Service Joining",
    badgeBg: "bg-emerald-500/10 dark:bg-emerald-500/15",
    badgeText: "text-emerald-700 dark:text-emerald-300",
    badgeBorder: "border-emerald-500/30",
    ringColor: "ring-emerald-500/20",
    dotColor: "bg-emerald-500",
    iconName: "Shield",
  },
  TRAINING: {
    label: "Training & Academy",
    badgeBg: "bg-amber-500/10 dark:bg-amber-500/15",
    badgeText: "text-amber-700 dark:text-amber-300",
    badgeBorder: "border-amber-500/30",
    ringColor: "ring-amber-500/20",
    dotColor: "bg-amber-500",
    iconName: "GraduationCap",
  },
  POSTING: {
    label: "Station Posting",
    badgeBg: "bg-indigo-500/10 dark:bg-indigo-500/15",
    badgeText: "text-indigo-700 dark:text-indigo-300",
    badgeBorder: "border-indigo-500/30",
    ringColor: "ring-indigo-500/20",
    dotColor: "bg-indigo-500",
    iconName: "Building2",
  },
  TRANSFER: {
    label: "Transfer Order",
    badgeBg: "bg-cyan-500/10 dark:bg-cyan-500/15",
    badgeText: "text-cyan-700 dark:text-cyan-300",
    badgeBorder: "border-cyan-500/30",
    ringColor: "ring-cyan-500/20",
    dotColor: "bg-cyan-500",
    iconName: "ArrowRightLeft",
  },
  PROMOTION: {
    label: "Promotion",
    badgeBg: "bg-violet-500/10 dark:bg-violet-500/15",
    badgeText: "text-violet-700 dark:text-violet-300",
    badgeBorder: "border-violet-500/30",
    ringColor: "ring-violet-500/20",
    dotColor: "bg-violet-500",
    iconName: "Award",
  },
  SPECIAL_DUTY: {
    label: "Special Duty",
    badgeBg: "bg-rose-500/10 dark:bg-rose-500/15",
    badgeText: "text-rose-700 dark:text-rose-300",
    badgeBorder: "border-rose-500/30",
    ringColor: "ring-rose-500/20",
    dotColor: "bg-rose-500",
    iconName: "Flame",
  },
  ACHIEVEMENT: {
    label: "Commendation & Award",
    badgeBg: "bg-amber-500/15 dark:bg-amber-400/20",
    badgeText: "text-amber-800 dark:text-amber-200",
    badgeBorder: "border-amber-500/40",
    ringColor: "ring-amber-500/30",
    dotColor: "bg-amber-400",
    iconName: "Trophy",
  },
  OTHER: {
    label: "Milestone",
    badgeBg: "bg-slate-500/10 dark:bg-slate-500/15",
    badgeText: "text-slate-700 dark:text-slate-300",
    badgeBorder: "border-slate-500/30",
    ringColor: "ring-slate-500/20",
    dotColor: "bg-slate-500",
    iconName: "Bookmark",
  },
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export function formatTimelineDate(dateStr: string, includeDay = false): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-").map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return dateStr;
  }
  const [year, month, day] = parts;
  const monthName = MONTHS[month - 1] ?? "";
  if (includeDay) {
    return `${monthName} ${day}, ${year}`;
  }
  return `${monthName} ${year}`;
}

export function calculateTimelineDuration(
  startDateStr: string,
  endDateStr: string | null | undefined,
  isCurrent: boolean
): string {
  if (!startDateStr) return "";
  const start = new Date(startDateStr);
  const end = isCurrent || !endDateStr ? new Date() : new Date(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
    return "";
  }

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();

  if (end.getDate() < start.getDate()) {
    months -= 1;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years <= 0 && months <= 0) {
    return "< 1 mo";
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? "yr" : "yrs"}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? "mo" : "mos"}`);

  return parts.join(" ");
}

export function formatTimelineSpan(
  startDateStr: string,
  endDateStr: string | null | undefined,
  isCurrent: boolean
): { dateRange: string; duration: string } {
  const start = formatTimelineDate(startDateStr, true);
  let end = "";
  if (isCurrent) {
    end = "Present";
  } else if (endDateStr) {
    end = formatTimelineDate(endDateStr, true);
  }

  const dateRange = end ? `${start} – ${end}` : start;
  const duration = calculateTimelineDuration(startDateStr, endDateStr, isCurrent);

  return { dateRange, duration };
}
