"use client";

import {
  LoadingShell,
  PageHeaderSkeleton,
  StatCardsSkeleton,
  FilterBarSkeleton,
  TableSkeleton,
  CalendarSkeleton,
  DashboardBodySkeleton,
  SideFormCardSkeleton,
} from "@/components/ui/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export function RouteLanguageSkeleton({ pathname }: { pathname: string }) {
  if (pathname === "/dashboard" || pathname.startsWith("/admin/dashboard")) {
    return (
      <LoadingShell className="space-y-8">
        <div className="flex flex-col gap-2.5 border-b border-border/70 pb-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-7 w-56 rounded-xl sm:h-8 sm:w-72" />
            <Skeleton className="h-3.5 w-full max-w-md rounded-lg" />
          </div>
          <div className="hidden shrink-0 gap-2.5 sm:flex">
            <Skeleton className="h-9 w-28 rounded-xl" />
            <Skeleton className="h-9 w-32 rounded-xl" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-xs">
          <Skeleton className="h-3 w-24 rounded-md" />
          <Skeleton className="h-7 w-20 rounded-xl" />
          <Skeleton className="h-7 w-20 rounded-xl" />
          <Skeleton className="h-9 w-36 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
        <DashboardBodySkeleton />
      </LoadingShell>
    );
  }

  if (pathname.startsWith("/duty")) {
    return (
      <LoadingShell>
        <PageHeaderSkeleton compactActions badge actionWidths={["w-24 sm:w-36"]} />
        <StatCardsSkeleton
          count={5}
          cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
          gap="gap-3 sm:gap-4"
          iconLeft
          lastSpansFull
          trendOn={[3, 4]}
        />
        <FilterBarSkeleton count={5} resetButton divided />
        <TableSkeleton rows={8} selectable mobileVariant="duty" mobileRows={4} pagination />
      </LoadingShell>
    );
  }

  if (pathname.startsWith("/leave")) {
    return (
      <LoadingShell>
        <PageHeaderSkeleton
          compactActions
          badge
          actionWidths={["w-9 sm:w-36", "w-24 sm:w-28"]}
        />
        <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-muted/40 p-0.5 flex-nowrap overflow-x-auto no-scrollbar">
          <Skeleton className="h-7 flex-1 sm:flex-none sm:w-40 rounded-lg" />
          <Skeleton className="h-7 flex-1 sm:flex-none sm:w-52 rounded-lg" />
        </div>
        <StatCardsSkeleton count={4} cols="grid-cols-2 lg:grid-cols-4" />
        <FilterBarSkeleton count={3} />
        <TableSkeleton rows={6} daysColumn pagination />
      </LoadingShell>
    );
  }

  if (pathname.startsWith("/calendar")) {
    return (
      <LoadingShell>
        <PageHeaderSkeleton titleLines={2} badge actionsStretch />
        <CalendarSkeleton />
      </LoadingShell>
    );
  }

  if (pathname.startsWith("/holidays")) {
    return (
      <LoadingShell>
        <PageHeaderSkeleton badge actionWidths={["w-36"]} />
        <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-4 lg:col-span-2">
            <Skeleton className="h-[72px] w-full rounded-2xl" />
            <div className="flex w-full gap-1 rounded-2xl border border-border/80 bg-muted/60 p-1 sm:w-fit">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-8 flex-1 rounded-xl sm:w-28 sm:flex-none" />
              ))}
            </div>
            <FilterBarSkeleton count={0} inline={["w-28", "w-20", "w-20"]} />
            <TableSkeleton rows={6} mobileVariant="holiday" mobileRows={5} pagination />
          </div>
          <SideFormCardSkeleton fields={4} />
        </div>
      </LoadingShell>
    );
  }

  if (pathname.startsWith("/storage")) {
    return (
      <LoadingShell>
        <PageHeaderSkeleton compactActions badge actionWidths={["w-24 sm:w-32"]} />
        <FilterBarSkeleton count={0} inline={["w-32", "w-28", "w-44"]} />
        <TableSkeleton rows={6} mobileVariant="file" mobileRows={5} pagination />
      </LoadingShell>
    );
  }

  if (pathname.startsWith("/reports")) {
    return (
      <LoadingShell>
        <PageHeaderSkeleton
          compactActions={false}
          badge
          actionWidths={["w-36 sm:w-44", "w-28 sm:w-36", "w-24 sm:w-28"]}
        />
        <FilterBarSkeleton count={2} />
        <StatCardsSkeleton count={4} cols="grid-cols-2 lg:grid-cols-4" />
        <TableSkeleton rows={8} mobileVariant="report" mobileRows={4} pagination />
      </LoadingShell>
    );
  }

  // Fallback for settings, profile, admin and other views
  return (
    <LoadingShell>
      <PageHeaderSkeleton compactActions actions={1} />
      <StatCardsSkeleton count={4} cols="grid-cols-2 lg:grid-cols-4" />
      <FilterBarSkeleton count={2} />
      <TableSkeleton rows={6} pagination />
    </LoadingShell>
  );
}
