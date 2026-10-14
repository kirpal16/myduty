import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  setOwnLeaveAllowance,
  createMyLeaveType,
  updateMyLeaveType,
  deleteMyLeaveType,
  toggleUserLeaveType,
} from "@/actions/leave";
import { getUserDisabledLeaveTypeIds } from "@/lib/leave/userDisabledLeaveTypes";
import { LeaveTypeManager } from "@/components/leave/leave-type-manager";
import { updateUserSettings } from "@/actions/settings";
import { getUserSettings } from "@/lib/settings/getUserSettings";
import { TimeFormatToggle } from "./time-format-toggle";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ColorDot } from "@/components/ui/color-dot";
import { LeaveAllowanceRow } from "@/components/leave/leave-allowance-row";
import { RegisteredLeavesAccordion } from "@/components/leave/registered-leaves-accordion";
import {
  clampYear,
  getCurrentYear,
  YEAR_MIN_OFFSET,
  YEAR_MAX_OFFSET,
} from "@/lib/format/year";
import { isHolidayLeaveType } from "@/lib/leave/holidayLeaveRules";
import {
  Clock,
  Scale,
  Sparkles,
  Palette,
  CalendarDays,
} from "lucide-react";

import { GujaratHolidayImporter } from "@/components/holiday/gujarat-holiday-importer";
import { MyHolidaysPanel } from "@/components/holiday/my-holidays-panel";
import { HolidayBreakdown } from "@/components/holiday/holiday-breakdown";
import { HolidayYearPicker } from "@/components/holiday/holiday-year-picker";
import { summariseHolidayYear } from "@/lib/holidays/holidayYearSummary";
import type { HolidayRecord } from "@/lib/holidays/resolveHoliday";
import {
  createMyHoliday,
  updateHoliday,
  deleteMyHoliday,
} from "@/actions/holiday";
import { DeleteLeaveButton } from "@/components/leave/delete-leave-button";
import { formatDateRange } from "@/lib/format/datetime";
import { leaveDayCount, formatDays, summariseBreakdown } from "@/lib/leave/leaveDays";
import { CalendarOff } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import { resolveTab, type TabDef } from "@/lib/ui/tabs";
import { ActionForm } from "@/components/ui/action-form";
import { CompactSettingsProfile } from "@/components/settings/compact-settings-profile";
import { OfficerSignatureEditor } from "@/components/profile/officer-signature-editor";
import { PrintConfigPanel } from "@/components/settings/print-config-panel";
import type { OfficerProfileData } from "@/components/profile/officer-profile-container";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { getServerTranslations } from "@/lib/i18n/server";
import { toGujaratiNumerals } from "@/lib/reports/gujaratiReportUtils";

const DEFAULT_SETTINGS_TABS: TabDef[] = [
  { id: "profile", label: "Profile", icon: "user" },
  { id: "holidays", label: "Holidays", icon: "calendar" },
  { id: "duty", label: "Duty", icon: "sparkles" },
  { id: "leave", label: "Leave", icon: "scale" },
  { id: "print", label: "Print Template", icon: "printer" },
  { id: "language", label: "Language", icon: "globe" },
];

function ChargedAs({ entries, isGu }: { entries: { code: string; days: number; color: string | null }[] | null; isGu?: boolean }) {
  if (!entries) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-[10px] font-medium text-muted-foreground">
      {entries.map((e) => {
        const val = Number.isInteger(e.days) ? e.days : e.days.toFixed(1);
        return (
          <span
            key={e.code}
            className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-card px-1.5 py-0.5 font-semibold text-foreground whitespace-nowrap"
          >
            <ColorDot color={e.color} label={e.code} />
            {isGu ? toGujaratiNumerals(val) : val} {e.code}
          </span>
        );
      })}
    </span>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; year?: string }>;
}) {
  const { tab, year: yearParam } = await searchParams;
  const { lang, t } = await getServerTranslations();
  const isGu = lang === "gu";

  const settingsTabs: TabDef[] = [
    { id: "profile", label: t.settings.tabs.profile, icon: "user" },
    { id: "holidays", label: t.settings.tabs.holidays, icon: "calendar" },
    { id: "duty", label: t.settings.tabs.duties, icon: "sparkles" },
    { id: "leave", label: t.settings.tabs.leaves, icon: "scale" },
    { id: "print", label: t.settings.tabs.print, icon: "printer" },
    { id: "language", label: t.settings.tabs.language, icon: "globe" },
  ];

  // Resolved on the server so the first paint already shows the right panel.
  const activeTab = resolveTab(settingsTabs, tab);
  const user = await getCurrentUser();
  const supabase = await createClient();
  const thisYear = getCurrentYear();

  /**
   * ONE year for the whole page.
   *
   * `?year=` used to move the holiday calendar while the leave panel stayed
   * pinned to the clock, so stepping the arrows to 2028 showed 2028 holidays
   * beside 2026 balances — two halves of one screen disagreeing about what
   * year it was.
   *
   * The bounds are the shared window, which is also what leave_balance_view
   * materialises. The holiday stepper previously ran to +3, one year further
   * than the view can answer for, so its last step showed empty balances.
   */
  const holidayYear = clampYear(yearParam);
  const currentYear = holidayYear;
  const HOLIDAY_YEAR_MIN = thisYear + YEAR_MIN_OFFSET;
  const HOLIDAY_YEAR_MAX = thisYear + YEAR_MAX_OFFSET;
  const settings = await getUserSettings();

  // The holidays this officer can see this year, plus the resulting Holiday
  // Leave allocation. The count comes from the database function so the panel
  // and the balance page can never disagree about it.
  const { data: myHolidays } = await supabase
    .from("holidays")
    .select("id, name, holiday_date, is_government, scope, is_optional")
    .gte("holiday_date", `${holidayYear}-01-01`)
    .lte("holiday_date", `${holidayYear}-12-31`)
    .order("holiday_date");

  /**
   * The breakdown is computed from the same rows the list shows, using the
   * same resolveHoliday precedence as the calendar and the duty form — so the
   * number on screen can be checked against the days listed beneath it.
   */
  const holidaySummary = summariseHolidayYear(
    holidayYear,
    (myHolidays ?? []) as HolidayRecord[],
  );
  const holidayCount = holidaySummary.total;

  const [
    { data: leaveTypes },
    { data: balances },
    { data: departments },
    { data: myLeaves },
    disabledTypeIds,
    { data: rawBalances },
    { data: userRow },
  ] = await Promise.all([
    supabase
      .from("leave_types")
      // RLS returns the global set plus this officer's own types; user_id is
      // what tells them apart in the manager below.
      .select("id, name, code, color, is_active, user_id")
      .order("name"),
    supabase
      .from("leave_balance_view")
      .select(
        "leave_type_id, allocated, allocation_exists, carried_in, total_available, capped_away, max_accumulated, carry_forward, used, remaining",
      )
      .eq("year", currentYear),
    supabase.from("departments").select("id, name").eq("is_active", true).order("name"),
    supabase
      .from("leave_logs")
      .select("id, start_date, end_date, is_half_day, half_day_session, reason, leave_types(name, color, code)")
      .eq("user_id", user?.id ?? "")
      .gte("start_date", `${currentYear}-01-01`)
      .order("start_date", { ascending: false }),
    getUserDisabledLeaveTypeIds(user?.id),
    supabase
      .from("user_leave_balances")
      .select("leave_type_id, carried_override")
      .eq("user_id", user?.id ?? "")
      .eq("year", currentYear),
    supabase
      .from("users")
      .select(
        "id, full_name, avatar_url, signature_url, employee_code, phone, role, status, designation, joining_date, joining_place, current_posting, date_of_birth, blood_group, emergency_contact, home_district, bio, department_id, departments(name)"
      )
      .eq("id", user?.id ?? "")
      .maybeSingle(),
  ]);

  const myLeaveIds = (myLeaves ?? []).map((l) => l.id);
  const { data: myLeaveDayRows } = await supabase
    .from("leave_log_days")
    .select("leave_log_id, fraction, leave_types(code, name, color)")
    .in("leave_log_id", myLeaveIds.length > 0 ? myLeaveIds : ["00000000-0000-0000-0000-000000000000"]);

  const myDaysByLog = new Map<string, { code: string; color: string | null; fraction: number }[]>();
  for (const r of myLeaveDayRows ?? []) {
    const t = r.leave_types as unknown as { code: string | null; name: string; color: string | null } | null;
    const list = myDaysByLog.get(r.leave_log_id) ?? [];
    list.push({
      code: t?.code || t?.name || "Leave",
      color: t?.color ?? null,
      fraction: Number(r.fraction ?? 1),
    });
    myDaysByLog.set(r.leave_log_id, list);
  }
  const myBreakdownFor = (logId: string) => {
    const rows = myDaysByLog.get(logId) ?? [];
    const summary = summariseBreakdown(rows);
    if (summary.length <= 1) return null;
    const colorOf = new Map(rows.map((r) => [r.code, r.color]));
    return summary.map((s) => ({ ...s, color: colorOf.get(s.code) ?? null }));
  };

  const deptData = userRow?.departments as unknown as { name: string } | null;
  const officerData: OfficerProfileData = {
    id: user?.id ?? "",
    fullName: userRow?.full_name ?? user?.fullName ?? "",
    avatarUrl: userRow?.avatar_url ?? null,
    signatureUrl: userRow?.signature_url ?? null,
    phone: userRow?.phone,
    email: user?.email,
    departmentId: userRow?.department_id ?? user?.departmentId,
    departmentName: deptData?.name ?? null,
    designation: userRow?.designation ?? null,
    employeeCode: userRow?.employee_code ?? null,
    joiningDate: userRow?.joining_date ?? null,
    joiningPlace: userRow?.joining_place ?? null,
    currentPosting: userRow?.current_posting ?? null,
    dateOfBirth: userRow?.date_of_birth ?? null,
    bloodGroup: userRow?.blood_group ?? null,
    emergencyContact: userRow?.emergency_contact ?? null,
    homeDistrict: userRow?.home_district ?? null,
    bio: userRow?.bio ?? null,
    role: user?.role,
    status: user?.status,
  };

  const overrideMap = new Map(
    (rawBalances ?? []).map((rb) => [rb.leave_type_id, rb.carried_override]),
  );

  const byType = new Map(
    (balances ?? []).map((b) => [
      b.leave_type_id,
      {
        ...b,
        carried_override: overrideMap.get(b.leave_type_id) ?? null,
      },
    ]),
  );

  const isSuper = user?.role === "SUPER_ADMIN";

  const allLeaveTypes = leaveTypes ?? [];
  const activeLeaveTypes = allLeaveTypes.filter((t) => t.is_active && !disabledTypeIds.has(t.id));
  const globalLeaveTypes = allLeaveTypes
    .filter((t) => t.user_id === null)
    .map((t) => ({ ...t, is_disabled_for_user: disabledTypeIds.has(t.id) }));
  const myLeaveTypes = allLeaveTypes
    .filter((t) => t.user_id !== null)
    .map((t) => ({ ...t, is_disabled_for_user: disabledTypeIds.has(t.id) }));

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-3 py-6 sm:space-y-8 sm:px-6 lg:px-8 2xl:max-w-6xl">
      <PageHeader
        title={t.settings.pageTitle}
        subtitle={t.settings.pageSubtitle}
      />

      <Tabs tabs={settingsTabs} activeId={activeTab} />

      <div className="grid grid-cols-1 gap-8">
        {activeTab === "profile" && (
          <div className="space-y-6">
            <CompactSettingsProfile
              officer={officerData}
              departments={departments ?? []}
            />

            {/* Official Signature Card */}
            <OfficerSignatureEditor initialSignatureUrl={officerData.signatureUrl} />

            {/* Time Format Preferences Card */}
            <Card className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-border/80 shadow-xs">
              <div className="flex items-center gap-3 pb-3 mb-4 border-b border-border/70">
                <div className="flex size-8 sm:size-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Clock className="size-4.5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-foreground">
                    {t.settings.timeDisplayFormat}
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    {t.settings.timeDisplayFormatSubtitle}
                  </p>
                </div>
              </div>

              <TimeFormatToggle current={user?.timeFormat ?? "24h"} />
            </Card>
          </div>
        )}

        {activeTab === "holidays" && (
          <>
            <GujaratHolidayImporter
              currentYear={holidayYear}
              scope={isSuper ? "GLOBAL" : "USER"}
            />

            {/* Moved here from /holidays/mine, which now redirects. The list
                drives the Holiday Leave allocation, so it belongs beside the
                entitlement it produces rather than on a page of its own. */}
            <Card className="space-y-6 p-4 sm:p-8">
              <div className="flex flex-wrap items-center gap-3 gap-y-3 border-b border-border/80 pb-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <CalendarDays className="size-5" />
                </div>
                <div className="min-w-0 flex-1 basis-40">
                  <h2 className="text-base font-bold text-foreground">
                    {t.settings.myHolidayCalendar}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {t.settings.myHolidayCalendarSubtitle}
                  </p>
                </div>
                <HolidayYearPicker
                  year={holidayYear}
                  min={HOLIDAY_YEAR_MIN}
                  max={HOLIDAY_YEAR_MAX}
                />
              </div>

              {/* Where the total comes from, itemised — a bare "100 holidays"
                  is impossible to check or argue with. */}
              <HolidayBreakdown summary={holidaySummary} />

              <MyHolidaysPanel
                holidays={myHolidays ?? []}
                onCreate={createMyHoliday}
                onUpdate={updateHoliday}
                onDelete={deleteMyHoliday}
                holidayCount={holidayCount}
                year={holidayYear}
              />
            </Card>
          </>
        )}

        {activeTab === "duty" && (
          <>
        <Card className="p-4 sm:p-8">
          <div className="flex items-center gap-3 pb-4 mb-6 border-b border-border/80">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {t.settings.dutyDefaultsTitle}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t.settings.dutyDefaultsSubtitle}
              </p>
            </div>
          </div>

          <ActionForm
            action={updateUserSettings}
            submitLabel={t.settings.saveDefaults}
            successMessage={t.settings.defaultsSaved}
            dirtyGuard
            resetOnSuccess={false}
            fields={[
              {
                name: "holidayDayRate",
                label: t.settings.holidayDayRate,
                type: "number",
                step: "0.01",
                min: "0",
                defaultValue: settings.holidayDayRate || "",
                placeholder: t.settings.holidayRatePlaceholder,
                hint: t.settings.holidayDayRateHint,
              },
              {
                name: "dailySalaryRate",
                label: t.settings.dailySalaryRateLabel,
                type: "number",
                step: "0.01",
                min: "0",
                defaultValue: settings.dailySalaryRate || "",
                placeholder: t.settings.dailySalaryRatePlaceholder,
                hint: t.settings.dailySalaryRateHint,
              },
              {
                name: "defaultShiftStart",
                label: t.settings.defaultShiftStartLabel,
                type: "time",
                required: true,
                defaultValue: settings.defaultShiftStart,
              },
              {
                name: "defaultShiftEnd",
                label: t.settings.defaultShiftEndLabel,
                type: "time",
                required: true,
                defaultValue: settings.defaultShiftEnd,
                hint: t.settings.dutyDefaultsSubtitle,
              },
            ]}
          />
        </Card>

        {/* Leave types. The department's set is read-only here; an officer's
            own types sit alongside it. */}
          </>
        )}

        {activeTab === "leave" && (
          <>
        <Card className="space-y-6 p-4 sm:p-8">
          <div className="flex items-center gap-3 pb-4 border-b border-border/80">
            <div className="flex size-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Palette className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {t.settings.leaveTypesTitle}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t.settings.leaveTypesSubtitle}
              </p>
            </div>
          </div>

          <LeaveTypeManager
            types={globalLeaveTypes}
            editable={false}
            onCreate={createMyLeaveType}
            onUpdate={updateMyLeaveType}
            onDelete={deleteMyLeaveType}
            onToggleDisabled={toggleUserLeaveType}
            title={t.settings.deptLeaveTypes}
            emptyHint={t.settings.deptLeaveTypesEmpty}
          />

          <LeaveTypeManager
            types={myLeaveTypes}
            editable
            onCreate={createMyLeaveType}
            onUpdate={updateMyLeaveType}
            onDelete={deleteMyLeaveType}
            onToggleDisabled={toggleUserLeaveType}
            title={t.settings.myLeaveTypes}
            emptyHint={t.settings.myLeaveTypesEmpty}
          />
        </Card>

        {/* Annual Leave Allowance Allocation Card */}
        <Card className="p-4 sm:p-8">
          <div className="flex items-center gap-3 pb-4 mb-6 border-b border-border/80">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Scale className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {t.settings.annualLeaveEntitlement} ({isGu ? toGujaratiNumerals(currentYear) : currentYear})
              </h2>
              <p className="text-xs text-muted-foreground">
                {t.settings.annualLeaveEntitlementSubtitle}
              </p>
            </div>
          </div>

          {/* Cards, not a table. Carry-forward needs two more controls than
              a row can hold on a phone without a sideways scroll, and each
              card can explain its own numbers. Two across on a wide screen so
              the list does not become a long column. */}
          <div className="grid gap-3 xl:grid-cols-2">
            {activeLeaveTypes.map((t) => (
              <LeaveAllowanceRow
                key={t.id}
                type={{
                  id: t.id,
                  name: t.name,
                  color: t.color,
                  isSystem: isHolidayLeaveType(t),
                }}
                balance={byType.get(t.id)}
                year={currentYear}
                action={setOwnLeaveAllowance}
              />
            ))}

            {activeLeaveTypes.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">
                {t.settings.noActiveLeaveTypes}
              </p>
            )}
          </div>

        </Card>

        {/* My Registered Leave Logs & Removal Card (Accordion, default closed) */}
        <RegisteredLeavesAccordion
          currentYear={currentYear}
          totalDaysFormatted={formatDays(
            (myLeaves ?? []).reduce(
              (a, l) => a + leaveDayCount(l.start_date, l.end_date, l.is_half_day),
              0,
            ),
            isGu,
          )}
          count={(myLeaves ?? []).length}
          defaultOpen={false}
        >

          {(myLeaves ?? []).length > 0 ? (
            <>
              {/* Desktop Table View (Hidden on mobile) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[11px] font-semibold tracking-wider">
                    <tr>
                      <th className="py-3 px-4">{t.settings.colLeaveCategory}</th>
                      <th className="py-3 px-4">{t.settings.colDateRange}</th>
                      <th className="py-3 px-4">{t.settings.colDays}</th>
                      <th className="py-3 px-4">{t.settings.colTypeSession}</th>
                      <th className="py-3 px-4">{t.settings.colReason}</th>
                      <th className="py-3 px-4 text-right">{t.settings.colActions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {(myLeaves ?? []).map((l) => {
                      const leaveType = l.leave_types as unknown as {
                        name: string;
                        color: string | null;
                        code?: string | null;
                      } | null;
                      const typeName = leaveType?.name ?? "Leave";
                      const breakdown = myBreakdownFor(l.id);
                      const isMultiType = Boolean(breakdown && breakdown.length > 1);

                      return (
                        <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-foreground whitespace-nowrap">
                            {isMultiType ? (
                              <span
                                className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 shadow-2xs"
                                title={`Multi-Leave: ${breakdown?.map((b) => `${b.days} ${b.code}`).join(", ")}`}
                              >
                                <Sparkles className="size-3 text-indigo-500 shrink-0" />
                                <span>{t.leave.multiType}</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-2">
                                <ColorDot color={leaveType?.color} label={typeName} />
                                {typeName}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-muted-foreground font-medium whitespace-nowrap">
                            {formatDateRange(l.start_date, l.end_date, isGu ? "gu" : "en-US")}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="info">
                                {formatDays(leaveDayCount(l.start_date, l.end_date, l.is_half_day), isGu)}
                              </Badge>
                              {breakdown && <ChargedAs entries={breakdown} isGu={isGu} />}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {l.is_half_day ? (
                              <Badge variant="warning">{l.half_day_session} {t.leave.halfDay}</Badge>
                            ) : (
                              <Badge variant="outline">{t.leave.fullDay}</Badge>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-muted-foreground truncate max-w-xs">
                            {l.reason ? `"${l.reason}"` : "—"}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <DeleteLeaveButton id={l.id} label={t.common.remove} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View (Shown only on mobile < md) */}
              <div className="md:hidden flex flex-col divide-y divide-border/60">
                {(myLeaves ?? []).map((l) => {
                  const leaveType = l.leave_types as unknown as {
                    name: string;
                    color: string | null;
                    code?: string | null;
                  } | null;
                  const typeName = leaveType?.name ?? "Leave";
                  const breakdown = myBreakdownFor(l.id);
                  const isMultiType = Boolean(breakdown && breakdown.length > 1);

                  return (
                    <div key={l.id} className="p-4 space-y-3 bg-card hover:bg-muted/20 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          {isMultiType ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                              <Sparkles className="size-3 text-indigo-500 shrink-0" />
                              <span>{t.leave.multiType}</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                              <ColorDot color={leaveType?.color} label={typeName} />
                              <span>{typeName}</span>
                            </span>
                          )}
                        </div>
                        {l.is_half_day ? (
                          <Badge variant="warning">{l.half_day_session} {t.leave.halfDay}</Badge>
                        ) : (
                          <Badge variant="outline">{t.leave.fullDay}</Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 text-xs font-medium text-foreground bg-muted/40 p-2.5 rounded-xl border border-border/60">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <CalendarDays className="size-3.5 text-indigo-500 shrink-0" />
                          <span className="truncate">{formatDateRange(l.start_date, l.end_date, isGu ? "gu" : "en-US")}</span>
                        </div>
                        <Badge variant="info">
                          {formatDays(leaveDayCount(l.start_date, l.end_date, l.is_half_day), isGu)}
                        </Badge>
                      </div>

                      {breakdown && (
                        <div className="flex items-center gap-1.5 text-[11px] bg-muted/20 p-2 rounded-lg border border-border/40">
                          <span className="text-muted-foreground font-medium shrink-0">{t.settings.chargedAsLabel}</span>
                          <ChargedAs entries={breakdown} isGu={isGu} />
                        </div>
                      )}

                      {l.reason && (
                        <p className="text-xs text-muted-foreground bg-muted/20 p-2 rounded-lg border border-border/40 italic">
                          &quot;{l.reason}&quot;
                        </p>
                      )}

                      <div className="flex justify-end pt-1">
                        <DeleteLeaveButton id={l.id} label={t.common.remove} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-2xl p-6">
              {t.settings.noLeavesRecordedForYear.replace(
                "{year}",
                isGu ? toGujaratiNumerals(currentYear) : String(currentYear),
              )}
            </div>
          )}
        </RegisteredLeavesAccordion>
          </>
        )}

        {activeTab === "print" && (
          <PrintConfigPanel
            settings={settings}
            officerName={userRow?.full_name ?? user?.fullName ?? "પોલીસ અધિકારી"}
            officerPost={userRow?.designation ?? null}
            officerPosting={userRow?.current_posting ?? null}
            employeeCode={userRow?.employee_code ?? null}
          />
        )}

        {activeTab === "language" && (
          <Card className="p-6 sm:p-8 space-y-6">
            <div className="border-b border-border pb-4">
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                Language & Regional Settings / ભાષા પસંદગી
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Switch seamlessly between English and Gujarati across all screens and reports.
              </p>
            </div>
            <LanguageToggle variant="settings" />
          </Card>
        )}
      </div>
    </main>
  );
}
