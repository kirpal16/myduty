// Fallback for any protected route without its own loading file: a generic
// list page built from the shared pieces, so it is at least phone-safe (no
// fixed-width bars wider than the screen, cards instead of squeezed rows).
import {
  LoadingShell,
  PageHeaderSkeleton,
  StatCardsSkeleton,
  FilterBarSkeleton,
  TableSkeleton,
} from "@/components/ui/skeletons";

export default function ProtectedLoading() {
  return (
    <LoadingShell>
      <PageHeaderSkeleton compactActions actions={1} />
      <StatCardsSkeleton count={4} cols="grid-cols-2 lg:grid-cols-4" />
      <FilterBarSkeleton count={2} />
      <TableSkeleton rows={6} pagination />
    </LoadingShell>
  );
}
