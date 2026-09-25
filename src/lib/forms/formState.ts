/**
 * One shape for what a form submission returns, and one way to flatten Zod
 * issues into it.
 *
 * This existed three times over — `LeaveFormState`, `DutyFormState` and
 * `AuthFormState` were independent declarations of the same object, and the
 * flattener was copy-pasted into `leave.ts`, `duty.ts` and `auth.ts` (the
 * third spelled `z2fieldErrors`). Three copies is how the per-day bug below
 * survived in all of them at once.
 */

export type FieldErrors = Record<string, string[]>;

export type FormState =
  | {
      /** Keyed by field name, matching the `name` attribute on the input. */
      errors?: FieldErrors;
      /** A whole-form message: a conflict, a permission problem, a failed RPC. */
      message?: string;
      /** Set on a successful non-redirecting save, so the caller can toast. */
      ok?: boolean;
    }
  | undefined;

type IssueLike = { path: PropertyKey[]; message: string };

/**
 * Zod issues, keyed by field.
 *
 * Nested paths keep their FULL dotted key -- `perDay.2.taAmount`, not
 * `perDay`. The old version took `path[0]` only, so every per-day error in a
 * multi-day duty collapsed onto the key "perDay", which no form rendered:
 * a bad travelling allowance on day three failed silently and the officer
 * was never told why the submit did nothing.
 *
 * The first segment is also recorded, so a form that only knows about the
 * parent field still has something to show.
 */
export function fieldErrors(error: { issues: IssueLike[] }): FieldErrors {
  const out: FieldErrors = {};

  for (const issue of error.issues) {
    if (issue.path.length === 0) {
      (out.form ??= []).push(issue.message);
      continue;
    }

    const full = issue.path.map(String).join(".");
    (out[full] ??= []).push(issue.message);

    // Fallback key for callers that render the parent only. Skipped when the
    // path is already a single segment, or the message would appear twice.
    const first = String(issue.path[0]);
    if (first !== full) {
      (out[first] ??= []).push(issue.message);
    }
  }

  return out;
}

/** A whole-form failure with no particular field to blame. */
export function failed(message: string): FormState {
  return { message };
}

/** A field-level failure. */
export function invalid(errors: FieldErrors, message?: string): FormState {
  return message ? { errors, message } : { errors };
}

/**
 * A successful save that does NOT redirect.
 *
 * `ok` is what lets a client form tell "saved" apart from "not submitted
 * yet" -- both of which are otherwise an undefined state.
 */
export function succeeded(message?: string): FormState {
  return message ? { ok: true, message } : { ok: true };
}
