import { Skeleton } from "@/components/ui/skeleton";

/**
 * Covers /login (and anything in the auth group without its own file).
 *
 * The auth screens are always dark — a slate→indigo gradient with a
 * translucent card — so the skeleton is too. It used to be a light card on
 * the page background, which flashed white before the dark screen arrived.
 */

/** A dark-surface bar: the default skeleton tone is for light pages. */
export function DarkBar({ className = "" }: { className?: string }) {
  return <Skeleton className={`bg-slate-800! ${className}`} />;
}

export function AuthLoadingShell({
  children,
  width = "max-w-md",
}: {
  children: React.ReactNode;
  width?: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-4 sm:p-6">
      <div className={`w-full ${width}`}>{children}</div>
    </main>
  );
}

function BrandHeader() {
  return (
    <div className="mb-8 flex flex-col items-center">
      <DarkBar className="mb-4 size-16 rounded-2xl" />
      <DarkBar className="h-7 w-48 rounded-xl" />
      <DarkBar className="mt-2 h-4 w-56 max-w-full rounded-lg" />
    </div>
  );
}

export default function AuthLoading() {
  return (
    <AuthLoadingShell>
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl sm:p-10">
        <BrandHeader />
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-1.5">
              <DarkBar className="h-3 w-24 rounded" />
              <DarkBar className="h-11 w-full rounded-xl" />
            </div>
          ))}
        </div>
        <DarkBar className="mt-6 h-12 w-full rounded-xl" />
        <DarkBar className="mt-4 h-10 w-full rounded-xl" />
        <div className="mt-8 border-t border-slate-800 pt-6">
          <DarkBar className="mx-auto h-3 w-48 rounded" />
        </div>
      </div>
      <DarkBar className="mx-auto mt-6 h-3.5 w-28 rounded" />
    </AuthLoadingShell>
  );
}

export { BrandHeader };
