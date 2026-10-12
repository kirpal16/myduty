"use client";

import { useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarOff, ChevronDown } from "lucide-react";

interface RegisteredLeavesAccordionProps {
  currentYear: number;
  totalDaysFormatted: string;
  count: number;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function RegisteredLeavesAccordion({
  currentYear,
  totalDaysFormatted,
  count,
  children,
  defaultOpen = false,
}: RegisteredLeavesAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className="overflow-hidden transition-all duration-200 shadow-2xs">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full cursor-pointer items-center justify-between p-4 sm:p-6 text-left transition-colors hover:bg-muted/40 gap-3"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <CalendarOff className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-foreground">
                My Registered Leave Applications ({currentYear})
              </h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground border border-border/60">
                {count} {count === 1 ? "record" : "records"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate hidden sm:block">
              Review and remove any active leave requests to restore quota balance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Badge variant="secondary" className="text-xs font-semibold">
            Total Leaves: {totalDaysFormatted}
          </Badge>
          <div
            className={`flex size-8 items-center justify-center rounded-lg border border-border/80 bg-muted/50 text-muted-foreground transition-transform duration-200 ${
              isOpen ? "rotate-180 bg-muted text-foreground" : ""
            }`}
          >
            <ChevronDown className="size-4" />
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-border/80 p-4 sm:p-6 animate-in fade-in-50 duration-150">
          {children}
        </div>
      )}
    </Card>
  );
}
