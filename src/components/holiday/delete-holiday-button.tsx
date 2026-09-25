"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteHoliday } from "@/actions/holiday";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { useToast } from "@/components/ui/toast";

export function DeleteHolidayButton({
  id,
  redirectPath = "/calendar",
  label = "Remove",
  iconOnly = false,
  size = "sm",
  className = "",
}: {
  id: string;
  redirectPath?: string;
  label?: string;
  iconOnly?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleConfirm = () => {
    startTransition(async () => {
      try {
        await deleteHoliday(id, redirectPath);
        setIsOpen(false);
        router.refresh();
        toast("Holiday deleted.");
      } catch (error) {
        // Without this a failed delete threw straight through to the error
        // boundary, replacing the page the officer was working on. The dialog
        // stays open so they can retry or cancel.
        toast(
          error instanceof Error && error.message
            ? error.message
            : "That could not be deleted. Please try again.",
          "error",
        );
      }
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
        title="Remove Holiday or Off-Day"
      >
        <Trash2 className="size-3.5" />
        {!iconOnly && <span>{label}</span>}
      </button>

      <ConfirmDeleteModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleConfirm}
        title="Remove Holiday / Off-Day"
        description="Are you sure you want to remove this holiday observance or weekend off from the calendar?"
        confirmLabel="Remove Holiday"
        isPending={isPending}
      />
    </>
  );
}
