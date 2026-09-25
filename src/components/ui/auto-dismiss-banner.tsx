"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

/**
 * A short-lived status message that clears itself.
 *
 * There is no toast library in this project and none is being added for one
 * banner. What existed instead: the holiday importer's success message set
 * state and never cleared it, so "Successfully synchronized 27 …" stayed on
 * screen until the next navigation; and two flows used `window.alert()`, which
 * blocks the page and cannot be styled.
 *
 * Hovering pauses the countdown — a message that vanishes while being read is
 * worse than one that lingers.
 */
export type BannerTone = "success" | "error" | "info";

const TONES: Record<BannerTone, { wrap: string; icon: React.ElementType }> = {
  success: {
    wrap: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    icon: CheckCircle2,
  },
  error: {
    wrap: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    icon: AlertCircle,
  },
  info: {
    wrap: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    icon: Info,
  },
};

export function AutoDismissBanner({
  message,
  tone = "success",
  autoHideMs = 4000,
  onDismiss,
}: {
  /** Null hides the banner. Changing it restarts the countdown. */
  message: string | null;
  tone?: BannerTone;
  /** 0 disables auto-hide, for a message that must be acknowledged. */
  autoHideMs?: number;
  onDismiss?: () => void;
}) {
  // Which message was dismissed, rather than a boolean reset by an effect —
  // a new message is automatically visible again because it is a different
  // string, so there is nothing to synchronise.
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const dismissRef = useRef(onDismiss);

  // Assigned in an effect, not during render: a render may be discarded, and
  // writing to a ref while rendering makes that write observable anyway.
  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  const visible = message !== null && message !== dismissed;

  const hide = useCallback((m: string) => {
    setDismissed(m);
    dismissRef.current?.();
  }, []);

  useEffect(() => {
    if (!message || !visible || paused || autoHideMs <= 0) return;
    const t = setTimeout(() => hide(message), autoHideMs);
    return () => clearTimeout(t);
  }, [message, visible, paused, autoHideMs, hide]);

  if (!visible || !message) return null;

  const { wrap, icon: Icon } = TONES[tone];

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={`flex items-start gap-2.5 rounded-2xl border p-3.5 text-xs duration-200 animate-in fade-in-0 ${wrap}`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={() => hide(message)}
        aria-label="Dismiss"
        className="shrink-0 cursor-pointer rounded-lg p-0.5 opacity-70 transition-opacity hover:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
