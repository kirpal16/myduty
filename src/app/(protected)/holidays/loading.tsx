// Mirrors holidays/page.tsx: header with badge and one action, then (list
// column) the importer bar, the 3-way category switch, search + year + scope
// pills, holiday cards and pagination; the add-holiday form sits below the
// list on a phone.
import { Skeleton } from "@/components/ui/skeleton";
import {
  LoadingShell,
  PageHeaderSkeleton,
  FilterBarSkeleton,
  TableSkeleton,
  SideFormCardSkeleton,
} from "@/components/ui/skeletons";

export default function HolidaysLoading() {
  return (
    <LoadingShell>
      <PageHeaderSkeleton badge actionWidths={["w-36"]} />
      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Skeleton className="h-[72px] w-full rounded-2xl" />
          <div className="flex w-full gap-1 rounded-2xl border border-border/80 bg-muted/60 p-1 sm:w-fit">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-8 flex-1 rounded-xl sm:w-28 sm:flex-none" />
            ))}
          </div>
          <FilterBarSkeleton count={0} inline={["w-28", "w-20", "w-20"]} />
          <TableSkeleton rows={6} mobileVariant="holiday" mobileRows={5} pagination />
        </div>
        <SideFormCardSkeleton fields={4} />
      </div>
    </LoadingShell>
  );
}
