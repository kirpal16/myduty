// Mirrors calendar/page.tsx: a two-line title with badge, a full-width
// actions row (icon + two stretched buttons), then the calendar itself.
import {
  LoadingShell,
  PageHeaderSkeleton,
  CalendarSkeleton,
} from "@/components/ui/skeletons";

export default function CalendarLoading() {
  return (
    <LoadingShell>
      <PageHeaderSkeleton titleLines={2} badge actionsStretch />
      <CalendarSkeleton />
    </LoadingShell>
  );
}
