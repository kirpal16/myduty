import { Skeleton } from "@/components/ui/skeleton";

/**
 * Landing page. Matches the real hero's stacked layout so the page does not
 * visibly reflow when the content arrives.
 */
export default function HomeLoading() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950">
      <header className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-y-3 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-9 rounded-2xl bg-slate-800 sm:size-11" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-24 rounded-md bg-slate-800" />
            <Skeleton className="h-2.5 w-32 rounded-md bg-slate-800" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20 rounded-xl bg-slate-800" />
          <Skeleton className="h-9 w-24 rounded-xl bg-slate-800" />
        </div>
      </header>

      <section className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-14 sm:px-6 sm:py-20">
        <Skeleton className="h-7 w-72 rounded-full bg-slate-800" />
        <Skeleton className="h-12 w-full max-w-2xl rounded-2xl bg-slate-800" />
        <Skeleton className="h-20 w-full max-w-2xl rounded-2xl bg-slate-800" />
        <div className="flex w-full flex-col items-center gap-4 sm:flex-row sm:justify-center">
          {[0, 1, 2].map((i) => (
            <Skeleton
              key={i}
              className="h-12 w-full rounded-xl bg-slate-800 sm:w-44"
            />
          ))}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-4 pb-20 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-44 rounded-2xl bg-slate-800" />
        ))}
      </section>
    </main>
  );
}
