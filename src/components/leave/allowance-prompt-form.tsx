"use client";

import { useActionState, useEffect } from "react";
import { setOwnLeaveAllowance } from "@/actions/leave";
import { PendingButton } from "@/components/ui/pending-button";
import { FieldError } from "@/components/ui/field-error";
import { useToast } from "@/components/ui/toast";
import { useFormFeedback } from "@/lib/hooks/useFormFeedback";
import type { FormState } from "@/lib/forms/formState";

/**
 * The January prompt's inline "how many days were you granted?" form.
 *
 * Split into its own client component because each leave type gets its own
 * form and therefore its own action state — one shared `useActionState` in
 * the parent would put every row's error under every row.
 *
 * No dirty-check here on purpose: this form starts empty, and the whole point
 * is that the officer types the one number it wants.
 */
export function AllowancePromptForm({
  leaveTypeId,
  typeName,
  year,
  carryForward,
  maxAccumulated,
}: {
  leaveTypeId: string;
  typeName: string;
  year: number;
  carryForward: boolean;
  maxAccumulated: number | null;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    setOwnLeaveAllowance,
    undefined,
  );
  const { formRef, fieldProps, errorProps } = useFormFeedback({ state });
  const { toast } = useToast();

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast(state.message ?? "Allowance saved.");
    else if (state.message) toast(state.message, "error");
  }, [state, toast]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex shrink-0 flex-col gap-1"
    >
      <div className="flex items-center gap-2">
        <input type="hidden" name="leaveTypeId" value={leaveTypeId} />
        <input type="hidden" name="year" value={year} />
        {/* The rule is unchanged by this form — it re-posts what is already
            stored, so answering the prompt cannot silently switch someone's
            carry-forward off. */}
        {carryForward && <input type="hidden" name="carryForward" value="on" />}
        {maxAccumulated !== null && (
          <input type="hidden" name="maxAccumulated" value={maxAccumulated} />
        )}
        <input
          type="number"
          step="0.5"
          min="0"
          required
          placeholder="Days"
          aria-label={`Days granted for ${typeName} in ${year}`}
          {...fieldProps("allocated")}
          className="w-24 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-2xs focus:border-indigo-500 focus:outline-hidden aria-[invalid]:border-rose-500"
        />
        <PendingButton className="cursor-pointer rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500">
          Save
        </PendingButton>
      </div>
      <FieldError {...errorProps("allocated")} />
    </form>
  );
}
