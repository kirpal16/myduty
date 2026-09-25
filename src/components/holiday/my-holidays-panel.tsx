"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  Pencil,
  Plus,
  Trash2,
  X,
  Sparkles,
  CalendarDays,
  ChevronDown,
  Landmark,
  Palmtree,
} from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { AutoDismissBanner } from "@/components/ui/auto-dismiss-banner";
import { formatSafeDateFull } from "@/lib/format/safeDate";
import { FieldError } from "@/components/ui/field-error";
import { useToast } from "@/components/ui/toast";
import { useFormFeedback } from "@/lib/hooks/useFormFeedback";
import type { FormState } from "@/lib/forms/formState";
import {
  holidaySchema,
  updateHolidaySchema,
  holidayValuesFromForm,
  updateHolidayValuesFromForm,
} from "@/lib/validations/holiday";

export type PanelHoliday = {
  id: string;
  name: string;
  holiday_date: string;
  is_government: boolean | null;
  scope: string;
  is_optional?: boolean | null;
};

/**
 * The officer's own holiday calendar, moved here from /holidays/mine.
 *
 * Two things are new. Holidays can now be **edited** — before this there was
 * no update action and no UPDATE policy at all, so a wrong date could only be
 * deleted and retyped. And each row says whether it counts toward Holiday
 * Leave, because that is the question the list actually answers now: the HL
 * allocation is the number of holidays in the year, so adding one here adds a
 * day of entitlement.
 */
export function MyHolidaysPanel({
  holidays,
  onCreate,
  onUpdate,
  onDelete,
  holidayCount,
  year,
}: {
  holidays: PanelHoliday[];
  onCreate: (state: FormState, formData: FormData) => Promise<FormState>;
  onUpdate: (state: FormState, formData: FormData) => Promise<FormState>;
  onDelete: (id: string) => Promise<void>;
  /** The full HL allocation, including Sundays and 2nd/4th Saturdays. */
  holidayCount: number;
  year: number;
}) {
  // Accordions are closed by default across the panel
  const [openSection, setOpenSection] = useState<"official" | "optional" | "personal" | null>(
    null,
  );
  const [editing, setEditing] = useState<PanelHoliday | null>(null);
  const [deleting, setDeleting] = useState<PanelHoliday | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // One action state for the add/edit form. `editing` decides which action
  // runs, and the form's `key` resets the fields when that switches.
  const [state, formAction] = useActionState<FormState, FormData>(
    editing ? onUpdate : onCreate,
    undefined,
  );
  const { formRef, fieldProps, errorProps, formMessage } = useFormFeedback({
    state,
    schema: editing ? updateHolidaySchema : holidaySchema,
    toValues: editing ? updateHolidayValuesFromForm : holidayValuesFromForm,
  });
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

  /**
   * One row per festival, even when several scopes carry it.
   *
   * A GLOBAL gazetted holiday and a personal copy of the same day are two
   * legitimate rows, but showing both just reads as a bug. The global row wins
   * so the delete button acts on the one that matters; the count of distinct
   * days is what Holiday Leave uses anyway.
   */
  const byDay = new Map<string, PanelHoliday>();
  for (const h of holidays) {
    const key = `${h.holiday_date}_${h.name.trim().toLowerCase()}`;
    const seen = byDay.get(key);
    if (!seen || (seen.scope === "USER" && h.scope !== "USER")) {
      byDay.set(key, h);
    }
  }
  const unique = [...byDay.values()];

  const official = unique.filter(
    (h) => !h.is_optional && (h.scope !== "USER" || h.is_government),
  );
  const optional = unique.filter((h) => Boolean(h.is_optional));
  const personal = unique.filter(
    (h) => !h.is_optional && h.scope === "USER" && !h.is_government,
  );

  async function handleDelete() {
    if (!deleting) return;
    setError(null);
    try {
      await onDelete(deleting.id);
      setDeleting(null);
    } catch (err) {
      setError((err as Error).message);
      setDeleting(null);
    }
  }

  const row = (h: PanelHoliday) => (
    <li key={h.id} className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
      <div className="min-w-0 flex-1">
        {/* Gujarati names are long; wrap rather than truncate so the day is
            still identifiable on a 375px screen. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="break-words text-xs font-bold leading-snug text-foreground">
            {h.name}
          </p>
          {h.is_optional ? (
            <span className="inline-flex items-center rounded-md border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-300">
              Optional (મરજિયાત · max 2/yr)
            </span>
          ) : h.is_government ? (
            <span className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
              Gazetted / Public
            </span>
          ) : (
            <span className="inline-flex items-center rounded-md border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">
              Personal Date
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {formatSafeDateFull(new Date(`${h.holiday_date}T12:00:00`))}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setEditing(h)}
          aria-label={`Edit ${h.name}`}
          className="cursor-pointer rounded-xl border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-indigo-500"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setDeleting(h)}
          aria-label={`Delete ${h.name}`}
          className="cursor-pointer rounded-xl border border-rose-500/20 bg-rose-500/10 p-1.5 text-rose-600 transition-colors hover:bg-rose-500/20 dark:text-rose-400"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </li>
  );

  return (
    <div className="space-y-4">
      <AutoDismissBanner
        message={error}
        tone="error"
        autoHideMs={0}
        onDismiss={() => setError(null)}
      />

      {/* Differentiated summary banner for Public Holiday Leave vs Optional Leaves */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 sm:p-3.5">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <div className="text-[11px] text-muted-foreground">
            <p className="text-xs font-bold text-foreground">
              {holidayCount} Public Holidays in {year}
            </p>
            <p className="mt-0.5">
              Sundays, 2nd/4th Saturdays, and gazetted days. Sets your statutory Holiday Leave (HL) allocation.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-3 sm:p-3.5">
          <Palmtree className="mt-0.5 size-4 shrink-0 text-purple-500" />
          <div className="text-[11px] text-muted-foreground">
            <p className="text-xs font-bold text-foreground">
              {optional.length} Declared Optional Holidays (મરજિયાત)
            </p>
            <p className="mt-0.5">
              Choice of <strong>any 2 days</strong> per calendar year. Kept separate from public Holiday Leave.
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
        <Section
          id="official"
          title="Government &amp; official"
          hint="Gazetted festivals and department-wide public days"
          count={official.length}
          icon={Landmark}
          accent="text-amber-500"
          open={openSection === "official"}
          onToggle={() =>
            setOpenSection(openSection === "official" ? null : "official")
          }
        >
          <ul className="max-h-80 divide-y divide-border/60 overflow-y-auto">
            {official.map(row)}
          </ul>
        </Section>

        <Section
          id="optional"
          title="Optional holidays (મરજિયાત)"
          hint="Declared optional holidays (choice of max 2/yr from this list)"
          count={optional.length}
          icon={Palmtree}
          accent="text-purple-500"
          open={openSection === "optional"}
          onToggle={() =>
            setOpenSection(openSection === "optional" ? null : "optional")
          }
        >
          {optional.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              No optional holidays declared for {year}.
            </p>
          ) : (
            <ul className="max-h-80 divide-y divide-border/60 overflow-y-auto">
              {optional.map(row)}
            </ul>
          )}
        </Section>

        <Section
          id="personal"
          title="My own dates"
          hint="Days you added yourself"
          count={personal.length}
          icon={CalendarDays}
          accent="text-indigo-500"
          open={openSection === "personal"}
          onToggle={() =>
            setOpenSection(openSection === "personal" ? null : "personal")
          }
        >
          {personal.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              Nothing added yet. Use the form below for a day off that is not on
              the official list.
            </p>
          ) : (
            <ul className="max-h-80 divide-y divide-border/60 overflow-y-auto">
              {personal.map(row)}
            </ul>
          )}
        </Section>
      </div>

      <form
        key={editing?.id ?? "new"}
        ref={formRef}
        action={formAction}
        noValidate
        className="space-y-3 rounded-2xl border border-border bg-muted/30 p-3 sm:p-4"
      >
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <CalendarDays className="size-3.5 text-indigo-500" />
            {editing ? `Edit “${editing.name}”` : "Add a holiday"}
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

        {state && !state.ok && formMessage && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
            {formMessage}
          </div>
        )}

        {editing && <input type="hidden" name="id" value={editing.id} />}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-foreground">Name</span>
            <input
              {...fieldProps("name")}
              defaultValue={editing?.name ?? ""}
              placeholder="e.g. Founders Day"
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 aria-[invalid]:border-rose-500 aria-[invalid]:ring-1 aria-[invalid]:ring-rose-500/30"
            />
            <FieldError {...errorProps("name")} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-foreground">Date</span>
            <input
              type="date"
              {...fieldProps("holidayDate")}
              defaultValue={editing?.holiday_date ?? ""}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 aria-[invalid]:border-rose-500 aria-[invalid]:ring-1 aria-[invalid]:ring-rose-500/30"
            />
            <FieldError {...errorProps("holidayDate")} />
          </label>
        </div>

        {/* Optional holiday toggle / checkbox */}
        <label className="flex items-start gap-2.5 cursor-pointer rounded-xl border border-border bg-card p-2.5 sm:p-3 transition-colors hover:bg-muted/50">
          <input
            type="checkbox"
            name="isOptional"
            defaultChecked={editing?.is_optional ?? false}
            className="mt-0.5 size-4 rounded border-border text-purple-600 focus:ring-purple-500"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Palmtree className="size-3.5 text-purple-500" />
              Optional Holiday (મરજિયાત રજા)
            </p>
            <p className="text-[11px] text-muted-foreground">
              Mark as optional holiday. Employees can take any 2 per year; does not inflate general Holiday Leave entitlement.
            </p>
          </div>
        </label>

        <div className="flex justify-end">
          <SubmitButton
            icon={editing ? Pencil : Plus}
            loadingText={editing ? "Saving…" : "Adding…"}
            disabled={isPending}
          >
            {editing ? "Save changes" : "Add holiday"}
          </SubmitButton>
        </div>
      </form>

      <ConfirmDeleteModal
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Remove holiday"
        description={
          deleting?.is_optional
            ? `Remove “${deleting?.name ?? ""}”? This removes it from the declared optional holidays list.`
            : `Remove “${deleting?.name ?? ""}”? This also removes a day from your Holiday Leave entitlement.`
        }
        confirmLabel="Remove"
        isPending={isPending}
      />
    </div>
  );
}

/**
 * One collapsible group. The official list can run past eighty rows, which on
 * a phone pushed the add form so far down it looked absent.
 */
function Section({
  title,
  hint,
  count,
  icon: Icon,
  accent,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  hint: string;
  count: number;
  icon: React.ElementType;
  accent: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-3 text-left transition-colors hover:bg-muted sm:px-4"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <Icon className={`size-4 shrink-0 ${accent}`} />
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground">
              {title}
              <span className="ml-1.5 font-semibold text-muted-foreground">
                ({count})
              </span>
            </p>
            <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
          </div>
        </div>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && <div className="border-t border-border/60 bg-muted/20">{children}</div>}
    </div>
  );
}
