"use client";

import { useTransition } from "react";
import { updateTimeFormat } from "@/actions/settings";
import type { TimeFormat } from "@/types/database";
import { Clock, Check, Loader2 } from "lucide-react";

const OPTIONS: { value: TimeFormat; label: string; example: string }[] = [
  { value: "24h", label: "24-Hour Military Format", example: "14:30 / 20:00" },
  { value: "12h", label: "12-Hour Standard AM/PM", example: "2:30 PM / 8:00 PM" },
];

export function TimeFormatToggle({ current }: { current: TimeFormat }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
      {OPTIONS.map((opt) => {
        const active = opt.value === current;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={isPending || active}
            onClick={() =>
              startTransition(async () => {
                await updateTimeFormat(opt.value);
              })
            }
            className={`flex items-center justify-between p-3.5 rounded-xl border text-left text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer ${
              active
                ? "border-indigo-600 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20"
                : "border-border bg-card text-foreground hover:bg-muted/70 hover:border-slate-400 dark:hover:border-slate-600"
            }`}
          >
            <div className="flex flex-col">
              <span className="font-semibold">{opt.label}</span>
              <span className="text-xs text-muted-foreground mt-0.5">
                Example: {opt.example}
              </span>
            </div>
            {isPending && active ? (
              <Loader2 className="size-4 animate-spin text-indigo-600" />
            ) : active ? (
              <div className="flex size-5 items-center justify-center rounded-full bg-indigo-600 text-white">
                <Check className="size-3" />
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
