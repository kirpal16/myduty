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
  salutation: string; // 'મહેરબાન સાહેબ,'
  paragraph1: string; // Opening context / reason
  leaveSegments?: LeaveSegment[]; // Breakdown for merged/multi-leave
  showSegmentsTable?: boolean;
  leaveDisplayFormat?: "table" | "paragraph"; // 'table' = only table, 'paragraph' = only paragraph
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
    defaultReason: "અંગત કામ સબબ",
  },
  {
    code: "oh",
    shortLabel: "મ.રજા",
    fullName: "મ.રજા - મરજિયાત રજા (OH)",
    defaultReason: "તહેવાર સબબ",
  },
  {
    code: "hl",
    shortLabel: "લાભ રજા",
    fullName: "લાભ રજા - લાભ રજા / જાહેર રજા (HL)",
    defaultReason: "લાભ રજા સબબ",
  },
  {
    code: "el",
    shortLabel: "હ.રજા",
    fullName: "હ.રજા - હક રજા / અર્જિત રજા (EL)",
    defaultReason: "કૌટુંબિક કાર્ય સબબ",
  },
  {
    code: "ml",
    shortLabel: "ત.રજા",
    fullName: "ત.રજા - તબીબી / માંદગી રજા (ML)",
    defaultReason: "માંદગી સબબ",
  },
  {
    code: "other",
    shortLabel: "અન્ય રજા",
    fullName: "અન્ય રજા - અન્ય વિશેષ રજા",
    defaultReason: "ખાસ કારણ સબબ",
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
    let defaultReason = `${lt.name} સબબ`;

    if (codeUpper === "CL" || nameLower.includes("casual")) {
      shortLabel = "કે.લીવ";
      defaultReason = "અંગત કામ સબબ";
    } else if (
      codeUpper === "HL" ||
      codeUpper === "HOLIDAY_LEAVE" ||
      nameLower.includes("holiday")
    ) {
      shortLabel = "લાભ રજા";
      defaultReason = "લાભ રજા સબબ";
    } else if (
      codeUpper === "OH" ||
      codeUpper === "OPTIONAL_HOLIDAY" ||
      nameLower.includes("optional")
    ) {
      shortLabel = "મ.રજા";
      defaultReason = "તહેવાર સબબ";
    } else if (
      codeUpper === "PL" ||
      codeUpper === "EL" ||
      nameLower.includes("privilege") ||
      nameLower.includes("earned")
    ) {
      shortLabel = "હ.રજા";
      defaultReason = "કૌટુંબિક કાર્ય સબબ";
    } else if (
      codeUpper === "MEDICAL" ||
      codeUpper === "ML" ||
      codeUpper === "SICK" ||
      nameLower.includes("medic") ||
      nameLower.includes("sick")
    ) {
      shortLabel = "ત.રજા";
      defaultReason = "માંદગી સબબ";
    } else if (
      codeUpper === "LWP" ||
      codeUpper === "BINPAGARI" ||
      nameLower.includes("binpagari") ||
      nameLower.includes("બિનપગારી")
    ) {
      shortLabel = "બિનપગારી રજા";
      defaultReason = "અંગત કામ સબબ";
    } else if (
      codeUpper === "SPL" ||
      codeUpper === "SPECIAL" ||
      nameLower.includes("special") ||
      nameLower.includes("ખાસ")
    ) {
      shortLabel = "ખાસ રજા";
      defaultReason = "ખાસ ફરજ સબબ";
    } else if (codeUpper === "COMPENSATORY" || nameLower.includes("compen")) {
      shortLabel = "વળતર રજા";
      defaultReason = "વળતર રજા સબબ";
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
): string {
  if (!segments || segments.length === 0) {
    return "વિષય: રજા મંજૂર કરવા બાબત.";
  }

  const totalDays = segments.reduce((sum, s) => sum + (Number(s.days) || 0), 0);
  const daysStr = useDigits ? toGujaratiNumerals(totalDays) : String(totalDays);

  return `વિષય: ${daysStr} દિવસ રજા મંજૂર કરવા બાબત.`;
}

/**
 * Formats leave segments into natural narrative paragraph text for body view
 */
export function formatSegmentsAsNarrativeParagraph(
  segments: LeaveSegment[],
  useDigits = true,
): string {
  if (!segments || segments.length === 0) return "";
  const totalDays = segments.reduce((sum, s) => sum + (Number(s.days) || 0), 0);
  const totalDaysStr = useDigits ? toGujaratiNumerals(totalDays) : String(totalDays);

  const parts = segments.map((s) => {
    const range = formatSegmentDateRange(s.startDate, s.endDate, useDigits);
    const dStr = useDigits ? toGujaratiNumerals(s.days) : String(s.days);
    const label = s.shortLabel || s.leaveTypeName;
    return `તારીખ ${range} સુધી ${label} (${dStr} દિવસ)`;
  });

  return `સદરહુ રજાની તારીખવાર વિગત: ${parts.join(", ")} મળી કુલ ${totalDaysStr} દિવસ રજા ભોગવવાની ખાસ જરૂરિયાત ઉપસ્થિત થયેલ છે.`;
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
  // 1. Multiple / Merged Leave Spell (FEATURED)
  {
    id: "merged_leave",
    titleGu: "સંયુક્ત / મર્જ રજા અરજી",
    titleEn: "Multiple / Merged Leave (CL + OH + HL)",
    category: "leave",
    badge: "મોસ્ટ પોપ્યુલર",
    description:
      "તારીખવાર કે.લીવ, મ.રજા, લાભ રજા (જાહેર રજા) વગેરે સળંગ રજાઓ ભેગી કરીને એક સાથે મંજૂર કરવાની અધિકૃત અરજી.",
    iconName: "CalendarDays",
    buildDefaults: (officer, useDigits = true) => {
      const off = getOfficerDefaults(officer, useDigits);
      const today = new Date();
      const formattedToday = formatGujaratiDate(today, { useGujaratiDigits: useDigits });

      const d1Start = getSampleDate(1);
      const d1End = getSampleDate(3);
      const d2Start = getSampleDate(4);
      const d2End = getSampleDate(4);
      const d3Start = getSampleDate(5);
      const d3End = getSampleDate(6);

      const defaultSegments: LeaveSegment[] = [
        {
          id: "seg_1",
          startDate: d1Start,
          endDate: d1End,
          leaveTypeCode: "cl",
          leaveTypeName: "કે.લીવ - કેઝ્યુઅલ લીવ (CL)",
          shortLabel: "કે.લીવ",
          days: 3,
          reason: "અંગત કામ સબબ",
        },
        {
          id: "seg_2",
          startDate: d2Start,
          endDate: d2End,
          leaveTypeCode: "oh",
          leaveTypeName: "મ.રજા - મરજિયાત રજા (OH)",
          shortLabel: "મ.રજા",
          days: 1,
          reason: "તહેવાર સબબ",
        },
        {
          id: "seg_3",
          startDate: d3Start,
          endDate: d3End,
          leaveTypeCode: "hl",
          leaveTypeName: "લાભ રજા - લાભ રજા / જાહેર રજા (HL)",
          shortLabel: "લાભ રજા",
          days: 2,
          reason: "લાભ રજા સબબ",
        },
      ];

      return {
        id: `report_${Date.now()}`,
        templateId: "merged_leave",
        templateTitle: "સંયુક્ત / મર્જ રજા અરજી",
        showHeader: true,
        headerLine1: "ગુજરાત પોલીસ (GUJARAT POLICE)",
        headerLine2: off.station,
        toLines: `પ્રતિ,\nપોલીસ સબ ઇન્સપેક્ટરશ્રી,\n${off.station}`,
        applicantLine: off.applicant,
        subject: generateMergedLeaveSubject(defaultSegments, useDigits),
        salutation: "મહેરબાન સાહેબ,",
        paragraph1:
          "જય ભારત સાથે સવિનય જણાવવાનું કે, નીચે જણાવેલ વિગત મુજબ મારે અંગત તથા કૌટુંબિક કામ સબબ રજા ભોગવવાની ખાસ જરૂરિયાત ઉપસ્થિત થયેલ છે. જેની તારીખવાર વિગત નીચે મુજબ છે:",
        leaveSegments: defaultSegments,
        showSegmentsTable: true,
        leaveDisplayFormat: "table",
        paragraph2:
          "ઉપરોક્ત જણાવેલ રજા સમયગાળા દરમિયાન મારું હેડક્વાર્ટર છોડવાની પરવાનગી આપવા તથા સદરહુ રજા મંજૂર કરવા આપ સાહેબશ્રીને નમ્ર અરજ છે.",
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
      };
    },
  },

  // 2. Dedicated Holiday Leave (લાભ રજા / જાહેર રજા) - NEW REQUESTED
  {
    id: "holiday_leave",
    titleGu: "લાભ રજા અરજી (Holiday Leave / લાભ રજા)",
    titleEn: "Holiday Leave Application (HL)",
    category: "leave",
    badge: "લાભ રજા",
    description: "જાહેર રજા અથવા તહેવારના દિવસે ફરજ બજાવ્યા બદલ મળવાપાત્ર લાભ રજા (Holiday Leave) મંજૂર કરાવવા માટેની અરજી.",
    iconName: "CalendarDays",
    buildDefaults: (officer, useDigits = true) => {
      const off = getOfficerDefaults(officer, useDigits);
      const today = new Date();
      const formattedToday = formatGujaratiDate(today, { useGujaratiDigits: useDigits });
      const startStr = getSampleDate(1);
      const endStr = getSampleDate(2);
      const rangeStr = formatSegmentDateRange(startStr, endStr, useDigits);
      const daysCount = useDigits ? toGujaratiNumerals(2) : "2";

      const defaultSegments: LeaveSegment[] = [
        {
          id: "seg_hl",
          startDate: startStr,
          endDate: endStr,
          leaveTypeCode: "hl",
          leaveTypeName: "લાભ રજા - લાભ રજા / જાહેર રજા (HL)",
          shortLabel: "લાભ રજા",
          days: 2,
          reason: "લાભ રજા સબબ",
        },
      ];

      return {
        id: `report_${Date.now()}`,
        templateId: "holiday_leave",
        templateTitle: "લાભ રજા અરજી",
        showHeader: true,
        headerLine1: "ગુજરાત પોલીસ (GUJARAT POLICE)",
        headerLine2: off.station,
        toLines: `પ્રતિ,\nપોલીસ સબ ઇન્સપેક્ટરશ્રી,\n${off.station}`,
        applicantLine: off.applicant,
        subject: `વિષય: ${daysCount} દિવસ લાભ રજા મંજૂર કરવા બાબત.`,
        reference: "",
        salutation: "મહેરબાન સાહેબ,",
        paragraph1: `જય ભારત સાથે સવિનય જણાવવાનું કે, મારે અંગત કામ સબબ નીચે જણાવેલ વિગત મુજબ તારીખ ${rangeStr} (કુલ ${daysCount} દિવસ) લાભ રજા ભોગવવાની જરૂરિયાત છે:`,
        leaveSegments: defaultSegments,
        showSegmentsTable: true,
        leaveDisplayFormat: "table",
        paragraph2:
          "સદરહુ રજા સમયગાળા દરમિયાન મારું હેડક્વાર્ટર છોડવાની પરવાનગી આપવા તથા સદરહુ લાભ રજા મંજૂર કરવા આપ સાહેબશ્રીને નમ્ર વિનંતી છે. રજા પૂરી થયે હું સમયસર મારી ફરજ પર હાજર થઈશ.",
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

  // 3. Casual Leave (કે.લીવ / સી.એલ.)
  {
    id: "casual_leave",
    titleGu: "કેઝ્યુઅલ રજા અરજી (કે.લીવ)",
    titleEn: "Casual Leave Application (CL)",
    category: "leave",
    badge: "રજા અરજી",
    description: "અંગત અથવા આકસ્મિક કામ સબબ કેઝ્યુઅલ લીવ (CL) મંજૂર કરાવવા માટેની અરજી.",
    iconName: "FileSpreadsheet",
    buildDefaults: (officer, useDigits = true) => {
      const off = getOfficerDefaults(officer, useDigits);
      const today = new Date();
      const formattedToday = formatGujaratiDate(today, { useGujaratiDigits: useDigits });
      const startStr = getSampleDate(1);
      const endStr = getSampleDate(2);
      const rangeStr = formatSegmentDateRange(startStr, endStr, useDigits);
      const daysCount = useDigits ? toGujaratiNumerals(2) : "2";

      const defaultSegments: LeaveSegment[] = [
        {
          id: "seg_cl",
          startDate: startStr,
          endDate: endStr,
          leaveTypeCode: "cl",
          leaveTypeName: "કે.લીવ - કેઝ્યુઅલ લીવ (CL)",
          shortLabel: "કે.લીવ",
          days: 2,
          reason: "અંગત કામ સબબ",
        },
      ];

      return {
        id: `report_${Date.now()}`,
        templateId: "casual_leave",
        templateTitle: "કેઝ્યુઅલ રજા અરજી",
        showHeader: true,
        headerLine1: "ગુજરાત પોલીસ (GUJARAT POLICE)",
        headerLine2: off.station,
        toLines: `પ્રતિ,\nપોલીસ સબ ઇન્સપેક્ટરશ્રી,\n${off.station}`,
        applicantLine: off.applicant,
        subject: `વિષય: ${daysCount} દિવસ કેઝ્યુઅલ રજા (કે.લીવ) મંજૂર કરવા બાબત.`,
        salutation: "મહેરબાન સાહેબ,",
        paragraph1: `જય ભારત સાથે સવિનય જણાવવાનું કે, મારે અંગત તેમજ ઘરેલું અગત્યના કામ સબબ તારીખ ${rangeStr} (કુલ ${daysCount} દિવસ) કેઝ્યુઅલ રજા (કે.લીવ) ભોગવવાની જરૂરિયાત છે:`,
        leaveSegments: defaultSegments,
        showSegmentsTable: true,
        leaveDisplayFormat: "table",
        paragraph2:
          "સદરહુ રજા સમયગાળા દરમિયાન મારું હેડક્વાર્ટર છોડવાની પરવાનગી આપવા તથા રજા મંજૂર કરવા આપ સાહેબશ્રીને નમ્ર વિનંતી છે. રજા પૂરી થયે હું સમયસર ફરજ પર હાજર થઈશ.",
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

  // 4. Earned Leave (હક રજા - હ.રજા)
  {
    id: "earned_leave",
    titleGu: "હક રજા અરજી (હ.રજા / EL)",
    titleEn: "Earned / Privilege Leave Application",
    category: "leave",
    badge: "રજા અરજી",
    description: "લાંબા ગાળાના સામાજિક પ્રસંગ કે કૌટુંબિક કાર્ય સબબ હક રજા (EL) મંજૂર કરાવવા માટે.",
    iconName: "Award",
    buildDefaults: (officer, useDigits = true) => {
      const off = getOfficerDefaults(officer, useDigits);
      const today = new Date();
      const formattedToday = formatGujaratiDate(today, { useGujaratiDigits: useDigits });
      const startStr = getSampleDate(5);
      const endStr = getSampleDate(14);
      const rangeStr = formatSegmentDateRange(startStr, endStr, useDigits);
      const daysCount = useDigits ? toGujaratiNumerals(10) : "10";

      const defaultSegments: LeaveSegment[] = [
        {
          id: "seg_el",
          startDate: startStr,
          endDate: endStr,
          leaveTypeCode: "el",
          leaveTypeName: "હ.રજા - હક રજા / અર્જિત રજા (EL)",
          shortLabel: "હ.રજા",
          days: 10,
          reason: "કૌટુંબિક પ્રસંગ સબબ",
        },
      ];

      return {
        id: `report_${Date.now()}`,
        templateId: "earned_leave",
        templateTitle: "હક રજા અરજી",
        showHeader: true,
        headerLine1: "ગુજરાત પોલીસ (GUJARAT POLICE)",
        headerLine2: off.station,
        toLines: `પ્રતિ,\nનાયબ પોલીસ અધિક્ષકશ્રી / પોલીસ ઇન્સપેક્ટરશ્રી,\n${off.station}`,
        applicantLine: off.applicant,
        subject: `વિષય: ${daysCount} દિવસ હક રજા (હ.રજા) મંજૂર કરવા બાબત.`,
        salutation: "મહેરબાન સાહેબ,",
        paragraph1: `સવિનય જણાવવાનું કે, મારે કૌટુંબિક સામાજિક પ્રસંગ તેમજ અનિવાર્ય કામકાજ સબબ તારીખ ${rangeStr} (કુલ ${daysCount} દિવસ) હક રજા (Earned Leave) ની જરૂરિયાત ઉપસ્થિત થયેલ છે. મારા ખાતામાં હક રજા જમા છે:`,
        leaveSegments: defaultSegments,
        showSegmentsTable: true,
        leaveDisplayFormat: "table",
        paragraph2:
          "સદરહુ રજા સમયગાળા દરમિયાન હેડક્વાર્ટર છોડવાની પરવાનગી આપવા તથા સદરહુ હક રજા મંજૂર કરવા આપ સાહેબશ્રી તરફ યોગ્ય હુકમ થવા નમ્ર વિનંતી છે.",
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

  // 5. Medical Leave (તબીબી રજા / માંદગી રજા)
  {
    id: "medical_leave",
    titleGu: "તબીબી / માંદગી રજા અરજી (ત.રજા)",
    titleEn: "Medical / Sick Leave Application",
    category: "leave",
    badge: "રજા અરજી",
    description: "અસ્વસ્થતા અથવા બીમારી સબબ મેડિકલ સર્ટિફિકેટ સાથે રજા મંજૂર કરાવવા માટેની અરજી.",
    iconName: "ShieldAlert",
    buildDefaults: (officer, useDigits = true) => {
      const off = getOfficerDefaults(officer, useDigits);
      const today = new Date();
      const formattedToday = formatGujaratiDate(today, { useGujaratiDigits: useDigits });
      const startStr = getSampleDate(0);
      const endStr = getSampleDate(4);
      const rangeStr = formatSegmentDateRange(startStr, endStr, useDigits);
      const daysCount = useDigits ? toGujaratiNumerals(5) : "5";

      const defaultSegments: LeaveSegment[] = [
        {
          id: "seg_ml",
          startDate: startStr,
          endDate: endStr,
          leaveTypeCode: "ml",
          leaveTypeName: "ત.રજા - તબીબી / માંદગી રજા (ML)",
          shortLabel: "ત.રજા",
          days: 5,
          reason: "માંદગી સબબ",
        },
      ];

      return {
        id: `report_${Date.now()}`,
        templateId: "medical_leave",
        templateTitle: "તબીબી રજા અરજી",
        showHeader: true,
        headerLine1: "ગુજરાત પોલીસ (GUJARAT POLICE)",
        headerLine2: off.station,
        toLines: `પ્રતિ,\nપોલીસ સબ ઇન્સપેક્ટરશ્રી,\n${off.station}`,
        applicantLine: off.applicant,
        subject: `વિષય: ${daysCount} દિવસ માંદગી સબબ તબીબી રજા મંજૂર કરવા બાબત.`,
        reference: "સંદર્ભ: સરકારી દવાખાના / ડૉક્ટરશ્રીનું મેડિકલ સર્ટિફિકેટ.",
        salutation: "મહેરબાન સાહેબ,",
        paragraph1: `જય ભારત સાથે સવિનય જણાવવાનું કે, અચાનક તબિયત અસ્વસ્થ થવાના કારણે ડૉક્ટરશ્રી દ્વારા મને તારીખ ${rangeStr} સુધી સંપૂર્ણ આરામ (Bed Rest) કરવાની તબીબી સલાહ આપવામાં આવેલ છે. જેનું મેડિકલ સર્ટિફિકેટ આ સાથે સામેલ રાખેલ છે:`,
        leaveSegments: defaultSegments,
        showSegmentsTable: true,
        leaveDisplayFormat: "table",
        paragraph2:
          "આથી સદરહુ સમયગાળાની તબીબી રજા મંજૂર કરવા તથા સ્વસ્થ થતાં જ ફિટનેસ સર્ટિફિકેટ સાથે હાજર થવા પરવાનગી આપવા નમ્ર વિનંતી છે.",
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
