"use client";

import { useState, useRef, useTransition, useEffect, useCallback } from "react";
import {
  FileSignature,
  Upload,
  Camera,
  Trash2,
  Eye,
  Loader2,
  X,
  Check,
  AlertCircle,
  Crop as CropIcon,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { ModalPortal, MODAL_Z } from "@/components/ui/modal-portal";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { CameraCaptureModal } from "@/components/ui/camera-capture-modal";
import { ImageCropperModal } from "@/components/ui/image-cropper-modal";
import { updateOfficerSignatureAction } from "@/actions/profile";
import { Card } from "@/components/ui/card";

interface OfficerSignatureEditorProps {
  initialSignatureUrl?: string | null;
  canEdit?: boolean;
}

/** Standard Signature Landscape Ratio: 5:2 (Width to Height) */
const SIGNATURE_ASPECT_RATIO = 5 / 2;

/** Trims empty white margins so the signature content is compact */
function trimCanvasWhitespace(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  let top = h;
  let bottom = 0;
  let left = w;
  let right = 0;
  let found = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      if (a > 20 && (r < 240 || g < 240 || b < 240)) {
        found = true;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }

  if (!found || top >= bottom || left >= right) return canvas;

  const pad = 6;
  const trimX = Math.max(0, left - pad);
  const trimY = Math.max(0, top - pad);
  const trimW = Math.min(w - trimX, right - left + pad * 2);
  const trimH = Math.min(h - trimY, bottom - top + pad * 2);

  const trimmedCanvas = document.createElement("canvas");
  trimmedCanvas.width = trimW;
  trimmedCanvas.height = trimH;
  const trimmedCtx = trimmedCanvas.getContext("2d");
  if (!trimmedCtx) return canvas;

  trimmedCtx.fillStyle = "#ffffff";
  trimmedCtx.fillRect(0, 0, trimW, trimH);
  trimmedCtx.drawImage(canvas, trimX, trimY, trimW, trimH, 0, 0, trimW, trimH);

  return trimmedCanvas;
}

export function OfficerSignatureEditor({
  initialSignatureUrl,
  canEdit = true,
}: OfficerSignatureEditorProps) {
  const { toast } = useToast();
  const [signatureUrl, setSignatureUrl] = useState<string | null>(
    initialSignatureUrl ?? null
  );
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cropper State (5:2 ratio)
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [rawFileName, setRawFileName] = useState("signature.png");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  useBodyScrollLock(isPreviewOpen || isCameraOpen || isCropperOpen);

  // Auto-dismiss errors
  useEffect(() => {
    if (!errorMsg) return;
    const timer = setTimeout(() => setErrorMsg(null), 4000);
    return () => clearTimeout(timer);
  }, [errorMsg]);

  /** Compress cropped blob into high quality signature data-URL (max 650x260) */
  const processAndSaveSignature = useCallback((fileOrBlob: Blob) => {
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) return;

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxW = 650;
        const maxH = 260; // Exact 5:2 ratio (650:260 = 2.5:1)
        let w = img.width;
        let h = img.height;

        if (w > maxW) {
          h = Math.round((h * maxW) / w);
          w = maxW;
        }
        if (h > maxH) {
          w = Math.round((w * maxH) / h);
          h = maxH;
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Clean white background for crisp document reproduction
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        const finalCanvas = trimCanvasWhitespace(canvas);
        const dataUrl = finalCanvas.toDataURL("image/png");

        startTransition(async () => {
          try {
            const res = await updateOfficerSignatureAction(dataUrl);
            if (res.success) {
              setSignatureUrl(dataUrl);
              toast("સહી સફળતાપૂર્વક સાચવવામાં આવી (Signature saved)", "success");
            } else {
              setErrorMsg(res.error || "Failed to save signature.");
              toast(res.error || "Failed to save signature.", "error");
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Error saving signature.";
            setErrorMsg(msg);
            toast(msg, "error");
          }
        });
      };
      img.src = src;
    };
    reader.readAsDataURL(fileOrBlob);
  }, [toast]);

  /** User selects file -> open 5:2 cropper first */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (!file.type.startsWith("image/")) {
      setErrorMsg("કૃપા કરીને માન્ય ઇમેજ ફાઇલ પસંદ કરો (JPG, PNG, WebP).");
      return;
    }

    if (rawImageSrc && rawImageSrc.startsWith("blob:")) {
      URL.revokeObjectURL(rawImageSrc);
    }
    setRawFileName(file.name);
    setRawImageSrc(URL.createObjectURL(file));
    setIsCropperOpen(true);
  };

  /** Camera capture -> open 5:2 cropper */
  const handleCameraCapture = (file: File) => {
    setIsCameraOpen(false);
    if (rawImageSrc && rawImageSrc.startsWith("blob:")) {
      URL.revokeObjectURL(rawImageSrc);
    }
    setRawFileName(file.name || "camera_signature.png");
    setRawImageSrc(URL.createObjectURL(file));
    setIsCropperOpen(true);
  };

  /** User completes crop */
  const handleCropComplete = useCallback((blob: Blob) => {
    setIsCropperOpen(false);
    processAndSaveSignature(blob);
  }, [processAndSaveSignature]);

  /** Re-crop existing signature */
  const handleReCrop = () => {
    if (rawImageSrc) {
      setIsCropperOpen(true);
    } else if (signatureUrl) {
      setRawFileName("signature.png");
      setRawImageSrc(signatureUrl);
      setIsCropperOpen(true);
    }
  };

  const handleDeleteSignature = () => {
    startTransition(async () => {
      try {
        const res = await updateOfficerSignatureAction(null);
        if (res.success) {
          setSignatureUrl(null);
          setRawImageSrc(null);
          setIsConfirmDeleteOpen(false);
          setIsPreviewOpen(false);
          toast("સહી હટાવી દીધી છે (Signature removed)", "success");
        } else {
          setErrorMsg(res.error || "Failed to remove signature.");
        }
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : "Error removing signature.");
      }
    });
  };

  return (
    <Card className="p-4 sm:p-7 border border-border/80 shadow-xs space-y-4">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/70">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400">
            <FileSignature className="size-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5 flex-wrap">
              <span>અધિકારીની સહી (Official Signature)</span>
              <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.2 rounded">
                5:2 Ratio
              </span>
            </h4>
            <p className="text-[11px] text-muted-foreground truncate">
              રિપોર્ટ લેટરહેડ માટે પ્રમાણિત 5:2 હોરિઝોન્ટલ સાઇઝમાં સહી ક્રોપ થશે.
            </p>
          </div>
        </div>

        {signatureUrl && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0 self-start sm:self-auto">
            <Check className="size-3" />
            <span>સહી અપલોડ થયેલ છે</span>
          </span>
        )}
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-400">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Signature State Display */}
      {signatureUrl ? (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5 sm:gap-5 rounded-2xl border border-border/80 bg-background p-3 sm:p-4 shadow-2xs">
          {/* Specimen Signature Container - Fixed 5:2 Landscape Ratio */}
          <div className="flex flex-col items-center sm:items-start shrink-0">
            <div
              onClick={() => setIsPreviewOpen(true)}
              className="group relative w-full sm:w-72 md:w-80 aspect-[5/2] cursor-pointer rounded-xl border-2 border-dashed border-indigo-500/30 hover:border-indigo-500 bg-white p-2.5 shadow-xs transition-all overflow-hidden flex items-center justify-center select-none"
              title="મોટી સાઇઝમાં જોવા માટે ક્લિક કરો (Click to view full size)"
            >
              {/* Subtle official watermark line */}
              <div className="absolute inset-x-4 bottom-3 border-b border-slate-200 pointer-events-none" />

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={signatureUrl}
                alt="Officer Signature"
                className="max-h-full max-w-full object-contain relative z-10 group-hover:scale-105 transition-transform duration-200"
              />

              {/* Hover / Tap Overlay */}
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg text-white text-xs font-semibold gap-1.5 backdrop-blur-2xs">
                <Eye className="size-4" />
                <span>Full Preview</span>
              </div>

              {/* Dimension pill */}
              <span className="absolute bottom-1 right-1.5 z-20 text-[9px] font-mono text-slate-600 bg-slate-100/90 px-1 rounded border border-slate-200/80">
                5:2 Specimen
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground mt-1 text-center sm:text-left">
              લેટરહેડ પ્રિન્ટિંગ માટે પ્રમાણિત સહી
            </span>
          </div>

          {/* Action Buttons - Clean Mobile-Responsive Grid */}
          {canEdit && (
            <div className="grid grid-cols-2 sm:flex sm:flex-col gap-2 w-full sm:w-48 shrink-0">
              <button
                type="button"
                disabled={isPending}
                onClick={handleReCrop}
                className="inline-flex items-center justify-center gap-1.5 h-10 sm:h-9 px-3 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                title="5:2 રેશિયોમાં ફરી ક્રોપ કરો"
              >
                <CropIcon className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>ક્રોપ કરો (Crop)</span>
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={() => setIsCameraOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 h-10 sm:h-9 px-3 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                title="કેમેરાથી નવો ફોટો લો"
              >
                <Camera className="size-3.5 text-muted-foreground" />
                <span>ફોટો લો (Camera)</span>
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-1.5 h-10 sm:h-9 px-3 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                title="બીજી ફાઇલ અપલોડ કરો"
              >
                <Upload className="size-3.5 text-muted-foreground" />
                <span>ફાઇલ (Browse)</span>
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={() => setIsConfirmDeleteOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 h-10 sm:h-9 px-3 rounded-xl border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                title="સહી હટાવો"
              >
                <Trash2 className="size-3.5" />
                <span>હટાવો (Remove)</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Empty Upload Zone - Showing 5:2 Guide */
        <div className="rounded-2xl border-2 border-dashed border-border/80 bg-background/60 p-4 sm:p-6 text-center space-y-3.5">
          <div className="flex size-11 mx-auto items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
            <FileSignature className="size-5.5" />
          </div>

          <div className="space-y-1">
            <p className="text-xs sm:text-sm font-bold text-foreground">
              સહી અપલોડ કરો (Upload Official Signature)
            </p>
            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto leading-relaxed">
              કોરા સફેદ કાગળ પર કરેલી સહીનો ફોટો લો અથવા સ્કેન ફાઇલ પસંદ કરો. અપલોડ પછી આપમેળે{" "}
              <strong className="text-foreground">5:2 ક્રોપર (Landscape)</strong> ખુલશે.
            </p>
          </div>

          {canEdit && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-sm mx-auto pt-1">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setIsCameraOpen(true)}
                className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-60"
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Camera className="size-4" />
                )}
                <span>કેમેરાથી ફોટો લો (Take Photo)</span>
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition-all cursor-pointer disabled:opacity-60"
              >
                <Upload className="size-4" />
                <span>ફાઇલ પસંદ કરો (Browse File)</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 5:2 Aspect Ratio Cropper Modal */}
      {isCropperOpen && rawImageSrc && (
        <ImageCropperModal
          isOpen={isCropperOpen}
          imageSrc={rawImageSrc}
          fileName={rawFileName}
          aspect={SIGNATURE_ASPECT_RATIO}
          onClose={() => setIsCropperOpen(false)}
          onCropped={handleCropComplete}
        />
      )}

      {/* Full Preview Modal */}
      {isPreviewOpen && signatureUrl && (
        <ModalPortal>
          <div
            className={`fixed inset-0 flex items-center justify-center bg-black/75 p-3.5 sm:p-4 backdrop-blur-xs animate-in fade-in-0 duration-150 ${MODAL_Z}`}
            onClick={() => setIsPreviewOpen(false)}
          >
            <div
              className="relative max-w-md w-full rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <FileSignature className="size-4 text-indigo-600" />
                  <h3 className="text-xs sm:text-sm font-bold text-foreground">
                    અધિકારીની સહી (5:2 Signature Specimen)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Exact 5:2 Preview in modal */}
              <div className="w-full aspect-[5/2] flex items-center justify-center rounded-xl border-2 border-dashed border-indigo-500/30 bg-white p-3 shadow-inner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={signatureUrl}
                  alt="Full Signature"
                  className="max-h-full max-w-full object-contain"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsPreviewOpen(false);
                    handleReCrop();
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <CropIcon className="size-3.5" />
                  <span>ક્રોપ બદલો (Re-crop)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold"
                >
                  બંધ કરો (Close)
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleDeleteSignature}
        title="સહી હટાવવી છે? (Remove Signature?)"
        description="શું તમે ખરેખર તમારી સહી હટાવવા માંગો છો? આના પછી પ્રિન્ટ રિપોર્ટમાં સહી દેખાશે નહીં."
        confirmLabel="હટાવો (Delete)"
        isPending={isPending}
      />

      {/* Camera Capture Modal */}
      {isCameraOpen && (
        <CameraCaptureModal
          isOpen={isCameraOpen}
          onClose={() => setIsCameraOpen(false)}
          onCapture={handleCameraCapture}
          onTriggerNativeCamera={() => fileInputRef.current?.click()}
        />
      )}
    </Card>
  );
}
