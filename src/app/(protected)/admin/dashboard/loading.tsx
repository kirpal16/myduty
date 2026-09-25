// Mirrors admin/dashboard: header with badge, 4 stat tiles (one column on a
// phone, with a trend line), then the "Administrative Modules" link cards.
// There are no charts on this page.
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import {
  LoadingShell,
  PageHeaderSkeleton,
  StatCardsSkeleton,
} from "@/components/ui/skeletons";

export default function AdminDashboardLoading() {
  return (
    <LoadingShell className="space-y-8">
      <PageHeaderSkeleton actions={0} badge titleLines={2} />
      <StatCardsSkeleton
        count={4}
        cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        gap="gap-4 sm:gap-6"
        trend
      />
      <div className="space-y-4">
        <Skeleton className="h-5 w-48 rounded-md" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Card key={i} className="space-y-3 p-5">
              <Skeleton className="size-10 rounded-xl" />
              <Skeleton className="h-4 w-36 rounded-md" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-full rounded-md" />
                <Skeleton className="h-3 w-3/4 rounded-md" />
              </div>
              <div className="flex items-center justify-between border-t border-border/60 pt-3">
                <Skeleton className="h-3 w-14 rounded-md" />
                <Skeleton className="size-3.5 rounded-sm" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </LoadingShell>
  );
}
