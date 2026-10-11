"use client";

import { useState, useRef } from "react";
import {
  Camera,
  Image as ImageIcon,
  FileText,
  Eye,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  Tag,
  FolderOpen,
} from "lucide-react";
import { FilePreviewModal } from "./file-preview-modal";
import { ConfirmDeleteModal } from "./confirm-delete-modal";
import { CameraCaptureModal } from "./camera-capture-modal";

export interface FormFileInputProps {
  name?: string;
  label?: string;
  optional?: boolean;
  helperText?: string;
  initialFile?: {
    id?: string;
    name: string;
    url: string;
    size?: number;
    mimeType?: string;
    createdAt?: string;
    description?: string | null;
  } | null;
}

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

export function FormFileInput({
  name = "file",
  label = "Attach Document / Proof Image",
  optional = true,
  helperText = "Take a photo or upload travel receipts, shift notes, or medical slips (JPG, PNG, PDF, max 10MB)",
  initialFile = null,
}: FormFileInputProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [existingFile, setExistingFile] = useState(initialFile);
  const [isMarkedForRemoval, setIsMarkedForRemoval] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);

  // Document Title, Date & Description states
  const [documentTitle, setDocumentTitle] = useState(() =>
    initialFile ? stripExtension(initialFile.name) : "",
  );
  const [documentDate, setDocumentDate] = useState(() =>
    initialFile?.createdAt
      ? getLocalDateTimeString(new Date(initialFile.createdAt))
      : getLocalDateTimeString(),
  );
  const [documentDescription, setDocumentDescription] = useState(() =>
    initialFile?.description ?? "",
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);

  // Update title when a new file arrives if title is unset
  const applySelectedFile = (selected: File) => {
    setFile(selected);
    setIsMarkedForRemoval(false);

    if (!documentTitle.trim()) {
      const clean = stripExtension(selected.name);
      setDocumentTitle(clean.startsWith("camera_capture") ? "Camera Photo" : clean);
    }

    if (selected.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(selected));
    } else {
      setPreviewUrl(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    if (selected) {
      applySelectedFile(selected);
    }
  };

  const handleCameraCapture = (capturedFile: File) => {
    applySelectedFile(capturedFile);
  };

  const handleClearNewFile = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFile(null);
    setPreviewUrl(null);
    setDocumentTitle("");
    setDocumentDescription("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (nativeCameraInputRef.current) nativeCameraInputRef.current.value = "";
  };

  const handleRemoveExistingFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMarkedForRemoval(true);
    setExistingFile(null);
    handleClearNewFile();
  };

  const handleOpenPreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPreviewModalOpen(true);
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const activeFileName = file?.name || existingFile?.name || "";
  const activeFileUrl = previewUrl || existingFile?.url || "";
  const activeMimeType = file?.type || existingFile?.mimeType || "";
  const activeFileSize = file?.size || existingFile?.size;
  const isImage =
    activeMimeType.startsWith("image/") ||
    /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(activeFileName) ||
    !!previewUrl;

  const hasAttachment = Boolean(file || existingFile);

  return (
    <div className="flex flex-col gap-2">
      {/* Hidden input to signal removal of an existing attachment during edit */}
      <input
        type="hidden"
        name="removeAttachment"
        value={isMarkedForRemoval ? "true" : "false"}
      />

      {/* Hidden inputs transmitting documentTitle, documentDate & documentDescription */}
      <input type="hidden" name="documentTitle" value={documentTitle} />
      <input type="hidden" name="documentDate" value={documentDate} />
      <input type="hidden" name="documentDescription" value={documentDescription} />

      <div className="flex items-center justify-between text-xs font-semibold text-foreground">
        <span className="flex items-center gap-1.5">
          <ImageIcon className="size-3.5 text-indigo-500" />
          <span>{label}</span>
        </span>
        {optional && (
          <span className="text-[11px] font-normal text-muted-foreground">
            (Optional)
          </span>
        )}
      </div>

      {/* Standard hidden file picker */}
      <input
        ref={fileInputRef}
        type="file"
        name={name}
        accept=".jpg,.jpeg,.png,.pdf,.docx"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Native device camera input (triggers phone camera directly) */}
      <input
        ref={nativeCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {hasAttachment ? (
        <div className="flex flex-col gap-3.5 p-3.5 sm:p-4 rounded-2xl bg-card border border-indigo-500/30 ring-1 ring-indigo-500/10 shadow-xs">
          {/* File Thumbnail & Primary Info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {isImage && activeFileUrl ? (
                <div
                  onClick={handleOpenPreview}
                  className="relative size-12 sm:size-14 rounded-xl overflow-hidden border border-border shrink-0 cursor-pointer group/thumb shadow-2xs"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeFileUrl}
                    alt={documentTitle || activeFileName}
                    className="size-full object-cover transition-transform group-hover/thumb:scale-110"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity text-white">
                    <Eye className="size-4" />
                  </div>
                </div>
              ) : (
                <div className="flex size-12 sm:size-14 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0 border border-indigo-500/20">
                  <FileText className="size-6 sm:size-7" />
                </div>
              )}

              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs sm:text-sm font-bold text-foreground truncate">
                  {documentTitle || activeFileName}
                </span>
                <span className="text-[10px] sm:text-[11px] text-muted-foreground truncate font-mono">
                  {activeFileName}
                </span>
                <div className="flex flex-wrap items-center gap-2 text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">
                  {activeFileSize && <span>{formatSize(activeFileSize)}</span>}
                  {file ? (
                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="size-3" /> Ready to upload
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="size-3" /> Attached document
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Action Icons: View (Eye), Change, Delete (Trash2) */}
            <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
              {activeFileUrl && (
                <button
                  type="button"
                  onClick={handleOpenPreview}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted hover:border-sky-500/50 transition-colors shadow-2xs cursor-pointer"
                  title="View / Lightbox preview"
                >
                  <Eye className="size-3.5 text-sky-500" />
                  <span className="hidden sm:inline">Preview</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsCameraModalOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted hover:border-indigo-500/50 transition-colors shadow-2xs cursor-pointer"
                title="Retake with Camera"
              >
                <Camera className="size-3.5 text-indigo-500" />
                <span className="hidden sm:inline">Camera</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted hover:border-indigo-500/50 transition-colors shadow-2xs cursor-pointer"
                title="Choose Another File"
              >
                <Pencil className="size-3.5 text-slate-500" />
                <span className="hidden sm:inline">Change</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDeleteModalOpen(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors shadow-2xs cursor-pointer"
                title="Delete / Remove Attachment"
              >
                <Trash2 className="size-3.5" />
                <span className="hidden sm:inline">Remove</span>
              </button>
            </div>
          </div>

          {/* Document Metadata Inputs (Title, Date/Time & Description) */}
          <div className="flex flex-col gap-3 pt-3 border-t border-border/60">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Document Name / Title Input */}
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="doc-title-input"
                  className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1"
                >
                  <Tag className="size-3 text-indigo-500" />
                  <span>Document / Report Name</span>
                </label>
                <input
                  id="doc-title-input"
                  type="text"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  placeholder="e.g. Shift Report, Travel Ticket, Medical Slip"
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 shadow-2xs hover:border-indigo-500/40 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>

              {/* Document Date & Time Input */}
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="doc-date-input"
                  className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1"
                >
                  <Clock className="size-3 text-sky-500" />
                  <span>Upload / Document Date & Time</span>
                </label>
                <input
                  id="doc-date-input"
                  type="datetime-local"
                  value={documentDate}
                  onChange={(e) => setDocumentDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground shadow-2xs hover:border-sky-500/40 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>
            </div>

            {/* Document Description Input */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="doc-description-input"
                className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1"
              >
                <FileText className="size-3 text-emerald-500" />
                <span>Description / Remarks</span>
                <span className="text-[10px] font-normal text-muted-foreground/80">(Optional)</span>
              </label>
              <textarea
                id="doc-description-input"
                rows={2}
                value={documentDescription}
                onChange={(e) => setDocumentDescription(e.target.value)}
                placeholder="Add brief description, remarks, or reference details..."
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 shadow-2xs hover:border-emerald-500/40 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
              />
            </div>
          </div>
        </div>
      ) : (
        /* Empty State with Responsive Touch Choices: Camera vs Browse File */
        <div className="flex flex-col rounded-2xl border-2 border-dashed border-border bg-muted/20 p-4 sm:p-5 text-center transition-all hover:border-indigo-500/50 hover:bg-muted/30">
          <p className="text-xs sm:text-sm font-semibold text-foreground mb-1">
            Choose how to attach proof or document
          </p>
          <p className="text-[11px] text-muted-foreground mb-4">
            {helperText}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-sm mx-auto">
            {/* 1. Take Photo / Camera Button */}
            <button
              type="button"
              onClick={() => setIsCameraModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white text-xs font-bold shadow-md shadow-indigo-600/25 transition-all cursor-pointer w-full"
            >
              <Camera className="size-4 shrink-0" />
              <span>Take Photo (Camera)</span>
            </button>

            {/* 2. Browse Files Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted hover:border-indigo-500/50 active:scale-98 text-foreground text-xs font-semibold shadow-2xs transition-all cursor-pointer w-full"
            >
              <FolderOpen className="size-4 text-indigo-500 shrink-0" />
              <span>Browse Files</span>
            </button>
          </div>
        </div>
      )}

      {/* In-App Live Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={handleCameraCapture}
        onTriggerNativeCamera={() => nativeCameraInputRef.current?.click()}
      />

      {/* Lightbox Preview Modal */}
      {activeFileUrl && (
        <FilePreviewModal
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          fileName={documentTitle || activeFileName}
          fileUrl={activeFileUrl}
          mimeType={activeMimeType}
          fileSize={activeFileSize}
          description={documentDescription || undefined}
        />
      )}

      {/* Remove Confirmation Dialog */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={() => {
          if (file) {
            handleClearNewFile();
          } else {
            handleRemoveExistingFile({ stopPropagation: () => {} } as React.MouseEvent);
          }
          setIsDeleteModalOpen(false);
        }}
        title="Remove Selected File"
        description="Are you sure you want to remove this attached proof document? You can select another file or re-upload before saving."
        confirmLabel="Remove File"
      />
    </div>
  );
}
