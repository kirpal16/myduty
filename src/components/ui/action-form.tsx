"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { PendingButton } from "./pending-button";
import { FieldError } from "./field-error";
import { FormSelect } from "./form-select";
import { useToast } from "./toast";
import { useFormFeedback } from "@/lib/hooks/useFormFeedback";
import { useFormDirty } from "@/lib/hooks/useFormDirty";
import type { FormState } from "@/lib/forms/formState";

/**
 * A small create/edit form, described rather than written out.
 *
 * The admin screens each had the same form four times over — a few labelled
 * inputs and a submit — written by hand in a SERVER component, which is why
 * none of them could show a field error: reporting one needs `useActionState`,
 * and that is a client hook.
 *
 * Everything here is serialisable (plain field descriptors plus a server
 * action reference), so a server component can still render it. A render-prop
 * would have been more flexible and would not have crossed that boundary at
 * all: functions cannot be passed from a server component.
 */

export type ActionFormField = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "time" | "select" | "checkbox";
  placeholder?: string;
  required?: boolean;
  defaultValue?: string | number;
  /** For `select`. */
  options?: { value: string; label: string }[];
  hint?: string;
  /** Rendered upper-case, for code fields. */
  uppercase?: boolean;
  step?: string;
  min?: string;
};

export function ActionForm({
  action,
  fields,
  submitLabel,
  successMessage,
  className = "",
  hiddenValues,
  dirtyGuard = false,
  resetOnSuccess = true,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  fields: ActionFormField[];
  submitLabel: string;
  /** Falls back to whatever the action reports. */
  successMessage?: string;
  className?: string;
  hiddenValues?: Record<string, string>;
  /**
   * Disable submit until something changes. For a form that opens with
   * existing values — saving them unchanged is a no-op that still costs a
   * round trip and a revalidation.
   */
  dirtyGuard?: boolean;
  /** Clear the fields after a successful save. Off for edit forms. */
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, undefined);
  const { formRef, fieldProps, errorProps } = useFormFeedback({ state });
  const { formRef: dirtyRef, dirty, markClean } = useFormDirty();
  const { toast } = useToast();
  const domRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast(successMessage ?? state.message ?? "Saved.");
      if (resetOnSuccess) {
        // A create form is reusable: clearing it is what lets an admin add
        // three departments without reloading the page.
        domRef.current?.reset();
      }
      // Whatever is on screen now is the saved state, so Save goes quiet
      // again until the next edit.
      markClean();
    } else if (state.message) {
      toast(state.message, "error");
    }
  }, [state, toast, successMessage, resetOnSuccess, markClean]);

  return (
    <form
      ref={(node) => {
        formRef.current = node;
        dirtyRef.current = node;
        domRef.current = node;
      }}
      action={formAction}
      noValidate
      className={`flex flex-col gap-4 ${className}`}
    >
      {hiddenValues &&
        Object.entries(hiddenValues).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}

      {fields.map((field) => {
        const error = errorProps(field.name);
        const props = fieldProps(field.name);

        return (
          <div key={field.name} className="flex flex-col gap-1.5">
            {field.type !== "checkbox" && (
              <label htmlFor={field.name} className="text-xs font-semibold text-foreground">
                {field.label}{" "}
                {field.required ? (
                  <span className="text-rose-500">*</span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">(Optional)</span>
                )}
              </label>
            )}

            {field.type === "select" ? (
              <FormSelect
                id={field.name}
                {...props}
                required={field.required}
                placeholder={field.placeholder ?? `Select ${field.label.toLowerCase()}`}
                defaultValue={String(field.defaultValue ?? "")}
                options={field.options ?? []}
                error={Boolean(error.message)}
              />
            ) : field.type === "checkbox" ? (
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-foreground">
                <input
                  type="checkbox"
                  id={field.name}
                  {...props}
                  className="size-4 rounded border-border"
                />
                <span>{field.label}</span>
              </label>
            ) : (
              <input
                id={field.name}
                type={field.type ?? "text"}
                {...props}
                required={field.required}
                placeholder={field.placeholder}
                defaultValue={field.defaultValue}
                step={field.step}
                min={field.min}
                className={`w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs shadow-xs transition-colors hover:border-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 dark:hover:border-slate-600 sm:text-sm aria-[invalid]:border-rose-500 ${
                  field.uppercase ? "uppercase" : ""
                }`}
              />
            )}

            <FieldError {...error} />
            {field.hint && !error.message && (
              <span className="text-[11px] text-muted-foreground">{field.hint}</span>
            )}
          </div>
        );
      })}

      <PendingButton
        disabled={dirtyGuard && !dirty}
        className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 transition-colors hover:bg-indigo-500 sm:text-sm"
      >
        <Plus className="size-4" />
        <span>{submitLabel}</span>
      </PendingButton>
    </form>
  );
}
