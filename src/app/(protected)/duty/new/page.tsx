import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { hasPermission } from "@/lib/permissions/hasPermission";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { DutyForm } from "./duty-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NavLink as Link } from "@/components/ui/nav-link";
import { ArrowLeft, Briefcase, Compass, Shield } from "lucide-react";
import { getUserSettings } from "@/lib/settings/getUserSettings";
import { isoToLocalInput, toDateKey } from "@/lib/format/datetime";
import type { HolidayRecord } from "@/lib/holidays/resolveHoliday";

/**
 * The officer's usual shift, so logging a duty is normally just picking the
 * date. Times come from their settings; 10:00-18:00 unless they changed it.
 */
function defaultShiftFor(
  dateKey: string | undefined,
  start: string,
  end: string,
): { startsAt: string; endsAt: string } {
  const base = dateKey ?? toDateKey(new Date());
  return { startsAt: `${base}T${start}`, endsAt: `${base}T${end}` };
}

export default async function NewDutyPage({
  searchParams,
}: {
  searchParams: Promise<{ startsAt?: string; date?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const supabase = await createClient();

  const settings = await getUserSettings();

  // The calendar links here with ?startsAt=<date>T09:00 when you click a day.
  // That prefill used to be dropped on the floor because this page never read
  // searchParams at all.
  const requestedDay = params.startsAt
    ? params.startsAt.slice(0, 10)
    : params.date?.slice(0, 10);
  const shift = defaultShiftFor(
    requestedDay,
    settings.defaultShiftStart,
    settings.defaultShiftEnd,
  );
  // An explicit time in the link wins over the default start.
  if (params.startsAt && params.startsAt.length > 10) {
    shift.startsAt = isoToLocalInput(new Date(params.startsAt)) || shift.startsAt;
  }

  // Holidays around the entry, so the form can classify the chosen date (and
  // every day of a multi-day span) without a round trip per keystroke. The
  // server re-derives this authoritatively on submit regardless.
  const windowStart = new Date(shift.startsAt);
  const from = new Date(windowStart.getFullYear(), windowStart.getMonth() - 2, 1);
  const to = new Date(windowStart.getFullYear(), windowStart.getMonth() + 4, 0);

  const [{ data: dutyTypes }, canAccessStorage, { data: holidays }] = await Promise.all([
    supabase
      .from("duty_types")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    user?.role === "SUPER_ADMIN" ? true : hasPermission(PERMISSIONS.STORAGE_VIEW_ALL),
    supabase
      .from("holidays")
      .select("name, holiday_date, scope, is_government, is_optional")
      .gte("holiday_date", toDateKey(from))
      .lte("holiday_date", toDateKey(to)),
  ]);

  return (
    <main className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-7xl 2xl:max-w-full mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/duty"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Duty Log</span>
        </Link>
      </div>

      <PageHeader
        title="Log Duty Shift"
        subtitle="Record your operational shift timings, station assignments, and travel allowance claims."
        badge={
          <Badge variant="purple" dot>
            New Shift
          </Badge>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form Area */}
        <div className="lg:col-span-2">
          <Card className="p-6 sm:p-8">
            <DutyForm
              dutyTypes={dutyTypes ?? []}
              canUploadFiles={canAccessStorage}
              holidays={(holidays ?? []) as HolidayRecord[]}
              holidayDayRate={settings.holidayDayRate}
              defaultShiftEnd={settings.defaultShiftEnd}
              defaults={{ startsAt: shift.startsAt, endsAt: shift.endsAt }}
            />
          </Card>
        </div>

        {/* Sidebar Guidance & TA Calculation Card */}
        <div className="space-y-6">
          <Card className="p-5 space-y-4">
            <CardHeader
              title="Shift & Roster Guidance"
              description="Best practices for shift handover and logs"
            />

            <div className="space-y-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/60">
                <Briefcase className="size-4 text-indigo-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground block">Exact Shift Timings</span>
                  <span>Ensure your shift start and end times reflect physical muster or patrol periods.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/60">
                <Compass className="size-4 text-sky-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground block">Travelling Allowance (TA)</span>
                  <span>If travel was required outside base station, enter accurate kilometer distance and reimbursement claims.</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5 bg-gradient-to-br from-indigo-900/10 via-slate-900/5 to-slate-900/10 border-indigo-500/20 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              <Shield className="size-4" />
              <span>Official Record</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Logged duty records are verified by department supervisors and permanently archived in system logs.
            </p>
          </Card>
        </div>
      </div>
    </main>
  );
}
