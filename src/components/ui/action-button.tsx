"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "./toast";

/**
 * A one-click server action, with feedback.
 *
 * Approve, reject, toggle, delete: twenty actions with no field to attach a
 * message to. They still throw, and a throw from a `<form action={...}>` in a
 * server component replaces the entire page with the error boundary — so a
 * failed toggle looked like the app had crashed, and a SUCCESSFUL one looked
 * like nothing had happened at all.
 *
 * Calling the action from a client component instead means the throw can be
 * caught, the page survives, and both outcomes say so.
 *
 * A caveat worth knowing: Next sanitises server-side error messages in
 * production, so a genuine failure may toast a generic line rather than the
 * action's own wording. Success messages are always exact. Making failures
 * exact too means having those actions RETURN a message instead of throwing,
 * which is a larger change to twenty call sites.
 */
export function ActionButton({
  action,
  children,
  className = "",
  successMessage,
  pendingLabel,
  confirm,
  title,
  "aria-label": ariaLabel,
}: {
  /** A server action, pre-bound with its arguments. */
  action: () => Promise<void> | void;
  children: React.ReactNode;
  className?: string;
  successMessage?: string;
  pendingLabel?: string;
  /** Asks first. For anything destructive. */
  confirm?: string;
  title?: string;
  "aria-label"?: string;
}) {
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const run = () => {
    if (confirm && !window.confirm(confirm)) return;

    startTransition(async () => {
      try {
        await action();
        if (successMessage) toast(successMessage);
      } catch (error) {
        toast(messageFor(error), "error");
      }
    });
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      title={title}
      aria-label={ariaLabel}
      aria-busy={pending}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? (
        <>
          <Loader2 className="size-3 animate-spin" />
          {pendingLabel && <span>{pendingLabel}</span>}
        </>
      ) : (
        children
      )}
    </button>
  );
}

function messageFor(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  // Next's production placeholder is not worth showing to an officer.
  if (!raw || /server components render|an error occurred/i.test(raw)) {
    return "That did not work. Please try again.";
  }
  return raw;
}
