import { WifiOff } from "lucide-react";

/**
 * What the installed app shows with no connection.
 *
 * Deliberately says nothing about the officer. The previous service worker
 * cached every page it served, so going offline could surface whichever
 * officer had last signed in on that device — a real problem on a shared
 * phone. Duty logs, leave and holidays are all live data; showing a stale copy
 * of them would be worse than showing none, because it looks current.
 */
export const metadata = {
  title: "Offline — My Duty",
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-6 text-center text-slate-100">
      <div className="flex size-16 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/80">
        <WifiOff className="size-8 text-amber-400" />
      </div>

      <h1 className="mt-6 text-xl font-bold text-white">You&apos;re offline</h1>

      <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
        My Duty needs a connection to show your duty log, leave and holiday
        calendar. Reconnect and this page will move on by itself.
      </p>

      <p className="mt-6 max-w-sm text-xs text-slate-500">
        Nothing is stored on this device, so no records are shown while
        offline — including on a shared phone.
      </p>
    </main>
  );
}
