"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, User, CalendarDays, Sparkles, Scale, Printer } from "lucide-react";

import type { TabDef, TabIconName } from "@/lib/ui/tabs";

export type { TabDef };

/** Names cross the server/client boundary; the components live here. */
const TAB_ICONS: Record<TabIconName, React.ElementType> = {
  user: User,
  calendar: CalendarDays,
  sparkles: Sparkles,
  scale: Scale,
  printer: Printer,
};

/**
 * URL-driven tabs.
 *
 * The tab lives in the query string rather than component state, so a tab is
 * linkable, survives a refresh, and back/forward move between tabs the way
 * people expect. It also lets other pages deep-link into one — the holidays
 * nav entry points at ?tab=holidays now that /holidays/mine has moved here.
 *
 * This is the only client boundary in the settings page; the panels stay
 * server components, rendered as children and simply hidden when inactive.
 */
export function Tabs({
  tabs,
  paramName = "tab",
  activeId,
}: {
  tabs: TabDef[];
  paramName?: string;
  /** Resolved on the server, so the first paint already has the right tab. */
  activeId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [pendingTabId, setPendingTabId] = useState<string | null>(null);

  const select = (id: string) => {
    if (id === activeId) return;
    setPendingTabId(id);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set(paramName, id);
    startTransition(() => {
      // scroll: false — switching a tab should not jump the page to the top.
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div
      role="tablist"
      aria-label="Settings sections"
      className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border bg-card p-1.5 shadow-xs"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        const isTargetPending = isPending && pendingTabId === tab.id;
        const Icon = tab.icon ? TAB_ICONS[tab.icon] : undefined;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={isPending}
            onClick={() => select(tab.id)}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all sm:flex-none sm:px-4 ${
              isActive
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                : isTargetPending
                ? "border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {isTargetPending ? (
              <Loader2 className="size-4 animate-spin shrink-0" />
            ) : (
              Icon && <Icon className="size-4 shrink-0" />
            )}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
