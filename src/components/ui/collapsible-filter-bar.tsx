"use client";

import { useState, type ReactNode } from "react";
import { Filter, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";

interface CollapsibleFilterBarProps {
  searchSlot: ReactNode;
  actionsSlot?: ReactNode;
  resetSlot?: ReactNode;
  children: ReactNode;
  activeCount?: number;
  className?: string;
  defaultOpen?: boolean;
}

/**
 * A collapsible filter bar for data listings.
 * Displays the search input and top actions on top.
 * Filters toggle button and reset button sit together in one row.
 * Filter dropdowns and options are hidden until the funnel button is toggled.
 */
export function CollapsibleFilterBar({
  searchSlot,
  actionsSlot,
  resetSlot,
  children,
  activeCount = 0,
  className = "",
  defaultOpen = false,
}: CollapsibleFilterBarProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const renderFilterButton = (key: string) => (
    <button
      key={key}
      type="button"
      onClick={() => setIsOpen((prev) => !prev)}
      aria-expanded={isOpen}
      className={`h-9 inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all shadow-2xs cursor-pointer select-none ${
        isOpen || activeCount > 0
          ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20"
          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Filter
        className={`size-3.5 shrink-0 ${
          isOpen || activeCount > 0
            ? "text-indigo-600 dark:text-indigo-400"
            : "text-muted-foreground"
        }`}
      />
      <span>Filters</span>
      {activeCount > 0 && (
        <span className="flex size-4.5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white dark:bg-indigo-500">
          {activeCount}
        </span>
      )}
      <ChevronDown
        className={`size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${
          isOpen ? "rotate-180" : ""
        }`}
      />
    </button>
  );

  return (
    <Card className={`p-3.5 sm:p-4 space-y-3 ${className}`}>
      {/* Top Tier: Search Bar & Actions (Select / Refresh) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
        <div className="flex-1 min-w-0 sm:max-w-md">
          {searchSlot}
        </div>

        {actionsSlot ? (
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
            {actionsSlot}
          </div>
        ) : (
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
            {renderFilterButton("filter-toggle-top")}
            {resetSlot && <div key="reset-slot-top">{resetSlot}</div>}
          </div>
        )}
      </div>

      {/* When actionsSlot is provided, Filters and Reset sit side-by-side in ONE dedicated row */}
      {actionsSlot && (
        <div className="flex items-center gap-2 flex-wrap">
          {renderFilterButton("filter-toggle-row")}
          {resetSlot && <div key="reset-slot-row">{resetSlot}</div>}
        </div>
      )}

      {/* Collapsible Section for Filter Dropdowns */}
      <div className={isOpen ? "pt-2.5 border-t border-border/50 animate-in fade-in duration-200" : "hidden"}>
        {children}
      </div>
    </Card>
  );
}
