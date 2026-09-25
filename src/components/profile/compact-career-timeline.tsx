"use client";

import { OfficerTimeline, type OfficerTimelineProps } from "./officer-timeline";

/**
 * Compact Career Timeline Widget
 * Designed for use on Dashboards, Overview cards, and any compact layout.
 */
export function CompactCareerTimeline(props: OfficerTimelineProps) {
  return <OfficerTimeline variant="dashboard" maxEvents={4} {...props} />;
}

export type { TimelineEventItem } from "./timeline-event-modal";
export { OfficerTimeline };
