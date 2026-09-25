"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { LinkSpinner } from "./link-spinner";

/**
 * `next/link` that shows a spinner while it is navigating.
 *
 * Every page in this app is server-rendered and most run several Supabase
 * queries, so there is a real gap between the tap and the new screen. Sixty-six
 * links had nothing acknowledging the tap at all — on a slow connection the app
 * simply looked broken until the page swapped.
 *
 * Written as a drop-in so call sites need no JSX changes:
 *
 *     import { NavLink as Link } from "@/components/ui/nav-link";
 *
 * The spinner renders nothing until `useLinkStatus` reports pending, so it
 * costs no layout at rest. It must be a CHILD of the Link — `useLinkStatus`
 * reads the nearest enclosing one and a sibling would stay false forever,
 * which is why this wrapper exists rather than a hook at the call site.
 */
export function NavLink({
  children,
  className = "",
  spinnerClassName = "",
  ...props
}: ComponentProps<typeof Link> & { spinnerClassName?: string }) {
  const hasLayoutClass =
    className.includes("flex") ||
    className.includes("inline-flex") ||
    className.includes("block") ||
    className.includes("inline-block") ||
    className.includes("grid");

  const combinedClass = hasLayoutClass
    ? className
    : `inline-flex items-center gap-1.5 ${className}`;

  return (
    <Link className={combinedClass} {...props}>
      {children}
      <LinkSpinner className={spinnerClassName} />
    </Link>
  );
}
