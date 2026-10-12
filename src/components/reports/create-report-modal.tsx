"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Printer,
  X,
  CalendarDays,
  FileSpreadsheet,
  FileText,
  ShieldAlert,
  Award,
  PlusSquare,
  Check,
  RotateCcw,
  Copy,
  ChevronLeft,
  FileCheck,
  Eye,
  Edit3,
  Calendar,
  EyeOff,
  SlidersHorizontal,
  Shield,
  Layers,
  FileEdit,
  Building,
  User,
  Clock,
  CheckCircle2,
} from "lucide-react";
import {
  type CustomReportData,
  type ReportTemplateMeta,
  type DbLeaveTypeItem,
  type SanctionItem,
  REPORT_TEMPLATES,
  formatSegmentDateRange,
  formatSegmentsAsNarrativeParagraph,
  buildTableIntroParagraph,
  buildRelievingReportTexts,
} from "@/lib/reports/reportTemplates";
import { LeaveSegmentBuilder } from "./leave-segment-builder";
import type { PrintOfficer } from "@/lib/reports/printReport";
import { useToast } from "@/components/ui/toast";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import { useModalBackClose } from "@/lib/hooks/useModalBackClose";
import { toGujaratiNumerals, toAsciiNumerals, formatGujaratiDate } from "@/lib/reports/gujaratiReportUtils";

/** Escapes text written into the print HTML. */
const esc = (s?: string | null) =>
  s ? s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") : "";

/** Splits "વિષય:" prefix from text for authentic hanging indent layout */
function splitSubjectPrefix(val?: string | null): { prefix: string; text: string } {
  const clean = (val || "").trim();
  const match = clean.match(/^(વિષય\s*:\s*)(.*)$/i);
  if (match) {
    return { prefix: match[1], text: match[2].trim() };
  }
  return { prefix: "વિષય: ", text: clean };
}

/** Splits "સંદર્ભ:" prefix from text for authentic hanging indent layout */
function splitReferencePrefix(val?: string | null): { prefix: string; text: string } {
  const clean = (val || "").trim();
  const match = clean.match(/^(સંદર્ભ\s*:\s*)(.*)$/i);
  if (match) {
    return { prefix: match[1], text: match[2].trim() };
  }
  return { prefix: "સંદર્ભ: ", text: clean };
}

interface CreateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  officer: PrintOfficer | null;
  leaveTypes?: DbLeaveTypeItem[];
  sanctions?: SanctionItem[];
}

export function CreateReportModal({
  isOpen,
  onClose,
  officer,
  leaveTypes,
  sanctions,
}: CreateReportModalProps) {
  const { toast } = useToast();
  useBodyScrollLock(isOpen);
  useModalBackClose(isOpen, onClose);

  // Screen Step: 1 = Template Selector, 2 = Editor & Live Preview
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("leave_application");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Mobile view tab in Step 2: "edit" or "preview"
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");

  // Sub-section filter in Editor: "leave" | "relieve" | "content" | "header" | "all"
  const [activeSection, setActiveSection] = useState<"leave" | "relieve" | "content" | "header" | "all">("all");

  // Sanction / Relieving specific fields state
  const [relieveAuthority, setRelieveAuthority] = useState<string>("મહેરબાન પોલીસ અધિક્ષકશ્રી");
  const [relieveOrderNo, setRelieveOrderNo] = useState<string>("૧૨૩/૨૦૨૬");
  const [relieveOrderDate, setRelieveOrderDate] = useState<string>("");
  const [relieveLeaveType, setRelieveLeaveType] = useState<string>("બિનપગારી રજા");
  const [relieveDays, setRelieveDays] = useState<string | number>(15);
  const [relieveStartDate, setRelieveStartDate] = useState<string>("");
  const [relieveEndDate, setRelieveEndDate] = useState<string>("");
  const [relieveDateTime, setRelieveDateTime] = useState<string>("");
  const [relieveChargeOfficer, setRelieveChargeOfficer] = useState<string>("");
  const [relieveHeadquarterPlace, setRelieveHeadquarterPlace] = useState<string>("નોકરીનું સ્થળ");
  const [selectedSanctionId, setSelectedSanctionId] = useState<string>("");

  // Form State
  const [reportData, setReportData] = useState<CustomReportData>(() => {
    const t = REPORT_TEMPLATES[0];
    const d = t.buildDefaults(officer, true);
    d.showLogo = true;
    return d;
  });

  // Toggles
  const [useGujaratiDigits, setUseGujaratiDigits] = useState<boolean>(true);
  const [includeSignature, setIncludeSignature] = useState<boolean>(false);
  const [highlightSubject, setHighlightSubject] = useState<boolean>(false);

  // Number converter helper based on current toggle
  const numFn = (val: number | string) =>
    useGujaratiDigits ? toGujaratiNumerals(val) : toAsciiNumerals(val);

  // Initialize or reset ONLY when modal opens (not when digits or settings toggle)
  useEffect(() => {
    if (!isOpen) return;
    const defaultTpl = REPORT_TEMPLATES[0];
    setSelectedTemplateId(defaultTpl.id);
    const initial = defaultTpl.buildDefaults(officer, useGujaratiDigits);
    initial.showHeader = true;
    initial.showLogo = true;
    initial.leaveDisplayFormat = "table";
    initial.leaveReasonMode = initial.leaveReasonMode || "same";
    initial.commonReason = initial.commonReason || "અંગત તથા કૌટુંબિક કામ સબબ";
    setReportData(initial);
    setStep(1);
    setMobileTab("edit");
    setActiveSection("all");
    setIncludeSignature(false);
    setHighlightSubject(false);

    // Reset relieving state
    setSelectedSanctionId("");
    setRelieveAuthority("મહેરબાન પોલીસ અધિક્ષકશ્રી");
    setRelieveOrderNo(useGujaratiDigits ? toGujaratiNumerals("123/2026") : "123/2026");
    setRelieveOrderDate("");
    setRelieveLeaveType("બિનપગારી રજા");
    setRelieveDays(15);
    setRelieveStartDate("");
    setRelieveEndDate("");
    setRelieveDateTime("");
    setRelieveChargeOfficer("");
    const nokariPlace = (officer?.posting && officer.posting !== "પોલીસ સ્ટેશન")
      ? officer.posting.trim()
      : "નોકરીનું સ્થળ";
    setRelieveHeadquarterPlace(nokariPlace);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Load a chosen template
  const handleSelectTemplate = (tpl: ReportTemplateMeta) => {
    setSelectedTemplateId(tpl.id);
    const initialData = tpl.buildDefaults(officer, useGujaratiDigits);
    initialData.includeSignature = includeSignature;
    initialData.showLogo = reportData.showLogo !== false;
    initialData.showHeader = reportData.showHeader !== false;
    setReportData(initialData);
    setStep(2);
    setMobileTab("edit");
    setActiveSection("all");
    const nokariPlace = (officer?.posting && officer.posting !== "પોલીસ સ્ટેશન")
      ? officer.posting.trim()
      : "નોકરીનું સ્થળ";
    setRelieveHeadquarterPlace(nokariPlace);
  };

  // Helper to update specific reportData field
  const updateField = <K extends keyof CustomReportData>(
    field: K,
    val: CustomReportData[K],
  ) => {
    setReportData((prev) => ({ ...prev, [field]: val }));
  };

  // Digits toggle handler
  const handleToggleDigits = () => {
    const nextVal = !useGujaratiDigits;
    setUseGujaratiDigits(nextVal);
    updateField("useGujaratiDigits", nextVal);

    // Convert digits in buckle, date, and subject if present
    setReportData((prev) => ({
      ...prev,
      useGujaratiDigits: nextVal,
      signatoryBuckle: nextVal
        ? toGujaratiNumerals(prev.signatoryBuckle)
        : toAsciiNumerals(prev.signatoryBuckle),
    }));
  };

  const isRelievingReport = reportData.templateId === "leave_relieving";

  // Select an approved sanction from database
  const handleSelectSanction = (sanctionId: string) => {
    setSelectedSanctionId(sanctionId);
    const found = sanctions?.find((s) => s.id === sanctionId);
    if (!found) return;

    const ordNo = found.order_no || "";
    const ordDate = found.approved_date || "";
    const auth = found.approved_by || "મહેરબાન પોલીસ અધિક્ષકશ્રી";
    const lName =
      found.leave_types?.name ||
      (found.leave_types?.code === "LWP" ? "બિનપગારી રજા" : "ખાસ રજા");
    const dCount = found.approved_days || 15;
    const start = found.valid_from || "";
    const end = found.valid_to || "";
    const relTime = start
      ? `તારીખ ${formatGujaratiDate(start, { useGujaratiDigits })} ના રોજ સાંજે ફરજ પૂર્ણ થયેથી`
      : "સાંજે ફરજ પૂર્ણ થયેથી";

    setRelieveOrderNo(ordNo);
    setRelieveOrderDate(ordDate);
    setRelieveAuthority(auth);
    setRelieveLeaveType(lName);
    setRelieveDays(dCount);
    setRelieveStartDate(start);
    setRelieveEndDate(end);
    setRelieveDateTime(relTime);

    const texts = buildRelievingReportTexts({
      authority: auth,
      orderNo: ordNo,
      orderDate: ordDate,
      leaveType: lName,
      days: dCount,
      startDate: start,
      endDate: end,
      relieveDateTime: relTime,
      chargeOfficer: relieveChargeOfficer,
      headquarterPlace: relieveHeadquarterPlace,
      showReference: reportData.showReference !== false,
      referencePosition: reportData.referencePosition || "above",
      referenceShowLine: reportData.referenceShowLine === true,
      useDigits: useGujaratiDigits,
    });

    setReportData((prev) => ({
      ...prev,
      reference: texts.reference,
      showReference: texts.showReference,
      referencePosition: texts.referencePosition,
      referenceShowLine: texts.referenceShowLine,
      subject: texts.subject,
      paragraph1: texts.paragraph1,
      paragraph2: texts.paragraph2,
    }));

    toast("મંજૂર ઓર્ડર વિગતો પત્રમાં સફળતાપૂર્વક લાગુ થઈ ગઈ!");
  };

  // Re-generate relieving text from fields
  const handleApplyRelievingTexts = () => {
    const texts = buildRelievingReportTexts({
      authority: relieveAuthority,
      orderNo: relieveOrderNo,
      orderDate: relieveOrderDate,
      leaveType: relieveLeaveType,
      days: relieveDays,
      startDate: relieveStartDate,
      endDate: relieveEndDate,
      relieveDateTime,
      chargeOfficer: relieveChargeOfficer,
      headquarterPlace: relieveHeadquarterPlace,
      showReference: reportData.showReference !== false,
      referencePosition: reportData.referencePosition || "above",
      referenceShowLine: reportData.referenceShowLine === true,
      useDigits: useGujaratiDigits,
    });

    setReportData((prev) => ({
      ...prev,
      reference: texts.reference,
      showReference: texts.showReference,
      referencePosition: texts.referencePosition,
      referenceShowLine: texts.referenceShowLine,
      subject: texts.subject,
      paragraph1: texts.paragraph1,
      paragraph2: texts.paragraph2,
    }));

    toast("રજા પર છૂટા કરવા રિપોર્ટનું લખાણ અપડેટ થઈ ગયું!");
  };

  // Reset to default for current template
  const handleResetToDefault = () => {
    const tpl = REPORT_TEMPLATES.find((t) => t.id === selectedTemplateId) || REPORT_TEMPLATES[0];
    const fresh = tpl.buildDefaults(officer, useGujaratiDigits);
    fresh.includeSignature = includeSignature;
    fresh.showLogo = true;
    fresh.showHeader = true;
    setReportData(fresh);
    toast("ટેમ્પ્લેટ રીસેટ થઈ ગયું (Reset to defaults)");
  };

  // Copy entire text to clipboard
  const handleCopyText = async () => {
    try {
      const parts: string[] = [];
      if (reportData.showHeader) {
        parts.push(reportData.headerLine1);
        if (reportData.headerLine2) parts.push(reportData.headerLine2);
      }
      parts.push("\n" + reportData.toLines);
      if (reportData.applicantLine) parts.push("\n" + reportData.applicantLine);
      parts.push("\n" + reportData.subject);
      if (reportData.reference) parts.push(reportData.reference);
      parts.push("\n" + reportData.salutation);
      parts.push(reportData.paragraph1);

      if (
        reportData.leaveDisplayFormat !== "paragraph" &&
        reportData.leaveSegments &&
        reportData.leaveSegments.length > 0
      ) {
        parts.push("\n[રજા વિગત]:");
        reportData.leaveSegments.forEach((seg, i) => {
          const dateStr = formatSegmentDateRange(seg.startDate, seg.endDate, useGujaratiDigits);
          parts.push(`${numFn(i + 1)}. ${dateStr} - ${seg.shortLabel} (${numFn(seg.days)} દિવસ)`);
        });
      }

      if (reportData.paragraph2) parts.push("\n" + reportData.paragraph2);
      if (reportData.paragraph3) parts.push("\n" + reportData.paragraph3);

      parts.push(`\nતારીખ: ${reportData.reportDate}`);
      parts.push(`સ્થળ: ${reportData.place}`);
      parts.push(`\nલિ. આપનો વિશ્વાસુ,\n${reportData.signatoryName}`);
      parts.push(`${reportData.signatoryRank} ${reportData.signatoryBuckle}`);
      if (reportData.signatoryStation) parts.push(reportData.signatoryStation);

      const fullText = parts.join("\n");
      await navigator.clipboard.writeText(fullText);
      toast("અરજીનું લખાણ કોપી થઈ ગયું! (Copied to clipboard)");
    } catch {
      toast("લખાણ કોપી કરવામાં ક્ષતિ (Copy failed)", "error");
    }
  };

  // Native Print Execution
  const handlePrint = () => {
    const origTitle = document.title;
    const cleanTitle = `${reportData.templateTitle}_${reportData.signatoryName || "Officer"}`
      .replace(/\s+/g, "_")
      .replace(/[^\w\u0A80-\u0AFF_-]/g, "");

    document.title = cleanTitle;

    const cleanup = () => {
      document.title = origTitle;
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);

    // Injected printable layout
    let mount = document.getElementById("custom-report-print-mount");
    if (!mount) {
      mount = document.createElement("div");
      mount.id = "custom-report-print-mount";
      document.body.appendChild(mount);
    }

    const subjectPart = splitSubjectPrefix(reportData.subject);
    const refPart = splitReferencePrefix(reportData.reference);

    const segmentsHtml =
      reportData.leaveDisplayFormat !== "paragraph" &&
        reportData.leaveSegments &&
        reportData.leaveSegments.length > 0
        ? `
        <div style="margin: 8px 0;">
          <table class="w-full border-collapse border border-gray-400" style="font-size: 10.5pt; line-height: 1.35;">
            <thead>
              <tr class="bg-gray-100 text-gray-900 border-b border-gray-400">
                <th class="p-1.5 text-center w-8 border-r border-gray-400">અ.નં.</th>
                <th class="p-1.5 text-left border-r border-gray-400">તારીખ (ગાળો)</th>
                <th class="p-1.5 text-left border-r border-gray-400">રજાનો પ્રકાર</th>
                <th class="p-1.5 text-center w-16 border-r border-gray-400">દિવસ</th>
                <th class="p-1.5 text-left">કારણ / શેરો</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.leaveSegments
          .map((seg, idx) => {
            const range = formatSegmentDateRange(seg.startDate, seg.endDate, useGujaratiDigits);
            const sessionLabel =
              seg.halfDaySession === "PM" || seg.halfDaySession === "second_half"
                ? "દ્વિતીય સત્ર / બપોર"
                : "પ્રથમ સત્ર / સવાર";
            const timePart = seg.halfDayTime ? ` - ${seg.halfDayTime}` : "";
            const typeLabel = seg.isHalfDay
              ? `${seg.shortLabel || seg.leaveTypeName} (અડધો દિવસ - ${sessionLabel}${timePart})`
              : (seg.shortLabel || seg.leaveTypeName);
            const daysDisplay = seg.isHalfDay
              ? (useGujaratiDigits ? "૦.૫" : "0.5")
              : numFn(seg.days);
            return `
                  <tr class="border-b border-gray-300">
                    <td class="p-1.5 text-center font-bold border-r border-gray-300">${numFn(idx + 1)}</td>
                    <td class="p-1.5 border-r border-gray-300 font-semibold">${esc(range)}</td>
                    <td class="p-1.5 border-r border-gray-300 font-semibold">${esc(typeLabel)}</td>
                    <td class="p-1.5 text-center font-bold border-r border-gray-300">${daysDisplay}</td>
                    <td class="p-1.5">${esc(seg.reason || reportData.commonReason || "—")}</td>
                  </tr>
                `;
          })
          .join("")}
              <tr class="bg-gray-50 font-bold border-t border-gray-400">
                <td colspan="3" class="p-1.5 text-right border-r border-gray-300">કુલ રજા દિવસ:</td>
                <td class="p-1.5 text-center border-r border-gray-300 font-bold">${numFn(
            Math.round(reportData.leaveSegments.reduce((sum, s) => sum + (Number(s.days) || 0), 0) * 10) / 10,
          )}</td>
                <td class="p-1.5"></td>
              </tr>
            </tbody>
          </table>
        </div>
      `
        : "";

    mount.innerHTML = `
      <style>
        @page {
          size: A4 portrait;
          margin: 0 !important;
        }
        @media screen {
          #custom-report-print-mount { display: none !important; }
        }
        @media print {
          body > *:not(#custom-report-print-mount) {
            display: none !important;
          }
          #custom-report-print-mount {
            display: block !important;
            background: white !important;
            color: black !important;
            font-family: 'Shruti', 'Gujarati MT', 'Noto Sans Gujarati', 'Noto Serif Gujarati', serif !important;
            font-size: 12pt !important;
            line-height: 1.55 !important;
            width: 100% !important;
          }
          .custom-rp-a4 {
            width: 100% !important;
            padding: ${reportData.showHeader ? "16mm 14mm 14mm 16mm" : "26mm 14mm 14mm 16mm"} !important;
            box-sizing: border-box !important;
          }
        }
      </style>
      <div class="custom-rp-a4">
        <!-- Header: Hidden if showHeader is false -->
        ${reportData.showHeader
        ? `
          <div class="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
            ${reportData.showLogo !== false
          ? `
              <div style="width: 44px; flex-shrink: 0; display: flex; align-items: center; justify-content: flex-start;">
                <img src="/Gujarat-police.png" alt="Gujarat Police Logo" width="42" height="54" style="width: 42px; height: 54px; object-fit: contain; aspect-ratio: 1542/2000; display: block;" />
              </div>
            `
          : `<div style="width: 8px; flex-shrink: 0;"></div>`
        }
            <div class="text-center flex-1 mx-2">
              <h1 style="font-size: 14pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; line-height: 1.25; margin: 0;">${esc(reportData.headerLine1)}</h1>
              ${reportData.headerLine2 ? `<p style="font-size: 11pt; font-weight: 600; margin: 2px 0 0 0; color: #1f2937;">${esc(reportData.headerLine2)}</p>` : ""}
            </div>
            <div style="width: ${reportData.showLogo !== false ? "44px" : "8px"}; flex-shrink: 0;"></div>
          </div>
        `
        : `<!-- Header suppressed for pre-printed letterhead -->`
      }

        <!-- To -->
        <div class="whitespace-pre-line" style="font-size: 12pt; line-height: 1.45; margin-bottom: 10px;">
          ${esc(reportData.toLines)}
        </div>

        <!-- Applicant Line (clean without start line) -->
        ${reportData.applicantLine
        ? `<div style="font-size: 12pt; font-weight: 700; color: #111827; margin-bottom: 12px; line-height: 1.45;">${esc(reportData.applicantLine)}</div>`
        : ""
      }

        <!-- Subject (centered container with hanging indent so 2nd line starts from the start) -->
        <div style="display: flex; justify-content: center; margin: 12px 0 10px 0;">
          <div style="display: flex; align-items: flex-start; max-width: 95%; text-align: left;">
            <span style="font-size: 12pt; font-weight: 800; white-space: nowrap; margin-right: 6px; color: #000; line-height: 1.42;">${esc(subjectPart.prefix)}</span>
            <span style="font-size: 12pt; font-weight: 800; color: #000; line-height: 1.42; letter-spacing: -0.01em;">${esc(subjectPart.text)}</span>
          </div>
        </div>

        <!-- Reference (Upper: below subject with hanging indent) -->
        ${reportData.showReference !== false && reportData.referencePosition !== "below" && reportData.reference
        ? `
        <div style="display: flex; justify-content: center; margin-bottom: 10px;">
          <div style="display: flex; align-items: flex-start; max-width: 95%; text-align: left;">
            <span style="font-size: 11pt; font-weight: 600; white-space: nowrap; margin-right: 6px; color: #1f2937; line-height: 1.4;">${esc(refPart.prefix)}</span>
            <span style="font-size: 11pt; font-weight: 600; color: #374151; line-height: 1.4; letter-spacing: -0.01em;">${esc(refPart.text)}</span>
          </div>
        </div>
        `
        : ""
      }

        <!-- Salutation & Body -->
        <div style="font-size: 12pt; font-weight: 700; margin-top: 12px; margin-bottom: 4px;">${esc(reportData.salutation)}</div>
        <p style="font-size: 12pt; line-height: 1.55; text-align: justify; margin: 0 0 8px 0; text-indent: 2.5em;">${esc(reportData.paragraph1)}</p>

        <!-- Leave Breakdown Table if exists & mode is table or both -->
        ${segmentsHtml}

        <!-- Paragraph 2 -->
        ${reportData.paragraph2
        ? `<p style="font-size: 12pt; line-height: 1.55; text-align: justify; margin: 0 0 8px 0; text-indent: 2.5em;">${esc(reportData.paragraph2)}</p>`
        : ""
      }

        <!-- Paragraph 3 -->
        ${reportData.paragraph3
        ? `<p style="font-size: 12pt; line-height: 1.55; text-align: justify; margin: 0 0 8px 0; text-indent: 2.5em;">${esc(reportData.paragraph3)}</p>`
        : ""
      }

        <!-- Reference (Lower: below paragraphs with hanging indent) -->
        ${reportData.showReference !== false && reportData.referencePosition === "below" && reportData.reference
        ? `
        <div style="display: flex; align-items: flex-start; margin-top: 12px; margin-bottom: 8px; text-align: left; ${reportData.referenceShowLine ? "border-top: 1px dashed #6b7280; padding-top: 6px;" : ""}">
          <span style="font-size: 11pt; font-weight: 600; white-space: nowrap; margin-right: 6px; color: #1f2937; line-height: 1.4;">${esc(refPart.prefix)}</span>
          <span style="font-size: 11pt; font-weight: 600; color: #374151; line-height: 1.4; letter-spacing: -0.01em;">${esc(refPart.text)}</span>
        </div>
        `
        : ""
      }

        <!-- Footer -->
        <div class="break-inside-avoid" style="margin-top: 20px; padding-top: 8px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11.5pt;">
          <div style="line-height: 1.4;">
            <p style="margin: 0 0 2px 0;"><strong>તારીખ:</strong> ${esc(reportData.reportDate)}</p>
            <p style="margin: 0;"><strong>સ્થળ:</strong> ${esc(reportData.place)}</p>
          </div>

          <div style="text-align: right;">
            <p style="font-weight: 700; font-size: 12pt; margin: 0 0 2px 0;">લિ. આપનો વિશ્વાસુ,</p>
            ${includeSignature && officer?.signatureUrl
        ? `
              <div style="height: 36px; margin: 2px 0; display: flex; justify-content: flex-end; align-items: center;">
                <img src="${officer.signatureUrl}" alt="Signature" style="height: 36px; width: auto; max-width: 140px; object-fit: contain; mix-blend-mode: multiply;" />
              </div>
            `
        : `<div style="height: 18px;"></div>`
      }
            <p style="font-weight: 800; font-size: 12.5pt; line-height: 1.25; margin: 0 0 2px 0;">${esc(reportData.signatoryName)}</p>
            <p style="font-weight: 600; font-size: 11.5pt; margin: 0; color: #1f2937;">${esc(reportData.signatoryRank)} ${esc(reportData.signatoryBuckle)}</p>
          </div>
        </div>
      </div>
    `;

    try {
      window.print();
    } catch {
      toast("પ્રિન્ટ ઉપલબ્ધ નથી (Print failed)", "error");
    } finally {
      setTimeout(() => {
        document.title = origTitle;
      }, 1500);
    }
  };

  // Filter templates list by category
  const filteredTemplates = useMemo(() => {
    if (categoryFilter === "all") return REPORT_TEMPLATES;
    return REPORT_TEMPLATES.filter((t) => t.category === categoryFilter);
  }, [categoryFilter]);

  const hasLeaveSegments = Boolean(reportData.leaveSegments && reportData.leaveSegments.length > 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4 backdrop-blur-xs print:hidden animate-in fade-in duration-150">
      <div className="flex h-[95vh] w-full max-w-[96vw] xl:max-w-7xl 2xl:max-w-[1440px] flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Top Navbar */}
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5 bg-muted/40 sm:px-6 sm:py-3 shrink-0 gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-colors cursor-pointer"
                title="બીજું ટેમ્પ્લેટ પસંદ કરો (Back to templates)"
              >
                <ChevronLeft className="size-4.5" />
              </button>
            )}

            <div className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400">
              <FileCheck className="size-4 sm:size-5" />
            </div>

            <div className="min-w-0">
              <h2 className="text-xs sm:text-base font-bold text-foreground flex items-center gap-1.5 truncate">
                {step === 1 ? (
                  <span>નવો રિપોર્ટ / લેટર બનાવો (Create Official Letter)</span>
                ) : (
                  <>
                    <span className="truncate">{reportData.templateTitle}</span>
                    <span className="text-[10px] bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full font-semibold shrink-0">
                      સંપાદન &amp; પ્રિન્ટ
                    </span>
                  </>
                )}
              </h2>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                {step === 1
                  ? "ગુજરાત પોલીસ અધિકૃત પત્ર વ્યવહાર અને રજા ટેમ્પ્લેટ પસંદ કરો."
                  : "તમામ વિગતો સરળતાથી એડિટ કરી શકાય છે અને લાઈવ પ્રિવ્યુ જોઈ શકાય છે."}
              </p>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {step === 2 && (
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
              >
                <Printer className="size-3.5 shrink-0" />
                <span className="hidden sm:inline">પ્રિન્ટ / PDF</span>
                <span className="sm:hidden">પ્રિન્ટ</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="બંધ કરો (Close)"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Dedicated Mobile View Switcher Sub-Bar (Step 2) */}
        {step === 2 && (
          <div className="flex lg:hidden items-center border-b border-border bg-card px-3 py-1.5 shrink-0 shadow-2xs">
            <div className="grid grid-cols-2 w-full rounded-xl bg-muted p-1 border border-border/80 text-xs">
              <button
                type="button"
                onClick={() => setMobileTab("edit")}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 font-bold transition-all cursor-pointer ${mobileTab === "edit"
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                <Edit3 className="size-3.5" />
                <span>એડિટ કરો (Edit)</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileTab("preview")}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 font-bold transition-all cursor-pointer ${mobileTab === "preview"
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                <Eye className="size-3.5" />
                <span>લાઈવ પ્રિવ્યુ (Preview)</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 1: Template Selection Screen */}
        {step === 1 && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-background">
            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-3">
              {[
                { id: "all", label: "તમામ ફોર્મેટ (All)" },
                { id: "leave", label: "રજા અરજી (Leaves)" },
                { id: "duty", label: "કામગીરી અહેવાલ (Duty)" },
                { id: "official", label: "સત્તાવાર પત્રો (Official)" },
                { id: "custom", label: "કોરો લેટર (Blank)" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${categoryFilter === cat.id
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Templates Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredTemplates.map((tpl) => {
                const isSelected = selectedTemplateId === tpl.id;
                return (
                  <div
                    key={tpl.id}
                    onClick={() => handleSelectTemplate(tpl)}
                    className={`group relative flex flex-col justify-between rounded-2xl border p-4 sm:p-5 transition-all duration-150 cursor-pointer ${isSelected
                      ? "border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-md ring-2 ring-indigo-500/20"
                      : "border-border bg-card hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm"
                      }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                          {tpl.iconName === "CalendarDays" && <CalendarDays className="size-5" />}
                          {tpl.iconName === "FileSpreadsheet" && <FileSpreadsheet className="size-5" />}
                          {tpl.iconName === "Award" && <Award className="size-5" />}
                          {tpl.iconName === "ShieldAlert" && <ShieldAlert className="size-5" />}
                          {tpl.iconName === "FileText" && <FileText className="size-5" />}
                          {tpl.iconName === "PlusSquare" && <PlusSquare className="size-5" />}
                        </div>

                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tpl.id === "leave_application"
                            ? "bg-indigo-600 text-white shadow-xs"
                            : tpl.id === "leave_relieving"
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-muted text-muted-foreground"
                            }`}
                        >
                          {tpl.badge}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {tpl.titleGu}
                        </h3>
                        <p className="text-[11px] font-medium text-muted-foreground">{tpl.titleEn}</p>
                      </div>

                      <p className="text-xs text-muted-foreground/90 leading-relaxed line-clamp-3">
                        {tpl.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      <span>આ ફોર્મેટ પસંદ કરો</span>
                      <span className="transition-transform group-hover:translate-x-1">→</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2: Dual Editor & Live A4 Preview */}
        {step === 2 && (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-background">
            {/* LEFT PANE: Form Inputs */}
            <div
              className={`w-full lg:w-[48%] xl:w-[46%] 2xl:w-[45%] flex flex-col border-r border-border overflow-y-auto p-4 sm:p-5 space-y-4 ${mobileTab === "preview" ? "hidden lg:flex" : "flex"
                }`}
            >
              {/* Quick Controls Deck */}
              <div className="rounded-2xl border border-border/80 bg-gradient-to-r from-muted/40 via-card to-muted/40 p-2.5 sm:p-3 shadow-xs text-xs backdrop-blur-xs space-y-2">
                <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <SlidersHorizontal className="size-3 text-indigo-500" />
                    <span>કંટ્રોલ પેનલ (Settings)</span>
                  </span>
                  {/* Reset button */}
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border/70 hover:bg-muted text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-2xs"
                    title="ટેમ્પ્લેટ રીસેટ કરો"
                  >
                    <RotateCcw className="size-3" />
                    <span>રીસેટ (Reset)</span>
                  </button>
                </div>

                {/* Symmetrical 2x2 on Mobile, Flex on Desktop */}
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 sm:gap-2">
                  {/* Police Logo Toggle */}
                  <button
                    type="button"
                    onClick={() => updateField("showLogo", reportData.showLogo === false ? true : false)}
                    className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-2xs ${reportData.showLogo !== false
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-indigo-600/25"
                      : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                      }`}
                    title="ગુજરાત પોલીસ લોગો ચાલુ / બંધ કરો"
                  >
                    <Shield className="size-3.5 shrink-0" />
                    <span>લોગો</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${reportData.showLogo !== false
                        ? "bg-white/20 text-white"
                        : "bg-muted text-muted-foreground"
                        }`}
                    >
                      {reportData.showLogo !== false ? "ON" : "OFF"}
                    </span>
                  </button>

                  {/* Hide Header Toggle */}
                  <button
                    type="button"
                    onClick={() => updateField("showHeader", !reportData.showHeader)}
                    className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-2xs ${!reportData.showHeader
                      ? "bg-amber-600 text-white border-amber-600 shadow-amber-600/25"
                      : "bg-card text-foreground border-border hover:bg-muted"
                      }`}
                    title="પહેલેથી છપાયેલ કાગળ માટે હેડર છુપાવો"
                  >
                    {reportData.showHeader ? (
                      <Eye className="size-3.5 text-indigo-500 shrink-0" />
                    ) : (
                      <EyeOff className="size-3.5 shrink-0" />
                    )}
                    <span>હેડર</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${!reportData.showHeader
                        ? "bg-white/20 text-white"
                        : "bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400"
                        }`}
                    >
                      {!reportData.showHeader ? "છુપાવેલ" : "સામાન્ય"}
                    </span>
                  </button>

                  {/* Signature Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      const next = !includeSignature;
                      setIncludeSignature(next);
                      updateField("includeSignature", next);
                    }}
                    className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-2xs ${includeSignature
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-emerald-600/25"
                      : "bg-card text-foreground border-border hover:bg-muted"
                      }`}
                    title={
                      officer?.signatureUrl
                        ? "રિપોર્ટમાં તમારી ડિજિટલ સહી ઉમેરો"
                        : "પ્રોફાઈલમાં સહી અપલોડ થયેલ નથી"
                    }
                  >
                    <Check
                      className={`size-3.5 shrink-0 ${includeSignature ? "text-white" : "text-muted-foreground"
                        }`}
                    />
                    <span>સહી</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${includeSignature
                        ? "bg-white/20 text-white"
                        : "bg-muted text-muted-foreground"
                        }`}
                    >
                      {includeSignature ? "ON" : "OFF"}
                    </span>
                  </button>

                  {/* Gujarati Digits Toggle */}
                  <button
                    type="button"
                    onClick={handleToggleDigits}
                    className={`flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-2xs ${useGujaratiDigits
                      ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-400/50"
                      : "bg-card text-foreground border-border hover:bg-muted"
                      }`}
                    title="ગુજરાતી કે અંગ્રેજી અંકો"
                  >
                    <span>{useGujaratiDigits ? "અંકો: ૧ ૨ ૩" : "Digits: 1 2 3"}</span>
                  </button>
                </div>
              </div>

              {/* ALWAYS VISIBLE 1: Executive Subject (વિષય) */}
              <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-50/70 via-purple-50/30 to-background dark:from-indigo-950/35 dark:via-background dark:to-purple-950/20 p-3 sm:p-3.5 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                    <span className="flex size-2 rounded-full bg-indigo-600 animate-pulse" />
                    <span>વિષય (Subject)</span>
                  </label>
                  <span className="text-[10px] bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md font-bold border border-indigo-500/20">
                    અધિકૃત વિષય લાઇન
                  </span>
                </div>
                <input
                  type="text"
                  value={reportData.subject}
                  onChange={(e) => updateField("subject", e.target.value)}
                  className={`w-full rounded-xl border p-2.5 text-xs font-bold text-foreground outline-none shadow-2xs leading-relaxed transition-all duration-300 ${highlightSubject
                    ? "border-emerald-500 ring-2 ring-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/40"
                    : "border-indigo-300/80 dark:border-indigo-700/70 bg-card focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    }`}
                  placeholder="વિષય: રજા મંજૂર કરવા બાબત."
                />
              </div>

              {/* ALWAYS VISIBLE 2: To (પ્રતિ) & From (અરજદાર) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* To (પ્રતિ) */}
                <div className="rounded-xl border border-border/80 bg-card p-3 space-y-1.5 shadow-2xs">
                  <label className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Building className="size-3.5 text-indigo-500" />
                      <span>પ્રતિ (To / Recipient)</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground font-normal">હોદ્દો / કચેરી</span>
                  </label>
                  <textarea
                    rows={2}
                    value={reportData.toLines}
                    onChange={(e) => updateField("toLines", e.target.value)}
                    className="w-full rounded-lg border border-input bg-background/50 p-2 text-xs font-medium focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 leading-relaxed shadow-2xs"
                    placeholder="પ્રતિ,&#10;પોલીસ સબ ઇન્સપેક્ટરશ્રી..."
                  />
                </div>

                {/* From / Applicant (અરજદાર) */}
                <div className="rounded-xl border border-border/80 bg-card p-3 space-y-1.5 shadow-2xs">
                  <label className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <User className="size-3.5 text-purple-500" />
                      <span>અરજદાર (From / Applicant)</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground font-normal">પોલીસ કોન્સ્ટેબલ / અરજદાર</span>
                  </label>
                  <textarea
                    rows={2}
                    value={reportData.applicantLine}
                    onChange={(e) => updateField("applicantLine", e.target.value)}
                    className="w-full rounded-lg border border-input bg-background/50 p-2 text-xs font-medium focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 leading-relaxed shadow-2xs"
                    placeholder="અરજદાર: પો.કો. રમેશભાઈ..."
                  />
                </div>
              </div>

              {/* CONDITIONAL SUB-SECTION SELECTOR PILLS */}
              <div className="flex items-center gap-1.5 overflow-x-auto p-1.5 rounded-2xl bg-muted/50 border border-border/80 shadow-2xs backdrop-blur-xs text-xs shrink-0 no-scrollbar">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] border border-indigo-500/15 shrink-0 select-none">
                  <Layers className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>વિભાગ:</span>
                </div>

                <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto no-scrollbar py-0.5">
                  <button
                    type="button"
                    onClick={() => setActiveSection("all")}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all duration-150 cursor-pointer whitespace-nowrap ${activeSection === "all"
                      ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/25 ring-1 ring-white/20"
                      : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted border border-border/70 shadow-2xs"
                      }`}
                  >
                    <FileCheck className="size-3.5 text-emerald-500 shrink-0" />
                    <span>તમામ (All)</span>
                  </button>

                  {isRelievingReport && (
                    <button
                      type="button"
                      onClick={() => setActiveSection("relieve")}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-150 cursor-pointer whitespace-nowrap ${activeSection === "relieve"
                        ? "bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-600/25 ring-1 ring-white/20"
                        : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted border border-border/70 shadow-2xs"
                        }`}
                    >
                      <ShieldAlert className="size-3.5 text-emerald-500 shrink-0" />
                      <span>મંજૂરી &amp; છૂટા થવા વિગત</span>
                    </button>
                  )}

                  {hasLeaveSegments && (
                    <button
                      type="button"
                      onClick={() => setActiveSection("leave")}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-150 cursor-pointer whitespace-nowrap ${activeSection === "leave"
                        ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/25 ring-1 ring-white/20"
                        : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted border border-border/70 shadow-2xs"
                        }`}
                    >
                      <Calendar className="size-3.5 text-indigo-500 shrink-0" />
                      <span>રજા વિગત</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setActiveSection("content")}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-150 cursor-pointer whitespace-nowrap ${activeSection === "content"
                      ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/25 ring-1 ring-white/20"
                      : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted border border-border/70 shadow-2xs"
                      }`}
                  >
                    <FileEdit className="size-3.5 text-purple-500 shrink-0" />
                    <span>પત્ર ફકરા</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSection("header")}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-150 cursor-pointer whitespace-nowrap ${activeSection === "header"
                      ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/25 ring-1 ring-white/20"
                      : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted border border-border/70 shadow-2xs"
                      }`}
                  >
                    <Building className="size-3.5 text-amber-500 shrink-0" />
                    <span>હેડર</span>
                  </button>
                </div>
              </div>

              {/* SECTION A: Leave Segment Builder (Shown when 'leave' or 'all') */}
              {hasLeaveSegments && (activeSection === "leave" || activeSection === "all") && (
                <div className="animate-in fade-in duration-150">
                  <LeaveSegmentBuilder
                    segments={reportData.leaveSegments!}
                    useGujaratiDigits={useGujaratiDigits}
                    displayFormat={reportData.leaveDisplayFormat || "table"}
                    reasonMode={reportData.leaveReasonMode || "same"}
                    commonReason={reportData.commonReason || "અંગત તથા કૌટુંબિક કામ સબબ"}
                    dbLeaveTypes={leaveTypes}
                    onFormatChange={(fmt) => {
                      setReportData((prev) => {
                        let nextParagraph1 = prev.paragraph1;
                        if (prev.leaveSegments && prev.leaveSegments.length > 0) {
                          if (fmt === "paragraph") {
                            nextParagraph1 = formatSegmentsAsNarrativeParagraph(
                              prev.leaveSegments,
                              useGujaratiDigits,
                              prev.leaveReasonMode || "same",
                              prev.commonReason || "અંગત તથા કૌટુંબિક કામ સબબ",
                            );
                          } else {
                            nextParagraph1 = buildTableIntroParagraph(
                              prev.leaveReasonMode || "same",
                              prev.commonReason || "અંગત તથા કૌટુંબિક કામ સબબ",
                            );
                          }
                        }
                        return {
                          ...prev,
                          leaveDisplayFormat: fmt,
                          paragraph1: nextParagraph1,
                        };
                      });
                    }}
                    onReasonModeChange={(mode, commonR) => {
                      setReportData((prev) => {
                        const nextR = commonR ?? prev.commonReason ?? "અંગત તથા કૌટુંબિક કામ સબબ";
                        let nextPara = prev.paragraph1;
                        if (prev.leaveSegments && prev.leaveSegments.length > 0) {
                          if (prev.leaveDisplayFormat === "paragraph") {
                            nextPara = formatSegmentsAsNarrativeParagraph(
                              prev.leaveSegments,
                              useGujaratiDigits,
                              mode,
                              nextR,
                            );
                          } else if (mode === "same") {
                            nextPara = buildTableIntroParagraph("same", nextR);
                          }
                        }
                        return {
                          ...prev,
                          leaveReasonMode: mode,
                          commonReason: nextR,
                          paragraph1: nextPara,
                        };
                      });
                    }}
                    onSyncSubject={(newSub) => {
                      setHighlightSubject(true);
                      toast(`વિષય લાઇન સફળતાપૂર્વક અપડેટ થઈ ગઈ: ${newSub}`);
                      setTimeout(() => setHighlightSubject(false), 2000);
                    }}
                    onChange={(updated, newSubject, narrative, rMode, cReason) => {
                      setReportData((prev) => {
                        const currentMode = rMode ?? prev.leaveReasonMode ?? "same";
                        const currentCommon = cReason ?? prev.commonReason ?? "અંગત તથા કૌટુંબિક કામ સબબ";
                        const next: CustomReportData = {
                          ...prev,
                          leaveSegments: updated,
                          leaveReasonMode: currentMode,
                          commonReason: currentCommon,
                        };
                        if (newSubject) {
                          next.subject = newSubject;
                        }
                        if (prev.leaveDisplayFormat === "paragraph" && narrative) {
                          next.paragraph1 = narrative;
                        } else if (prev.leaveDisplayFormat === "table" && currentMode === "same") {
                          next.paragraph1 = buildTableIntroParagraph("same", currentCommon);
                        }
                        return next;
                      });
                    }}
                  />
                </div>
              )}

              {/* SECTION: Relieving & Sanction Editor (Shown when isRelievingReport and ('relieve' or 'all')) */}
              {isRelievingReport && (activeSection === "relieve" || activeSection === "all") && (
                <div className="space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/10 p-3 sm:p-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-600 dark:text-emerald-400">
                        <ShieldAlert className="size-4" />
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-foreground">મંજૂર રજા &amp; છૂટા થવાની વિગતો</h4>
                        <p className="text-[10px] text-muted-foreground">ઓર્ડર નંબર અને છૂટા થવાની તારીખ/સમય દાખલ કરો</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyRelievingTexts}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 text-[11px] font-bold shadow-xs transition-all cursor-pointer"
                      title="દાખલ કરેલ વિગતો મુજબ પત્રના ફકરા અને વિષય અપડેટ કરો"
                    >
                      <CheckCircle2 className="size-3" />
                      <span>પત્ર લખાણ અપડેટ</span>
                    </button>
                  </div>

                  {/* Dropdown if sanctioned applications from DB exist */}
                  {sanctions && sanctions.length > 0 && (
                    <div className="rounded-xl border border-border bg-card p-2.5 space-y-1.5 shadow-2xs">
                      <label className="text-[11px] font-bold text-foreground flex items-center justify-between">
                        <span>સિસ્ટમમાંથી મંજૂર થયેલ રજા ઓર્ડર પસંદ કરો:</span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          {sanctions.length} મંજૂર અરજીઓ ઉપલબ્ધ
                        </span>
                      </label>
                      <select
                        value={selectedSanctionId}
                        onChange={(e) => handleSelectSanction(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background p-2 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-emerald-500/20"
                      >
                        <option value="">-- મંજૂર ઓર્ડર પસંદ કરો (Auto-fill) --</option>
                        {sanctions.map((s) => {
                          const lName =
                            s.leave_types?.name ||
                            (s.leave_types?.code === "LWP" ? "બિનપગારી રજા" : "ખાસ રજા");
                          return (
                            <option key={s.id} value={s.id}>
                              {lName} - {s.approved_days} દિવસ (હુકમ નં: {s.order_no || "અનિયત"} - તા. {s.approved_date || "અનિયત"})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {/* Form Inputs Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">મંજૂર કરનાર સત્તાધિકારી</label>
                      <input
                        type="text"
                        value={relieveAuthority}
                        onChange={(e) => setRelieveAuthority(e.target.value)}
                        placeholder="દા.ત. મહેરબાન પોલીસ અધિક્ષકશ્રી"
                        className="w-full rounded-lg border border-input bg-background p-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">રજા મંજૂરી હુકમ નંબર</label>
                      <input
                        type="text"
                        value={relieveOrderNo}
                        onChange={(e) => setRelieveOrderNo(e.target.value)}
                        placeholder="દા.ત. ૧૨૩/૨૦૨૬"
                        className="w-full rounded-lg border border-input bg-background p-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">હુકમ તારીખ</label>
                      <input
                        type="date"
                        value={relieveOrderDate}
                        onChange={(e) => setRelieveOrderDate(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background p-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">રજાનો પ્રકાર</label>
                      <input
                        type="text"
                        value={relieveLeaveType}
                        onChange={(e) => setRelieveLeaveType(e.target.value)}
                        placeholder="દા.ત. બિનપગારી રજા / ખાસ રજા"
                        className="w-full rounded-lg border border-input bg-background p-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">મંજૂર થયેલ દિવસો</label>
                      <input
                        type="number"
                        step="any"
                        value={relieveDays}
                        onChange={(e) => setRelieveDays(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background p-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">રજા શરૂ તારીખ</label>
                      <input
                        type="date"
                        value={relieveStartDate}
                        onChange={(e) => setRelieveStartDate(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background p-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">રજા પૂર્ણ તારીખ</label>
                      <input
                        type="date"
                        value={relieveEndDate}
                        onChange={(e) => setRelieveEndDate(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background p-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[11px] font-semibold text-muted-foreground">ફરજ પરથી છૂટા થવાનો સમય (રવાનગી)</label>
                      <input
                        type="text"
                        value={relieveDateTime}
                        onChange={(e) => setRelieveDateTime(e.target.value)}
                        placeholder="દા.ત. તારીખ ૨૫/૧૦/૨૦૨૬ ના રોજ સાંજે ફરજ પૂર્ણ થયેથી"
                        className="w-full rounded-lg border border-input bg-background p-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[11px] font-semibold text-muted-foreground">ચાર્જ સંભાળનાર સાથી કર્મચારી (વૈકલ્પિક)</label>
                      <input
                        type="text"
                        value={relieveChargeOfficer}
                        onChange={(e) => setRelieveChargeOfficer(e.target.value)}
                        placeholder="દા.ત. પો.કો. મહેશભાઈ બ.નં. ૪૫૬"
                        className="w-full rounded-lg border border-input bg-background p-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
                        <span>હેડક્વાર્ટર / નોકરીનું સ્થળ (HQ / Place of Duty)</span>
                        <span className="text-[10px] text-muted-foreground font-normal">દા.ત. નોકરીનું સ્થળ / સ્ટેશન</span>
                      </label>
                      <input
                        type="text"
                        value={relieveHeadquarterPlace}
                        onChange={(e) => setRelieveHeadquarterPlace(e.target.value)}
                        placeholder="દા.ત. નોકરીનું સ્થળ અથવા પોલીસ સ્ટેશન નામ"
                        className="w-full rounded-lg border border-input bg-background p-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Reference Options (Hide/Show & Move to below paragraph) */}
                    <div className="sm:col-span-2 rounded-xl border border-emerald-500/20 bg-card p-2.5 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {/* Custom Styled Checkbox Button */}
                        <button
                          type="button"
                          onClick={() => updateField("showReference", reportData.showReference === false ? true : false)}
                          className="inline-flex items-center gap-2 cursor-pointer select-none group text-left"
                        >
                          <span
                            className={`flex size-4.5 items-center justify-center rounded-md border transition-all duration-150 ${reportData.showReference !== false
                              ? "bg-emerald-600 border-emerald-600 text-white shadow-2xs group-hover:bg-emerald-500"
                              : "border-input bg-background group-hover:border-emerald-500"
                              }`}
                          >
                            {reportData.showReference !== false && <Check className="size-3.5 stroke-[3]" />}
                          </span>
                          <span className="text-xs font-bold text-foreground">
                            સંદર્ભ દર્શાવો (Show Reference)
                          </span>
                        </button>

                        {reportData.showReference !== false && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {/* Position Switcher */}
                            <div className="inline-flex items-center rounded-lg bg-muted p-0.5 border border-border text-[11px] font-semibold">
                              <button
                                type="button"
                                onClick={() => updateField("referencePosition", "above")}
                                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${reportData.referencePosition !== "below"
                                  ? "bg-emerald-600 text-white shadow-2xs"
                                  : "text-muted-foreground hover:text-foreground"
                                  }`}
                                title="વિષય નીચે (સામાન્ય સ્થાન)"
                              >
                                વિષય નીચે (ઉપર)
                              </button>
                              <button
                                type="button"
                                onClick={() => updateField("referencePosition", "below")}
                                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${reportData.referencePosition === "below"
                                  ? "bg-emerald-600 text-white shadow-2xs"
                                  : "text-muted-foreground hover:text-foreground"
                                  }`}
                                title="ફકરાઓની નીચે / પત્રના અંતે"
                              >
                                ફકરા નીચે (પત્ર અંતે)
                              </button>
                            </div>

                            {/* Conditional Divider Line Toggle when placed below */}
                            {reportData.referencePosition === "below" && (
                              <button
                                type="button"
                                onClick={() => updateField("referenceShowLine", !reportData.referenceShowLine)}
                                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${reportData.referenceShowLine
                                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-400/50 shadow-2xs"
                                  : "bg-card text-muted-foreground border-border hover:bg-muted"
                                  }`}
                                title="સંદર્ભની ઉપર આડી ડૅશ્ડ લાઇન દર્શાવો કે નહીં"
                              >
                                <span>ડિવાઇડર લાઇન:</span>
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${reportData.referenceShowLine
                                    ? "bg-emerald-600 text-white"
                                    : "bg-muted text-muted-foreground"
                                    }`}
                                >
                                  {reportData.referenceShowLine ? "હા (ON)" : "ના (OFF)"}
                                </span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {reportData.showReference !== false && (
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground font-semibold">
                            સંદર્ભ લખાણ (Reference Text):
                          </label>
                          <input
                            type="text"
                            value={reportData.reference || ""}
                            onChange={(e) => updateField("reference", e.target.value)}
                            className="w-full rounded-lg border border-input bg-background p-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                            placeholder="સંદર્ભ: મહેરબાન પોલીસ અધિક્ષકશ્રીનો રજા મંજૂરી હુકમ..."
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={handleApplyRelievingTexts}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                    >
                      <CheckCircle2 className="size-3.5" />
                      <span>પત્ર લખાણ અને ફકરાઓ અપડેટ કરો (Apply to Letter)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* SECTION B: Body Content / Paragraphs (Shown when 'content' or 'all') */}
              {(activeSection === "content" || activeSection === "all") && (
                <div className="space-y-3 rounded-xl border border-border p-3 bg-muted/15 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <FileEdit className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>પત્ર લખાણ અને ફકરાઓ (Letter Body Paragraphs)</span>
                    </span>
                  </div>

                  {/* Reference (સંદર્ભ) with Hide/Show and Position switcher */}
                  <div className="space-y-2 rounded-xl border border-border/80 bg-background/50 p-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => updateField("showReference", reportData.showReference === false ? true : false)}
                        className="inline-flex items-center gap-2 cursor-pointer select-none group text-left"
                      >
                        <span
                          className={`flex size-4.5 items-center justify-center rounded-md border transition-all duration-150 ${reportData.showReference !== false
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-2xs group-hover:bg-indigo-500"
                            : "border-input bg-background group-hover:border-indigo-500"
                            }`}
                        >
                          {reportData.showReference !== false && <Check className="size-3.5 stroke-[3]" />}
                        </span>
                        <span className="text-xs font-bold text-foreground">
                          સંદર્ભ દર્શાવો (Show Reference)
                        </span>
                      </button>

                      {reportData.showReference !== false && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <div className="inline-flex items-center rounded-lg bg-muted p-0.5 border border-border text-[11px] font-semibold">
                            <button
                              type="button"
                              onClick={() => updateField("referencePosition", "above")}
                              className={`px-2 py-1 rounded-md transition-all cursor-pointer ${reportData.referencePosition !== "below"
                                ? "bg-indigo-600 text-white shadow-2xs"
                                : "text-muted-foreground hover:text-foreground"
                                }`}
                              title="વિષય નીચે (સામાન્ય સ્થાન)"
                            >
                              વિષય નીચે
                            </button>
                            <button
                              type="button"
                              onClick={() => updateField("referencePosition", "below")}
                              className={`px-2 py-1 rounded-md transition-all cursor-pointer ${reportData.referencePosition === "below"
                                ? "bg-indigo-600 text-white shadow-2xs"
                                : "text-muted-foreground hover:text-foreground"
                                }`}
                              title="ફકરાઓની નીચે / પત્રના અંતે"
                            >
                              ફકરા નીચે
                            </button>
                          </div>

                          {/* Conditional Divider Line Toggle when placed below */}
                          {reportData.referencePosition === "below" && (
                            <button
                              type="button"
                              onClick={() => updateField("referenceShowLine", !reportData.referenceShowLine)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${reportData.referenceShowLine
                                ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-400/50 shadow-2xs"
                                : "bg-card text-muted-foreground border-border hover:bg-muted"
                                }`}
                              title="સંદર્ભની ઉપર આડી ડૅશ્ડ લાઇન દર્શાવો કે નહીં"
                            >
                              <span>ડિવાઇડર લાઇન:</span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${reportData.referenceShowLine
                                  ? "bg-indigo-600 text-white"
                                  : "bg-muted text-muted-foreground"
                                  }`}
                              >
                                {reportData.referenceShowLine ? "હા (ON)" : "ના (OFF)"}
                              </span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {reportData.showReference !== false && (
                      <input
                        type="text"
                        value={reportData.reference || ""}
                        onChange={(e) => updateField("reference", e.target.value)}
                        className="w-full rounded-xl border border-input bg-background p-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        placeholder="સંદર્ભ: આપશ્રીના જા.નં. / ઓર્ડર..."
                      />
                    )}
                  </div>

                  {/* Paragraph 1 (પ્રથમ ફકરો) */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground">પ્રથમ ફકરો (Opening Context / Reason)</label>
                    <textarea
                      rows={3}
                      value={reportData.paragraph1}
                      onChange={(e) => updateField("paragraph1", e.target.value)}
                      className="w-full rounded-xl border border-input bg-background p-2.5 text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none leading-relaxed"
                    />
                  </div>

                  {/* Paragraph 2 (બીજો ફકરો) */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground">
                      બીજો ફકરો (Specific Request / Headquarter Permission)
                    </label>
                    <textarea
                      rows={3}
                      value={reportData.paragraph2}
                      onChange={(e) => updateField("paragraph2", e.target.value)}
                      className="w-full rounded-xl border border-input bg-background p-2.5 text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none leading-relaxed"
                    />
                  </div>

                  {/* Paragraph 3 (ત્રીજો ફકરો - Optional) */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      વધુમાં / ત્રીજો ફકરો (Additional Note - વૈકલ્પિક)
                    </label>
                    <textarea
                      rows={2}
                      value={reportData.paragraph3 || ""}
                      onChange={(e) => updateField("paragraph3", e.target.value)}
                      className="w-full rounded-xl border border-input bg-background p-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none leading-relaxed"
                      placeholder="રજા પૂર્ણ થયે સમયસર હાજર થઈશ..."
                    />
                  </div>
                </div>
              )}

              {/* SECTION C: Header Settings (Shown when 'header' or 'all') */}
              {(activeSection === "header" || activeSection === "all") && (
                <div className="rounded-xl border border-indigo-500/30 bg-indigo-50/30 dark:bg-indigo-950/20 p-3 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-indigo-200/50 dark:border-indigo-800/40 pb-2">
                    <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                      <SlidersHorizontal className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>લેટરહેડ હેડર લાઇન (Letterhead Headers)</span>
                    </span>

                    {/* Status Badge reflecting top Quick Controls toggle */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${reportData.showHeader
                        ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-300/50"
                        : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300/50"
                        }`}
                    >
                      {reportData.showHeader ? "સામાન્ય (Visible)" : "છુપાવેલ (Hidden)"}
                    </span>
                  </div>

                  {reportData.showHeader ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs pt-1">
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5">
                          હેડર લાઇન ૧ (રાજ્ય / સંસ્થા)
                        </label>
                        <input
                          type="text"
                          value={reportData.headerLine1}
                          onChange={(e) => updateField("headerLine1", e.target.value)}
                          className="w-full rounded-lg border border-input bg-background p-2 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5">
                          હેડર લાઇન ૨ (સ્ટેશન / કચેરી)
                        </label>
                        <input
                          type="text"
                          value={reportData.headerLine2}
                          onChange={(e) => updateField("headerLine2", e.target.value)}
                          className="w-full rounded-lg border border-input bg-background p-2 text-xs font-medium"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300">
                      <EyeOff className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span>
                        પહેલેથી છપાયેલ કાગળ (Pre-printed letterhead) માટે હેડર છુપાવેલ છે. ઉપર કંટ્રોલ પેનલમાંથી &quot;હેડર&quot; બટન દબાવીને ચાલુ કરી શકો છો.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* ALWAYS VISIBLE 3: Footer Section (Date & Place on Left, Signatory on Right) */}
              <div className="rounded-xl border border-border p-3 space-y-2.5 bg-muted/20">
                <h5 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  નીચેનો ભાગ (Footer Settings)
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Left Side: Date & Place */}
                  <div className="space-y-2 border-r border-border/50 pr-0 sm:pr-2">
                    <span className="text-[11px] font-bold text-foreground">ડાબી બાજુ (Left Side)</span>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">તારીખ (Date)</label>
                      <input
                        type="text"
                        value={reportData.reportDate}
                        onChange={(e) => updateField("reportDate", e.target.value)}
                        className="w-full rounded-lg border border-input bg-background p-1.5 text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">સ્થળ (Place)</label>
                      <input
                        type="text"
                        value={reportData.place}
                        onChange={(e) => updateField("place", e.target.value)}
                        className="w-full rounded-lg border border-input bg-background p-1.5 text-xs font-medium"
                      />
                    </div>
                  </div>

                  {/* Right Side: Signatory */}
                  <div className="space-y-2 pl-0 sm:pl-1">
                    <span className="text-[11px] font-bold text-foreground">જમણી બાજુ (Signatory)</span>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">નામ (Name)</label>
                      <input
                        type="text"
                        value={reportData.signatoryName}
                        onChange={(e) => updateField("signatoryName", e.target.value)}
                        className="w-full rounded-lg border border-input bg-background p-1.5 text-xs font-bold"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5">હોદ્દો (Rank)</label>
                        <input
                          type="text"
                          value={reportData.signatoryRank}
                          onChange={(e) => updateField("signatoryRank", e.target.value)}
                          className="w-full rounded-lg border border-input bg-background p-1.5 text-xs font-medium"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5">બ.નં. (Buckle)</label>
                        <input
                          type="text"
                          value={reportData.signatoryBuckle}
                          onChange={(e) => updateField("signatoryBuckle", e.target.value)}
                          className="w-full rounded-lg border border-input bg-background p-1.5 text-xs font-medium"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT PANE: Live A4 Paper Preview */}
            <div
              className={`w-full lg:w-[52%] xl:w-[54%] 2xl:w-[55%] flex flex-col bg-muted/40 p-3 sm:p-6 overflow-y-auto ${mobileTab === "edit" ? "hidden lg:flex" : "flex"
                }`}
            >
              {/* Top Banner on Preview Pane */}
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <Eye className="size-3.5" />
                  <span>લાઈવ A4 પ્રિવ્યુ (Live Letterhead Preview)</span>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
                    title="લખાણ કોપી કરો"
                  >
                    <Copy className="size-3" />
                    <span>કોપી લખાણ</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrint}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer"
                  >
                    <Printer className="size-3" />
                    <span>પ્રિન્ટ</span>
                  </button>
                </div>
              </div>

              {/* Realistic A4 Sheet Card */}
              <div className="w-full max-w-[720px] mx-auto rounded-lg border border-gray-300 dark:border-gray-700 bg-white text-gray-900 shadow-2xl shadow-indigo-950/15 p-3.5 sm:p-7 md:p-10 font-sans text-xs leading-relaxed space-y-3.5 sm:space-y-4 ring-1 ring-black/5">
                {/* Header: Rendered only if showHeader is TRUE */}
                {reportData.showHeader ? (
                  <div className="border-b-2 border-black pb-2 sm:pb-3 mb-3 sm:mb-4">
                    <div className="flex items-center justify-between gap-1 sm:gap-2">
                      {reportData.showLogo !== false ? (
                        <div className="w-10 sm:w-11 flex justify-start items-center shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/Gujarat-police.png"
                            alt="Gujarat Police Logo"
                            width={40}
                            height={52}
                            className="h-10 sm:h-12 w-auto object-contain drop-shadow-xs"
                            style={{ aspectRatio: "1542/2000" }}
                          />
                        </div>
                      ) : (
                        <div className="w-1 shrink-0"></div>
                      )}

                      <div className="text-center flex-1 min-w-0 px-1">
                        <h1 className="text-sm sm:text-lg font-extrabold tracking-wide text-gray-950 uppercase font-serif whitespace-nowrap leading-tight">
                          {reportData.headerLine1}
                        </h1>
                        {reportData.headerLine2 && (
                          <p className="text-xs sm:text-sm font-semibold text-gray-700 mt-0.5 tracking-wide leading-tight truncate">
                            {reportData.headerLine2}
                          </p>
                        )}
                      </div>

                      <div className={reportData.showLogo !== false ? "w-10 sm:w-11 shrink-0" : "w-1 shrink-0"}></div>
                    </div>
                    {/* Double hairline rule for official government documents */}
                    <div className="border-t border-black/40 mt-1.5 sm:mt-2"></div>
                  </div>
                ) : (
                  <div className="text-center py-2 mb-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[10px] text-amber-800 font-semibold print:hidden flex items-center justify-center gap-1.5 shadow-2xs">
                    <EyeOff className="size-3.5 text-amber-600" />
                    <span>લેટરહેડ હેડર છુપાવેલ છે (પહેલેથી છપાયેલ સરકારી કાગળ માટે)</span>
                  </div>
                )}

                {/* To */}
                <div className="whitespace-pre-line text-xs sm:text-sm leading-snug text-gray-900 font-medium">
                  {reportData.toLines}
                </div>

                {/* Applicant (clean without start line) */}
                {reportData.applicantLine && (
                  <div className="text-xs sm:text-sm font-bold text-gray-900 mb-2 sm:mb-2.5">
                    {reportData.applicantLine}
                  </div>
                )}

                {/* Subject (clean, bold and centered with prominent spacing up and down; hanging indent for multi-line) */}
                {(() => {
                  const sub = splitSubjectPrefix(reportData.subject);
                  return (
                    <div className="flex justify-center my-3.5 sm:my-4">
                      <div className="flex items-start max-w-[96%] text-left">
                        <span className="font-extrabold text-xs sm:text-[13.5px] whitespace-nowrap mr-1.5 text-gray-950 leading-snug">
                          {sub.prefix}
                        </span>
                        <span className="font-extrabold text-xs sm:text-[13.5px] text-gray-950 leading-snug tracking-tight">
                          {sub.text}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Reference (Top / Under Subject with hanging indent) */}
                {reportData.showReference !== false &&
                  reportData.referencePosition !== "below" &&
                  reportData.reference && (() => {
                    const ref = splitReferencePrefix(reportData.reference);
                    return (
                      <div className="flex justify-center mb-2.5 sm:mb-3">
                        <div className="flex items-start max-w-[96%] text-left">
                          <span className="font-semibold text-[11px] sm:text-xs whitespace-nowrap mr-1.5 text-gray-800 leading-snug">
                            {ref.prefix}
                          </span>
                          <span className="font-semibold text-[11px] sm:text-xs text-gray-700 leading-snug">
                            {ref.text}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                {/* Salutation */}
                <div className="font-bold text-xs sm:text-[13.5px] pt-1.5 pb-0.5">{reportData.salutation}</div>

                {/* Paragraph 1 */}
                <p className="text-xs sm:text-[13px] leading-relaxed text-justify indent-8 text-gray-900">
                  {reportData.paragraph1}
                </p>

                {/* Leave Breakdown Table if Multiple Leave & mode is table or both */}
                {reportData.leaveDisplayFormat !== "paragraph" &&
                  reportData.leaveSegments &&
                  reportData.leaveSegments.length > 0 && (
                    <div className="my-3 overflow-x-auto">
                      <table className="w-full border-collapse text-xs border border-gray-400">
                        <thead>
                          <tr className="bg-gray-100 font-bold border-b border-gray-400 text-gray-900">
                            <th className="p-1.5 text-center w-8 border-r border-gray-400">અ.નં.</th>
                            <th className="p-1.5 text-left border-r border-gray-400">તારીખ (ગાળો)</th>
                            <th className="p-1.5 text-left border-r border-gray-400">રજાનો પ્રકાર</th>
                            <th className="p-1.5 text-center w-14 border-r border-gray-400">દિવસ</th>
                            <th className="p-1.5 text-left">કારણ / શેરો</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.leaveSegments.map((seg, idx) => {
                            const range = formatSegmentDateRange(
                              seg.startDate,
                              seg.endDate,
                              useGujaratiDigits,
                            );
                            return (
                              <tr key={seg.id || idx} className="border-b border-gray-300">
                                <td className="p-1.5 text-center font-bold border-r border-gray-300">
                                  {numFn(idx + 1)}
                                </td>
                                <td className="p-1.5 border-r border-gray-300 font-semibold">{range}</td>
                                <td className="p-1.5 border-r border-gray-300 font-semibold">
                                  {seg.isHalfDay
                                    ? `${seg.shortLabel || seg.leaveTypeName} (અડધો દિવસ${seg.halfDaySession === "PM" || seg.halfDaySession === "second_half"
                                      ? " - બપોર"
                                      : " - સવાર"
                                    }${seg.halfDayTime ? ` - ${seg.halfDayTime}` : ""})`
                                    : (seg.shortLabel || seg.leaveTypeName)}
                                </td>
                                <td className="p-1.5 text-center font-bold border-r border-gray-300">
                                  {seg.isHalfDay
                                    ? (useGujaratiDigits ? "૦.૫" : "0.5")
                                    : numFn(seg.days)}
                                </td>
                                <td className="p-1.5">{seg.reason || reportData.commonReason || "—"}</td>
                              </tr>
                            );
                          })}
                          <tr className="bg-gray-50 font-bold border-t border-gray-400">
                            <td colSpan={3} className="p-1.5 text-right border-r border-gray-300">
                              કુલ રજા દિવસ:
                            </td>
                            <td className="p-1.5 text-center border-r border-gray-300 text-indigo-700 font-bold">
                              {numFn(
                                Math.round(
                                  reportData.leaveSegments.reduce(
                                    (sum, s) => sum + (Number(s.days) || 0),
                                    0,
                                  ) * 10,
                                ) / 10,
                              )}
                            </td>
                            <td className="p-1.5"></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                {/* Paragraph 2 */}
                {reportData.paragraph2 && (
                  <p className="text-xs sm:text-[13px] leading-relaxed text-justify indent-8 text-gray-900">
                    {reportData.paragraph2}
                  </p>
                )}

                {/* Paragraph 3 */}
                {reportData.paragraph3 && (
                  <p className="text-xs sm:text-[13px] leading-relaxed text-justify indent-8 text-gray-900">
                    {reportData.paragraph3}
                  </p>
                )}

                {/* Reference (Bottom / Below Paragraphs with hanging indent) */}
                {reportData.showReference !== false &&
                  reportData.referencePosition === "below" &&
                  reportData.reference && (() => {
                    const ref = splitReferencePrefix(reportData.reference);
                    return (
                      <div
                        className={`flex items-start text-left mt-3 mb-2 ${reportData.referenceShowLine
                          ? "pt-2 border-t border-dashed border-gray-400"
                          : ""
                          }`}
                      >
                        <span className="font-semibold text-[11px] sm:text-xs whitespace-nowrap mr-1.5 text-gray-800 leading-snug">
                          {ref.prefix}
                        </span>
                        <span className="font-semibold text-[11px] sm:text-xs text-gray-700 leading-snug">
                          {ref.text}
                        </span>
                      </div>
                    );
                  })()}

                {/* Footer Section */}
                <div className="pt-4 mt-3 flex justify-between items-end border-t border-gray-200 text-xs sm:text-[13px]">
                  <div className="space-y-0.5">
                    <p>
                      <strong>તારીખ:</strong> {reportData.reportDate}
                    </p>
                    <p>
                      <strong>સ્થળ:</strong> {reportData.place}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold mb-1">લિ. આપનો વિશ્વાસુ,</p>

                    {/* Signature Preview */}
                    {includeSignature && officer?.signatureUrl ? (
                      <div className="h-8 max-h-8 my-1 flex justify-end items-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={officer.signatureUrl}
                          alt="Signature"
                          className="h-8 max-h-8 w-auto max-w-[130px] object-contain mix-blend-multiply"
                        />
                      </div>
                    ) : (
                      <div className="h-5"></div>
                    )}

                    <p className="font-extrabold leading-tight text-gray-950 sm:text-[13.5px]">
                      {reportData.signatoryName}
                    </p>
                    <p className="text-[11px] sm:text-xs font-semibold text-gray-700 mt-0.5">
                      {reportData.signatoryRank} {reportData.signatoryBuckle}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
