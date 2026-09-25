import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { logout } from "@/actions/auth";
import { Clock, ShieldX, LogOut } from "lucide-react";
import { PendingButton } from "@/components/ui/pending-button";

export default async function PendingApprovalPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (user.status === "APPROVED") redirect("/dashboard");

  const isRejected = user.status === "REJECTED";

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 sm:p-10 shadow-2xl backdrop-blur-xl text-center">
          <div className="flex justify-center mb-6">
            <div
              className={`flex size-16 items-center justify-center rounded-2xl border ${
                isRejected
                  ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                  : "bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse"
              }`}
            >
              {isRejected ? (
                <ShieldX className="size-8" />
              ) : (
                <Clock className="size-8" />
              )}
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
            {isRejected ? "Registration Not Approved" : "Awaiting Administrator Approval"}
          </h1>

          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
            {isRejected
              ? "Your account request was reviewed and not approved. Please contact your department supervisor or system administrator for assistance."
              : `Hello ${user.fullName}, your registration is pending review by a Super Admin. You will receive access as soon as your account is approved.`}
          </p>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 mb-6 text-left text-xs text-slate-400 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Applicant:</span>
              <span className="text-slate-200 font-medium">{user.fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Status:</span>
              <span
                className={`font-semibold ${
                  isRejected ? "text-rose-400" : "text-amber-400"
                }`}
              >
                {user.status}
              </span>
            </div>
          </div>

          <form action={logout}>
            <PendingButton
              pendingLabel="Logging out…"
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-all shadow-xs cursor-pointer whitespace-nowrap flex-nowrap"
            >
              <LogOut className="size-4 shrink-0" />
              <span>Log out</span>
            </PendingButton>
          </form>
        </div>
      </div>
    </main>
  );
}
