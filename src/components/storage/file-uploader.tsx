"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useRef, useEffect } from "react";
import { AutoDismissBanner } from "@/components/ui/auto-dismiss-banner";
import {
  UploadCloud,
  File,
  Loader2,
  AlertCircle,
  Eye,
  Pencil,
  Trash2,
  FileText,
} from "lucide-react";
import { FilePreviewModal } from "@/components/ui/file-preview-modal";

export function FileUploader({
  relatedEntityType = "general",
  relatedEntityId,
  onUploaded,
}: {
  relatedEntityType?: string;
  relatedEntityId?: string;
  /**
   * Fired only after a upload actually succeeds -- never on submit. The
   * dialog that hosts this uses it to close itself; closing any earlier
   * would hide the error banner below on a failed upload.
   */
  onUploaded?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  /**
   * Separate from `isPending`, and that separation is the bug fix.
   *
   * The transition used to start only AFTER `await fetch(...)` resolved, so
   * `isPending` covered the router.refresh() and not the upload itself: during
   * the actual transfer the button stayed enabled reading "Upload Now", and by
   * the time a spinner could appear, handleClear() had unmounted the card
   * containing it. Double submits were possible for the whole upload.
   */
  const [isUploading, setIsUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-dismiss error after 4 seconds
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timer);
  }, [error]);

  const busy = isUploading || isPending;

  const handleFileSelection = (f: File | null) => {
    setSelectedFile(f);
    if (f && f.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(f));
    } else {
      setPreviewUrl(null);
    }
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (!selectedFile) {
      // Previously a silent return: pressing Upload with nothing chosen did
      // nothing at all and said nothing, which reads as a broken button.
      setError("Choose a file to upload first.");
      return;
    }

    setError(null);
    setNotice(null);
    setIsUploading(true);

    const name = selectedFile.name;
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.set("relatedEntityType", relatedEntityType);
    if (relatedEntityId) formData.set("relatedEntityId", relatedEntityId);

    try {
      const res = await fetch("/api/storage/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? `Upload failed (${res.status})`);
        return;
      }

      // Only clear once the upload has actually succeeded, so the card — and
      // the button inside it — stays on screen for the whole request.
      handleClear();
      setNotice(`${name} uploaded.`);
      startTransition(() => router.refresh());
      onUploaded?.();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-500">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <AutoDismissBanner message={notice} onDismiss={() => setNotice(null)} />

      <input
        ref={fileInputRef}
        type="file"
        name="file"
        accept=".pdf,.jpg,.jpeg,.png,.docx"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFileSelection(e.target.files[0]);
        }}
        className="hidden"
      />

      {selectedFile ? (
        <div className="flex flex-col gap-3 p-4 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 dark:bg-indigo-950/20">
          <div className="flex items-center gap-3 min-w-0">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Selected"
                onClick={() => setIsPreviewOpen(true)}
                className="size-12 object-cover rounded-xl border border-border shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
              />
            ) : (
              <div className="flex size-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                <FileText className="size-6" />
              </div>
            )}
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs sm:text-sm font-semibold text-foreground truncate">
                {selectedFile.name}
              </span>
              <span className="text-[11px] text-muted-foreground mt-0.5">
                {(selectedFile.size / 1024).toFixed(1)} KB • Ready to upload
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 gap-y-2 pt-2 border-t border-border/50">
            <div className="flex items-center gap-1.5">
              {previewUrl && (
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(true)}
                  className="flex items-center gap-1 p-2 sm:px-2.5 sm:py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-2xs cursor-pointer"
                  title="Preview File"
                >
                  <Eye className="size-3.5 text-sky-500" />
                  <span className="hidden sm:inline">Preview</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 p-2 sm:px-2.5 sm:py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-2xs cursor-pointer"
                title="Change File"
              >
                <Pencil className="size-3.5 text-indigo-500" />
                <span className="hidden sm:inline">Change</span>
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center gap-1 p-2 sm:px-2.5 sm:py-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors shadow-2xs cursor-pointer"
                title="Remove File"
              >
                <Trash2 className="size-3.5" />
                <span className="hidden sm:inline">Remove</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-40 transition-colors cursor-pointer"
            >
              {busy ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="size-3.5" />
                  <span>Upload Now</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border hover:border-indigo-500/60 rounded-2xl bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer text-center group"
        >
          <div className="flex size-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform mb-3">
            <UploadCloud className="size-6" />
          </div>
          <p className="text-xs sm:text-sm font-semibold text-foreground">
            Click to browse or drop files here
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Supports PDF, JPG, PNG, DOCX (Max 20MB)
          </p>
        </div>
      )}

      {selectedFile && previewUrl && (
        <FilePreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          fileName={selectedFile.name}
          fileUrl={previewUrl}
          mimeType={selectedFile.type}
          fileSize={selectedFile.size}
        />
      )}
    </form>
  );
}
