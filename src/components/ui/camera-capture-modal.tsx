"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Camera,
  RefreshCw,
  X,
  Check,
  FlipHorizontal,
  ShieldAlert,
} from "lucide-react";
import { ModalPortal, MODAL_Z } from "@/components/ui/modal-portal";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";

export interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  /** Fallback trigger to invoke native device camera picker if preferred */
  onTriggerNativeCamera?: () => void;
}

/**
 * Attempts to retrieve a camera stream with progressive fallback:
 * 1. Ideal facingMode + 1080p resolution
 * 2. Ideal facingMode with default resolution
 * 3. Any available video device
 */
async function getCameraStream(mode: "environment" | "user"): Promise<MediaStream> {
  // Attempt 1: Ideal facingMode + High resolution
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: mode },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
  } catch (err1: unknown) {
    const e1 = err1 as { name?: string };
    if (
      e1.name === "NotAllowedError" ||
      e1.name === "PermissionDeniedError" ||
      e1.name === "SecurityError"
    ) {
      throw err1;
    }
  }

  // Attempt 2: Just facingMode
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: mode } },
      audio: false,
    });
  } catch (err2: unknown) {
    const e2 = err2 as { name?: string };
    if (
      e2.name === "NotAllowedError" ||
      e2.name === "PermissionDeniedError" ||
      e2.name === "SecurityError"
    ) {
      throw err2;
    }
  }

  // Attempt 3: Basic video fallback
  return await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  });
}

export function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
  onTriggerNativeCamera,
}: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const internalNativeInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [capturedBlobUrl, setCapturedBlobUrl] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  // Tracks whether the browser has permanently blocked camera ("denied" vs "prompt")
  const [permissionState, setPermissionState] = useState<PermissionState | null>(null);

  useBodyScrollLock(isOpen);

  // Stop media stream tracks cleanly
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const s = videoRef.current.srcObject as MediaStream;
      s.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setStream(null);
  }, []);

  // Check available camera devices when open
  useEffect(() => {
    if (!isOpen || typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      return;
    }
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        setHasMultipleCameras(videoInputs.length > 1);
      })
      .catch(() => setHasMultipleCameras(false));
  }, [isOpen]);

  /**
   * Query the browser permission state for camera.
   * Returns 'granted', 'denied', or 'prompt'. Falls back to null if unsupported.
   */
  const queryPermissionState = useCallback(async (): Promise<PermissionState | null> => {
    try {
      if (typeof navigator !== "undefined" && navigator.permissions?.query) {
        const status = await navigator.permissions.query({ name: "camera" as PermissionName });
        setPermissionState(status.state);
        return status.state;
      }
    } catch {
      // Permissions API not supported for camera in this browser
    }
    setPermissionState(null);
    return null;
  }, []);

  /**
   * Request camera access directly.
   * Calling this directly inside user click handlers guarantees that the
   * user-activation context is present so the browser triggers permission prompts.
   */
  const requestCameraAccess = useCallback(async () => {
    stopStream();
    setIsInitializing(true);
    setPermissionError(null);

    // Check for HTTPS / secure context
    if (
      typeof window !== "undefined" &&
      !window.isSecureContext &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      setPermissionError(
        "Camera access requires a secure connection (HTTPS). Please open this site over HTTPS or use the device camera button below.",
      );
      setIsInitializing(false);
      return;
    }

    // Check if getUserMedia is supported
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setPermissionError(
        "Live camera preview is not supported by your browser. Please tap below to use your device camera.",
      );
      setIsInitializing(false);
      return;
    }

    // Query current permission state before attempting getUserMedia
    const currentState = await queryPermissionState();

    try {
      // Directly invoke getUserMedia – browser will prompt if state is 'prompt'
      const newStream = await getCameraStream(facingMode);

      streamRef.current = newStream;
      setStream(newStream);
      setPermissionState("granted");

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {});
          setIsInitializing(false);
        };
        videoRef.current.play().catch(() => {});
      }

      // Failsafe timer: hide loader after 500ms even if onloadedmetadata is delayed
      setTimeout(() => {
        setIsInitializing(false);
      }, 500);
    } catch (err: unknown) {
      setIsInitializing(false);
      const error = err as { name?: string; message?: string };

      // Re-query permission state after the error to get accurate status
      const stateAfterError = await queryPermissionState();
      const isDenied = stateAfterError === "denied" || currentState === "denied";

      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError" ||
        error.name === "SecurityError"
      ) {
        if (isDenied) {
          // Browser has permanently blocked – prompt won't appear again
          setPermissionError(
            "Camera access is blocked by your browser. You need to manually allow camera in your browser's site settings, then tap the button below to retry.",
          );
        } else {
          // Permission was dismissed (not permanently denied) – prompt can re-appear
          setPermissionError(
            "Camera permission was not granted. Tap 'Allow Camera Access' to try again, or capture directly via your device camera app.",
          );
        }
      } else if (
        error.name === "NotFoundError" ||
        error.name === "DevicesNotFoundError"
      ) {
        setPermissionError("No camera device was detected on your system.");
      } else if (
        error.name === "NotReadableError" ||
        error.name === "TrackStartError"
      ) {
        setPermissionError(
          "Camera is currently in use by another application. Please close other camera apps and try again.",
        );
      } else if (error.name === "OverconstrainedError") {
        setPermissionError("Camera does not support the requested resolution or orientation.");
      } else {
        setPermissionError(
          error.message || "Failed to start camera. Please try again or use your device camera app.",
        );
      }
    }
  }, [facingMode, stopStream, queryPermissionState]);

  // Main lifecycle: trigger camera on open, cleanup on close
  useEffect(() => {
    if (!isOpen) {
      stopStream();
      setPermissionError(null);
      setIsInitializing(true);
      setCapturedBlobUrl(null);
      setCapturedFile(null);
      return;
    }

    void requestCameraAccess();

    return () => {
      stopStream();
    };
  }, [isOpen, requestCameraAccess, stopStream]);

  // Listen to browser permission state changes if supported
  useEffect(() => {
    if (!isOpen || typeof navigator === "undefined" || !navigator.permissions?.query) {
      return;
    }

    let isCancelled = false;
    navigator.permissions
      .query({ name: "camera" as PermissionName })
      .then((status) => {
        if (isCancelled) return;
        status.onchange = () => {
          if (status.state === "granted") {
            void requestCameraAccess();
          }
        };
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [isOpen, requestCameraAccess]);

  /**
   * User-triggered retry:
   * Directly invokes getUserMedia() right inside the click handler to provide
   * a fresh user gesture so the browser asks for permission again.
   *
   * If permission is permanently "denied", we still call getUserMedia() inside
   * the click handler – on some mobile browsers this is the only way to
   * re-trigger the native permission sheet.
   */
  const handleRetry = async () => {
    setCapturedBlobUrl(null);
    setCapturedFile(null);
    // Always call getUserMedia directly from the click handler for maximum
    // browser compatibility – this gives the best chance of re-prompting.
    await requestCameraAccess();
  };

  // Switch between back/environment and front/user camera
  const handleToggleFacingMode = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Open native camera app / file capture
  const handleTriggerDeviceCamera = () => {
    stopStream();
    if (onTriggerNativeCamera) {
      handleClose();
      onTriggerNativeCamera();
    } else {
      internalNativeInputRef.current?.click();
    }
  };

  // Capture current video frame
  const handleTakeSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
        const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");
        const filename = `camera_capture_${dateStr}_${timeStr}.jpg`;

        const file = new File([blob], filename, { type: "image/jpeg" });
        const blobUrl = URL.createObjectURL(blob);

        setCapturedFile(file);
        setCapturedBlobUrl(blobUrl);

        video.pause();
      },
      "image/jpeg",
      0.92,
    );
  };

  // Retake photo
  const handleRetake = () => {
    if (capturedBlobUrl) {
      URL.revokeObjectURL(capturedBlobUrl);
    }
    setCapturedBlobUrl(null);
    setCapturedFile(null);
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  // Confirm and return photo
  const handleConfirmPhoto = () => {
    if (capturedFile) {
      onCapture(capturedFile);
      stopStream();
      onClose();
    }
  };

  const handleClose = () => {
    stopStream();
    if (capturedBlobUrl) {
      URL.revokeObjectURL(capturedBlobUrl);
    }
    setCapturedBlobUrl(null);
    setCapturedFile(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      {/* Hidden fallback device file input for native camera capture */}
      <input
        ref={internalNativeInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            onCapture(f);
            handleClose();
          }
        }}
        className="hidden"
      />

      <div
        className={`fixed inset-0 ${MODAL_Z} flex items-center justify-center bg-black/85 p-3 sm:p-5 backdrop-blur-md animate-in fade-in-0 duration-150`}
        onClick={handleClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Camera Capture"
          className="relative flex flex-col w-full max-w-xl max-h-[92vh] overflow-hidden rounded-2xl sm:rounded-3xl border border-white/15 bg-slate-950 text-white shadow-2xl animate-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Camera className="size-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-semibold tracking-tight text-white">
                  {capturedBlobUrl ? "Review Captured Photo" : "Take Photo with Camera"}
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-400">
                  {capturedBlobUrl
                    ? "Check clarity before attaching to your record"
                    : "Position your document or receipt clearly in frame"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              title="Close Camera"
            >
              <X className="size-4.5" />
            </button>
          </div>

          {/* Viewfinder / Preview Body */}
          <div className="relative flex-1 min-h-[290px] sm:min-h-[380px] bg-black flex items-center justify-center overflow-hidden">
            {/* Live Video Viewfinder */}
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className={`w-full h-full object-contain max-h-[50vh] sm:max-h-[58vh] ${
                capturedBlobUrl ? "hidden" : "block"
              }`}
            />

            {/* Hidden canvas for snapshot rendering */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Captured Snapshot Review */}
            {capturedBlobUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={capturedBlobUrl}
                alt="Captured Snapshot"
                className="w-full h-full object-contain max-h-[50vh] sm:max-h-[58vh]"
              />
            )}

            {/* Viewfinder Guide Overlay */}
            {!capturedBlobUrl && !permissionError && !isInitializing && (
              <div className="absolute inset-4 sm:inset-8 border-2 border-white/30 border-dashed rounded-2xl pointer-events-none flex items-center justify-center">
                <span className="text-[10px] sm:text-[11px] text-white/70 bg-black/60 px-3 py-1 rounded-full backdrop-blur-xs font-medium border border-white/10">
                  Align document here
                </span>
              </div>
            )}

            {/* Initializing / Waiting for Permission Indicator */}
            {isInitializing && !permissionError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 text-slate-300 p-6 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400 animate-pulse border border-indigo-500/30">
                  <Camera className="size-7" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm font-semibold text-white">Starting camera…</p>
                  <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
                    If prompted by your browser, please click <span className="text-indigo-400 font-semibold">&quot;Allow&quot;</span> to grant camera access.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleTriggerDeviceCamera}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-slate-200 border border-white/15 transition-colors cursor-pointer"
                  >
                    <Camera className="size-3.5 text-indigo-400" />
                    <span>Or capture with phone camera app</span>
                  </button>
                </div>
              </div>
            )}

            {/* Explicit Permission Denied / Error State */}
            {permissionError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/95 space-y-4 overflow-y-auto">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <ShieldAlert className="size-7" />
                </div>

                <div className="max-w-md space-y-2">
                  <h4 className="text-sm sm:text-base font-bold text-white">
                    {permissionState === "denied"
                      ? "Camera Blocked by Browser"
                      : "Camera Permission Required"}
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {permissionError}
                  </p>

                  {/* Show detailed unlock instructions only when permanently denied */}
                  {permissionState === "denied" && (
                    <div className="mt-3 p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-300 text-left space-y-1.5">
                      <p className="font-semibold text-white flex items-center gap-1.5">
                        <span>💡</span>
                        <span>How to unlock camera access:</span>
                      </p>
                      <p className="text-slate-400 pl-4">
                        1. Tap the <strong className="text-white">lock icon (🔒)</strong> or site settings in your browser address bar.
                      </p>
                      <p className="text-slate-400 pl-4">
                        2. Change <strong className="text-white">Camera</strong> from &quot;Block&quot; to <strong className="text-emerald-400">&quot;Allow&quot;</strong>.
                      </p>
                      <p className="text-slate-400 pl-4">
                        3. Come back and tap <strong className="text-indigo-400">&quot;I&apos;ve Updated Settings – Retry&quot;</strong> below.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-xs font-bold text-white shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
                  >
                    <RefreshCw className="size-3.5" />
                    <span>
                      {permissionState === "denied"
                        ? "I've Updated Settings – Retry"
                        : "Allow Camera Access"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTriggerDeviceCamera}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-xs font-bold text-white shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                  >
                    <Camera className="size-3.5" />
                    <span>Capture with Camera App</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-slate-900/90 px-4 py-3 sm:px-6">
            {!capturedBlobUrl ? (
              <>
                {/* Switch camera button (front/back) */}
                <div className="w-16">
                  {hasMultipleCameras && !permissionError && (
                    <button
                      type="button"
                      onClick={handleToggleFacingMode}
                      className="flex items-center justify-center size-9 rounded-xl border border-white/15 text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      title="Flip Camera (Front/Rear)"
                    >
                      <FlipHorizontal className="size-4.5" />
                    </button>
                  )}
                </div>

                {/* Shutter Button */}
                <button
                  type="button"
                  disabled={Boolean(permissionError) || isInitializing}
                  onClick={handleTakeSnapshot}
                  className="flex items-center justify-center size-14 rounded-full border-4 border-white/30 bg-white hover:bg-slate-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg cursor-pointer"
                  title="Capture Photo"
                >
                  <div className="size-11 rounded-full bg-indigo-600 flex items-center justify-center text-white">
                    <Camera className="size-5" />
                  </div>
                </button>

                {/* Native camera fallback button */}
                <div className="w-16 flex justify-end">
                  <button
                    type="button"
                    onClick={handleTriggerDeviceCamera}
                    className="flex items-center justify-center px-2.5 py-1.5 rounded-xl border border-white/15 text-slate-300 hover:text-white hover:bg-white/10 text-[11px] font-semibold transition-colors cursor-pointer"
                    title="Open Phone Camera App"
                  >
                    <span>Phone</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between w-full gap-3">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/20 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <RefreshCw className="size-3.5" />
                  <span>Retake</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmPhoto}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  <Check className="size-4" />
                  <span>Use Photo</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
