// Mirrors reports/page.tsx: compact header with period badge and a small
// action, the stacked filters, the summary block for the report type being
// opened, then report cards and pagination.
import { Suspense } from "react";
import {
  LoadingShell,
  PageHeaderSkeleton,
  FilterBarSkeleton,
  TableSkeleton,
} from "@/components/ui/skeletons";
import {
  ReportSummarySkeleton,
  PayBreakdownSkeleton,
} from "./report-summary-skeleton";

export default function ReportsLoading() {
  return (
    <LoadingShell>
      <PageHeaderSkeleton compactActions badge actionWidths={["w-16 sm:w-28"]} />
      <FilterBarSkeleton count={2} />
      {/* useSearchParams needs a boundary of its own; the pay-breakdown shape
          is the fallback, so the worst case is the previous behaviour. */}
      <Suspense fallback={<PayBreakdownSkeleton />}>
        <ReportSummarySkeleton />
      </Suspense>
      <TableSkeleton rows={8} mobileVariant="report" mobileRows={4} pagination />
    </LoadingShell>
  );
}
