import "server-only";
import { createClient } from "@/lib/supabase/server";
import { toDateKey } from "@/lib/format/datetime";
import {
  holidayOptionsForYear,
  isHolidayLeaveType,
  datesInRange,
  type HolidayOption,
} from "./holidayLeaveRules";
import type { HolidayRecord } from "@/lib/holidays/resolveHoliday";

/**
 * The dates a Holiday Leave may be logged against this year, ready for the
 * form's picker.
 *
 * Loads three things once: the officer's visible holidays, the days they
 * actually worked, and the days already taken as HL. Worked and taken days are
 * still returned, disabled with the reason — an option that silently
 * disappears is harder to understand than one that explains itself.
 *
 * `excludeLogId` lets the edit form keep its own dates selectable; without it,
 * editing a Holiday Leave would find its own day already "taken".
 */
export async function loadHolidayOptions(
  years: number | number[],
  userId: string,
  excludeLogId?: string,
): Promise<HolidayOption[]> {
  // More than one year, because a Holiday Leave can run across 31 December.
  // Bounding every query to a single calendar year meant `holidayEndOptions`
  // truncated the run there: the 1 January holiday was simply not in the
  // selectable set, so a two-day span over New Year could not be logged.
  const yearList = [...new Set(Array.isArray(years) ? years : [years])].sort(
    (a, b) => a - b,
  );
  const firstYear = yearList[0];
  const lastYear = yearList[yearList.length - 1];

  const supabase = await createClient();
  const from = `${firstYear}-01-01`;
  const to = `${lastYear}-12-31`;

  const [{ data: holidays }, { data: duties }, { data: leaveLogs }] =
    await Promise.all([
      supabase
        .from("holidays")
        .select("name, holiday_date, scope, is_government, is_optional")
        .gte("holiday_date", from)
        .lte("holiday_date", to),
      // A cancelled duty was not worked, so it does not block the day.
      supabase
        .from("duties")
        .select("starts_at")
        .eq("user_id", userId)
        .neq("status", "CANCELLED")
        .gte("starts_at", `${from}T00:00:00`)
        .lte("starts_at", `${to}T23:59:59`),
      supabase
        .from("leave_logs")
        .select("id, start_date, end_date, leave_types(code, is_system)")
        .eq("user_id", userId)
        .gte("start_date", from)
        .lte("start_date", to),
    ]);

  const workedDates = new Set(
    (duties ?? []).map((d) => toDateKey(d.starts_at)),
  );

  const takenDates = new Set<string>();
  for (const log of leaveLogs ?? []) {
    if (excludeLogId && log.id === excludeLogId) continue;
    const type = log.leave_types as unknown as {
      code: string;
      is_system: boolean;
    } | null;
    if (!isHolidayLeaveType(type)) continue;
    for (const day of datesInRange(log.start_date, log.end_date)) {
      takenDates.add(day);
    }
  }

  // One pass per year, concatenated in order — the picker then shows a run
  // that crosses the boundary as the continuous thing it is.
  return yearList.flatMap((y) =>
    holidayOptionsForYear(
      y,
      (holidays ?? []) as HolidayRecord[],
      workedDates,
      takenDates,
    ),
  );
}

import { optionalHolidayOptionsForYear } from "./optionalHolidayRules";

export async function loadOptionalHolidayOptions(years: number | number[]) {
  const yearList = [...new Set(Array.isArray(years) ? years : [years])].sort((a, b) => a - b);
  const firstYear = yearList[0];
  const lastYear = yearList[yearList.length - 1];

  const supabase = await createClient();
  const { data: holidays } = await supabase
    .from("holidays")
    .select("name, holiday_date, scope, is_government, is_optional")
    .eq("is_optional", true)
    .gte("holiday_date", `${firstYear}-01-01`)
    .lte("holiday_date", `${lastYear}-12-31`);

  const results: { date: string; name: string }[] = [];
  for (const y of yearList) {
    results.push(...optionalHolidayOptionsForYear(y, (holidays ?? []) as HolidayRecord[]));
  }
  return results.sort((a, b) => a.date.localeCompare(b.date));
}

