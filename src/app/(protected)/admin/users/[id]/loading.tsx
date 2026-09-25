// Mirrors admin/users/[id]: back link, header with status badge, then —
// in phone order — the officer details card, the leave allowances card
// (year picker + allowance rows) and the danger-zone card.
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import {
  LoadingShell,
  BackLinkSkeleton,
  PageHeaderSkeleton,
} from "@/components/ui/skeletons";

export default function AdminUserDetailLoading() {
  return (
    <LoadingShell>
      <BackLinkSkeleton width="w-44" />
      <PageHeaderSkeleton actions={0} badge titleLines={2} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="space-y-4 p-6">
          <Skeleton className="h-4 w-36 rounded-md" />
          <div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between border-b border-border/50 py-2">
                <Skeleton className="h-3.5 w-24 rounded-md" />
                <Skeleton className="h-3.5 w-20 rounded-md" />
              </div>
            ))}
          </div>
          <div className="space-y-2.5 border-t border-border/60 pt-4">
            <Skeleton className="h-3 w-40 rounded-md" />
            <Skeleton className="h-9 w-full rounded-xl" />
            <Skeleton className="h-9 w-full rounded-xl" />
          </div>
        </Card>

        <Card className="space-y-4 p-6 lg:col-span-2">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-56 max-w-full rounded-md" />
            <Skeleton className="h-3 w-64 max-w-full rounded-md" />
          </div>
          <Skeleton className="h-9 w-32 rounded-xl" />
          <div className="grid gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2.5 rounded-xl border border-border/70 p-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3.5 w-28 rounded-md" />
                  <Skeleton className="h-3 w-20 rounded-md" />
                </div>
                <Skeleton className="h-8 w-full rounded-lg" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-6 w-32 rounded-md" />
                  <Skeleton className="h-4 w-24 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="space-y-3 border-rose-500/30 p-6">
        <Skeleton className="h-4 w-64 max-w-full rounded-md" />
        <Skeleton className="h-3 w-full rounded-md" />
        <Skeleton className="h-3 w-full rounded-md" />
        <Skeleton className="h-3 w-2/3 rounded-md" />
        <Skeleton className="h-10 w-full rounded-xl sm:w-40" />
      </Card>
    </LoadingShell>
  );
}
