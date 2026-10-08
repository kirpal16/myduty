"use client";

import { useState, useActionState, startTransition } from "react";
import { NavLink as Link } from "@/components/ui/nav-link";
import { createDuty, updateDuty, type DutyFormState } from "@/actions/duty";
import {
  AlertCircle,
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
} from "@/lib/reports/gujaratiReportUtils";
import { splitIntoDailyDuties } from "@/lib/duty/splitDuty";
import { useLinkedEndDate, deriveDutyEnd } from "@/lib/hooks/useLinkedEndDate";
import { DutyDayRows } from "./duty-day-rows";

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
  /** Stored amount, when editing an existing entry. */
  holidayAllowance?: number | null;
  manualHolidayClaim?: boolean;
};

export function DutyForm({
  dutyTypes,
  dutyId,
  defaults,
  initialFile,
  canUploadFiles = false,
  holidays = [],
  holidayDayRate = 0,
  defaultShiftEnd = "18:00",
}: {
  dutyTypes: DutyType[];
  /** When present the form edits that entry instead of creating a new one. */
  dutyId?: string;
  defaults?: DutyDefaults;
  initialFile?: {
    id?: string;
    name: string;
    url: string;
    size?: number;
    mimeType?: string;
  } | null;
  canUploadFiles?: boolean;
  /**
   * Holiday rows covering the dates this form can reach, so the badge can
   * update as the officer picks a date without a round trip. Advisory only —
   * the server re-derives the classification on submit.
   */
  holidays?: HolidayRecord[];
  /** Pre-fill for the allowance, from the officer's settings. */
  holidayDayRate?: number;
  /** "HH:MM" the end date snaps to when the start moves. */
  defaultShiftEnd?: string;
}) {
  const [startsAtVal, setStartsAtVal] = useState(defaults?.startsAt ?? "");
  // The end follows the start onto the same day at the shift end, until the
  // officer edits it themselves — after which it stays where they put it.
  const {
    endValue: endsAtVal,
    onStartChange: linkEnd,
    onEndChange: setEndsAtVal,
  } = useLinkedEndDate({
    initialEnd: defaults?.endsAt ?? "",
    deriveEnd: deriveDutyEnd(defaultShiftEnd),
  });
  const [manualClaim, setManualClaim] = useState(defaults?.manualHolidayClaim ?? false);

  // Holiday extra pay: collapsed like TA, with the amount in its header.
  const [holidayPayOpen, setHolidayPayOpen] = useState(false);
  const [holidayPayVal, setHolidayPayVal] = useState(
    defaults?.holidayAllowance != null
      ? String(defaults.holidayAllowance)
      : holidayDayRate > 0
        ? String(holidayDayRate)
        : "",
  );

  // TA accordion: open from the start only when the duty already carries TA.
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

  const action = dutyId ? updateDuty.bind(null, dutyId) : createDuty;
  const [state, formAction, pending] = useActionState<DutyFormState, FormData>(
    action,
    undefined
  );

  /**
   * Field messages that behave: they clear as the officer types, come back on
   * blur if still wrong, and the page scrolls to the first one on submit.
   * Passing the schema is what makes the clearing honest -- it re-checks
   * rather than just hiding the message.
   */
  // Editing opens with the entry's values, so Save stays disabled until
  // something actually differs. A create form starts empty and is exempt.
  const { formRef: dirtyRef, dirty } = useFormDirty();

  const { formRef, fieldProps, errorProps } = useFormFeedback({
    state,
    schema: dutySchema,
    toValues: dutyValuesFromForm,
  });

  // A TA error must never sit inside a closed section where nobody sees it.
  const taHasError = Boolean(
    errorProps("taDistanceKm").message || errorProps("taAmount").message,
  );
  const taVisible = taOpen || taHasError;

  // Classification of the start date. Derived, never a checkbox: an officer
  // cannot declare a plain Tuesday a holiday and pay themselves for it.
  const holidayInfo = startsAtVal
    ? resolveHoliday(startsAtVal, holidays)
    : { isHoliday: false, qualifiesForHolidayAllowance: false };

  // A multi-day entry becomes one duty per day, each independently editable.
  // Editing an existing row never re-splits — that row is already one day.
  const slots =
    !dutyId && startsAtVal && endsAtVal && new Date(endsAtVal) > new Date(startsAtVal)
      ? splitIntoDailyDuties(new Date(startsAtVal), new Date(endsAtVal))
      : [];
  const isMultiDay = slots.length > 1;

  return (
    <form
      ref={(node) => {
        formRef.current = node;
        dirtyRef.current = node;
      }}
      // Submitted by hand rather than via `action`: React resets a form after
      // its action runs, failed validation included, which snapped the
      // uncontrolled fields back to their defaults while component state kept
      // the typed values — the date pickers then showed one thing and held
      // another, and appeared frozen. Dispatching the same FormData from
      // onSubmit keeps every field as the officer left it.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      noValidate
      className="flex flex-col gap-6"
    >
      {state?.message && (
        <AutoDismissBanner
          message={state.message}
          tone="error"
          autoHideMs={4000}
        />
      )}

      {/* Section 1: Shift Specifics */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Clock className="size-4 text-indigo-500" />
          <span>Shift Details & Timing</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5 sm:col-span-1">
            <label
              htmlFor="dutyTypeId"
              className="text-xs font-semibold text-foreground flex items-center gap-1"
            >
              <Briefcase className="size-3 text-slate-400" />
              <span>Duty Type</span>
              <span className="text-rose-500">*</span>
            </label>
            <FormSelect
              id="dutyTypeId"
              {...fieldProps("dutyTypeId")}
              required
              placeholder="Select duty type"
              defaultValue={defaults?.dutyTypeId ?? ""}
              icon={Briefcase}
              error={!!errorProps("dutyTypeId").message}
              options={sortDutyTypesForDropdown(dutyTypes).map((d) => ({
                value: d.id,
                label: formatDutyTypeDropdownLabel(d.name),
              }))}
            />
            <FieldError {...errorProps("dutyTypeId")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="startsAt"
              className="text-xs font-semibold text-foreground flex items-center gap-1"
            >
              <Clock className="size-3 text-slate-400" />
              <span>Starts At</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              id="startsAt"
              {...fieldProps("startsAt")}
              type="datetime-local"
              required
              value={startsAtVal}
              onChange={(e) => {
                setStartsAtVal(e.target.value);
                linkEnd(e.target.value);
              }}
              className={`w-full rounded-xl border bg-card px-3.5 py-2.5 text-xs sm:text-sm shadow-xs transition-colors focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 ${
                errorProps("startsAt").message
                  ? "border-rose-500"
                  : "border-border hover:border-slate-400 dark:hover:border-slate-600"
              }`}
            />
            <FieldError {...errorProps("startsAt")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="endsAt"
              className="text-xs font-semibold text-foreground flex items-center gap-1"
            >
              <Clock className="size-3 text-slate-400" />
              <span>Ends At</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              id="endsAt"
              {...fieldProps("endsAt")}
              type="datetime-local"
              required
              value={endsAtVal}
              onChange={(e) => setEndsAtVal(e.target.value)}
              className={`w-full rounded-xl border bg-card px-3.5 py-2.5 text-xs sm:text-sm shadow-xs transition-colors focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 ${
                errorProps("endsAt").message
                  ? "border-rose-500"
                  : "border-border hover:border-slate-400 dark:hover:border-slate-600"
              }`}
            />
            <FieldError {...errorProps("endsAt")} />
          </div>
        </div>

        {/* The holiday's classification is shown once, in the section below
            (optional-holiday note, or the extra-pay accordion) — not again in
            a banner above it. */}
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
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 text-xs font-medium text-purple-900 dark:text-purple-200 flex items-start gap-2">
            <Sparkles className="mt-0.5 size-4 text-purple-500 shrink-0" />
            <span>
              <strong>Optional Holiday (મરજિયાત રજા)</strong>
              {holidayInfo.name ? ` — ${holidayInfo.name}` : ""}: regular working day, no holiday
              extra pay.
            </span>
          </div>
        ) : holidayInfo.qualifiesForHolidayAllowance ? (
          /* Collapsed like the TA section: the amount is pre-filled, so the
             officer only opens it to change it. */
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4">
            <CollapsibleSection
              title="Holiday Duty Extra Pay"
              icon={Sparkles}
              iconClassName="text-amber-500"
              open={holidayPayOpen}
              onToggle={() => setHolidayPayOpen((o) => !o)}
              summary={
                <span className="flex items-center gap-1.5">
                  {holidayPayVal ? <strong className="text-foreground">₹{holidayPayVal}</strong> : "Not set"}
                  <span className="hidden sm:inline">· {holidayInfo.name || holidayKindLabel(holidayInfo.kind)}</span>
                </span>
              }
            >
            <div className="flex flex-col gap-1.5 pb-4">
              <p className="text-[11px] text-muted-foreground">
                <span className="font-semibold text-amber-700 dark:text-amber-300">
                  {holidayKindLabel(holidayInfo.kind)}
                  {holidayInfo.name ? ` — ${holidayInfo.name}` : ""}
                </span>
                : working this day earns extra pay (રજાના દિવસનું વધારાનું મહેનતાણું).
              </p>
              <label
                htmlFor="holidayAllowance"
                className="text-xs font-semibold text-foreground flex items-center gap-1"
              >
                <IndianRupee className="size-3 text-amber-500" />
                <span>Holiday Duty Extra Pay / Allowance (₹)</span>
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
                className="w-full rounded-xl border border-amber-500/30 bg-card px-3.5 py-2.5 text-xs sm:text-sm shadow-xs focus:border-amber-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
              />
              <p className="text-[11px] text-muted-foreground">
                {holidayDayRate > 0
                  ? "Pre-filled from your default holiday rate — adjust it if this shift paid differently."
                  : "Set a default holiday rate in Settings to pre-fill this automatically."}
              </p>
            </div>
            </CollapsibleSection>
          </div>
        ) : !manualClaim ? (
          /* Compact closed state: clean single-line trigger */
          <div className="rounded-xl border border-dashed border-border/80 bg-card/60 p-3 hover:border-amber-500/40 hover:bg-amber-500/5 transition-all">
            <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  name="manualHolidayClaim"
                  checked={manualClaim}
                  onChange={(e) => setManualClaim(e.target.checked)}
                  className="size-4 rounded border-border text-amber-600 focus:ring-amber-500/30 cursor-pointer"
                />
                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  <Sparkles className="size-3.5 text-amber-500" />
                  <span className="font-semibold text-foreground">
                    Claim holiday pay for this working day
                  </span>
                  <span className="text-muted-foreground text-[11px]">
                    (રજાના દિવસનું વધારાનું મહેનતાણું)
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md hidden sm:inline">
                ક્લેઇમ કરવો હોય તો ટીક કરો
              </span>
            </label>
          </div>
        ) : (
          /* Expanded state when checked */
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-amber-500" />
                <div>
                  <h4 className="text-xs font-bold text-foreground">
                    Holiday Duty Extra Pay (રજાના દિવસનું વધારાનું મહેનતાણું)
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Extra pay is earned by <strong>working</strong> a holiday. A
                    holiday you take off pays nothing extra.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setManualClaim(false)}
                className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer shrink-0"
              >
                બંધ કરો (Cancel)
              </button>
            </div>

            <div className="space-y-3">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="manualHolidayClaim"
                  checked={manualClaim}
                  onChange={(e) => setManualClaim(e.target.checked)}
                  className="size-4 rounded border-amber-500/40 text-amber-600 focus:ring-amber-500/30 cursor-pointer"
                />
                <span className="text-xs font-bold text-foreground">
                  Claim holiday pay for this working day
                </span>
              </label>
              <p className="text-[11px] text-muted-foreground">
                This date is not a holiday, weekend off or day off. Tick only if you are owed holiday pay for it anyway.
              </p>

              <div className="flex flex-col gap-1.5 animate-in fade-in-50 pt-1">
                <label
                  htmlFor="holidayAllowance"
                  className="text-xs font-semibold text-foreground flex items-center gap-1"
                >
                  <IndianRupee className="size-3 text-amber-500" />
                  <span>Holiday Duty Extra Pay / Allowance (₹)</span>
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
                  className="w-full rounded-xl border border-amber-500/30 bg-card px-3.5 py-2.5 text-xs sm:text-sm shadow-xs focus:border-amber-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="location"
              className="text-xs font-semibold text-foreground flex items-center gap-1"
            >
              <MapPin className="size-3 text-slate-400" />
              <span>Station / Location</span>
              <span className="text-muted-foreground text-[10px]">(Optional)</span>
            </label>
            <input
              id="location"
              name="location"
              placeholder="e.g. Central Command, Sector 4"
              defaultValue={defaults?.location ?? ""}
              className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs sm:text-sm shadow-xs hover:border-slate-400 dark:hover:border-slate-600 transition-colors focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="notes"
              className="text-xs font-semibold text-foreground flex items-center gap-1"
            >
              <FileText className="size-3 text-slate-400" />
              <span>Operational Notes</span>
              <span className="text-muted-foreground text-[10px]">(Optional)</span>
            </label>
            <input
              id="notes"
              name="notes"
              placeholder="Special handover details, vehicle #, or incidents..."
              defaultValue={defaults?.notes ?? ""}
              className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs sm:text-sm shadow-xs hover:border-slate-400 dark:hover:border-slate-600 transition-colors focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Travelling Allowance (TA).
          Hidden for a multi-day entry: the per-day rows above own TA there, so
          there is exactly one place to type each day's route and amount and no
          two fields can disagree. */}
      <div className={`transition-all duration-200 ${isMultiDay ? "hidden" : ""}`}>
        {/* Compact TA Claim Card container */}
        <div
          className={`rounded-xl border transition-all duration-150 overflow-hidden ${
            taVisible
              ? "border-sky-500/40 bg-sky-500/[0.03] dark:bg-sky-950/20 shadow-xs"
              : "border-border/80 bg-card/60 hover:border-sky-500/30 hover:bg-muted/30 shadow-2xs"
          }`}
        >
          {/* Header toggle button: slim, compact single-line matching old height */}
          <button
            type="button"
            onClick={() => setTaOpen(!taVisible)}
            aria-expanded={taVisible}
            className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 sm:py-2.5 text-left group select-none transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Compass
                className={`size-4 shrink-0 transition-colors ${
                  taVisible ? "text-sky-500" : "text-sky-500/80 group-hover:text-sky-500"
                }`}
              />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-foreground truncate transition-colors">
                Travelling Allowance (TA) Claim
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              {taAmountVal || taKmVal ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                  <span>₹{taAmountVal || "0"}</span>
                  {taKmVal && <span>· {taKmVal} km</span>}
                </span>
              ) : (
                <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  Not claimed
                </span>
              )}
              <ChevronDown
                className={`size-4 text-muted-foreground group-hover:text-foreground transition-transform duration-150 shrink-0 ${
                  taVisible ? "rotate-180 text-sky-500" : ""
                }`}
              />
            </div>
          </button>

          {/* Form fields body (mounted always, hidden when closed) */}
          <div className={taVisible ? "p-3.5 sm:p-4 pt-3 border-t border-sky-500/20 space-y-3.5 animate-in fade-in-50 duration-150" : "hidden"}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="taFromPlace"
                  className="text-xs font-semibold text-foreground flex items-center gap-1"
                >
                  <Navigation className="size-3 text-sky-500" />
                  <span>Departure Place</span>
                </label>
                <input
                  id="taFromPlace"
                  name="taFromPlace"
                  placeholder="Origin base station"
                  defaultValue={defaults?.taFromPlace ?? ""}
                  className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs sm:text-sm shadow-xs hover:border-slate-400 dark:hover:border-slate-600 transition-colors focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="taToPlace"
                  className="text-xs font-semibold text-foreground flex items-center gap-1"
                >
                  <MapPin className="size-3 text-sky-500" />
                  <span>Arrival Destination</span>
                </label>
                <input
                  id="taToPlace"
                  name="taToPlace"
                  placeholder="Field deployment site"
                  defaultValue={defaults?.taToPlace ?? ""}
                  className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs sm:text-sm shadow-xs hover:border-slate-400 dark:hover:border-slate-600 transition-colors focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            {/* Vehicle Type Selection (ખાનગી વાહન / સરકારી વાહન) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Car className="size-3 text-sky-500" />
                  <span>વાહનનો પ્રકાર (Vehicle Type)</span>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                  {vehicleType === "govt" ? "સરકારી વાહન (સ.વા.)" : "ખાનગી વાહન (ખ.વા.)"}
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted/60 border border-border">
                <button
                  type="button"
                  onClick={() => setVehicleType("private")}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    vehicleType === "private"
                      ? "bg-card text-foreground shadow-xs border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Car className="size-3.5 text-sky-500" />
                  <span>ખાનગી વાહન (ખ.વા.)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVehicleType("govt")}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    vehicleType === "govt"
                      ? "bg-card text-foreground shadow-xs border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ShieldCheck className="size-3.5 text-emerald-500" />
                  <span>સરકારી વાહન (સ.વા.)</span>
                </button>
              </div>
              <input type="hidden" name="taVehicleType" value={vehicleType} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="taDistanceKm"
                  className="text-xs font-semibold text-foreground flex items-center gap-1"
                >
                  <Compass className="size-3 text-slate-400" />
                  <span>Total Distance (km)</span>
                </label>
                <input
                  id="taDistanceKm"
                  {...fieldProps("taDistanceKm")}
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="24.5"
                  defaultValue={defaults?.taDistanceKm ?? ""}
                  onChange={(e) => setTaKmVal(e.target.value)}
                  className={`w-full rounded-xl border bg-card px-3.5 py-2.5 text-xs sm:text-sm shadow-xs transition-colors focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 ${
                    errorProps("taDistanceKm").message
                      ? "border-rose-500"
                      : "border-border hover:border-slate-400 dark:hover:border-slate-600"
                  }`}
                />
                <FieldError {...errorProps("taDistanceKm")} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="taAmount"
                  className="text-xs font-semibold text-foreground flex items-center gap-1"
                >
                  <IndianRupee className="size-3 text-emerald-500" />
                  <span>Claim Amount (₹)</span>
                </label>
                <input
                  id="taAmount"
                  {...fieldProps("taAmount")}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="50.00"
                  defaultValue={defaults?.taAmount ?? ""}
                  onChange={(e) => setTaAmountVal(e.target.value)}
                  className={`w-full rounded-xl border bg-card px-3.5 py-2.5 text-xs sm:text-sm shadow-xs transition-colors focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 ${
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

      {/* Attachment Upload for Duty (Tickets, Receipts, Photos) */}
      {canUploadFiles && (
        <FormFileInput
          name="file"
          label="Attach Shift Document or Travel Receipt"
          helperText="Upload travel tickets, duty slips, or photo documentation (JPG, PNG, PDF, max 10MB)"
          initialFile={initialFile}
        />
      )}

      {/* Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        <Link
          href="/duty"
          className="rounded-xl border border-border bg-card px-4 py-2.5 text-xs sm:text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending || (dutyId ? !dirty : false)}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md shadow-indigo-600/30 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-50 transition-all cursor-pointer"
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <span>{dutyId ? "Update Duty Log" : "Submit Duty Shift"}</span>
          )}
        </button>
      </div>
    </form>
  );
}
