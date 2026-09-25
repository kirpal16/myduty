"use client";

import { useState, useTransition } from "react";
import { Loader2, Check, X, ShieldCheck } from "lucide-react";
import { toggleStorageAccess } from "@/actions/users";
import { AutoDismissBanner } from "@/components/ui/auto-dismiss-banner";
import { useToast } from "@/components/ui/toast";

export function StoragePermissionToggle({
  userId,
  officerName,
  initialEnabled,
}: {
  userId: string;
  officerName: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleToggle = () => {
    const nextState = !enabled;
    setError(null);
    setEnabled(nextState);
    startTransition(async () => {
      try {
        await toggleStorageAccess(userId, nextState);
        // The failure case already rolls back and explains itself inline;
        // success was the silent half.
        toast(nextState ? "Storage access granted." : "Storage access revoked.");
      } catch (err: unknown) {
        // Rollback on error. Shown inline rather than through window.alert(),
        // which blocked the page and could not be styled.
        setEnabled(!nextState);
        setError((err as Error).message || "Failed to update storage permission.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <AutoDismissBanner
        message={error}
        tone="error"
        onDismiss={() => setError(null)}
      />
    <div className="flex items-center gap-3">
      {/* Visual Status Indicator */}
      <div className="hidden sm:flex items-center gap-1.5">
        {enabled ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
            <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
            <span>Files Allowed</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground border border-border">
            <X className="size-3 text-muted-foreground" />
            <span>Files Hidden</span>
          </span>
        )}
      </div>

      {/* Modern iOS-Style Toggle Switch */}
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={isPending}
        onClick={handleToggle}
        title={`${enabled ? "Revoke" : "Grant"} Storage Access for ${officerName}`}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-50 ${
          enabled
            ? "bg-gradient-to-r from-emerald-500 to-indigo-600 shadow-xs shadow-emerald-500/30"
            : "bg-slate-300 dark:bg-slate-700"
        }`}
      >
        <span
          className={`pointer-events-none inline-block size-4.5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out flex items-center justify-center ${
            enabled ? "translate-x-5.5 text-emerald-600" : "translate-x-0.5 text-slate-400"
          }`}
        >
          {isPending ? (
            <Loader2 className="size-3 animate-spin text-slate-600" />
          ) : enabled ? (
            <Check className="size-2.5 stroke-[3]" />
          ) : (
            <X className="size-2.5 stroke-[3]" />
          )}
        </span>
      </button>
    </div>
    </div>
  );
}
