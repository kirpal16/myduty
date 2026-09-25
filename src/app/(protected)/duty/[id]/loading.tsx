// Mirrors duty/[id]: back link, header with Edit / Delete, the Shift
// Information card (4 info boxes + location) and the allowances card.
import {
  LoadingShell,
  BackLinkSkeleton,
  PageHeaderSkeleton,
  DutyDetailSkeleton,
} from "@/components/ui/skeletons";

export default function DutyDetailLoading() {
  return (
    <LoadingShell>
      <BackLinkSkeleton />
      <PageHeaderSkeleton badge actionWidths={["w-28", "w-24"]} />
      <DutyDetailSkeleton />
    </LoadingShell>
  );
}
