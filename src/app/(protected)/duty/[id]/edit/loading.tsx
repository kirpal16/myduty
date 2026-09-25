// Mirrors duty/[id]/edit: the same shift form as duty/new, one guidance card.
import {
  LoadingShell,
  BackLinkSkeleton,
  PageHeaderSkeleton,
  FormSkeleton,
  FormPageGrid,
  SidebarCardSkeleton,
} from "@/components/ui/skeletons";

export default function DutyIdEditLoading() {
  return (
    <LoadingShell>
      <BackLinkSkeleton width="w-40" />
      <PageHeaderSkeleton actions={0} badge />
      <FormPageGrid sidebar={<SidebarCardSkeleton rows={1} />}>
        <FormSkeleton heading fields={5} checkboxRow accordions={1} upload dividers padding="p-6" />
      </FormPageGrid>
    </LoadingShell>
  );
}
