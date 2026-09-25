"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FieldErrors, FormState } from "@/lib/forms/formState";
import { fieldErrors as flattenIssues } from "@/lib/forms/formState";

/**
 * Field-level validation messages, and the behaviour around them.
 *
 * Four forms in this app rendered server errors under their inputs, and those
 * messages then sat there unchanged while the officer fixed the field —
 * updating only on the next submit. Everything else showed a single banner or
 * nothing at all.
 *
 * The agreed behaviour:
 *
 *   submit   ->  the server's errors appear under their fields
 *   type     ->  that field's message clears; the others keep theirs
 *   blur     ->  the field re-validates, and the message returns if still wrong
 *   after that -> that one field validates on every change
 *
 * Client-side re-validation runs the WHOLE schema over the form's current
 * values and keeps only the issues for the field in question. Validating a
 * picked sub-schema would be cheaper and wrong: `dutySchema` and
 * `applyLeaveSchema` carry `.refine()` rules across fields ("End time must be
 * after start time"), and picking one field silently drops them.
 */

type SchemaLike = {
  safeParse: (value: unknown) => {
    success: boolean;
    error?: { issues: { path: PropertyKey[]; message: string }[] };
  };
};

export type UseFormFeedbackOptions = {
  /** Whatever the server action last returned. */
  state?: FormState;
  /** The same schema the action validates with. Omit to rely on the server. */
  schema?: SchemaLike;
  /**
   * FormData -> the object the schema expects. Needed because a form posts
   * strings while schemas want numbers, booleans and nested shapes.
   */
  toValues?: (data: FormData) => unknown;
};

export function useFormFeedback({
  state,
  schema,
  toValues,
}: UseFormFeedbackOptions = {}) {
  const formRef = useRef<HTMLFormElement | null>(null);

  /** Fields the officer has cleared by typing since the last submit. */
  const [cleared, setCleared] = useState<Set<string>>(() => new Set());
  /** Fields that have been blurred once, and so now validate live. */
  const liveFields = useRef<Set<string>>(new Set());
  /** Messages produced on the client, keyed the same way as the server's. */
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});

  const serverErrors = state?.errors;

  // A new server response supersedes everything the client worked out, and
  // re-arms every field: the officer has just been told what is wrong.
  //
  // Adjusted during render rather than in an effect. React documents this as
  // the way to reset state when a prop changes -- it re-renders immediately
  // with the new value instead of painting the stale one first, and it does
  // not trip `react-hooks/set-state-in-effect`, which this project treats as
  // an error.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    setCleared(new Set());
    setClientErrors({});
  }

  const messageFor = useCallback(
    (name: string): string | undefined => {
      if (clientErrors[name]?.length) return clientErrors[name][0];
      if (cleared.has(name)) return undefined;
      return serverErrors?.[name]?.[0];
    },
    [clientErrors, cleared, serverErrors],
  );

  /** Run the schema and keep only this field's issues. */
  const validateField = useCallback(
    (name: string) => {
      const form = formRef.current;
      if (!form || !schema || !toValues) return;

      const parsed = schema.safeParse(toValues(new FormData(form)));
      const all = parsed.success || !parsed.error ? {} : flattenIssues(parsed.error);

      // Same messages as before -> the SAME object, so React skips the render.
      setClientErrors((prev) => {
        if (sameMessages(prev[name], all[name])) return prev;
        const next = { ...prev };
        if (all[name]?.length) next[name] = all[name];
        else delete next[name];
        return next;
      });

      // Once a field has been checked it keeps checking, so the officer sees
      // it go green without pressing submit again.
      if (all[name]?.length) setCleared((prev) => withOut(prev, name));
    },
    [schema, toValues],
  );

  const handleChange = useCallback(
    (name: string) => {
      // Typing clears the message immediately -- being corrected mid-keystroke
      // is what makes live-from-the-first-character unusable.
      setCleared((prev) => (prev.has(name) ? prev : new Set(prev).add(name)));
      setClientErrors((prev) => {
        if (!prev[name]) return prev;
        const next = { ...prev };
        delete next[name];
        return next;
      });

      if (liveFields.current.has(name)) validateField(name);
    },
    [validateField],
  );

  const handleBlur = useCallback(
    (name: string) => {
      liveFields.current.add(name);
      validateField(name);
    },
    [validateField],
  );

  /**
   * Listen on the FORM rather than per input.
   *
   * Two reasons. Wiring every input by hand means a field silently opts out
   * the moment someone adds one and forgets -- and there are ~12 inputs on the
   * duty form alone. And `FormSelect` keeps its value on a hidden input, so
   * its React onChange never reaches a field's props at all; it dispatches
   * real input/change events instead, which only a form-level listener sees.
   *
   * `focusout` rather than `blur`, because blur does not bubble.
   *
   * The listeners sit on WINDOW (filtered to this form), not on the form.
   * React handles `onChange` at its root, which a bubbling event reaches
   * AFTER the form. A listener on the form that set state therefore rendered
   * BEFORE React saw the input: that render wrote the old controlled value
   * back into the date field, React then saw "no change" and never called
   * onChange. That was the date picker that lost its first pick and then
   * froze. On window, these run after React has applied the new value.
   */
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const nameOf = (target: EventTarget | null): string | null => {
      const el = target as HTMLElement | null;
      return el?.getAttribute?.("name") ?? null;
    };
    const inForm = (target: EventTarget | null) =>
      target instanceof Node && form.contains(target);

    const onInput = (e: Event) => {
      if (!inForm(e.target)) return;
      const name = nameOf(e.target);
      if (name) handleChange(name);
    };
    const onFocusOut = (e: Event) => {
      if (!inForm(e.target)) return;
      const name = nameOf(e.target);
      if (name) handleBlur(name);
    };

    window.addEventListener("input", onInput);
    window.addEventListener("change", onInput);
    window.addEventListener("focusout", onFocusOut);
    return () => {
      window.removeEventListener("input", onInput);
      window.removeEventListener("change", onInput);
      window.removeEventListener("focusout", onFocusOut);
    };
  }, [handleChange, handleBlur]);

  /**
   * Optional sugar for one input: the accessibility attributes, mainly.
   * The change/blur wiring above already covers every named field, so this is
   * about `aria-invalid` and `aria-describedby` rather than behaviour.
   */
  const fieldProps = useCallback(
    (name: string) => {
      const message = messageFor(name);
      return {
        name,
        "aria-invalid": message ? (true as const) : undefined,
        "aria-describedby": message ? errorId(name) : undefined,
      };
    },
    [messageFor],
  );

  /** Spread onto <FieldError>. */
  const errorProps = useCallback(
    (name: string) => ({ id: errorId(name), message: messageFor(name) }),
    [messageFor],
  );

  // Scroll to the first thing that is wrong. A duty form is taller than a
  // phone screen, so an error on the start date is invisible to someone who
  useEffect(() => {
    const hasFieldErrors = Boolean(serverErrors && Object.keys(serverErrors).length > 0);
    const hasFormMessage = Boolean(state?.message);
    if (!hasFieldErrors && !hasFormMessage) return;

    const form = formRef.current;
    if (!form) return;

    const target = hasFieldErrors
      ? firstInvalidControl(form, serverErrors!)
      : form;

    if (!target) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Deferred slightly so React has rendered the error messages and laid out the
    // updated height before calculating the scroll target position.
    const timer = setTimeout(() => {
      target.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: hasFieldErrors ? "center" : "start",
      });
      // Never pull focus from a control the officer is already using. The
      // error arrives ~a round trip after submit; by then they may have
      // tapped a date input, and stealing focus mid-open closed the native
      // picker straight away — the "frozen date picker".
      const active = typeof document !== "undefined" ? document.activeElement : null;
      const busyElsewhere =
        active !== null &&
        active !== target &&
        active !== document.body &&
        form.contains(active) &&
        /^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName);
      if (hasFieldErrors && !busyElsewhere) {
        try {
          target.focus({ preventScroll: true });
        } catch {}
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [serverErrors, state?.message]);

  return {
    formRef,
    fieldProps,
    errorProps,
    messageFor,
    /** The whole-form message, for a banner above the fields. */
    formMessage: state?.message,
    hasErrors: Boolean(serverErrors && Object.keys(serverErrors).length > 0),
  };
}

/** Stable id linking an input to its message via aria-describedby. */
export function errorId(name: string): string {
  return `err-${name.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

/** Two message lists say the same thing (both absent counts as equal). */
export function sameMessages(a?: readonly string[], b?: readonly string[]): boolean {
  const x = a ?? [];
  const y = b ?? [];
  return x.length === y.length && x.every((m, i) => m === y[i]);
}

function withOut(set: Set<string>, name: string): Set<string> {
  if (!set.has(name)) return set;
  const next = new Set(set);
  next.delete(name);
  return next;
}

/**
 * The first control with an error, in DOM ORDER.
 *
 * Not the first key of the error object: that follows the schema's field
 * order, which need not match what the officer sees on screen. Exported for
 * its own test.
 */
export function firstInvalidControl(
  form: HTMLFormElement,
  errors: FieldErrors,
): HTMLElement | null {
  const named = form.querySelectorAll<HTMLElement>("[name]");

  for (const el of Array.from(named)) {
    const name = el.getAttribute("name");
    if (!name || !errors[name]?.length) continue;

    // A hidden input cannot be focused or scrolled to. FormSelect keeps its
    // value on one, so fall back to the control the officer actually clicks.
    //
    // Checked by attribute rather than `instanceof HTMLInputElement`: that
    // throws outright wherever the DOM globals are absent, which is both the
    // test environment and any server-side call.
    const isHiddenInput =
      el.tagName === "INPUT" &&
      (el.getAttribute("type") ?? "").toLowerCase() === "hidden";

    if (isHiddenInput) {
      const escaped =
        typeof CSS !== "undefined" && typeof CSS.escape === "function"
          ? CSS.escape(name)
          : name.replace(/["\\]/g, "\\$&");
      // `[data-field]` only. `#id` was also matched here, and it resolved to
      // the hidden input itself — FormSelect puts the id on the hidden input,
      // not on the trigger — so the scroll target was something invisible and
      // the page never moved.
      const visible = form.querySelector<HTMLElement>(`[data-field="${escaped}"]`);
      if (visible) return visible;
      continue;
    }

    return el;
  }

  return null;
}
