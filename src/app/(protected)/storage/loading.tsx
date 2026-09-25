// Mirrors storage/page.tsx: compact header with file-count badge and the
// Upload button, search + type / year / date range controls, file cards,
// pagination.
import {
  LoadingShell,
  PageHeaderSkeleton,
  FilterBarSkeleton,
  TableSkeleton,
} from "@/components/ui/skeletons";

export default function StorageLoading() {
  return (
    <LoadingShell>
      <PageHeaderSkeleton compactActions badge actionWidths={["w-24 sm:w-32"]} />
      <FilterBarSkeleton count={0} inline={["w-32", "w-28", "w-44"]} />
      <TableSkeleton rows={6} mobileVariant="file" mobileRows={5} pagination />
    </LoadingShell>
  );
}
