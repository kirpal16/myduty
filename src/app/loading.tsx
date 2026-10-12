import { Skeleton } from "@/components/ui/skeleton";

/**
 * Landing page skeleton loader.
 * Matches the redesigned desktop showcase and hero layout to prevent layout shifts.
 */
export default function HomeLoading() {
  return (
    <main className="min-h-screen bg-slate-950 flex flex-col justify-between">
      {/* Top Header Skeleton */}
      <header className="border-b border-slate-800/80 bg-slate-950/80">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Skeleton className="size-9 sm:size-11 rounded-2xl bg-slate-800" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-24 rounded-md bg-slate-800" />
              <Skeleton className="h-2.5 w-32 rounded-md bg-slate-800" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20 rounded-xl bg-slate-800" />
            <Skeleton className="h-9 w-28 rounded-xl bg-slate-800" />
          </div>
        </div>
      </header>

      {/* Hero Skeleton */}
      <section className="mx-auto flex max-w-5xl flex-col items-center gap-5 px-4 pt-12 pb-8 sm:px-6 sm:pt-16 w-full text-center">
        {/* Badge Skeleton */}
        <Skeleton className="h-7 w-80 max-w-full rounded-full bg-slate-800/90" />

        {/* Title Skeleton */}
        <Skeleton className="h-12 sm:h-16 w-full max-w-3xl rounded-2xl bg-slate-800" />

        {/* Subtitle Skeleton */}
        <Skeleton className="h-16 w-full max-w-2xl rounded-2xl bg-slate-800/80" />

        {/* CTA Buttons Skeleton */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5 w-full max-w-xl">
          <Skeleton className="h-10 w-44 rounded-xl bg-slate-800" />
          <Skeleton className="h-10 w-36 rounded-xl bg-slate-800" />
          <Skeleton className="h-10 w-32 rounded-xl bg-slate-800" />
        </div>

        {/* Desktop Showcase Window Skeleton */}
        <div className="w-full max-w-5xl mt-12 rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Skeleton className="size-3 rounded-full bg-slate-800" />
              <Skeleton className="size-3 rounded-full bg-slate-800" />
              <Skeleton className="size-3 rounded-full bg-slate-800" />
            </div>
            <Skeleton className="h-5 w-40 rounded-full bg-slate-800" />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl bg-slate-800/70" />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1">
            <Skeleton className="h-32 rounded-2xl bg-slate-800/60" />
            <Skeleton className="h-32 rounded-2xl bg-slate-800/60" />
          </div>
        </div>
      </section>

      {/* Feature Cards Skeleton */}
      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-5 px-4 py-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-44 rounded-2xl bg-slate-800/70" />
        ))}
      </section>

      {/* Footer Skeleton */}
      <footer className="border-t border-slate-800/80 p-6 flex justify-center">
        <Skeleton className="h-4 w-72 rounded-md bg-slate-800" />
      </footer>
    </main>
  );
}
