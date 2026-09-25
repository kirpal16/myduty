/**
 * Carry-forward arithmetic.
 *
 * Unused leave rolls into the next year, up to a ceiling that differs per
 * officer and per leave type. The rules live here as pure functions rather
 * than only in `leave_balance_view`, because SQL in this project cannot be
 * exercised without a database — and these are the numbers an officer plans
 * their year around.
 *
 * The database view must implement exactly these rules. Where the two could
 * drift, this file is the specification.
 */

/** The carry-forward rule for one officer and one leave type. */
export type CarryRule = {
  carryForward: boolean;
  /**
   * Maximum accumulated balance available in a year: the year's allocation
   * plus the carried-in balance cannot exceed this value.
   *
   * `null` means NO maximum — not "cap at the annual allocation". 60 granted
   * on top of 60 carried is 120, not 60.
   */
  maxAccumulated: number | null;
};

export const NO_CARRY: CarryRule = { carryForward: false, maxAccumulated: null };

export type YearInput = {
  /** Days granted for this year. */
  allocated: number;
  /** Days taken this year. */
  used: number;
  /**
   * A hand-entered carried-in figure for THIS year only, or null to use the
   * computed one. Null and 0 are different: 0 is a deliberate "nothing
   * carried", null means "work it out".
   */
  carriedOverride?: number | null;
};

export type YearBalance = {
  /** What actually carried in, after the override, the rule and the cap. */
  carriedIn: number;
  allocated: number;
  /** allocation + carriedIn, before the cap — what the officer would have had. */
  totalBeforeCap: number;
  /** What they actually have: capped when a maximum is set. */
  totalAvailable: number;
  used: number;
  /** May be negative: over-use is displayed, never prevented. */
  remaining: number;
  /** True when the cap actually bit, so the UI can say days were lost. */
  cappedAway: number;
};

/**
 * One year's balance, given what carried in from the year before.
 *
 * `previousRemaining` is the prior year's `remaining`, which may be negative
 * — an officer can log more leave than they hold. Only a positive remainder
 * carries, so a deficit in one year does not silently eat the next year's
 * grant.
 */
export function resolveYear(
  year: YearInput,
  rule: CarryRule,
  previousRemaining: number,
): YearBalance {
  const computed = Math.max(previousRemaining, 0);

  // Order matters. Switching carry forward off must stop the carry outright,
  // whatever a stored override says — otherwise the switch does not do the
  // one thing it exists to do. An override is inert data while the rule is
  // off, and applies again to its own year if the rule is switched back on.
  const carriedIn = !rule.carryForward
    ? 0
    : (year.carriedOverride ?? computed);

  const totalBeforeCap = year.allocated + carriedIn;
  const totalAvailable =
    rule.maxAccumulated === null
      ? totalBeforeCap
      : Math.min(totalBeforeCap, rule.maxAccumulated);

  return {
    carriedIn,
    allocated: year.allocated,
    totalBeforeCap,
    totalAvailable,
    used: year.used,
    remaining: totalAvailable - year.used,
    cappedAway: totalBeforeCap - totalAvailable,
  };
}

/**
 * A run of consecutive years, oldest first.
 *
 * Each year's opening balance comes from the year before, so this has to walk
 * forward rather than resolve years independently. The first year carries in
 * nothing: the balance view only knows a fixed window of years, and anything
 * banked before it is invisible.
 */
export function resolveYears(
  years: YearInput[],
  rule: CarryRule,
): YearBalance[] {
  const out: YearBalance[] = [];
  let previousRemaining = 0;

  for (const year of years) {
    const balance = resolveYear(year, rule, previousRemaining);
    out.push(balance);
    // Chain on what actually happened, including any override — resolving the
    // next year from the computed figure instead would make an override
    // visible for its own year and then vanish from every year after it.
    previousRemaining = balance.remaining;
  }

  return out;
}

/**
 * Days that will not survive 31 December.
 *
 * Drives the October-to-December warning. `nextYearAllocation` is next year's
 * stored grant when that row exists, otherwise this year's as an estimate —
 * the caller must say so in the wording, because a guess presented as a fact
 * is worse than saying nothing.
 */
export function daysAtRisk({
  remaining,
  allocated,
  rule,
  nextYearAllocation,
}: {
  remaining: number;
  allocated: number;
  rule: CarryRule;
  nextYearAllocation?: number | null;
}): number {
  // A negative balance risks nothing — there is nothing there to lose.
  const surplus = Math.max(remaining, 0);

  if (!rule.carryForward) return surplus;
  if (rule.maxAccumulated === null) return 0;

  const nextAllocation = nextYearAllocation ?? allocated;
  const overflow = surplus + nextAllocation - rule.maxAccumulated;

  // The clamp is not decoration. With 10 days surplus, a 200-day grant next
  // year and a 100 cap, the raw figure is 110 — but the officer can only lose
  // the 10 days they actually hold; the rest is a grant that never existed.
  return Math.min(surplus, Math.max(0, overflow));
}
