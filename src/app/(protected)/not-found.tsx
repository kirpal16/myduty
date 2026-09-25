import { NavLink as Link } from "@/components/ui/nav-link";
import { FileQuestion, LayoutDashboard, Briefcase } from "lucide-react";

/**
 * Reached by `notFound()` — most often a duty or leave entry that was deleted
 * while its link was still open. Previously this rendered the framework's
 * bare 404 outside the app shell, which read like the site was broken rather
 * than the record being gone.
 */
export default function ProtectedNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-16 text-center sm:px-6">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-muted text-muted-foreground">
        <FileQuestion className="size-7" />
      </div>

      <h1 className="mt-5 text-xl font-bold text-foreground">
        That record no longer exists
      </h1>
      <p className="mt-2 max-w-md text-xs text-muted-foreground sm:text-sm">
        It may have been deleted, or you may not have access to it.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        <Link
          href="/duty"
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 transition-colors hover:bg-indigo-500 sm:text-sm"
        >
          <Briefcase className="size-4" />
          <span>Duty log</span>
        </Link>
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
