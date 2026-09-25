import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/ui/skeletons";
import { LeaveLoadingBody, RecordsTabSkeleton } from "./leave-loading-body";

export default function LeaveLoading() {
  return (
    <LoadingShell>
      {/* Top Header Skeleton - in ONE ROW */}
      <PageHeaderSkeleton
        compactActions
        badge
        actionWidths={["w-9 sm:w-36", "w-24 sm:w-28"]}
      />

      {/* Navigation Tabs Skeleton - mirrors LeaveNavTabs' segmented control so
          the swap to the real tabs does not jump. */}
      <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-muted/40 p-0.5 flex-nowrap overflow-x-auto no-scrollbar">
        <Skeleton className="h-7 flex-1 sm:flex-none sm:w-40 rounded-lg" />
        <Skeleton className="h-7 flex-1 sm:flex-none sm:w-52 rounded-lg" />
      </div>

      {/* useSearchParams needs a boundary of its own; the records shape is the
          fallback, so the worst case is today's behaviour. */}
      <Suspense fallback={<RecordsTabSkeleton />}>
        <LeaveLoadingBody />
      </Suspense>
    </LoadingShell>
  );
}
