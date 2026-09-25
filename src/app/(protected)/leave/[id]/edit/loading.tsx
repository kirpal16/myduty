// Mirrors leave/[id]/edit: the leave form pre-filled — so the balance box
// under the type and the day-by-day split are present — plus the
// allowances card below it on a phone.
import {
  LoadingShell,
  BackLinkSkeleton,
  PageHeaderSkeleton,
  FormSkeleton,
  FormPageGrid,
  SidebarCardSkeleton,
} from "@/components/ui/skeletons";

export default function LeaveEditLoading() {
  return (
    <LoadingShell>
      <BackLinkSkeleton />
      <PageHeaderSkeleton actions={0} badge />
      <FormPageGrid sidebar={<SidebarCardSkeleton rows={4} bars />}>
        <FormSkeleton
          dateRow
          fields={1}
          infoBox
          accordions={1}
          textarea
          upload
          padding="p-6 sm:p-8"
        />
      </FormPageGrid>
    </LoadingShell>
  );
}
