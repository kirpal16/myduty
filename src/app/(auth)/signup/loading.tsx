// Mirrors signup: the wider card with six fields (two columns from `sm`).
import { AuthLoadingShell, BrandHeader, DarkBar } from "../loading";

export default function SignupLoading() {
  return (
    <AuthLoadingShell width="max-w-xl">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl sm:p-10">
        <BrandHeader />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <DarkBar className="h-3 w-24 rounded" />
              <DarkBar className="h-11 w-full rounded-xl" />
            </div>
          ))}
        </div>
        <DarkBar className="mt-6 h-12 w-full rounded-xl" />
        <div className="mt-6 border-t border-slate-800 pt-6">
          <DarkBar className="mx-auto h-3 w-48 rounded" />
        </div>
        <DarkBar className="mt-4 h-10 w-full rounded-xl" />
        <DarkBar className="mx-auto mt-6 h-3.5 w-28 rounded" />
      </div>
    </AuthLoadingShell>
  );
}
