"use client";

import { useActionState, useEffect, useState } from "react";
import { X, Pencil, Loader2, Calendar, Sparkles } from "lucide-react";
import { ModalPortal, MODAL_Z } from "@/components/ui/modal-portal";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import { updateOfficialHoliday } from "@/actions/holiday";
import type { FormState } from "@/lib/forms/formState";
import { useToast } from "@/components/ui/toast";
import type { HolidayScope } from "@/types/database";

export interface EditHolidayModalProps {
  isOpen: boolean;
  onClose: () => void;
  holiday: {
    id: string;
    name: string;
    holiday_date: string;
    scope: HolidayScope;
    profile_id?: string | null;
    is_government?: boolean | null;
    is_optional?: boolean | null;
    is_recurring_yearly?: boolean | null;
  } | null;
  profiles?: { id: string; name: string }[];
}

export function EditHolidayModal({
  isOpen,
  onClose,
  holiday,
  profiles = [],
}: EditHolidayModalProps) {
  useBodyScrollLock(isOpen);
  const { toast } = useToast();

  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    updateOfficialHoliday,
    undefined,
  );

  const [scope, setScope] = useState<HolidayScope>(
    holiday?.scope ?? "GLOBAL",
  );
  const [isOptional, setIsOptional] = useState<boolean>(
    holiday?.is_optional ?? false,
  );

  useEffect(() => {
    if (holiday) {
      setScope(holiday.scope);
      setIsOptional(Boolean(holiday.is_optional));
    }
  }, [holiday]);

  useEffect(() => {
    if (state?.ok) {
      toast(state.message ?? "Holiday updated.");
      onClose();
    } else if (state?.message) {
      toast(state.message, "error");
    }
  }, [state, toast, onClose]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isPending) onClose();
    }
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPending, onClose]);

  if (!isOpen || !holiday) return null;

  return (
    <ModalPortal>
      <div
        onClick={() => {
          if (!isPending) onClose();
        }}
        className={`fixed inset-0 ${MODAL_Z} flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in-0 duration-150`}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg rounded-3xl bg-card border border-border shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold shrink-0">
                <Pencil className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Edit Holiday
                </h3>
                <p className="text-xs text-muted-foreground">
                  Modify details for this official or departmental date.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </div>

          {state?.message && !state.ok && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
              {state.message}
            </div>
          )}

          {/* Form */}
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="id" value={holiday.id} />

            {/* Holiday Name */}
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-xs font-semibold text-foreground">
                Holiday Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                defaultValue={holiday.name}
                required
                className="w-full h-9 rounded-xl border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-amber-500/30"
              />
            </div>

            {/* Holiday Date */}
            <div className="space-y-1.5">
              <label htmlFor="holidayDate" className="text-xs font-semibold text-foreground">
                Date <span className="text-rose-500">*</span>
              </label>
              <input
                id="holidayDate"
                name="holidayDate"
                type="date"
                defaultValue={holiday.holiday_date}
                required
                className="w-full h-9 rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-amber-500/30"
              />
            </div>

            {/* Category / Holiday Type Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Holiday Category
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsOptional(false)}
                  className={`flex flex-col items-start gap-1 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    !isOptional
                      ? "border-amber-500 bg-amber-500/10 text-foreground ring-2 ring-amber-500/20 font-semibold"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <span className="text-xs font-bold text-foreground">Gazetted Public Holiday</span>
                  <span className="text-[10px] text-muted-foreground">Offices closed (જાહેર રજા)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsOptional(true)}
                  className={`flex flex-col items-start gap-1 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    isOptional
                      ? "border-purple-500 bg-purple-500/10 text-foreground ring-2 ring-purple-500/20 font-semibold"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <span className="text-xs font-bold text-foreground">Optional Holiday</span>
                  <span className="text-[10px] text-muted-foreground">Max 2/yr choice (મરજિયાત રજા)</span>
                </button>
              </div>
              <input type="hidden" name="isOptional" value={isOptional ? "true" : "false"} />
            </div>

            {/* Scope (Everyone vs One Profile) */}
            <div className="space-y-1.5">
              <label htmlFor="scope" className="text-xs font-semibold text-foreground">
                Applies To
              </label>
              <select
                id="scope"
                name="scope"
                value={scope}
                onChange={(e) => setScope(e.target.value as "GLOBAL" | "PROFILE")}
                className="w-full h-9 rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 cursor-pointer"
              >
                <option value="GLOBAL">Everyone (Global)</option>
                <option value="PROFILE">Specific Profile Only</option>
              </select>
            </div>

            {/* Profile Dropdown (if PROFILE scope) */}
            {scope === "PROFILE" && (
              <div className="space-y-1.5 animate-in fade-in-0 duration-150">
                <label htmlFor="profileId" className="text-xs font-semibold text-foreground">
                  Department / Officer Profile <span className="text-rose-500">*</span>
                </label>
                <select
                  id="profileId"
                  name="profileId"
                  defaultValue={holiday.profile_id ?? ""}
                  required
                  className="w-full h-9 rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 cursor-pointer"
                >
                  <option value="">Select profile</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Flags */}
            <div className="space-y-2 pt-2 border-t border-border/70">
              <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  name="isGovernment"
                  defaultChecked={holiday.is_government ?? true}
                  className="size-4 rounded-md border-border text-amber-600 focus:ring-amber-500/30 cursor-pointer"
                />
                <span>Government declared holiday (સરકારી માન્ય)</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  name="isRecurringYearly"
                  defaultChecked={holiday.is_recurring_yearly ?? false}
                  className="size-4 rounded-md border-border text-amber-600 focus:ring-amber-500/30 cursor-pointer"
                />
                <span>Recurs yearly on the same date</span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="px-4 py-2 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-amber-600/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
