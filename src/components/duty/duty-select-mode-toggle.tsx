"use client";

import { CheckSquare } from "lucide-react";
import { useDutySelection } from "./duty-selection-context";

/**
 * Toggle button that activates/deactivates multi-select mode.
 * Shows checkboxes across mobile cards and desktop table when active.
 */
export function DutySelectModeToggle({ className = "" }: { className?: string }) {
  const { selectMode, toggleSelectMode, selected, selectableIds } = useDutySelection();

  if (selectableIds.length === 0) return null;

  return (
    <button
      type="button"
      onClick={toggleSelectMode}
      title={selectMode ? "Exit selection mode" : "Select duties to manage"}
      aria-label={selectMode ? "Exit selection mode" : "Select duties to manage"}
      aria-pressed={selectMode}
      className={`h-9 inline-flex items-center gap-1.5 rounded-xl border px-2.5 sm:px-3 text-xs font-semibold transition-all shadow-2xs cursor-pointer select-none ${
        selectMode
          ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/25"
          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
      } ${className}`}
    >
      <CheckSquare
        className={`size-3.5 shrink-0 ${
          selectMode ? "text-indigo-600 dark:text-indigo-400" : ""
        }`}
      />
      <span>{selectMode ? "Done" : "Select"}</span>
      {selectMode && selected.size > 0 && (
        <span className="flex size-4.5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white dark:bg-indigo-500">
          {selected.size}
        </span>
      )}
    </button>
  );
}
