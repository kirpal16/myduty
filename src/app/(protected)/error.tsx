"use client";

import { useEffect } from "react";
import { NavLink as Link } from "@/components/ui/nav-link";
import { AlertTriangle, RotateCcw, LayoutDashboard } from "lucide-react";

/**
 * There was no error boundary anywhere in the app, so a failed query took out
 * the whole route with the framework's default screen. A refused action —
 * editing someone else's duty, deleting a leave type still in use — now lands
 * here with its own message and a way back.
 */
export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server errors reach the client with their message stripped, so the
    // digest is the only thing that ties this screen to the server log.
    console.error("Route error", error.digest, error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-16 text-center sm:px-6">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400">
        <AlertTriangle className="size-7" />
      </div>

      <h1 className="mt-5 text-xl font-bold text-foreground">
        Something went wrong on this page
      </h1>
      <p className="mt-2 max-w-md text-xs text-muted-foreground sm:text-sm">
        {error.message || "The page could not be loaded. Try again, or head back to your dashboard."}
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-[11px] text-muted-foreground/70">
          Reference: {error.digest}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={reset}
          className="flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 transition-colors hover:bg-indigo-500 sm:text-sm"
        >
          <RotateCcw className="size-4" />
          <span>Try again</span>
        </button>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted sm:text-sm"
        >
          <LayoutDashboard className="size-4" />
          <span>Back to dashboard</span>
        </Link>
      </div>
    </main>
  );
}
