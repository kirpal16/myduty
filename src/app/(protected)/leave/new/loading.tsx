// Mirrors leave/new on first open: back link, header, dates, leave type, the
// balance box, the sanction panel, reason, attachment, buttons — then the
// allowances and policy cards below it on a phone. No split preview: that only
// appears once dates are picked.
import {
  LoadingShell,
  BackLinkSkeleton,
  PageHeaderSkeleton,
  FormSkeleton,
  FormPageGrid,
  SidebarCardSkeleton,
} from "@/components/ui/skeletons";

export default function LeaveNewLoading() {
  return (
    <LoadingShell>
      <BackLinkSkeleton />
      <PageHeaderSkeleton actions={0} badge />
      <FormPageGrid
        sidebar={
          <>
            <SidebarCardSkeleton rows={4} bars />
            <SidebarCardSkeleton rows={0} />
          </>
        }
      >
        <FormSkeleton
          dateRow
          fields={1}
          infoBox
          panel
          textarea
          upload
          dividers
          padding="p-6 sm:p-8"
        />
      </FormPageGrid>
    </LoadingShell>
  );
}
