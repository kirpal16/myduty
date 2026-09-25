/**
 * Sets `is_holiday` / `is_holiday_duty` on duties recorded before those
 * columns existed.
 *
 * Migration 0020 adds the columns and recovers the old `[Holiday …]` note tag
 * into `manual_holiday_claim` — because that tag was a USER ASSERTION that
 * pay was owed, not a derived fact. The derived classification has to be
 * computed here rather than in SQL, because the precedence rules reach the
 * gazetted Gujarat catalog, which lives in TypeScript
 * (src/lib/holidays/weekendRules.ts) and not in the database.
 *
 * The R1 rules it applies:
 *   is_holiday       = the DATE is a holiday / weekend off / day off
 *   is_holiday_duty  = a QUALIFYING holiday (not an Optional Holiday) AND the
 *                    duty was not cancelled
 *   holiday_allowance is NOT invented — a historical duty with no recorded
 *                    amount stays at 0, because we cannot know what it paid.
 *                    It IS cleared where the day cannot earn it (an Optional
 *                    Holiday, or a holiday that dropped its manual claim).
 *
 * Run once, after `npm run db:push`:
 *   npx tsx scripts/backfill-holiday-flags.ts            # report only
 *   npx tsx scripts/backfill-holiday-flags.ts --apply    # write
 */
import { createClient } from "@supabase/supabase-js";
import {
  resolveHoliday,
  type HolidayRecord,
} from "../src/lib/holidays/resolveHoliday";

process.loadEnvFile?.(".env.local");

const APPLY = process.argv.includes("--apply");

type DutyRow = {
  id: string;
  starts_at: string;
  status: string;
  is_holiday: boolean;
  is_holiday_duty: boolean;
  manual_holiday_claim: boolean;
  holiday_allowance: number | string | null;
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local",
    );
  }

  // Service role: this has to see and correct EVERY officer's rows, which no
  // user-scoped client can do.
  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  const { data: holidays, error: holidayError } = await supabase
    .from("holidays")
    // is_optional is essential: without it an Optional Holiday row reads as
    // a public holiday, and every duty on it would be flagged as holiday duty.
    .select("name, holiday_date, scope, is_government, is_optional");
  if (holidayError) throw holidayError;

  const { data: duties, error: dutyError } = await supabase
    .from("duties")
    .select("id, starts_at, status, is_holiday, is_holiday_duty, manual_holiday_claim, holiday_allowance")
    .order("starts_at");
  if (dutyError) throw dutyError;

  const rows = (duties ?? []) as DutyRow[];
  const holidayRows = (holidays ?? []) as HolidayRecord[];

  const updates: {
    id: string;
    is_holiday: boolean;
    is_holiday_duty: boolean;
    manual_holiday_claim: boolean;
    holiday_allowance?: number;
  }[] = [];

  const byKind = new Map<string, number>();

  for (const d of rows) {
    const r = resolveHoliday(new Date(d.starts_at), holidayRows);
    const isHoliday = r.isHoliday;
    // Same rule as resolveHolidayPay: only a QUALIFYING holiday that was
    // worked is a holiday duty. An Optional Holiday (મરજિયાત) is a working
    // day — isHoliday is true for display, but it never earns anything.
    const isHolidayDuty = r.qualifiesForHolidayAllowance && d.status !== "CANCELLED";

    // A manual claim is only meaningful OFF a holiday — the DB check
    // constraint rejects it on one — so a row now known to fall on a holiday
    // drops the flag it inherited from the old note tag.
    const manualClaim = isHoliday ? false : d.manual_holiday_claim;

    // Pay recorded on a day that cannot earn it (an optional holiday, or a
    // holiday whose manual claim was just dropped) is cleared. Pay on a
    // qualifying holiday or a legitimate manual claim is left untouched.
    const allowance = Number(d.holiday_allowance ?? 0);
    const mayEarn = isHolidayDuty || manualClaim;
    const clearAllowance = allowance !== 0 && !mayEarn;

    if (
      d.is_holiday === isHoliday &&
      d.is_holiday_duty === isHolidayDuty &&
      d.manual_holiday_claim === manualClaim &&
      !clearAllowance
    ) {
      continue;
    }

    updates.push({
      id: d.id,
      is_holiday: isHoliday,
      is_holiday_duty: isHolidayDuty,
      manual_holiday_claim: manualClaim,
      ...(clearAllowance ? { holiday_allowance: 0 } : {}),
    });

    if (isHoliday) {
      const k = r.kind ?? "unknown";
      byKind.set(k, (byKind.get(k) ?? 0) + 1);
    }
  }

  console.log(`Scanned ${rows.length} duties.`);
  console.log(`${updates.length} need updating.`);
  for (const [kind, n] of byKind) {
    console.log(`  ${kind}: ${n}`);
  }

  if (!APPLY) {
    console.log("\nDry run. Re-run with --apply to write these changes.");
    return;
  }

  // One row at a time rather than a bulk upsert: an upsert would need every
  // NOT NULL column of `duties` restated, and getting one of them wrong would
  // silently overwrite real data.
  let done = 0;
  for (const u of updates) {
    const { error } = await supabase
      .from("duties")
      .update({
        is_holiday: u.is_holiday,
        is_holiday_duty: u.is_holiday_duty,
        manual_holiday_claim: u.manual_holiday_claim,
        ...(u.holiday_allowance !== undefined ? { holiday_allowance: u.holiday_allowance } : {}),
      })
      .eq("id", u.id);
    if (error) {
      console.error(`Failed on duty ${u.id}:`, error.message);
      throw error;
    }
    done++;
    if (done % 100 === 0) console.log(`  …${done}/${updates.length}`);
  }

  console.log(`Updated ${done} duties.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
