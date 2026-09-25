/**
 * Chart colours.
 *
 * Recharts renders SVG, which cannot read Tailwind utility classes, so these
 * are literal hexes rather than tokens. They are the same mid-tone values the
 * rest of the app uses, chosen to stay legible on both the light and dark
 * card backgrounds without needing a per-theme swap.
 */
export const CHART_SERIES = [
  "#6366f1", // indigo
  "#0ea5e9", // sky
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#14b8a6", // teal
  "#f97316", // orange
] as const;

/** Working vs holiday, matching the badge colours used in the duty log. */
export const WORKING_COLOR = "#6366f1";
export const HOLIDAY_COLOR = "#f59e0b";

export function seriesColor(index: number): string {
  return CHART_SERIES[index % CHART_SERIES.length];
}

/**
 * Axis, grid and tooltip chrome. Recharts needs concrete values, and
 * `currentColor` is not honoured for most of them, so these use alpha over
 * whatever the card sits on — which reads correctly in both themes.
 */
export const CHART_CHROME = {
  grid: "rgba(148, 163, 184, 0.25)",
  axis: "rgba(148, 163, 184, 0.9)",
  tooltipBg: "var(--color-card, #fff)",
  tooltipBorder: "rgba(148, 163, 184, 0.35)",
} as const;
