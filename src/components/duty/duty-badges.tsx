"use client";

import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format/currency";
import { Sparkles, Route } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";
import { toGujaratiNumerals } from "@/lib/reports/gujaratiReportUtils";

/**
 * The badges a duty row shows, in one place so the desktop table and the
 * mobile card cannot drift apart — they previously showed different sets (the
 * mobile card had a status badge the table lacked, and neither showed the
 * holiday state at all, because it lived in a note tag nothing could read).
 */
export type DutyBadgeRow = {
  status?: string | null;
  is_holiday_duty?: boolean | null;
  manual_holiday_claim?: boolean | null;
  ta_amount?: number | null;
};

export function DutyStatusBadge({
  status,
  isGujarati: propIsGujarati,
}: {
  status?: string | null;
  isGujarati?: boolean;
}) {
  const { isGujarati: contextIsGu, t } = useLanguage();
  const isGu = propIsGujarati ?? contextIsGu;
  const value = status ?? "SCHEDULED";
  const variant =
    value === "CANCELLED" ? "danger" : value === "COMPLETED" ? "success" : "secondary";

  let label: string = value;
  if (value === "COMPLETED") label = t.duty.completed;
  else if (value === "CANCELLED") label = t.duty.cancelled;
  else if (value === "SCHEDULED") label = t.duty.scheduled;

  return <Badge variant={variant}>{label}</Badge>;
}

/**
 * "Holiday" means the officer WORKED a holiday, weekend off or day off —
 * `is_holiday_duty`, not merely that the date was one. "Holiday claim" is the
 * separate case of claiming holiday pay on an ordinary working day.
 */
export function DutyHolidayBadge({
  duty,
  iconOnly = false,
  isGujarati: propIsGujarati,
}: {
  duty: DutyBadgeRow;
  /**
   * Drops the label and keeps the sparkle. A phone card cannot fit an officer
   * name plus two text badges on one line, and wrapping them looked broken —
   * so mobile shows the mark alone. The meaning moves to aria-label/title,
   * or the badge would be a silent decoration to a screen reader and
   * unexplained to anyone hovering it.
   */
  iconOnly?: boolean;
  isGujarati?: boolean;
}) {
  const { isGujarati: contextIsGu, t } = useLanguage();
  const isGu = propIsGujarati ?? contextIsGu;

  if (duty.is_holiday_duty) {
    const label = t.duty.badgeWorkedHoliday;
    return (
      <Badge variant="warning" aria-label={label} title={label}>
        <Sparkles className="size-3" />
        {!iconOnly && label}
      </Badge>
    );
  }
  if (duty.manual_holiday_claim) {
    const label = t.duty.badgeHolidayClaim;
    return iconOnly ? (
      <Badge variant="secondary" aria-label={label} title={label}>
        <Sparkles className="size-3" />
      </Badge>
    ) : (
      <Badge variant="secondary">{label}</Badge>
    );
  }
  return null;
}

/**
 * Travelling allowance, when the duty claimed any.
 *
 * Renders nothing at all when there is no TA — an empty "₹0" pill on every
 * office shift would be noise, and the absence of the badge is the fact worth
 * showing. Zero counts as no claim for the same reason.
 */
export function DutyTaBadge({
  duty,
  iconOnly = false,
  isGujarati: propIsGujarati,
}: {
  duty: DutyBadgeRow;
  /** Icon alone, for the mobile card where the amount has its own row. */
  iconOnly?: boolean;
  isGujarati?: boolean;
}) {
  const { isGujarati: contextIsGu } = useLanguage();
  const isGu = propIsGujarati ?? contextIsGu;
  const amount = Number(duty.ta_amount ?? 0);
  if (!amount) return null;

  const formattedAmount = isGu ? toGujaratiNumerals(formatCurrency(amount)) : formatCurrency(amount);
  const label = `TA ${formattedAmount}`;
  return (
    <Badge variant="success" aria-label={label} title={label}>
      <Route className="size-3" />
      {!iconOnly && formattedAmount}
    </Badge>
  );
}
