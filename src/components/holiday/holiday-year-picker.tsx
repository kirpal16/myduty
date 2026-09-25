"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

/**
 * Which year the holiday calendar is showing.
 *
 * Driven by `?year=` rather than local state, so the whole tab — the list, the
 * breakdown and the Holiday Leave total — is rendered on the server for that
 * year, and the view is linkable and survives a refresh.
 */
export function HolidayYearPicker({
  year,
  min,
  max,
}: {
  year: number;
  min: number;
  max: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const go = (next: number) => {
    if (next < min || next > max) return;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("year", String(next));
    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
  };

  return (
    <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-2xs">
      <button
        type="button"
        onClick={() => go(year - 1)}
        disabled={year <= min || isPending}
        aria-label="Previous year"
        className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ChevronLeft className="size-4" />
      </button>

      <span className="flex min-w-14 items-center justify-center gap-1.5 text-sm font-bold text-foreground">
        {isPending && <Loader2 className="size-3.5 animate-spin text-indigo-500" />}
        {year}
      </span>

      <button
        type="button"
        onClick={() => go(year + 1)}
        disabled={year >= max || isPending}
        aria-label="Next year"
        className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
