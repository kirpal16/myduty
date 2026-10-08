import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { resolveHoliday, type HolidayRecord } from "@/lib/holidays/resolveHoliday";
import { localDayStart, localDayEnd } from "@/lib/format/datetime";
import { resolveHolidayPay } from "./holidayPay";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Re-derives holiday pay for every duty on the given dates.
 *
 * A duty's pay flags are worked out when it is saved. If a holiday is later
 * added, removed, moved, or switched to Optional, duties already logged on
 * that date kept the old answer — a duty on a day that became an Optional
 * Holiday went on showing (and counting) holiday extra pay. Holiday actions
 * call this after every change so the stored flags follow the calendar.
 *
 * The officer's own recorded amount is kept where the day still earns;
 * nothing is invented for a day that newly earns (the rate is theirs to
 * enter). Runs as the caller: RLS limits it to rows they may update.
 * Returns how many duties changed.
 */
export async function recomputeDutyPayForDates(
  supabase: Supabase,
  dates: readonly (string | null | undefined)[],
): Promise<number> {
  const keys = [...new Set(dates.filter((d): d is string => !!d).map((d) => d.slice(0, 10)))].sort();
  if (keys.length === 0) return 0;

  const { data: holidays } = await supabase
    .from("holidays")
    .select("name, holiday_date, scope, is_government, is_optional")
    .gte("holiday_date", keys[0])
    .lte("holiday_date", keys[keys.length - 1]);
  const rows = (holidays ?? []) as HolidayRecord[];

  let changed = 0;
  for (const key of keys) {
    const { data: duties } = await supabase
      .from("duties")
      .select("id, starts_at, status, is_holiday, is_holiday_duty, manual_holiday_claim, holiday_allowance")
      .gte("starts_at", localDayStart(key))
      .lte("starts_at", localDayEnd(key));

    for (const d of duties ?? []) {
      const pay = resolveHolidayPay({
        resolution: resolveHoliday(d.starts_at, rows),
        status: d.status,
        holidayDayRate: 0,
        submittedAllowance: Number(d.holiday_allowance) || undefined,
        manualClaim: d.manual_holiday_claim,
      });

      if (
        d.is_holiday === pay.isHoliday &&
        d.is_holiday_duty === pay.isHolidayDuty &&
        d.manual_holiday_claim === pay.manualHolidayClaim &&
        Number(d.holiday_allowance ?? 0) === pay.holidayAllowance
      ) {
        continue;
      }

      const { error } = await supabase
        .from("duties")
        .update({
          is_holiday: pay.isHoliday,
          is_holiday_duty: pay.isHolidayDuty,
          manual_holiday_claim: pay.manualHolidayClaim,
          holiday_allowance: pay.holidayAllowance,
        })
        .eq("id", d.id);
      if (!error) changed++;
    }
  }
  return changed;
}
