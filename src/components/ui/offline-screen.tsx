"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { WifiOff, RefreshCw, Loader2 } from "lucide-react";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";

/**
 * Tells the officer, on any screen, that the connection has gone.
 *
 * There was already an `/offline` page, but it only ever appeared when the
 * service worker caught a failed *navigation* — production only, and only if
 * you happened to tap a link. Sitting on a page while the signal dropped
 * showed nothing at all; the next action just failed silently.
 *
 * Every screen in this app reads live data, so an offline session cannot do
 * anything useful and a blocking screen is honest rather than obstructive.
 */

/**
 * `navigator.onLine` only knows whether a network interface is up. Connected
 * to a router with no internet, or to a captive portal, it still reports true
 * — and reports false in some VPN and mobile-handover cases where the
 * connection is fine. So it is used as the trigger to *check*, never as the
 * answer, and the answer comes from an actual request.
 */
/**
 * When the last probe ran. Module scope so it survives re-renders and
 * remounts, and so two triggers landing together only cost one request.
 */
let lastProbeAt = 0;
const PROBE_INTERVAL_MS = 15_000;

async function reallyOnline(): Promise<boolean> {
  try {
    // The manifest is small, same-origin and always present. cache: "no-store"
    // so a cached copy cannot answer for the network.
    const res = await fetch("/manifest.webmanifest", {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * The browser's own flag, read through useSyncExternalStore rather than mirrored
 * into state by an effect — the value already lives outside React, so copying it
 * in would mean an extra render and a setState during an effect.
 *
 * The server has no network status to report, so it assumes online: rendering a
 * "no connection" screen into the HTML would be wrong far more often than right.
 */
function subscribeToConnection(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function OfflineScreen() {
  const browserOnline = useSyncExternalStore(
    subscribeToConnection,
    () => navigator.onLine,
    () => true,
  );
  const [verifiedOffline, setVerifiedOffline] = useState(false);
  const [checking, setChecking] = useState(false);

  // The browser reporting offline is taken at face value; reporting online is
  // only a hint, because it cannot see past the router.
  const offline = !browserOnline || verifiedOffline;

  // Nothing behind this should scroll while it is up.
  useBodyScrollLock(offline);

  /**
   * The manual retry. It shows a spinner, so it touches `checking` — which is
   * why it is kept out of the effects below: `setChecking(true)` runs
   * synchronously, and a synchronous state write inside an effect body costs
   * an extra render pass.
   */
  const retry = useCallback(async () => {
    setChecking(true);
    const ok = await reallyOnline();
    setVerifiedOffline(!ok);
    setChecking(false);
    return ok;
  }, []);

  /**
   * Verify whenever the browser claims to be online, and again when the
   * officer returns to the tab.
   *
   * The visibility check catches what `navigator.onLine` cannot see: the phone
   * stayed joined to an access point with no route out, so no `offline` event
   * ever fired and the session looked healthy while every action failed.
   *
   * Throttled to one probe per 15s, and NOT listening for `focus`. Both were
   * needed: `focus` fires on almost any window interaction, so the two
   * listeners together produced a burst of HEAD requests for a single glance
   * at the screen. `visibilitychange` alone fires when the tab is genuinely
   * switched to, which is the moment that matters.
   */
  useEffect(() => {
    if (!browserOnline) return;
    let cancelled = false;

    const verify = (force = false) => {
      const now = Date.now();
      if (!force && now - lastProbeAt < PROBE_INTERVAL_MS) return;
      lastProbeAt = now;
      void (async () => {
        const ok = await reallyOnline();
        if (!cancelled) setVerifiedOffline(!ok);
      })();
    };

    verify(true);

    const onVisible = () => {
      if (document.visibilityState === "visible") verify();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [browserOnline]);

  // Keep testing while offline: a connection can return without the browser
  // firing `online` — signing into a captive portal, for instance.
  useEffect(() => {
    if (!offline) return;
    let cancelled = false;
    const id = setInterval(() => {
      lastProbeAt = Date.now();
      void (async () => {
        const ok = await reallyOnline();
        if (!cancelled) setVerifiedOffline(!ok);
      })();
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [offline]);

  if (!offline) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="No internet connection"
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-6 text-center text-slate-100"
    >
      <div className="flex size-16 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/80">
        <WifiOff className="size-8 text-amber-400" />
      </div>

      <h1 className="mt-6 text-xl font-bold text-white">No internet connection</h1>

      <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
        My Duty needs a connection to show your duty log, leave and holiday
        calendar. This will clear by itself the moment you reconnect.
      </p>

      <button
        type="button"
        onClick={() => void retry()}
        disabled={checking}
        className="mt-6 flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition-colors hover:bg-indigo-500 disabled:opacity-60"
      >
        {checking ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            <span>Checking…</span>
          </>
        ) : (
          <>
            <RefreshCw className="size-4" />
            <span>Try again</span>
          </>
        )}
      </button>

      <p className="mt-6 max-w-sm text-xs text-slate-500">
        Nothing is stored on this device, so no records are shown while offline
        — including on a shared phone.
      </p>
    </div>
  );
}
