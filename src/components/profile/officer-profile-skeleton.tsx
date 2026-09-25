import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

/**
 * Mirrors OfficerProfileContainer on its default "Career Timeline" tab: the
 * officer hero card (avatar, name, rank, three stats), the two tabs, then
 * one timeline card (current-posting banner, filter chips, milestones).
 */
export function OfficerProfileSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-7">
        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <Skeleton className="size-16 shrink-0 rounded-2xl sm:size-20" />
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-6 w-40 rounded-lg" />
                <Skeleton className="h-5 w-16 rounded-md" />
              </div>
              <Skeleton className="h-4 w-36 rounded-md" />
              <Skeleton className="h-3.5 w-44 rounded-md" />
            </div>
          </div>

          <div className="flex w-full shrink-0 items-center justify-around gap-3 border-t border-border pt-3 sm:w-auto sm:justify-start sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                {i > 0 && <div className="h-8 w-px bg-border" />}
                <div className="space-y-1 px-2.5 py-1.5 text-center">
                  <Skeleton className="mx-auto h-6 w-8 rounded-md" />
                  <Skeleton className="mx-auto h-3 w-16 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-2 border-b border-border/80 pb-1">
        <Skeleton className="h-10 w-40 shrink-0 rounded-xl" />
        <Skeleton className="h-10 w-44 shrink-0 rounded-xl" />
      </div>

      <Card className="space-y-4 p-4 sm:p-6">
        <Skeleton className="h-14 w-full rounded-xl" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-16 rounded-lg" />
          ))}
        </div>
        <div className="space-y-4 pt-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <Skeleton className="size-3 shrink-0 rounded-full" />
                <div className="mt-1 w-px flex-1 bg-border" />
              </div>
              <div className="flex-1 space-y-2 rounded-xl border border-border/60 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-40 rounded-md" />
                  <Skeleton className="h-4 w-16 rounded-md" />
                </div>
                <Skeleton className="h-3 w-32 rounded-md" />
                <Skeleton className="h-3 w-full max-w-md rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
