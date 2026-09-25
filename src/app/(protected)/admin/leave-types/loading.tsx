// Mirrors admin/leave-types: search, leave-type rows (colour dot + one
// button), pagination — then, below the list on a phone, the "Manage Leave
// Categories" card with its own type list and the add form (swatches).
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import {
  LoadingShell,
  PageHeaderSkeleton,
  SearchCardSkeleton,
  TableSkeleton,
  ListWithSideFormSkeleton,
} from "@/components/ui/skeletons";

export default function AdminLeaveTypesLoading() {
  return (
    <LoadingShell>
      <PageHeaderSkeleton actions={0} badge titleLines={2} />
      <ListWithSideFormSkeleton
        list={
          <>
            <SearchCardSkeleton />
            <TableSkeleton rows={8} mobileVariant="row" mobileRows={8} rowButtons={1} colorDot pagination />
          </>
        }
        side={
          <Card className="space-y-4 p-4 sm:p-6">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-48 rounded-md" />
              <Skeleton className="h-3 w-full rounded-md" />
              <Skeleton className="h-3 w-2/3 rounded-md" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-40 rounded-md" />
              <Skeleton className="h-3 w-4 rounded-md" />
            </div>
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5 px-3 py-2.5">
                  <Skeleton className="size-3.5 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-28 rounded-md" />
                    <Skeleton className="h-2.5 w-20 rounded-md" />
                  </div>
                  <Skeleton className="size-7 rounded-xl" />
                  <Skeleton className="size-7 rounded-xl" />
                </div>
              ))}
            </div>
            <div className="space-y-3 rounded-2xl border border-border p-4">
              <Skeleton className="h-3 w-24 rounded-md" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[0, 1].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-2.5 w-12 rounded-md" />
                    <Skeleton className="h-9 w-full rounded-xl" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-3 w-16 rounded-md" />
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="size-7 rounded-lg" />
                ))}
              </div>
              <div className="flex justify-end">
                <Skeleton className="h-9 w-32 rounded-xl" />
              </div>
            </div>
          </Card>
        }
      />
    </LoadingShell>
  );
}
