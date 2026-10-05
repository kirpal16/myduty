"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useRef, useEffect, useTransition } from "react";
import {
  Filter,
  User,
  Briefcase,
  CalendarOff,
  Tag,
  Shield,
  ChevronDown,
  Check,
  Search,
  X,
  Loader2,
} from "lucide-react";

export interface FilterOption {
  value: string;
  label: string;
}

const ICONS = {
  user: User,
  briefcase: Briefcase,
  calendar: CalendarOff,
  tag: Tag,
  shield: Shield,
  filter: Filter,
};

export type FilterIconType = keyof typeof ICONS;

/** The menu's `min-w-[200px]`, and the gap kept from the viewport edge. */
const MENU_MIN_WIDTH = 200;
const VIEWPORT_MARGIN = 8;

export function FilterSelect({
  paramName,
  options,
  placeholder = "Filter by...",
  defaultValue = "",
  value,
  icon = "filter",
  clearable = true,
  clearValue,
  className = "",
}: {
  paramName: string;
  options: FilterOption[];
  placeholder?: string;
  defaultValue?: string;
  /**
   * The value the page is actually using. A page often applies a default
   * (this month, this year) without putting it in the URL; reading the URL
   * alone left the dropdown showing its placeholder, unhighlighted, with
   * nothing ticked — as if no filter were applied while one was.
   */
  value?: string;
  icon?: FilterIconType;
  /**
   * Shows the clear "x" in the trigger. Off for a filter that must always
   * have a value — a year picker, for instance, where clearing just falls
   * back to the current year. It also costs ~24px, which on a phone is the
   * difference between reading "2026" and reading "2...".
   */
  clearable?: boolean;
  /**
   * Value to apply when clearing (defaults to "all" if options contain "all", else "").
   */
  clearValue?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The flag was discarded, so changing a filter showed nothing while the
  // server re-rendered the page behind it.
  const [isPending, startTransition] = useTransition();

  const [isOpen, setIsOpen] = useState(false);
  /**
   * Which edge the menu hangs from.
   *
   * The menu is 200px wide at minimum while its trigger can be 112px, so a
   * left-anchored menu on a control near the right edge ran off the screen —
   * on a phone the year list was half off the page. Measured when opening
   * rather than in an effect: it is a read of layout in an event handler, so
   * there is no extra render and no setState-during-effect.
   */
  const [alignRight, setAlignRight] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const optionsListRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  const Icon = ICONS[icon] || Filter;
  const selectedValue = searchParams?.get(paramName) ?? value ?? defaultValue;
  const selectedOption = options.find((opt) => opt.value === selectedValue);

  // Determine what value counts as "cleared" (defaults to "all" if present, else "")
  const resolvedClearValue =
    clearValue !== undefined
      ? clearValue
      : options.some((o) => o.value === "all")
      ? "all"
      : "";

  const isCleared = !selectedValue || selectedValue === resolvedClearValue;

  // Auto-scroll the dropdown list to center the selected option when opening
  useEffect(() => {
    if (isOpen && !searchQuery) {
      const timer = setTimeout(() => {
        if (selectedItemRef.current && optionsListRef.current) {
          const container = optionsListRef.current;
          const item = selectedItemRef.current;
          const itemRect = item.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const relativeTop = itemRect.top - containerRect.top + container.scrollTop;

          container.scrollTop = Math.max(
            0,
            relativeTop - container.clientHeight / 2 + item.clientHeight / 2
          );
        }
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [isOpen, searchQuery, selectedValue]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (val: string) => {
    setIsOpen(false);
    setSearchQuery("");
    startTransition(() => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (val) {
        params.set(paramName, val);
      } else {
        params.delete(paramName);
      }
      params.set("page", "1"); // reset page on filter change
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          if (!isOpen) {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
              setAlignRight(
                rect.left + MENU_MIN_WIDTH > window.innerWidth - VIEWPORT_MARGIN,
              );
            }
          }
          setIsOpen((prev) => !prev);
        }}
        aria-expanded={isOpen}
        className={`w-full h-9 flex items-center justify-between gap-2 rounded-xl border px-2.5 sm:px-3 text-xs font-medium transition-all shadow-2xs cursor-pointer ${
          isOpen
            ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-card text-foreground"
            : !isCleared
            ? "border-indigo-500/40 bg-indigo-500/5 text-foreground hover:bg-indigo-500/10"
            : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50"
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <div
            className={`flex size-4.5 shrink-0 items-center justify-center rounded-md transition-colors ${
              !isCleared
                ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                : "text-muted-foreground"
            }`}
          >
            {/* The icon becomes the spinner while the filtered page loads. */}
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin text-indigo-500" />
            ) : (
              <Icon className="size-3.5" />
            )}
          </div>
          <span className="truncate font-medium text-foreground">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {clearable && !isCleared && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(resolvedClearValue);
              }}
              title="Clear to whole year"
              className="p-0.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="size-3" />
            </span>
          )}
          <ChevronDown
            className={`size-3.5 text-muted-foreground transition-transform duration-200 ${
              isOpen ? "rotate-180 text-indigo-600 dark:text-indigo-400" : ""
            }`}
          />
        </div>
      </button>

      {/* Dropdown Floating Menu */}
      {isOpen && (
        <div
          className={`absolute top-full z-50 mt-1.5 w-full min-w-[200px] max-w-[calc(100vw-2rem)] sm:max-w-xs ${
            alignRight ? "right-0" : "left-0"
          } rounded-2xl border border-border bg-card/95 backdrop-blur-md p-1.5 shadow-xl shadow-black/10 dark:shadow-black/40 animate-in fade-in-0 zoom-in-95 duration-150`}
        >
          {/* Quick Search if more than 5 options */}
          {options.length > 5 && (
            <div className="relative mb-1.5 p-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                autoFocus
                placeholder="Search options..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-border/70 bg-muted/40 py-1.5 pl-8 pr-3 text-xs placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-hidden focus:bg-card"
              />
            </div>
          )}

          {/* Options List */}
          <div
            ref={optionsListRef}
            className="max-h-56 overflow-y-auto space-y-0.5 custom-scrollbar pr-0.5"
          >
            {/* "All" reset row.
                Hidden when an option already carries the same label, or it
                renders twice — the dashboard passes placeholder={String(year)}
                next to an options list whose first entry is that same year, so
                the menu showed "2026" twice and either row did the same thing.
                Fixed here rather than at the call site so no future caller can
                reintroduce it. */}
            {!options.some((o) => o.label === placeholder) && (
            <button
              type="button"
              ref={isCleared ? selectedItemRef : undefined}
              onClick={() => handleSelect(resolvedClearValue)}
              className={`w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs transition-all cursor-pointer ${
                isCleared
                  ? "bg-indigo-600 text-white font-semibold shadow-xs"
                  : "text-foreground hover:bg-muted/70 font-medium"
              }`}
            >
              <span className="truncate">{placeholder}</span>
              {isCleared && <Check className="size-3.5 shrink-0" />}
            </button>
            )}

            {/* Individual Options */}
            {filteredOptions.map((opt) => {
              const isSelected = opt.value === selectedValue;
              return (
                <button
                  key={opt.value}
                  ref={isSelected ? selectedItemRef : undefined}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs transition-all cursor-pointer ${
                    isSelected
                      ? "bg-indigo-600 text-white font-semibold shadow-xs"
                      : "text-foreground hover:bg-muted/70 font-medium"
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check className="size-3.5 shrink-0" />}
                </button>
              );
            })}

            {filteredOptions.length === 0 && (
              <div className="py-4 text-center text-xs text-muted-foreground">
                No matching options found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
