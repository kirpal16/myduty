"use client";

import { useState } from "react";
import { NavLink as Link } from "@/components/ui/nav-link";
import {
  AlertTriangle,
  CalendarPlus,
  Clock,
  ArrowRight,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";
import { ColorDot } from "@/components/ui/color-dot";
import { AllowancePromptForm } from "./allowance-prompt-form";
import { daysAtRisk } from "@/lib/leave/carryForward";
import { useLanguage } from "@/lib/i18n/language-context";
import { toGujaratiNumerals } from "@/lib/reports/gujaratiReportUtils";
import { getPureGujaratiLeaveTypeName } from "@/lib/leave/leaveTranslation";

/**
 * The two things an officer needs telling about their leave year.
 *
 * Both are quiet by default: they render nothing at all unless there is
 * something to say. A banner that is always present is not read on the one
 * occasion it matters.
 */

export type LeaveYearRow = {
  leave_type_id: string;
  allocated: number;
  allocation_exists: boolean;
  carried_in: number;
  carry_forward: boolean;
  max_accumulated: number | null;
  remaining: number;
};

export type LeaveTypeInfo = {
  id: string;
  name: string;
  code?: string | null;
  color: string | null;
  isSystem: boolean;
};

import { isSickOrEmergencyLeave } from "@/lib/leave/emergencyLeaveRules";
export { isSickOrEmergencyLeave };

/** October onwards — see the comment on the component below. */
const WARNING_FROM_MONTH = 9; // 0-indexed: 9 = October

export function LeaveYearAlerts({
  rows,
  types,
  year,
  nextYearRows = [],
  now = new Date(),
}: {
  rows: LeaveYearRow[];
  types: LeaveTypeInfo[];
  year: number;
  /** Next year's rows, if any exist yet, so the estimate can be exact. */
  nextYearRows?: { leave_type_id: string; allocated: number; allocation_exists: boolean }[];
  now?: Date;
}) {
  const typeById = new Map(types.map((t) => [t.id, t]));
  const nextByType = new Map(nextYearRows.map((r) => [r.leave_type_id, r]));

  // ---------------------------------------------------------------------
  // A. Days that will not survive 31 December.
  //
  // Shown from October only. Running this from January would make it
  // wallpaper by March, and the point is to prompt action while there is
  // still time to book the leave.
  // ---------------------------------------------------------------------
  const expiring =
    now.getMonth() >= WARNING_FROM_MONTH
      ? rows
          .map((row) => {
            const type = typeById.get(row.leave_type_id);
            // Holiday Leave is never "lost" in this sense — working a holiday
            // earns extra pay instead. Warning about it would be wrong.
            if (!type || type.isSystem) return null;

            const next = nextByType.get(row.leave_type_id);
            const days = daysAtRisk({
              remaining: Number(row.remaining ?? 0),
              allocated: Number(row.allocated ?? 0),
              rule: {
                carryForward: row.carry_forward,
                maxAccumulated: row.max_accumulated,
              },
              // Only a saved row counts as known; a placeholder zero would
              // make the estimate confidently wrong.
              nextYearAllocation: next?.allocation_exists ? next.allocated : null,
            });

            if (days <= 0) return null;
            const isEmergency = isSickOrEmergencyLeave(type);
            return {
              type,
              days,
              row,
              estimated: !next?.allocation_exists,
              isEmergency,
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)
      : [];

  const routineExpiring = expiring.filter((item) => !item.isEmergency);
  const emergencyLeaves = expiring.filter((item) => item.isEmergency);

  // ---------------------------------------------------------------------
  // B. This year's grant has not been entered.
  //
  // Carry-forward happens on its own, but the new year's allocation is a
  // number only the officer knows. Until they enter it the balance is just
  // the carried days and reads as wrong.
  //
  // Keyed off allocation_exists, never off `allocated === 0`: an officer who
  // genuinely has no entitlement sets 0 once and must not be asked again.
  // ---------------------------------------------------------------------
  const unset = rows
    .map((row) => {
      const type = typeById.get(row.leave_type_id);
      if (!type || type.isSystem) return null;
      if (row.allocation_exists) return null;
      if (Number(row.carried_in ?? 0) <= 0) return null;
      return { type, row };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const { t, isGujarati } = useLanguage();
  const [isOpen, setIsOpen] = useState(true);

  if (expiring.length === 0 && unset.length === 0) return null;

  // Days remaining until December 31st
  const endOfYear = new Date(year, 11, 31, 23, 59, 59);
  const msDiff = endOfYear.getTime() - now.getTime();
  const daysLeftInYear = Math.max(0, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));

  // Sick/emergency leave is not counted towards "days lost" warning.
  const totalDaysLost = routineExpiring.reduce((sum, item) => sum + item.days, 0);
  const totalEmergencyDays = emergencyLeaves.reduce((sum, item) => sum + Number(item.row.remaining ?? 0), 0);
  const hasRoutineLoss = totalDaysLost > 0;

  return (
    <div className="space-y-3.5">
      {unset.map(({ type, row }) => (
        <div
          key={`unset-${type.id}`}
          className="rounded-2xl border border-border/80 bg-card p-4 sm:p-4.5 shadow-xs flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <div className="flex size-9 sm:size-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <CalendarPlus className="size-4 sm:size-5" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-semibold text-foreground">
                {t.leaveAlerts.pendingAllocationTitle}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="font-semibold text-foreground">
                  {isGujarati ? `${toGujaratiNumerals(row.carried_in)} દિવસ` : `${row.carried_in}d`} {t.common.of}{" "}
                  <ColorDot color={type.color} label={isGujarati ? getPureGujaratiLeaveTypeName(type.name) : type.name} />{" "}
                  {isGujarati ? getPureGujaratiLeaveTypeName(type.name) : type.name}
                </span>{" "}
                {t.leaveAlerts.pendingAllocationDesc
                  .replace("{carried_in}", String(isGujarati ? toGujaratiNumerals(row.carried_in) : row.carried_in))
                  .replace("{lastYear}", String(isGujarati ? toGujaratiNumerals(year - 1) : year - 1))
                  .replace("{year}", String(isGujarati ? toGujaratiNumerals(year) : year))}
              </p>
            </div>
          </div>

          <AllowancePromptForm
            leaveTypeId={type.id}
            typeName={isGujarati ? getPureGujaratiLeaveTypeName(type.name) : type.name}
            year={year}
            carryForward={row.carry_forward}
            maxAccumulated={row.max_accumulated}
          />
        </div>
      ))}

      {expiring.length > 0 && (
        <div className="rounded-2xl border border-border/90 bg-card shadow-xs transition-all">
          {/* Header Row (Accordion Trigger) */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 sm:p-5">
            <button
              type="button"
              onClick={() => setIsOpen((prev) => !prev)}
              aria-expanded={isOpen}
              aria-label={isOpen ? "Collapse leave details" : "Expand leave details"}
              className="flex items-start gap-3 min-w-0 text-left cursor-pointer group select-none flex-1"
            >
              <div
                className={`flex size-9 sm:size-10 items-center justify-center rounded-xl shrink-0 transition-colors ${
                  hasRoutineLoss
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 group-hover:bg-amber-500/15"
                    : "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 group-hover:bg-sky-500/15"
                }`}
              >
                {hasRoutineLoss ? (
                  <AlertTriangle className="size-4 sm:size-5" />
                ) : (
                  <ShieldCheck className="size-4 sm:size-5" />
                )}
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-semibold text-foreground tracking-tight group-hover:text-primary transition-colors">
                    {hasRoutineLoss
                      ? t.leaveAlerts.expiringTitle
                      : t.leaveAlerts.emergencyTitle}
                  </h4>
                  {hasRoutineLoss && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-2.5 py-0.5 text-[11px] font-semibold">
                      {isGujarati
                        ? `${toGujaratiNumerals(totalDaysLost)} ${t.leaveAlerts.daysAtRiskBadge}`
                        : `${totalDaysLost}${t.leaveAlerts.daysAtRiskBadge}`}
                    </span>
                  )}
                  {emergencyLeaves.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 px-2.5 py-0.5 text-[11px] font-semibold">
                      <ShieldCheck className="size-3 text-sky-500" />
                      {isGujarati
                        ? `${toGujaratiNumerals(totalEmergencyDays)} ${t.leaveAlerts.emergencyQuotaBadge}`
                        : `${totalEmergencyDays}${t.leaveAlerts.emergencyQuotaBadge}`}
                    </span>
                  )}
                  {daysLeftInYear > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground border border-border/70 px-2 py-0.5 text-[11px] font-medium">
                      <Clock className="size-3 text-muted-foreground/80" />
                      {isGujarati
                        ? `${toGujaratiNumerals(daysLeftInYear)} ${t.leaveAlerts.daysLeftBadge} ${toGujaratiNumerals(year)}`
                        : `${daysLeftInYear}${t.leaveAlerts.daysLeftBadge} ${year}`}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {hasRoutineLoss
                    ? t.leaveAlerts.expiringSubtitle.replace("{year}", String(isGujarati ? toGujaratiNumerals(year) : year))
                    : t.leaveAlerts.emergencySubtitle.replace("{nextYear}", String(isGujarati ? toGujaratiNumerals(year + 1) : year + 1))}
                </p>
              </div>
            </button>

            {/* Quick Actions & Accordion Toggle */}
            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 pt-1 sm:pt-0">
              <Link
                href={`/leave/balance?year=${year}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/80 border border-border/60 hover:border-border transition-all"
              >
                <span>{t.leaveAlerts.balances}</span>
                <ArrowRight className="size-3" />
              </Link>
              {hasRoutineLoss && (
                <Link
                  href={`/leave/new?year=${year}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 active:scale-98 text-primary-foreground text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                >
                  <CalendarPlus className="size-3.5" />
                  <span>{t.leaveAlerts.logLeave}</span>
                </Link>
              )}
              <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                aria-expanded={isOpen}
                aria-label={isOpen ? "Collapse leave details" : "Expand leave details"}
                className="flex size-8 items-center justify-center rounded-xl border border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all cursor-pointer"
                title={isOpen ? "Collapse details" : "Expand details"}
              >
                <ChevronDown
                  className={`size-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
            </div>
          </div>

          {/* Cards Breakdown Grid (Collapsible Accordion Body) */}
          {isOpen && (
            <div className="border-t border-border/60 px-4 pb-4 sm:px-5 sm:pb-5 pt-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Routine expiring leaves (at risk of loss) */}
                {routineExpiring.map(({ type, days, row, estimated }) => {
                  const safeDays = Math.max(0, Number(row.remaining ?? 0) - days);
                  const totalRemaining = Math.max(0.1, Number(row.remaining ?? 0));
                  const lostPercent = Math.min(100, Math.max(0, Math.round((days / totalRemaining) * 100)));
                  const isFullLoss = safeDays === 0;
                  const typeDisplayName = isGujarati ? getPureGujaratiLeaveTypeName(type.name) : type.name;

                  return (
                    <div
                      key={type.id}
                      className="group relative flex flex-col justify-between rounded-xl border border-border/70 bg-card hover:bg-muted/30 p-3.5 shadow-2xs hover:border-border hover:shadow-xs transition-all duration-150"
                    >
                      <div>
                        {/* Card Title & Tag */}
                        <div className="flex items-center justify-between gap-1.5 mb-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <ColorDot color={type.color} label={typeDisplayName} />
                            <span
                              className="font-semibold text-xs text-foreground truncate"
                              title={typeDisplayName}
                            >
                              {typeDisplayName}
                            </span>
                          </div>
                          <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
                            {isGujarati
                              ? `-${toGujaratiNumerals(days)} ${t.leaveAlerts.daysLost}`
                              : `-${days}${t.leaveAlerts.daysLost}`}
                          </span>
                        </div>

                        {/* Numeric stats */}
                        <div className="flex items-baseline justify-between mb-2">
                          <div className="flex items-baseline gap-1">
                            <span className="text-base font-bold tracking-tight text-foreground">
                              {isGujarati ? `${toGujaratiNumerals(row.remaining)} દિવસ` : `${row.remaining}d`}
                            </span>
                            <span className="text-[11px] font-normal text-muted-foreground">
                              {t.leaveAlerts.remaining}
                            </span>
                          </div>
                          <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                            {isFullLoss
                              ? t.leaveAlerts.fullAtRisk
                              : isGujarati
                              ? `${toGujaratiNumerals(days)} ${t.leaveAlerts.daysAtRiskBadge}`
                              : `${days}${t.leaveAlerts.daysAtRiskBadge}`}
                          </span>
                        </div>

                        {/* Visual Segmented Bar */}
                        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden flex mb-2">
                          {safeDays > 0 && (
                            <div
                              style={{ width: `${100 - lostPercent}%` }}
                              className="h-full bg-emerald-500/70 transition-all"
                              title={
                                isGujarati
                                  ? `${toGujaratiNumerals(safeDays)} દિવસ સુરક્ષિત રીતે આગળ વધશે`
                                  : `${safeDays}d carries forward safely`
                              }
                            />
                          )}
                          <div
                            style={{ width: `${lostPercent}%` }}
                            className="h-full bg-rose-500/70 transition-all"
                            title={
                              isGujarati
                                ? `${toGujaratiNumerals(days)} દિવસ રદ થશે`
                                : `${days}d will lapse`
                            }
                          />
                        </div>

                        {/* Context description */}
                        <p className="text-[11px] text-muted-foreground leading-snug min-h-[2.25rem]">
                          {row.carry_forward && estimated ? (
                            <span>
                              {t.leaveAlerts.exceedsLimitIfGranted
                                .replace("{days}", String(isGujarati ? toGujaratiNumerals(row.allocated) : row.allocated))
                                .replace("{year}", String(isGujarati ? toGujaratiNumerals(year + 1) : year + 1))}
                            </span>
                          ) : !row.carry_forward ? (
                            <span>
                              {t.leaveAlerts.willNotCarryOver.replace("{year}", String(isGujarati ? toGujaratiNumerals(year + 1) : year + 1))}
                            </span>
                          ) : (
                            <span>
                              {t.leaveAlerts.exceedsMaxAccumulated.replace(
                                "{days}",
                                String(isGujarati ? toGujaratiNumerals(row.max_accumulated) : row.max_accumulated)
                              )}
                            </span>
                          )}
                        </p>
                      </div>

                      {/* 1-Click Action */}
                      <Link
                        href={`/leave/new?leaveTypeId=${type.id}&year=${year}`}
                        className="inline-flex items-center justify-between w-full pt-2 mt-2 border-t border-border/50 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
                      >
                        <span className="truncate">{t.leaveAlerts.logType} {typeDisplayName}</span>
                        <ArrowRight className="size-3 shrink-0 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </div>
                  );
                })}

                {/* 2. Emergency / Sick leaves (informational emergency balance, not lost) */}
                {emergencyLeaves.map(({ type, row }) => {
                  const emergencyDisplayName = isGujarati ? getPureGujaratiLeaveTypeName(type.name) : type.name;

                  return (
                    <div
                      key={type.id}
                      className="group relative flex flex-col justify-between rounded-xl border border-sky-500/25 bg-sky-500/[0.03] dark:bg-sky-500/[0.06] hover:bg-sky-500/[0.08] p-3.5 shadow-2xs hover:border-sky-500/40 hover:shadow-xs transition-all duration-150"
                    >
                      <div>
                        {/* Card Title & Tag */}
                        <div className="flex items-center justify-between gap-1.5 mb-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <ColorDot color={type.color} label={emergencyDisplayName} />
                            <span
                              className="font-semibold text-xs text-foreground truncate"
                              title={emergencyDisplayName}
                            >
                              {emergencyDisplayName}
                            </span>
                          </div>
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/25 shrink-0">
                            <ShieldCheck className="size-2.5 text-sky-500" />
                            {t.leaveAlerts.emergencyTag}
                          </span>
                        </div>

                        {/* Numeric stats */}
                        <div className="flex items-baseline justify-between mb-2">
                          <div className="flex items-baseline gap-1">
                            <span className="text-base font-bold tracking-tight text-foreground">
                              {isGujarati ? `${toGujaratiNumerals(row.remaining)} દિવસ` : `${row.remaining}d`}
                            </span>
                            <span className="text-[11px] font-normal text-muted-foreground">
                              {t.leaveAlerts.available}
                            </span>
                          </div>
                          <span className="text-[11px] font-medium text-sky-600 dark:text-sky-400">
                            {t.leaveAlerts.asNeeded}
                          </span>
                        </div>

                        {/* Visual Reassuring Bar */}
                        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden flex mb-2">
                          <div
                            style={{ width: "100%" }}
                            className="h-full bg-sky-500/70 dark:bg-sky-400/70 transition-all rounded-full"
                            title={
                              isGujarati
                                ? `${toGujaratiNumerals(row.remaining)} દિવસ અનામત`
                                : `${row.remaining}d reserved for medical & emergency needs`
                            }
                          />
                        </div>

                        {/* Context description */}
                        <p className="text-[11px] text-muted-foreground leading-snug min-h-[2.25rem]">
                          {t.leaveAlerts.emergencyReserveDesc.replace(
                            "{year}",
                            String(isGujarati ? toGujaratiNumerals(year + 1) : year + 1)
                          )}
                        </p>
                      </div>

                      {/* 1-Click Action */}
                      <Link
                        href={`/leave/new?leaveTypeId=${type.id}&year=${year}`}
                        className="inline-flex items-center justify-between w-full pt-2 mt-2 border-t border-sky-500/20 text-[11px] font-medium text-sky-700 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 transition-colors"
                      >
                        <span className="truncate">{t.leaveAlerts.logIfNeeded}</span>
                        <ArrowRight className="size-3 shrink-0 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

