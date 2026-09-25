"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Preserves the window scroll position when query/filter parameters change
 * on the same page.
 *
 * Next.js App Router (v14/15/16) has a known issue where `router.push(..., { scroll: false })`
 * and `<Link scroll={false}>` still trigger scroll restoration to (0, 0) during
 * Server Component re-renders.
 *
 * This hook continuously tracks user scroll, and whenever the URL query params change
 * on the current pathname (e.g. filtering, searching, year selection, pagination, tabs),
 * it restores the exact previous scroll position across React 19 / RSC render ticks.
 */
export function QueryScrollPreserver() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const prevPathname = useRef(pathname);
  const prevParams = useRef(searchParams?.toString() ?? "");
  const scrollPosRef = useRef(0);
  const isNavigatingRef = useRef(false);

  // Continuously track scroll position when the user scrolls
  useEffect(() => {
    const handleScroll = () => {
      // If we are actively restoring scroll after a filter change,
      // ignore synthetic zero scrolls triggered by the router
      if (!isNavigatingRef.current) {
        scrollPosRef.current = window.scrollY;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Detect when searchParams change on the SAME pathname
  useEffect(() => {
    const currentParams = searchParams?.toString() ?? "";
    const isSamePath = prevPathname.current === pathname;
    const isParamChange = prevParams.current !== currentParams;

    if (isSamePath && isParamChange) {
      const targetY = scrollPosRef.current;
      if (targetY > 0) {
        isNavigatingRef.current = true;

        const restoreScroll = () => {
          window.scrollTo({ top: targetY, left: 0, behavior: "instant" });
        };

        // Restore immediately and on subsequent render frames
        restoreScroll();
        const r1 = requestAnimationFrame(restoreScroll);
        const r2 = setTimeout(restoreScroll, 50);
        const r3 = setTimeout(restoreScroll, 120);
        const r4 = setTimeout(() => {
          restoreScroll();
          isNavigatingRef.current = false;
        }, 250);

        return () => {
          cancelAnimationFrame(r1);
          clearTimeout(r2);
          clearTimeout(r3);
          clearTimeout(r4);
          isNavigatingRef.current = false;
        };
      }
    } else if (!isSamePath) {
      // Navigated to a DIFFERENT page: reset so user starts at the top
      scrollPosRef.current = 0;
      isNavigatingRef.current = false;
    }

    prevPathname.current = pathname;
    prevParams.current = currentParams;
  }, [pathname, searchParams]);

  return null;
}
