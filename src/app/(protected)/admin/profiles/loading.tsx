// Mirrors admin/profiles: search, profile rows (description + one button),
// pagination — and the "Add Role Profile" form below the list on a phone.
import {
  LoadingShell,
  PageHeaderSkeleton,
  SearchCardSkeleton,
  TableSkeleton,
  SideFormCardSkeleton,
  ListWithSideFormSkeleton,
} from "@/components/ui/skeletons";

export default function AdminProfilesLoading() {
  return (
    <LoadingShell>
      <PageHeaderSkeleton actions={0} badge />
      <ListWithSideFormSkeleton
        list={
          <>
            <SearchCardSkeleton />
            <TableSkeleton
              rows={6}
              mobileVariant="row"
              mobileRows={5}
              rowButtons={1}
              description
              pagination
            />
          </>
        }
        side={<SideFormCardSkeleton fields={3} />}
      />
    </LoadingShell>
  );
}
