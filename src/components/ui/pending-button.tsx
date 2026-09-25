"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

/**
 * A submit button that disables itself and shows a spinner while its form's
 * Server Action is running.
 *
 * `SubmitButton` already does this, but it imposes its own four variants —
 * which is the wrong tool for the many bespoke buttons already styled inline
 * across the admin screens. This keeps whatever `className` the button
 * already had and only swaps its icon for a spinner, so adding feedback to an
 * existing button is a one-line change that cannot alter its appearance.
 *
 * Must be rendered INSIDE the <form> it belongs to: useFormStatus reads the
 * nearest enclosing form, and returns `pending: false` forever if it is
 * rendered as a sibling.
 */
export function PendingButton({
  children,
  className = "",
  pendingLabel,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Replaces the label while submitting. Omit to keep the original text. */
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap flex-nowrap ${className} disabled:cursor-not-allowed disabled:opacity-60`}
      {...props}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 shrink-0 animate-spin" />
          {pendingLabel !== undefined ? (
            <span className="truncate whitespace-nowrap">{pendingLabel}</span>
          ) : (
            <span className="inline-flex items-center gap-2 whitespace-nowrap flex-nowrap truncate">{children}</span>
          )}
        </>
      ) : (
        children
      )}
    </button>
  );
}
