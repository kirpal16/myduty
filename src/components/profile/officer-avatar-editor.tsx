"use client";

import { useState, useRef, useTransition, useEffect, useCallback } from "react";
import {
  Pencil,
  Trash2,
  Camera,
  Upload,
  X,
  Check,
  Loader2,
  AlertCircle,
  Crop,
} from "lucide-react";
import { ModalPortal, MODAL_Z } from "@/components/ui/modal-portal";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { updateOfficerAvatarAction } from "@/actions/profile";
import { ImageCropperModal } from "@/components/ui/image-cropper-modal";

interface OfficerAvatarEditorProps {
  fullName: string;
  avatarUrl?: string | null;
  designation?: string | null;
  canEdit?: boolean;
}

export function OfficerAvatarEditor({
  fullName,
  avatarUrl: initialAvatarUrl,
  designation,
  canEdit = true,
}: OfficerAvatarEditorProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    initialAvatarUrl ?? null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isActionsActive, setIsActionsActive] = useState(false);

  // Cropper state
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [rawFileName, setRawFileName] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  useBodyScrollLock(isModalOpen || isCropperOpen);

  // Auto-dismiss error message after 4 seconds
  useEffect(() => {
    if (!errorMsg) return;
    const timer = setTimeout(() => setErrorMsg(null), 4000);
    return () => clearTimeout(timer);
  }, [errorMsg]);

  // Close mobile action menu when clicking outside
  useEffect(() => {
    if (!isActionsActive) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsActionsActive(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isActionsActive]);

  const getInitials = (name: string) => {
    return (
      name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "O"
    );
  };

  /** After cropping, compress to 360×360 data-url for the preview + save flow */
  const compressToPreview = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const maxDim = 360;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, width, height);
      setPreviewUrl(canvas.toDataURL("image/jpeg", 0.88));
    };
    img.src = url;
  };

  /** When user picks a file → open the cropper instead of directly previewing */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";

    setErrorMsg(null);
    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please select a valid image file (JPG, PNG, or WebP).");
      return;
    }

    // Revoke previous raw URL
    if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);
    setRawFileName(file.name);
    setRawImageSrc(URL.createObjectURL(file));
    setIsCropperOpen(true);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please select a valid image file (JPG, PNG, or WebP).");
      return;
    }

    if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);
    setRawFileName(file.name);
    setRawImageSrc(URL.createObjectURL(file));
    setIsCropperOpen(true);
  };

  /** Called when user clicks "Apply Crop" in the cropper */
  const handleCropped = useCallback((blob: Blob) => {
    setIsCropperOpen(false);
    compressToPreview(blob);
  }, []);

  /** Re-open the cropper with the original raw image */
  const handleReCrop = () => {
    if (rawImageSrc) setIsCropperOpen(true);
  };

  const handleSaveAvatar = () => {
    if (!previewUrl) return;
    setErrorMsg(null);

    startTransition(async () => {
      try {
        const res = await updateOfficerAvatarAction(previewUrl);
        if (res.success) {
          setAvatarUrl(previewUrl);
          setIsModalOpen(false);
          setPreviewUrl(null);
          setRawImageSrc(null);
        } else {
          setErrorMsg(res.error || "Failed to update profile photo.");
        }
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : "Error saving photo.");
      }
    });
  };

  const handleDeleteAvatar = () => {
    startTransition(async () => {
      try {
        const res = await updateOfficerAvatarAction(null);
        if (res.success) {
          setAvatarUrl(null);
          setPreviewUrl(null);
          setRawImageSrc(null);
          setIsConfirmDeleteOpen(false);
          setIsModalOpen(false);
        } else {
          setErrorMsg(res.error || "Failed to delete profile photo.");
        }
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : "Error removing photo.");
      }
    });
  };

  return (
    <>
      {/* Avatar Container */}
      <div ref={containerRef} className="relative group shrink-0 select-none">
        <div
          onClick={() => {
            if (!canEdit) return;
            if (avatarUrl) {
              // In mobile / click time: toggle the pencil and trash action icons
              setIsActionsActive((prev) => !prev);
            } else {
              setPreviewUrl(null);
              setIsModalOpen(true);
            }
          }}
          className={`relative size-16 sm:size-20 rounded-2xl overflow-hidden shadow-sm shrink-0 border transition-all ${
            canEdit ? "cursor-pointer group-hover:ring-2 group-hover:ring-indigo-500/50" : ""
          } ${
            isActionsActive ? "ring-2 ring-indigo-500 shadow-indigo-500/30" : ""
          } ${
            avatarUrl
              ? "border-border bg-muted/20"
              : "bg-linear-to-br from-indigo-600 to-indigo-800 text-white border-indigo-400/30 flex items-center justify-center font-bold text-xl sm:text-2xl shadow-indigo-600/20"
          }`}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={fullName}
              className="size-full object-cover object-center group-hover:scale-105 transition-transform duration-200"
            />
          ) : (
            <span>{getInitials(fullName)}</span>
          )}

          {/* Quick Hover / Click Overlay */}
          {canEdit && (
            <div
              className={`absolute inset-0 bg-slate-950/40 transition-opacity flex items-center justify-center text-white ${
                isActionsActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
            >
              <Camera className="size-5 drop-shadow-sm" />
            </div>
          )}
        </div>

        {/* Action Button: Pencil Edit Icon (Only on hover and mobile click) */}
        {canEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsActionsActive(false);
              setPreviewUrl(avatarUrl);
              setIsModalOpen(true);
            }}
            title="Update Profile Photo"
            aria-label="Update Profile Photo"
            className={`absolute -top-1.5 -right-1.5 size-7 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-lg border-2 border-card transition-all duration-200 active:scale-90 cursor-pointer z-20 ${
              isActionsActive
                ? "opacity-100 scale-100 pointer-events-auto ring-2 ring-indigo-400/50"
                : "opacity-0 scale-75 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto"
            }`}
          >
            <Pencil className="size-3.5" />
          </button>
        )}

        {/* Action Button: Trash Delete Icon (Only on hover and mobile click when avatar exists) */}
        {canEdit && avatarUrl && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsActionsActive(false);
              setIsConfirmDeleteOpen(true);
            }}
            title="Remove Profile Photo"
            aria-label="Remove Profile Photo"
            className={`absolute -top-1.5 -left-1.5 size-7 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg border-2 border-card transition-all duration-200 active:scale-90 cursor-pointer z-20 ${
              isActionsActive
                ? "opacity-100 scale-100 pointer-events-auto ring-2 ring-rose-400/50"
                : "opacity-0 scale-75 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto"
            }`}
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/jpg"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Photo Upload & Live Preview Modal */}
      {isModalOpen && (
        <ModalPortal>
          <div
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isPending) {
                setIsModalOpen(false);
                setPreviewUrl(null);
              }
            }}
            className={`fixed inset-0 ${MODAL_Z} flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in-0 duration-150`}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md flex flex-col rounded-t-3xl sm:rounded-3xl bg-card border border-border shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/80 bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <Camera className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">
                      Officer Profile Photo
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Upload and crop your official profile picture.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setIsModalOpen(false);
                    setPreviewUrl(null);
                  }}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 sm:p-6 space-y-5">
                {errorMsg && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-500 font-medium">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Live Preview Area */}
                <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-muted/30 border border-border/60">
                  <div className="relative size-28 sm:size-32 rounded-3xl overflow-hidden border-4 border-card shadow-xl ring-2 ring-indigo-500/30 bg-slate-900 flex items-center justify-center group/preview">
                    {previewUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="size-full object-cover object-center"
                        />
                        {/* Re-crop overlay on hover */}
                        {rawImageSrc && (
                          <button
                            type="button"
                            onClick={handleReCrop}
                            title="Re-crop image"
                            className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 opacity-0 group-hover/preview:opacity-100 transition-opacity cursor-pointer rounded-3xl"
                          >
                            <Crop className="size-5 text-white" />
                            <span className="text-[10px] text-white font-semibold">Re-crop</span>
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="size-full bg-linear-to-br from-indigo-600 to-indigo-800 text-white flex items-center justify-center font-bold text-3xl">
                        {getInitials(fullName)}
                      </div>
                    )}
                  </div>

                  <div className="text-center mt-3 space-y-0.5">
                    <p className="text-sm font-bold text-foreground">{fullName}</p>
                    {designation && (
                      <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        {designation}
                      </p>
                    )}
                  </div>
                </div>

                {/* Upload & Choose Action Zone */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="group flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-border hover:border-indigo-500/60 bg-card hover:bg-indigo-500/5 transition-all cursor-pointer text-center"
                >
                  <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mb-2 group-hover:scale-110 transition-transform">
                    <Upload className="size-5" />
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-foreground">
                    {previewUrl ? "Choose a Different Photo" : "Select or Drop Profile Photo"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Supports JPG, PNG, or WebP — cropper opens automatically
                  </p>
                </div>

                {/* If photo exists, offer delete + re-crop options */}
                {(avatarUrl || previewUrl) && (
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setIsConfirmDeleteOpen(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-500 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                      <span>Remove Profile Photo</span>
                    </button>

                    <div className="flex items-center gap-2">
                      {rawImageSrc && previewUrl && (
                        <button
                          type="button"
                          onClick={handleReCrop}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 p-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors cursor-pointer"
                        >
                          <Crop className="size-3.5" />
                          <span>Re-crop</span>
                        </button>
                      )}
                      {previewUrl && previewUrl !== avatarUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewUrl(avatarUrl);
                            setRawImageSrc(null);
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
                        >
                          Reset Changes
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-border/80 bg-muted/20">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setIsModalOpen(false);
                    setPreviewUrl(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isPending || !previewUrl || previewUrl === avatarUrl}
                  onClick={handleSaveAvatar}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-indigo-600/25 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Saving Photo...</span>
                    </>
                  ) : (
                    <>
                      <Check className="size-4" />
                      <span>Save Profile Photo</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Image Cropper Modal — sits above the avatar upload modal */}
      {rawImageSrc && (
        <ImageCropperModal
          isOpen={isCropperOpen}
          imageSrc={rawImageSrc}
          fileName={rawFileName}
          onClose={() => setIsCropperOpen(false)}
          onCropped={handleCropped}
          aspect={1}
        />
      )}

      {/* Confirmation Modal for Removing Avatar */}
      <ConfirmDeleteModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleDeleteAvatar}
        isPending={isPending}
        title="Remove Profile Photo?"
        description="Are you sure you want to remove your profile photo? Your profile will revert back to the official initials avatar."
        confirmLabel="Remove Photo"
      />
    </>
  );
}
