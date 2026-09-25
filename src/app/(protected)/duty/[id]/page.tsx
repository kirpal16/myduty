import { NavLink as Link } from "@/components/ui/nav-link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/format/currency";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { formatDateTime } from "@/lib/format/datetime";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AttachmentCardList } from "@/components/ui/attachment-card-list";
import { DeleteDutyButton } from "@/components/duty/delete-duty-button";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  FileText,
  Compass,
  IndianRupee,
  User,
  Edit2,
  Trash2,
  Shield,
  Sparkles,
} from "lucide-react";

export default async function DutyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const supabase = await createClient();

  const [{ data: duty }, { data: attachments }] = await Promise.all([
    supabase
      .from("duties")
      .select(
        "id, user_id, starts_at, ends_at, status, location, notes, ta_from_place, ta_to_place, ta_vehicle_type, ta_distance_km, ta_amount, is_holiday, is_holiday_duty, manual_holiday_claim, holiday_allowance, duty_group_id, duty_types(name), users!duties_user_id_fkey(full_name)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("file_attachments")
      .select("id, original_filename, mime_type, size_bytes, created_at")
      .eq("related_entity_type", "duties")
      .eq("related_entity_id", id),
  ]);

  // A missing row is almost always one just deleted from this page: the
  // delete's revalidation re-renders the route before the client navigates
  // away, and notFound() here flashed "That record no longer exists" over a
  // delete that had worked. Go back to the list instead.
  if (!duty) redirect("/duty");

  const timeFormat = user?.timeFormat ?? "24h";
  const officer = duty.users as unknown as { full_name: string } | null;
  const dutyType = duty.duty_types as unknown as { name: string } | null;
  const isOwn = duty.user_id === user?.id;
  const hasTa =
    duty.ta_from_place ||
    duty.ta_to_place ||
    duty.ta_distance_km !== null ||
    duty.ta_amount !== null;

  // Read from real columns: the holiday state used to be a tag inside `notes`
  // that had to be regex-parsed back out on every render.
  const holidayExtraPay = Number(duty.holiday_allowance ?? 0);
  const isHolidayShift = duty.is_holiday_duty;
  const isManualClaim = duty.manual_holiday_claim;
  const cleanNotes = duty.notes;

  const totalExtraClaim = (duty.ta_amount ?? 0) + holidayExtraPay;

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
        title={dutyType?.name ?? "Duty Details"}
        subtitle={`Recorded shift for ${officer?.full_name ?? "Officer"}`}
        badge={
          <div className="flex items-center gap-2">
            <Badge variant="purple">{duty.status ?? "SCHEDULED"}</Badge>
            {isHolidayShift && (
              <Badge variant="warning">
                ✨ Worked Holiday (રજાની ફરજ)
              </Badge>
            )}
            {isManualClaim && (
              <Badge variant="secondary">Holiday claim</Badge>
            )}
          </div>
        }
        actions={
          isOwn ? (
            <div className="flex items-center gap-2.5">
              <Link
                href={`/duty/${duty.id}/edit`}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted shadow-2xs transition-colors"
              >
                <Edit2 className="size-3.5" />
                <span>Edit Entry</span>
              </Link>
              <DeleteDutyButton id={duty.id} size="md" redirectTo="/duty" />
            </div>
          ) : null
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core Shift Information */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
              <Clock className="size-4 text-indigo-500" />
              <span>Shift Information</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
              <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5">
                <span className="text-muted-foreground text-xs block mb-1">
                  Assigned Officer
                </span>
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <User className="size-4 text-slate-400" />
                  {officer?.full_name ?? "—"}
                </span>
              </div>

              <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5">
                <span className="text-muted-foreground text-xs block mb-1">
                  Duty Classification
                </span>
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Shield className="size-4 text-indigo-500" />
                  {dutyType?.name ?? "Standard"}
                </span>
              </div>

              <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5">
                <span className="text-muted-foreground text-xs block mb-1">
                  Starts At
                </span>
                <span className="font-medium text-foreground">
                  {formatDateTime(duty.starts_at, timeFormat)}
                </span>
              </div>

              <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5">
                <span className="text-muted-foreground text-xs block mb-1">
                  Ends At
                </span>
                <span className="font-medium text-foreground">
                  {formatDateTime(duty.ends_at, timeFormat)}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border/80 space-y-3">
              <div>
                <span className="text-xs font-semibold text-muted-foreground block mb-1">
                  Location / Station
                </span>
                <div className="flex items-center gap-1.5 text-xs sm:text-sm text-foreground">
                  <MapPin className="size-4 text-rose-500 shrink-0" />
                  <span>{duty.location || "No specific station specified"}</span>
                </div>
              </div>

              {cleanNotes && (
                <div>
                  <span className="text-xs font-semibold text-muted-foreground block mb-1">
                    Operational Notes
                  </span>
                  <p className="text-xs sm:text-sm text-foreground bg-muted/40 p-3 rounded-xl border border-border/60 whitespace-pre-wrap">
                    {cleanNotes}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Allowances & Extra Compensation Panel */}
        <div>
          <Card className="p-6 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <IndianRupee className="size-4 text-emerald-500" />
              <span>Allowances & Compensation</span>
            </h3>

            <div className="space-y-3 text-xs sm:text-sm">
              {/* TA Details */}
              {hasTa ? (
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-sky-700 dark:text-sky-300 font-bold text-xs">
                    <Compass className="size-3.5" />
                    <span>Travelling Allowance (TA)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-muted-foreground block">Route</span>
                      <span className="font-semibold text-foreground">
                        {duty.ta_from_place || "?"} → {duty.ta_to_place || "?"}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                      {duty.ta_vehicle_type === "govt" ? "સરકારી વાહન (સ.વા.)" : "ખાનગી વાહન (ખ.વા.)"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs pt-1 border-t border-sky-500/20">
                    <span className="text-muted-foreground">Distance / Amount:</span>
                    <span className="font-bold text-foreground">
                      {duty.ta_distance_km ? `${duty.ta_distance_km} km • ` : ""}{formatCurrency(duty.ta_amount)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-muted-foreground">
                  No Travelling Allowance (TA) claimed.
                </div>
              )}

              {/* Holiday Duty Extra Pay */}
              {holidayExtraPay !== null && holidayExtraPay > 0 && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-bold text-xs">
                    <Sparkles className="size-3.5 text-amber-500" />
                    <span>Holiday Duty Extra Pay (રજાનું ભથ્થું)</span>
                  </div>
                  <div className="flex justify-between items-center text-xs pt-1">
                    <span className="text-muted-foreground">Extra Salary Pay:</span>
                    <Badge variant="warning" className="font-bold text-xs">
                      {formatCurrency(holidayExtraPay)}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Total Extra Claim */}
              {totalExtraClaim > 0 && (
                <div className="flex justify-between items-center pt-3 border-t border-border font-bold">
                  <span className="text-xs text-foreground">Total Extra Claim:</span>
                  <Badge variant="success" className="text-sm font-bold">
                    {formatCurrency(totalExtraClaim)}
                  </Badge>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Attachments & Documentation Section */}
      {(attachments ?? []).length > 0 && (
        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <FileText className="size-4 text-indigo-500" />
            <span>Attached Documentation ({(attachments ?? []).length})</span>
          </h3>

          <AttachmentCardList attachments={attachments ?? []} canDelete={isOwn} />
        </Card>
      )}
    </main>
  );
}
