"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteLeaveLog } from "@/actions/leave";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { useToast } from "@/components/ui/toast";

import { useLanguage } from "@/lib/i18n/language-context";

export function DeleteLeaveButton({
  id,
  label,
  iconOnly = false,
  size = "sm",
  className = "",
}: {
  id: string;
  label?: string;
  iconOnly?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const router = useRouter();
  const { dictionary } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  // Guards a double-click on confirm; see DeleteDutyButton.
  const inFlight = useRef(false);

  const displayLabel = label ?? dictionary.common.delete;

  const handleConfirm = () => {
    if (inFlight.current) return;
    inFlight.current = true;

    startTransition(async () => {
      try {
        await deleteLeaveLog(id);
        setIsOpen(false);
        router.refresh();
        toast("Leave entry deleted.");
      } catch (error) {
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
        title={dictionary.leave.deleteLeave}
      >
        <Trash2 className="size-3.5" />
        {!iconOnly && <span>{displayLabel}</span>}
      </button>

      <ConfirmDeleteModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleConfirm}
        title={dictionary.leave.deleteLeave}
        description={dictionary.leave.deleteLeaveConfirm}
        confirmLabel={dictionary.common.delete}
        isPending={isPending}
      />
    </>
  );
}
