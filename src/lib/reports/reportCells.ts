/**
 * Report cell shape and rendering rules.
 *
 * Separate from buildMonthlyReport because that module reaches the database
 * and so pulls in `server-only`, which cannot be imported by a test or a
 * client component. These are pure, and both of those need them.
 */
import { formatCurrency } from "@/lib/format/currency";

export type ColumnDef = {
  key: string;
  label: string;
  /** Right-aligned in the table; unchanged in the CSV. */
  numeric?: boolean;
  /**
   * Rendered as a coloured Badge in the table and the mobile card list;
   * unchanged in the CSV, which wants the plain value for a spreadsheet.
   *
   * A per-row "Duty"/"Leave" tag would say nothing here -- the report type is
   * a filter, so every row in one render is the same kind. These mark the
   * fields that actually vary between rows.
   */
  badge?: "status" | "dayType" | "leaveType" | "ta" | "time" | "holiday" | "distance";
  /**
   * Another key on the same row holding a hex colour for this cell's badge.
   * A rendering hint exactly like `badge` and `numeric`: the CSV export
   * shares this model and must not gain a colour column.
   */
  colorKey?: string;
};

/**
 * Whether a cell has nothing worth showing.
 *
 * Numeric zero counts as empty: a duty with no travel carries `ta_amount: 0`,
 * and a row reading "TA ₹0" is noise on a phone where every line costs
 * height. The desktop table still prints every column, because a table with
 * gaps in it is harder to read than one with dashes.
 */
export function isEmptyReportCell(value: string | number | null): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (typeof value === "number") return value === 0;
  return false;
}

export function formatReportCell(
  column: ColumnDef,
  value: string | number | null,
): string {
  if (value === null || value === undefined || value === "") return "—";
  if (column.key === "ta_amount" || column.key === "holiday_allowance") {
    return formatCurrency(Number(value));
  }
  if (column.key === "ta_distance_km") {
    const km = Number(value);
    if (!km) return "—";
    return `${km.toLocaleString()} km`;
  }
  return String(value);
}
