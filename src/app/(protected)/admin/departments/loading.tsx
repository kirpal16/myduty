// Mirrors admin/departments: search, department rows (one button each),
// pagination — and the "Add New Department" form below the list on a phone.
import {
  LoadingShell,
  PageHeaderSkeleton,
  SearchCardSkeleton,
  TableSkeleton,
  SideFormCardSkeleton,
  ListWithSideFormSkeleton,
} from "@/components/ui/skeletons";

export default function AdminDepartmentsLoading() {
  return (
    <LoadingShell>
      <PageHeaderSkeleton actions={0} badge />
      <ListWithSideFormSkeleton
        list={
          <>
            <SearchCardSkeleton />
            <TableSkeleton rows={6} mobileVariant="row" mobileRows={6} rowButtons={1} pagination />
          </>
        }
        side={<SideFormCardSkeleton fields={2} />}
      />
    </LoadingShell>
  );
}
