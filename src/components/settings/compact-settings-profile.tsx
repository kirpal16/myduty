"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import {
  Shield,
  MapPin,
  ChevronRight,
  Loader2,
  Check,
  Award,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { OfficerAvatarEditor } from "@/components/profile/officer-avatar-editor";
import { DepartmentCombobox } from "@/components/profile/department-combobox";
import { updateOfficerProfileDetails } from "@/actions/profile";
import { useToast } from "@/components/ui/toast";
import type { FormState } from "@/lib/forms/formState";
import type { OfficerProfileData } from "@/components/profile/officer-profile-container";
import { useLanguage } from "@/lib/i18n/language-context";
import { toGujaratiNumerals } from "@/lib/reports/gujaratiReportUtils";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] as const;

interface CompactSettingsProfileProps {
  officer: OfficerProfileData;
  departments: { id: string; name: string }[];
}

export function CompactSettingsProfile({
  officer,
  departments,
}: CompactSettingsProfileProps) {
  const { isGujarati, t } = useLanguage();
  const { toast } = useToast();
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    updateOfficerProfileDetails,
    undefined
  );

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast(state.message ?? "Profile updated successfully.", "success", 4000);
    } else if (state.message) {
      toast(state.message, "error", 4000);
    }
  }, [state, toast]);

  return (
    <Card className="p-4 sm:p-7 border border-border/80 shadow-xs">
      {/* 1. Header: Officer Summary & Quick Career Timeline Link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/80">
        <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
          <OfficerAvatarEditor
            fullName={officer.fullName}
            avatarUrl={officer.avatarUrl}
            designation={officer.designation}
            canEdit={true}
          />

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground truncate">
                {officer.fullName}
              </h2>
              {officer.status && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {t.settings.activeStatus}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {officer.designation && (
                <span className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400">
                  <Shield className="size-3.5 fill-current" />
                  <span>{officer.designation}</span>
                </span>
              )}

              {officer.departmentName && (
                <>
                  {officer.designation && <span className="text-muted-foreground/60">•</span>}
                  <span className="text-muted-foreground font-medium truncate max-w-[180px] sm:max-w-xs">
                    {officer.departmentName}
                  </span>
                </>
              )}

              {officer.employeeCode && (
                <>
                  <span className="text-muted-foreground/60">•</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {isGujarati ? toGujaratiNumerals(officer.employeeCode) : officer.employeeCode}
                  </span>
                </>
              )}
            </div>

            {officer.currentPosting && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 truncate max-w-sm">
                <MapPin className="size-3 text-indigo-500 shrink-0" />
                <span className="truncate">{officer.currentPosting}</span>
              </p>
            )}
          </div>
        </div>

        {/* Link to dedicated Career Timeline */}
        <Link
          href="/profile"
          className="inline-flex items-center justify-between sm:justify-center gap-2 px-3.5 py-2 rounded-xl border border-border bg-muted/40 hover:bg-muted text-xs font-semibold text-foreground hover:text-indigo-600 dark:hover:text-indigo-400 shadow-2xs transition-colors shrink-0 group"
        >
          <div className="flex items-center gap-2">
            <Award className="size-4 text-amber-500 shrink-0" />
            <span>{t.settings.careerTimelineAndHonours}</span>
          </div>
          <ChevronRight className="size-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* 2. Profile Details Form */}
      <div className="pt-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-foreground">
              {t.settings.personalOfficialDetails}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t.settings.personalDetailsSubtitle}
            </p>
          </div>
          <span className="text-xs text-muted-foreground hidden xs:inline">
            <span className="text-rose-500">*</span> {t.common.required}
          </span>
        </div>

        <form action={formAction} className="space-y-4">
          {/* Hidden fields to preserve data from other sections */}
          <input type="hidden" name="homeDistrict" value={officer.homeDistrict ?? ""} />
          <input type="hidden" name="bio" value={officer.bio ?? ""} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {t.settings.fullName} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="fullName"
                required
                key={`fn-${officer.fullName}`}
                defaultValue={officer.fullName ?? ""}
                placeholder={t.settings.fullNamePlaceholder}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
              {state?.errors?.fullName && (
                <p className="text-[11px] text-rose-500 mt-1 font-medium">
                  {state.errors.fullName[0]}
                </p>
              )}
            </div>

            {/* Rank / Designation */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {t.settings.designationRank}
              </label>
              <input
                type="text"
                name="designation"
                key={`des-${officer.designation}`}
                defaultValue={officer.designation ?? ""}
                placeholder={t.settings.designationPlaceholder}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>

            {/* Department (Dynamic Combobox) */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {t.settings.departmentBranch}
              </label>
              <DepartmentCombobox
                name="departmentId"
                key={`dept-${officer.departmentId}`}
                initialDepartmentId={officer.departmentId}
                departments={departments}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t.settings.departmentHelper}
              </p>
            </div>

            {/* Current Police Station / Posting */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {t.settings.currentStationPosting}
              </label>
              <input
                type="text"
                name="currentPosting"
                key={`pos-${officer.currentPosting}`}
                defaultValue={officer.currentPosting ?? ""}
                placeholder={t.settings.currentStationPlaceholder}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>

            {/* Contact Phone Number */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {t.settings.contactPhone}
              </label>
              <input
                type="tel"
                name="phone"
                key={`ph-${officer.phone}`}
                defaultValue={officer.phone ?? ""}
                placeholder="+91 98765 43210"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
              {state?.errors?.phone && (
                <p className="text-[11px] text-rose-500 mt-1 font-medium">
                  {state.errors.phone[0]}
                </p>
              )}
            </div>

            {/* Buckle / Badge Number */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {t.settings.buckleBadgeNumber}
              </label>
              <input
                type="text"
                name="employeeCode"
                key={`emp-${officer.employeeCode}`}
                defaultValue={officer.employeeCode ?? ""}
                placeholder={t.settings.bucklePlaceholder}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>

            {/* Blood Group */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {t.settings.bloodGroup}
              </label>
              <select
                name="bloodGroup"
                key={`bg-${officer.bloodGroup}`}
                defaultValue={officer.bloodGroup ?? ""}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs sm:text-sm text-foreground focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 transition-colors"
              >
                <option value="">{t.settings.selectBloodGroup}</option>
                {BLOOD_GROUPS.map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>

            {/* Emergency Contact */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {t.settings.emergencyContact}
              </label>
              <input
                type="text"
                name="emergencyContact"
                key={`ec-${officer.emergencyContact}`}
                defaultValue={officer.emergencyContact ?? ""}
                placeholder={t.settings.emergencyContactPlaceholder}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>

            {/* Service Joining Date */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {t.settings.govtJoiningDate}
              </label>
              <input
                type="date"
                name="joiningDate"
                key={`jdate-${officer.joiningDate}`}
                defaultValue={officer.joiningDate ?? ""}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs sm:text-sm text-foreground focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>

            {/* Initial Joining Place */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {t.settings.initialJoiningPlace}
              </label>
              <input
                type="text"
                name="joiningPlace"
                key={`jplace-${officer.joiningPlace}`}
                defaultValue={officer.joiningPlace ?? ""}
                placeholder={t.settings.initialJoiningPlacePlaceholder}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>

            {/* Date of Birth */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {t.settings.dateOfBirth}
              </label>
              <input
                type="date"
                name="dateOfBirth"
                key={`dob-${officer.dateOfBirth}`}
                defaultValue={officer.dateOfBirth ?? ""}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs sm:text-sm text-foreground focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Form Action Button */}
          <div className="flex items-center justify-end pt-4 border-t border-border/80">
            <button
              type="submit"
              disabled={isPending}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-indigo-600/20 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>{t.settings.savingProfile}</span>
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  <span>{t.settings.saveProfile}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Card>
  );
}
