"use client";

import { useState, useRef, useEffect, useId } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { ColorDot } from "@/components/ui/color-dot";
import {
  ChevronDown,
  Check,
  Search,
  LucideIcon,
  Building,
  User,
  Clock,
  Calendar,
  Shield,
  Tag,
  Briefcase,
  Globe,
  Layers,
  Sparkles,
  Filter,
} from "lucide-react";

export interface FormSelectOption {
  value: string;
  label: string;
  /**
   * Optional swatch shown beside the label, in the list and on the trigger.
   * Used by leave types, which each carry a colour the officer chose — it is
   * how they recognise a type at a glance everywhere else in the app.
   */
  color?: string | null;
}

const FORM_ICONS = {
  building: Building,
  user: User,
  clock: Clock,
  calendar: Calendar,
  shield: Shield,
  tag: Tag,
  briefcase: Briefcase,
  globe: Globe,
  layers: Layers,
  sparkles: Sparkles,
  filter: Filter,
};

export type FormSelectIconType = keyof typeof FORM_ICONS;

export function FormSelect({
  name,
  id,
  options,
  value,
  defaultValue = "",
  placeholder = "Select an option",
  required = false,
  disabled = false,
  onChange,
  icon: IconProp,
  iconName,
  className = "",
  error,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: {
  name?: string;
  id?: string;
  options: FormSelectOption[];
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  onChange?: (value: string) => void;
  icon?: LucideIcon;
  iconName?: FormSelectIconType;
  className?: string;
  error?: boolean;
  /**
   * Forwarded to the trigger button, not the hidden input -- the button is
   * what a screen reader lands on. Without these the select's error message
   * exists on screen but is announced to nobody.
   */
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const Icon = IconProp || (iconName ? FORM_ICONS[iconName] : undefined);
  const [internalValue, setInternalValue] = useState(value ?? defaultValue ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  /**
   * Where the panel sits on screen, in viewport coordinates.
   *
   * The panel used to be an `absolute` child of the trigger, which a
   * scrolling ancestor clips -- inside the sanction modals (`overflow-y-auto`)
   * the option list was cut off and scrolled away with the form. It is now
   * portalled to the body and positioned `fixed` against the trigger's
   * measured rect, so no ancestor can clip it, and it flips above the trigger
   * when there is more room up there.
   */
  const [placement, setPlacement] = useState<{
    /** Set when dropping down: the panel's top edge. */
    top?: number;
    /** Set when flipping up: the panel's BOTTOM edge, measured from the
     *  viewport bottom. Anchoring the bottom is what keeps a short list
     *  touching its trigger -- anchoring the top at `triggerTop - maxHeight`
     *  left a one-option list floating far above the field it belongs to. */
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // The panel lives in a portal now, so "outside" has to mean outside BOTH
  // the trigger and the panel -- otherwise mousedown on an option closes the
  // list before the click that selects it can land.
  const panelRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const optionsListRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();
  const mounted = useRef(false);

  const currentValue = value !== undefined ? value : internalValue;
  const selectedOption = options.find((opt) => opt.value === currentValue);

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
  }, [isOpen, searchQuery, currentValue]);

  // Sync internal value if controlled
  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);

  /**
   * Tell the rest of the form that the value changed.
   *
   * This control keeps its value on a hidden input, and assigning to an
   * input's value -- whether by React or by hand -- fires no event at all.
   * So to every listener on the form, picking an option looked like nothing
   * happening: a validation message stayed on screen next to the value that
   * had just fixed it, and a dirty-check saw an untouched form.
   *
   * Dispatching the real events puts this control back into normal form
   * semantics, which is what every consumer already assumes.
   */
  useEffect(() => {
    // Not on mount: that would report a change before anyone made one.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const input = hiddenRef.current;
    if (!input) return;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, [currentValue]);

  // Measure the trigger whenever the panel opens, and keep measuring while it
  // is open: scrolling or resizing moves the trigger out from under a fixed
  // panel otherwise.
  useEffect(() => {
    if (!isOpen) {
      setPlacement(null);
      return;
    }
    const measure = () => {
      const trigger = containerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const GAP = 6;
      const MARGIN = 8;
      const below = window.innerHeight - rect.bottom - GAP - MARGIN;
      const above = rect.top - GAP - MARGIN;
      const up = below < 200 && above > below;
      // A cap, not a height: the panel hugs its content and only scrolls
      // once the options actually need more room than this.
      const maxHeight = Math.max(140, Math.min(320, up ? above : below));
      // Keep the panel on screen horizontally on a narrow phone.
      const width = Math.min(
        Math.max(rect.width, 200),
        window.innerWidth - MARGIN * 2,
      );
      const left = Math.min(
        Math.max(MARGIN, rect.left),
        window.innerWidth - width - MARGIN,
      );
      setPlacement({
        ...(up
          ? { bottom: window.innerHeight - rect.top + GAP }
          : { top: rect.bottom + GAP }),
        left,
        width,
        maxHeight,
      });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const inTrigger = containerRef.current?.contains(target);
      const inPanel = panelRef.current?.contains(target);
      if (!inTrigger && !inPanel) {
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

  // Escape key to close
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
    setInternalValue(val);
    setIsOpen(false);
    setSearchQuery("");
    onChange?.(val);
  };

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      {/* Hidden input for Native Form / Server Action Submission */}
      {name && (
        <input
          ref={hiddenRef}
          type="hidden"
          name={name}
          id={id}
          value={currentValue}
          data-required={required ? "true" : undefined}
        />
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        // A button cannot be "invalid" -- ARIA says so, and the linter agrees.
        // This control genuinely is a combobox: a trigger that opens a list of
        // options, which is exactly the role's definition. Declaring it makes
        // aria-expanded and aria-invalid meaningful rather than ignored.
        data-field={name}
        role="combobox"
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        className={`w-full flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm transition-all shadow-xs cursor-pointer ${
          disabled
            ? "opacity-50 cursor-not-allowed bg-muted"
            : isOpen
            ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-card text-foreground"
            : error
            ? "border-rose-500 bg-card text-foreground"
            : currentValue
            ? "border-border bg-card text-foreground hover:border-slate-400 dark:hover:border-slate-600"
            : "border-border bg-card text-muted-foreground hover:border-slate-400 dark:hover:border-slate-600"
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          {Icon && (
            <Icon className="size-4 text-slate-400 shrink-0 pointer-events-none" />
          )}
          {selectedOption?.color && (
            <ColorDot color={selectedOption.color} label={selectedOption.label} />
          )}
          <span className={`truncate ${currentValue ? "font-medium text-foreground" : "text-muted-foreground"}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <ChevronDown
          className={`size-4 text-muted-foreground transition-transform duration-200 shrink-0 ${
            isOpen ? "rotate-180 text-indigo-600 dark:text-indigo-400" : ""
          }`}
        />
      </button>

      {/* Dropdown Floating Menu, portalled so no scrolling ancestor clips it.
          z-[120] clears MODAL_Z (z-[100]): this opens on top of the modals. */}
      {isOpen && placement && (
        <ModalPortal>
        <div
          ref={panelRef}
          data-form-select-panel={name || listboxId}
          className="fixed z-[120] rounded-2xl border border-border bg-card/95 backdrop-blur-md p-1.5 shadow-xl shadow-black/10 dark:shadow-black/40 animate-in fade-in-0 zoom-in-95 duration-150 flex flex-col"
          style={{
            top: placement.top,
            bottom: placement.bottom,
            left: placement.left,
            width: placement.width,
            maxHeight: placement.maxHeight,
          }}
        >
          {/* Quick Search if more than 5 options */}
          {options.length > 5 && (
            <div className="relative mb-1.5 p-1 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                autoFocus
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-border/70 bg-muted/40 py-1.5 pl-8 pr-3 text-xs placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-hidden focus:bg-card"
              />
            </div>
          )}

          {/* Options List */}
          <div
            ref={optionsListRef}
            id={listboxId}
            role="listbox"
            className="min-h-0 flex-1 overflow-y-auto space-y-0.5 custom-scrollbar pr-0.5"
          >
            {filteredOptions.map((opt) => {
              const isSelected = opt.value === currentValue;
              return (
                <button
                  key={opt.value}
                  ref={isSelected ? selectedItemRef : undefined}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs sm:text-sm transition-all cursor-pointer text-left ${
                    isSelected
                      ? "bg-indigo-600 text-white font-semibold shadow-xs"
                      : "text-foreground hover:bg-muted/70 font-medium"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {opt.color && <ColorDot color={opt.color} label={opt.label} />}
                    <span className="truncate">{opt.label}</span>
                  </span>
                  {isSelected && <Check className="size-4 shrink-0" />}
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
        </ModalPortal>
      )}
    </div>
  );
}
