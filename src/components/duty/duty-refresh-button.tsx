"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import { useToast } from "@/components/ui/toast";

/**
 * A refresh button for the duty log page.
 * Displays a rotate icon + small "Refresh" text, and spins smoothly when clicked.
 */
export function DutyRefreshButton({
  className = "",
  iconOnly = false,
}: {
  className?: string;
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
      toast("Duty records refreshed.");
    });
  };

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={isPending}
      title="Refresh duty records"
      aria-label="Refresh duty records"
      className={`h-9 inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-all shadow-2xs cursor-pointer select-none disabled:opacity-50 ${
        iconOnly ? "w-9 px-0" : "px-2.5 sm:px-3 text-xs font-semibold"
      } ${className}`}
    >
      <RotateCw
        className={`size-3.5 shrink-0 transition-transform duration-500 ${
          isPending ? "animate-spin text-indigo-600 dark:text-indigo-400" : ""
        }`}
      />
      {!iconOnly && <span>Refresh</span>}
    </button>
  );
}
