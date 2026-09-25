// Mirrors admin/duty-types: search, compact rows with Edit / Deactivate /
// Delete, pagination — and the "Add Duty Type" form below the list on a phone.
import {
  LoadingShell,
  PageHeaderSkeleton,
  SearchCardSkeleton,
  TableSkeleton,
  SideFormCardSkeleton,
  ListWithSideFormSkeleton,
} from "@/components/ui/skeletons";

export default function AdminDutyTypesLoading() {
  return (
    <LoadingShell>
      <PageHeaderSkeleton actions={0} badge />
      <ListWithSideFormSkeleton
        list={
          <>
            <SearchCardSkeleton />
            <TableSkeleton rows={8} mobileVariant="row" mobileRows={8} rowButtons={3} pagination />
          </>
        }
        side={<SideFormCardSkeleton fields={3} />}
      />
    </LoadingShell>
  );
}
