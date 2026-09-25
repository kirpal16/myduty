"use client";

import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The summary block above a report is a different shape per report type: a
 * duty/TA/holiday report shows the Monthly Pay Breakdown chips, a leave
 * report shows stat tiles. The skeleton used to draw the chips for both, so
 * opening a leave report flashed a pay card that never arrived.
 *
 * A `loading.tsx` gets no searchParams, so the type is read on the client;
 * the chip shape is the fallback, which is both the default report and what
 * shows for the moment before this resolves.
 *
 * Neither shape draws the Binpagari card. It only appears when there is
 * unpaid leave in the period, which is not known until the data arrives — a
 * placeholder for a card that usually is not there would be a worse guess
 * than leaving it out.
 */
export function ReportSummarySkeleton() {
  const type = useSearchParams()?.get("type");
  return type === "leave" ? <LeaveTilesSkeleton /> : <PayBreakdownSkeleton />;
}

export function PayBreakdownSkeleton() {
  return (
    <div className="rounded-xl border border-border/80 bg-card p-3 shadow-2xs sm:px-4">
      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-7 shrink-0 rounded-lg" />
          <Skeleton className="h-4 w-40 rounded-md" />
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg xl:w-28" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** One tile, matching a leave report's own summary row. */
function LeaveTilesSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      <Skeleton className="h-20 rounded-2xl" />
    </div>
  );
}
