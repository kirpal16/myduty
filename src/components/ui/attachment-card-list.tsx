"use client";

import { useState } from "react";
import { Download, Eye, FileText, Image as ImageIcon } from "lucide-react";
import { FilePreviewModal } from "./file-preview-modal";
import { DeleteFileButton } from "@/components/storage/delete-file-button";

export interface AttachmentCardItem {
  id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
}

export function AttachmentCardList({
  attachments,
  canDelete = false,
}: {
  attachments: AttachmentCardItem[];
  /**
   * Attachments could previously only be removed from the storage browser,
   * so a receipt attached to the wrong duty had to be hunted down there.
   */
  canDelete?: boolean;
}) {
  const [previewFile, setPreviewFile] = useState<AttachmentCardItem | null>(null);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {attachments.map((file) => {
          const isImage = file.mime_type.startsWith("image/");
          return (
            <div
              key={file.id}
              className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-border bg-card hover:border-indigo-500/40 transition-all shadow-xs"
            >
              <div
                onClick={() => setPreviewFile(file)}
                className="flex items-center gap-3 truncate flex-1 cursor-pointer group"
              >
                {isImage ? (
                  <div className="relative size-11 rounded-xl overflow-hidden border border-border shrink-0">
                    <img
                      src={`/api/storage/${file.id}`}
                      alt={file.original_filename}
                      className="size-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                ) : (
                  <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                    <FileText className="size-5" />
                  </div>
                )}
                <div className="flex flex-col truncate">
                  <span className="text-xs font-semibold text-foreground truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {file.original_filename}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatSize(file.size_bytes)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewFile(file)}
                  className="p-1.5 rounded-xl border border-border bg-card text-muted-foreground hover:text-sky-500 hover:bg-muted transition-colors shadow-2xs cursor-pointer"
                  title="View / Lightbox Preview"
                >
                  <Eye className="size-3.5 text-sky-500" />
                </button>
                <a
                  href={`/api/storage/${file.id}`}
                  download={file.original_filename}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-xl border border-border bg-card text-muted-foreground hover:text-indigo-500 hover:bg-muted transition-colors shadow-2xs"
                  title="Download File"
                >
                  <Download className="size-3.5 text-indigo-500" />
                </a>
                {canDelete && <DeleteFileButton id={file.id} label="" />}
              </div>
            </div>
          );
        })}
      </div>

      {previewFile && (
        <FilePreviewModal
          isOpen={Boolean(previewFile)}
          onClose={() => setPreviewFile(null)}
          fileName={previewFile.original_filename}
          fileUrl={`/api/storage/${previewFile.id}`}
          mimeType={previewFile.mime_type}
          fileSize={previewFile.size_bytes}
        />
      )}
    </>
  );
}
