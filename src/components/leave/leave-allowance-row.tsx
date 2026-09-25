"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowRightLeft, Info } from "lucide-react";
import { ColorDot } from "@/components/ui/color-dot";
import { Badge } from "@/components/ui/badge";
import { PendingButton } from "@/components/ui/pending-button";
import { FieldError } from "@/components/ui/field-error";
import { useToast } from "@/components/ui/toast";
import { useFormDirty } from "@/lib/hooks/useFormDirty";
import { useFormFeedback } from "@/lib/hooks/useFormFeedback";
import type { FormState } from "@/lib/forms/formState";

/**
 * One leave type's allowance, as a card.
 *
 * This replaced a table. Carry-forward added two more columns to a grid that
 * already had four, and on a phone that becomes a sideways scroll — the
 * officer swipes to find the field they need and loses the row's name off the
 * left edge. A card holds the same information in a shape that reflows.
 *
 * The card also has to answer a question a table cannot: why "allocated 60"
 * produces "remaining 100". The summary line at the bottom does that in the
 * officer's own numbers rather than leaving them to infer the rule.
 */

export type AllowanceBalance = {
  allocated: number;
  carried_in: number;
  carried_override?: number | null;
  capped_away: number;
  max_accumulated: number | null;
  carry_forward: boolean;
  total_available: number;
  used: number;
  remaining: number;
};

export function LeaveAllowanceRow({
  type,
  balance,
  year,
  userId,
  action,
  saveLabel = "Save",
}: {
  type: { id: string; name: string; color: string | null; isSystem: boolean };
  balance?: AllowanceBalance;
  year: number;
  /** Only the admin form posts this; the self-service one fills it in server-side. */
  userId?: string;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  saveLabel?: string;
}) {
  const [carry, setCarry] = useState(balance?.carry_forward ?? false);
  const [state, formAction] = useActionState<FormState, FormData>(action, undefined);

  // Save is pointless on an untouched row: it writes the same numbers back and
  // revalidates the page for nothing.
  const { formRef, dirty, markClean } = useFormDirty();
  const { fieldProps, errorProps, formMessage } = useFormFeedback({ state });
  const { toast } = useToast();

  // A save that does not navigate was previously silent -- indistinguishable
  // from nothing having happened.
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast(state.message ?? "Saved.");
      markClean();
    } else if (state.message) {
      toast(state.message, "error");
    }
  }, [state, toast, markClean]);

  const allocated = Number(balance?.allocated ?? 0);
  const carriedIn = Number(balance?.carried_in ?? 0);
  const cappedAway = Number(balance?.capped_away ?? 0);
  const totalAvailable = Number(balance?.total_available ?? 0);
  const used = Number(balance?.used ?? 0);
  const remaining = Number(balance?.remaining ?? 0);
  const isOver = remaining < 0;

  return (
    <div className="rounded-xl border border-border/70 bg-card p-3 sm:p-3.5 transition-all duration-150 hover:border-border hover:shadow-2xs">
      {/* Top Title & Remaining / Used Badges in one compact row */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-xs font-bold text-foreground">
          <ColorDot color={type.color} label={type.name} size="sm" />
          <span className="truncate">{type.name}</span>
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-[10px] font-medium text-muted-foreground">
            Used: <strong className="text-foreground">{used}d</strong>
          </span>
          {balance ? (
            <Badge
              variant={isOver ? "danger" : "success"}
              className="px-1.5 py-0 text-[10px] font-bold"
            >
              {isOver ? `-${Math.abs(remaining)}d` : `${remaining}d left`}
            </Badge>
          ) : null}
        </div>
      </div>

      {type.isSystem ? (
        <p className="mt-2 flex items-start gap-1 rounded-lg bg-muted/40 p-2 text-[10px] text-muted-foreground">
          <Info className="mt-0.5 size-3 shrink-0 text-indigo-500" />
          <span>Calculated automatically from holiday calendar. No manual quota.</span>
        </p>
      ) : (
        <form ref={formRef} action={formAction} className="mt-2.5 space-y-2">
          {userId && <input type="hidden" name="userId" value={userId} />}
          <input type="hidden" name="leaveTypeId" value={type.id} />
          <input type="hidden" name="year" value={year} />

          {/* Inline Quota & Carry Toggle Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground text-xs">Annual:</span>
              <input
                type="number"
                step="0.5"
                min="0"
                required
                defaultValue={allocated}
                {...fieldProps("allocated")}
                className="h-6.5 w-16 rounded-md border border-border bg-muted/30 px-1 text-center text-xs font-bold text-foreground shadow-2xs focus:border-indigo-500 focus:bg-card focus:outline-hidden aria-[invalid]:border-rose-500"
              />
              <span className="text-[11px]">days</span>
              <FieldError {...errorProps("allocated")} />
            </label>

            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-foreground">
              <span
                className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors duration-150 ${
                  carry ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <input
                  type="checkbox"
                  name="carryForward"
                  checked={carry}
                  onChange={(e) => setCarry(e.target.checked)}
                  className="absolute inset-0 z-10 cursor-pointer opacity-0"
                />
                <span
                  className={`ml-0.5 size-3 rounded-full bg-white shadow-xs transition-transform duration-150 ${
                    carry ? "translate-x-3" : "translate-x-0"
                  }`}
                />
              </span>
              <span className="flex items-center gap-1 text-[11px] font-medium text-foreground">
                <ArrowRightLeft className="size-2.5 text-indigo-500" />
                Carry over
              </span>
            </label>
          </div>

          {/* Compact Mini-Box when Carry Forward is ON */}
          {carry && (
            <div className="rounded-lg border border-indigo-500/25 bg-indigo-500/5 p-2 space-y-1.5">
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center justify-between gap-1 text-[10px]">
                  <span className="font-semibold text-muted-foreground">Max limit:</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    defaultValue={balance?.max_accumulated ?? ""}
                    {...fieldProps("maxAccumulated")}
                    placeholder="None"
                    className="h-6 w-16 rounded border border-border bg-card px-1.5 text-right text-xs font-medium focus:border-indigo-500 focus:outline-hidden"
                  />
                </label>
                <label className="flex items-center justify-between gap-1 text-[10px]">
                  <span className="font-semibold text-muted-foreground" title="Unused balance from prior years">
                    Prior balance:
                  </span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    defaultValue={balance?.carried_override ?? ""}
                    {...fieldProps("carriedOverride")}
                    placeholder="0"
                    title="Starting this year? Enter unused days from prior years."
                    className="h-6 w-16 rounded border border-border bg-card px-1.5 text-right text-xs font-medium focus:border-indigo-500 focus:outline-hidden"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5 border-t border-indigo-500/15">
                <span>
                  {carriedIn > 0 ? (
                    <>
                      <strong className="text-indigo-600 dark:text-indigo-400">
                        {totalAvailable} days
                      </strong>{" "}
                      (incl. {carriedIn} carried)
                      {cappedAway > 0 && ` · ${cappedAway}d capped`}
                    </>
                  ) : (
                    "Unused days roll into next year."
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Bottom Error & Save Action */}
          <div className="flex items-center justify-between pt-0.5">
            <div className="min-w-0 flex-1 pr-2">
              {formMessage && !state?.ok && (
                <span className="block truncate text-[10px] text-rose-500">
                  {formMessage}
                </span>
              )}
            </div>
            <PendingButton
              disabled={!dirty}
              className="shrink-0 cursor-pointer rounded-lg bg-indigo-600 px-3 py-1 text-[11px] font-semibold text-white shadow-2xs hover:bg-indigo-500 disabled:opacity-40"
            >
              {saveLabel}
            </PendingButton>
          </div>
        </form>
      )}
    </div>
  );
}
