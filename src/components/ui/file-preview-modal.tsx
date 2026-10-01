"use client";

import { useState, useEffect } from "react";
import { X, ZoomIn, ZoomOut, Download, ExternalLink, FileText } from "lucide-react";
import { ModalPortal, MODAL_Z } from "./modal-portal";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import { useModalBackClose } from "@/lib/hooks/useModalBackClose";

export interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  fileUrl: string;
  mimeType?: string;
  fileSize?: number;
}

export function FilePreviewModal({
  isOpen,
  onClose,
  fileName,
  fileUrl,
  mimeType = "",
  fileSize,
}: FilePreviewModalProps) {
  const [zoom, setZoom] = useState(1);

  useBodyScrollLock(isOpen);
  useModalBackClose(isOpen, onClose);

  // Each new file opens at 1x rather than inheriting the last one's zoom.
  useEffect(() => {
    if (isOpen) setZoom(1);
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isImage =
    mimeType.startsWith("image/") ||
    /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(fileName) ||
    /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(fileUrl);

  const formatSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <ModalPortal>
    <div
      onClick={onClose}
      className={`fixed inset-0 ${MODAL_Z} flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in-0 duration-200 print:hidden`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex flex-col w-full max-w-4xl max-h-[90vh] rounded-2xl bg-card border border-border shadow-2xl overflow-hidden"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/40 backdrop-blur-xs">
          <div className="flex items-center gap-2.5 truncate">
            {isImage ? (
              <div className="size-2 rounded-full bg-sky-500 animate-pulse" />
            ) : (
              <FileText className="size-4 text-indigo-500 shrink-0" />
            )}
            <div className="flex flex-col truncate">
              <span className="text-sm font-bold text-foreground truncate">
                {fileName}
              </span>
              {fileSize && (
                <span className="text-[11px] text-muted-foreground">
                  {formatSize(fileSize)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom is more useful on a small screen, not less — the controls
                were hidden below `sm`, where the image is hardest to read. */}
            {isImage && (
              <div className="flex items-center gap-1 bg-muted/70 rounded-xl p-1 border border-border">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  className="p-1 rounded-lg hover:bg-card text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="size-3.5" />
                </button>
                <span className="text-[11px] font-mono px-1.5 text-muted-foreground">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                  className="p-1 rounded-lg hover:bg-card text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="size-3.5" />
                </button>
              </div>
            )}

            <a
              href={fileUrl}
              download={fileName}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted shadow-2xs transition-colors"
              title="Download File"
            >
              <Download className="size-3.5 text-indigo-500" />
              <span className="hidden sm:inline">Download</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Close Preview"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="flex-1 flex items-center justify-center p-6 overflow-auto bg-slate-950/40 min-h-[300px]">
          {isImage ? (
            <div className="overflow-auto max-h-[70vh] flex items-center justify-center w-full">
              <img
                src={fileUrl}
                alt={fileName}
                style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
                className="max-h-[65vh] max-w-full object-contain rounded-xl shadow-lg transition-transform duration-150"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 space-y-4 max-w-md">
              <div className="size-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                <FileText className="size-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-foreground">{fileName}</h4>
                <p className="text-xs text-muted-foreground">
                  Document files can be opened in a new tab or downloaded for full viewing.
                </p>
              </div>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 hover:bg-indigo-500 transition-colors"
              >
                <ExternalLink className="size-3.5" />
                <span>Open in New Tab</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
