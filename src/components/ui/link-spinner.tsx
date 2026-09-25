"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";

/**
 * A spinner that appears while the link it sits inside is navigating.
 *
 * Must be rendered as a CHILD of the <Link> — `useLinkStatus` reads the
 * nearest enclosing one, and returns a permanently false `pending` if it is
 * rendered as a sibling.
 *
 * Worth having on the landing page in particular: /signup and /login are
 * dynamic routes, so there is a real gap between the tap and the new page,
 * and until now nothing acknowledged the tap at all.
 */
export function LinkSpinner({ className = "" }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <Loader2
      aria-hidden
      className={`size-4 shrink-0 animate-spin ${className}`}
    />
  );
}
