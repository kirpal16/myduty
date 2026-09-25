"use client";

import { useEffect, useState } from "react";
import { HardDrive, Plus, X } from "lucide-react";
import { ModalPortal, MODAL_Z } from "@/components/ui/modal-portal";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import { FileUploader } from "./file-uploader";

/**
 * The upload form, behind a button in the page header.
 *
 * It used to be a sticky card pinned beside the list — a third of the width on
 * a desktop and the entire first screen on a phone, so the vault opened on a
 * dropzone rather than on the files. Uploading is occasional; reading the list
 * is what the page is for.
 *
 * Follows the pattern of the other two modals here (ModalPortal + MODAL_Z +
 * useBodyScrollLock + Escape) rather than adding a dialog library. The
 * uploader renders its own FilePreviewModal for image previews; both mount
 * through the same portal at MODAL_Z, so the preview — mounted later — paints
 * above this one.
 */
export function UploadModal() {
  const [isOpen, setIsOpen] = useState(false);

  useBodyScrollLock(isOpen);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-indigo-600 px-2.5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 transition-colors hover:bg-indigo-500 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm"
      >
        <Plus className="size-4 shrink-0" />
        <span>Upload</span>
      </button>

      {isOpen && (
        <ModalPortal>
          <div
            className={`fixed inset-0 ${MODAL_Z} flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in-0 duration-150`}
            onClick={() => setIsOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Upload document"
              className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-150"
              // The backdrop closes on click; a click inside must not bubble
              // up to it, or picking a file would dismiss the dialog.
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-border bg-muted/40 px-5 py-3.5">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <HardDrive className="size-4 text-sky-500" />
                    <span>Upload Document</span>
                  </h3>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Receipts, orders, or signed shift logs.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close"
                  className="cursor-pointer rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="overflow-y-auto p-5">
                {/* Closes only once the upload has succeeded — the uploader
                    shows its own error banner in here on failure. */}
                <FileUploader onUploaded={() => setIsOpen(false)} />
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
