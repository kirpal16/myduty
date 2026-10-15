import { NavLink as Link } from "@/components/ui/nav-link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/format/currency";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { formatDateTime, formatTime } from "@/lib/format/datetime";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AttachmentCardList } from "@/components/ui/attachment-card-list";
import { DeleteDutyButton } from "@/components/duty/delete-duty-button";
import {
  ClickableShiftCard,
  ShiftSelectionProvider,
} from "@/components/duty/clickable-shift-card";
import { getServerTranslations } from "@/lib/i18n/server";
import { getUserSettings } from "@/lib/settings/getUserSettings";
import { formatDutyTypeDropdownLabel, toGujaratiNumerals } from "@/lib/reports/gujaratiReportUtils";
import { calculateMinutes, formatMinutes } from "@/lib/duty/groupDuties";
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
  Briefcase,
} from "lucide-react";

export default async function DutyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const supabase = await createClient();

  const [{ data: duty }, { data: attachments }, translations] = await Promise.all([
    supabase
      .from("duties")
      .select(
        "id, user_id, starts_at, ends_at, status, location, notes, ta_from_place, ta_to_place, ta_vehicle_type, ta_distance_km, ta_amount, is_holiday, is_holiday_duty, manual_holiday_claim, holiday_allowance, duty_group_id, duty_types(name), users!duties_user_id_fkey(full_name)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("file_attachments")
      .select("id, original_filename, mime_type, size_bytes, created_at, description")
      .eq("related_entity_type", "duties")
      .eq("related_entity_id", id),
    getServerTranslations(),
  ]);

  const isGu = translations.lang === "gu";
  const { t } = translations;

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

  const dateKey = duty.starts_at.split("T")[0];
  const DUTY_SELECT_COLS =
    "id, user_id, starts_at, ends_at, status, location, notes, ta_from_place, ta_to_place, ta_vehicle_type, ta_distance_km, ta_amount, is_holiday, is_holiday_duty, manual_holiday_claim, holiday_allowance, duty_group_id, duty_types(name), users!duties_user_id_fkey(full_name)";

  const siblingQuery = duty.duty_group_id
    ? supabase
      .from("duties")
      .select(DUTY_SELECT_COLS)
      .eq("duty_group_id", duty.duty_group_id)
      .order("starts_at", { ascending: true })
    : supabase
      .from("duties")
      .select(DUTY_SELECT_COLS)
      .eq("user_id", duty.user_id)
      .gte("starts_at", `${dateKey}T00:00:00`)
      .lte("starts_at", `${dateKey}T23:59:59.999`)
      .order("starts_at", { ascending: true });

  const settings = await getUserSettings();
  let siblingDuties = [duty];
  if (settings.enableMultiDuty) {
    const { data: siblings } = await siblingQuery;
    if (siblings && siblings.length > 0) {
      siblingDuties = siblings;
    }
  }
  const isMultiShift = siblingDuties.length > 1;

  let totalCombinedDurationMins = 0;
  let totalCombinedTa = 0;
  let totalCombinedDistance = 0;
  let totalCombinedHolidayPay = 0;

  for (const s of siblingDuties) {
    totalCombinedDurationMins += calculateMinutes(s.starts_at, s.ends_at);
    totalCombinedTa += Number(s.ta_amount ?? 0);
    totalCombinedDistance += Number(s.ta_distance_km ?? 0);
    totalCombinedHolidayPay += Number(s.holiday_allowance ?? 0);
  }

  const totalCombinedDurationLabel = formatMinutes(totalCombinedDurationMins, isGu);
  const totalCombinedExtraClaim = totalCombinedTa + totalCombinedHolidayPay;

  const statusLabel =
    duty.status === "COMPLETED"
      ? t.duty.completed
      : duty.status === "CANCELLED"
        ? t.duty.cancelled
        : t.duty.scheduled;

  return (
    <main className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-7xl 2xl:max-w-full mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/duty"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>{t.duty.backToDutyLog}</span>
        </Link>
      </div>

      <PageHeader
        title={
          dutyType?.name
            ? isGu
              ? formatDutyTypeDropdownLabel(dutyType.name)
              : dutyType.name
            : t.duty.dutyDetails
        }
        subtitle={
          t.duty.recordedShiftFor.replace(
            "{officer}",
            officer?.full_name ?? (isGu ? "અધિકારી" : "Officer"),
          )
        }
        badge={
          <div className="flex items-center gap-2">
            <Badge variant="purple">{statusLabel}</Badge>
            {isHolidayShift && (
              <Badge variant="warning">
                ✨ {t.duty.badgeWorkedHoliday}
              </Badge>
            )}
            {isManualClaim && (
              <Badge variant="secondary">{t.duty.badgeHolidayClaim}</Badge>
            )}
          </div>
        }
      />

      {isMultiShift && (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3.5 sm:p-4 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Briefcase className="size-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-foreground">
                {isGu
                  ? `આ દિવસ માટે ${toGujaratiNumerals(siblingDuties.length)} શિફ્ટ્સ નોંધાયેલ છે`
                  : `${siblingDuties.length} shifts recorded for this day`}
              </h4>
              <p className="text-[11px] text-muted-foreground">
                {isGu
                  ? "દરેક શિફ્ટને તેની કાર્ડમાંથી સીધી એડિટ અથવા ડિલીટ કરી શકો છો."
                  : "Each shift can be directly edited or deleted from its card below."}
              </p>
            </div>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-lg bg-indigo-600 text-white shadow-2xs shrink-0">
            {totalCombinedDurationLabel}
          </span>
        </div>
      )}

      <ShiftSelectionProvider initialId={duty.id}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Core Shift Information */}
          <div className="lg:col-span-2 space-y-6">
            {siblingDuties.map((s, idx) => {
              const sType = s.duty_types as unknown as { name: string } | null;
              const sTypeName = sType?.name
                ? isGu
                  ? formatDutyTypeDropdownLabel(sType.name)
                  : sType.name
                : t.duty.standard;
              const sDuration = formatMinutes(calculateMinutes(s.starts_at, s.ends_at), isGu);
              const isCurrent = s.id === duty.id;

              return (
                <ClickableShiftCard
                  key={s.id}
                  id={s.id}
                  isInitialCurrent={isCurrent}
                  isMultiShift={isMultiShift}
                >
                  <div className="flex items-center justify-between border-b border-border/80 pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 text-indigo-500" />
                      <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                        {isMultiShift
                          ? (isGu ? `શિફ્ટ ${toGujaratiNumerals(idx + 1)}: ${sTypeName}` : `Shift ${idx + 1}: ${sTypeName}`)
                          : t.duty.shiftInformation}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border">
                        {sDuration}
                      </span>
                      {isOwn && (
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/duty/${s.id}/edit`}
                            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted shadow-2xs transition-colors"
                          >
                            <Edit2 className="size-3.5 text-indigo-500" />
                            <span>{t.common.edit}</span>
                          </Link>
                          <DeleteDutyButton
                            id={s.id}
                            size="md"
                            redirectTo={
                              siblingDuties.length > 1
                                ? (s.id === duty.id
                                  ? `/duty/${siblingDuties.find((sib) => sib.id !== s.id)!.id}`
                                  : undefined)
                                : "/duty"
                            }
                            label={t.common.delete}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                    <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5">
                      <span className="text-muted-foreground text-xs block mb-1">
                        {t.duty.assignedOfficer}
                      </span>
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <User className="size-4 text-slate-400" />
                        {officer?.full_name ?? "—"}
                      </span>
                    </div>

                    <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5">
                      <span className="text-muted-foreground text-xs block mb-1">
                        {t.duty.dutyClassification}
                      </span>
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <Shield className="size-4 text-indigo-500" />
                        {sTypeName}
                      </span>
                    </div>

                    <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5">
                      <span className="text-muted-foreground text-xs block mb-1">
                        {t.duty.startsAtLabel}
                      </span>
                      <span className="font-medium text-foreground">
                        {formatDateTime(s.starts_at, timeFormat, isGu ? "gu" : "en-US")}
                      </span>
                    </div>

                    <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5">
                      <span className="text-muted-foreground text-xs block mb-1">
                        {t.duty.endsAtLabel}
                      </span>
                      <span className="font-medium text-foreground">
                        {formatDateTime(s.ends_at, timeFormat, isGu ? "gu" : "en-US")}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border/80 space-y-3">
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground block mb-1">
                        {t.duty.stationLocationLabel}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm text-foreground">
                        <MapPin className="size-4 text-rose-500 shrink-0" />
                        <span>
                          {s.location || t.duty.noSpecificStation}
                        </span>
                      </div>
                    </div>

                    {s.notes && (
                      <div>
                        <span className="text-xs font-semibold text-muted-foreground block mb-1">
                          {t.duty.operationalNotesLabel}
                        </span>
                        <p className="text-xs sm:text-sm text-foreground bg-muted/40 p-3 rounded-xl border border-border/60 whitespace-pre-wrap">
                          {s.notes}
                        </p>
                      </div>
                    )}

                    {(s.ta_from_place || s.ta_to_place || s.ta_amount) && (
                      <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sky-700 dark:text-sky-300 flex items-center gap-1">
                            <Compass className="size-3.5" />
                            <span>{t.duty.taClaimTitle}</span>
                          </span>
                          {s.ta_amount && (
                            <Badge variant="success">
                              {formatCurrency(s.ta_amount)}
                            </Badge>
                          )}
                        </div>
                        <div className="text-muted-foreground flex items-center justify-between text-[11px]">
                          <span>{s.ta_from_place || "?"} → {s.ta_to_place || "?"}</span>
                          {s.ta_distance_km && (
                            <span>
                              {isGu ? toGujaratiNumerals(s.ta_distance_km) : s.ta_distance_km} {t.duty.kmUnit}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </ClickableShiftCard>
              );
            })}
          </div>

          {/* Allowances & Extra Compensation Panel */}
          <div>
            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <IndianRupee className="size-4 text-emerald-500" />
                <span>{t.duty.allowancesCompensation}</span>
              </h3>

              <div className="space-y-3 text-xs sm:text-sm">
                {/* Cumulative TA Details */}
                {totalCombinedTa > 0 || totalCombinedDistance > 0 ? (
                  <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3.5 space-y-2">
                    <div className="flex items-center gap-1.5 text-sky-700 dark:text-sky-300 font-bold text-xs">
                      <Compass className="size-3.5" />
                      <span>
                        {isMultiShift
                          ? (isGu ? "કુલ ટી.એ. (બધી શિફ્ટ)" : "Total TA (All Shifts)")
                          : t.duty.taClaimTitle}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs pt-1 border-t border-sky-500/20">
                      <span className="text-muted-foreground">
                        {t.duty.distanceAmount}
                      </span>
                      <span className="font-bold text-foreground">
                        {totalCombinedDistance > 0
                          ? `${isGu ? toGujaratiNumerals(totalCombinedDistance) : totalCombinedDistance} ${t.duty.kmUnit} • `
                          : ""}
                        {formatCurrency(totalCombinedTa)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-muted-foreground">
                    {t.duty.noTaClaimed}
                  </div>
                )}

                {/* Holiday Duty Extra Pay */}
                {totalCombinedHolidayPay > 0 && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-bold text-xs">
                      <Sparkles className="size-3.5 text-amber-500" />
                      <span>{t.duty.holidayDutyExtraPayTitle}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pt-1">
                      <span className="text-muted-foreground">
                        {t.duty.extraSalaryPay}
                      </span>
                      <Badge variant="warning" className="font-bold text-xs">
                        {formatCurrency(totalCombinedHolidayPay)}
                      </Badge>
                    </div>
                  </div>
                )}

                {/* Total Extra Claim */}
                {totalCombinedExtraClaim > 0 && (
                  <div className="flex justify-between items-center pt-3 border-t border-border font-bold">
                    <span className="text-xs text-foreground">
                      {t.duty.totalExtraClaim}
                    </span>
                    <Badge variant="success" className="text-sm font-bold">
                      {formatCurrency(totalCombinedExtraClaim)}
                    </Badge>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </ShiftSelectionProvider>

      {/* Attachments & Documentation Section */}
      {(attachments ?? []).length > 0 && (
        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <FileText className="size-4 text-indigo-500" />
            <span>
              {t.duty.attachedDocumentation} ({isGu ? toGujaratiNumerals((attachments ?? []).length) : (attachments ?? []).length})
            </span>
          </h3>

          <AttachmentCardList attachments={attachments ?? []} canDelete={isOwn} />
        </Card>
      )}
    </main>
  );
}
