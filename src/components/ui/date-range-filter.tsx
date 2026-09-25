"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useRef, useEffect, useTransition } from "react";
import { Calendar as CalendarIcon, X, Check, ArrowRight, Loader2 } from "lucide-react";

export function DateRangeFilter({
  fromParamName = "from",
  toParamName = "to",
  label = "Date Range",
  className = "",
}: {
  fromParamName?: string;
  toParamName?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The flag was discarded, so changing a filter showed nothing while the
  // server re-rendered the page behind it.
  const [isPending, startTransition] = useTransition();

  const currentFrom = searchParams?.get(fromParamName) || "";
  const currentTo = searchParams?.get(toParamName) || "";

  const [isOpen, setIsOpen] = useState(false);
  const [fromDate, setFromDate] = useState(currentFrom);
  const [toDate, setToDate] = useState(currentTo);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFromDate(currentFrom);
    setToDate(currentTo);
  }, [currentFrom, currentTo]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleApply = (newFrom = fromDate, newTo = toDate) => {
    setIsOpen(false);
    startTransition(() => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (newFrom) {
        params.set(fromParamName, newFrom);
      } else {
        params.delete(fromParamName);
      }

      if (newTo) {
        params.set(toParamName, newTo);
      } else {
        params.delete(toParamName);
      }

      params.set("page", "1");
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFromDate("");
    setToDate("");
    handleApply("", "");
  };

  const handlePreset = (preset: "today" | "this_week" | "this_month" | "this_year") => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const format = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    let start = new Date();
    let end = new Date();

    if (preset === "today") {
      start = now;
      end = now;
    } else if (preset === "this_week") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(now.setDate(diff));
      end = new Date(start);
      end.setDate(start.getDate() + 6);
    } else if (preset === "this_month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (preset === "this_year") {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
    }

    const fromStr = format(start);
    const toStr = format(end);
    setFromDate(fromStr);
    setToDate(toStr);
    handleApply(fromStr, toStr);
  };

  const hasActiveFilter = Boolean(currentFrom || currentTo);

  const getDisplayText = () => {
    if (currentFrom && currentTo) {
      if (currentFrom === currentTo) return currentFrom;
      return `${currentFrom} → ${currentTo}`;
    }
    if (currentFrom) return `From ${currentFrom}`;
    if (currentTo) return `Until ${currentTo}`;
    return label;
  };

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      {/* Filter Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className={`w-full h-9 flex items-center justify-between gap-2 rounded-xl border px-2.5 sm:px-3 text-xs font-medium transition-all shadow-2xs cursor-pointer ${
          isOpen
            ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-card text-foreground"
            : hasActiveFilter
            ? "border-indigo-500/80 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold"
            : "border-border bg-card text-muted-foreground hover:border-slate-400 dark:hover:border-slate-600 hover:text-foreground"
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          {/* The icon becomes the spinner while the filtered page loads. */}
          {isPending ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin text-indigo-500" />
          ) : (
            <CalendarIcon
              className={`size-3.5 shrink-0 ${
                hasActiveFilter
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-muted-foreground"
              }`}
            />
          )}
          <span className="truncate">{getDisplayText()}</span>
        </div>

        <div className="flex items-center gap-1">
          {hasActiveFilter && (
            <span
              onClick={handleClear}
              className="p-0.5 rounded-full hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 transition-colors"
              title="Clear date filter"
            >
              <X className="size-3" />
            </span>
          )}
        </div>
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-0 top-full z-50 mt-1.5 w-72 sm:w-80 rounded-2xl border border-border bg-card/95 backdrop-blur-md p-4 shadow-xl shadow-black/10 dark:shadow-black/40 animate-in fade-in-0 zoom-in-95 duration-150">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/70 pb-2.5">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <CalendarIcon className="size-3.5 text-indigo-500" />
                <span>Filter by Date Range</span>
              </span>
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-[11px] font-semibold text-rose-500 hover:underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => handlePreset("today")}
                className="px-2.5 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted text-[11px] font-medium text-foreground transition-colors cursor-pointer text-center"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handlePreset("this_week")}
                className="px-2.5 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted text-[11px] font-medium text-foreground transition-colors cursor-pointer text-center"
              >
                This Week
              </button>
              <button
                type="button"
                onClick={() => handlePreset("this_month")}
                className="px-2.5 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted text-[11px] font-medium text-foreground transition-colors cursor-pointer text-center"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => handlePreset("this_year")}
                className="px-2.5 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted text-[11px] font-medium text-foreground transition-colors cursor-pointer text-center"
              >
                This Year
              </button>
            </div>

            {/* Date Inputs */}
            <div className="space-y-2 pt-1">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  From Date
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-muted/30 px-3 py-1.5 text-xs text-foreground focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  To Date
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-muted/30 px-3 py-1.5 text-xs text-foreground focus:border-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/70">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleApply()}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold shadow-xs hover:bg-indigo-500 transition-colors cursor-pointer"
              >
                <Check className="size-3.5" />
                <span>Apply Filter</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
