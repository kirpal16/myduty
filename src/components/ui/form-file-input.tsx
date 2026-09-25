"use client";

import { useState, useRef } from "react";
import {
  UploadCloud,
  Image as ImageIcon,
  FileText,
  Eye,
  Pencil,
  Trash2,
  Download,
  CheckCircle2,
} from "lucide-react";
import { FilePreviewModal } from "./file-preview-modal";
import { ConfirmDeleteModal } from "./confirm-delete-modal";

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
  } | null;
}

export function FormFileInput({
  name = "file",
  label = "Attach Document / Proof Image",
  optional = true,
  helperText = "Attach medical certificates, travel receipts, or shift documentation (JPG, PNG, PDF, max 10MB)",
  initialFile = null,
}: FormFileInputProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [existingFile, setExistingFile] = useState(initialFile);
  const [isMarkedForRemoval, setIsMarkedForRemoval] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    if (selected) {
      setFile(selected);
      setIsMarkedForRemoval(false);
      if (selected.type.startsWith("image/")) {
        setPreviewUrl(URL.createObjectURL(selected));
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleClearNewFile = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFile(null);
    setPreviewUrl(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleRemoveExistingFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMarkedForRemoval(true);
    setExistingFile(null);
    handleClearNewFile();
  };

  const handleTriggerPicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    inputRef.current?.click();
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

      <input
        ref={inputRef}
        type="file"
        name={name}
        accept=".jpg,.jpeg,.png,.pdf,.docx"
        onChange={handleFileChange}
        className="hidden"
      />

      {hasAttachment ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-card border border-indigo-500/30 ring-1 ring-indigo-500/10 shadow-xs">
          {/* File Info & Thumbnail */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {isImage && activeFileUrl ? (
              <div
                onClick={handleOpenPreview}
                className="relative size-12 rounded-xl overflow-hidden border border-border shrink-0 cursor-pointer group/thumb"
              >
                <img
                  src={activeFileUrl}
                  alt={activeFileName}
                  className="size-full object-cover transition-transform group-hover/thumb:scale-110"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity text-white">
                  <Eye className="size-4" />
                </div>
              </div>
            ) : (
              <div className="flex size-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                <FileText className="size-6" />
              </div>
            )}

            <div className="flex flex-col truncate">
              <span className="text-xs sm:text-sm font-semibold text-foreground truncate">
                {activeFileName}
              </span>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                {activeFileSize && <span>{formatSize(activeFileSize)}</span>}
                {file ? (
                  <span className="text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="size-3" /> Ready to upload
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="size-3" /> Attached document
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Icons: View (Eye), Edit (Pencil), Delete (Trash2) */}
          <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
            {/* View / Lightbox preview */}
            {activeFileUrl && (
              <button
                type="button"
                onClick={handleOpenPreview}
                className="flex items-center gap-1 p-2 sm:px-2.5 sm:py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted hover:border-indigo-500/50 transition-colors shadow-2xs cursor-pointer"
                title="View / Preview Attachment"
              >
                <Eye className="size-3.5 text-sky-500" />
                <span className="hidden sm:inline">Preview</span>
              </button>
            )}

            {/* Edit / Change file */}
            <button
              type="button"
              onClick={handleTriggerPicker}
              className="flex items-center gap-1 p-2 sm:px-2.5 sm:py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted hover:border-indigo-500/50 transition-colors shadow-2xs cursor-pointer"
              title="Replace / Change File"
            >
              <Pencil className="size-3.5 text-indigo-500" />
              <span className="hidden sm:inline">Change</span>
            </button>

            {/* Delete / Remove file */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsDeleteModalOpen(true);
              }}
              className="flex items-center gap-1 p-2 sm:px-2.5 sm:py-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors shadow-2xs cursor-pointer"
              title="Delete / Remove Attachment"
            >
              <Trash2 className="size-3.5" />
              <span className="hidden sm:inline">Remove</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-border hover:border-indigo-500/60 rounded-2xl bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer text-center group"
        >
          <div className="flex size-11 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform mb-2">
            <UploadCloud className="size-5.5" />
          </div>
          <p className="text-xs sm:text-sm font-semibold text-foreground">
            Click to select or drag & drop proof image or document
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {helperText}
          </p>
        </div>
      )}

      {/* Lightbox Preview Modal */}
      {activeFileUrl && (
        <FilePreviewModal
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          fileName={activeFileName}
          fileUrl={activeFileUrl}
          mimeType={activeMimeType}
          fileSize={activeFileSize}
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
