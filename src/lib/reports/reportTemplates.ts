/**
 * Gujarat Police Official Report & Letter Templates
 *
 * Implements standard police correspondence formats, formal leave applications
 * (including combined/merged leave spells: કે.લીવ + મ.રજા + લાભ રજા, and dedicated Holiday Leave),
 * duty reports, requisitions, and customizable letters with pre-printed header options.
 */

import {
  toGujaratiNumerals,
  formatGujaratiDate,
  transliterateToGujarati,
  formatGujaratiPoliceRank,
  formatGujaratiBuckleNumber,
} from "./gujaratiReportUtils";
import type { PrintOfficer } from "./printReport";

export interface LeaveSegment {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  leaveTypeCode: string; // 'cl' | 'oh' | 'hl' | 'el' | 'ml' | or DB leave type ID/code
  leaveTypeName: string; // Full label: 'કેઝ્યુઅલ લીવ (CL)'
  shortLabel: string; // Police short abbreviation: 'કે.લીવ', 'મ.રજા', 'લાભ રજા'
  days: number;
  reason?: string;
  isHalfDay?: boolean;
  halfDaySession?: "AM" | "PM" | "first_half" | "second_half" | string;
  halfDayTime?: string; // Time details e.g. "૧૨:૦૦ થી ૧૬:૦૦" or "બપોરે ૧૨:૦૦ કલાક પછી"
}

export interface SanctionItem {
  id: string;
  order_no?: string | null;
  approved_date?: string | null;
  approved_days?: number | null;
  valid_from?: string | null;
  valid_to?: string | null;
  reason?: string | null;
  approved_by?: string | null;
  leave_type_id?: string | null;
  leave_types?: { name?: string | null; code?: string | null } | null;
}

export interface CustomReportData {
  id: string;
  templateId: string;
  templateTitle: string;
  showHeader: boolean; // TRUE = print letterhead header; FALSE = hide for pre-printed stationery
  showLogo?: boolean; // TRUE = include Gujarat Police Logo; FALSE = hide logo
  headerLine1: string; // 'ગુજરાત પોલીસ (GUJARAT POLICE)'
  headerLine2: string; // Station/Office/District
  toLines: string; // 'પ્રતિ,\nપોલીસ ઇન્સપેક્ટરશ્રી...'
  applicantLine: string; // 'અરજદાર: પો.કો. રમેશભાઈ બ.નં. ૧૨૩૪'
  subject: string; // 'વિષય: ... બાબત.'
  reference?: string; // 'સંદર્ભ: આપશ્રીના જા.નં. / હુકમ...'
  showReference?: boolean; // TRUE = print/show reference; FALSE = hide reference
  referencePosition?: "above" | "below"; // 'above' = below subject, 'below' = below body paragraphs
  referenceShowLine?: boolean; // TRUE = show divider line above reference when placed below; FALSE = clean without line
  salutation: string; // 'મહેરબાન સાહેબ,'
  paragraph1: string; // Opening context / reason
  leaveSegments?: LeaveSegment[]; // Breakdown for merged/multi-leave
  showSegmentsTable?: boolean;
  leaveDisplayFormat?: "table" | "paragraph"; // 'table' = only table, 'paragraph' = only paragraph
  leaveReasonMode?: "same" | "different"; // 'same' = common reason for all leaves; 'different' = individual per leave
  commonReason?: string; // Common reason for leaves when leaveReasonMode is 'same'
  paragraph2: string; // Specific prayer / request / Headquarter leave
  paragraph3?: string; // Additional notes
  reportDate: string; // Gujarati or standard date string
  place: string; // 'અરવલ્લી', 'અમદાવાદ', etc.
  signatoryName: string; // Officer Name
  signatoryRank: string; // Officer Rank
  signatoryBuckle: string; // Officer Buckle No
  signatoryStation: string; // Officer Station / Posting
  includeSignature: boolean; // Default FALSE
  useGujaratiDigits: boolean; // Default TRUE
}

export interface ReportTemplateMeta {
  id: string;
  titleGu: string;
  titleEn: string;
  category: "leave" | "duty" | "official" | "custom";
  badge: string;
  description: string;
  iconName: "CalendarDays" | "FileSpreadsheet" | "FileText" | "ShieldAlert" | "Award" | "PlusSquare";
  defaultSegments?: LeaveSegment[];
  buildDefaults: (officer: PrintOfficer | null, useGujaratiDigits?: boolean) => CustomReportData;
}

/**
 * Standard default leave type presets for Gujarat Police
 */
export const LEAVE_TYPE_PRESETS: {
  code: string;
  shortLabel: string;
  fullName: string;
  defaultReason: string;
}[] = [
    {
      code: "cl",
      shortLabel: "કે.લીવ",
      fullName: "કે.લીવ - કેઝ્યુઅલ લીવ (CL)",
      defaultReason: "અંગત કામ અર્થે",
    },
    {
      code: "oh",
      shortLabel: "મ.રજા",
      fullName: "મ.રજા - મરજિયાત રજા (OH)",
      defaultReason: "તહેવાર અર્થે",
    },
    {
      code: "hl",
      shortLabel: "લાભ રજા",
      fullName: "લાભ રજા - લાભ રજા / જાહેર રજા (HL)",
      defaultReason: "લાભ રજા અર્થે",
    },
    {
      code: "el",
      shortLabel: "હ.રજા",
      fullName: "હ.રજા - હક રજા / અર્જિત રજા (EL)",
      defaultReason: "કૌટુંબિક કાર્ય અર્થે",
    },
    {
      code: "ml",
      shortLabel: "ત.રજા",
      fullName: "ત.રજા - તબીબી / માંદગી રજા (ML)",
      defaultReason: "માંદગી અર્થે",
    },
    {
      code: "other",
      shortLabel: "અન્ય રજા",
      fullName: "અન્ય રજા - અન્ય વિશેષ રજા",
      defaultReason: "ખાસ કારણ અર્થે",
    },
  ];

export interface DbLeaveTypeItem {
  id: string;
  name: string;
  code: string;
  color?: string | null;
  is_system?: boolean;
}

export interface LeaveTypeOption {
  code: string;
  id: string;
  rawCode: string;
  shortLabel: string;
  fullName: string;
  label: string;
  color?: string | null;
  defaultReason: string;
}

/**
 * Maps database leave types to Gujarat Police short labels & presets
 */
export function mapDbLeaveTypesToOptions(
  dbLeaveTypes?: DbLeaveTypeItem[] | null,
): LeaveTypeOption[] {
  if (!dbLeaveTypes || dbLeaveTypes.length === 0) {
    return LEAVE_TYPE_PRESETS.map((p) => ({
      code: p.code,
      id: p.code,
      rawCode: p.code,
      shortLabel: p.shortLabel,
      fullName: p.fullName,
      label: p.fullName,
      color: "#4f46e5",
      defaultReason: p.defaultReason,
    }));
  }

  // Deduplicate entries by name or code to avoid duplicates
  const seen = new Set<string>();
  const uniqueList: DbLeaveTypeItem[] = [];
  for (const lt of dbLeaveTypes) {
    const key = (lt.name || lt.code || lt.id).trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueList.push(lt);
    }
  }

  return uniqueList.map((lt) => {
    const codeUpper = (lt.code || "").toUpperCase();
    const nameLower = (lt.name || "").toLowerCase();

    let shortLabel = lt.name;
    let defaultReason = `${lt.name} અર્થે`;

    if (codeUpper === "CL" || nameLower.includes("casual")) {
      shortLabel = "કે.લીવ";
      defaultReason = "અંગત કામ અર્થે";
    } else if (
      codeUpper === "HL" ||
      codeUpper === "HOLIDAY_LEAVE" ||
      nameLower.includes("holiday")
    ) {
      shortLabel = "લાભ રજા";
      defaultReason = "લાભ રજા અર્થે";
    } else if (
      codeUpper === "OH" ||
      codeUpper === "OPTIONAL_HOLIDAY" ||
      nameLower.includes("optional")
    ) {
      shortLabel = "મ.રજા";
      defaultReason = "તહેવાર અર્થે";
    } else if (
      codeUpper === "PL" ||
      codeUpper === "EL" ||
      nameLower.includes("privilege") ||
      nameLower.includes("earned")
    ) {
      shortLabel = "હ.રજા";
      defaultReason = "કૌટુંબિક કાર્ય અર્થે";
    } else if (
      codeUpper === "MEDICAL" ||
      codeUpper === "ML" ||
      codeUpper === "SICK" ||
      nameLower.includes("medic") ||
      nameLower.includes("sick")
    ) {
      shortLabel = "ત.રજા";
      defaultReason = "માંદગી અર્થે";
    } else if (
      codeUpper === "LWP" ||
      codeUpper === "BINPAGARI" ||
      nameLower.includes("binpagari") ||
      nameLower.includes("બિનપગારી")
    ) {
      shortLabel = "બિનપગારી રજા";
      defaultReason = "અંગત કામ અર્થે";
    } else if (
      codeUpper === "SPL" ||
      codeUpper === "SPECIAL" ||
      nameLower.includes("special") ||
      nameLower.includes("ખાસ")
    ) {
      shortLabel = "ખાસ રજા";
      defaultReason = "ખાસ ફરજ અર્થે";
    } else if (codeUpper === "COMPENSATORY" || nameLower.includes("compen")) {
      shortLabel = "વળતર રજા";
      defaultReason = "વળતર રજા અર્થે";
    }

    // Default palette color matching existing leave views
    const fallbackColor =
      codeUpper === "CL" || nameLower.includes("casual")
        ? "#2563eb"
        : codeUpper === "HL" || nameLower.includes("holiday")
          ? "#ec4899"
          : codeUpper === "OH" || nameLower.includes("optional")
            ? "#8b5cf6"
            : codeUpper === "ML" || nameLower.includes("sick") || nameLower.includes("medic")
              ? "#991b1b"
              : codeUpper === "SPL" || nameLower.includes("special")
                ? "#581c87"
                : nameLower.includes("binpagari") || codeUpper === "LWP"
                  ? "#dc2626"
                  : "#4f46e5";

    return {
      code: lt.id,
      id: lt.id,
      rawCode: lt.code,
      shortLabel,
      fullName: lt.name,
      label: lt.name,
      color: lt.color || fallbackColor,
      defaultReason,
    };
  });
}

/**
 * Calculates day difference between two YYYY-MM-DD dates inclusive
 */
export function calculateInclusiveDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 1;
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diffDays);
}

/**
 * Formats a single leave date or date-range nicely in Gujarati:
 * e.g. "૧૦/૧૦/૨૦૨૬ થી ૧૨/૧૦/૨૦૨૬" or "૧૩/૧૦/૨૦૨૬"
 */
export function formatSegmentDateRange(
  startDate: string,
  endDate: string,
  useDigits = true,
): string {
  const fStart = formatGujaratiDate(startDate, { useGujaratiDigits: useDigits, shortYear: false });
  if (!endDate || startDate === endDate) {
    return fStart;
  }
  const fEnd = formatGujaratiDate(endDate, { useGujaratiDigits: useDigits, shortYear: false });
  return `${fStart} થી ${fEnd}`;
}

/**
 * Auto-generates the simplified & concise formal Subject line from leave segments:
 * e.g. "વિષય: તારીખ ૧૦/૧૦/૨૦૨૬ થી ૧૫/૧૦/૨૦૨૬ સુધી ૬ દિવસ રજા મંજૂર કરવા બાબત."
 * or if single day: "વિષય: તારીખ ૧૦/૧૦/૨૦૨૬ ના રોજ ૧ દિવસ રજા મંજૂર કરવા બાબત."
 */
export function generateMergedLeaveSubject(
  segments: LeaveSegment[],
  useDigits = true,
  includeDates = false,
): string {
  if (!segments || segments.length === 0) {
    return "વિષય: રજા મંજૂર કરવા બાબત.";
  }

  const totalDays = segments.reduce((sum, s) => sum + (Number(s.days) || 0), 0);
  const rounded = Math.round(totalDays * 10) / 10;

  // Single segment half-day case with detailed timing
  if (segments.length === 1 && segments[0].isHalfDay) {
    const s = segments[0];
    const rangeStr = formatSegmentDateRange(s.startDate, s.endDate, useDigits);
    const sessionLabel =
      s.halfDaySession === "PM" || s.halfDaySession === "second_half"
        ? "દ્વિતીય સત્ર / બપોર પછી"
        : "પ્રથમ સત્ર / સવાર";
    const timeText = s.halfDayTime ? ` (${s.halfDayTime})` : "";
    return `વિષય: તારીખ ${rangeStr} ના રોજ ${sessionLabel}${timeText} અડધો દિવસ (૦.૫ દિવસ) રજા મંજૂર કરવા બાબત.`;
  }

  let daysStr: string;
  if (rounded === 0.5) {
    daysStr = useDigits ? "અડધો દિવસ (૦.૫ દિવસ)" : "Half Day (0.5 day)";
  } else {
    daysStr = useDigits
      ? `${toGujaratiNumerals(rounded)} દિવસ`
      : `${rounded} days`;
  }

  if (includeDates && segments[0]?.startDate) {
    const firstStart = segments[0].startDate;
    const lastEnd = segments[segments.length - 1]?.endDate || firstStart;
    const rangeStr = formatSegmentDateRange(firstStart, lastEnd, useDigits);
    return `વિષય: તારીખ ${rangeStr} સુધી કુલ ${daysStr} રજા મંજૂર કરવા બાબત.`;
  }

  return `વિષય: ${daysStr} રજા મંજૂર કરવા બાબત.`;
}

/**
 * Builds the standard opening introductory paragraph for Table display mode
 */
export function buildTableIntroParagraph(
  reasonMode: "same" | "different" = "same",
  commonReason = "અંગત તથા કૌટુંબિક કામ અર્થે",
): string {
  if (reasonMode === "same" && commonReason?.trim()) {
    return `જય ભારત સાથે સવિનય જણાવવાનું કે, નીચે જણાવેલ વિગત મુજબ મારે ${commonReason.trim()} રજા ભોગવવાની ખાસ જરૂરિયાત ઉપસ્થિત થયેલ છે. જેની તારીખવાર વિગત નીચે મુજબ છે:`;
  }
  return "જય ભારત સાથે સવિનય જણાવવાનું કે, નીચે જણાવેલ વિગત મુજબ મારે રજા ભોગવવાની ખાસ જરૂરિયાત ઉપસ્થિત થયેલ છે. જેની તારીખવાર વિગત નીચે મુજબ છે:";
}

/**
 * Formats leave segments into natural narrative paragraph text for body view
 */
export function formatSegmentsAsNarrativeParagraph(
  segments: LeaveSegment[],
  useDigits = true,
  reasonMode: "same" | "different" = "same",
  commonReason = "અંગત તથા કૌટુંબિક કામ અર્થે",
): string {
  if (!segments || segments.length === 0) return "";
  const totalDays = segments.reduce((sum, s) => sum + (Number(s.days) || 0), 0);
  const rounded = Math.round(totalDays * 10) / 10;
  const totalDaysStr =
    rounded === 0.5
      ? (useDigits ? "અડધો દિવસ (૦.૫ દિવસ)" : "0.5 day")
      : (useDigits ? `${toGujaratiNumerals(rounded)} દિવસ` : `${rounded} days`);

  const formatOneSeg = (s: LeaveSegment, withReason: boolean) => {
    const range = formatSegmentDateRange(s.startDate, s.endDate, useDigits);
    const label = s.shortLabel || s.leaveTypeName;
    const isSingle = !s.endDate || s.startDate === s.endDate;

    let segmentLabelPart = "";
    if (s.isHalfDay) {
      const sessionLabel =
        s.halfDaySession === "PM" || s.halfDaySession === "second_half"
          ? "દ્વિતીય સત્ર / બપોર"
          : "પ્રથમ સત્ર / સવાર";
      const timePart = s.halfDayTime ? `, સમય: ${s.halfDayTime}` : "";
      segmentLabelPart = `${label} (અડધો દિવસ - ${sessionLabel}${timePart})`;
    } else {
      const dStr = useDigits ? toGujaratiNumerals(s.days) : String(s.days);
      segmentLabelPart = `${label} (${dStr} દિવસ)`;
    }

    const reasonPart = withReason ? ` - ${(s.reason || "અંગત કામ").trim()}` : "";

    return isSingle
      ? `તારીખ ${range} ના રોજ ${segmentLabelPart}${reasonPart}`
      : `તારીખ ${range} સુધી ${segmentLabelPart}${reasonPart}`;
  };

  if (reasonMode === "same") {
    const parts = segments.map((s) => formatOneSeg(s, false));
    const segmentsText =
      parts.length > 1
        ? `${parts.slice(0, -1).join(", ")} તથા ${parts[parts.length - 1]}`
        : parts[0];

    const reason = (commonReason || "અંગત તથા કૌટુંબિક કામ અર્થે").trim();

    return `જય ભારત સાથે સવિનય જણાવવાનું કે, મારે ${reason} ${segmentsText} મળી કુલ ${totalDaysStr} રજા ભોગવવાની ખાસ જરૂરિયાત ઉપસ્થિત થયેલ છે.`;
  }

  // Different reasons per segment
  const parts = segments.map((s) => formatOneSeg(s, true));
  const segmentsText =
    parts.length > 1
      ? `${parts.slice(0, -1).join(", ")} તથા ${parts[parts.length - 1]}`
      : parts[0];

  return `જય ભારત સાથે સવિનય જણાવવાનું કે, મારે નીચે જણાવેલ વિગત મુજબ ${segmentsText} મળી કુલ ${totalDaysStr} રજા ભોગવવાની ખાસ જરૂરિયાત ઉપસ્થિત થયેલ છે.`;
}

export interface RelievingReportParams {
  authority?: string;
  orderNo?: string;
  orderDate?: string;
  leaveType?: string;
  days?: number | string;
  startDate?: string;
  endDate?: string;
  relieveDateTime?: string;
  chargeOfficer?: string;
  headquarterPlace?: string; // નોકરીનું સ્થળ / સ્ટેશન
  showReference?: boolean;
  referencePosition?: "above" | "below";
  referenceShowLine?: boolean;
  useDigits?: boolean;
}

export function buildRelievingReportTexts({
  authority = "મહેરબાન પોલીસ અધિક્ષકશ્રી",
  orderNo = "",
  orderDate = "",
  leaveType = "બિનપગારી રજા",
  days = 15,
  startDate = "",
  endDate = "",
  relieveDateTime = "",
  chargeOfficer = "",
  headquarterPlace = "નોકરીનું સ્થળ",
  showReference = true,
  referencePosition = "above",
  referenceShowLine = false,
  useDigits = true,
}: RelievingReportParams) {
  const daysNum = Number(days) || 0;
  const daysStr = useDigits ? toGujaratiNumerals(daysNum || days) : String(daysNum || days);

  const formattedOrderDate = orderDate
    ? formatGujaratiDate(orderDate, { useGujaratiDigits: useDigits, shortYear: false })
    : orderDate;

  const dateRange =
    startDate && endDate
      ? formatSegmentDateRange(startDate, endDate, useDigits)
      : "";

  const refPart = orderNo
    ? `સંદર્ભ: ${authority}નો રજા મંજૂરી હુકમ જા.નં. ${orderNo}${formattedOrderDate ? ` તા. ${formattedOrderDate}` : ""} અન્વયે.`
    : `સંદર્ભ: ${authority}નો રજા મંજૂરી હુકમ અન્વયે.`;

  const subject = `વિષય: મંજૂર થયેલ ${leaveType} (${daysStr} દિવસ) ભોગવવા સારૂ ફરજ પરથી છૂટા કરવા બાબત.`;

  const periodText = dateRange ? `મારી તારીખ ${dateRange} સુધીની ` : "મારી ";
  const relieveText = relieveDateTime || (startDate ? `તારીખ ${formatGujaratiDate(startDate, { useGujaratiDigits: useDigits })} ના રોજ ફરજ પૂર્ણ થયેથી` : "નિયત તારીખે ફરજ પૂર્ણ થયેથી");

  const openingRefText = showReference ? "સંદર્ભિત હુકમ અન્વયે" : "મંજૂર થયેલ હુકમ અન્વયે";

  const paragraph1 = `જય ભારત સાથે સવિનય અહેવાલ રજૂ કરવાનો કે, ${openingRefText} ${periodText}કુલ ${daysStr} દિવસની ${leaveType} મંજૂર કરવામાં આવેલ છે. સદરહુ મંજૂર થયેલ રજા ભોગવવા સારૂ મારે ${relieveText} રજા પર રવાના થવાનું હોય, જેથી મને સદરહુ રજા ભોગવવા સારૂ ફરજ પરથી છૂટા કરવા આપ સાહેબશ્રી તરફ નમ્ર વિનંતી છે.`;

  const chargeText = chargeOfficer?.trim()
    ? ` તથા મારી ગેરહાજરી દરમિયાન મારી ફરજનો જરૂરી ચાર્જ ${chargeOfficer.trim()} ને સોંપવા તજવીજ થવા`
    : "";

  const hqLabel = headquarterPlace?.trim()
    ? `હેડક્વાર્ટર (${headquarterPlace.trim()})`
    : "હેડક્વાર્ટર (નોકરીનું સ્થળ)";

  const paragraph2 = `સદરહુ રજા સમયગાળા દરમિયાન મારું ${hqLabel} છોડવાની પરવાનગી આપવા${chargeText} વિનંતી છે. રજા પૂરી થયેથી હું નિયત સમયે મારી મૂળ ફરજ ઉપર હાજર થઈ જઈશ.`;

  return {
    reference: refPart,
    showReference,
    referencePosition,
    referenceShowLine,
    subject,
    paragraph1,
    paragraph2,
  };
}

/**
 * Helper to build common officer text values
 */
function getOfficerDefaults(officer: PrintOfficer | null, useDigits = true) {
  const name = transliterateToGujarati(officer?.name) || officer?.name || "પોલીસ અધિકારી";
  const post = formatGujaratiPoliceRank(officer?.post) || officer?.post || "પોલીસ કોન્સ્ટેબલ";
  const buckle = formatGujaratiBuckleNumber(officer?.employeeCode, useDigits);
  const station = officer?.posting || "પોલીસ સ્ટેશન";
  const place = officer?.posting ? officer.posting.split(",")[0].trim() : "અરવલ્લી";

  const applicant = `અરજદાર: ${post} ${name} ${buckle ? `બ.નં. ${buckle}` : ""} ${station}`.trim();

  return {
    name,
    post,
    buckle: buckle ? (useDigits ? toGujaratiNumerals(buckle) : buckle) : "",
    station,
    place,
    applicant,
  };
}

/**
 * Default date strings for current date and upcoming dates
 */
function getSampleDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
}

/**
 * The Gujarat Police Templates Catalogue
 */
export const REPORT_TEMPLATES: ReportTemplateMeta[] = [
  // 1. Unified Leave Application (Single, Merged, or Half-Day with Time)
  {
    id: "leave_application",
    titleGu: "રજા અરજી (સામાન્ય / સળંગ / અડધો દિવસ)",
    titleEn: "Official Leave Application (Single, Combined or Half-Day)",
    category: "leave",
    badge: "રજા અરજી",
    description:
      "તમામ પ્રકારની રજા (કે.લીવ, મ.રજા, લાભ રજા, હક રજા, અડધો દિવસ રજા સમય સાથે કે સળંગ સંયુક્ત રજા) મંજૂર કરાવવા માટેની એકસૂત્રી અધિકૃત અરજી.",
    iconName: "CalendarDays",
    buildDefaults: (officer, useDigits = true) => {
      const off = getOfficerDefaults(officer, useDigits);
      const today = new Date();
      const formattedToday = formatGujaratiDate(today, { useGujaratiDigits: useDigits });

      const d1Start = getSampleDate(1);
      const d1End = getSampleDate(2);

      const defaultSegments: LeaveSegment[] = [
        {
          id: "seg_1",
          startDate: d1Start,
          endDate: d1End,
          leaveTypeCode: "cl",
          leaveTypeName: "કે.લીવ - કેઝ્યુઅલ લીવ (CL)",
          shortLabel: "કે.લીવ",
          days: 2,
          reason: "અંગત કામ અર્થે",
        },
      ];

      const hqPlace = off.station && off.station !== "પોલીસ સ્ટેશન" ? off.station : (off.place || "નોકરીનું સ્થળ");

      return {
        id: `report_${Date.now()}`,
        templateId: "leave_application",
        templateTitle: "રજા અરજી",
        showHeader: true,
        headerLine1: "ગુજરાત પોલીસ (GUJARAT POLICE)",
        headerLine2: off.station,
        toLines: `પ્રતિ,\nપોલીસ સબ ઇન્સપેક્ટરશ્રી,\n${off.station}`,
        applicantLine: off.applicant,
        subject: generateMergedLeaveSubject(defaultSegments, useDigits),
        salutation: "મહેરબાન સાહેબ,",
        paragraph1:
          "જય ભારત સાથે સવિનય જણાવવાનું કે, નીચે જણાવેલ વિગત મુજબ મારે અંગત તથા કૌટુંબિક કામ અર્થે રજા ભોગવવાની ખાસ જરૂરિયાત ઉપસ્થિત થયેલ છે. જેની તારીખવાર વિગત નીચે મુજબ છે:",
        leaveSegments: defaultSegments,
        showSegmentsTable: true,
        leaveDisplayFormat: "table",
        leaveReasonMode: "same",
        commonReason: "અંગત તથા કૌટુંબિક કામ અર્થે",
        paragraph2:
          `ઉપરોક્ત જણાવેલ રજા સમયગાળા દરમિયાન મારું હેડક્વાર્ટર (${hqPlace}) છોડવાની પરવાનગી આપવા તથા સદરહુ રજા મંજૂર કરવા આપ સાહેબશ્રીને નમ્ર અરજ છે.`,
        paragraph3:
          "રજા પૂર્ણ થયેથી હું નિયત સમયે મારી ફરજ ઉપર હાજર થઈ જઈશ.",
        reportDate: formattedToday,
        place: off.place,
        signatoryName: off.name,
        signatoryRank: off.post,
        signatoryBuckle: off.buckle,
        signatoryStation: "",
        includeSignature: false,
        useGujaratiDigits: useDigits,
        showReference: false,
        referencePosition: "above",
      };
    },
  },

  // 2. Relieving Request Report for Sanctioned Leave (બિનપગારી / ખાસ રજા છૂટા કરવા વિનંતી રિપોર્ટ)
  {
    id: "leave_relieving",
    titleGu: "રજા પર છૂટા કરવા વિનંતી રિપોર્ટ",
    titleEn: "Leave Relieving Report (Sanctioned / Binpagari / Special Leave)",
    category: "leave",
    badge: "છૂટા થવા બાબત",
    description:
      "મંજૂર થયેલ બિનપગારી રજા, ખાસ રજા કે અન્ય રજા ભોગવવા માટે નિયત તારીખે ફરજ પરથી છૂટા કરવા (રવાનગી મેળવવા) માટેનો અધિકૃત રિપોર્ટ.",
    iconName: "FileText",
    buildDefaults: (officer, useDigits = true) => {
      const off = getOfficerDefaults(officer, useDigits);
      const hqPlace = off.station && off.station !== "પોલીસ સ્ટેશન" ? off.station : (off.place || "નોકરીનું સ્થળ");
      const today = new Date();
      const formattedToday = formatGujaratiDate(today, { useGujaratiDigits: useDigits });
      const startDate = getSampleDate(1);
      const endDate = getSampleDate(15);
      const days = 15;

      const texts = buildRelievingReportTexts({
        authority: "મહેરબાન પોલીસ અધિક્ષકશ્રી",
        orderNo: useDigits ? toGujaratiNumerals("123/2026") : "123/2026",
        orderDate: getSampleDate(-5),
        leaveType: "બિનપગારી રજા",
        days,
        startDate,
        endDate,
        relieveDateTime: `તારીખ ${formatGujaratiDate(startDate, { useGujaratiDigits: useDigits })} ના રોજ સાંજે ફરજ પૂર્ણ થયેથી`,
        chargeOfficer: "",
        headquarterPlace: hqPlace,
        showReference: true,
        referencePosition: "above",
        referenceShowLine: false,
        useDigits,
      });

      return {
        id: `report_${Date.now()}`,
        templateId: "leave_relieving",
        templateTitle: "રજા પર છૂટા કરવા વિનંતી રિપોર્ટ",
        showHeader: true,
        headerLine1: "ગુજરાત પોલીસ (GUJARAT POLICE)",
        headerLine2: off.station,
        toLines: `પ્રતિ,\nપોલીસ સબ ઇન્સપેક્ટરશ્રી,\n${off.station}`,
        applicantLine: off.applicant,
        subject: texts.subject,
        reference: texts.reference,
        showReference: true,
        referencePosition: "above",
        salutation: "મહેરબાન સાહેબ,",
        paragraph1: texts.paragraph1,
        paragraph2: texts.paragraph2,
        paragraph3: "",
        reportDate: formattedToday,
        place: off.place,
        signatoryName: off.name,
        signatoryRank: off.post,
        signatoryBuckle: off.buckle,
        signatoryStation: "",
        includeSignature: false,
        useGujaratiDigits: useDigits,
      };
    },
  },

  // 6. Duty Report / Details Sending Letter (કામગીરી અહેવાલ / વિગત મોકલવા બાબત)
  {
    id: "duty_report",
    titleGu: "કામગીરી અહેવાલ / વિગત મોકલવા બાબત",
    titleEn: "Duty & Service Details Report",
    category: "duty",
    badge: "કામગીરી અહેવાલ",
    description: "સોંપાયેલ બંદોબસ્ત, પેટ્રોલિંગ, તપાસ કે અન્ય વિશેષ કામગીરીની લેખિત વિગત રજૂ કરવાનો અહેવાલ.",
    iconName: "FileText",
    buildDefaults: (officer, useDigits = true) => {
      const off = getOfficerDefaults(officer, useDigits);
      const today = new Date();
      const formattedToday = formatGujaratiDate(today, { useGujaratiDigits: useDigits });

      return {
        id: `report_${Date.now()}`,
        templateId: "duty_report",
        templateTitle: "કામગીરી અહેવાલ",
        showHeader: true,
        headerLine1: "ગુજરાત પોલીસ (GUJARAT POLICE)",
        headerLine2: off.station,
        toLines: `પ્રતિ,\nપોલીસ ઇન્સપેક્ટરશ્રી / પોલીસ સબ ઇન્સપેક્ટરશ્રી,\n${off.station}`,
        applicantLine: off.applicant,
        subject: "વિષય: સોંપવામાં આવેલ ખાસ ફરજ / બંદોબસ્ત કામગીરીનો અહેવાલ રજૂ કરવા બાબત.",
        reference: "સંદર્ભ: આપશ્રીના મૌખિક / લેખિત હુકમ અન્વયે.",
        salutation: "મહેરબાન સાહેબ,",
        paragraph1:
          "જય ભારત સાથે સવિનય અહેવાલ રજૂ કરવાનો કે, સંદર્ભિત હુકમ અન્વયે મને સોંપવામાં આવેલ ફરજ મુજબ મેં નિયત સમય દરમિયાન સ્થળ પર પહોંચી ચુસ્ત બંદોબસ્ત / પેટ્રોલિંગની કામગીરી સુપેરે બજાવેલ છે.",
        paragraph2:
          "સદરહુ કામગીરી દરમિયાન કોઈ અનિચ્છનીય બનાવ બનેલ નથી તથા કાયદો અને વ્યવસ્થાની પરિસ્થિતિ સંપૂર્ણ શાંતિપૂર્ણ રહેલ છે. જે આપ સાહેબશ્રીની જાણ સારું સવિનય વિદિત થાય.",
        reportDate: formattedToday,
        place: off.place,
        signatoryName: off.name,
        signatoryRank: off.post,
        signatoryBuckle: off.buckle,
        signatoryStation: off.station,
        includeSignature: false,
        useGujaratiDigits: useDigits,
      };
    },
  },

  // 7. Official Requisition / Allowance Request (સાધન સામગ્રી / વાહન / ભથ્થાં મંજૂરી બાબત)
  {
    id: "requisition",
    titleGu: "સાધન સામગ્રી / ભથ્થાં મંજૂરી બાબત",
    titleEn: "Official Requisition & Allowance Request",
    category: "official",
    badge: "માગણી પત્ર",
    description: "સરકારી વાહન, સાધન સામગ્રી કે મુસાફરી ભથ્થાં (TA) બાબતે સત્તાવાર માગણી અથવા મંજૂરી મેળવવાનો પત્ર.",
    iconName: "FileSpreadsheet",
    buildDefaults: (officer, useDigits = true) => {
      const off = getOfficerDefaults(officer, useDigits);
      const today = new Date();
      const formattedToday = formatGujaratiDate(today, { useGujaratiDigits: useDigits });

      return {
        id: `report_${Date.now()}`,
        templateId: "requisition",
        templateTitle: "સાધન સામગ્રી / ભથ્થાં મંજૂરી પત્ર",
        showHeader: true,
        headerLine1: "ગુજરાત પોલીસ (GUJARAT POLICE)",
        headerLine2: off.station,
        toLines: `પ્રતિ,\nપોલીસ સબ ઇન્સપેક્ટરશ્રી,\n${off.station}`,
        applicantLine: off.applicant,
        subject: "વિષય: સરકારી કામગીરી અર્થે જરૂરી વ્યવસ્થા / ભથ્થાં મંજૂર કરવા બાબત.",
        salutation: "મહેરબાન સાહેબ,",
        paragraph1:
          "સવિનય જણાવવાનું કે, ચાલુ માસ દરમિયાન સોંપવામાં આવેલ સરકારી કામગીરી સુચારુ રીતે પાર પાડવા માટે નીચે દર્શાવેલ વિગતોની જરૂરિયાત રહેલ છે.",
        paragraph2:
          "આથી ઉપરોક્ત બાબતે યોગ્ય ચકાસણી કરી જરૂરી મંજૂરી આપવા આપ સાહેબશ્રી તરફ નમ્ર વિનંતી છે.",
        reportDate: formattedToday,
        place: off.place,
        signatoryName: off.name,
        signatoryRank: off.post,
        signatoryBuckle: off.buckle,
        signatoryStation: off.station,
        includeSignature: false,
        useGujaratiDigits: useDigits,
      };
    },
  },

  // 8. Explanation / Clarification Report (ખુલાસો / અહેવાલ રજૂ કરવા બાબત)
  {
    id: "explanation",
    titleGu: "ખુલાસો / અહેવાલ રજૂ કરવા બાબત",
    titleEn: "Explanation & Clarification Report",
    category: "official",
    badge: "ખુલાસો પત્ર",
    description: "મેમો, નોટિસ કે કામગીરી સંદર્ભે ઉપરી અધિકારીશ્રી સમક્ષ સત્તાવાર ખુલાસો રજૂ કરતો લેખિત પત્ર.",
    iconName: "ShieldAlert",
    buildDefaults: (officer, useDigits = true) => {
      const off = getOfficerDefaults(officer, useDigits);
      const today = new Date();
      const formattedToday = formatGujaratiDate(today, { useGujaratiDigits: useDigits });

      return {
        id: `report_${Date.now()}`,
        templateId: "explanation",
        templateTitle: "ખુલાસો / અહેવાલ પત્ર",
        showHeader: true,
        headerLine1: "ગુજરાત પોલીસ (GUJARAT POLICE)",
        headerLine2: off.station,
        toLines: `પ્રતિ,\nપોલીસ સબ ઇન્સપેક્ટરશ્રી,\n${off.station}`,
        applicantLine: off.applicant,
        subject: "વિષય: પૂછવામાં આવેલ ખુલાસો રજૂ કરવા બાબત.",
        reference: "સંદર્ભ: આપશ્રીના જા.નં. / મેમો નંબર...",
        salutation: "મહેરબાન સાહેબ,",
        paragraph1:
          "જય ભારત સાથે સવિનય ખુલાસો રજૂ કરવાનો કે, સંદર્ભિત વિષય અન્વયે પૂછવામાં આવેલ હકીકત સંદર્ભે જણાવવાનું કે, તે સમયે સંજોગોવશાત ઉપસ્થિત થયેલ વાસ્તવિક પરિસ્થિતિ નીચે મુજબ હતી.",
        paragraph2:
          "મારી ફરજ પ્રત્યે મારો કોઈ બદઈરાદો ન હતો અને ભવિષ્યમાં આવી ક્ષતિ ન થાય તેની સંપૂર્ણ તકેદારી રાખીશ. સદરહુ ખુલાસો ગ્રાહ્ય રાખવા વિનંતી છે.",
        reportDate: formattedToday,
        place: off.place,
        signatoryName: off.name,
        signatoryRank: off.post,
        signatoryBuckle: off.buckle,
        signatoryStation: off.station,
        includeSignature: false,
        useGujaratiDigits: useDigits,
      };
    },
  },

  // 9. Blank Template (કોરો રિપોર્ટ / નવો લેટર)
  {
    id: "blank",
    titleGu: "કોરો રિપોર્ટ / નવો લેટર",
    titleEn: "Blank / Custom Police Letter",
    category: "custom",
    badge: "કસ્ટમ લેટર",
    description: "તમારી જરૂરિયાત મુજબ કોઈ પણ નવો અહેવાલ કે અરજી જાતે તૈયાર કરવા માટેનું કોરું ફોર્મેટ.",
    iconName: "PlusSquare",
    buildDefaults: (officer, useDigits = true) => {
      const off = getOfficerDefaults(officer, useDigits);
      const today = new Date();
      const formattedToday = formatGujaratiDate(today, { useGujaratiDigits: useDigits });

      return {
        id: `report_${Date.now()}`,
        templateId: "blank",
        templateTitle: "કસ્ટમ પોલીસ રિપોર્ટ / લેટર",
        showHeader: true,
        headerLine1: "ગુજરાત પોલીસ (GUJARAT POLICE)",
        headerLine2: off.station,
        toLines: `પ્રતિ,\nપોલીસ સબ ઇન્સપેક્ટરશ્રી,\n${off.station}`,
        applicantLine: off.applicant,
        subject: "વિષય: _________________________ બાબત.",
        salutation: "મહેરબાન સાહેબ,",
        paragraph1: "સવિનય જણાવવાનું કે, ...",
        paragraph2: "ઉપરોક્ત બાબતે યોગ્ય ઘટતું થવા નમ્ર વિનંતી છે.",
        reportDate: formattedToday,
        place: off.place,
        signatoryName: off.name,
        signatoryRank: off.post,
        signatoryBuckle: off.buckle,
        signatoryStation: off.station,
        includeSignature: false,
        useGujaratiDigits: useDigits,
      };
    },
  },
];
