"use client";

import { useEffect } from "react";
import { AlertTriangle, Trash2, X, Loader2 } from "lucide-react";
import { ModalPortal, MODAL_Z } from "./modal-portal";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
  confirmLabel?: string;
  isPending?: boolean;
}

export function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Deletion",
  description = "Are you sure you want to delete this record? This action cannot be undone.",
  confirmLabel = "Delete Record",
  isPending = false,
}: ConfirmDeleteModalProps) {
  // Reference-counted, so closing this modal while it sits over the open
  // mobile drawer no longer unlocks the page underneath.
  useBodyScrollLock(isOpen);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isPending) onClose();
    }
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPending, onClose]);

  if (!isOpen) return null;

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
        className="relative w-full max-w-md rounded-3xl bg-card border border-border shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150"
      >
        {/* Top Warning Icon Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0">
            <AlertTriangle className="size-6" />
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

        {/* Title and Description */}
        <div className="space-y-1.5">
          <h3 className="text-base sm:text-lg font-bold text-foreground">
            {title}
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
          <button
            type="button"
            disabled={isPending}
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold shadow-md shadow-rose-600/30 hover:bg-rose-500 disabled:opacity-50 transition-all cursor-pointer"
          >
            {isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="size-3.5" />
                <span>{confirmLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
