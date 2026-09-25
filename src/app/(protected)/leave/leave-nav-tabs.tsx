"use client";

import { useTransition, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ShieldCheck, Loader2, Calendar } from "lucide-react";

export function LeaveNavTabs({
  activeTab,
  selectedYear,
  pendingSplCount,
}: {
  activeTab: "records" | "special";
  selectedYear: number;
  pendingSplCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [pendingTab, setPendingTab] = useState<string | null>(null);

  const handleTabClick = (targetTab: "records" | "special") => {
    if (targetTab === activeTab) return;
    setPendingTab(targetTab);

    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("year", String(selectedYear));
    if (targetTab === "special") {
      params.set("tab", "special");
    } else {
      params.delete("tab");
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div
      role="tablist"
      aria-label="Leave sections"
      className="flex items-center gap-1 rounded-xl border border-border/70 bg-muted/40 p-0.5 flex-nowrap overflow-x-auto no-scrollbar"
    >
      {/* Tab 1: Leave Records & Log */}
      <button
        type="button"
        role="tab"
        aria-selected={activeTab !== "special"}
        disabled={isPending}
        onClick={() => handleTabClick("records")}
        className={`flex-1 sm:flex-none justify-center px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg transition-all whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer ${
          activeTab !== "special"
            ? "bg-indigo-600 text-white shadow-sm"
            : isPending && pendingTab === "records"
            ? "border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
            : "text-muted-foreground hover:text-foreground hover:bg-background/70"
        }`}
      >
        {isPending && pendingTab === "records" ? (
          <Loader2 className="size-3.5 animate-spin shrink-0" />
        ) : (
          <Calendar className="size-3.5 shrink-0 text-current" />
        )}
        <span className="sm:hidden">Records</span>
        <span className="hidden sm:inline">Leave Records &amp; Log</span>
      </button>

      {/* Tab 2: Special Leave Approvals */}
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "special"}
        disabled={isPending}
        onClick={() => handleTabClick("special")}
        className={`flex-1 sm:flex-none justify-center px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg transition-all whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer ${
          activeTab === "special"
            ? "bg-indigo-600 text-white shadow-sm"
            : isPending && pendingTab === "special"
            ? "border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
            : "text-muted-foreground hover:text-foreground hover:bg-background/70"
        }`}
      >
        {isPending && pendingTab === "special" ? (
          <Loader2 className="size-3.5 animate-spin shrink-0" />
        ) : (
          <ShieldCheck
            className={`size-3.5 shrink-0 ${
              activeTab === "special" ? "text-current" : "text-emerald-400"
            }`}
          />
        )}
        <span className="sm:hidden">Approvals</span>
        <span className="hidden sm:inline">Leave Approvals &amp; Sanctions</span>
        {pendingSplCount > 0 && (
          <span
            className={`inline-flex items-center justify-center rounded-full text-[10px] font-bold leading-none shrink-0 min-w-4 px-1.5 py-0.5 ${
              activeTab === "special"
                ? "bg-white/25 text-white"
                : "bg-amber-500 text-white"
            }`}
            aria-label={`${pendingSplCount} pending`}
          >
            {pendingSplCount}
            <span className="hidden sm:inline">&nbsp;pending</span>
          </span>
        )}
      </button>
    </div>
  );
}
