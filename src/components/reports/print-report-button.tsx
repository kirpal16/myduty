"use client";

import { useEffect, useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import {
  printFileName,
  type PrintOfficer,
  type PrintReport,
} from "@/lib/reports/printReport";

/**
 * Print the current TA / Holiday Worked report.
 *
 * Everywhere that can, this is `window.print()` on THIS page — the print
 * view is already in the page (hidden on screen), so nothing navigates, no
 * new tab or window opens, and an installed app never hands off to an
 * external browser.
 *
 * An app added to an iPhone home screen cannot open the print dialog at all,
 * so there the same report is built as a PDF and given to the iOS Share
 * sheet, where "Print" and "Save to Files" live. Every failure becomes a
 * toast; nothing here can take the app down.
 */
import { ReportEditModal } from "./report-edit-modal";

export function PrintReportButton({
  report,
  officer,
}: {
  report: PrintReport;
  officer: PrintOfficer | null;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Warm the PDF library on the one platform that needs it, so the tap can
  // share inside its own user gesture (iOS refuses a share started later).
  useEffect(() => {
    if (!isIosHomeScreenApp()) return;
    import("@/lib/reports/printReportPdf")
      .then((m) => m.preloadPdfLib())
      .catch(() => {});
  }, []);

  // Update document.title on native print triggers (e.g. browser Ctrl+P)
  useEffect(() => {
    const origTitle = document.title;
    const handleBeforePrint = () => {
      const fileName = printFileName(report, officer);
      document.title = fileName.replace(/\.pdf$/i, "");
    };
    const handleAfterPrint = () => {
      document.title = origTitle;
    };
    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [report, officer]);

  const handleOpenEditModal = () => {
    setIsModalOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpenEditModal}
        disabled={busy}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-border bg-card px-2.5 py-2 text-xs font-semibold text-foreground shadow-2xs transition-colors hover:bg-muted disabled:opacity-60 cursor-pointer sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm"
        title="પ્રિન્ટ અને એડિટ કરો (Review & Print official letterhead)"
      >
        {busy ? <Loader2 className="size-4 shrink-0 animate-spin" /> : <Printer className="size-4 shrink-0" />}
        <span>પ્રિન્ટ / એડિટ (Print)</span>
      </button>

      <ReportEditModal
        initialReport={report}
        officer={officer}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}

function isIosHomeScreenApp(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS reports itself as a Mac.
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches === true;
  return isIos && standalone;
}

/** iOS Share sheet if it takes files; otherwise a same-window download. */
async function sharePdf(blob: Blob, fileName: string, title: string) {
  const file = new File([blob], fileName, { type: "application/pdf" });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (error) {
      if ((error as Error)?.name === "AbortError") throw error;
      // e.g. the gesture expired — fall through to a download instead.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
