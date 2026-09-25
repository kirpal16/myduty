// Mirrors duty/new: back link, header, the shift form (type, start, end,
// holiday-claim row, location, notes, collapsed TA, attachment) and the two
// guidance cards stacked below it on a phone.
import {
  LoadingShell,
  BackLinkSkeleton,
  PageHeaderSkeleton,
  FormSkeleton,
  FormPageGrid,
  SidebarCardSkeleton,
} from "@/components/ui/skeletons";

export default function DutyNewLoading() {
  return (
    <LoadingShell>
      <BackLinkSkeleton />
      <PageHeaderSkeleton actions={0} badge />
      <FormPageGrid
        sidebar={
          <>
            <SidebarCardSkeleton rows={2} />
            <SidebarCardSkeleton rows={0} />
          </>
        }
      >
        <FormSkeleton heading fields={5} checkboxRow accordions={1} upload dividers padding="p-6" />
      </FormPageGrid>
    </LoadingShell>
  );
}
