"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  Pencil,
  Plus,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  EyeOff,
  Loader2,
} from "lucide-react";
import { ColorPicker } from "@/components/ui/color-picker";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { ColorDot } from "@/components/ui/color-dot";
import { FieldError } from "@/components/ui/field-error";
import { useToast } from "@/components/ui/toast";
import { useFormFeedback } from "@/lib/hooks/useFormFeedback";
import type { FormState } from "@/lib/forms/formState";

export type ManagedLeaveType = {
  id: string;
  name: string;
  code: string;
  color: string;
  is_active: boolean;
  /** null = an admin/global type; set = the officer's own. */
  user_id: string | null;
  /** True when the officer has disabled this leave type for their own account */
  is_disabled_for_user?: boolean;
  /** HL / OH / SPL: the leave rules depend on them, so no edit or delete. */
  is_system?: boolean | null;
};

/**
 * Create / edit / delete for leave types, shared by the admin screen (which
 * manages the global set) and the officer's settings (which manages only
 * their own).
 *
 * Global types are shown to officers read-only for editing/deleting: they are
 * the department's, not theirs. However, officers can enable or disable them
 * for their own account.
 */
export function LeaveTypeManager({
  types,
  editable,
  onCreate,
  onUpdate,
  onDelete,
  onToggleDisabled,
  title,
  emptyHint,
}: {
  types: ManagedLeaveType[];
  /** false renders the list read-only for edit/delete, with no creation form. */
  editable: boolean;
  onCreate: (state: FormState, formData: FormData) => Promise<FormState>;
  onUpdate: (state: FormState, formData: FormData) => Promise<FormState>;
  /** Resolves with `{ error }` when the type cannot be deleted. */
  onDelete: (id: string) => Promise<{ error?: string } | void | undefined>;
  onToggleDisabled?: (id: string, currentlyDisabled: boolean) => Promise<void>;
  title: string;
  emptyHint: string;
}) {
  const [editing, setEditing] = useState<ManagedLeaveType | null>(null);
  const [deleting, setDeleting] = useState<ManagedLeaveType | null>(null);
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timer);
  }, [error]);

  const [isPending, startTransition] = useTransition();

  const [state, formAction] = useActionState<FormState, FormData>(
    editing ? onUpdate : onCreate,
    undefined,
  );
  const { formRef, fieldProps, errorProps } = useFormFeedback({ state });
  const { toast } = useToast();

  // Leaving edit mode is a state reset driven by a new action result, so it
  // is adjusted during render rather than in an effect -- the same pattern
  // useFormFeedback uses, and what `react-hooks/set-state-in-effect` wants.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setEditing(null);
  }

  // The toast is a genuine external side effect, so it stays in an effect.
  useEffect(() => {
    if (!state) return;
    if (state.ok) toast(state.message ?? "Saved.");
    else if (state.message) toast(state.message, "error");
  }, [state, toast]);

  async function handleDelete() {
    if (!deleting) return;
    setError(null);
    try {
      const result = await onDelete(deleting.id);
      setDeleting(null);
      // The reason comes back as a value, not a throw: a thrown Server
      // Action message is replaced by a generic one in production.
      if (result && result.error) {
        setError(result.error);
        toast(result.error, "error");
      } else {
        toast("Leave type deleted.");
      }
    } catch (err) {
      // A type that has been used cannot be deleted without orphaning its
      // logs; the action says so and that reason belongs in front of the user.
      setError((err as Error).message);
      setDeleting(null);
    }
  }

  async function handleToggleDisabled(id: string, currentlyDisabled: boolean) {
    if (!onToggleDisabled) return;
    setError(null);
    setPendingToggleId(id);
    try {
      await onToggleDisabled(id, currentlyDisabled);
      toast(currentlyDisabled ? "Leave type enabled." : "Leave type disabled.");
    } catch (err) {
      setError((err as Error).message);
      toast((err as Error).message, "error");
    } finally {
      setPendingToggleId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-600 dark:text-rose-400">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        <span className="text-[11px] text-muted-foreground">{types.length}</span>
      </div>

      {types.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          {emptyHint}
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {types.map((t) => {
            const isDisabled = Boolean(t.is_disabled_for_user || !t.is_active);
            return (
              <li key={t.id} className="flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-muted/20 transition-colors">
                <div className="shrink-0 flex items-center justify-center">
                  <ColorDot color={t.color} label={t.name} size="md" />
                </div>
                
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-xs sm:text-sm font-bold leading-tight break-words ${
                      isDisabled
                        ? "text-muted-foreground line-through decoration-muted-foreground/40"
                        : "text-foreground"
                    }`}
                  >
                    {t.name}
                  </p>

                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    <span className="font-mono text-[11px] font-semibold text-muted-foreground uppercase">
                      {t.code}
                    </span>

                    <span className="text-[10px] text-muted-foreground/40">•</span>

                    {isDisabled ? (
                      <span className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.2 text-[9.5px] font-bold text-amber-600 dark:text-amber-400">
                        Disabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.2 text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400">
                        Active
                      </span>
                    )}

                    {t.is_system && (
                      <span
                        className="inline-flex items-center rounded-md border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.2 text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400"
                        title="Built-in type used by the leave rules. Its code is fixed; name and colour can be changed."
                      >
                        System
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
                  {onToggleDisabled && (
                    <button
                      type="button"
                      disabled={pendingToggleId === t.id}
                      onClick={() => handleToggleDisabled(t.id, isDisabled)}
                      aria-label={isDisabled ? `Enable ${t.name}` : `Disable ${t.name}`}
                      className={`inline-flex items-center gap-1 rounded-xl border px-2 sm:px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                        isDisabled
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {pendingToggleId === t.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : isDisabled ? (
                        <>
                          <CheckCircle2 className="size-3" />
                          <span>Enable</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="size-3" />
                          <span>Disable</span>
                        </>
                      )}
                    </button>
                  )}

                  {editable && (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditing(t)}
                        aria-label={`Edit ${t.name}`}
                        className="cursor-pointer rounded-xl border border-border bg-card p-1.5 sm:p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-indigo-600 dark:hover:text-indigo-400 shadow-2xs"
                        title="Edit leave type"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(t)}
                        aria-label={`Delete ${t.name}`}
                        className="cursor-pointer rounded-xl border border-rose-500/20 bg-rose-500/10 p-1.5 sm:p-2 text-rose-600 transition-colors hover:bg-rose-500/20 dark:text-rose-400 shadow-2xs"
                        title="Delete leave type"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editable && (
        <form
          // Keyed on the row being edited so the inputs re-seed when you switch
          // from one type to another, or back to the create form.
          key={editing?.id ?? "new"}
          ref={formRef}
          action={formAction}
          className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-foreground">
              {editing ? `Edit “${editing.name}”` : "Add a leave type"}
            </p>
            {editing && (
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
                Cancel
              </button>
            )}
          </div>

          {editing && <input type="hidden" name="id" value={editing.id} />}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-foreground">Name</span>
              <input
                required
                {...fieldProps("name")}
                defaultValue={editing?.name ?? ""}
                placeholder="e.g. Study Leave"
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 aria-[invalid]:border-rose-500"
              />
              <FieldError {...errorProps("name")} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-foreground">
                Code <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <input
                name="code"
                defaultValue={editing?.code ?? ""}
                // The leave rules find HL / OH / SPL by code, so it is fixed.
                readOnly={Boolean(editing?.is_system)}
                title={editing?.is_system ? "System type: the code is fixed" : undefined}
                placeholder="Derived from the name if left blank"
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 read-only:cursor-not-allowed read-only:bg-muted read-only:text-muted-foreground"
              />
            </label>
          </div>

          <ColorPicker defaultValue={editing?.color} />

          <div className="flex justify-end">
            <SubmitButton
              icon={editing ? Pencil : Plus}
              loadingText={editing ? "Saving…" : "Adding…"}
              disabled={isPending}
            >
              {editing ? "Save changes" : "Add leave type"}
            </SubmitButton>
          </div>
        </form>
      )}

      <ConfirmDeleteModal
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete leave type"
        description={
          deleting?.is_system
            ? `“${deleting.name}” is a SYSTEM leave type. Deleting it switches off the leave rules built on it (${deleting.code}) until it is recreated. If any leave uses it you will be asked to deactivate it instead.`
            : `Delete “${deleting?.name ?? ""}”? If any leave has been logged against it you will be asked to deactivate it instead.`
        }
        confirmLabel="Delete"
        isPending={isPending}
      />
    </div>
  );
}
