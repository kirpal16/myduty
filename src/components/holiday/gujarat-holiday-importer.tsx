"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  CheckCircle2,
  Loader2,
  Calendar,
  ShieldCheck,
  DownloadCloud,
  ChevronDown,
  Check,
} from "lucide-react";
import {
  importGujaratGovernmentHolidays,
  importGujaratOptionalHolidays,
} from "@/actions/holiday";
import {
  getGazettedHolidays,
  getOptionalHolidays,
  gazettedCatalogYears,
  optionalCatalogYears,
} from "@/lib/holidays/weekendRules";
import { AutoDismissBanner } from "@/components/ui/auto-dismiss-banner";
import { getCurrentYear } from "@/lib/format/year";

export function GujaratHolidayImporter({
  currentYear = getCurrentYear(),
  scope = "GLOBAL",
}: {
  currentYear?: number;
  scope?: "GLOBAL" | "USER";
}) {
  const router = useRouter();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [category, setCategory] = useState<"gazetted" | "optional">("gazetted");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isYearOpen, setIsYearOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [banner, setBanner] = useState<{
    message: string;
    tone: "success" | "error" | "info";
  } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const availableYears = category === "gazetted" ? gazettedCatalogYears() : optionalCatalogYears();
  const hasCatalog = availableYears.includes(selectedYear);
  const holidays = category === "gazetted"
    ? getGazettedHolidays(selectedYear)
    : getOptionalHolidays(selectedYear);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsYearOpen(false);
      }
    }
    if (isYearOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isYearOpen]);

  const handleImport = () => {
    setBanner(null);
    startTransition(async () => {
      try {
        const importFn = category === "gazetted"
          ? importGujaratGovernmentHolidays
          : importGujaratOptionalHolidays;
        const typeLabel = category === "gazetted" ? "Gazetted" : "Optional";

        const { count, alreadyPresent } = await importFn(selectedYear, scope);
        setBanner({
          tone: count > 0 ? "success" : "info",
          message:
            count > 0
              ? `Added ${count} Gujarat Government ${typeLabel} holiday${count === 1 ? "" : "s"} for ${selectedYear}` +
                (alreadyPresent > 0 ? `; ${alreadyPresent} were already saved.` : ".")
              : `All ${alreadyPresent} Gujarat Government ${typeLabel} holidays for ${selectedYear} were already saved — nothing to add.`,
        });
        router.refresh();
      } catch (err: unknown) {
        setBanner({
          tone: "error",
          message: (err as Error).message || "Failed to import holidays.",
        });
      }
    });
  };

  return (
    <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-500/10 via-indigo-500/5 to-transparent overflow-hidden shadow-xs transition-all duration-200">
      {/* Accordion Trigger Header */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-left hover:bg-amber-500/5 transition-colors cursor-pointer select-none"
        aria-expanded={isExpanded}
        title={isExpanded ? "Collapse holiday calendar" : "Expand holiday calendar"}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold shrink-0 border border-amber-500/30">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h4 className="text-sm sm:text-base font-bold text-foreground">
                Gujarat Govt Published Holiday Calendar
              </h4>
              <span className="text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 whitespace-nowrap">
                {category === "gazetted" ? "જાહેર રજાઓ" : "મરજિયાત રજાઓ"}
              </span>
              <span className="text-[10px] font-semibold bg-card/90 text-muted-foreground px-2 py-0.5 rounded-md border border-border shadow-2xs whitespace-nowrap">
                {selectedYear} • {holidays.length} Holidays
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block truncate">
              Official gazetted public festivals and declared optional holidays for Gujarat State.
            </p>
          </div>
        </div>

        {/* Right Accordion Trigger Indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-2xs ${
              isExpanded
                ? "bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300"
                : "bg-card border-border text-foreground hover:bg-muted"
            }`}
          >
            <span className="hidden sm:inline">
              {isExpanded ? "Hide List" : "View & Sync"}
            </span>
            <span className="sm:hidden">
              {isExpanded ? "Hide" : "View"}
            </span>
            <ChevronDown
              className={`size-3.5 transition-transform duration-300 ${
                isExpanded ? "rotate-180 text-amber-600 dark:text-amber-400" : "text-muted-foreground"
              }`}
            />
          </div>
        </div>
      </button>

      <AutoDismissBanner
        message={banner?.message ?? null}
        tone={banner?.tone ?? "success"}
        onDismiss={() => setBanner(null)}
      />

      {/* Accordion Collapsible Body - Default Closed */}
      {isExpanded && (
        <div className="border-t border-amber-500/20 p-4 sm:p-5 space-y-4 animate-in fade-in-50 duration-200 bg-card/30">
          {/* Controls Toolbar: Category Toggle + Year Selector + Sync Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-card/90 border border-border/80 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              {/* Category Toggle */}
              <div className="flex rounded-xl border border-border bg-muted/60 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setCategory("gazetted")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    category === "gazetted"
                      ? "bg-amber-600 text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Gazetted (જાહેર)
                </button>
                <button
                  type="button"
                  onClick={() => setCategory("optional")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    category === "optional"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Optional (મરજિયાત)
                </button>
              </div>

              {/* Year Selector Dropdown */}
              <div ref={dropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsYearOpen((prev) => !prev)}
                  className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-2xs hover:border-amber-500/50 hover:bg-muted/50 transition-all cursor-pointer"
                >
                  <Calendar className="size-3.5 text-amber-500" />
                  <span>Year {selectedYear}</span>
                  <ChevronDown
                    className={`size-3.5 text-muted-foreground transition-transform duration-200 ${
                      isYearOpen ? "rotate-180 text-amber-600 dark:text-amber-400" : ""
                    }`}
                  />
                </button>

                {isYearOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1.5 w-36 rounded-2xl border border-border bg-card/95 backdrop-blur-md p-1.5 shadow-xl shadow-black/10 dark:shadow-black/40 animate-in fade-in-0 zoom-in-95 duration-150">
                    {availableYears.map((year) => {
                      const isSelected = year === selectedYear;
                      return (
                        <button
                          key={year}
                          type="button"
                          onClick={() => {
                            setSelectedYear(year);
                            setIsYearOpen(false);
                          }}
                          className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs transition-all cursor-pointer ${
                            isSelected
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/30"
                              : "text-foreground hover:bg-muted/70 font-medium"
                          }`}
                        >
                          <span>Year {year}</span>
                          {isSelected && <Check className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Sync Button */}
            <button
              type="button"
              onClick={handleImport}
              disabled={isPending || !hasCatalog}
              className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold shadow-md disabled:opacity-50 transition-all cursor-pointer shrink-0 ${
                category === "gazetted"
                  ? "bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 shadow-amber-600/20"
                  : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/20"
              }`}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <DownloadCloud className="size-3.5" />
                  <span>Sync {category === "gazetted" ? "Gazetted" : "Optional"} to Calendar</span>
                </>
              )}
            </button>
          </div>

          {!hasCatalog && (
            <p className="rounded-2xl border-2 border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              No published Gujarat Government list for {selectedYear} yet — it is
              announced each year. Add {selectedYear}&apos;s festivals by hand in
              the calendar below; Sundays and 2nd/4th Saturdays already count
              automatically.
            </p>
          )}

          {hasCatalog && (
            <>
              <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
                <span>
                  Showing{" "}
                  <strong className="text-foreground">{holidays.length}</strong>{" "}
                  {category === "gazetted" ? "gazetted public holidays" : "optional holidays"}{" "}
                  for {selectedYear}:
                </span>
                <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  Official Gujarat State Gazette
                </span>
              </div>

              {/* Catalog Preview Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto p-1 custom-scrollbar">
                {holidays.map((h, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-border/70 bg-card hover:bg-muted/40 transition-colors text-xs"
                  >
                    <span className="font-semibold text-foreground truncate">{h.name}</span>
                    <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 shrink-0">
                      {h.date}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
