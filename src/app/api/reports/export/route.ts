import { NextRequest, NextResponse } from "next/server";
import {
  requirePermission,
  ForbiddenError,
} from "@/lib/permissions/hasPermission";
import { PERMISSIONS } from "@/lib/permissions/constants";
import {
  buildMonthlyReport,
  type ReportType,
  type ColumnDef,
  type ReportRow,
} from "@/lib/reports/buildMonthlyReport";

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: ReportRow[], columns: ColumnDef[]): string {
  const lines = [columns.map((c) => csvEscape(c.label)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => csvEscape(row[c.key])).join(","));
  }
  return lines.join("\n");
}

const VALID_TYPES: ReportType[] = ["duty", "ta", "holiday", "leave"];

/**
 * The CSV is generated from the SAME query as the on-screen report
 * (buildMonthlyReport), so the two cannot disagree.
 *
 * They used to: this route read only `userId` and ignored `year`, `from` and
 * `to` entirely, while the page applied all of them — so the export silently
 * contained every row for that officer regardless of the filters shown.
 *
 * Visibility still comes from RLS via the user's own client, so a
 * REPORT_EXPORT holder without DUTY_VIEW_ALL exports only their own rows,
 * exactly as the page shows them.
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.REPORT_EXPORT);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw err;
  }

  const sp = request.nextUrl.searchParams;
  const rawType = sp.get("type") ?? "duty";
  const type = (VALID_TYPES as string[]).includes(rawType)
    ? (rawType as ReportType)
    : "duty";

  const year = Number(sp.get("year")) || new Date().getFullYear();
  const monthParam = sp.get("month");
  const month =
    monthParam && monthParam !== "all"
      ? Math.min(12, Math.max(1, Number(monthParam)))
      : null;

  const report = await buildMonthlyReport({
    type,
    year,
    month,
    userId: sp.get("userId") ?? undefined,
  });

  const csv = toCsv(report.rows, report.columns);
  const filename = `${type}-${report.periodLabel.replace(/\s+/g, "-").toLowerCase()}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
