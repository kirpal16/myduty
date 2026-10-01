import { describe, it, expect } from "vitest";
import { formatCurrency } from "./currency";
import { localInputToISO, isoToLocalInput, toDateKey } from "./datetime";

describe("formatCurrency", () => {
  it("renders rupees, never dollars", () => {
    const out = formatCurrency(1500);
    expect(out).toContain("₹");
    expect(out).not.toContain("$");
  });

  it("groups in the Indian system (lakh/crore)", () => {
    // en-IN groups as 1,50,000 rather than 150,000.
    expect(formatCurrency(150000).replace(/[^\d,]/g, "")).toBe("1,50,000");
  });

  it("treats null, undefined and NaN as zero rather than printing NaN", () => {
    for (const v of [null, undefined, NaN, "abc"]) {
      expect(formatCurrency(v as never)).toBe(formatCurrency(0));
    }
  });

  it("accepts numeric strings, which is what Postgres numeric returns", () => {
    expect(formatCurrency("250.5")).toBe(formatCurrency(250.5));
  });

  it("keeps at most two decimals", () => {
    expect(formatCurrency(10.999)).toBe(formatCurrency(11));
  });
});

describe("localInputToISO / isoToLocalInput", () => {
  it("round-trips a datetime-local value", () => {
    const input = "2026-09-08T18:00";
    expect(isoToLocalInput(localInputToISO(input))).toBe(input);
  });

  it("preserves the wall-clock the officer typed", () => {
    // The whole bug: 18:00 entered must still read back as 18:00 locally,
    // whatever the offset, rather than being reinterpreted as 18:00 UTC.
    const iso = localInputToISO("2026-09-08T18:00");
    const back = new Date(iso);
    expect(back.getUTCHours()).toBe(18);
    expect(back.getUTCDate()).toBe(8);
  });

  it("produces an instant with an explicit offset", () => {
    expect(localInputToISO("2026-09-08T18:00")).toMatch(/Z$/);
  });

  it("round-trips across a range of wall-clock times", () => {
    for (const t of ["00:00", "06:30", "12:00", "18:45", "23:59"]) {
      const input = `2026-09-08T${t}`;
      expect(isoToLocalInput(localInputToISO(input))).toBe(input);
    }
  });

  it("rejects an unparseable value rather than storing a bad instant", () => {
    expect(() => localInputToISO("not-a-date")).toThrow();
  });

  it("isoToLocalInput returns an empty string for an invalid instant", () => {
    expect(isoToLocalInput("nope")).toBe("");
  });
});

describe("toDateKey", () => {
  it("uses the local calendar day, not the UTC one", () => {
    // Late-evening local time is already the next day in UTC; the key must
    // still be the officer's day, or duties land on the wrong calendar cell.
    const d = new Date(2026, 8, 8, 23, 30);
    expect(toDateKey(d)).toBe("2026-09-08");
  });

  it("zero-pads month and day", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
