"use client";

import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterBarSkeleton, TableSkeleton } from "@/components/ui/skeletons";

/**
 * The two tabs on /leave show completely different things, so one skeleton
 * cannot stand in for both: the sanctions tab used to flash a table skeleton
 * over what is actually a set of cards.
 *
 * A `loading.tsx` gets no searchParams, so the tab is read on the client. The
 * records shape is the fallback, which is both the default tab and what shows
 * for the moment before this resolves.
 */
export function LeaveLoadingBody() {
  const tab = useSearchParams()?.get("tab");
  return tab === "special" ? <SpecialTabSkeleton /> : <RecordsTabSkeleton />;
}

export function RecordsTabSkeleton() {
  return (
    <>
      <FilterBarSkeleton count={4} divided />
      <TableSkeleton rows={6} daysColumn mobileVariant="leave" mobileRows={4} pagination />
    </>
  );
}

/** Three overview cards, the apply button row, then the application list. */
function SpecialTabSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-32 rounded-md" />
              <Skeleton className="size-4 rounded-md" />
            </div>
            <Skeleton className="h-8 w-20 rounded-lg" />
            <div className="border-t border-border/70 pt-3">
              <Skeleton className="h-3 w-full rounded-md" />
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-48 rounded-md" />
          <Skeleton className="h-3 w-64 max-w-full rounded-md" />
        </div>
        <Skeleton className="h-10 w-full sm:w-48 rounded-xl" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-5 flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-4 w-40 rounded-md" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <Skeleton className="h-3 w-full max-w-md rounded-md" />
              <Skeleton className="h-3 w-40 rounded-md" />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Skeleton className="h-9 w-24 rounded-xl" />
              <Skeleton className="h-9 w-20 rounded-xl" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
