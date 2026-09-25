import { AlertCircle } from "lucide-react";

/**
 * The validation message under an input.
 *
 * This replaces fourteen hand-written copies of the same paragraph, which had
 * already drifted apart — `text-rose-500` in the app forms, `text-rose-400` in
 * the auth ones.
 *
 * `role="alert"` matters more than the styling. Before this there was exactly
 * one `role="alert"` in the whole `src/` tree, so a screen reader was told
 * nothing when a submit came back with errors: the page simply changed and
 * the officer was left to find out why.
 *
 * Pairs with `useFormFeedback().errorProps(name)`, which supplies the `id`
 * that the input's `aria-describedby` points at.
 */
export function FieldError({
  id,
  message,
  className = "",
}: {
  id?: string;
  message?: string | null;
  className?: string;
}) {
  // Renders nothing rather than an empty element, so the space below an input
  // does not shift as messages come and go.
  if (!message) return null;

  return (
    <p
      id={id}
      role="alert"
      className={`flex items-start gap-1 text-xs text-rose-500 ${className}`}
    >
      <AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
}
