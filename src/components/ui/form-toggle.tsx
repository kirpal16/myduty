"use client";

import { useEffect, useRef, useState, useId } from "react";
import { Check, Sparkles, Calendar, Shield, Clock, Layers, Star } from "lucide-react";

export type FormToggleProps = {
  id?: string;
  name: string;
  label: string;
  hint?: string;
  defaultValue?: boolean;
  required?: boolean;
  disabled?: boolean;
  icon?: string;
  activeLabel?: string;
  inactiveLabel?: string;
  className?: string;
  onChange?: (checked: boolean) => void;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

function getFieldIcon(icon?: string, name?: string) {
  const key = (icon || name || "").toLowerCase();
  if (key.includes("sparkle") || key.includes("multiduty") || key.includes("multi_duty") || key.includes("enablemulti")) {
    return <Sparkles className="size-3.5 sm:size-4" />;
  }
  if (key.includes("layer") || key.includes("multi")) {
    return <Layers className="size-3.5 sm:size-4" />;
  }
  if (key.includes("gov") || key.includes("shield")) {
    return <Shield className="size-3.5 sm:size-4" />;
  }
  if (key.includes("holiday") || key.includes("calendar") || key.includes("date") || key.includes("year")) {
    return <Calendar className="size-3.5 sm:size-4" />;
  }
  if (key.includes("time") || key.includes("clock")) {
    return <Clock className="size-3.5 sm:size-4" />;
  }
  if (key.includes("star") || key.includes("optional")) {
    return <Star className="size-3.5 sm:size-4" />;
  }
  return null;
}

export function FormToggle({
  id,
  name,
  label,
  hint,
  defaultValue = false,
  required,
  disabled,
  icon,
  activeLabel,
  inactiveLabel,
  className = "",
  onChange,
  ...ariaProps
}: FormToggleProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const inputRef = useRef<HTMLInputElement>(null);
  const [checked, setChecked] = useState(Boolean(defaultValue));

  // Sync state if external defaultValue changes (e.g. server revalidation)
  useEffect(() => {
    setChecked(Boolean(defaultValue));
  }, [defaultValue]);

  // Handle form resets so UI resets back to default value
  useEffect(() => {
    const input = inputRef.current;
    const form = input?.form;
    if (!form) return;

    const handleReset = () => {
      setChecked(Boolean(defaultValue));
    };

    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  }, [defaultValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setChecked(e.target.checked);
    onChange?.(e.target.checked);
  };

  const iconElement = getFieldIcon(icon, name);

  return (
    <label
      htmlFor={inputId}
      className={`group relative flex cursor-pointer select-none items-start justify-between gap-2.5 sm:gap-3.5 rounded-xl sm:rounded-2xl border px-3 py-2.5 sm:px-4 sm:py-3 transition-all duration-200 focus-within:ring-2 focus-within:ring-indigo-500/30 ${
        checked
          ? "border-indigo-500/50 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-xs ring-1 ring-indigo-500/20"
          : "border-border/80 bg-card hover:border-slate-300 dark:hover:border-slate-700 hover:bg-muted/30"
      } ${disabled ? "opacity-60 cursor-not-allowed pointer-events-none" : ""} ${className}`}
    >
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        {iconElement && (
          <div
            className={`mt-0.5 flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-lg sm:rounded-xl transition-colors ${
              checked
                ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                : "bg-muted text-muted-foreground group-hover:text-foreground"
            }`}
          >
            {iconElement}
          </div>
        )}

        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`text-xs sm:text-sm font-semibold sm:font-bold transition-colors ${
                checked ? "text-indigo-950 dark:text-indigo-200" : "text-foreground"
              }`}
            >
              {label}
            </span>
            {required && <span className="text-rose-500 text-xs">*</span>}
          </div>

          {hint && (
            <p className="text-[10.5px] sm:text-xs text-muted-foreground leading-snug sm:leading-relaxed">
              {hint}
            </p>
          )}
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-2 self-center sm:self-auto sm:pt-0.5">
        {/* Status text badge on larger screens if labels are provided */}
        {(activeLabel || inactiveLabel) && (
          <span
            className={`hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-full text-[9.5px] font-bold transition-colors ${
              checked
                ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {checked ? activeLabel : inactiveLabel}
          </span>
        )}

        <input
          ref={inputRef}
          type="checkbox"
          id={inputId}
          name={name}
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          className="sr-only"
          aria-invalid={ariaProps["aria-invalid"]}
          aria-describedby={ariaProps["aria-describedby"]}
        />

        {/* Compact Modern iOS-Style Toggle Switch */}
        <div
          aria-hidden="true"
          className={`relative inline-flex h-5.5 w-10 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out ${
            checked
              ? "bg-gradient-to-r from-indigo-500 to-indigo-600 shadow-xs shadow-indigo-500/30"
              : "bg-slate-300 dark:bg-slate-700"
          }`}
        >
          <span
            className={`pointer-events-none inline-flex size-4.5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out items-center justify-center ${
              checked ? "translate-x-4.5 text-indigo-600" : "translate-x-0.5 text-slate-400"
            }`}
          >
            {checked ? (
              <Check className="size-2.5 stroke-[3]" />
            ) : (
              <span className="size-1 rounded-full bg-slate-300 dark:bg-slate-500" />
            )}
          </span>
        </div>
      </div>
    </label>
  );
}
