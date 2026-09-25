"use client";

import { useState } from "react";
import {
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  File,
  Calendar,
  FolderArchive,
} from "lucide-react";
import { DeleteFileButton } from "./delete-file-button";
import { FilePreviewModal } from "@/components/ui/file-preview-modal";

export interface FileAttachmentItem {
  id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export function StorageFileTable({
  files,
}: {
  files: FileAttachmentItem[];
}) {
  const [previewFile, setPreviewFile] = useState<FileAttachmentItem | null>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mime: string) => {
    if (mime.includes("pdf")) return <FileText className="size-4 text-rose-500 shrink-0" />;
    if (mime.includes("image")) return <ImageIcon className="size-4 text-sky-500 shrink-0" />;
    if (mime.includes("word") || mime.includes("document"))
      return <FileText className="size-4 text-indigo-500 shrink-0" />;
    return <File className="size-4 text-slate-400 shrink-0" />;
  };

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[11px] font-semibold tracking-wider">
            <tr>
              <th className="py-3.5 px-4 sm:px-6">Document Name</th>
              <th className="py-3.5 px-4">Size</th>
              <th className="py-3.5 px-4">Uploaded</th>
              <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {files.map((f) => {
              const isImage = f.mime_type.startsWith("image/");
              return (
                <tr
                  key={f.id}
                  className="hover:bg-muted/30 transition-colors group"
                >
                  <td className="py-3.5 px-4 sm:px-6 font-semibold text-foreground">
                    <div className="flex items-center gap-2.5">
                      {isImage ? (
                        <div
                          onClick={() => setPreviewFile(f)}
                          className="size-8 rounded-lg overflow-hidden border border-border shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                        >
                          <img
                            src={`/api/storage/${f.id}`}
                            alt={f.original_filename}
                            className="size-full object-cover"
                          />
                        </div>
                      ) : (
                        getFileIcon(f.mime_type)
                      )}
                      <span className="truncate max-w-[200px] sm:max-w-xs">
                        {f.original_filename}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-muted-foreground font-medium whitespace-nowrap">
                    {formatFileSize(f.size_bytes)}
                  </td>
                  <td className="py-3.5 px-4 text-muted-foreground whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-slate-400" />
                      <span>{new Date(f.created_at).toLocaleDateString()}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Preview (Eye) */}
                      <button
                        type="button"
                        onClick={() => setPreviewFile(f)}
                        className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted hover:border-indigo-500/50 transition-colors shadow-2xs cursor-pointer"
                        title="View / Preview File"
                      >
                        <Eye className="size-3.5 text-sky-500" />
                        <span>Preview</span>
                      </button>

                      {/* Download */}
                      <a
                        href={`/api/storage/${f.id}`}
                        download={f.original_filename}
                        className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-2xs"
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Download Document"
                      >
                        <Download className="size-3.5 text-indigo-500" />
                        <span>Download</span>
                      </a>

                      {/* Delete (Trash2) */}
                      <DeleteFileButton id={f.id} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden flex flex-col divide-y divide-border/60">
        {files.map((f) => {
          const isImage = f.mime_type.startsWith("image/");
          return (
            <div key={f.id} className="p-4 space-y-3 bg-card hover:bg-muted/20 transition-colors">
              <div className="flex items-start gap-2.5">
                {isImage ? (
                  <div
                    onClick={() => setPreviewFile(f)}
                    className="size-10 rounded-lg overflow-hidden border border-border shrink-0 cursor-pointer"
                  >
                    <img
                      src={`/api/storage/${f.id}`}
                      alt={f.original_filename}
                      className="size-full object-cover"
                    />
                  </div>
                ) : (
                  getFileIcon(f.mime_type)
                )}
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-bold text-foreground truncate block">
                    {f.original_filename}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span>{formatFileSize(f.size_bytes)}</span>
                    <span>•</span>
                    <span>{new Date(f.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setPreviewFile(f)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2 text-xs font-semibold text-foreground hover:bg-muted shadow-2xs transition-colors cursor-pointer"
                >
                  <Eye className="size-3.5 text-sky-500" />
                  <span>Preview</span>
                </button>
                <a
                  href={`/api/storage/${f.id}`}
                  download={f.original_filename}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2 text-xs font-semibold text-foreground hover:bg-muted shadow-2xs transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="size-3.5 text-indigo-500" />
                  <span>Download</span>
                </a>
                <DeleteFileButton id={f.id} />
              </div>
            </div>
          );
        })}
      </div>

      {files.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          <div className="flex flex-col items-center justify-center gap-2">
            <FolderArchive className="size-8 text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-medium text-foreground">
              No files found in vault
            </p>
            <p className="text-xs text-muted-foreground">
              Use the Upload button above to add your first attachment.
            </p>
          </div>
        </div>
      )}

      {/* Lightbox Preview Modal */}
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
