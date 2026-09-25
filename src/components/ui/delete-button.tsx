"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { ConfirmDeleteModal } from "./confirm-delete-modal";

export interface DeleteButtonProps {
  onDelete: () => Promise<void> | void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  label?: string;
  iconOnly?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function DeleteButton({
  onDelete,
  title = "Confirm Deletion",
  description = "Are you sure you want to delete this record? This action cannot be undone.",
  confirmLabel = "Delete Record",
  label = "Delete",
  iconOnly = false,
  size = "sm",
  className = "",
}: DeleteButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = async () => {
    startTransition(async () => {
      await onDelete();
      setIsOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        disabled={isPending}
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer ${
          iconOnly
            ? "p-1.5"
            : size === "sm"
            ? "px-2.5 py-1 text-xs font-semibold"
            : "px-3.5 py-2 text-xs sm:text-sm font-semibold"
        } ${className}`}
        title={title}
      >
        <Trash2 className="size-3.5" />
        {!iconOnly && <span>{label}</span>}
      </button>

      <ConfirmDeleteModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleConfirm}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        isPending={isPending}
      />
    </>
  );
}
