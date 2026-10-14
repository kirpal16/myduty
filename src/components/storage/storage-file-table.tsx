"use client";

import { useState, useEffect } from "react";
import {
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  File,
  Calendar,
  FolderArchive,
  Pencil,
} from "lucide-react";
import { DeleteFileButton } from "./delete-file-button";
import { EditFileModal } from "./edit-file-modal";
import { FilePreviewModal } from "@/components/ui/file-preview-modal";
import { useLanguage } from "@/lib/i18n/language-context";
import { toGujaratiNumerals } from "@/lib/reports/gujaratiReportUtils";

export interface FileAttachmentItem {
  id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  description?: string | null;
}

export function StorageFileTable({
  files,
}: {
  files: FileAttachmentItem[];
}) {
  const { dictionary, isGujarati } = useLanguage();
  const [items, setItems] = useState<FileAttachmentItem[]>(files);
  const [previewFile, setPreviewFile] = useState<FileAttachmentItem | null>(null);
  const [editingFile, setEditingFile] = useState<FileAttachmentItem | null>(null);

  useEffect(() => {
    setItems(files);
  }, [files]);

  const handleUpdated = (updated: {
    id: string;
    original_filename: string;
    description: string | null;
  }) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === updated.id
          ? {
              ...item,
              original_filename: updated.original_filename,
              description: updated.description,
            }
          : item,
      ),
    );
    if (previewFile?.id === updated.id) {
      setPreviewFile((prev) =>
        prev
          ? {
              ...prev,
              original_filename: updated.original_filename,
              description: updated.description,
            }
          : null,
      );
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return isGujarati ? `${toGujaratiNumerals(bytes)} B` : `${bytes} B`;
    if (bytes < 1024 * 1024) {
      const val = (bytes / 1024).toFixed(1);
      return isGujarati ? `${toGujaratiNumerals(val)} KB` : `${val} KB`;
    }
    const val = (bytes / (1024 * 1024)).toFixed(1);
    return isGujarati ? `${toGujaratiNumerals(val)} MB` : `${val} MB`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const formatted = `${day}/${month}/${year}`;
    return isGujarati ? toGujaratiNumerals(formatted) : formatted;
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
              <th className="py-3.5 px-4 sm:px-6">{dictionary.storage.documentName}</th>
              <th className="py-3.5 px-4">{dictionary.storage.description}</th>
              <th className="py-3.5 px-4">{dictionary.storage.fileSize}</th>
              <th className="py-3.5 px-4">{dictionary.storage.uploadedOn}</th>
              <th className="py-3.5 px-4 sm:px-6 text-right">{dictionary.common.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {items.map((f) => {
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
                      <span className="truncate max-w-[180px] lg:max-w-xs">
                        {f.original_filename}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 max-w-[200px] text-xs text-muted-foreground">
                    {f.description ? (
                      <span className="truncate block" title={f.description}>
                        {f.description}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40 italic">—</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-muted-foreground font-medium whitespace-nowrap">
                    {formatFileSize(f.size_bytes)}
                  </td>
                  <td className="py-3.5 px-4 text-muted-foreground whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-slate-400" />
                      <span>{formatDate(f.created_at)}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Preview (Eye) */}
                      <button
                        type="button"
                        onClick={() => setPreviewFile(f)}
                        className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted hover:border-indigo-500/50 transition-colors shadow-2xs cursor-pointer"
                        title={dictionary.common.preview}
                      >
                        <Eye className="size-3.5 text-sky-500" />
                        <span>{dictionary.common.preview}</span>
                      </button>

                      {/* Edit (Pencil) */}
                      <button
                        type="button"
                        onClick={() => setEditingFile(f)}
                        className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted hover:border-amber-500/50 transition-colors shadow-2xs cursor-pointer"
                        title={dictionary.common.edit}
                      >
                        <Pencil className="size-3.5 text-amber-500" />
                        <span>{dictionary.common.edit}</span>
                      </button>

                      {/* Download */}
                      <a
                        href={`/api/storage/${f.id}`}
                        download={f.original_filename}
                        className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-2xs"
                        target="_blank"
                        rel="noopener noreferrer"
                        title={dictionary.common.download}
                      >
                        <Download className="size-3.5 text-indigo-500" />
                        <span>{dictionary.common.download}</span>
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
        {items.map((f) => {
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
                  {f.description && (
                    <p className="text-xs text-muted-foreground/90 italic truncate mt-0.5" title={f.description}>
                      {f.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span>{formatFileSize(f.size_bytes)}</span>
                    <span>•</span>
                    <span>{formatDate(f.created_at)}</span>
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
                  <span>{dictionary.common.preview}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingFile(f)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2 text-xs font-semibold text-foreground hover:bg-muted shadow-2xs transition-colors cursor-pointer"
                >
                  <Pencil className="size-3.5 text-amber-500" />
                  <span>{dictionary.common.edit}</span>
                </button>
                <a
                  href={`/api/storage/${f.id}`}
                  download={f.original_filename}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2 text-xs font-semibold text-foreground hover:bg-muted shadow-2xs transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="size-3.5 text-indigo-500" />
                  <span>{dictionary.common.download}</span>
                </a>
                <DeleteFileButton id={f.id} />
              </div>
            </div>
          );
        })}
      </div>

      {items.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          <div className="flex flex-col items-center justify-center gap-2">
            <FolderArchive className="size-8 text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-medium text-foreground">
              {dictionary.storage.noFilesFound}
            </p>
            <p className="text-xs text-muted-foreground">
              {dictionary.storage.noFilesHelp}
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
          description={previewFile.description || undefined}
        />
      )}

      {/* Edit File Modal */}
      {editingFile && (
        <EditFileModal
          isOpen={Boolean(editingFile)}
          onClose={() => setEditingFile(null)}
          file={editingFile}
          onUpdated={handleUpdated}
        />
      )}
    </>
  );
}
