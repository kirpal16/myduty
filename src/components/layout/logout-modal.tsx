"use client";

import { useEffect, useTransition } from "react";
import { LogOut, X, Loader2 } from "lucide-react";
import { logout } from "@/actions/auth";
import { ModalPortal, MODAL_Z } from "@/components/ui/modal-portal";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import { useModalBackClose } from "@/lib/hooks/useModalBackClose";
import { useLanguage } from "@/lib/i18n/language-context";

export function LogoutModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { dictionary } = useLanguage();
  const [isPending, startTransition] = useTransition();

  useBodyScrollLock(isOpen);
  useModalBackClose(isOpen, onClose);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isPending) onClose();
    }
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPending, onClose]);

  if (!isOpen) return null;

  const handleConfirmLogout = () => {
    startTransition(async () => {
      await logout();
    });
  };

  return (
    <ModalPortal>
      <div
        onClick={() => {
          if (!isPending) onClose();
        }}
        className={`fixed inset-0 ${MODAL_Z} flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in-0 duration-150 print:hidden`}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-sm rounded-3xl bg-card border border-border shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150"
        >
          {/* Header with Logout icon & close */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0">
              <LogOut className="size-6" />
            </div>

            <button
              type="button"
              disabled={isPending}
              onClick={onClose}
              className="p-1.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Title and Description */}
          <div className="space-y-1.5">
            <h3 className="text-base sm:text-lg font-bold text-foreground">
              {dictionary.nav.confirmLogoutTitle}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {dictionary.nav.confirmLogoutDesc}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
            <button
              type="button"
              disabled={isPending}
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
            >
              {dictionary.common.cancel}
            </button>

            <button
              type="button"
              disabled={isPending}
              onClick={handleConfirmLogout}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 text-xs font-semibold text-white shadow-md shadow-rose-600/30 hover:from-rose-500 hover:to-rose-600 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>{dictionary.nav.loggingOut}</span>
                </>
              ) : (
                <>
                  <LogOut className="size-3.5" />
                  <span>{dictionary.nav.logout}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
