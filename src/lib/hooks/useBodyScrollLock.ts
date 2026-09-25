"use client";

import { useEffect } from "react";

/**
 * Stops the page behind an overlay from scrolling.
 *
 * Written once because there were about to be three copies. The mobile drawer
 * had none at all — opening it and dragging scrolled the page underneath
 * instead of the menu — and the two modals each set
 * `document.body.style.overflow = "hidden"` and reset it to `"unset"`, which
 * carries two faults this replaces:
 *
 *   - Resetting to a literal value CLOBBERS rather than restores. With two
 *     overlays open, closing the inner one unlocked the page while the outer
 *     was still up. Hence the reference count below.
 *   - `overflow: hidden` on <body> does not reliably hold in iOS Safari, which
 *     is the platform the drawer bug was reported on. `position: fixed` does,
 *     at the cost of having to put the scroll position back by hand.
 */

/** How many overlays currently want the page locked. */
let lockCount = 0;

/** What to put back when the last one releases. */
let restore: {
  overflow: string;
  position: string;
  top: string;
  width: string;
  paddingRight: string;
  scrollY: number;
} | null = null;

function lock() {
  lockCount += 1;
  if (lockCount > 1) return; // already locked by an outer overlay

  const body = document.body;
  const scrollY = window.scrollY;

  restore = {
    overflow: body.style.overflow,
    position: body.style.position,
    top: body.style.top,
    width: body.style.width,
    paddingRight: body.style.paddingRight,
    scrollY,
  };

  // Taking the body out of flow removes its scrollbar, which would otherwise
  // shift the whole layout sideways on a desktop the moment a modal opens.
  const scrollbar = window.innerWidth - document.documentElement.clientWidth;
  if (scrollbar > 0) {
    const current = parseFloat(getComputedStyle(body).paddingRight) || 0;
    body.style.paddingRight = `${current + scrollbar}px`;
  }

  body.style.overflow = "hidden";
  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.width = "100%";
}

function unlock() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount > 0 || !restore) return; // an outer overlay is still open

  const body = document.body;
  const { scrollY } = restore;

  body.style.overflow = restore.overflow;
  body.style.position = restore.position;
  body.style.top = restore.top;
  body.style.width = restore.width;
  body.style.paddingRight = restore.paddingRight;
  restore = null;

  // Force a layout flush before scrolling back.
  //
  // Verified in a browser, because it is not obvious: while the body is
  // `position: fixed` the document collapses to viewport height, and the
  // browser has not recalculated it at the moment those styles come off. A
  // scrollTo issued now is clamped against the *old* short height and lands at
  // 0 — the reader is dumped at the top of the page every time an overlay
  // closes. Reading a layout property forces the recalculation first.
  void document.documentElement.scrollHeight;

  // `behavior: "instant"` because restoring a position is not an animation,
  // and a global `scroll-behavior: smooth` would otherwise turn it into one.
  window.scrollTo({ top: scrollY, left: 0, behavior: "instant" });
}

/** Locks the page while `active` is true, and releases it on unmount. */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lock();
    return unlock;
  }, [active]);
}

/** Exposed for tests only — the counter is module state and must not leak. */
export const __scrollLockInternals = {
  lock,
  unlock,
  get count() {
    return lockCount;
  },
  reset() {
    lockCount = 0;
    restore = null;
  },
};
