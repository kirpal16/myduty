"use client";

import { useActionState, useState, useEffect, useMemo, useRef, startTransition } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { isHalfDayAllowed } from "@/lib/leave/allocateLeaveDays";
import { NavLink as Link } from "@/components/ui/nav-link";
import {
  logLeave,
  updateLeaveLog,
  previewLeaveAllocation,
  type AllocationPreview,
  type LeaveFormState,
} from "@/actions/leave";
import { formatDays } from "@/lib/leave/leaveDays";
import { LeaveDayBreakdown } from "@/components/leave/leave-day-breakdown";
import {
  AlertCircle,
  Calendar,
  CalendarOff,
  Clock,
  Loader2,
  Scale,
  Sun,
  Moon,
  FileText,
  Sparkles,
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FormFileInput } from "@/components/ui/form-file-input";
import { FormSelect } from "@/components/ui/form-select";
import { FieldError } from "@/components/ui/field-error";
import { AutoDismissBanner } from "@/components/ui/auto-dismiss-banner";
import { useFormFeedback } from "@/lib/hooks/useFormFeedback";
import { useFormDirty } from "@/lib/hooks/useFormDirty";
import { useLinkedEndDate, deriveLeaveEnd } from "@/lib/hooks/useLinkedEndDate";
import {
  isHolidayLeaveType,
  holidayEndOptions,
  type HolidayOption,
} from "@/lib/leave/holidayLeaveRules";
import {
  isOptionalHolidayType,
  getAdjacentDates,
} from "@/lib/leave/optionalHolidayRules";
import { applyLeaveSchema, leaveValuesFromForm } from "@/lib/validations/leave";

type LeaveType = {
  id: string;
  name: string;
  /** Present so the form can spot the Holiday Leave system type. */
  code?: string | null;
  is_system?: boolean | null;
  /** The officer's chosen colour, shown as a dot in the picker. */
  color?: string | null;
};
type Balance = {
  leaveTypeId: string;
  allocated: number;
  carriedIn?: number;
  totalAvailable?: number;
  used: number;
  remaining: number;
};

export type SpecialLeaveSanctionOption = {
  id: string;
  leaveTypeId?: string | null;
  appliedDate: string;
  appliedDays: number;
  approvedDate: string;
  approvedBy: string;
  approvedDays: number;
  orderNo?: string | null;
  remainingDays: number;
  validFrom?: string | null;
  validTo?: string | null;
  expiresAt?: string | null;
  isExpired?: boolean;
};

/** Per-leave-type sanction totals, for the types that have no annual quota. */
export type SanctionSummary = {
  leaveTypeId: string;
  sanctioned: number;
  logged: number;
  left: number;
};

export type LeaveDefaults = {
  leaveTypeId?: string;
  startDate?: string;
  endDate?: string;
  isHalfDay?: boolean;
  halfDaySession?: string | null;
  reason?: string | null;
  specialLeaveApplicationId?: string | null;
  /** Saved per-day types (date -> leave type id), when editing. */
  dayTypes?: Record<string, string>;
};

// Stable empty defaults. An inline `= []` is a new array every render, which
// made the pairing effect below re-run after every render.
const NO_HOLIDAY_OPTIONS: HolidayOption[] = [];
const NO_OPTIONAL_OPTIONS: { date: string; name: string }[] = [];
const NO_SANCTIONS: SpecialLeaveSanctionOption[] = [];
const NO_SANCTION_SUMMARIES: SanctionSummary[] = [];

export function LeaveForm({
  leaveTypes,
  balances,
  logId,
  defaults,
  initialFile,
  canUploadFiles = false,
  holidayOptions = NO_HOLIDAY_OPTIONS,
  optionalHolidayOptions = NO_OPTIONAL_OPTIONS,
  specialLeaveSanctions = NO_SANCTIONS,
  sanctionSummaries = NO_SANCTION_SUMMARIES,
  dailySalaryRate = 0,
}: {
  leaveTypes: LeaveType[];
  balances?: Balance[];
  /** When present the form edits that entry instead of creating a new one. */
  logId?: string;
  defaults?: LeaveDefaults;
  initialFile?: {
    id?: string;
    name: string;
    url: string;
    size?: number;
    mimeType?: string;
  } | null;
  canUploadFiles?: boolean;
  /**
    * The dates Holiday Leave may be taken on, with worked/already-taken days
    * included but disabled. Empty for every other leave type.
    */
  holidayOptions?: HolidayOption[];
  optionalHolidayOptions?: { date: string; name: string }[];
  specialLeaveSanctions?: SpecialLeaveSanctionOption[];
  sanctionSummaries?: SanctionSummary[];
  dailySalaryRate?: number;
}) {
  const action = logId ? updateLeaveLog.bind(null, logId) : logLeave;
  const [state, formAction, pending] = useActionState<LeaveFormState, FormData>(
    action,
    undefined
  );

  // Editing opens with the entry's values, so Save stays disabled until
  // something actually differs. A create form starts empty and is exempt.
  const { formRef: dirtyRef, dirty } = useFormDirty();

  const { formRef, fieldProps, errorProps } = useFormFeedback({
    state,
    schema: applyLeaveSchema,
    toValues: leaveValuesFromForm,
  });
  const [isHalfDay, setIsHalfDay] = useState(defaults?.isHalfDay ?? false);
  const [halfDaySession, setHalfDaySession] = useState(
    defaults?.halfDaySession ?? "AM"
  );
  const [leaveTypeId, setLeaveTypeId] = useState(defaults?.leaveTypeId ?? "");

  const balance = balances?.find((b) => b.leaveTypeId === leaveTypeId);

  const [startDateVal, setStartDateVal] = useState(defaults?.startDate ?? "");
  // The end date follows the start until the officer edits it themselves.
  const {
    endValue: endDateVal,
    onStartChange: linkEnd,
    onEndChange: setEndDateVal,
    setEnd,
  } = useLinkedEndDate({
    initialEnd: defaults?.endDate ?? "",
    deriveEnd: deriveLeaveEnd,
  });

  const selectedType = leaveTypes.find((t) => t.id === leaveTypeId);
  const isHolidayLeave = isHolidayLeaveType(selectedType);
  const isOptionalHoliday = isOptionalHolidayType(selectedType);
  const isSpecialLeave =
    selectedType?.code?.toUpperCase() === "SPL" && Boolean(selectedType?.is_system);
  const isBinpagariLeave =
    selectedType?.code?.toUpperCase() === "LWP" && Boolean(selectedType?.is_system);
  const requiresSanction = isSpecialLeave || isBinpagariLeave;

  // Half-day is a Casual Leave concept only (the server enforces it too).
  const isCasual = isHalfDayAllowed(selectedType);

  // Filter sanctions matching the current leave type
  const matchingSanctions = useMemo(() => {
    if (!requiresSanction) return [];
    return specialLeaveSanctions.filter((s) => {
      if (s.leaveTypeId) {
        return s.leaveTypeId === leaveTypeId;
      }
      return isSpecialLeave;
    });
  }, [specialLeaveSanctions, leaveTypeId, requiresSanction, isSpecialLeave]);

  const [selectedSanctionId, setSelectedSanctionId] = useState(
    defaults?.specialLeaveApplicationId ?? matchingSanctions[0]?.id ?? "",
  );

  useEffect(() => {
    if (requiresSanction) {
      if (!matchingSanctions.some((s) => s.id === selectedSanctionId)) {
        setSelectedSanctionId(matchingSanctions[0]?.id ?? "");
      }
    }
  }, [requiresSanction, matchingSanctions, selectedSanctionId]);

  const selectedSanction = matchingSanctions.find(
    (s) => s.id === selectedSanctionId,
  );

  const sanctionSummary = sanctionSummaries.find(
    (s) => s.leaveTypeId === leaveTypeId,
  );
  // Binpagari carries no annual allocation, so "0 days remaining of 0 days"
  // is not a balance -- its sanctions are. Special Leave has both.
  const sanctionOnlyBalance = isBinpagariLeave;

  /**
   * A sanction order that fixes its own window also fixes when the leave may
   * be taken, so picking one fills the dates in. It runs once per sanction,
   * never overwriting dates typed afterwards, and a sanction without a range
   * leaves the date fields alone.
   */
  const prefilledFromSanction = useRef<string | null>(null);
  useEffect(() => {
    if (!requiresSanction || !selectedSanction) {
      prefilledFromSanction.current = null;
      return;
    }
    if (prefilledFromSanction.current === selectedSanction.id) return;
    prefilledFromSanction.current = selectedSanction.id;
    // Editing an existing log opens on its own saved dates; those win.
    if (logId) return;
    if (!selectedSanction.validFrom) return;
    setStartDateVal(selectedSanction.validFrom);
    setEnd(selectedSanction.validTo || selectedSanction.validFrom);
  }, [requiresSanction, selectedSanction, logId, setEnd]);

  // Optional Holiday pairing states
  const [pairedMode, setPairedMode] = useState<"pair_now" | "already_logged">("pair_now");
  const [pairedDirection, setPairedDirection] = useState<"before" | "after">("before");
  const otherLeaveTypes = useMemo(
    () => leaveTypes.filter((t) => !isOptionalHolidayType(t)),
    [leaveTypes],
  );
  const [pairedLeaveTypeId, setPairedLeaveTypeId] = useState<string>(
    otherLeaveTypes[0]?.id ?? "",
  );

  const adjacent = startDateVal ? getAdjacentDates(startDateVal) : null;
  const pairedDate = pairedDirection === "before" ? adjacent?.before : adjacent?.after;

  const holidayLeaveType = leaveTypes.find((t) => isHolidayLeaveType(t));
  const beforeHoliday = holidayOptions.find((o) => o.date === adjacent?.before);
  const afterHoliday = holidayOptions.find((o) => o.date === adjacent?.after);
  const pairedHoliday = pairedDirection === "before" ? beforeHoliday : afterHoliday;

  // When an Optional Holiday paired date is a declared holiday (or Makar Sankranti/Sunday),
  // automatically set the accompanying leave classification to Holiday Leave (HL) without disabling the dropdown.
  useEffect(() => {
    if (!isOptionalHoliday || !pairedDate) return;
    const isHoliday = holidayOptions.some((o) => o.date === pairedDate);
    const hlType = leaveTypes.find((t) => isHolidayLeaveType(t));
    if (isHoliday && hlType) {
      setPairedLeaveTypeId(hlType.id);
    } else {
      setPairedLeaveTypeId((curr) => {
        if (curr === hlType?.id) {
          const nonHl = otherLeaveTypes.find((t) => !isHolidayLeaveType(t));
          return nonHl?.id ?? otherLeaveTypes[0]?.id ?? "";
        }
        return curr;
      });
    }
  }, [pairedDate, isOptionalHoliday, holidayOptions, leaveTypes, otherLeaveTypes]);

  const selectableHolidays = holidayOptions.filter((o) => !o.disabledReason);
  // The end dates this start actually permits: itself, plus any holidays on
  // the immediately following days.
  const endChoices = isHolidayLeave
    ? holidayEndOptions(holidayOptions, startDateVal)
    : [];

  const effectiveEnd = isOptionalHoliday
    ? startDateVal
    : isHolidayLeave && !endChoices.some((o) => o.date === endDateVal)
    ? startDateVal
    : endDateVal;

  // Live breakdown from the same engine the save uses: how many days, and
  // which of them become HL / OH instead of the selected leave.
  const [preview, setPreview] = useState<AllocationPreview | null>(null);
  const previewEnd = isHalfDay ? startDateVal : effectiveEnd;

  const specialLeaveIssue = useMemo(() => {
    if (!requiresSanction || !selectedSanction) return null;
    const leaveLabel = isBinpagariLeave ? "Binpagari Leave" : "Special Leave";
    if (selectedSanction.isExpired) {
      return `This ${leaveLabel} sanction expired on ${selectedSanction.expiresAt} (6-month rule). Unlogged days have lapsed.`;
    }
    if (
      selectedSanction.expiresAt &&
      startDateVal &&
      startDateVal > selectedSanction.expiresAt
    ) {
      return `Leave start date (${startDateVal}) is after the sanction expiration date (${selectedSanction.expiresAt}).`;
    }
    if (
      selectedSanction.validFrom &&
      startDateVal &&
      startDateVal < selectedSanction.validFrom
    ) {
      return `Leave start date (${startDateVal}) cannot be before the sanction valid from date (${selectedSanction.validFrom}).`;
    }
    if (
      selectedSanction.validTo &&
      effectiveEnd &&
      effectiveEnd > selectedSanction.validTo
    ) {
      return `Leave end date (${effectiveEnd}) cannot be after the sanction valid to date (${selectedSanction.validTo}).`;
    }
    if (
      preview &&
      preview.days.length > selectedSanction.remainingDays
    ) {
      return `Selected days (${preview.days.length}) exceed remaining approved days (${selectedSanction.remainingDays}) for this sanction.`;
    }
    return null;
  }, [requiresSanction, isBinpagariLeave, selectedSanction, startDateVal, effectiveEnd, preview]);

  /**
   * The annual quota, checked before the save rather than after it. The server
   * enforces the same rule; this is so the officer sees it while picking dates
   * instead of losing the form to an error banner.
   *
   * Holiday Leave is capped by the calendar, Optional Holiday carries its own
   * quota message, and the sanction types answer to `specialLeaveIssue` above.
   */
  const quotaIssue = useMemo(() => {
    if (!preview || requiresSanction) return null;
    if (isHolidayLeave || isOptionalHoliday) return null;
    if (!balance || !selectedType?.code) return null;
    // `breakdown` is already per-code and already counts a half day as 0.5,
    // and only the days actually charged to this type are its concern -- a
    // range whose holidays fall to HL does not spend this quota.
    const chosen =
      preview.breakdown.find((b) => b.code === selectedType.code)?.days ?? 0;
    if (chosen <= balance.remaining) return null;
    const left = Math.max(0, balance.remaining);
    return `Not enough ${selectedType.name} balance for ${
      startDateVal.slice(0, 4) || "this year"
    }: ${left} day${left === 1 ? "" : "s"} left, ${chosen} day${
      chosen === 1 ? "" : "s"
    } chosen.`;
  }, [
    preview,
    requiresSanction,
    isHolidayLeave,
    isOptionalHoliday,
    balance,
    selectedType,
    startDateVal,
  ]);

  // The officer's per-day changes to the breakdown. Only dates inside the
  // current range count, so shortening the leave drops the ones that left it.
  const [dayOverrides, setDayOverrides] = useState<Record<string, string>>(
    () => defaults?.dayTypes ?? {},
  );
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  // Closed by default: the sanction rules are reference material, and always
  // showing them pushed the dates and the save button off a phone screen.
  const [sanctionInfoOpen, setSanctionInfoOpen] = useState(false);
  const activeOverrides = useMemo(() => {
    const out: Record<string, string> = {};
    if (isHalfDay || !startDateVal || !previewEnd) return out;
    for (const [date, id] of Object.entries(dayOverrides)) {
      if (date >= startDateVal && date <= previewEnd) out[date] = id;
    }
    return out;
  }, [dayOverrides, isHalfDay, startDateVal, previewEnd]);

  // `previewing` drives the loader shown while the split is worked out. Only
  // the LATEST request may clear it or set the result, so a slow answer to an
  // earlier date can never overwrite the current one.
  const [previewing, setPreviewing] = useState(false);
  const previewRequest = useRef(0);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!leaveTypeId || !startDateVal || !previewEnd || previewEnd < startDateVal) {
        setPreview(null);
        setPreviewing(false);
        return;
      }
      const request = ++previewRequest.current;
      setPreviewing(true);
      previewLeaveAllocation({
        leaveTypeId,
        startDate: startDateVal,
        endDate: previewEnd,
        isHalfDay,
        logId,
        overrides: activeOverrides,
      })
        .then((p) => {
          if (cancelled || request !== previewRequest.current) return;
          setPreview(p);
          setPreviewing(false);
        })
        .catch(() => {
          if (cancelled || request !== previewRequest.current) return;
          setPreview(null);
          setPreviewing(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [leaveTypeId, startDateVal, previewEnd, isHalfDay, logId, activeOverrides]);

  const breakdownIssues = preview?.issues.length ?? 0;
  const showBreakdown =
    !!preview &&
    !isHalfDay &&
    !isOptionalHoliday &&
    !isHolidayLeave &&
    preview.days.length >= 2;

  return (
    <form
      ref={(node) => {
        formRef.current = node;
        dirtyRef.current = node;
      }}
      // Submitted by hand rather than via `action`: React resets a form after
      // its action runs, failed validation included, which snapped the
      // uncontrolled fields back to their defaults while component state kept
      // the picked dates — the pickers then disagreed with the form and
      // appeared frozen. Dispatching from onSubmit keeps every field intact.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      noValidate
      className="flex flex-col gap-6"
    >
      {/* Optional Holiday Guidance Banner */}
      {isOptionalHoliday && (
        <div className="flex items-start gap-3 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4 text-xs sm:text-sm text-purple-900 dark:text-purple-200">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-purple-500" />
          <div className="space-y-1">
            <div className="font-bold flex items-center gap-2 flex-wrap">
              <span>Gujarat Government Optional Holiday (મરજિયાત રજા)</span>
              <Badge variant="purple">Max 2 Days/Year</Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              • Quota: Up to <strong>2 Optional Holidays</strong> per calendar year from the declared government list.
              <br />
              • <strong>Adjacent-Leave Rule (Mandatory)</strong>: An Optional Holiday cannot be taken as a single isolated day. You must combine it with another leave (e.g. CL or HL) directly <em>before</em> or <em>after</em> (minimum 2 consecutive days).
            </p>
          </div>
        </div>
      )}

      {/* Holiday Leave Guidance Banner */}
      {isHolidayLeave && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-200">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <div>
            <p className="font-bold">
              Holiday Leave can only be taken on a holiday.
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Your entitlement is the number of holidays in the year — Sundays,
              2nd and 4th Saturdays, and gazetted festivals. Working a holiday
              earns extra pay instead and does not use this balance.
              {selectableHolidays.length === 0 &&
                " There are no holidays left to take this year."}
            </p>
          </div>
        </div>
      )}
      {state?.message && (
        <AutoDismissBanner
          message={state.message}
          tone="error"
          autoHideMs={4000}
        />
      )}

      {/* Step 1 — the dates. Asked first: the leave type, and the suggested
          day-by-day split, both depend on which days are involved. */}
      {/* Date selection row */}
      {isOptionalHoliday ? (
        /* Dedicated Optional Holiday Date Selection */
        <div className="flex flex-col gap-2">
          <label
            htmlFor="startDate"
            className="text-xs font-semibold text-foreground flex items-center gap-1"
          >
            <Calendar className="size-3 text-purple-500" />
            <span>Declared Optional Holiday Date</span>
            <span className="text-rose-500">*</span>
          </label>

          {optionalHolidayOptions.length > 0 ? (
            <FormSelect
              id="startDate"
              {...fieldProps("startDate")}
              required
              placeholder="Select an Optional Holiday from the declared list…"
              value={startDateVal}
              onChange={(val) => {
                setStartDateVal(val);
                setEnd(val);
              }}
              icon={Calendar}
              error={!!errorProps("startDate").message}
              options={optionalHolidayOptions.map((o) => ({
                value: o.date,
                label: `${o.date} — ${o.name}`,
              }))}
            />
          ) : (
            <input
              id="startDate"
              {...fieldProps("startDate")}
              type="date"
              value={startDateVal}
              onChange={(e) => {
                setStartDateVal(e.target.value);
                setEnd(e.target.value);
              }}
              className={`w-full rounded-xl border bg-card px-3.5 py-2.5 text-xs sm:text-sm shadow-xs transition-colors focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 ${
                errorProps("startDate").message
                  ? "border-rose-500"
                  : "border-border hover:border-slate-400 dark:hover:border-slate-600"
              }`}
            />
          )}

          {/* Hidden input for endDate since Optional Holiday is single day */}
          <input type="hidden" name="endDate" value={startDateVal} />
          <FieldError {...errorProps("startDate")} />
        </div>
      ) : (
        /* Standard Dates Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="startDate"
              className="text-xs font-semibold text-foreground flex items-center gap-1"
            >
              <Calendar className="size-3 text-slate-400" />
              <span>{isHalfDay ? "Date" : "Start Date"}</span>
              <span className="text-rose-500">*</span>
            </label>
            {isHolidayLeave ? (
              <FormSelect
                id="startDate"
                {...fieldProps("startDate")}
                required
                placeholder="Choose a holiday…"
                value={startDateVal}
                onChange={(val) => {
                  setStartDateVal(val);
                  linkEnd(val);
                }}
                icon={Calendar}
                error={!!errorProps("startDate").message}
                options={selectableHolidays.map((o) => ({
                  value: o.date,
                  label: `${o.date} — ${o.label}`,
                }))}
              />
            ) : (
              <input
                id="startDate"
                {...fieldProps("startDate")}
                type="date"
                value={startDateVal}
                onChange={(e) => {
                  setStartDateVal(e.target.value);
                  linkEnd(e.target.value);
                }}
                className={`w-full rounded-xl border bg-card px-3.5 py-2.5 text-xs sm:text-sm shadow-xs transition-colors focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 ${
                  errorProps("startDate").message
                    ? "border-rose-500"
                    : "border-border hover:border-slate-400 dark:hover:border-slate-600"
                }`}
              />
            )}
            <FieldError {...errorProps("startDate")} />
          </div>

          {!isHalfDay ? (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="endDate"
                className="text-xs font-semibold text-foreground flex items-center gap-1"
              >
                <Calendar className="size-3 text-slate-400" />
                <span>End Date</span>
                <span className="text-rose-500">*</span>
              </label>
              {isHolidayLeave ? (
                <FormSelect
                  id="endDate"
                  {...fieldProps("endDate")}
                  placeholder={
                    startDateVal ? "Choose an end date…" : "Pick a start date first"
                  }
                  disabled={endChoices.length === 0}
                  value={effectiveEnd}
                  onChange={(val) => setEndDateVal(val)}
                  icon={Calendar}
                  error={!!errorProps("endDate").message}
                  options={endChoices.map((o) => ({
                    value: o.date,
                    label: `${o.date} — ${o.label}`,
                  }))}
                />
              ) : (
                <input
                  id="endDate"
                  {...fieldProps("endDate")}
                  type="date"
                  value={endDateVal}
                  onChange={(e) => setEndDateVal(e.target.value)}
                  className={`w-full rounded-xl border bg-card px-3.5 py-2.5 text-xs sm:text-sm shadow-xs transition-colors focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 ${
                    errorProps("endDate").message
                      ? "border-rose-500"
                      : "border-border hover:border-slate-400 dark:hover:border-slate-600"
                  }`}
                />
              )}
              <FieldError {...errorProps("endDate")} />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Sun className="size-3 text-amber-500" />
                <span>Session Period</span>
              </label>
              <input type="hidden" name="halfDaySession" value={halfDaySession} />

              <div className="grid grid-cols-2 gap-2 h-10">
                <button
                  type="button"
                  onClick={() => setHalfDaySession("AM")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    halfDaySession === "AM"
                      ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/20"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <Sun className="size-3.5" />
                  <span>Morning (AM)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHalfDaySession("PM")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    halfDaySession === "PM"
                      ? "border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <Moon className="size-3.5" />
                  <span>Afternoon (PM)</span>
                </button>
              </div>
              <FieldError {...errorProps("halfDaySession")} />
            </div>
          )}
        </div>
      )}

      {/* Step 2 — the leave type */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="leaveTypeId"
          className="text-xs font-semibold text-foreground flex items-center justify-between"
        >
          <span className="flex items-center gap-1.5">
            <CalendarOff className="size-3.5 text-indigo-500" />
            <span>Leave Classification</span>
            <span className="text-rose-500">*</span>
          </span>
          {sanctionOnlyBalance ? (
            <span className="text-[11px] font-normal text-muted-foreground">
              Sanctioned left:{" "}
              <strong className="text-foreground">{sanctionSummary?.left ?? 0}</strong> days
            </span>
          ) : balance ? (
            <span className="text-[11px] font-normal text-muted-foreground">
              Remaining: <strong className="text-foreground">{balance.remaining}</strong> days
            </span>
          ) : null}
        </label>

        <FormSelect
          id="leaveTypeId"
          {...fieldProps("leaveTypeId")}
          required
          placeholder="Select leave classification"
          value={leaveTypeId}
          onChange={(val) => {
            setLeaveTypeId(val);
            // A new leave type means a new proposal; old per-day choices no
            // longer describe it.
            setDayOverrides({});
            const newType = leaveTypes.find((t) => t.id === val);
            if (!isHalfDayAllowed(newType)) setIsHalfDay(false);

            // The dates are the officer's. They are only cleared when the new
            // type cannot use them (HL on a working day, OH on a non-declared
            // date) — never replaced with some other date.
            if (isOptionalHolidayType(newType)) {
              const ok = optionalHolidayOptions.some((o) => o.date === startDateVal);
              if (!ok) setStartDateVal("");
              setEnd(ok ? startDateVal : "");
            } else if (isHolidayLeaveType(newType)) {
              const ok = selectableHolidays.some((o) => o.date === startDateVal);
              if (!ok) {
                setStartDateVal("");
                setEnd("");
              }
            }
          }}
          icon={CalendarOff}
          error={!!errorProps("leaveTypeId").message}
          options={leaveTypes.map((t) => ({
            value: t.id,
            label: t.name,
            color: t.color,
          }))}
        />

        {/* Binpagari answers to its sanctions, not to an allowance it does not
            have. Special Leave has both, and shows both. */}
        {balance && !sanctionOnlyBalance && (
          <div className="mt-1 p-3 rounded-xl bg-muted/40 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Scale className="size-4 text-indigo-500 shrink-0" />
              <span>
                Allowance Balance:{" "}
                <strong className="text-foreground">{balance.remaining}</strong> days remaining of{" "}
                {(balance.carriedIn ?? 0) > 0 && balance.totalAvailable
                  ? `${balance.totalAvailable} days (incl. ${balance.carriedIn} carried)`
                  : `${balance.allocated} days`}
              </span>
            </div>
            {balance.remaining <= 0 && (
              <Badge variant="danger">Low/Over Quota</Badge>
            )}
          </div>
        )}

        {requiresSanction && (
          <div className="mt-1 p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="size-4 text-sky-500 shrink-0" />
              <span>
                Sanctioned:{" "}
                <strong className="text-foreground">{sanctionSummary?.sanctioned ?? 0}</strong> d
                {" · "}Logged:{" "}
                <strong className="text-foreground">{sanctionSummary?.logged ?? 0}</strong> d
                {" · "}Left:{" "}
                <strong className="text-sky-600 dark:text-sky-400">
                  {sanctionSummary?.left ?? 0}
                </strong>{" "}
                d
              </span>
            </div>
            {sanctionOnlyBalance && (
              <Badge variant="secondary">No annual quota &middot; sanction-based</Badge>
            )}
          </div>
        )}

        {quotaIssue && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="size-4 shrink-0 text-rose-500 mt-px" />
            <span>{quotaIssue}</span>
          </div>
        )}

        <FieldError {...errorProps("leaveTypeId")} />

        {/* The sanction order sits directly under the classification it
            belongs to: picking Binpagari and picking which sanction covers it
            are one decision. Everything explanatory moved into the collapsed
            panel below, which kept this from filling the screen. */}
        {requiresSanction && matchingSanctions.length > 0 && (
          <div className="space-y-2 pt-1">
            <label
              htmlFor="specialLeaveApplicationId"
              className="text-xs font-semibold text-foreground flex items-center justify-between"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles
                  className={`size-3.5 ${isBinpagariLeave ? "text-rose-500" : "text-sky-500"}`}
                />
                <span>Select Approved Sanction Order</span>
                <span className="text-rose-500">*</span>
              </span>
            </label>
            <input
              type="hidden"
              name="specialLeaveApplicationId"
              value={selectedSanctionId}
            />
            <FormSelect
              id="specialLeaveApplicationId"
              required
              value={selectedSanctionId}
              onChange={(val) => setSelectedSanctionId(val)}
              placeholder="Select an approved sanction…"
              // Short on purpose: the trigger truncates on a phone, and the
              // approved total, order no., expiry and date range are all
              // spelled out in the details panel below.
              options={matchingSanctions.map((s) => ({
                value: s.id,
                label: `${s.isExpired ? "[EXPIRED] " : ""}${s.approvedBy} — ${s.remainingDays}d left`,
              }))}
            />
          </div>
        )}
      </div>

      {/* Sanction context: the blocking parts stay in the open, the reference
          material collapses. This used to be one tall always-open card. */}
      {requiresSanction && (
        <div className="flex flex-col gap-2">
          {matchingSanctions.length === 0 ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
              <AlertCircle className="size-4 shrink-0 text-rose-500 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">
                  No approved {isBinpagariLeave ? "Binpagari" : "Special"} Leave sanction found for this year.
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Please record your official approval order or apply for sanction first before logging days.
                </p>
                <Link
                  href="/leave?tab=special"
                  className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 hover:underline pt-1"
                >
                  <span>Go to Leave Sanctions &amp; Approvals</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          ) : (
            <div
              className={`rounded-xl border ${
                isBinpagariLeave
                  ? "border-rose-500/30 bg-rose-500/5 dark:bg-rose-950/20"
                  : "border-sky-500/30 bg-sky-500/10"
              }`}
            >
              <button
                type="button"
                onClick={() => setSanctionInfoOpen((o) => !o)}
                aria-expanded={sanctionInfoOpen}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left cursor-pointer"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Sparkles
                    className={`size-3.5 shrink-0 ${isBinpagariLeave ? "text-rose-500" : "text-sky-500"}`}
                  />
                  <span className="text-[11px] font-bold text-foreground truncate">
                    {isBinpagariLeave
                      ? "Binpagari Leave (બિનપગારી રજા) — sanction details"
                      : "Special Leave (વિશેષ રજા) — sanction details"}
                  </span>
                  {isBinpagariLeave && (
                    <Badge variant="danger">Unpaid</Badge>
                  )}
                </span>
                <ChevronDown
                  className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                    sanctionInfoOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {sanctionInfoOpen && (
                <div className="px-3 pb-3 space-y-2.5">
                  <p className="text-[11px] text-muted-foreground">
                    {isBinpagariLeave
                      ? "Binpagari Leave is completely unpaid (No salary, TA, or duty allowances). An official approval order is required before logging."
                      : "Special leave cannot be logged without an official approval order. You can only log up to the sanctioned day count."}
                  </p>

                  {isBinpagariLeave &&
                    (dailySalaryRate > 0 ? (
                      <div className="rounded-lg border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-2.5 text-xs text-rose-900 dark:text-rose-200 space-y-1">
                        <div className="flex items-center justify-between font-semibold gap-2">
                          <span>Estimated Salary Deduction (દૈનિક પગાર કપાત)</span>
                          <span className="text-sm font-bold text-rose-600 dark:text-rose-400 shrink-0">
                            -₹
                            {(
                              (isHalfDay ? 0.5 : preview ? preview.days.length : 1) *
                              dailySalaryRate
                            ).toLocaleString("en-IN")}
                          </span>
                        </div>
                        <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80">
                          Rate: ₹{dailySalaryRate} / day ×{" "}
                          {isHalfDay ? "0.5" : preview ? preview.days.length : 1} day(s)
                          (configured in Settings)
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-200">
                        <span>
                          Tip: Configure your <strong>Daily Salary Rate (દૈનિક પગાર)</strong> in
                          Settings to calculate exact salary deductions.
                        </span>
                      </div>
                    ))}

                  {selectedSanction && (
                    <div className="space-y-1 text-[11px] text-muted-foreground">
                      <div className="flex items-center justify-between gap-2">
                        <span>
                          Approved:{" "}
                          <strong className="text-foreground">
                            {selectedSanction.approvedDays} days
                          </strong>
                        </span>
                        <span>
                          Remaining:{" "}
                          <strong
                            className={
                              selectedSanction.isExpired
                                ? "text-rose-500 line-through"
                                : "text-sky-600 dark:text-sky-400 font-bold"
                            }
                          >
                            {selectedSanction.remainingDays} days
                          </strong>
                        </span>
                      </div>

                      {selectedSanction.orderNo && (
                        <div className="flex items-center justify-between gap-2">
                          <span>Sanction Order No.:</span>
                          <span className="font-semibold text-foreground">
                            #{selectedSanction.orderNo}
                          </span>
                        </div>
                      )}

                      {selectedSanction.expiresAt && (
                        <div className="flex items-center justify-between gap-2">
                          <span>Sanction Expiration (6-Month Rule):</span>
                          <span
                            className={`font-semibold ${
                              selectedSanction.isExpired
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {selectedSanction.expiresAt}{" "}
                            {selectedSanction.isExpired && "(Expired)"}
                          </span>
                        </div>
                      )}

                      {selectedSanction.validFrom && (
                        <div className="flex items-center justify-between gap-2">
                          <span>Sanction Date Range:</span>
                          <span className="font-semibold text-foreground">
                            {selectedSanction.validFrom}{" "}
                            {selectedSanction.validTo
                              ? `to ${selectedSanction.validTo}`
                              : "onwards"}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Never collapsed: this is why the form will not submit. */}
          {specialLeaveIssue && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="size-4 shrink-0 text-rose-500 mt-px" />
              <span>{specialLeaveIssue}</span>
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Full day or half day. Casual Leave only. */}
      {isCasual ? (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Clock className="size-3.5 text-indigo-500" />
            <span>Leave Duration Format</span>
            <span className="text-[10px] font-normal text-muted-foreground">(half-day is CL only)</span>
          </label>

          {/* Hidden input for form submission */}
          <input type="hidden" name="isHalfDay" value={isHalfDay ? "on" : "off"} />

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIsHalfDay(false)}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-semibold transition-all cursor-pointer ${
                !isHalfDay
                  ? "border-indigo-600 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500/20 shadow-xs"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <Calendar className="size-4" />
              <span>Full Day(s)</span>
            </button>

            <button
              type="button"
              onClick={() => setIsHalfDay(true)}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-semibold transition-all cursor-pointer ${
                isHalfDay
                  ? "border-indigo-600 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500/20 shadow-xs"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <Clock className="size-4" />
              <span>Half-Day Session</span>
            </button>
          </div>
          <FieldError {...errorProps("isHalfDay")} />
        </div>
      ) : (
        // Every type other than CL is whole days.
        <input type="hidden" name="isHalfDay" value="off" />
      )}

      {/* While the split is being worked out */}
      {previewing && !preview && !isOptionalHoliday && (
        <div
          className="rounded-xl border border-border bg-muted/30 p-3 space-y-2"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin text-emerald-600" />
            <span>Working out your leave split…</span>
          </div>
          <Skeleton className="h-3 w-2/3 rounded-md" />
          <Skeleton className="h-3 w-1/2 rounded-md" />
        </div>
      )}

      {/* Day count and how the engine splits it (the breakdown below carries
          it for a multi-day leave) */}
      {preview && !isOptionalHoliday && preview.totalDays > 0 && !showBreakdown && (
        <div
          className={`rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs space-y-2 transition-opacity ${
            previewing ? "opacity-60" : ""
          }`}
          aria-busy={previewing}
        >
          <div className="flex flex-wrap items-center gap-2">
            {previewing ? (
              <Loader2 className="size-4 animate-spin text-emerald-600 shrink-0" />
            ) : (
              <Scale className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
            <span className="font-semibold text-foreground">
              Total: {formatDays(preview.totalDays)}
            </span>
            {preview.breakdown.map((b) => (
              <Badge key={b.code} variant="outline">
                {Number.isInteger(b.days) ? b.days : b.days.toFixed(1)} {b.code}
              </Badge>
            ))}
          </div>
          {preview.breakdown.length > 1 && (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Holidays inside this leave are charged as Holiday Leave (HL) and
              declared optional holidays as OH while your 2-day quota lasts, so
              they do not reduce this leave&apos;s balance.
            </p>
          )}
        </div>
      )}

      {/* Editable day-by-day split, validated by the server as it changes */}
      {showBreakdown && preview && (
        <LeaveDayBreakdown
          preview={preview}
          leaveTypes={leaveTypes}
          overrides={activeOverrides}
          onChange={(date, typeId) =>
            setDayOverrides((prev) => {
              const next = { ...prev };
              if (typeId) next[date] = typeId;
              else delete next[date];
              return next;
            })
          }
          open={breakdownOpen || breakdownIssues > 0}
          onToggle={() => setBreakdownOpen(!(breakdownOpen || breakdownIssues > 0))}
          loading={previewing}
        />
      )}

      {/* Optional Holiday Dedicated Paired Adjacent Leave UI */}
      {isOptionalHoliday && (
        <div className="rounded-2xl border-2 border-indigo-500/30 bg-indigo-500/5 p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-indigo-500/20 pb-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Sparkles className="size-4 text-indigo-500" />
              <span>Adjacent Leave Requirement (Minimum 2 Days Total)</span>
            </div>
            <Badge variant="indigo" dot>Rule: 2-Day Minimum</Badge>
          </div>

          {/* Mode selection: Log paired leave now vs already logged */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPairedMode("pair_now")}
              className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left cursor-pointer transition-all ${
                pairedMode === "pair_now"
                  ? "border-indigo-600 bg-card text-foreground ring-2 ring-indigo-500/30 shadow-xs"
                  : "border-border bg-card/60 text-muted-foreground hover:bg-card hover:text-foreground"
              }`}
            >
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Calendar className="size-3.5 text-indigo-500" />
                <span>Apply Accompanying Leave Now</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold px-1.5 py-0.5 rounded-full">Recommended</span>
              </span>
              <span className="text-[11px] text-muted-foreground leading-snug">
                Logs the required accompanying leave (CL, HL, PL, etc.) alongside this Optional Holiday in one click.
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPairedMode("already_logged")}
              className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left cursor-pointer transition-all ${
                pairedMode === "already_logged"
                  ? "border-indigo-600 bg-card text-foreground ring-2 ring-indigo-500/30 shadow-xs"
                  : "border-border bg-card/60 text-muted-foreground hover:bg-card hover:text-foreground"
              }`}
            >
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Clock className="size-3.5 text-emerald-500" />
                <span>Already Logged Adjacent Leave</span>
              </span>
              <span className="text-[11px] text-muted-foreground leading-snug">
                I already have a separate approved/logged leave for the day before or day after.
              </span>
            </button>
          </div>

          {pairedMode === "pair_now" ? (
            <div className="space-y-4 pt-1">
              {/* Step 1: Select Day Before or Day After */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Choose Accompanying Leave Date:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={!startDateVal}
                    onClick={() => {
                      setPairedDirection("before");
                      const targetDate = adjacent?.before;
                      const isHoliday = holidayOptions.some((h) => h.date === targetDate);
                      const hlType = leaveTypes.find((t) => isHolidayLeaveType(t));
                      if (isHoliday && hlType) {
                        setPairedLeaveTypeId(hlType.id);
                      } else if (pairedLeaveTypeId === hlType?.id) {
                        const defaultNonHl = otherLeaveTypes.find((t) => !isHolidayLeaveType(t));
                        setPairedLeaveTypeId(defaultNonHl?.id ?? otherLeaveTypes[0]?.id ?? "");
                      }
                    }}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                      pairedDirection === "before"
                        ? "border-indigo-600 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/30"
                        : "border-border bg-card text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    } ${!startDateVal ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div className="flex flex-col text-left">
                      <span>Day Before (Previous Day)</span>
                      {beforeHoliday && (
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold truncate max-w-[170px]">
                          {beforeHoliday.label}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <strong className="text-foreground block">{adjacent?.before || "—"}</strong>
                      {beforeHoliday && (
                        <span className="text-[9px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold">
                          Holiday
                        </span>
                      )}
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={!startDateVal}
                    onClick={() => {
                      setPairedDirection("after");
                      const targetDate = adjacent?.after;
                      const isHoliday = holidayOptions.some((h) => h.date === targetDate);
                      const hlType = leaveTypes.find((t) => isHolidayLeaveType(t));
                      if (isHoliday && hlType) {
                        setPairedLeaveTypeId(hlType.id);
                      } else if (pairedLeaveTypeId === hlType?.id) {
                        const defaultNonHl = otherLeaveTypes.find((t) => !isHolidayLeaveType(t));
                        setPairedLeaveTypeId(defaultNonHl?.id ?? otherLeaveTypes[0]?.id ?? "");
                      }
                    }}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                      pairedDirection === "after"
                        ? "border-indigo-600 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/30"
                        : "border-border bg-card text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    } ${!startDateVal ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div className="flex flex-col text-left">
                      <span>Day After (Next Day)</span>
                      {afterHoliday && (
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold truncate max-w-[170px]">
                          {afterHoliday.label}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <strong className="text-foreground block">{adjacent?.after || "—"}</strong>
                      {afterHoliday && (
                        <span className="text-[9px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold">
                          Holiday
                        </span>
                      )}
                    </div>
                  </button>
                </div>
              </div>

              {/* Step 2: Select Paired Leave Classification */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Accompanying Leave Classification (CL, HL, PL, etc.)</span>
                  <span className="text-rose-500">*</span>
                </label>
                <FormSelect
                  id="pairedLeaveTypeSelect"
                  value={pairedLeaveTypeId}
                  onChange={(val) => setPairedLeaveTypeId(val)}
                  icon={CalendarOff}
                  placeholder="Select accompanying leave classification"
                  options={otherLeaveTypes.map((t) => {
                    const b = balances?.find((x) => x.leaveTypeId === t.id);
                    const balText = b ? ` (${b.remaining} remaining)` : "";
                    return {
                      value: t.id,
                      label: `${t.name}${balText}`,
                      color: t.color,
                    };
                  })}
                />
                {pairedHoliday && (
                  <p className="text-[11px] text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 font-medium pt-0.5">
                    <Sparkles className="size-3 text-indigo-500 shrink-0" />
                    <span>
                      {pairedDate} is a declared holiday ({pairedHoliday.label}) — automatically selected Holiday Leave (HL). You can still change it if needed.
                    </span>
                  </p>
                )}
              </div>

              {/* Hidden inputs sent to server action logLeave */}
              <input type="hidden" name="pairedLeaveTypeId" value={pairedLeaveTypeId} />
              <input type="hidden" name="pairedLeaveDate" value={pairedDate ?? ""} />
              <input
                type="hidden"
                name="pairedReason"
                value={`Paired with Optional Holiday on ${startDateVal || "selected date"}`}
              />

              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-900 dark:text-indigo-200">
                <span className="font-semibold">Summary of Two Submissions:</span>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-muted-foreground">
                  <li>Day 1: <strong>Optional Holiday</strong> on <span className="text-foreground font-medium">{startDateVal || "[Select date above]"}</span></li>
                  <li>
                    Day 2: <strong>{otherLeaveTypes.find((t) => t.id === pairedLeaveTypeId)?.name ?? "Accompanying Leave"}</strong> on <span className="text-foreground font-medium">{pairedDate || "[Select date above]"}</span>
                    {pairedHoliday ? <span className="text-indigo-600 dark:text-indigo-400 font-semibold"> ({pairedHoliday.label})</span> : ""}
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <span>Verification Notice</span>
              </p>
              <p className="text-muted-foreground leading-relaxed">
                The system will check that you have an existing logged leave on either{" "}
                <strong>{adjacent?.before || "the day before"}</strong> or{" "}
                <strong>{adjacent?.after || "the day after"}</strong>. If no adjacent leave is found in your leave records, submission will be refused per Gujarat Government rules.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Reason TextArea */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="reason"
          className="text-xs font-semibold text-foreground flex items-center gap-1"
        >
          <FileText className="size-3 text-slate-400" />
          <span>Reason / Justification</span>
          <span className="text-muted-foreground text-[10px]">(Optional)</span>
        </label>
        <textarea
          id="reason"
          name="reason"
          rows={3}
          placeholder="Enter reason or handover details..."
          defaultValue={defaults?.reason ?? ""}
          className="w-full min-h-[76px] rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs sm:text-sm shadow-xs hover:border-slate-400 dark:hover:border-slate-600 transition-colors focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 resize-none leading-relaxed"
        />
      </div>

      {/* Image & Document Attachment Upload */}
      {canUploadFiles && (
        <FormFileInput
          name="file"
          label="Attach Document or Proof Image"
          helperText="Upload doctor slip, application letter, or supporting photo (JPG, PNG, PDF, max 10MB)"
          initialFile={initialFile}
        />
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        <Link
          href="/leave"
          className="rounded-xl border border-border bg-card px-4 py-2.5 text-xs sm:text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={
            pending ||
            previewing ||
            (logId ? !dirty : false) ||
            breakdownIssues > 0 ||
            Boolean(quotaIssue) ||
            (requiresSanction && (!matchingSanctions.length || !selectedSanction || Boolean(specialLeaveIssue)))
          }
          title={
            breakdownIssues > 0
              ? "Fix the day-by-day breakdown first"
              : requiresSanction && (!matchingSanctions.length || !selectedSanction)
                ? `An approved ${isBinpagariLeave ? "Binpagari" : "Special"} Leave sanction is required`
                : requiresSanction && specialLeaveIssue
                  ? specialLeaveIssue
                  : previewing
                    ? "Working out your leave split…"
                    : undefined
          }
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md shadow-emerald-600/30 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 transition-all cursor-pointer"
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <span>{logId ? "Save Changes" : "Submit Leave Request"}</span>
          )}
        </button>
      </div>
    </form>
  );
}
