"use client";

import type { ElementType, ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * A header that opens and closes a block of form fields.
 *
 * The children stay MOUNTED while closed — only hidden — so every input
 * inside still posts with the form and can still be focused by the error
 * scroll. Unmounting them would silently drop whatever the officer typed.
 */
export function CollapsibleSection({
  title,
  icon: Icon,
  iconClassName = "text-sky-500",
  summary,
  open,
  onToggle,
  children,
  className = "",
}: {
  title: ReactNode;
  icon?: ElementType;
  /** Icon colour; defaults to the TA sky blue. */
  iconClassName?: string;
  /** Shown on the right of the header, e.g. "₹50 · 24 km" or "Not claimed". */
  summary?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl py-2 text-left"
      >
        <span className="flex min-w-0 items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {Icon && <Icon className={`size-4 shrink-0 ${iconClassName}`} />}
          <span className="truncate">{title}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {summary && (
            <span className="text-[11px] font-semibold text-muted-foreground">{summary}</span>
          )}
          <ChevronDown
            className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      <div className={open ? "mt-2" : "hidden"}>{children}</div>
    </div>
  );
}
