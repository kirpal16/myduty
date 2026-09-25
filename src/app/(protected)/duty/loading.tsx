// Mirrors duty/page.tsx on a phone: compact header with badge, 5 KPI tiles
// (icon left, last one full width), search + Reset + dropdowns, duty cards,
// pagination.
import {
  LoadingShell,
  PageHeaderSkeleton,
  StatCardsSkeleton,
  FilterBarSkeleton,
  TableSkeleton,
} from "@/components/ui/skeletons";

export default function DutyLoading() {
  return (
    <LoadingShell>
      <PageHeaderSkeleton compactActions badge actionWidths={["w-24 sm:w-36"]} />
      <StatCardsSkeleton
        count={5}
        cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        gap="gap-3 sm:gap-4"
        iconLeft
        lastSpansFull
        trendOn={[3, 4]}
      />
      <FilterBarSkeleton count={5} resetButton divided />
      <TableSkeleton rows={8} selectable mobileVariant="duty" mobileRows={4} pagination />
    </LoadingShell>
  );
}
