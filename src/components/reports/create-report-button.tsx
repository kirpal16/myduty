"use client";

import { useState } from "react";
import { PlusCircle } from "lucide-react";
import type { PrintOfficer } from "@/lib/reports/printReport";
import type { DbLeaveTypeItem } from "@/lib/reports/reportTemplates";
import { CreateReportModal } from "./create-report-modal";

interface CreateReportButtonProps {
  officer: PrintOfficer | null;
  leaveTypes?: DbLeaveTypeItem[];
  className?: string;
}

export function CreateReportButton({
  officer,
  leaveTypes,
  className = "",
}: CreateReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 whitespace-nowrap rounded-xl bg-indigo-600 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs shadow-indigo-600/30 transition-all hover:bg-indigo-500 active:scale-[0.98] cursor-pointer ${className}`}
        title="નવો રિપોર્ટ / રજા અરજી બનાવો (Create Official Letter / Report)"
      >
        <PlusCircle className="size-4 shrink-0" />
        <span className="sm:hidden">+ નવો રિપોર્ટ</span>
        <span className="hidden sm:inline">+ નવો રિપોર્ટ / અરજી</span>
      </button>

      <CreateReportModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        officer={officer}
        leaveTypes={leaveTypes}
      />
    </>
  );
}
