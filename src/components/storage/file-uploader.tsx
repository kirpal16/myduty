"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useRef, useEffect } from "react";
import { AutoDismissBanner } from "@/components/ui/auto-dismiss-banner";
import {
  UploadCloud,
  Camera,
  Loader2,
  AlertCircle,
  Eye,
  Pencil,
  Trash2,
  FileText,
  Clock,
  Tag,
  FolderOpen,
} from "lucide-react";
import { FilePreviewModal } from "@/components/ui/file-preview-modal";
import { CameraCaptureModal } from "@/components/ui/camera-capture-modal";

function getLocalDateTimeString(date: Date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, "");
}

export function FileUploader({
  relatedEntityType = "general",
  relatedEntityId,
  onUploaded,
}: {
  relatedEntityType?: string;
  relatedEntityId?: string;
  /**
   * Fired only after an upload actually succeeds -- never on submit. The
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
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [documentTitle, setDocumentTitle] = useState("");
  const [documentDate, setDocumentDate] = useState(() => getLocalDateTimeString());
  const [documentDescription, setDocumentDescription] = useState("");

  const [isUploading, setIsUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-dismiss error after 4 seconds
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timer);
  }, [error]);

  const busy = isUploading || isPending;

  const handleFileSelection = (f: File | null) => {
    setSelectedFile(f);
    if (f) {
      if (!documentTitle.trim()) {
        const clean = stripExtension(f.name);
        setDocumentTitle(clean.startsWith("camera_capture") ? "Camera Photo" : clean);
      }
      if (f.type.startsWith("image/")) {
        setPreviewUrl(URL.createObjectURL(f));
      } else {
        setPreviewUrl(null);
      }
    } else {
      setPreviewUrl(null);
    }
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedFile(null);
    setPreviewUrl(null);
    setDocumentTitle("");
    setDocumentDescription("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (nativeCameraInputRef.current) nativeCameraInputRef.current.value = "";
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (!selectedFile) {
      setError("Choose a file or take a photo first.");
      return;
    }

    setError(null);
    setNotice(null);
    setIsUploading(true);

    const name = documentTitle.trim() || selectedFile.name;
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.set("relatedEntityType", relatedEntityType);
    if (relatedEntityId) formData.set("relatedEntityId", relatedEntityId);
    if (documentTitle.trim()) formData.set("documentTitle", documentTitle.trim());
    if (documentDate) formData.set("documentDate", documentDate);
    if (documentDescription.trim()) formData.set("documentDescription", documentDescription.trim());

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

      handleClear();
      setNotice(`${name} uploaded successfully.`);
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

      <input
        ref={nativeCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFileSelection(e.target.files[0]);
        }}
        className="hidden"
      />

      {selectedFile ? (
        <div className="flex flex-col gap-3.5 p-4 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 dark:bg-indigo-950/20">
          <div className="flex items-start gap-3 min-w-0">
            {previewUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={previewUrl}
                alt={documentTitle || selectedFile.name}
                onClick={() => setIsPreviewOpen(true)}
                className="size-14 object-cover rounded-xl border border-border shrink-0 cursor-pointer hover:opacity-90 transition-opacity shadow-2xs"
              />
            ) : (
              <div className="flex size-14 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0 border border-indigo-500/20">
                <FileText className="size-7" />
              </div>
            )}
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs sm:text-sm font-bold text-foreground truncate">
                {documentTitle || selectedFile.name}
              </span>
              <span className="text-[11px] text-muted-foreground truncate font-mono">
                {selectedFile.name}
              </span>
              <span className="text-[11px] text-muted-foreground mt-0.5">
                {(selectedFile.size / 1024).toFixed(1)} KB • Ready to upload
              </span>
            </div>
          </div>

          {/* Document Title, Upload Date/Time & Description Input fields */}
          <div className="flex flex-col gap-3 pt-3 border-t border-border/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="upload-doc-title"
                  className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1"
                >
                  <Tag className="size-3 text-indigo-500" />
                  <span>Document / Report Name</span>
                </label>
                <input
                  id="upload-doc-title"
                  type="text"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  placeholder="e.g. Duty Shift Report, Travel Bill"
                  className="w-full rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 shadow-2xs hover:border-indigo-500/40 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="upload-doc-date"
                  className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1"
                >
                  <Clock className="size-3 text-sky-500" />
                  <span>Document / Upload Date & Time</span>
                </label>
                <input
                  id="upload-doc-date"
                  type="datetime-local"
                  value={documentDate}
                  onChange={(e) => setDocumentDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-foreground shadow-2xs hover:border-sky-500/40 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="upload-doc-desc"
                className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1"
              >
                <FileText className="size-3 text-emerald-500" />
                <span>Description / Remarks</span>
                <span className="text-[10px] font-normal text-muted-foreground/80">(Optional)</span>
              </label>
              <textarea
                id="upload-doc-desc"
                rows={2}
                value={documentDescription}
                onChange={(e) => setDocumentDescription(e.target.value)}
                placeholder="Add brief description, remarks, or notes..."
                className="w-full rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 shadow-2xs hover:border-emerald-500/40 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
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
                onClick={() => setIsCameraModalOpen(true)}
                className="flex items-center gap-1 p-2 sm:px-2.5 sm:py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-2xs cursor-pointer"
                title="Retake with Camera"
              >
                <Camera className="size-3.5 text-indigo-500" />
                <span className="hidden sm:inline">Camera</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 p-2 sm:px-2.5 sm:py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-2xs cursor-pointer"
                title="Change File"
              >
                <Pencil className="size-3.5 text-slate-500" />
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
        <div className="flex flex-col items-center justify-center p-5 sm:p-6 border-2 border-dashed border-border hover:border-indigo-500/60 rounded-2xl bg-muted/20 hover:bg-muted/30 transition-all text-center">
          <p className="text-xs sm:text-sm font-semibold text-foreground mb-1">
            Attach document or proof
          </p>
          <p className="text-[11px] text-muted-foreground mb-4">
            Take a photo with your camera or browse files (PDF, JPG, PNG, DOCX, max 20MB)
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setIsCameraModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white text-xs font-bold shadow-md shadow-indigo-600/25 transition-all cursor-pointer"
            >
              <Camera className="size-4" />
              <span>Take Photo (Camera)</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted hover:border-indigo-500/50 active:scale-98 text-foreground text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            >
              <FolderOpen className="size-4 text-indigo-500" />
              <span>Browse Files</span>
            </button>
          </div>
        </div>
      )}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={(file) => handleFileSelection(file)}
        onTriggerNativeCamera={() => nativeCameraInputRef.current?.click()}
      />

      {selectedFile && previewUrl && (
        <FilePreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          fileName={documentTitle || selectedFile.name}
          fileUrl={previewUrl}
          mimeType={selectedFile.type}
          fileSize={selectedFile.size}
          description={documentDescription || undefined}
        />
      )}
    </form>
  );
}
