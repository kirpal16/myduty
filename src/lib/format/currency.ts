/**
 * One place currency is rendered. Before this, `$` and `₹` were hardcoded
 * inline and the SAME ta_amount rendered with two different symbols on
 * adjacent screens (the duty log showed `$`, the dashboard KPI `₹`).
 *
 * The app is Rupee-only; there is no per-user currency setting, so this takes
 * no locale argument on purpose — adding one later is a single edit here.
 */
const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n == null || Number.isNaN(n)) return INR.format(0);
  return INR.format(n);
}

/** The bare symbol, for input adornments and column headers. */
export const CURRENCY_SYMBOL = "₹";
