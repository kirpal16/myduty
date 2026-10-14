"use client";

import { useState } from "react";
import { PlusCircle } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";
import type { PrintOfficer } from "@/lib/reports/printReport";
import type { DbLeaveTypeItem, SanctionItem } from "@/lib/reports/reportTemplates";
import { CreateReportModal } from "./create-report-modal";

interface CreateReportButtonProps {
  officer: PrintOfficer | null;
  leaveTypes?: DbLeaveTypeItem[];
  sanctions?: SanctionItem[];
  className?: string;
}

export function CreateReportButton({
  officer,
  leaveTypes,
  sanctions,
  className = "",
}: CreateReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 whitespace-nowrap rounded-xl bg-indigo-600 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs shadow-indigo-600/30 transition-all hover:bg-indigo-500 active:scale-[0.98] cursor-pointer ${className}`}
        title={t.reports.createReportTooltip}
      >
        <PlusCircle className="size-4 shrink-0" />
        <span className="sm:hidden">{t.reports.newReportShort}</span>
        <span className="hidden sm:inline">{t.reports.newReportApplication}</span>
      </button>

      <CreateReportModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        officer={officer}
        leaveTypes={leaveTypes}
        sanctions={sanctions}
      />
    </>
  );
}
