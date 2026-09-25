// Mirrors admin/permissions: header with two badges, three explanation
// cards, search + help line, then the table — which scrolls sideways on a
// phone rather than turning into cards.
import { Skeleton } from "@/components/ui/skeleton";
import {
  LoadingShell,
  PageHeaderSkeleton,
  FilterBarSkeleton,
  TableSkeleton,
} from "@/components/ui/skeletons";

export default function AdminPermissionsLoading() {
  return (
    <LoadingShell>
      <PageHeaderSkeleton actions={0} badge badges={2} titleLines={2} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-1.5 rounded-2xl border border-border p-4">
            <Skeleton className="h-3.5 w-44 rounded-md" />
            <Skeleton className="h-3 w-40 rounded-md" />
            <Skeleton className="h-2.5 w-full rounded-md" />
            <Skeleton className="h-2.5 w-4/5 rounded-md" />
          </div>
        ))}
      </div>
      <FilterBarSkeleton count={0} helpLine />
      <TableSkeleton rows={8} mobileMode="table" />
    </LoadingShell>
  );
}
