"use client";

import { useState } from "react";
import { Check } from "lucide-react";

/**
 * Curated swatches drawn from the palette the rest of the app already uses,
 * so a leave type cannot be given a colour that clashes with the calendar or
 * disappears against either theme. The native picker is still there for
 * anything else.
 */
export const LEAVE_COLOR_SWATCHES = [
  { hex: "#ef4444", name: "Red" },
  { hex: "#f97316", name: "Orange" },
  { hex: "#f59e0b", name: "Amber" },
  { hex: "#eab308", name: "Yellow" },
  { hex: "#84cc16", name: "Lime" },
  { hex: "#22c55e", name: "Green" },
  { hex: "#10b981", name: "Emerald" },
  { hex: "#14b8a6", name: "Teal" },
  { hex: "#06b6d4", name: "Cyan" },
  { hex: "#0ea5e9", name: "Sky" },
  { hex: "#3b82f6", name: "Blue" },
  { hex: "#6366f1", name: "Indigo" },
  { hex: "#8b5cf6", name: "Violet" },
  { hex: "#a855f7", name: "Purple" },
  { hex: "#ec4899", name: "Pink" },
  { hex: "#64748b", name: "Slate" },
] as const;

export const DEFAULT_LEAVE_COLOR = "#10b981";

/**
 * Posts its value through a hidden input, so it drops into an existing
 * Server Action form without the form having to become a client component.
 */
export function ColorPicker({
  name = "color",
  defaultValue = DEFAULT_LEAVE_COLOR,
  label = "Calendar colour",
}: {
  name?: string;
  defaultValue?: string | null;
  label?: string;
}) {
  const [color, setColor] = useState(
    defaultValue && /^#[0-9a-fA-F]{6}$/.test(defaultValue)
      ? defaultValue
      : DEFAULT_LEAVE_COLOR,
  );

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      <input type="hidden" name={name} value={color} />

      <div className="flex flex-wrap items-center gap-1.5">
        {LEAVE_COLOR_SWATCHES.map((swatch) => {
          const selected = swatch.hex.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={swatch.hex}
              type="button"
              onClick={() => setColor(swatch.hex)}
              title={swatch.name}
              aria-label={swatch.name}
              aria-pressed={selected}
              style={{ backgroundColor: swatch.hex }}
              className={`flex size-7 cursor-pointer items-center justify-center rounded-lg border transition-transform hover:scale-110 ${
                selected
                  ? "border-foreground ring-2 ring-foreground/30"
                  : "border-black/10 dark:border-white/15"
              }`}
            >
              {selected && <Check className="size-3.5 text-white drop-shadow" />}
            </button>
          );
        })}

        <label
          className="ml-1 flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted"
          title="Pick any colour"
        >
          <span
            className="size-3.5 rounded border border-black/10 dark:border-white/15"
            style={{ backgroundColor: color }}
          />
          <span>Custom</span>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="sr-only"
          />
        </label>
      </div>
    </div>
  );
}
