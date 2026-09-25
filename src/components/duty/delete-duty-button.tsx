"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteDuty } from "@/actions/duty";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { useToast } from "@/components/ui/toast";

export function DeleteDutyButton({
  id,
  label = "Delete",
  iconOnly = false,
  size = "sm",
  className = "",
  redirectTo,
}: {
  id: string;
  label?: string;
  iconOnly?: boolean;
  size?: "sm" | "md";
  className?: string;
  /**
   * Where to go afterwards. Set only on a page that shows THIS duty — refreshing
   * it after the row is gone would render a not-found page instead.
   */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  // `isPending` only disables the button after a re-render, so a fast
  // double-click could send the same delete twice; the second then failed
  // with "That record no longer exists."
  const inFlight = useRef(false);

  const handleConfirm = () => {
    if (inFlight.current) return;
    inFlight.current = true;

    startTransition(async () => {
      try {
        await deleteDuty(id);
        setIsOpen(false);
        toast("Duty deleted.");
        if (redirectTo) router.replace(redirectTo);
        else router.refresh();
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
      } finally {
        inFlight.current = false;
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
        title="Delete Duty Entry"
      >
        <Trash2 className="size-3.5" />
        {!iconOnly && <span>{label}</span>}
      </button>

      <ConfirmDeleteModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleConfirm}
        title="Delete Duty Shift Record"
        description="Are you sure you want to delete this shift entry? Travelling allowance claims attached to this shift will also be removed."
        confirmLabel="Delete Shift"
        isPending={isPending}
      />
    </>
  );
}
