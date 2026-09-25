// Mirrors admin/users: header with badge, search + status pills, officer
// cards (role box, stacked action buttons), pagination.
import {
  LoadingShell,
  PageHeaderSkeleton,
  FilterBarSkeleton,
  TableSkeleton,
} from "@/components/ui/skeletons";

export default function AdminUsersLoading() {
  return (
    <LoadingShell>
      <PageHeaderSkeleton actions={0} badge />
      <FilterBarSkeleton count={0} pills={3} />
      <TableSkeleton rows={8} mobileVariant="user" mobileRows={3} pagination />
    </LoadingShell>
  );
}
