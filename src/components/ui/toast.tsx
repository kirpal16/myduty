"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { ModalPortal } from "./modal-portal";
import type { BannerTone } from "./auto-dismiss-banner";

/**
 * Short-lived confirmations, floating above the page.
 *
 * The gap this fills: a successful save that does not navigate was completely
 * silent. Pressing Save on a leave entitlement, a settings panel or an admin
 * create left the screen exactly as it was, so "it worked" and "nothing
 * happened" looked identical.
 *
 * `AutoDismissBanner` already solved the same problem inline, and this reuses
 * its vocabulary deliberately — the same `BannerTone`, the same hover-to-pause,
 * the same `aria-live` politeness. The one difference is placement: a fixed,
 * portalled stack rather than a block in the layout, so a save at the bottom
 * of a long form is visible without scrolling back up. The banner stays where
 * it is; this does not replace it.
 */

const TONES: Record<BannerTone, { wrap: string; icon: React.ElementType }> = {
  success: {
    wrap: "border-emerald-500/30 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    icon: CheckCircle2,
  },
  error: {
    wrap: "border-rose-500/30 bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
    icon: AlertCircle,
  },
  info: {
    wrap: "border-sky-500/30 bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
    icon: Info,
  },
};

/**
 * Four seconds (4s auto-dismiss). Pauses on hover and carries a close button.
 */
const DEFAULT_DURATION_MS = 4000;

type Toast = {
  id: number;
  message: string;
  tone: BannerTone;
  durationMs: number;
};

type ToastContextValue = {
  toast: (message: string, tone?: BannerTone, durationMs?: number) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>.");
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: BannerTone = "success", durationMs = DEFAULT_DURATION_MS) => {
      // Called from event handlers and action callbacks, never during render,
      // so a plain setState is safe here.
      setToasts((prev) => [...prev, { id: nextId.current++, message, tone, durationMs }]);
    },
    [],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <ModalPortal>
          {/* Bottom on a phone where thumbs are, bottom-right on a desktop.
              pointer-events-none on the stack so a toast never blocks a click
              on whatever is underneath it; the toasts themselves opt back in. */}
          <div
            aria-live="polite"
            aria-atomic="false"
            className="pointer-events-none fixed inset-x-0 bottom-0 z-[150] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
          >
            {toasts.map((t) => (
              <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
            ))}
          </div>
        </ModalPortal>
      )}
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const [paused, setPaused] = useState(false);
  const { wrap, icon: Icon } = TONES[toast.tone];

  useEffect(() => {
    if (paused || toast.durationMs <= 0) return;
    const timer = setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => clearTimeout(timer);
    // Re-running on `paused` restarts the full duration rather than resuming
    // the remainder. Deliberate: someone who hovered was reading it, and
    // giving them the whole three seconds back is the kinder rounding.
  }, [paused, toast.durationMs, toast.id, onDismiss]);

  return (
    <div
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-2xl border p-3.5 text-xs font-medium shadow-lg backdrop-blur-sm animate-in fade-in-0 slide-in-from-bottom-2 duration-200 sm:text-sm ${wrap}`}
    >
      <Icon aria-hidden className="mt-px size-4 shrink-0" />
      <span className="flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="shrink-0 cursor-pointer rounded-lg p-0.5 opacity-60 transition-opacity hover:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
