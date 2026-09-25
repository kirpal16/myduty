"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Whether a form differs from how it opened.
 *
 * Save buttons here are always enabled, so pressing Save on an untouched
 * leave entitlement writes the same numbers back and revalidates the page for
 * nothing. This is what lets a form say "nothing to save".
 *
 * Works by snapshotting the whole form's serialised values on mount and
 * comparing after each change, rather than tracking fields individually. The
 * inputs in this app are uncontrolled -- `leave-allowance-row.tsx` seeds them
 * with `defaultValue` -- and making them all controlled to get a dirty flag
 * would be a far larger change for no benefit.
 *
 *     const { formRef, dirty, markClean } = useFormDirty();
 *     <form ref={formRef} action={...}>
 *       <PendingButton disabled={!dirty}>Save</PendingButton>
 *
 * Note a field that UNMOUNTS counts as a change, deliberately. In the
 * allowance row the maximum-balance input disappears when carry-forward is
 * switched off, and that genuinely is a different rule to save.
 */
export function useFormDirty<T extends HTMLFormElement = HTMLFormElement>() {
  const formRef = useRef<T | null>(null);
  const baseline = useRef<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const snapshot = useCallback(
    (form: T): string => serialiseFormEntries(new FormData(form).entries()),
    [],
  );

  const check = useCallback(() => {
    const form = formRef.current;
    if (!form || baseline.current === null) return;
    setDirty(snapshot(form) !== baseline.current);
  }, [snapshot]);

  /** Treat the current values as the new baseline -- call after a save. */
  const markClean = useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    baseline.current = snapshot(form);
    setDirty(false);
  }, [snapshot]);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    baseline.current = snapshot(form);
    setDirty(false);

    // `input` covers typing, `change` covers checkboxes, selects and files.
    //
    // Listened for on WINDOW and checked on the next tick. A state update
    // made from a listener on the form itself rendered before React had
    // handled the same event, which wrote the old value back into controlled
    // date inputs and swallowed the officer's change (see useFormFeedback).
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleCheck = (e: Event) => {
      if (!(e.target instanceof Node) || !form.contains(e.target)) return;
      clearTimeout(timer);
      timer = setTimeout(check, 0);
    };
    window.addEventListener("input", scheduleCheck);
    window.addEventListener("change", scheduleCheck);

    // A field appearing or disappearing changes the form without firing
    // either event -- the maximum-balance input is exactly that case.
    const observer = new MutationObserver(check);
    observer.observe(form, { childList: true, subtree: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener("input", scheduleCheck);
      window.removeEventListener("change", scheduleCheck);
      observer.disconnect();
    };
  }, [check, snapshot]);

  return { formRef, dirty, markClean, recheck: check };
}

/**
 * Form entries as one comparable string.
 *
 * Split out from the hook because the test suite runs in the `node`
 * environment with no DOM -- the same reason `useBodyScrollLock` exposes its
 * internals. This is where the comparison semantics live, so this is the part
 * worth testing.
 */
export function serialiseFormEntries(
  entries: Iterable<[string, FormDataEntryValue]>,
): string {
  const out: [string, string][] = [];

  for (const [key, value] of entries) {
    // A File cannot be compared by value, so compare what identifies it.
    // Two different files never collide on all three of these.
    const isFile =
      typeof value === "object" && value !== null && "size" in value && "name" in value;
    out.push([
      key,
      isFile
        ? `file:${(value as File).name}:${(value as File).size}:${(value as File).lastModified}`
        : String(value),
    ]);
  }

  // JSON rather than joining on a separator. A typed value containing the
  // separator would otherwise serialise identically to two separate fields --
  // so a genuinely edited form could read as unchanged and refuse to save.
  // A test covers exactly that case.
  //
  // FormData preserves DOM order, which is stable across re-renders. Sorting
  // would hide a genuine reorder; nothing here reorders fields, and matching
  // what the user sees matters more.
  return JSON.stringify(out);
}
