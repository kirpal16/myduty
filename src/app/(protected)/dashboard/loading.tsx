// Mirrors dashboard/page.tsx: the welcome header (badge + two small buttons
// on their own row on a phone), the period filter strip, then the same body
// skeleton the page's Suspense fallback uses.
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingShell, DashboardBodySkeleton } from "@/components/ui/skeletons";

export default function DashboardLoading() {
  return (
    <LoadingShell className="space-y-8">
      <div className="flex flex-col gap-2.5 border-b border-border/70 pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Skeleton className="h-7 w-56 rounded-xl sm:h-8 sm:w-72" />
          <div className="flex items-center justify-between gap-2 sm:hidden">
            <Skeleton className="h-5 w-20 rounded-full" />
            <div className="flex gap-2">
              <Skeleton className="h-7 w-24 rounded-xl" />
              <Skeleton className="h-7 w-28 rounded-xl" />
            </div>
          </div>
          <Skeleton className="h-3.5 w-full max-w-md rounded-lg" />
        </div>
        <div className="hidden shrink-0 gap-2.5 sm:flex">
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-xs">
        <Skeleton className="h-3 w-24 rounded-md" />
        <Skeleton className="h-7 w-20 rounded-xl" />
        <Skeleton className="h-7 w-20 rounded-xl" />
        <Skeleton className="h-9 w-36 rounded-xl" />
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>

      <DashboardBodySkeleton />
    </LoadingShell>
  );
}
