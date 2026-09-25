import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { hasPermission } from "@/lib/permissions/hasPermission";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { DutyForm } from "../../new/duty-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NavLink as Link } from "@/components/ui/nav-link";
import { ArrowLeft, Briefcase } from "lucide-react";
import { getUserSettings } from "@/lib/settings/getUserSettings";
import { isoToLocalInput, toDateKey } from "@/lib/format/datetime";
import type { HolidayRecord } from "@/lib/holidays/resolveHoliday";

export default async function EditDutyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const supabase = await createClient();

  const settings = await getUserSettings();

  const [{ data: duty }, { data: dutyTypes }, { data: attachment }, canAccessStorage] = await Promise.all([
    supabase
      .from("duties")
      .select(
        "id, user_id, duty_type_id, starts_at, ends_at, location, notes, ta_from_place, ta_to_place, ta_vehicle_type, ta_distance_km, ta_amount, holiday_allowance, manual_holiday_claim",
      )
      .eq("id", id)
      .single(),
    supabase
      .from("duty_types")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("file_attachments")
      .select("id, original_filename, mime_type, size_bytes")
      .eq("related_entity_type", "duties")
      .eq("related_entity_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    user?.role === "SUPER_ADMIN" ? true : hasPermission(PERMISSIONS.STORAGE_VIEW_ALL),
  ]);

  if (!duty) notFound();
  // Only the owner edits their own entry (RLS would reject the write anyway).
  if (duty.user_id !== user?.id) redirect(`/duty/${id}`);

  // Holidays around this entry, so moving the date re-classifies it live. The
  // server recomputes the classification on save regardless.
  const at = new Date(duty.starts_at);
  const { data: holidays } = await supabase
    .from("holidays")
    .select("name, holiday_date, scope, is_government, is_optional")
    .gte("holiday_date", toDateKey(new Date(at.getFullYear(), at.getMonth() - 2, 1)))
    .lte("holiday_date", toDateKey(new Date(at.getFullYear(), at.getMonth() + 4, 0)));

  return (
    <main className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-7xl 2xl:max-w-full mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href={`/duty/${duty.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Duty Details</span>
        </Link>
      </div>

      <PageHeader
        title="Edit Duty Entry"
        subtitle="Update timing, location assignments, or travelling allowance calculations."
        badge={<Badge variant="warning" dot>Edit Mode</Badge>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="p-6 sm:p-8">
            <DutyForm
              dutyTypes={dutyTypes ?? []}
              dutyId={duty.id}
              canUploadFiles={canAccessStorage}
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
              holidays={(holidays ?? []) as HolidayRecord[]}
              holidayDayRate={settings.holidayDayRate}
              defaultShiftEnd={settings.defaultShiftEnd}
              defaults={{
                dutyTypeId: duty.duty_type_id,
                startsAt: isoToLocalInput(duty.starts_at),
                endsAt: isoToLocalInput(duty.ends_at),
                location: duty.location,
                notes: duty.notes,
                taFromPlace: duty.ta_from_place,
                taToPlace: duty.ta_to_place,
                taVehicleType: duty.ta_vehicle_type,
                taDistanceKm: duty.ta_distance_km,
                taAmount: duty.ta_amount,
                holidayAllowance: duty.holiday_allowance,
                manualHolidayClaim: duty.manual_holiday_claim,
              }}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5 space-y-4">
            <CardHeader
              title="Shift Record Information"
              description="Who owns this record, and what changing it affects"
            />
            <div className="space-y-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/60">
                <Briefcase className="size-4 text-indigo-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground block">Duty Modification</span>
                  <span>Changing the date re-checks whether this shift falls on a holiday, which decides its extra pay.</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
