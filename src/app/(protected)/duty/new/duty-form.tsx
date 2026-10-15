"use client";

import { useState, useActionState, startTransition } from "react";
import { NavLink as Link } from "@/components/ui/nav-link";
import { createDuty, updateDuty, type DutyFormState } from "@/actions/duty";
import {
  Clock,
  MapPin,
  Compass,
  IndianRupee,
  Loader2,
  Briefcase,
  FileText,
  Navigation,
  Sparkles,
  Car,
  ShieldCheck,
  ChevronDown,
  Plus,
  Moon,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { FormFileInput } from "@/components/ui/form-file-input";
import { FormSelect } from "@/components/ui/form-select";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { FieldError } from "@/components/ui/field-error";
import { AutoDismissBanner } from "@/components/ui/auto-dismiss-banner";
import { useFormFeedback } from "@/lib/hooks/useFormFeedback";
import { useFormDirty } from "@/lib/hooks/useFormDirty";
import { dutySchema, dutyValuesFromForm } from "@/lib/validations/duty";
import {
  resolveHoliday,
  holidayKindLabel,
  type HolidayRecord,
} from "@/lib/holidays/resolveHoliday";
import {
  formatDutyTypeDropdownLabel,
  sortDutyTypesForDropdown,
  toGujaratiNumerals,
} from "@/lib/reports/gujaratiReportUtils";
import { splitIntoDailyDuties } from "@/lib/duty/splitDuty";
import { useLinkedEndDate, deriveDutyEnd } from "@/lib/hooks/useLinkedEndDate";
import { DutyDayRows } from "./duty-day-rows";
import { useLanguage } from "@/lib/i18n/language-context";

type DutyType = { id: string; name: string };

export type DutyDefaults = {
  dutyTypeId?: string;
  startsAt?: string;
  endsAt?: string;
  location?: string | null;
  notes?: string | null;
  taFromPlace?: string | null;
  taToPlace?: string | null;
  taVehicleType?: string | null;
  taDistanceKm?: number | null;
  taAmount?: number | null;
  holidayAllowance?: number | null;
  manualHolidayClaim?: boolean;
};

export type AdditionalShiftItem = {
  id: string;
  dbId?: string;
  dutyTypeId: string;
  startsAt: string;
  endsAt: string;
  isNextDay: boolean;
  location: string;
  notes: string;
  taOpen: boolean;
  taFromPlace: string;
  taToPlace: string;
  taVehicleType: string;
  taDistanceKm: string;
  taAmount: string;
};

/**
 * Checks whether endIso represents a date after startIso (i.e. overnight into next day).
 */
function checkIsNextDay(startIso?: string | null, endIso?: string | null): boolean {
  if (!startIso || !endIso) return false;
  const startDate = startIso.split("T")[0];
  const endDate = endIso.split("T")[0];
  if (!startDate || !endDate) return false;
  return endDate > startDate;
}

/**
 * Adds or subtracts days to a YYYY-MM-DD date string without UTC timezone drift.
 */
function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const nextY = dt.getFullYear();
  const nextM = String(dt.getMonth() + 1).padStart(2, "0");
  const nextD = String(dt.getDate()).padStart(2, "0");
  return `${nextY}-${nextM}-${nextD}`;
}

/**
 * Given a startsAt datetime-local string, an endsAt datetime-local string,
 * and the target nextDay boolean, returns the synchronized endsAt string.
 */
function syncEndsAtDate(startIso: string, endIso: string, isNextDay: boolean): string {
  if (!startIso) return endIso;
  const startDate = startIso.split("T")[0];
  const endTime = endIso && endIso.includes("T") ? endIso.split("T")[1] : "18:00";
  const targetDate = isNextDay ? addDaysToDateString(startDate, 1) : startDate;
  return `${targetDate}T${endTime}`;
}

/**
 * Calculate shift duration in hours and minutes for friendly mobile display.
 */
function calculateShiftDuration(startIso?: string, endIso?: string): { hours: number; minutes: number } | null {
  if (!startIso || !endIso) return null;
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  if (isNaN(s) || isNaN(e) || e <= s) return null;
  const diffMins = Math.floor((e - s) / (1000 * 60));
  const hours = Math.floor(diffMins / 60);
  const minutes = diffMins % 60;
  return { hours, minutes };
}

/**
 * Formats duration into human-readable English or Gujarati.
 */
function formatDuration(
  duration: { hours: number; minutes: number } | null,
  isGu: boolean
): string | null {
  if (!duration) return null;
  const { hours, minutes } = duration;
  if (hours === 0 && minutes === 0) return null;
  const hStr = isGu ? `${toGujaratiNumerals(hours)} કલાક` : `${hours}h`;
  const mStr =
    minutes > 0
      ? isGu
        ? ` ${toGujaratiNumerals(minutes)} મિ.`
        : ` ${minutes}m`
      : "";
  return `${hStr}${mStr}`;
}

/**
 * Checks if two time intervals overlap (s1 < e2 && s2 < e1).
 */
function intervalsOverlap(s1?: string, e1?: string, s2?: string, e2?: string): boolean {
  if (!s1 || !e1 || !s2 || !e2) return false;
  const start1 = new Date(s1).getTime();
  const end1 = new Date(e1).getTime();
  const start2 = new Date(s2).getTime();
  const end2 = new Date(e2).getTime();
  if (isNaN(start1) || isNaN(end1) || isNaN(start2) || isNaN(end2)) return false;
  return start1 < end2 && start2 < end1;
}

export function DutyForm({
  dutyTypes,
  dutyId,
  defaults,
  initialAdditionalShifts = [],
  initialFile,
  canUploadFiles = false,
  holidays = [],
  holidayDayRate = 0,
  defaultShiftEnd = "18:00",
  enableMultiDuty = false,
}: {
  dutyTypes: DutyType[];
  dutyId?: string;
  defaults?: DutyDefaults;
  initialAdditionalShifts?: AdditionalShiftItem[];
  initialFile?: {
    id?: string;
    name: string;
    url: string;
    size?: number;
    mimeType?: string;
    createdAt?: string;
    description?: string | null;
  } | null;
  canUploadFiles?: boolean;
  holidays?: HolidayRecord[];
  holidayDayRate?: number;
  defaultShiftEnd?: string;
  enableMultiDuty?: boolean;
}) {
  const { t, isGujarati } = useLanguage();
  const [startsAtVal, setStartsAtVal] = useState(defaults?.startsAt ?? "");

  // Detect if default starts/ends spans into the next day (edit mode synchronization)
  const initialIsNextDay = Boolean(checkIsNextDay(defaults?.startsAt, defaults?.endsAt));
  const [isNextDay, setIsNextDay] = useState(initialIsNextDay);

  const {
    endValue: endsAtVal,
    onStartChange: linkEnd,
    onEndChange: setEndsAtVal,
  } = useLinkedEndDate({
    initialEnd: defaults?.endsAt ?? "",
    deriveEnd: deriveDutyEnd(defaultShiftEnd),
  });

  const [manualClaim, setManualClaim] = useState(defaults?.manualHolidayClaim ?? false);

  const [holidayPayOpen, setHolidayPayOpen] = useState(false);
  const [holidayPayVal, setHolidayPayVal] = useState(
    defaults?.holidayAllowance != null
      ? String(defaults.holidayAllowance)
      : holidayDayRate > 0
        ? String(holidayDayRate)
        : "",
  );

  const hasTaDefaults = Boolean(
    defaults?.taFromPlace ||
      defaults?.taToPlace ||
      defaults?.taDistanceKm != null ||
      defaults?.taAmount != null,
  );
  const [taOpen, setTaOpen] = useState(hasTaDefaults);
  const [vehicleType, setVehicleType] = useState<string>(defaults?.taVehicleType ?? "govt");
  const [taAmountVal, setTaAmountVal] = useState(defaults?.taAmount?.toString() ?? "");
  const [taKmVal, setTaKmVal] = useState(defaults?.taDistanceKm?.toString() ?? "");

  const [dutyTypeIdVal, setDutyTypeIdVal] = useState(defaults?.dutyTypeId ?? "");
  const [locationVal, setLocationVal] = useState(defaults?.location ?? "");
  const [notesVal, setNotesVal] = useState(defaults?.notes ?? "");
  const [taFromPlaceVal, setTaFromPlaceVal] = useState(defaults?.taFromPlace ?? "");
  const [taToPlaceVal, setTaToPlaceVal] = useState(defaults?.taToPlace ?? "");

  const [additionalShifts, setAdditionalShifts] = useState<AdditionalShiftItem[]>(
    initialAdditionalShifts
  );

  const action = dutyId ? updateDuty.bind(null, dutyId) : createDuty;
  const [state, formAction, pending] = useActionState<DutyFormState, FormData>(
    action,
    undefined
  );

  const { formRef: dirtyRef, dirty } = useFormDirty();

  const { formRef, fieldProps, errorProps } = useFormFeedback({
    state,
    schema: dutySchema,
    toValues: dutyValuesFromForm,
  });

  const taHasError = Boolean(
    errorProps("taDistanceKm").message || errorProps("taAmount").message,
  );
  const taVisible = taOpen || taHasError;

  const holidayInfo = startsAtVal
    ? resolveHoliday(startsAtVal, holidays)
    : { isHoliday: false, qualifiesForHolidayAllowance: false };

  const slots =
    !dutyId && !isNextDay && startsAtVal && endsAtVal && new Date(endsAtVal) > new Date(startsAtVal)
      ? splitIntoDailyDuties(new Date(startsAtVal), new Date(endsAtVal))
      : [];
  const isMultiDay = slots.length > 1 && additionalShifts.length === 0;

  const handlePrimaryStartChange = (val: string) => {
    setStartsAtVal(val);
    if (isNextDay) {
      const updatedEnd = syncEndsAtDate(val, endsAtVal, true);
      setEndsAtVal(updatedEnd);
    } else {
      linkEnd(val);
    }
  };

  const handlePrimaryEndChange = (val: string) => {
    setEndsAtVal(val);
    if (startsAtVal && val) {
      setIsNextDay(checkIsNextDay(startsAtVal, val));
    }
  };

  const handleTogglePrimaryNextDay = () => {
    const next = !isNextDay;
    setIsNextDay(next);
    if (startsAtVal) {
      const updatedEnd = syncEndsAtDate(
        startsAtVal,
        endsAtVal || `${startsAtVal.split("T")[0]}T${defaultShiftEnd}`,
        next
      );
      setEndsAtVal(updatedEnd);
    }
  };

  const primaryDuration = calculateShiftDuration(startsAtVal, endsAtVal);
  const primaryDurationLabel = formatDuration(primaryDuration, isGujarati);

  const handleAddShift = () => {
    const baseDate = startsAtVal ? startsAtVal.split("T")[0] : new Date().toISOString().split("T")[0];
    const lastEnd =
      additionalShifts.length > 0
        ? additionalShifts[additionalShifts.length - 1].endsAt
        : endsAtVal;

    let nextStartHour = "17:00";
    let nextEndHour = "21:00";

    if (lastEnd && lastEnd.includes("T")) {
      const lastEndH = parseInt(lastEnd.split("T")[1].split(":")[0], 10);
      if (lastEndH <= 14) {
        nextStartHour = "17:00";
        nextEndHour = "21:00";
      } else if (lastEndH <= 18) {
        nextStartHour = "20:00";
        nextEndHour = "23:00";
      } else {
        nextStartHour = "22:00";
        nextEndHour = "06:00";
      }
    }

    const isOvernight = nextEndHour < nextStartHour;
    const newShift: AdditionalShiftItem = {
      id: `shift-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      dutyTypeId: defaults?.dutyTypeId || dutyTypes[0]?.id || "",
      startsAt: `${baseDate}T${nextStartHour}`,
      endsAt: isOvernight ? `${addDaysToDateString(baseDate, 1)}T${nextEndHour}` : `${baseDate}T${nextEndHour}`,
      isNextDay: isOvernight,
      location: defaults?.location ?? "",
      notes: "",
      taOpen: false,
      taFromPlace: "",
      taToPlace: "",
      taVehicleType: "govt",
      taDistanceKm: "",
      taAmount: "",
    };

    setAdditionalShifts((prev) => [...prev, newShift]);
  };

  const handleUpdateShift = (index: number, updates: Partial<AdditionalShiftItem>) => {
    setAdditionalShifts((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  const handleRemoveShift = (index: number) => {
    setAdditionalShifts((prev) => prev.filter((_, i) => i !== index));
  };

  const hasShiftConflict = (() => {
    const all = [
      { startsAt: startsAtVal, endsAt: endsAtVal },
      ...additionalShifts.map((s) => ({ startsAt: s.startsAt, endsAt: s.endsAt })),
    ];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        if (intervalsOverlap(all[i].startsAt, all[i].endsAt, all[j].startsAt, all[j].endsAt)) {
          return true;
        }
      }
    }
    return false;
  })();

  return (
    <form
      ref={(node) => {
        formRef.current = node;
        dirtyRef.current = node;
      }}
      onSubmit={(e) => {
        e.preventDefault();
        if (hasShiftConflict) return;
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      noValidate
      className="flex flex-col gap-3.5 sm:gap-4"
    >
      {state?.message && (
        <AutoDismissBanner
          message={state.message}
          tone="error"
          autoHideMs={4000}
        />
      )}

      {/* Hidden input to signal explicit overnight to server action */}
      <input type="hidden" name="isNextDay" value={isNextDay ? "true" : "false"} />

      {/* Primary Shift Container */}
      <div className="rounded-xl border border-border/70 bg-card/70 p-3 sm:p-4 space-y-3 shadow-2xs">
        {/* Compact Header */}
        <div className="flex items-center justify-between border-b border-border/50 pb-2">
          <div className="flex items-center gap-2">
            <Clock className="size-3.5 text-indigo-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              {enableMultiDuty && additionalShifts.length > 0 ? t.duty.shift1Title : t.duty.shiftDetailsTitle}
            </h3>
          </div>

          {primaryDurationLabel && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-muted/80 text-foreground border border-border/60">
              <Clock className="size-2.5 text-slate-400" />
              <span>{primaryDurationLabel}</span>
            </span>
          )}
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
          {/* Duty Type */}
          <div className="flex flex-col gap-1 sm:col-span-1">
            <label
              htmlFor="dutyTypeId"
              className="text-xs font-semibold text-foreground flex items-center gap-1"
            >
              <Briefcase className="size-3 text-slate-400" />
              <span>{t.duty.dutyTypeLabel}</span>
              <span className="text-rose-500">*</span>
            </label>
            <FormSelect
              id="dutyTypeId"
              {...fieldProps("dutyTypeId")}
              required
              placeholder={t.duty.selectDutyTypePlaceholder}
              value={dutyTypeIdVal}
              onChange={(val) => setDutyTypeIdVal(val)}
              icon={Briefcase}
              error={!!errorProps("dutyTypeId").message}
              options={sortDutyTypesForDropdown(dutyTypes).map((d) => ({
                value: d.id,
                label: formatDutyTypeDropdownLabel(d.name),
              }))}
            />
            <FieldError {...errorProps("dutyTypeId")} />
          </div>

          {/* Starts At */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="startsAt"
              className="text-xs font-semibold text-foreground flex items-center gap-1"
            >
              <Clock className="size-3 text-slate-400" />
              <span>{t.duty.startsAtLabel}</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              id="startsAt"
              {...fieldProps("startsAt")}
              type="datetime-local"
              required
              value={startsAtVal}
              onChange={(e) => handlePrimaryStartChange(e.target.value)}
              className={`w-full h-9 sm:h-10 rounded-lg border bg-card px-3 py-1.5 text-xs sm:text-sm shadow-2xs transition-colors focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 ${
                errorProps("startsAt").message
                  ? "border-rose-500"
                  : "border-border hover:border-slate-400 dark:hover:border-slate-600"
              }`}
            />
            <FieldError {...errorProps("startsAt")} />
          </div>

          {/* Ends At with Inline "Till Next Day" Toggle */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-1">
              <label
                htmlFor="endsAt"
                className="text-xs font-semibold text-foreground flex items-center gap-1 truncate"
              >
                <Clock className="size-3 text-slate-400 shrink-0" />
                <span className="truncate">{t.duty.endsAtLabel}</span>
                <span className="text-rose-500">*</span>
              </label>

              {/* Compact Inline Next Day Button */}
              <button
                type="button"
                onClick={handleTogglePrimaryNextDay}
                aria-pressed={isNextDay}
                title={t.duty.overnightDutyHint}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer select-none active:scale-95 shrink-0 ${
                  isNextDay
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/70"
                }`}
              >
                <Moon className={`size-3 ${isNextDay ? "fill-white text-white" : "text-muted-foreground"}`} />
                <span>{isNextDay ? t.duty.endsNextDayBadge : t.duty.tillNextDay}</span>
              </button>
            </div>

            <input
              id="endsAt"
              {...fieldProps("endsAt")}
              type="datetime-local"
              required
              value={endsAtVal}
              onChange={(e) => handlePrimaryEndChange(e.target.value)}
              className={`w-full h-9 sm:h-10 rounded-lg border bg-card px-3 py-1.5 text-xs sm:text-sm shadow-2xs transition-colors focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 ${
                errorProps("endsAt").message
                  ? "border-rose-500"
                  : "border-border hover:border-slate-400 dark:hover:border-slate-600"
              }`}
            />
            <FieldError {...errorProps("endsAt")} />
          </div>
        </div>

        {/* Location & Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="location"
              className="text-xs font-semibold text-foreground flex items-center gap-1"
            >
              <MapPin className="size-3 text-slate-400" />
              <span>{t.duty.stationLocationLabel}</span>
              <span className="text-muted-foreground text-[10px]">
                ({t.settings.optionalLabel})
              </span>
            </label>
            <input
              id="location"
              name="location"
              placeholder={t.duty.stationPlaceholder}
              value={locationVal}
              onChange={(e) => setLocationVal(e.target.value)}
              className="w-full h-9 sm:h-10 rounded-lg border border-border bg-card px-3 py-1.5 text-xs sm:text-sm shadow-2xs hover:border-slate-400 dark:hover:border-slate-600 transition-colors focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="notes"
              className="text-xs font-semibold text-foreground flex items-center gap-1"
            >
              <FileText className="size-3 text-slate-400" />
              <span>{t.duty.operationalNotesLabel}</span>
              <span className="text-muted-foreground text-[10px]">
                ({t.settings.optionalLabel})
              </span>
            </label>
            <input
              id="notes"
              name="notes"
              placeholder={t.duty.operationalNotesPlaceholder}
              value={notesVal}
              onChange={(e) => setNotesVal(e.target.value)}
              className="w-full h-9 sm:h-10 rounded-lg border border-border bg-card px-3 py-1.5 text-xs sm:text-sm shadow-2xs hover:border-slate-400 dark:hover:border-slate-600 transition-colors focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        {/* Holiday extra pay section */}
        {isMultiDay ? (
          <DutyDayRows
            slots={slots}
            holidays={holidays}
            holidayDayRate={holidayDayRate}
            shared={{
              taFromPlace: defaults?.taFromPlace ?? undefined,
              taToPlace: defaults?.taToPlace ?? undefined,
              taVehicleType: vehicleType,
              taDistanceKm: defaults?.taDistanceKm?.toString(),
              taAmount: defaults?.taAmount?.toString(),
            }}
          />
        ) : holidayInfo.kind === "optional_holiday" ? (
          <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-2.5 text-xs font-medium text-purple-900 dark:text-purple-200 flex items-start gap-2">
            <Sparkles className="mt-0.5 size-3.5 text-purple-500 shrink-0" />
            <span>
              <strong>{t.settings.optionalHolidaysTitle}</strong>
              {holidayInfo.name ? ` — ${holidayInfo.name}` : ""}: {t.duty.optionalHolidayNoPayNotice}
            </span>
          </div>
        ) : holidayInfo.qualifiesForHolidayAllowance ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-1">
            <CollapsibleSection
              title={t.duty.holidayDutyExtraPayTitle}
              icon={Sparkles}
              iconClassName="text-amber-500"
              open={holidayPayOpen}
              onToggle={() => setHolidayPayOpen((o) => !o)}
              summary={
                <span className="flex items-center gap-1.5">
                  {holidayPayVal ? <strong className="text-foreground">₹{holidayPayVal}</strong> : t.duty.notClaimed}
                  <span className="hidden sm:inline">· {holidayInfo.name || holidayKindLabel(holidayInfo.kind)}</span>
                </span>
              }
            >
              <div className="flex flex-col gap-1.5 pb-3">
                <label
                  htmlFor="holidayAllowance"
                  className="text-xs font-semibold text-foreground flex items-center gap-1"
                >
                  <IndianRupee className="size-3 text-amber-500" />
                  <span>{t.duty.holidayExtraPayFieldLabel}</span>
                </label>
                <input
                  id="holidayAllowance"
                  name="holidayAllowance"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={holidayDayRate > 0 ? String(holidayDayRate) : "e.g. 500.00"}
                  value={holidayPayVal}
                  onChange={(e) => setHolidayPayVal(e.target.value)}
                  className="w-full h-9 rounded-lg border border-amber-500/30 bg-card px-3 py-1.5 text-xs sm:text-sm shadow-2xs focus:border-amber-500 focus:outline-hidden"
                />
              </div>
            </CollapsibleSection>
          </div>
        ) : !manualClaim ? (
          <div className="rounded-lg border border-dashed border-border/80 bg-card/50 px-3 py-2 hover:border-amber-500/40 hover:bg-amber-500/5 transition-all">
            <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="manualHolidayClaim"
                  checked={manualClaim}
                  onChange={(e) => setManualClaim(e.target.checked)}
                  className="size-3.5 rounded border-border text-amber-600 focus:ring-amber-500/30 cursor-pointer"
                />
                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  <Sparkles className="size-3 text-amber-500" />
                  <span className="font-semibold text-foreground">
                    {t.duty.claimHolidayPayLabel}
                  </span>
                  <span className="text-muted-foreground text-[10px]">
                    {t.duty.holidayExtraPayTag}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md hidden sm:inline">
                {t.duty.tickToClaim}
              </span>
            </label>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2.5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-amber-500" />
                <h4 className="text-xs font-bold text-foreground">
                  {t.duty.holidayDutyExtraPayTitle}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setManualClaim(false)}
                className="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer"
              >
                {t.common.cancel}
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="holidayAllowance"
                className="text-xs font-semibold text-foreground flex items-center gap-1"
              >
                <IndianRupee className="size-3 text-amber-500" />
                <span>{t.duty.holidayExtraPayFieldLabel}</span>
              </label>
              <input
                id="holidayAllowance"
                name="holidayAllowance"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 500.00"
                defaultValue={
                  defaults?.holidayAllowance != null
                    ? String(defaults.holidayAllowance)
                    : holidayDayRate > 0
                      ? String(holidayDayRate)
                      : ""
                }
                className="w-full h-9 rounded-lg border border-amber-500/30 bg-card px-3 py-1.5 text-xs sm:text-sm shadow-2xs focus:border-amber-500 focus:outline-hidden"
              />
            </div>
          </div>
        )}

        {/* Primary Shift Travelling Allowance (TA) accordion */}
        <div className={`transition-all duration-200 ${isMultiDay ? "hidden" : ""}`}>
          <div
            className={`rounded-xl border transition-all duration-150 overflow-hidden ${
              taVisible
                ? "border-sky-500/40 bg-sky-500/[0.03] dark:bg-sky-950/20 shadow-2xs"
                : "border-border/70 bg-card/60 hover:border-sky-500/30"
            }`}
          >
            <button
              type="button"
              onClick={() => setTaOpen(!taVisible)}
              aria-expanded={taVisible}
              className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left group select-none transition-colors"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Compass
                  className={`size-3.5 shrink-0 transition-colors ${
                    taVisible ? "text-sky-500" : "text-sky-500/80"
                  }`}
                />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-foreground truncate transition-colors">
                  {t.duty.taClaimTitle}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {taAmountVal || taKmVal ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                    <span>₹{taAmountVal || "0"}</span>
                    {taKmVal && <span>· {taKmVal} km</span>}
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {t.duty.notClaimed}
                  </span>
                )}
                <ChevronDown
                  className={`size-3.5 text-muted-foreground transition-transform duration-150 shrink-0 ${
                    taVisible ? "rotate-180 text-sky-500" : ""
                  }`}
                />
              </div>
            </button>

            <div
              className={
                taVisible
                  ? "p-3 pt-2.5 border-t border-sky-500/20 space-y-2.5 animate-in fade-in-50 duration-150"
                  : "hidden"
              }
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="taFromPlace"
                    className="text-xs font-semibold text-foreground flex items-center gap-1"
                  >
                    <Navigation className="size-3 text-sky-500" />
                    <span>{t.duty.departurePlaceLabel}</span>
                  </label>
                  <input
                    id="taFromPlace"
                    name="taFromPlace"
                    placeholder={t.duty.departurePlaceholder}
                    value={taFromPlaceVal}
                    onChange={(e) => setTaFromPlaceVal(e.target.value)}
                    className="w-full h-9 rounded-lg border border-border bg-card px-3 py-1.5 text-xs sm:text-sm shadow-2xs hover:border-slate-400 dark:hover:border-slate-600 transition-colors focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="taToPlace"
                    className="text-xs font-semibold text-foreground flex items-center gap-1"
                  >
                    <MapPin className="size-3 text-sky-500" />
                    <span>{t.duty.arrivalPlaceLabel}</span>
                  </label>
                  <input
                    id="taToPlace"
                    name="taToPlace"
                    placeholder={t.duty.arrivalPlaceholder}
                    value={taToPlaceVal}
                    onChange={(e) => setTaToPlaceVal(e.target.value)}
                    className="w-full h-9 rounded-lg border border-border bg-card px-3 py-1.5 text-xs sm:text-sm shadow-2xs hover:border-slate-400 dark:hover:border-slate-600 transition-colors focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Compact Vehicle Type Selection */}
              <div className="flex flex-col gap-1">
                <div className="grid grid-cols-2 gap-1.5 p-0.5 rounded-lg bg-muted/60 border border-border">
                  <button
                    type="button"
                    onClick={() => setVehicleType("private")}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      vehicleType === "private"
                        ? "bg-card text-foreground shadow-2xs border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Car className="size-3 text-sky-500" />
                    <span>{t.duty.privateVehicle}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVehicleType("govt")}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      vehicleType === "govt"
                        ? "bg-card text-foreground shadow-2xs border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <ShieldCheck className="size-3 text-emerald-500" />
                    <span>{t.duty.govtVehicle}</span>
                  </button>
                </div>
                <input type="hidden" name="taVehicleType" value={vehicleType} />
              </div>

              {/* Distance and Claim Amount side-by-side */}
              <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="taDistanceKm"
                    className="text-xs font-semibold text-foreground flex items-center gap-1"
                  >
                    <Compass className="size-3 text-slate-400" />
                    <span>{t.duty.totalDistanceKm}</span>
                  </label>
                  <input
                    id="taDistanceKm"
                    {...fieldProps("taDistanceKm")}
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="24.5"
                    value={taKmVal}
                    onChange={(e) => setTaKmVal(e.target.value)}
                    className={`w-full h-9 rounded-lg border bg-card px-3 py-1.5 text-xs sm:text-sm shadow-2xs transition-colors focus:border-indigo-500 focus:outline-hidden ${
                      errorProps("taDistanceKm").message
                        ? "border-rose-500"
                        : "border-border hover:border-slate-400 dark:hover:border-slate-600"
                    }`}
                  />
                  <FieldError {...errorProps("taDistanceKm")} />
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="taAmount"
                    className="text-xs font-semibold text-foreground flex items-center gap-1"
                  >
                    <IndianRupee className="size-3 text-emerald-500" />
                    <span>{t.duty.claimAmount}</span>
                  </label>
                  <input
                    id="taAmount"
                    {...fieldProps("taAmount")}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="50.00"
                    value={taAmountVal}
                    onChange={(e) => setTaAmountVal(e.target.value)}
                    className={`w-full h-9 rounded-lg border bg-card px-3 py-1.5 text-xs sm:text-sm shadow-2xs transition-colors focus:border-indigo-500 focus:outline-hidden ${
                      errorProps("taAmount").message
                        ? "border-rose-500"
                        : "border-border hover:border-slate-400 dark:hover:border-slate-600"
                    }`}
                  />
                  <FieldError {...errorProps("taAmount")} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Shifts Cards (Split Shifts on Same Day) */}
      {enableMultiDuty &&
        additionalShifts.map((shift, index) => (
          <AdditionalShiftCard
            key={shift.id}
            index={index}
            shift={shift}
            dutyTypes={dutyTypes}
            onUpdate={(updates) => handleUpdateShift(index, updates)}
            onRemove={() => handleRemoveShift(index)}
            t={t}
            isGujarati={isGujarati}
          />
        ))}

      {/* Compact "+ Add Another Shift (Same Day)" Button - Only when enableMultiDuty is active */}
      {enableMultiDuty && (
        <div>
          <button
            type="button"
            onClick={handleAddShift}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-dashed border-indigo-500/40 bg-indigo-500/[0.03] hover:bg-indigo-500/[0.08] hover:border-indigo-500/70 active:scale-[0.99] text-indigo-600 dark:text-indigo-400 font-semibold text-xs transition-all cursor-pointer group shadow-2xs"
          >
            <Plus className="size-3.5 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
            <span>{t.duty.addAnotherShift}</span>
            <span className="text-[10px] text-muted-foreground font-normal hidden sm:inline">
              — {t.duty.splitShiftHint}
            </span>
          </button>
        </div>
      )}

      {/* Attachment Upload for Duty (Tickets, Receipts, Photos) */}
      {canUploadFiles && (
        <FormFileInput
          name="file"
          label={t.duty.attachShiftDoc}
          helperText={t.duty.attachShiftDocHelp}
          initialFile={initialFile}
        />
      )}

      {/* Shift Time Overlap Warning Banner */}
      {hasShiftConflict && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="size-3.5 shrink-0 text-rose-600" />
          <span>{t.duty.shiftTimeOverlapError}</span>
        </div>
      )}

      {/* Action Buttons: Cancel and Submit */}
      <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
        <Link
          href="/duty"
          className="flex items-center justify-center rounded-lg border border-border bg-card px-3.5 py-2 min-h-[38px] text-xs font-semibold text-foreground hover:bg-muted transition-colors text-center"
        >
          {t.common.cancel}
        </Link>
        <button
          type="submit"
          disabled={pending || (dutyId ? !dirty && additionalShifts.length === 0 : false) || hasShiftConflict}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 px-5 py-2 min-h-[38px] text-xs font-semibold text-white shadow-sm shadow-indigo-600/30 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-50 transition-all cursor-pointer active:scale-[0.99]"
        >
          {pending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              <span>{t.duty.savingStatus}</span>
            </>
          ) : additionalShifts.length > 0 ? (
            <span>
              {dutyId
                ? (isGujarati
                    ? `${toGujaratiNumerals(1 + additionalShifts.length)} શિફ્ટ્સ અપડેટ કરો`
                    : `Update ${1 + additionalShifts.length} Shifts`)
                : t.duty.submitMultipleDuties.replace(
                    "{count}",
                    isGujarati ? toGujaratiNumerals(1 + additionalShifts.length) : String(1 + additionalShifts.length)
                  )}
            </span>
          ) : (
            <span>
              {dutyId ? t.duty.updateDutyLog : t.duty.submitDutyShift}
            </span>
          )}
        </button>
      </div>
    </form>
  );
}

/**
 * Compact, touch-optimized card for an additional shift on the same operational day.
 */
function AdditionalShiftCard({
  index,
  shift,
  dutyTypes,
  onUpdate,
  onRemove,
  t,
  isGujarati,
}: {
  index: number;
  shift: AdditionalShiftItem;
  dutyTypes: DutyType[];
  onUpdate: (updates: Partial<AdditionalShiftItem>) => void;
  onRemove: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
  isGujarati: boolean;
}) {
  const duration = calculateShiftDuration(shift.startsAt, shift.endsAt);
  const durationLabel = formatDuration(duration, isGujarati);
  const shiftNumberStr = isGujarati ? toGujaratiNumerals(index + 2) : String(index + 2);

  const handleStartChange = (val: string) => {
    if (shift.isNextDay) {
      const updatedEnd = syncEndsAtDate(val, shift.endsAt, true);
      onUpdate({ startsAt: val, endsAt: updatedEnd });
    } else {
      onUpdate({ startsAt: val });
    }
  };

  const handleEndChange = (val: string) => {
    const isNext = checkIsNextDay(shift.startsAt, val);
    onUpdate({ endsAt: val, isNextDay: isNext });
  };

  const handleToggleNextDay = () => {
    const next = !shift.isNextDay;
    if (shift.startsAt) {
      const updatedEnd = syncEndsAtDate(shift.startsAt, shift.endsAt, next);
      onUpdate({ isNextDay: next, endsAt: updatedEnd });
    } else {
      onUpdate({ isNextDay: next });
    }
  };

  return (
    <div className="rounded-xl border-2 border-indigo-500/25 bg-card/85 shadow-2xs p-3 sm:p-3.5 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
      {shift.dbId && (
        <input type="hidden" name={`shifts.${index}.id`} value={shift.dbId} />
      )}
      {/* Header with Shift Badge, Duration, and Remove Button */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25">
            <Briefcase className="size-3 text-indigo-600 dark:text-indigo-400" />
            <span>
              {t.duty.shiftNumber.replace("{number}", shiftNumberStr)}
            </span>
          </span>
          {durationLabel && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md">
              <Clock className="size-2.5 text-slate-400" />
              <span>{durationLabel}</span>
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 active:scale-95 transition-all cursor-pointer select-none"
          title={t.duty.removeShift}
        >
          <Trash2 className="size-3" />
          <span>{t.duty.removeShift}</span>
        </button>
      </div>

      {/* Inputs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        {/* Duty Type */}
        <div className="flex flex-col gap-1 sm:col-span-1">
          <label
            htmlFor={`shifts.${index}.dutyTypeId`}
            className="text-xs font-semibold text-foreground flex items-center gap-1"
          >
            <Briefcase className="size-3 text-slate-400" />
            <span>{t.duty.dutyTypeLabel}</span>
            <span className="text-rose-500">*</span>
          </label>
          <FormSelect
            name={`shifts.${index}.dutyTypeId`}
            id={`shifts.${index}.dutyTypeId`}
            required
            value={shift.dutyTypeId}
            onChange={(val) => onUpdate({ dutyTypeId: val })}
            placeholder={t.duty.selectDutyTypePlaceholder}
            icon={Briefcase}
            options={sortDutyTypesForDropdown(dutyTypes).map((d) => ({
              value: d.id,
              label: formatDutyTypeDropdownLabel(d.name),
            }))}
          />
        </div>

        {/* Starts At */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`shifts.${index}.startsAt`}
            className="text-xs font-semibold text-foreground flex items-center gap-1"
          >
            <Clock className="size-3 text-slate-400" />
            <span>{t.duty.startsAtLabel}</span>
            <span className="text-rose-500">*</span>
          </label>
          <input
            id={`shifts.${index}.startsAt`}
            type="datetime-local"
            name={`shifts.${index}.startsAt`}
            required
            value={shift.startsAt}
            onChange={(e) => handleStartChange(e.target.value)}
            className="w-full h-9 sm:h-10 rounded-lg border border-border bg-card px-3 py-1.5 text-xs sm:text-sm shadow-2xs transition-colors hover:border-slate-400 dark:hover:border-slate-600 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {/* Ends At with Inline "Till Next Day" Toggle */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-1">
            <label
              htmlFor={`shifts.${index}.endsAt`}
              className="text-xs font-semibold text-foreground flex items-center gap-1 truncate"
            >
              <Clock className="size-3 text-slate-400 shrink-0" />
              <span className="truncate">{t.duty.endsAtLabel}</span>
              <span className="text-rose-500">*</span>
            </label>

            {/* Compact Inline Next Day Button */}
            <button
              type="button"
              onClick={handleToggleNextDay}
              aria-pressed={shift.isNextDay}
              title={t.duty.overnightDutyHint}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer select-none active:scale-95 shrink-0 ${
                shift.isNextDay
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/70"
              }`}
            >
              <Moon className={`size-3 ${shift.isNextDay ? "fill-white text-white" : "text-muted-foreground"}`} />
              <span>{shift.isNextDay ? t.duty.endsNextDayBadge : t.duty.tillNextDay}</span>
            </button>
          </div>

          <input
            id={`shifts.${index}.endsAt`}
            type="datetime-local"
            name={`shifts.${index}.endsAt`}
            required
            value={shift.endsAt}
            onChange={(e) => handleEndChange(e.target.value)}
            className="w-full h-9 sm:h-10 rounded-lg border border-border bg-card px-3 py-1.5 text-xs sm:text-sm shadow-2xs transition-colors hover:border-slate-400 dark:hover:border-slate-600 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      {/* Location & Notes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1">
            <MapPin className="size-3 text-slate-400" />
            <span>{t.duty.stationLocationLabel}</span>
            <span className="text-muted-foreground text-[10px]">({t.settings.optionalLabel})</span>
          </label>
          <input
            name={`shifts.${index}.location`}
            placeholder={t.duty.stationPlaceholder}
            value={shift.location}
            onChange={(e) => onUpdate({ location: e.target.value })}
            className="w-full h-9 sm:h-10 rounded-lg border border-border bg-card px-3 py-1.5 text-xs sm:text-sm shadow-2xs hover:border-slate-400 dark:hover:border-slate-600 transition-colors focus:border-indigo-500 focus:outline-hidden"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1">
            <FileText className="size-3 text-slate-400" />
            <span>{t.duty.operationalNotesLabel}</span>
            <span className="text-muted-foreground text-[10px]">({t.settings.optionalLabel})</span>
          </label>
          <input
            name={`shifts.${index}.notes`}
            placeholder={t.duty.operationalNotesPlaceholder}
            value={shift.notes}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            className="w-full h-9 sm:h-10 rounded-lg border border-border bg-card px-3 py-1.5 text-xs sm:text-sm shadow-2xs hover:border-slate-400 dark:hover:border-slate-600 transition-colors focus:border-indigo-500 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Optional TA Accordion for this Shift */}
      <div className="rounded-xl border border-border/70 bg-card/60 overflow-hidden">
        <button
          type="button"
          onClick={() => onUpdate({ taOpen: !shift.taOpen })}
          aria-expanded={shift.taOpen}
          className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left group select-none transition-colors"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Compass
              className={`size-3.5 shrink-0 transition-colors ${
                shift.taOpen ? "text-sky-500" : "text-sky-500/80"
              }`}
            />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-foreground truncate">
              {t.duty.taClaimTitle} ({shiftNumberStr})
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {shift.taAmount || shift.taDistanceKm ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                <span>₹{shift.taAmount || "0"}</span>
                {shift.taDistanceKm && <span>· {shift.taDistanceKm} km</span>}
              </span>
            ) : (
              <span className="text-[10px] font-medium text-muted-foreground">
                {t.duty.notClaimed}
              </span>
            )}
            <ChevronDown
              className={`size-3.5 text-muted-foreground transition-transform duration-150 ${
                shift.taOpen ? "rotate-180 text-sky-500" : ""
              }`}
            />
          </div>
        </button>

        {shift.taOpen && (
          <div className="p-3 pt-2.5 border-t border-sky-500/20 space-y-2.5 animate-in fade-in-50 duration-150">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <Navigation className="size-3 text-sky-500" />
                  <span>{t.duty.departurePlaceLabel}</span>
                </label>
                <input
                  name={`shifts.${index}.taFromPlace`}
                  placeholder={t.duty.departurePlaceholder}
                  value={shift.taFromPlace}
                  onChange={(e) => onUpdate({ taFromPlace: e.target.value })}
                  className="w-full h-9 rounded-lg border border-border bg-card px-3 py-1.5 text-xs sm:text-sm shadow-2xs focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <MapPin className="size-3 text-sky-500" />
                  <span>{t.duty.arrivalPlaceLabel}</span>
                </label>
                <input
                  name={`shifts.${index}.taToPlace`}
                  placeholder={t.duty.arrivalPlaceholder}
                  value={shift.taToPlace}
                  onChange={(e) => onUpdate({ taToPlace: e.target.value })}
                  className="w-full h-9 rounded-lg border border-border bg-card px-3 py-1.5 text-xs sm:text-sm shadow-2xs focus:border-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Vehicle Type Selection */}
            <div className="grid grid-cols-2 gap-1.5 p-0.5 rounded-lg bg-muted/60 border border-border">
              <button
                type="button"
                onClick={() => onUpdate({ taVehicleType: "private" })}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  shift.taVehicleType === "private"
                    ? "bg-card text-foreground shadow-2xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Car className="size-3 text-sky-500" />
                <span>{t.duty.privateVehicle}</span>
              </button>
              <button
                type="button"
                onClick={() => onUpdate({ taVehicleType: "govt" })}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  shift.taVehicleType === "govt"
                    ? "bg-card text-foreground shadow-2xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ShieldCheck className="size-3 text-emerald-500" />
                <span>{t.duty.govtVehicle}</span>
              </button>
            </div>
            <input type="hidden" name={`shifts.${index}.taVehicleType`} value={shift.taVehicleType} />

            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <Compass className="size-3 text-slate-400" />
                  <span>{t.duty.totalDistanceKm}</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  name={`shifts.${index}.taDistanceKm`}
                  placeholder="24.5"
                  value={shift.taDistanceKm}
                  onChange={(e) => onUpdate({ taDistanceKm: e.target.value })}
                  className="w-full h-9 rounded-lg border border-border bg-card px-3 py-1.5 text-xs sm:text-sm shadow-2xs focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <IndianRupee className="size-3 text-emerald-500" />
                  <span>{t.duty.claimAmount}</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name={`shifts.${index}.taAmount`}
                  placeholder="50.00"
                  value={shift.taAmount}
                  onChange={(e) => onUpdate({ taAmount: e.target.value })}
                  className="w-full h-9 rounded-lg border border-border bg-card px-3 py-1.5 text-xs sm:text-sm shadow-2xs focus:border-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
