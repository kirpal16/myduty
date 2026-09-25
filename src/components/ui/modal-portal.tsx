"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

/** Nothing to subscribe to — the client/server answer never changes. */
const subscribe = () => () => {};

/**
 * Renders a modal into `document.body` instead of wherever it was declared.
 *
 * The preview and confirm modals used to render inline, inside the Card that
 * contained the table. That put them in the same stacking context as the
 * filter dropdowns and the mobile nav drawer — all three sat at `z-50`, so
 * which one won came down to DOM order, and an open filter popover could
 * paint over an image preview.
 *
 * Portalling to the body plus a higher z-index makes the layering explicit
 * rather than incidental.
 */
export function ModalPortal({ children }: { children: React.ReactNode }) {
  // `document` does not exist during SSR, so the portal can only open once
  // the component is on the client. useSyncExternalStore gives that answer
  // directly — server snapshot false, client snapshot true — rather than
  // setting state from an effect, which costs an extra render pass.
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  if (!isClient) return null;
  return createPortal(children, document.body);
}

/**
 * The one place modal layering is decided. Above the app shell's header
 * (z-40), sidebar (z-30), mobile drawer and the filter popovers (z-50).
 */
export const MODAL_Z = "z-[100]";
