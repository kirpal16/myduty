"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether this device can hover.
 *
 * Used to decide how a chart tooltip is opened: hovering on a desktop, tapping
 * on a phone. Recharts defaults to `trigger="hover"`, which on a touch screen
 * means the details never appear at all — there is no hover to give it.
 *
 * `(hover: hover)` rather than a width breakpoint on purpose: a narrow browser
 * window on a laptop still has a mouse, and a large tablet still does not.
 * Width would get both of those wrong.
 */
const QUERY = "(hover: hover) and (pointer: fine)";

function subscribe(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getSnapshot() {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia(QUERY).matches;
}

/**
 * The server has no pointer to inspect, so it assumes hover. The client
 * corrects it on hydration — and getting it briefly wrong only changes which
 * gesture opens a tooltip, never what is rendered.
 */
function getServerSnapshot() {
  return true;
}

export function useHasHover(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
