"use client";

import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Charts, loaded on demand.
 *
 * recharts is large and was imported directly by the dashboard, so it sat on
 * that route's critical path — paid for on every visit, including the ones
 * that scroll straight past the charts. `ssr: false` also skips rendering it
 * on the server, where an SVG chart costs time and produces markup the client
 * immediately replaces.
 */
function ChartFallback() {
  return (
    <Card className="flex flex-col gap-3 p-4 sm:p-5">
      <Skeleton className="h-3 w-40 rounded-md" />
      <Skeleton className="h-56 w-full rounded-2xl" />
    </Card>
  );
}

export const DutyTypeDonut = dynamic(
  () => import("./dashboard-charts").then((m) => m.DutyTypeDonut),
  { ssr: false, loading: ChartFallback },
);

export const WorkedDaysDonut = dynamic(
  () => import("./dashboard-charts").then((m) => m.WorkedDaysDonut),
  { ssr: false, loading: ChartFallback },
);

export const LeaveUsageBar = dynamic(
  () => import("./dashboard-charts").then((m) => m.LeaveUsageBar),
  { ssr: false, loading: ChartFallback },
);

export const MonthlyTaBar = dynamic(
  () => import("./dashboard-charts").then((m) => m.MonthlyTaBar),
  { ssr: false, loading: ChartFallback },
);
