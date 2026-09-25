import { describe, it, expect } from "vitest";
import { isEmptyReportCell, formatReportCell } from "./reportCells";

describe("isEmptyReportCell", () => {
  it("treats a numeric zero as empty", () => {
    // The point of the rule: a duty with no travel carries ta_amount 0, and
    // "TA ₹0" on every office shift is noise on a phone.
    expect(isEmptyReportCell(0)).toBe(true);
  });

  it("keeps a real amount", () => {
    expect(isEmptyReportCell(400)).toBe(false);
  });

  it("keeps a negative number, which is data and not an absence", () => {
    expect(isEmptyReportCell(-50)).toBe(false);
  });

  it("treats null, undefined and blank text as empty", () => {
    expect(isEmptyReportCell(null)).toBe(true);
    expect(isEmptyReportCell(undefined as unknown as null)).toBe(true);
    expect(isEmptyReportCell("")).toBe(true);
  });

  it("keeps the string \"0\", which is a value someone typed", () => {
    expect(isEmptyReportCell("0")).toBe(false);
  });
});

describe("formatReportCell", () => {
  it("currency-formats TA and holiday pay", () => {
    expect(formatReportCell({ key: "ta_amount", label: "TA" }, 400)).toContain("400");
    expect(
      formatReportCell({ key: "holiday_allowance", label: "Holiday Pay" }, 250),
    ).toContain("250");
  });

  it("renders an em dash for a missing value", () => {
    expect(formatReportCell({ key: "location", label: "Location" }, null)).toBe("—");
  });

  it("renders shift_time string properly", () => {
    expect(
      formatReportCell({ key: "shift_time", label: "Time", badge: "time" }, "09:00 - 18:00"),
    ).toBe("09:00 - 18:00");
  });

  it("formats distance with km suffix", () => {
    expect(
      formatReportCell({ key: "ta_distance_km", label: "Distance", badge: "distance" }, 90),
    ).toBe("90 km");
    expect(
      formatReportCell({ key: "ta_distance_km", label: "Distance", badge: "distance" }, 0),
    ).toBe("—");
  });
});
