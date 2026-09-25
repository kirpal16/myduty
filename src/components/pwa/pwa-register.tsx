"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";

/**
 * Registers the service worker and offers the update rather than forcing it.
 *
 * The worker no longer calls skipWaiting() on install, so a new version sits
 * in "waiting" until this component tells it to take over. That ordering is
 * the point: activating immediately would swap the worker underneath a page
 * still running the previous JavaScript bundle, which can then fail to load a
 * code chunk the new deploy removed — and it would happen without warning,
 * mid-form, on a duty entry holding a lot of typing.
 *
 * So: the banner appears, nothing changes until it is tapped, and only then
 * does the page reload.
 */
export function PwaRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [reloading, setReloading] = useState(false);
  const reloadedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Never run a service worker in development. It caches assets Next is
    // actively rebuilding, which shows up as changes that "don't take" until
    // storage is cleared by hand.
    //
    // Cleaning up a worker left over from an earlier session has to be done in
    // one go. `unregister()` alone does not release the page it is already
    // controlling, so that page keeps having its navigations proxied by a
    // worker that is being torn down — which aborts the response mid-stream
    // and shows up server-side as "The destination stream closed early",
    // repeating on every navigation. Dropping its caches and reloading once
    // leaves the page uncontrolled and ends it.
    if (process.env.NODE_ENV !== "production") {
      void (async () => {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          if (regs.length > 0) {
            await Promise.all(regs.map((reg) => reg.unregister()));
          }
          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }
        } catch (e) {
          console.warn("[PWA] dev service worker cleanup failed:", e);
        }
      })();
      return;
    }

    let cancelled = false;
    let updateTimer: ReturnType<typeof setInterval> | undefined;

    const onRegistered = (reg: ServiceWorkerRegistration) => {
      if (cancelled) return;

      // A new worker was already waiting when the page loaded.
      if (reg.waiting && navigator.serviceWorker.controller) {
        setWaiting(reg.waiting);
      }

      // …or one arrives while the page is open.
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          // `controller` distinguishes an update from the very first install:
          // on a first install there is no old version to interrupt.
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            setWaiting(installing);
          }
        });
      });

      // Browsers only check for a new worker on navigation, so a long-lived
      // session would never notice one. An hourly check costs a conditional
      // request against a no-store script.
      //
      // Assigned to the outer variable rather than returned: this runs inside
      // a .then() callback, so a returned cleanup would be silently discarded
      // and the interval would outlive the component.
      updateTimer = setInterval(() => void reg.update(), 60 * 60 * 1000);
    };

    navigator.serviceWorker
      .register("/sw.js")
      .then(onRegistered)
      .catch((err) => console.warn("[PWA] registration failed:", err));

    // Fires once the new worker takes control, which is our cue to reload.
    const onControllerChange = () => {
      if (reloadedRef.current) return;
      reloadedRef.current = true;
      try {
        if (sessionStorage.getItem("pwa_reloaded")) return;
        sessionStorage.setItem("pwa_reloaded", "true");
      } catch {}
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      cancelled = true;
      if (updateTimer) clearInterval(updateTimer);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (!waiting) return;
    setReloading(true);
    // The reload happens in the controllerchange handler above, once the new
    // worker has actually taken over — reloading before that would just load
    // the old version again.
    waiting.postMessage({ type: "SKIP_WAITING" });
  }, [waiting]);

  if (!waiting) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-[120] flex justify-center p-3 sm:p-4 print:hidden"
    >
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-indigo-500/40 bg-slate-900/95 p-3 text-slate-100 shadow-2xl backdrop-blur-md">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300">
          <RefreshCw className="size-4" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold">A new version is available</p>
          <p className="text-[11px] text-slate-400">
            Reload when you&apos;re ready — nothing you&apos;ve typed is lost
            until you do.
          </p>
        </div>

        <button
          type="button"
          onClick={applyUpdate}
          disabled={reloading}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
        >
          {reloading ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              <span>Updating…</span>
            </>
          ) : (
            <span>Reload</span>
          )}
        </button>
      </div>
    </div>
  );
}
