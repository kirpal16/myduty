"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Check, Monitor, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __pwaInstallPrompt: BeforeInstallPromptEvent | null;
  }
}

type Status = "idle" | "ready" | "installed" | "ios";

export function PwaInstallButton({
  variant = "header",
  className = "",
}: {
  variant?: "header" | "hero" | "sidebar" | "banner" | "plain";
  className?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [showTip, setShowTip] = useState(false);
  const tipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Check if already running as installed PWA
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    ) {
      setStatus("installed");
      return;
    }

    // Detect iOS (no beforeinstallprompt support)
    const ua = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setStatus("ios");
      return;
    }

    // Check if the global event was already captured before React hydrated
    if (window.__pwaInstallPrompt) {
      setStatus("ready");
    }

    // Also listen for it if it fires later
    const onReady = () => setStatus("ready");
    const onInstalled = () => setStatus("installed");

    window.addEventListener("pwa-prompt-ready", onReady);
    window.addEventListener("pwa-installed", onInstalled);

    return () => {
      window.removeEventListener("pwa-prompt-ready", onReady);
      window.removeEventListener("pwa-installed", onInstalled);
      if (tipTimeout.current) clearTimeout(tipTimeout.current);
    };
  }, []);

  const handleClick = async () => {
    if (status === "installed") return;

    const prompt = window.__pwaInstallPrompt;

    if (prompt) {
      // Directly trigger the browser's native install dialog — no custom popup
      try {
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === "accepted") {
          setStatus("installed");
          window.__pwaInstallPrompt = null;
        }
      } catch {
        showInstallTip();
      }
    } else {
      // No prompt available — show a small non-blocking tip
      showInstallTip();
    }
  };

  const showInstallTip = () => {
    setShowTip(true);
    if (tipTimeout.current) clearTimeout(tipTimeout.current);
    tipTimeout.current = setTimeout(() => setShowTip(false), 7000);
  };

  const isInstalled = status === "installed";
  const isReady = status === "ready";

  return (
    <>
      {/* Non-blocking install tip — appears at bottom, auto-hides */}
      {showTip && (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 z-[999] -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm animate-in slide-in-from-bottom-4 duration-300"
        >
          <div className="flex items-start gap-3 rounded-2xl border border-amber-400/40 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-xl text-sm text-white">
            {status === "ios" ? (
              <>
                <Smartphone className="mt-0.5 size-5 shrink-0 text-amber-300" />
                <div>
                  <p className="font-semibold text-amber-200 mb-0.5">Add to Home Screen</p>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    Tap the <strong>Share ⬆</strong> button in Safari, then choose{" "}
                    <strong>&ldquo;Add to Home Screen&rdquo;</strong>.
                  </p>
                </div>
              </>
            ) : (
              <>
                <Monitor className="mt-0.5 size-5 shrink-0 text-amber-300" />
                <div>
                  <p className="font-semibold text-amber-200 mb-0.5">Install My Duty App</p>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    Look for the <strong>install icon ⊕</strong> in your browser&apos;s address
                    bar, or open the browser menu → <strong>&ldquo;Install App&rdquo;</strong>.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Header Variant ── */}
      {variant === "header" && (
        <button
          type="button"
          onClick={handleClick}
          disabled={isInstalled}
          className={`group flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all shadow-sm backdrop-blur-md cursor-pointer disabled:cursor-default
            ${isInstalled
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-600/20 text-amber-200 hover:border-amber-400/50 hover:bg-amber-500/25 hover:text-white shadow-amber-500/10"
            } ${className}`}
          aria-label={isInstalled ? "App installed" : "Install My Duty App"}
        >
          <span className={`flex size-5 items-center justify-center rounded-md transition-transform group-hover:scale-110 ${isInstalled ? "bg-emerald-500/20" : "bg-amber-500/20 text-amber-300"}`}>
            {isInstalled
              ? <Check className="size-3.5 text-emerald-400" />
              : <Download className="size-3.5" />
            }
          </span>
          <span>{isInstalled ? "Installed" : isReady ? "Install App" : "Download App"}</span>
        </button>
      )}

      {/* ── Hero Variant ── */}
      {variant === "hero" && (
        <button
          type="button"
          onClick={handleClick}
          disabled={isInstalled}
          className={`group flex items-center justify-center gap-2.5 rounded-xl border px-6 py-3.5 text-base font-semibold transition-all shadow-lg backdrop-blur-md cursor-pointer hover:scale-[1.02] disabled:scale-100 disabled:cursor-default
            ${isInstalled
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-amber-500/40 bg-gradient-to-r from-amber-600/30 via-yellow-500/20 to-amber-700/30 text-amber-100 hover:text-white hover:border-amber-400/60 hover:bg-amber-600/40 shadow-amber-950/40"
            } ${className}`}
          aria-label={isInstalled ? "App installed" : "Install My Duty App"}
        >
          <span className={`flex size-6 items-center justify-center rounded-lg transition-transform group-hover:scale-110 ${isInstalled ? "bg-emerald-400/20" : "bg-amber-400/20 text-amber-300"}`}>
            {isInstalled
              ? <Check className="size-4 text-emerald-400" />
              : <Download className="size-4" />
            }
          </span>
          <span>
            {isInstalled ? "App Installed" : isReady ? "Install My Duty App" : "Download My Duty App"}
          </span>
        </button>
      )}

      {/* ── Plain Variant ──
          A quiet, full-width button for the sign-in and sign-up cards: a
          download icon and a label, nothing else. It inherits the surrounding
          card's colours rather than the amber treatment the marketing pages
          use, because on an auth screen this is a utility, not a promotion. */}
      {variant === "plain" && (
        <button
          type="button"
          onClick={handleClick}
          disabled={isInstalled}
          className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-slate-700 hover:bg-slate-900 hover:text-white disabled:cursor-default disabled:opacity-70 ${className}`}
          aria-label={isInstalled ? "App already installed" : "Install app"}
        >
          {isInstalled ? (
            <Check className="size-4 text-emerald-400" />
          ) : (
            <Download className="size-4" />
          )}
          <span>{isInstalled ? "App installed" : "Install app"}</span>
        </button>
      )}

      {/* ── Sidebar Variant ── */}
      {variant === "sidebar" && (
        <button
          type="button"
          onClick={handleClick}
          className={`w-full flex items-center justify-between rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-indigo-950/40 px-3 py-2 text-xs font-medium text-amber-200 hover:border-amber-500/50 hover:bg-amber-500/20 hover:text-white transition-all duration-200 cursor-pointer ${className}`}
          aria-label="Install My Duty App"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex size-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300">
              {isInstalled ? <Check className="size-3.5 text-emerald-400" /> : <Download className="size-3.5" />}
            </div>
            <div className="flex flex-col text-left">
              <span className="font-semibold text-slate-200 text-xs">
                {isInstalled ? "App Installed" : isReady ? "Install App" : "Download App"}
              </span>
              <span className="text-[10px] text-amber-300/80">
                {isInstalled ? "Installed on this device" : "Add to Home Screen"}
              </span>
            </div>
          </div>
        </button>
      )}
    </>
  );
}
