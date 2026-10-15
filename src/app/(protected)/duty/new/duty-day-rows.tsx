"use client";

import { useState } from "react";
import {
  Sparkles,
  Navigation,
  MapPin,
  Compass,
  IndianRupee,
  ChevronDown,
  CalendarDays,
  Copy,
  Car,
  ShieldCheck,
  Check,
} from "lucide-react";
import type { DutyDaySlot } from "@/lib/duty/splitDuty";
import {
  resolveHoliday,
  holidayKindLabel,
  type HolidayRecord,
} from "@/lib/holidays/resolveHoliday";
import { formatSafeDateFull } from "@/lib/format/safeDate";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { useLanguage } from "@/lib/i18n/language-context";
import { toGujaratiNumerals } from "@/lib/reports/gujaratiReportUtils";

export type DayDefaults = {
  taFromPlace?: string;
  taToPlace?: string;
  taVehicleType?: string;
  taDistanceKm?: string;
  taAmount?: string;
};

const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/**
 * One editable row per day of a multi-day entry.
 *
 * A three-day duty is three shifts, and TA differs for each — Ahmedabad to
 * Gandhinagar on Monday, to Vadodara on Wednesday — so every day carries its
 * own route and amount rather than inheriting one set. This panel is the ONLY
 * TA input while it is showing (the shared section hides), so no two fields
 * can disagree about a day; "copy first day to all" covers the repetitive case.
 *
 * The holiday badge here is INDICATIVE ONLY. The server re-derives the
 * classification from the date on submit and ignores anything the client
 * claims about it; the officer's only real input is the amount.
 */
export function DutyDayRows({
  slots,
  holidays,
  holidayDayRate,
  shared,
}: {
  slots: DutyDaySlot[];
  holidays: HolidayRecord[];
  holidayDayRate: number;
  shared: DayDefaults;
}) {
  const { isGujarati, t } = useLanguage();
  const [openDay, setOpenDay] = useState<string | null>(slots[0]?.dateKey ?? null);

  /**
   * Most multi-day duties repeat the same journey, so typing it once and
   * copying down keeps the common case to a single edit while leaving every
   * day individually editable for the case that matters (item 21).
   */
  const copyFirstDayToAll = () => {
    const form = document.getElementById("duty-day-rows");
    if (!form) return;
    const first = slots[0];
    const fields = ["taFromPlace", "taToPlace", "taVehicleType", "taDistanceKm", "taAmount"] as const;

    for (const field of fields) {
      const source = form.querySelector<HTMLInputElement>(
        `[name="perDay.${first.dateKey}.${field}"]`,
      );
      if (!source) continue;
      for (const slot of slots.slice(1)) {
        const target = form.querySelector<HTMLInputElement>(
          `[name="perDay.${slot.dateKey}.${field}"]`,
        );
        if (target) target.value = source.value;
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-3.5">
        <CalendarDays className="size-4.5 shrink-0 text-indigo-500 mt-0.5" />
        <div className="text-[11px] text-muted-foreground">
          <p className="font-bold text-foreground text-xs">
            {t.duty.multiDayNotice.replace(
              "{count}",
              isGujarati ? toGujaratiNumerals(slots.length) : String(slots.length),
            )}
          </p>
          <p className="mt-0.5">
            {t.duty.multiDayNoticeSub}
          </p>
        </div>
      </div>

      {slots.length > 1 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={copyFirstDayToAll}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <Copy className="size-3" />
            {t.duty.copyFirstDayTravel}
          </button>
        </div>
      )}

      <div
        id="duty-day-rows"
        className="divide-y divide-border overflow-hidden rounded-2xl border border-border"
      >
        {slots.map((slot) => {
          const resolution = resolveHoliday(slot.startsAt, holidays);
          const isOpen = openDay === slot.dateKey;
          const p = `perDay.${slot.dateKey}`;

          return (
            <div key={slot.dateKey} className="bg-card">
              <button
                type="button"
                onClick={() => setOpenDay(isOpen ? null : slot.dateKey)}
                aria-expanded={isOpen}
                className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-foreground">
                    {formatSafeDateFull(slot.startsAt, isGujarati)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {hhmm(slot.startsAt)} – {hhmm(slot.endsAt)}
                  </span>
                  {resolution.isHoliday &&
                    (resolution.kind === "optional_holiday" ? (
                      // Purple, not amber: an optional holiday earns nothing.
                      <span className="inline-flex items-center gap-1 rounded-lg border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                        {holidayKindLabel(resolution.kind, isGujarati)} · {t.common.noExtraPay}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                        <Sparkles className="size-3" />
                        {holidayKindLabel(resolution.kind, isGujarati)}
                      </span>
                    ))}
                </div>
                <ChevronDown
                  className={`size-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""
                    }`}
                />
              </button>

              {/* Values must post whether or not the row is expanded, so the
                  inputs stay mounted and only their container is hidden. */}
              <div className={isOpen ? "block" : "hidden"}>
                <div className="space-y-3 border-t border-border/60 bg-muted/30 px-4 py-4">
                  <DayTravel prefix={p} shared={shared} />

                  {resolution.kind === "optional_holiday" ? (
                    <p className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 text-[11px] font-medium text-purple-900 dark:text-purple-200">
                      {t.duty.optionalHolidayRegularWorkingNotice.replace(
                        "{name}",
                        resolution.name ?? holidayKindLabel(resolution.kind, isGujarati),
                      )}
                    </p>
                  ) : resolution.qualifiesForHolidayAllowance ? (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                      <Field
                        name={`${p}.holidayAllowance`}
                        label={`${t.duty.holidayExtraPayFieldLabel} — ${
                          resolution.name ?? holidayKindLabel(resolution.kind, isGujarati)
                        }`}
                        icon={Sparkles}
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={holidayDayRate > 0 ? String(holidayDayRate) : ""}
                        placeholder={holidayDayRate > 0 ? String(holidayDayRate) : "0.00"}
                      />
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {t.duty.appliedAutoHolidayWorked}
                        {holidayDayRate === 0 && ` ${t.duty.setSettingsDefaultRate}`}
                      </p>
                    </div>
                  ) : (
                    <ManualClaim name={p} holidayDayRate={holidayDayRate} />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * One day's travel, in a collapsed section of its own — most days of a
 * multi-day duty repeat the same journey (or none). The inputs stay mounted
 * while closed, so "copy first day to all" and the form post still see them.
 */
function DayTravel({ prefix, shared }: { prefix: string; shared: DayDefaults }) {
  const { isGujarati, t } = useLanguage();
  const hasShared = Boolean(
    shared.taFromPlace || shared.taToPlace || shared.taDistanceKm || shared.taAmount,
  );
  const [open, setOpen] = useState(hasShared);
  const [vehicleType, setVehicleType] = useState<string>(shared.taVehicleType ?? "govt");

  return (
    <CollapsibleSection
      title={t.duty.taClaimTitle}
      icon={Compass}
      summary={open ? undefined : t.common.tapToAdd}
      open={open}
      onToggle={() => setOpen((o) => !o)}
      className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-3"
    >
      <div className="space-y-3 pb-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            name={`${prefix}.taFromPlace`}
            label={t.duty.departurePlaceLabel}
            icon={Navigation}
            defaultValue={shared.taFromPlace}
            placeholder={t.duty.departurePlaceholder}
          />
          <Field
            name={`${prefix}.taToPlace`}
            label={t.duty.arrivalPlaceLabel}
            icon={MapPin}
            defaultValue={shared.taToPlace}
            placeholder={t.duty.arrivalPlaceholder}
          />
        </div>

        {/* Vehicle Selection for Day */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-foreground flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Car className="size-3 text-sky-500" />
              <span>{t.duty.vehicleTypeLabel}</span>
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 font-mono">
              {vehicleType === "govt" ? t.duty.govtVehicleShort : t.duty.pvtVehicleShort}
            </span>
          </label>
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted/60 border border-border">
            <button
              type="button"
              onClick={() => setVehicleType("private")}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                vehicleType === "private"
                  ? "bg-card text-foreground shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Car className="size-3 text-sky-500" />
              <span>{t.duty.privateVehicle}</span>
            </button>
            <button
              type="button"
              onClick={() => setVehicleType("govt")}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                vehicleType === "govt"
                  ? "bg-card text-foreground shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShieldCheck className="size-3 text-emerald-500" />
              <span>{t.duty.govtVehicle}</span>
            </button>
          </div>
          <input type="hidden" name={`${prefix}.taVehicleType`} value={vehicleType} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            name={`${prefix}.taDistanceKm`}
            label={t.duty.totalDistanceKm}
            icon={Compass}
            type="number"
            step="0.1"
            min="0"
            defaultValue={shared.taDistanceKm}
            placeholder="24.5"
          />
          <Field
            name={`${prefix}.taAmount`}
            label={t.duty.claimAmount}
            icon={IndianRupee}
            type="number"
            step="0.01"
            min="0"
            defaultValue={shared.taAmount}
            placeholder="500.00"
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}

/**
 * Holiday pay on a day the calendar does NOT call a holiday. Kept as an
 * explicit, separate claim rather than letting the officer mark the date
 * itself as a holiday — the classification stays the calendar's, the claim
 * stays theirs.
 */
function ManualClaim({
  name,
  holidayDayRate,
}: {
  name: string;
  holidayDayRate: number;
}) {
  const [claiming, setClaiming] = useState(false);
  const { t } = useLanguage();

  return (
    <div
      className={`rounded-xl border transition-all duration-150 overflow-hidden ${
        claiming
          ? "border-amber-500/40 bg-amber-500/[0.03] dark:bg-amber-950/20 shadow-2xs"
          : "border-border/70 bg-card/60 hover:border-amber-500/30"
      }`}
    >
      <label className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left group select-none transition-colors">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles
            className="size-3.5 shrink-0 text-amber-500 fill-amber-500/20"
          />
          <span className="text-xs font-bold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 truncate transition-colors">
            {t.duty.claimHolidayPayLabel}
          </span>
          <span className="text-[10px] text-muted-foreground hidden sm:inline truncate">
            {t.duty.holidayExtraPayTag}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10">
            {claiming ? t.duty.holidayDutyExtraPayTitle : t.duty.notClaimed}
          </span>

          <input
            type="checkbox"
            name={`${name}.manualHolidayClaim`}
            checked={claiming}
            onChange={(e) => setClaiming(e.target.checked)}
            className="sr-only"
          />

          <div
            aria-hidden="true"
            className={`size-4.5 rounded-md border flex items-center justify-center transition-all duration-150 shadow-2xs ${
              claiming
                ? "bg-amber-500 border-amber-500 text-white shadow-xs shadow-amber-500/30"
                : "border-slate-300 dark:border-slate-600 bg-background group-hover:border-amber-400"
            }`}
          >
            {claiming && (
              <Check className="size-3 stroke-[3] animate-in zoom-in-75 duration-100" />
            )}
          </div>
        </div>
      </label>

      {claiming && (
        <div className="p-3 pt-2.5 border-t border-amber-500/20 bg-muted/20 animate-in fade-in slide-in-from-top-1 duration-200">
          <Field
            name={`${name}.holidayAllowance`}
            label={t.duty.holidayExtraPayFieldLabel}
            icon={Sparkles}
            type="number"
            step="0.01"
            min="0"
            defaultValue={holidayDayRate > 0 ? String(holidayDayRate) : ""}
            placeholder="500.00"
          />
        </div>
      )}
    </div>
  );
}

function Field({
  name,
  label,
  icon: Icon,
  ...props
}: {
  name: string;
  label: string;
  icon: React.ElementType;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={name}
        className="flex items-center gap-1 text-[11px] font-semibold text-foreground"
      >
        <Icon className="size-3 text-slate-400" />
        <span>{label}</span>
      </label>
      <input
        id={name}
        name={name}
        className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-xs transition-colors hover:border-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 dark:hover:border-slate-600"
        {...props}
      />
    </div>
  );
}
