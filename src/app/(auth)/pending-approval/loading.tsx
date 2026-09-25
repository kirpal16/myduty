// Mirrors pending-approval: a centred status icon, title, message, the
// applicant/status box and the log-out button — no form fields.
import { AuthLoadingShell, DarkBar } from "../loading";

export default function PendingApprovalLoading() {
  return (
    <AuthLoadingShell>
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-2xl sm:p-10">
        <div className="mb-6 flex justify-center">
          <DarkBar className="size-16 rounded-2xl" />
        </div>
        <DarkBar className="mx-auto mb-3 h-7 w-64 max-w-full rounded-xl" />
        <div className="mb-6 space-y-2">
          <DarkBar className="mx-auto h-3 w-full rounded" />
          <DarkBar className="mx-auto h-3 w-full rounded" />
          <DarkBar className="mx-auto h-3 w-2/3 rounded" />
        </div>
        <div className="mb-6 space-y-2.5 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
          {[0, 1].map((i) => (
            <div key={i} className="flex justify-between">
              <DarkBar className="h-3 w-16 rounded" />
              <DarkBar className="h-3 w-28 rounded" />
            </div>
          ))}
        </div>
        <DarkBar className="h-10 w-full rounded-xl" />
      </div>
    </AuthLoadingShell>
  );
}
