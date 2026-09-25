// Mirrors settings/page.tsx on its default "profile" tab, in the page's own
// narrower shell: header, the wrapping tab bar, the profile form card and
// the time-format card. (A loading file cannot see ?tab=, so other tabs get
// the same shared header and tab bar.)
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { PageHeaderSkeleton, FormSkeleton } from "@/components/ui/skeletons";

export function SettingsSkeleton() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-3 py-6 duration-300 animate-in fade-in sm:space-y-8 sm:px-6 lg:px-8 2xl:max-w-6xl">
      <PageHeaderSkeleton actions={0} />

      <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border bg-card p-1.5 shadow-xs">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 min-w-[5.5rem] flex-1 rounded-xl sm:w-28 sm:flex-none" />
        ))}
      </div>

      <div className="space-y-6">
        <FormSkeleton avatarHeader fields={11} singleButton padding="p-4 sm:p-7" />
        <Card className="space-y-4 p-4 sm:p-6">
          <div className="flex items-center gap-3 border-b border-border/70 pb-3">
            <Skeleton className="size-8 shrink-0 rounded-xl sm:size-9" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40 rounded-md" />
              <Skeleton className="h-3 w-64 max-w-full rounded-md" />
            </div>
          </div>
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </Card>
      </div>
    </main>
  );
}

export default function SettingsLoading() {
  return <SettingsSkeleton />;
}
