"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Loader2, FileText, Image as ImageIcon, File, AlertCircle } from "lucide-react";
import { ModalPortal, MODAL_Z } from "@/components/ui/modal-portal";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import { useModalBackClose } from "@/lib/hooks/useModalBackClose";

export interface EditFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: {
    id: string;
    original_filename: string;
    description?: string | null;
    mime_type?: string;
    size_bytes?: number;
  };
  onUpdated?: (updated: {
    id: string;
    original_filename: string;
    description: string | null;
  }) => void;
}

function parseFilename(filename: string) {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot > 0) {
    return {
      baseName: filename.slice(0, lastDot),
      ext: filename.slice(lastDot + 1),
    };
  }
  return { baseName: filename, ext: "" };
}

function formatFileSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EditFileModal({
  isOpen,
  onClose,
  file,
  onUpdated,
}: EditFileModalProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const parsed = parseFilename(file.original_filename);
  const [baseName, setBaseName] = useState(parsed.baseName);
  const [description, setDescription] = useState(file.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useBodyScrollLock(isOpen);
  useModalBackClose(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      const p = parseFilename(file.original_filename);
      setBaseName(p.baseName);
      setDescription(file.description ?? "");
      setError(null);
      setIsSaving(false);
    }
  }, [isOpen, file]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSaving) onClose();
    }
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSaving, onClose]);

  if (!isOpen) return null;

  const isImage = file.mime_type?.startsWith("image/");
  const isPdf = file.mime_type?.includes("pdf");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = baseName.trim();
    if (!trimmedName) {
      setError("Document name cannot be empty.");
      return;
    }

    const ext = parsed.ext;
    let finalFilename = trimmedName;
    if (ext) {
      if (!new RegExp(`\\.${ext}$`, "i").test(trimmedName)) {
        finalFilename = `${trimmedName}.${ext}`;
      }
    }

    setError(null);
    setIsSaving(true);

    try {
      const res = await fetch(`/api/storage/${file.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original_filename: finalFilename,
          description: description.trim() || null,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "Failed to save file changes.");
        setIsSaving(false);
        return;
      }

      const updatedFilename = data?.file?.original_filename ?? finalFilename;
      const updatedDescription = data?.file?.description ?? (description.trim() || null);

      if (onUpdated) {
        onUpdated({
          id: file.id,
          original_filename: updatedFilename,
          description: updatedDescription,
        });
      }

      startTransition(() => {
        router.refresh();
      });

      onClose();
    } catch {
      setError("Network error. Please check your connection and try again.");
      setIsSaving(false);
    }
  }

  return (
    <ModalPortal>
      <div
        onClick={() => {
          if (!isSaving) onClose();
        }}
        className={`fixed inset-0 ${MODAL_Z} flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in-0 duration-150 print:hidden`}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-file-modal-title"
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg rounded-3xl bg-card border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-border bg-muted/40 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                <Pencil className="size-5" />
              </div>
              <div>
                <h3
                  id="edit-file-modal-title"
                  className="text-base font-bold text-foreground"
                >
                  Edit Document Details
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Update the file name and description for this record.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="p-1.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
              title="Close modal"
            >
              <X className="size-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* File Quick Info Badge */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/30 border border-border/70 text-xs">
              <div className="size-9 rounded-xl overflow-hidden flex items-center justify-center bg-card border border-border shrink-0">
                {isImage ? (
                  <img
                    src={`/api/storage/${file.id}`}
                    alt={file.original_filename}
                    className="size-full object-cover"
                  />
                ) : isPdf ? (
                  <FileText className="size-4 text-rose-500" />
                ) : (
                  <File className="size-4 text-indigo-500" />
                )}
              </div>
              <div className="min-w-0 flex-1 truncate">
                <p className="font-semibold text-foreground truncate">
                  {file.original_filename}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {file.size_bytes ? formatFileSize(file.size_bytes) : "Vault File"}
                  {parsed.ext ? ` • .${parsed.ext.toUpperCase()} File` : ""}
                </p>
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {/* Document Name */}
            <div className="space-y-1.5">
              <label
                htmlFor="edit-file-name"
                className="text-xs font-bold text-foreground flex items-center justify-between"
              >
                <span>Document Name</span>
                {parsed.ext && (
                  <span className="text-[11px] font-normal text-muted-foreground">
                    Extension automatically preserved
                  </span>
                )}
              </label>

              <div className="relative flex items-center rounded-2xl border border-border bg-background focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all overflow-hidden shadow-2xs">
                <input
                  id="edit-file-name"
                  type="text"
                  value={baseName}
                  onChange={(e) => setBaseName(e.target.value)}
                  placeholder="Enter file name..."
                  disabled={isSaving}
                  required
                  maxLength={200}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-transparent text-foreground placeholder:text-muted-foreground/60 outline-none disabled:opacity-50"
                />
                {parsed.ext && (
                  <span className="px-3 py-1 mr-2 text-[11px] font-bold font-mono text-muted-foreground bg-muted rounded-xl border border-border shrink-0 select-none">
                    .{parsed.ext}
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="edit-file-desc"
                  className="text-xs font-bold text-foreground"
                >
                  Description <span className="font-normal text-muted-foreground">(Optional)</span>
                </label>
                <span className="text-[11px] text-muted-foreground">
                  {description.length} / 1000
                </span>
              </div>

              <textarea
                id="edit-file-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add notes, context, or details about this document..."
                disabled={isSaving}
                rows={3}
                maxLength={1000}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-2xl border border-border bg-background text-foreground placeholder:text-muted-foreground/60 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all resize-none shadow-2xs disabled:opacity-50"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
              <button
                type="button"
                disabled={isSaving}
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md shadow-amber-600/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Pencil className="size-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
