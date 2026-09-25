"use client";

import { useState, useTransition, useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  X,
  Loader2,
  Layers,
  AlertTriangle,
} from "lucide-react";
import { ModalPortal, MODAL_Z } from "@/components/ui/modal-portal";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { useToast } from "@/components/ui/toast";
import {
  toggleDutyTypeActive,
  updateDutyType,
  deleteDutyType,
} from "@/actions/duty";
import type { FormState } from "@/lib/forms/formState";
import { translateDutyTypeToGujarati } from "@/lib/reports/gujaratiReportUtils";

export interface DutyTypeData {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  profile_id: string;
}

export interface ProfileOption {
  id: string;
  name: string;
}

export function DutyTypeActions({
  dutyType,
  profiles,
  layout = "row",
}: {
  dutyType: DutyTypeData;
  profiles: ProfileOption[];
  layout?: "row" | "compact";
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, startToggleTransition] = useTransition();
  const deleteInFlight = useRef(false);

  const handleToggleActive = () => {
    startToggleTransition(async () => {
      try {
        await toggleDutyTypeActive(dutyType.id, dutyType.is_active);
        toast(
          dutyType.is_active
            ? `Duty type "${dutyType.name}" deactivated.`
            : `Duty type "${dutyType.name}" activated.`,
          "success",
        );
        router.refresh();
      } catch (error) {
        toast(
          error instanceof Error && error.message
            ? error.message
            : "Failed to update status. Please try again.",
          "error",
        );
      }
    });
  };

  const handleDelete = async () => {
    if (deleteInFlight.current) return;
    deleteInFlight.current = true;
    setIsDeleting(true);

    try {
      const res = await deleteDutyType(dutyType.id);
      if (res.success) {
        setIsDeleteOpen(false);
        toast(res.message ?? "Duty type deleted successfully.", "success");
        router.refresh();
      } else {
        toast(res.error ?? "Failed to delete duty type.", "error", 6000);
      }
    } catch (error) {
      toast(
        error instanceof Error && error.message
          ? error.message
          : "Could not delete duty type. Please try again.",
        "error",
      );
    } finally {
      setIsDeleting(false);
      deleteInFlight.current = false;
    }
  };

  return (
    <>
      <div className={`flex items-center gap-1.5 ${layout === "row" ? "justify-end" : "justify-start flex-wrap"}`}>
        {/* Edit Button */}
        <button
          type="button"
          onClick={() => setIsEditOpen(true)}
          title="Edit duty classification"
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted/80 shadow-2xs transition-colors cursor-pointer"
        >
          <Pencil className="size-3 text-indigo-500" />
          <span>Edit</span>
        </button>

        {/* Toggle Active/Inactive Button */}
        <button
          type="button"
          disabled={isToggling}
          onClick={handleToggleActive}
          title={dutyType.is_active ? "Deactivate duty type" : "Activate duty type"}
          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors shadow-2xs cursor-pointer disabled:opacity-50 ${
            dutyType.is_active
              ? "border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100"
              : "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100"
          }`}
        >
          {isToggling ? (
            <Loader2 className="size-3 animate-spin" />
          ) : dutyType.is_active ? (
            <XCircle className="size-3" />
          ) : (
            <CheckCircle2 className="size-3" />
          )}
          <span>{dutyType.is_active ? "Deactivate" : "Activate"}</span>
        </button>

        {/* Delete Button */}
        <button
          type="button"
          onClick={() => setIsDeleteOpen(true)}
          title="Delete duty classification"
          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-2 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 shadow-2xs transition-colors cursor-pointer"
        >
          <Trash2 className="size-3 text-rose-500" />
          <span>Delete</span>
        </button>
      </div>

      {/* Edit Modal */}
      {isEditOpen && (
        <EditDutyTypeModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          dutyType={dutyType}
          profiles={profiles}
        />
      )}

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={isDeleteOpen}
        onClose={() => {
          if (!isDeleting) setIsDeleteOpen(false);
        }}
        onConfirm={handleDelete}
        isPending={isDeleting}
        title={`Delete "${dutyType.name}"?`}
        description={`Are you sure you want to delete the duty classification "${dutyType.name}" (${dutyType.code})? If this duty type is used in any logged duties, deletion will be safely rejected.`}
        confirmLabel={isDeleting ? "Deleting..." : "Delete Duty Type"}
      />
    </>
  );
}

function EditDutyTypeModal({
  isOpen,
  onClose,
  dutyType,
  profiles,
}: {
  isOpen: boolean;
  onClose: () => void;
  dutyType: DutyTypeData;
  profiles: ProfileOption[];
}) {
  useBodyScrollLock(isOpen);
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState(dutyType.name);
  const [code, setCode] = useState(dutyType.code);
  const [profileId, setProfileId] = useState(dutyType.profile_id);

  const boundUpdate = updateDutyType.bind(null, dutyType.id);
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    boundUpdate,
    undefined,
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isPending) onClose();
    }
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPending, onClose]);

  useEffect(() => {
    if (state?.ok) {
      toast(state.message ?? "Duty type updated.", "success");
      onClose();
      router.refresh();
    } else if (state?.message) {
      toast(state.message, "error");
    }
  }, [state, onClose, toast, router]);

  const gujaratiPreview = translateDutyTypeToGujarati(name);

  return (
    <ModalPortal>
      <div
        onClick={() => {
          if (!isPending) onClose();
        }}
        className={`fixed inset-0 ${MODAL_Z} flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in-0 duration-150`}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg rounded-3xl bg-card border border-border shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                <Pencil className="size-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-foreground">
                  Edit Duty Type
                </h3>
                <p className="text-xs text-muted-foreground">
                  Update classification name, code, and profile scope.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isPending}
              onClick={onClose}
              className="p-1.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Form */}
          <form action={formAction} className="space-y-4">
            {state && !state.ok && state.message && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <span>{state.message}</span>
              </div>
            )}

            {/* Profile Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Associated Profile <span className="text-rose-500">*</span>
              </label>
              <select
                name="profileId"
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                required
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {state && !state.ok && state.errors?.profileId && (
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  {state.errors.profileId[0]}
                </p>
              )}
            </div>

            {/* Name Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Duty Type Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Reserve Duty"
                required
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {gujaratiPreview && gujaratiPreview !== name && (
                <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                  <span>ગુજરાતી ભાષાંતર:</span>
                  <span className="font-bold bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md">
                    {gujaratiPreview}
                  </span>
                </div>
              )}
              {state && !state.ok && state.errors?.name && (
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  {state.errors.name[0]}
                </p>
              )}
            </div>

            {/* Code Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Duty Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="code"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.toUpperCase().replace(/\s+/g, "_"))
                }
                placeholder="e.g. RESERVE_DUTY"
                required
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-mono uppercase text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-muted-foreground">
                Stored uppercase with spaces formatted as underscores.
              </p>
              {state && !state.ok && state.errors?.code && (
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  {state.errors.code[0]}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border">
              <button
                type="button"
                disabled={isPending}
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Update Duty Type</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
