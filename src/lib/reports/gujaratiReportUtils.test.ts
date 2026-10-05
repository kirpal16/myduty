import { describe, it, expect } from "vitest";
import {
  toGujaratiNumerals,
  toAsciiNumerals,
  formatGujaratiDate,
  formatGujaratiDateWithDay,
  formatGujaratiShiftTime,
  formatVehicleAcronym,
  formatDutyReasonWithNotes,
  formatGujaratiDistance,
  getGujaratiReportHeaders,
  formatGujaratiPeriodLabel,
  translateEnglishMonthsInText,
  translateDutyTypeToGujarati,
  formatDutyTypeDropdownLabel,
  sortDutyTypesForDropdown,
  parseApplicantLineSegments,
  formatApplicantLineBoldHtml,
} from "./gujaratiReportUtils";

describe("gujaratiReportUtils", () => {
  describe("toGujaratiNumerals and toAsciiNumerals", () => {
    it("converts ASCII numerals to Gujarati numerals", () => {
      expect(toGujaratiNumerals(12345)).toBe("૧૨૩૪૫");
      expect(toGujaratiNumerals("06789")).toBe("૦૬૭૮૯");
      expect(toGujaratiNumerals(null)).toBe("");
    });

    it("converts Gujarati numerals back to ASCII numerals", () => {
      expect(toAsciiNumerals("૧૨૩૪૫")).toBe("12345");
      expect(toAsciiNumerals("૧૪/૦૯/૨૦૨૬")).toBe("14/09/2026");
      expect(toAsciiNumerals(null)).toBe("");
    });
  });

  describe("formatGujaratiDate", () => {
    it("formats DD/MM/YYYY with Gujarati digits when enabled", () => {
      expect(formatGujaratiDate("2024-05-12", { useGujaratiDigits: true })).toBe("૧૨/૦૫/૨૦૨૪");
    });

    it("formats DD/MM/YYYY with ASCII digits when disabled", () => {
      expect(formatGujaratiDate("2024-05-12", { useGujaratiDigits: false })).toBe("12/05/2024");
    });
  });

  describe("formatGujaratiDateWithDay", () => {
    it("formats date with Gujarati day of week", () => {
      const res = formatGujaratiDateWithDay("2024-05-12", false);
      expect(res).toContain("12/05/2024");
      expect(res).toContain("રવિવાર");
    });
  });

  describe("formatVehicleAcronym", () => {
    it("returns સ.વા. for government vehicle", () => {
      expect(formatVehicleAcronym("government")).toBe("સ.વા.");
      expect(formatVehicleAcronym("govt")).toBe("સ.વા.");
    });

    it("returns ખ.વા. for private vehicle or default", () => {
      expect(formatVehicleAcronym("private")).toBe("ખ.વા.");
      expect(formatVehicleAcronym(null)).toBe("ખ.વા.");
    });
  });

  describe("formatDutyReasonWithNotes", () => {
    it("combines duty type and operational notes in parentheses", () => {
      expect(formatDutyReasonWithNotes("ઓફિસ વર્ક", "ટપાલ")).toBe("ઓફિસ વર્ક (ટપાલ)");
      expect(formatDutyReasonWithNotes("બંદોબસ્ત", "પી.એમ. બંદોબસ્ત")).toBe("બંદોબસ્ત (પી.એમ. બંદોબસ્ત)");
      expect(formatDutyReasonWithNotes("નાઈટ રાઉન્ડ", null)).toBe("નાઈટ રાઉન્ડ");
    });

    it("translates English duty types from database to Gujarati", () => {
      expect(formatDutyReasonWithNotes("Bandobast", null)).toBe("બંદોબસ્ત");
      expect(formatDutyReasonWithNotes("Bandobast", "નોકરી વહેંચણી")).toBe("બંદોબસ્ત (નોકરી વહેંચણી)");
      expect(formatDutyReasonWithNotes("Office Duty", "Office work")).toBe("ઓફિસ વર્ક");
      expect(formatDutyReasonWithNotes("Patrolling", "Highway")).toBe("પેટ્રોલિંગ (Highway)");
      expect(formatDutyReasonWithNotes("Sp Office", null)).toBe("એસ.પી. કચેરી");
      expect(formatDutyReasonWithNotes("SP_OFFICE", "ટપાલ")).toBe("એસ.પી. કચેરી (ટપાલ)");
    });
  });

  describe("translateDutyTypeToGujarati", () => {
    it("translates Sp Office and SP_OFFICE to એસ.પી. કચેરી", () => {
      expect(translateDutyTypeToGujarati("Sp Office")).toBe("એસ.પી. કચેરી");
      expect(translateDutyTypeToGujarati("SP_OFFICE")).toBe("એસ.પી. કચેરી");
      expect(translateDutyTypeToGujarati("sp office duty")).toBe("એસ.પી. કચેરી ફરજ");
      expect(translateDutyTypeToGujarati("DSP Office")).toBe("ડી.એસ.પી. કચેરી");
      expect(translateDutyTypeToGujarati("Headquarters")).toBe("હેડક્વાર્ટર");
    });

    it("translates newly added and untranslated duty types to Gujarati", () => {
      expect(translateDutyTypeToGujarati("Reserve Duty")).toBe("રિઝર્વ ડ્યુટી");
      expect(translateDutyTypeToGujarati("RESERVE_DUTY")).toBe("રિઝર્વ ડ્યુટી");
      expect(translateDutyTypeToGujarati("Night Patrolling")).toBe("નાઈટ પેટ્રોલિંગ");
      expect(translateDutyTypeToGujarati("NIGHT_PATROLLING")).toBe("નાઈટ પેટ્રોલિંગ");
      expect(translateDutyTypeToGujarati("Combing Night")).toBe("નાઈટ કોમ્બિંગ");
      expect(translateDutyTypeToGujarati("COMBING_NIGHT")).toBe("નાઈટ કોમ્બિંગ");
      expect(translateDutyTypeToGujarati("Point Duty")).toBe("પોઈન્ટ ડ્યુટી");
      expect(translateDutyTypeToGujarati("POINT_DUTY")).toBe("પોઈન્ટ ડ્યુટી");
      expect(translateDutyTypeToGujarati("Parade Duty")).toBe("પરેડ ડ્યુટી");
      expect(translateDutyTypeToGujarati("PARADE_DUTY")).toBe("પરેડ ડ્યુટી");
      expect(translateDutyTypeToGujarati("Rehearsal Duty")).toBe("રિહર્સલ ડ્યુટી");
      expect(translateDutyTypeToGujarati("REHEARSAL_DUTY")).toBe("રિહર્સલ ડ્યુટી");
      expect(translateDutyTypeToGujarati("Annual Inspection Bandobast")).toBe("વાર્ષિક ઇન્સ્પેક્શન બંદોબસ્ત");
      expect(translateDutyTypeToGujarati("ANNUAL_INSPECTION_BANDOBAST")).toBe("વાર્ષિક ઇન્સ્પેક્શન બંદોબસ્ત");
      expect(translateDutyTypeToGujarati("Guard Duty")).toBe("ગાર્ડ ડ્યુટી");
      expect(translateDutyTypeToGujarati("GUARD_DUTY")).toBe("ગાર્ડ ડ્યુટી");
      expect(translateDutyTypeToGujarati("Mock Drill Duty")).toBe("મોક ડ્રીલ ડ્યુટી");
      expect(translateDutyTypeToGujarati("MOCK_DRILL_DUTY")).toBe("મોક ડ્રીલ ડ્યુટી");
      expect(translateDutyTypeToGujarati("Festival Bandobast Duty")).toBe("તહેવાર બંદોબસ્ત ડ્યુટી");
      expect(translateDutyTypeToGujarati("FESTIVAL_BANDOBAST_DUTY")).toBe("તહેવાર બંદોબસ્ત ડ્યુટી");
      expect(translateDutyTypeToGujarati("Standby Duty")).toBe("સ્ટેન્ડબાય ડ્યુટી");
      expect(translateDutyTypeToGujarati("STANDBY_DUTY")).toBe("સ્ટેન્ડબાય ડ્યુટી");
      expect(translateDutyTypeToGujarati("Sanskrtik Karyakram Duty")).toBe("સાંસ્કૃતિક કાર્યક્રમ ડ્યુટી");
      expect(translateDutyTypeToGujarati("SANSKRTIK_KARYAKRAM_DUTY")).toBe("સાંસ્કૃતિક કાર્યક્રમ ડ્યુટી");
      expect(translateDutyTypeToGujarati("Other")).toBe("અન્ય ફરજ");
      expect(translateDutyTypeToGujarati("OTHER")).toBe("અન્ય ફરજ");
      expect(translateDutyTypeToGujarati("VIP Duty")).toBe("વી.આઇ.પી. ડ્યુટી");
      expect(translateDutyTypeToGujarati("VIP_DUTY")).toBe("વી.આઇ.પી. ડ્યુટી");
      expect(translateDutyTypeToGujarati("Nakabandi")).toBe("નાકાબંધી");
      expect(translateDutyTypeToGujarati("NAKABANDI")).toBe("નાકાબંધી");
      expect(translateDutyTypeToGujarati("Combing")).toBe("કોમ્બિંગ");
      expect(translateDutyTypeToGujarati("COMBING")).toBe("કોમ્બિંગ");
    });
  });

  describe("formatGujaratiDistance", () => {
    it("formats distance with km in Gujarati", () => {
      expect(formatGujaratiDistance(25, true)).toBe("૨૫ કિ.મી.");
      expect(formatGujaratiDistance(25, false)).toBe("25 કિ.મી.");
      expect(formatGujaratiDistance(0)).toBe("—");
    });
  });

  describe("getGujaratiReportHeaders", () => {
    it("returns correct TA Bill headers matching Photo 1", () => {
      const headers = getGujaratiReportHeaders({
        reportType: "ta",
        periodLabel: "05/2024",
        officer: {
          name: "કિરપાલસિંહ ભગવતસિંહ",
          post: "પો.હે.કો.",
          employeeCode: "16",
          posting: "વરાછા પો.સ્ટે.",
        },
        useGujaratiDigits: true,
      });

      expect(headers.title).toContain("મુસાફરી ભથ્થાબીલ");
      expect(headers.toLines).toContain("પ્રતિ,");
      expect(headers.footerRight).toContain("કિરપાલસિંહ ભગવતસિંહ");
      expect(headers.salutation).toContain("બજાવેલ ફરજ તેમજ મુસાફરીની વિગત");
      expect(headers.fromLines).toBe("નામ- પો.હે.કો. કિરપાલસિંહ ભગવતસિંહ બ.નં- ૧૬");
    });

    it("returns correct Holiday Claim headers matching Photo 2", () => {
      const headers = getGujaratiReportHeaders({
        reportType: "holiday",
        periodLabel: "ફેબ્રુઆરી/2024",
        officer: {
          name: "કિરપાલસિંહ",
          post: "પો.હે.કો.",
        },
      });

      expect(headers.title).toContain("જાહેર રજાનો ક્લેઇમ");
      expect(headers.toLines).toContain("પ્રતિ,");
      expect(headers.salutation).toContain("જાહેર રજાના દિવસોમાં બજાવેલ ફરજની વિગત");
      expect(headers.fromLines).toBe("નામ- પો.હે.કો. કિરપાલસિંહ");
    });

    it("formats applicant line with rank first, name second, buckle number third and English-to-Gujarati conversion", () => {
      // Exactly matching user photo: "નામ- વુ.આ. પો.કો. શ્રુતિ અજયસિંહ બ.નં- ૦૭૮૨"
      const headers = getGujaratiReportHeaders({
        reportType: "ta",
        periodLabel: "સપ્ટેમ્બર 2026",
        officer: {
          name: "Shruti Ajaysinh",
          post: "W.A.P.C.",
          employeeCode: "0782",
        },
        useGujaratiDigits: true,
      });

      expect(headers.fromLines).toBe("નામ- વુ.આ. પો.કો. શ્રુતિ અજયસિંહ બ.નં- ૦૭૮૨");
    });

    it("converts Rajput in names to Gujarati રાજપૂત", () => {
      const headers = getGujaratiReportHeaders({
        reportType: "ta",
        periodLabel: "સપ્ટેમ્બર 2026",
        officer: {
          name: "Shruti Rajput",
          post: "W.A.P.C.",
          employeeCode: "0782",
        },
        useGujaratiDigits: true,
      });

      expect(headers.fromLines).toBe("નામ- વુ.આ. પો.કો. શ્રુતિ રાજપૂત બ.નં- ૦૭૮૨");
    });

    it("converts Kirpal in names to Gujarati કિરપાલ (not kripal)", () => {
      const headers = getGujaratiReportHeaders({
        reportType: "ta",
        periodLabel: "સપ્ટેમ્બર 2026",
        officer: {
          name: "Kirpal Rajput",
          post: "Police Constable",
          employeeCode: "16",
        },
        useGujaratiDigits: true,
      });

      expect(headers.fromLines).toBe("નામ- પો.કો. કિરપાલ રાજપૂત બ.નં- ૧૬");
    });

    it("converts Kirpalsinh dilipsinh to Gujarati કિરપાલસિંહ દિલીપસિંહ", () => {
      const headers = getGujaratiReportHeaders({
        reportType: "ta",
        periodLabel: "સપ્ટેમ્બર 2026",
        officer: {
          name: "Kirpalsinh dilipsinh",
          post: "Head Constable",
          employeeCode: "16",
        },
        useGujaratiDigits: true,
      });

      expect(headers.fromLines).toBe("નામ- હે.કો. કિરપાલસિંહ દિલીપસિંહ બ.નં- ૧૬");
    });
  });

  describe("formatGujaratiPeriodLabel", () => {
    it("converts September 2026 into Gujarati numeric format (૦૯/૨૦૨૬) for Photo 1", () => {
      expect(formatGujaratiPeriodLabel("September 2026", { useGujaratiDigits: true, format: "numeric" })).toBe("૦૯/૨૦૨૬");
      expect(formatGujaratiPeriodLabel("September 2026", { useGujaratiDigits: false, format: "numeric" })).toBe("09/2026");
    });

    it("converts September 2026 into Gujarati named format (સપ્ટેમ્બર/૨૦૨૬) for Photo 2", () => {
      expect(formatGujaratiPeriodLabel("September 2026", { useGujaratiDigits: true, format: "name" })).toBe("સપ્ટેમ્બર/૨૦૨૬");
    });

    it("converts September 2026 into Gujarati display format (સપ્ટેમ્બર ૨૦૨૬)", () => {
      expect(formatGujaratiPeriodLabel("September 2026", { useGujaratiDigits: true, format: "display" })).toBe("સપ્ટેમ્બર ૨૦૨૬");
      expect(formatGujaratiPeriodLabel("September 2026", { useGujaratiDigits: false, format: "display" })).toBe("સપ્ટેમ્બર 2026");
    });
  });

  describe("translateEnglishMonthsInText", () => {
    it("translates English months and years in arbitrary Gujarati subject lines", () => {
      const input = "માહે- September 2026 જાહેર રજાના ક્લેઇમનું બીલ મંજુર કરવા બાબત.";
      const res = translateEnglishMonthsInText(input, true);
      expect(res).toBe("માહે- સપ્ટેમ્બર ૨૦૨૬ જાહેર રજાના ક્લેઇમનું બીલ મંજુર કરવા બાબત.");
      expect(res).not.toContain("September");
    });
  });

  describe("formatDutyTypeDropdownLabel", () => {
    it("formats with English first and Gujarati translation in parentheses second", () => {
      expect(formatDutyTypeDropdownLabel("Reserve Duty")).toBe("Reserve Duty (રિઝર્વ ડ્યુટી)");
      expect(formatDutyTypeDropdownLabel("Night Patrolling")).toBe("Night Patrolling (નાઈટ પેટ્રોલિંગ)");
      expect(formatDutyTypeDropdownLabel("Bandobast")).toBe("Bandobast (બંદોબસ્ત)");
      expect(formatDutyTypeDropdownLabel("Point Duty")).toBe("Point Duty (પોઈન્ટ ડ્યુટી)");
      expect(formatDutyTypeDropdownLabel("Other")).toBe("Other (અન્ય ફરજ)");
      expect(formatDutyTypeDropdownLabel("VIP Duty")).toBe("VIP Duty (વી.આઇ.પી. ડ્યુટી)");
    });

    it("handles null or blank safely", () => {
      expect(formatDutyTypeDropdownLabel(null)).toBe("");
      expect(formatDutyTypeDropdownLabel("")).toBe("");
    });
  });

  describe("sortDutyTypesForDropdown", () => {
    it("places most used duties first and Other at the very end", () => {
      const items = [
        { name: "Other" },
        { name: "Station Duty" },
        { name: "Custom Special Duty" },
        { name: "Patrolling" },
        { name: "Reserve Duty" },
        { name: "Point Duty" },
        { name: "Night Patrolling" },
      ];

      const sorted = sortDutyTypesForDropdown(items);
      const names = sorted.map((s) => s.name);

      // Patrolling, Night Patrolling, Point Duty, Reserve Duty, Station Duty come first in priority order
      expect(names[0]).toBe("Patrolling");
      expect(names[1]).toBe("Night Patrolling");
      expect(names[2]).toBe("Point Duty");
      expect(names[3]).toBe("Reserve Duty");
      expect(names[4]).toBe("Station Duty");
      // Custom duties before Other
      expect(names[5]).toBe("Custom Special Duty");
      // Other at the very end
      expect(names[6]).toBe("Other");
    });
  });

  describe("applicant line bold formatting (નામ and બ.નં bold in report)", () => {
    it("formats applicant line with bold HTML tags on નામ and બ.નં", () => {
      const line = "નામ- વુ. આ. લો . ર. કિ રપા લસિં હ સો લંકી બ.નં- ૦૭૮૩";
      const formatted = formatApplicantLineBoldHtml(line);
      expect(formatted).toBe(
        '<strong class="font-bold text-black">નામ-</strong> વુ. આ. લો . ર. કિ રપા લસિં હ સો લંકી <strong class="font-bold text-black">બ.નં-</strong> ૦૭૮૩',
      );
    });

    it("parses applicant line segments with isBold true for labels", () => {
      const line = "નામ- વુ.આ. પો.કો. શ્રુતિ અજયસિંહ બ.નં- ૦૭૮૨";
      const segments = parseApplicantLineSegments(line);
      expect(segments).toEqual([
        { text: "નામ-", isBold: true },
        { text: " વુ.આ. પો.કો. શ્રુતિ અજયસિંહ ", isBold: false },
        { text: "બ.નં-", isBold: true },
        { text: " ૦૭૮૨", isBold: false },
      ]);
    });

    it("handles applicant line with colon or no buckle gracefully", () => {
      const line = "નામ: હે.કો. કિરપાલસિંહ દિલીપસિંહ";
      const segments = parseApplicantLineSegments(line);
      expect(segments).toEqual([
        { text: "નામ:", isBold: true },
        { text: " હે.કો. કિરપાલસિંહ દિલીપસિંહ", isBold: false },
      ]);
    });
  });
});

