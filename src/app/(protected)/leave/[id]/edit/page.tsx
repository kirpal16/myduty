import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { hasPermission } from "@/lib/permissions/hasPermission";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { LeaveForm } from "../../new/leave-form";
import { loadHolidayOptions, loadOptionalHolidayOptions } from "@/lib/leave/loadHolidayOptions";
import { getUserDisabledLeaveTypeIds } from "@/lib/leave/userDisabledLeaveTypes";
import { clampYear } from "@/lib/format/year";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ColorDot } from "@/components/ui/color-dot";
import { NavLink as Link } from "@/components/ui/nav-link";
import { ArrowLeft, Info, CheckCircle2 } from "lucide-react";

export default async function EditLeavePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const supabase = await createClient();
  // The log is fetched first because everything else depends on ITS year.
  // Editing a 2025 leave used to show 2026 balances, because the page asked
  // for the clock year regardless of what it was editing.
  const { data: log } = await supabase
    .from("leave_logs")
    .select(
      "id, user_id, leave_type_id, start_date, end_date, is_half_day, half_day_session, reason",
    )
    .eq("id", id)
    .single();

  if (!log) notFound();
  // Only the owner edits their own entry (RLS would reject the write anyway).
  if (log.user_id !== user?.id) redirect("/leave");

  const leaveYear = clampYear(new Date(`${log.start_date}T12:00:00`).getFullYear());

  const [
    { data: leaveTypes },
    { data: balances },
    { data: attachment },
    canAccessStorage,
    disabledTypeIds,
    { data: savedDays },
  ] = await Promise.all([
    supabase
      .from("leave_types")
      // color so the edit form's picker matches the create form's.
      .select("id, name, code, is_system, color")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("leave_balance_view")
      .select("leave_type_id, allocated, carried_in, total_available, used, remaining")
      .eq("user_id", user?.id ?? "")
      .eq("year", leaveYear),
    supabase
      .from("file_attachments")
      .select("id, original_filename, mime_type, size_bytes")
      .eq("related_entity_type", "leave_logs")
      .eq("related_entity_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    user?.role === "SUPER_ADMIN" ? true : hasPermission(PERMISSIONS.STORAGE_VIEW_ALL),
    getUserDisabledLeaveTypeIds(user.id),
    // The saved per-day split, so the breakdown reopens as it was saved.
    supabase
      .from("leave_log_days")
      .select("leave_date, leave_type_id")
      .eq("leave_log_id", id),
  ]);

  // Exclude disabled leave types, but preserve the one currently on this log
  const enabledLeaveTypes = (leaveTypes ?? []).filter(
    (lt) => !disabledTypeIds.has(lt.id) || lt.id === log.leave_type_id,
  );

  // Exclude this log, so editing a Holiday Leave does not find its own dates
  // already "taken" and refuse to keep them. The year is the entry's own, plus
  // the next one, so a run crossing 31 December stays editable.
  const [holidayOptions, optionalHolidayOptions] = await Promise.all([
    loadHolidayOptions([leaveYear, leaveYear + 1], user.id, log.id),
    loadOptionalHolidayOptions([leaveYear, leaveYear + 1]),
  ]);

  const balanceMap = new Map(
    (balances ?? []).map((b) => [b.leave_type_id, b])
  );

  return (
    <main className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-7xl 2xl:max-w-full mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/leave"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Leave Log</span>
        </Link>
      </div>

      <PageHeader
        title="Edit Leave Entry"
        subtitle="Modify absence dates, session format, or reason."
        badge={<Badge variant="warning" dot>Edit Mode</Badge>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="p-6 sm:p-8">
            <LeaveForm
              leaveTypes={enabledLeaveTypes}
              canUploadFiles={canAccessStorage}
              holidayOptions={holidayOptions}
              optionalHolidayOptions={optionalHolidayOptions}
              balances={(balances ?? []).map((b) => ({
                leaveTypeId: b.leave_type_id,
                allocated: b.allocated,
                carriedIn: b.carried_in,
                totalAvailable: b.total_available,
                used: b.used,
                remaining: b.remaining,
              }))}
              logId={log.id}
              initialFile={
                attachment
                  ? {
                      id: attachment.id,
                      name: attachment.original_filename,
                      url: `/api/storage/${attachment.id}`,
                      size: attachment.size_bytes,
                      mimeType: attachment.mime_type,
                    }
                  : null
              }
              defaults={{
                leaveTypeId: log.leave_type_id,
                startDate: log.start_date,
                endDate: log.end_date,
                isHalfDay: log.is_half_day,
                halfDaySession: log.half_day_session,
                reason: log.reason,
                // Days equal to the engine's proposal are no-ops; only real
                // changes show as changed in the breakdown.
                dayTypes: Object.fromEntries(
                  (savedDays ?? []).map((d) => [d.leave_date, d.leave_type_id]),
                ),
              }}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5 space-y-4">
            <CardHeader
              title={`Leave Allowances (${leaveYear})`}
              description="Your remaining quota for active categories"
            />

            <div className="space-y-2.5">
              {enabledLeaveTypes.map((lt) => {
                const bal = balanceMap.get(lt.id);
                const remaining = Number(bal?.remaining ?? 0);
                const allocated = Number(bal?.allocated ?? 0);
                const carriedIn = Number(bal?.carried_in ?? 0);
                const totalAvailable = Number(bal?.total_available ?? allocated + carriedIn);
                const quota = totalAvailable > 0 ? totalAvailable : allocated;
                const used = Number(bal?.used ?? 0);
                const percent = quota > 0 ? Math.max(0, Math.min(100, Math.round((used / quota) * 100))) : 0;

                return (
                  <div
                    key={lt.id}
                    className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex min-w-0 items-center gap-1.5 font-semibold text-foreground">
                        <ColorDot color={lt.color} label={lt.name} />
                        <span className="truncate">{lt.name}</span>
                      </span>
                      <div className="text-right shrink-0">
                        <span className="font-medium text-muted-foreground">
                          <strong className="text-foreground">{remaining}</strong> / {quota} days left
                        </span>
                        {carriedIn > 0 && (
                          <span className="block text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold leading-none mt-0.5">
                            {quota} days (incl. {carriedIn} carried)
                          </span>
                        )}
                      </div>
                    </div>
                    {quota > 0 && (
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            remaining < 0 ? "bg-rose-500" : percent > 80 ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min(100, percent)}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
