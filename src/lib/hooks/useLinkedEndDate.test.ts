import { describe, it, expect } from "vitest";
import { deriveDutyEnd, deriveLeaveEnd } from "./useLinkedEndDate";

describe("deriveDutyEnd", () => {
  it("keeps the start's day and applies the configured shift end", () => {
    expect(deriveDutyEnd("18:00")("2026-09-08T10:00")).toBe("2026-09-08T18:00");
  });

  it("honours a non-default shift end", () => {
    expect(deriveDutyEnd("22:30")("2026-09-08T14:00")).toBe("2026-09-08T22:30");
  });

  it("returns nothing for an empty start, so the field is left alone", () => {
    expect(deriveDutyEnd("18:00")("")).toBe("");
  });

  // A shift end at or before the start's time means the shift runs past
  // midnight. Pinning it to the start's own day produced an end BEFORE the
  // start, which the form then rejected as the officer's mistake.
  it("rolls to the next day when the shift ends past midnight", () => {
    expect(deriveDutyEnd("06:00")("2026-09-08T22:00")).toBe("2026-09-09T06:00");
  });

  it("treats an end equal to the start as overnight, not zero-length", () => {
    expect(deriveDutyEnd("18:00")("2026-09-08T18:00")).toBe("2026-09-09T18:00");
  });

  it("rolls across a month boundary", () => {
    expect(deriveDutyEnd("06:00")("2026-09-30T22:00")).toBe("2026-10-01T06:00");
  });

  it("rolls across a year boundary", () => {
    expect(deriveDutyEnd("06:00")("2026-12-31T22:00")).toBe("2027-01-01T06:00");
  });

  it("rolls onto a leap day", () => {
    expect(deriveDutyEnd("06:00")("2028-02-28T22:00")).toBe("2028-02-29T06:00");
  });

  it("falls back to the same day when the start carries no time", () => {
    expect(deriveDutyEnd("18:00")("2026-09-08")).toBe("2026-09-08T18:00");
  });
});

describe("deriveLeaveEnd", () => {
  it("mirrors the start date", () => {
    expect(deriveLeaveEnd("2026-09-08")).toBe("2026-09-08");
  });
});
