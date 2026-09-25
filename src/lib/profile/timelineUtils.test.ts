import { describe, it, expect } from "vitest";
import {
  formatTimelineDate,
  calculateTimelineDuration,
  formatTimelineSpan,
  EVENT_TYPE_META,
} from "./timelineUtils";

describe("timelineUtils", () => {
  it("formats dates into readable format", () => {
    expect(formatTimelineDate("2023-05-15", true)).toBe("May 15, 2023");
    expect(formatTimelineDate("2023-05-15", false)).toBe("May 2023");
    expect(formatTimelineDate("invalid")).toBe("invalid");
  });

  it("calculates durations accurately", () => {
    expect(calculateTimelineDuration("2020-01-01", "2022-01-01", false)).toBe("2 yrs");
    expect(calculateTimelineDuration("2020-01-01", "2021-07-01", false)).toBe("1 yr 6 mos");
    expect(calculateTimelineDuration("2020-01-01", "2020-05-01", false)).toBe("4 mos");
    expect(calculateTimelineDuration("2020-01-01", "2020-01-10", false)).toBe("< 1 mo");
  });

  it("formats timeline date spans with present status", () => {
    const span = formatTimelineSpan("2020-01-01", null, true);
    expect(span.dateRange).toContain("Jan 1, 2020 – Present");
    expect(span.duration.length).toBeGreaterThan(0);

    const closedSpan = formatTimelineSpan("2021-02-10", "2022-08-20", false);
    expect(closedSpan.dateRange).toBe("Feb 10, 2021 – Aug 20, 2022");
    expect(closedSpan.duration).toBe("1 yr 6 mos");
  });

  it("provides metadata for all event types", () => {
    expect(EVENT_TYPE_META.JOINING.label).toBe("Service Joining");
    expect(EVENT_TYPE_META.TRAINING.label).toBe("Training & Academy");
    expect(EVENT_TYPE_META.POSTING.label).toBe("Station Posting");
    expect(EVENT_TYPE_META.TRANSFER.label).toBe("Transfer Order");
    expect(EVENT_TYPE_META.PROMOTION.label).toBe("Promotion");
    expect(EVENT_TYPE_META.SPECIAL_DUTY.label).toBe("Special Duty");
    expect(EVENT_TYPE_META.ACHIEVEMENT.label).toBe("Commendation & Award");
  });
});
