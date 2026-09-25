import { describe, it, expect } from "vitest";
import {
  resolveYear,
  resolveYears,
  daysAtRisk,
  NO_CARRY,
  type CarryRule,
} from "./carryForward";

const carry = (maxAccumulated: number | null): CarryRule => ({
  carryForward: true,
  maxAccumulated,
});

/**
 * The four rows of the agreed worked example: an officer granted 60 days a
 * year who used none in the first year, and is granted 60 again.
 */
describe("resolveYear — the worked example", () => {
  const previousRemaining = 60;
  const thisYear = { allocated: 60, used: 0 };

  it("carries nothing when carry forward is off", () => {
    const r = resolveYear(thisYear, NO_CARRY, previousRemaining);
    expect(r.carriedIn).toBe(0);
    expect(r.totalAvailable).toBe(60);
  });

  it("caps at the maximum accumulated balance, losing the excess", () => {
    const r = resolveYear(thisYear, carry(100), previousRemaining);
    expect(r.totalBeforeCap).toBe(120);
    expect(r.totalAvailable).toBe(100);
    expect(r.cappedAway).toBe(20);
  });

  it("leaves a generous cap untouched", () => {
    const r = resolveYear(thisYear, carry(300), previousRemaining);
    expect(r.totalAvailable).toBe(120);
    expect(r.cappedAway).toBe(0);
  });

  it("does NOT fall back to the annual grant when there is no cap", () => {
    // The trap: an absent maximum means no ceiling, so this is 120 — not 60.
    const r = resolveYear(thisYear, carry(null), previousRemaining);
    expect(r.totalAvailable).toBe(120);
  });
});

describe("resolveYear — edges", () => {
  it("carries nothing when the rule is off, however large the balance", () => {
    const r = resolveYear({ allocated: 30, used: 0 }, NO_CARRY, 500);
    expect(r.carriedIn).toBe(0);
    expect(r.totalAvailable).toBe(30);
  });

  it("does not carry a deficit forward as a debt", () => {
    const r = resolveYear({ allocated: 30, used: 0 }, carry(null), -12);
    expect(r.carriedIn).toBe(0);
    expect(r.remaining).toBe(30);
  });

  it("honours a zero cap", () => {
    const r = resolveYear({ allocated: 30, used: 0 }, carry(0), 40);
    expect(r.totalAvailable).toBe(0);
    expect(r.cappedAway).toBe(70);
  });

  it("reports a negative remaining rather than clamping it", () => {
    // Over-use is displayed, never prevented.
    const r = resolveYear({ allocated: 10, used: 15 }, NO_CARRY, 0);
    expect(r.remaining).toBe(-5);
  });
});

describe("resolveYear — the per-year override", () => {
  it("uses the override in place of the computed figure", () => {
    const r = resolveYear(
      { allocated: 30, used: 0, carriedOverride: 12 },
      carry(null),
      10,
    );
    expect(r.carriedIn).toBe(12);
    expect(r.totalAvailable).toBe(42);
  });

  it("treats an override of 0 differently from no override", () => {
    const withZero = resolveYear(
      { allocated: 30, used: 0, carriedOverride: 0 },
      carry(null),
      10,
    );
    const withNull = resolveYear(
      { allocated: 30, used: 0, carriedOverride: null },
      carry(null),
      10,
    );
    expect(withZero.carriedIn).toBe(0);
    expect(withNull.carriedIn).toBe(10);
  });

  it("still caps an override", () => {
    const r = resolveYear(
      { allocated: 30, used: 0, carriedOverride: 500 },
      carry(100),
      10,
    );
    expect(r.totalAvailable).toBe(100);
    expect(r.cappedAway).toBe(430);
  });

  it("ignores an override entirely when carry forward is off", () => {
    // Switching the rule off must stop the carry outright — an override is
    // not an escape hatch around it.
    const r = resolveYear(
      { allocated: 30, used: 0, carriedOverride: 99 },
      NO_CARRY,
      50,
    );
    expect(r.carriedIn).toBe(0);
    expect(r.totalAvailable).toBe(30);
  });
});

describe("resolveYears — chaining", () => {
  it("walks three years, each opening from the one before", () => {
    const years = [
      { allocated: 30, used: 10 }, // remaining 20
      { allocated: 30, used: 0 }, //  20 in -> 50
      { allocated: 30, used: 5 }, //  50 in -> 80, used 5 -> 75
    ];
    const [a, b, c] = resolveYears(years, carry(null));

    expect(a.carriedIn).toBe(0); // the window's first year opens at zero
    expect(a.remaining).toBe(20);
    expect(b.carriedIn).toBe(20);
    expect(b.remaining).toBe(50);
    expect(c.carriedIn).toBe(50);
    expect(c.remaining).toBe(75);
  });

  it("applies the cap at every step, not only the last", () => {
    const years = [
      { allocated: 60, used: 0 },
      { allocated: 60, used: 0 },
      { allocated: 60, used: 0 },
    ];
    const [, b, c] = resolveYears(years, carry(100));

    expect(b.totalAvailable).toBe(100); // 60 + 60 capped
    expect(c.carriedIn).toBe(100); // and the cap carries, not the 120
    expect(c.totalAvailable).toBe(100);
  });

  it("an override in one year does not change what later years compute", () => {
    const base = [
      { allocated: 30, used: 0 },
      { allocated: 30, used: 0 },
      { allocated: 30, used: 0 },
    ];
    const overridden = [
      { allocated: 30, used: 0 },
      { allocated: 30, used: 0, carriedOverride: 5 },
      { allocated: 30, used: 0 },
    ];

    const plain = resolveYears(base, carry(null));
    const edited = resolveYears(overridden, carry(null));

    // Year 2's own figure is the typed one...
    expect(plain[1].carriedIn).toBe(30);
    expect(edited[1].carriedIn).toBe(5);

    // ...and year 3 follows from year 2's real balance, with no override of
    // its own — the correction does not propagate as a stored baseline.
    expect(edited[2].carriedIn).toBe(edited[1].remaining);
    expect(edited[2].carriedIn).toBe(35);
    expect(plain[2].carriedIn).toBe(60);
  });

  it("returns an empty run for no years", () => {
    expect(resolveYears([], carry(null))).toEqual([]);
  });
});

describe("daysAtRisk", () => {
  it("risks the whole surplus when carry forward is off", () => {
    expect(
      daysAtRisk({ remaining: 12, allocated: 30, rule: NO_CARRY }),
    ).toBe(12);
  });

  it("risks nothing when carrying forward with no cap", () => {
    expect(
      daysAtRisk({ remaining: 12, allocated: 30, rule: carry(null) }),
    ).toBe(0);
  });

  it("matches the worked example: 60 remaining, 60 expected, cap 100 -> 20", () => {
    expect(
      daysAtRisk({ remaining: 60, allocated: 60, rule: carry(100) }),
    ).toBe(20);
  });

  it("risks nothing when a capped type still has room", () => {
    expect(
      daysAtRisk({ remaining: 10, allocated: 30, rule: carry(300) }),
    ).toBe(0);
  });

  it("risks nothing on a negative balance", () => {
    expect(
      daysAtRisk({ remaining: -5, allocated: 30, rule: NO_CARRY }),
    ).toBe(0);
  });

  it("never reports more days than the officer holds", () => {
    // Next year's grant alone blows the cap; only the 10 held days can be lost.
    expect(
      daysAtRisk({
        remaining: 10,
        allocated: 30,
        rule: carry(100),
        nextYearAllocation: 200,
      }),
    ).toBe(10);
  });

  it("prefers next year's stored grant over this year's estimate", () => {
    const estimated = daysAtRisk({
      remaining: 60,
      allocated: 60,
      rule: carry(100),
    });
    const known = daysAtRisk({
      remaining: 60,
      allocated: 60,
      rule: carry(100),
      nextYearAllocation: 20,
    });
    expect(estimated).toBe(20);
    expect(known).toBe(0);
  });
});
