/**
 * The colour a leave type was given, as a dot.
 *
 * Every leave type has had a colour since migration 0022, but it reached the
 * screen in only three places — the month-grid pill, the dashboard chart, and
 * the two lists where you pick it. Everywhere an officer actually reads their
 * leave the colour was dropped, which made choosing one feel pointless.
 *
 * The swatch markup was also duplicated verbatim in two files; this is that
 * markup, once.
 */

/** Same guard as `customEventStyle` in the calendar: 6-digit hex only. */
const HEX = /^#[0-9a-fA-F]{6}$/;

export function ColorDot({
  color,
  label,
  size = "sm",
  className = "",
}: {
  color?: string | null;
  /**
   * What the colour belongs to, e.g. the leave type's name. Used for the
   * tooltip and for assistive text — a bare dot is meaningless otherwise.
   */
  label?: string;
  /** `sm` beside body text, `md` for a list's own swatch column. */
  size?: "sm" | "md";
  className?: string;
}) {
  // A missing or malformed value renders nothing rather than a grey blob:
  // an absent colour is not a colour, and a placeholder dot would imply the
  // type had been given one.
  if (!color || !HEX.test(color)) return null;

  const dimensions = size === "md" ? "size-4 rounded-md" : "size-2.5 rounded-full";

  return (
    <span
      // Decorative: the leave type's name is always beside it, so announcing
      // the colour again would just be noise to a screen reader.
      aria-hidden="true"
      // The name only, never the hex. "#3b82f6" tells an officer nothing, and
      // with no name at all a tooltip is worse than none.
      title={label ?? undefined}
      className={`inline-block shrink-0 border border-black/10 dark:border-white/15 ${dimensions} ${className}`}
      style={{ backgroundColor: color }}
    />
  );
}
