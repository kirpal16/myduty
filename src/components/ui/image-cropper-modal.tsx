"use client";

import { useState, useCallback } from "react";
import Cropper, { type Area } from "react-easy-crop";
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  Check,
  CropIcon,
} from "lucide-react";

/* ─────────────────────────── helpers ─────────────────────────── */

async function getCroppedBlob(
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0,
  quality = 0.92
): Promise<Blob> {
  const image = await createImageBitmap(
    await fetch(imageSrc).then((r) => r.blob())
  );
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const maxSize = Math.max(image.width, image.height);
  canvas.width = maxSize;
  canvas.height = maxSize;

  ctx.translate(maxSize / 2, maxSize / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-image.width / 2, -image.height / 2);
  ctx.drawImage(image, 0, 0);

  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = pixelCrop.width;
  cropCanvas.height = pixelCrop.height;
  const cropCtx = cropCanvas.getContext("2d")!;

  cropCtx.drawImage(
    canvas,
    pixelCrop.x + (maxSize - image.width) / 2,
    pixelCrop.y + (maxSize - image.height) / 2,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    cropCanvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas is empty"))),
      "image/jpeg",
      quality
    );
  });
}

/* ───────────────────────── component ─────────────────────────── */

interface ImageCropperModalProps {
  isOpen: boolean;
  imageSrc: string;
  fileName: string;
  onClose: () => void;
  onCropped: (blob: Blob, croppedName: string) => void;
  aspect?: number;
}

export function ImageCropperModal({
  isOpen,
  imageSrc,
  fileName,
  onClose,
  onCropped,
  aspect = 1,
}: ImageCropperModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleApply = async () => {
    if (!croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels, rotation);
      const ext = fileName.split(".").pop() ?? "jpg";
      const croppedName = fileName.replace(/\.[^.]+$/, `_cropped.${ext}`);
      onCropped(blob, croppedName);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in-0 duration-200"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full sm:max-w-lg bg-card rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95dvh] sm:max-h-[90vh] animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <CropIcon className="size-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground leading-tight">Crop Image</h2>
              <p className="text-[10px] text-muted-foreground">Drag to position · Scroll or pinch to zoom</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Crop canvas */}
        <div className="relative bg-zinc-950" style={{ height: "340px" }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            showGrid
            style={{
              cropAreaStyle: {
                border: "2px solid rgba(99,102,241,0.9)",
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
              },
            }}
          />
        </div>

        {/* Controls */}
        <div className="px-5 py-4 space-y-3.5 shrink-0 border-t border-border/40">
          {/* Zoom */}
          <div className="flex items-center gap-3">
            <ZoomOut className="size-3.5 text-muted-foreground shrink-0" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-1.5 accent-indigo-600 cursor-pointer"
            />
            <ZoomIn className="size-3.5 text-muted-foreground shrink-0" />
            <span className="text-[10px] text-muted-foreground w-7 text-right tabular-nums">
              {zoom.toFixed(1)}×
            </span>
          </div>

          {/* Rotation */}
          <div className="flex items-center gap-3">
            <RotateCcw className="size-3.5 text-muted-foreground shrink-0" />
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              className="flex-1 h-1.5 accent-indigo-600 cursor-pointer"
            />
            <RotateCw className="size-3.5 text-muted-foreground shrink-0" />
            <span className="text-[10px] text-muted-foreground w-7 text-right tabular-nums">
              {rotation}°
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 pb-6 pt-1 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            Reset
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-sm shadow-indigo-600/30 transition-colors cursor-pointer"
            >
              <Check className="size-3.5" />
              {isProcessing ? "Processing…" : "Apply Crop"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
