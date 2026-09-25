// Mirrors leave/balance: back link, compact header (year picker + icon
// Settings button), the Holiday Leave card, then the per-type ledger.
// There are no KPI tiles on this page.
import {
  LoadingShell,
  BackLinkSkeleton,
  PageHeaderSkeleton,
  HolidayLeaveCardSkeleton,
  BalanceLedgerSkeleton,
} from "@/components/ui/skeletons";

export default function LeaveBalanceLoading() {
  return (
    <LoadingShell>
      <BackLinkSkeleton />
      <PageHeaderSkeleton compactActions actionWidths={["w-28", "w-9 sm:w-28"]} />
      <HolidayLeaveCardSkeleton />
      <BalanceLedgerSkeleton rows={4} />
    </LoadingShell>
  );
}
