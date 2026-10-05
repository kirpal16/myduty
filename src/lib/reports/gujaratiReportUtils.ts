/**
 * Gujarati Police Report Utilities & Formatters
 *
 * Implements official Gujarat Police report terminology, letterhead structures,
 * Gujarati month/day translations, vehicle acronyms (સ.વા. / ખ.વા.),
 * and operational notes combination in parentheses.
 */

export const GUJARATI_MONTHS = [
  "જાન્યુઆરી",
  "ફેબ્રુઆરી",
  "માર્ચ",
  "એપ્રિલ",
  "મે",
  "જૂન",
  "જુલાઈ",
  "ઓગસ્ટ",
  "સપ્ટેમ્બર",
  "ઓક્ટોબર",
  "નવેમ્બર",
  "ડિસેમ્બર",
] as const;

export const GUJARATI_WEEKDAYS = [
  "રવિવાર",
  "સોમવાર",
  "મંગળવાર",
  "બુધવાર",
  "ગુરૂવાર",
  "શુક્રવાર",
  "શનિવાર",
] as const;

const GUJARATI_DIGITS: Record<string, string> = {
  "0": "૦",
  "1": "૧",
  "2": "૨",
  "3": "૩",
  "4": "૪",
  "5": "૫",
  "6": "૬",
  "7": "૭",
  "8": "૮",
  "9": "૯",
};

/**
 * Converts English digits (0-9) to Gujarati numerals (૦-૯).
 */
export function toGujaratiNumerals(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return "";
  return String(input).replace(/[0-9]/g, (d) => GUJARATI_DIGITS[d] ?? d);
}

const ASCII_DIGITS: Record<string, string> = {
  "૦": "0",
  "૧": "1",
  "૨": "2",
  "૩": "3",
  "૪": "4",
  "૫": "5",
  "૬": "6",
  "૭": "7",
  "૮": "8",
  "૯": "9",
};

/**
 * Converts Gujarati numerals (૦-૯) back to English ASCII digits (0-9).
 */
export function toAsciiNumerals(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return "";
  return String(input).replace(/[૦-૯]/g, (d) => ASCII_DIGITS[d] ?? d);
}

/**
 * Returns the Gujarati month name for a 1-based month index (1-12).
 */
export function getGujaratiMonthName(monthIndex: number): string {
  if (monthIndex < 1 || monthIndex > 12) return "";
  return GUJARATI_MONTHS[monthIndex - 1] ?? "";
}

/**
 * Formats a Date object or YYYY-MM-DD string into Gujarati date:
 * e.g. "01/05/24" or with Gujarati digits "૦૧/૦૫/૨૪"
 */
export function formatGujaratiDate(
  dateInput: Date | string | null | undefined,
  options?: { useGujaratiDigits?: boolean; shortYear?: boolean },
): string {
  if (!dateInput) return "—";
  const d = typeof dateInput === "string" ? new Date(`${dateInput}T12:00:00`) : dateInput;
  if (isNaN(d.getTime())) return String(dateInput);

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = options?.shortYear ? String(d.getFullYear()).slice(-2) : String(d.getFullYear());

  const formatted = `${day}/${month}/${year}`;
  return options?.useGujaratiDigits ? toGujaratiNumerals(formatted) : formatted;
}

/**
 * Formats a Date object or YYYY-MM-DD into "Date & Day":
 * e.g. "12/05/2024 રવિવાર" or "૧૨/૦૫/૨૦૨૪ રવિવાર"
 */
export function formatGujaratiDateWithDay(
  dateInput: Date | string | null | undefined,
  useGujaratiDigits = false,
  shortYear = false,
): string {
  if (!dateInput) return "—";
  const d = typeof dateInput === "string" ? new Date(`${dateInput}T12:00:00`) : dateInput;
  if (isNaN(d.getTime())) return String(dateInput);

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = shortYear ? String(d.getFullYear()).slice(-2) : String(d.getFullYear());
  const weekday = GUJARATI_WEEKDAYS[d.getDay()] ?? "";

  const dateStr = `${day}/${month}/${year}`;
  const finalDate = useGujaratiDigits ? toGujaratiNumerals(dateStr) : dateStr;
  return `${finalDate} ${weekday}`.trim();
}

/**
 * Formats shift hours into Gujarati time:
 * e.g. "08/00 થી 18/00" or "૦૮/૦૦ થી ૧૮/૦૦"
 */
export function formatGujaratiShiftTime(
  shiftTime: string | null | undefined,
  useGujaratiDigits = false,
): string {
  if (!shiftTime) return "—";
  // Translate "Next Day" and replace hyphens or "to" with Gujarati "થી"
  let cleaned = shiftTime
    .replace(/\(next\s*day\)/gi, "(બીજે દિવસે)")
    .replace(/next\s*day/gi, "બીજે દિવસે")
    .replace(/:/g, "/")
    .replace(/\s*-\s*/g, " થી ")
    .replace(/\s+to\s+/gi, " થી ");

  if (useGujaratiDigits) {
    cleaned = toGujaratiNumerals(cleaned);
  }
  return cleaned;
}

/**
 * Formats vehicle type acronyms as requested:
 * Government Vehicle -> "સ.વા." (Sarkari Vahan)
 * Private Vehicle -> "ખ.વા." (Khangi Vahan)
 */
export function formatVehicleAcronym(vehicleType: string | null | undefined): string {
  if (!vehicleType) return "ખ.વા.";
  const v = vehicleType.toLowerCase().trim();
  if (v === "govt" || v === "government" || v.includes("સ.વા") || v.includes("સરકારી")) {
    return "સ.વા.";
  }
  return "ખ.વા.";
}

export const DUTY_TRANSLATIONS: Record<string, string> = {
  // Duty Types
  bandobast: "બંદોબસ્ત",
  "bandobast duty": "બંદોબસ્ત",
  "vip bandobast": "વી.આઇ.પી. બંદોબસ્ત",
  "office duty": "ઓફિસ વર્ક",
  "office work": "ઓફિસ વર્ક",
  patrolling: "પેટ્રોલિંગ",
  "patrolling duty": "પેટ્રોલિંગ",
  "night round": "નાઈટ રાઉન્ડ",
  "night duty": "નાઈટ ડ્યુટી",
  "day duty": "ડે ડ્યુટી",
  investigation: "તપાસ",
  "court duty": "કોર્ટ ડ્યુટી",
  "traffic duty": "ટ્રાફિક ડ્યુટી",
  "checkpost duty": "ચેકપોસ્ટ ડ્યુટી",
  checkpost: "ચેકપોસ્ટ",
  qrt: "ક્યુ.આર.ટી. ફરજ",
  "qrt duty": "ક્યુ.આર.ટી. ફરજ",
  driver: "ડ્રાઇવર ફરજ",
  "driver duty": "ડ્રાઇવર ફરજ",
  "desk duty": "ટેબલ વર્ક",
  "station duty": "થાણા ફરજ",
  "police station duty": "થાણા ફરજ",
  "jail duty": "જેલ ગાર્ડ ફરજ",
  "jail guard": "જેલ ગાર્ડ",
  "escort duty": "જાપ્તા ફરજ",
  escort: "જાપ્તા ફરજ",
  raid: "રેડ ફરજ",
  "raid duty": "રેડ ફરજ",
  training: "તાલીમ",
  parade: "પરેડ",
  "parade duty": "પરેડ ડ્યુટી",
  "reserve duty": "રિઝર્વ ડ્યુટી",
  reserve: "રિઝર્વ ડ્યુટી",
  "night patrolling": "નાઈટ પેટ્રોલિંગ",
  "night patrol": "નાઈટ પેટ્રોલિંગ",
  "combing night": "નાઈટ કોમ્બિંગ",
  "night combing": "નાઈટ કોમ્બિંગ",
  combing: "કોમ્બિંગ",
  "combing duty": "કોમ્બિંગ",
  nakabandi: "નાકાબંધી",
  "nakabandi duty": "નાકાબંધી",
  "vip duty": "વી.આઇ.પી. ડ્યુટી",
  "point duty": "પોઈન્ટ ડ્યુટી",
  point: "પોઈન્ટ ડ્યુટી",
  "rehearsal duty": "રિહર્સલ ડ્યુટી",
  rehearsal: "રિહર્સલ ડ્યુટી",
  "annual inspection bandobast": "વાર્ષિક ઇન્સ્પેક્શન બંદોબસ્ત",
  "annual inspection": "વાર્ષિક ઇન્સ્પેક્શન બંદોબસ્ત",
  "guard duty": "ગાર્ડ ડ્યુટી",
  guard: "ગાર્ડ ડ્યુટી",
  "mock drill duty": "મોક ડ્રીલ ડ્યુટી",
  "mock drill": "મોક ડ્રીલ ડ્યુટી",
  mockdrill: "મોક ડ્રીલ ડ્યુટી",
  "festival bandobast duty": "તહેવાર બંદોબસ્ત ડ્યુટી",
  "festival bandobast": "તહેવાર બંદોબસ્ત",
  "standby duty": "સ્ટેન્ડબાય ડ્યુટી",
  standby: "સ્ટેન્ડબાય ડ્યુટી",
  "sanskrtik karyakram duty": "સાંસ્કૃતિક કાર્યક્રમ ડ્યુટી",
  "sanskrtik karyakram": "સાંસ્કૃતિક કાર્યક્રમ ડ્યુટી",
  "cultural program duty": "સાંસ્કૃતિક કાર્યક્રમ ડ્યુટી",
  "cultural program": "સાંસ્કૃતિક કાર્યક્રમ",
  other: "અન્ય ફરજ",
  "other duty": "અન્ય ફરજ",
  leave: "રજા",
  // Police Office & Branch Duties
  "sp office": "એસ.પી. કચેરી",
  "sp_office": "એસ.પી. કચેરી",
  "sp office duty": "એસ.પી. કચેરી ફરજ",
  "sp branch": "એસ.પી. શાખા",
  "dsp office": "ડી.એસ.પી. કચેરી",
  "dsp_office": "ડી.એસ.પી. કચેરી",
  "cp office": "સી.પી. કચેરી",
  "cp_office": "સી.પી. કચેરી",
  "dysp office": "ડીવાય.એસ.પી. કચેરી",
  "dysp_office": "ડીવાય.એસ.પી. કચેરી",
  "sdpo office": "એસ.ડી.પી.ઓ. કચેરી",
  "sdpo_office": "એસ.ડી.પી.ઓ. કચેરી",
  headquarter: "હેડક્વાર્ટર",
  headquarters: "હેડક્વાર્ટર",
  hq: "હેડક્વાર્ટર",
  "crime branch": "ક્રાઈમ બ્રાન્ચ",
  crime_branch: "ક્રાઈમ બ્રાન્ચ",
  sog: "એસ.ઓ.જી.",
  pcb: "પી.સી.બી.",
  lcb: "એલ.સી.બી.",
  "control room": "કંટ્રોલ રૂમ",
  control_room: "કંટ્રોલ રૂમ",
  wireless: "વાયરલેસ",
  traffic: "ટ્રાફિક ડ્યુટી",
  warrant: "વોરંટ બજવણી",
  "warrant duty": "વોરંટ બજવણી",
  summon: "સમન્સ બજવણી",
  "summon duty": "સમન્સ બજવણી",

  // Days & Common terms
  sunday: "રવિવાર",
  "sunday off": "રવિવાર",
  monday: "સોમવાર",
  tuesday: "મંગળવાર",
  wednesday: "બુધવાર",
  thursday: "ગુરૂવાર",
  friday: "શુક્રવાર",
  saturday: "શનિવાર",
  "2nd saturday": "બીજો શનિવાર",
  "4th saturday": "ચોથો શનિવાર",
  "second saturday": "બીજો શનિવાર",
  "fourth saturday": "ચોથો શનિવાર",
  "2nd saturday off": "બીજો શનિવાર",
  "4th saturday off": "ચોથો શનિવાર",
  "2nd saturday off (બીજો શનિવાર)": "બીજો શનિવાર",
  "4th saturday off (ચોથો શનિવાર)": "ચોથો શનિવાર",
  "2nd saturday off (બીજો શનિવાર રજા)": "બીજો શનિવાર",
  "4th saturday off (ચોથો શનિવાર રજા)": "ચોથો શનિવાર",
  holiday: "જાહેર રજા",
  "public holiday": "જાહેર રજા",
  "government holiday": "સરકારી રજા",
};

export function translateDutyTypeToGujarati(val: string | null | undefined): string {
  if (!val) return "";
  const trimmed = val.trim();
  const lower = trimmed.toLowerCase();
  const normalized = lower.replace(/_/g, " ").replace(/\s+/g, " ").trim();

  if (DUTY_TRANSLATIONS[lower]) {
    return DUTY_TRANSLATIONS[lower];
  }
  if (DUTY_TRANSLATIONS[normalized]) {
    return DUTY_TRANSLATIONS[normalized];
  }

  // Common police office / branch patterns
  if (normalized === "sp office" || normalized.includes("sp office")) {
    return "એસ.પી. કચેરી";
  }
  if (normalized === "dsp office" || normalized.includes("dsp office")) {
    return "ડી.એસ.પી. કચેરી";
  }
  if (normalized === "cp office" || normalized.includes("cp office")) {
    return "સી.પી. કચેરી";
  }
  if (normalized.includes("headquarter") || normalized === "hq") {
    return "હેડક્વાર્ટર";
  }

  return trimmed;
}

/**
 * Formats a duty type for dropdowns: English first, Gujarati in parentheses second.
 * e.g. "Reserve Duty (રિઝર્વ ડ્યુટી)", "Patrolling (પેટ્રોલિંગ)", "Other (અન્ય ફરજ)"
 */
export function formatDutyTypeDropdownLabel(name: string | null | undefined): string {
  if (!name) return "";
  const guj = translateDutyTypeToGujarati(name);
  if (guj && guj.toLowerCase() !== name.toLowerCase()) {
    return `${name} (${guj})`;
  }
  return name;
}

const MOST_USED_DUTY_ORDER: string[] = [
  "patrolling",
  "night patrolling",
  "point duty",
  "bandobast",
  "reserve duty",
  "station duty",
  "office duty",
  "nakabandi",
  "combing",
  "combing night",
  "vip duty",
  "court duty",
  "escort duty",
  "guard duty",
  "parade duty",
  "rehearsal duty",
  "standby duty",
  "mock drill duty",
  "festival bandobast duty",
  "annual inspection bandobast",
  "sanskrtik karyakram duty",
  "training",
  "night duty",
  "sp office",
  "qrt duty",
];

/**
 * Sorts duty types so most frequently used operational duties appear first,
 * unranked duties follow alphabetically, and "Other" appears at the very end.
 */
export function sortDutyTypesForDropdown<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aNorm = a.name.toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ").trim();
    const bNorm = b.name.toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ").trim();

    const aIsOther = aNorm === "other" || aNorm === "other duty" || aNorm.startsWith("other");
    const bIsOther = bNorm === "other" || bNorm === "other duty" || bNorm.startsWith("other");

    if (aIsOther && !bIsOther) return 1;
    if (!aIsOther && bIsOther) return -1;

    const aIndex = MOST_USED_DUTY_ORDER.indexOf(aNorm);
    const bIndex = MOST_USED_DUTY_ORDER.indexOf(bNorm);

    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;

    return a.name.localeCompare(b.name);
  });
}


/**
 * Combines Duty Type with Operational Notes in parentheses:
 * e.g. "ઓફિસ વર્ક (ટપાલ)", "બંદોબસ્ત (પી.એમ. બંદોબસ્ત)", "ગ્રાઉન્ડ વર્કિંગ (પ્રત્યક્ષ તાલીમ)"
 */
export function formatDutyReasonWithNotes(
  dutyType: string | null | undefined,
  notes: string | null | undefined,
): string {
  const rawDt = dutyType?.trim();
  const rawNt = notes?.trim();

  const dt = rawDt ? translateDutyTypeToGujarati(rawDt) : "";
  const nt = rawNt ? translateDutyTypeToGujarati(rawNt) : "";

  if (dt && nt) {
    if (dt.toLowerCase() === nt.toLowerCase()) {
      return dt;
    }
    return `${dt} (${nt})`;
  }
  return dt || nt || "—";
}

/**
 * Formats From - To route:
 * e.g. "આંબલીયારા થી પ્રાંતિજ"
 */
export function formatGujaratiRoute(from: string | null | undefined, to: string | null | undefined): string {
  const f = from?.trim();
  const t = to?.trim();
  if (!f && !t) return "—";
  if (f && t) return `${f} થી ${t}`;
  return f || t || "—";
}

/**
 * Formats distance in km:
 * e.g. "૮૪ કિ.મી." or "84 કિ.મી."
 */
export function formatGujaratiDistance(
  distanceKm: number | string | null | undefined,
  useGujaratiDigits = false,
): string {
  if (distanceKm === null || distanceKm === undefined || distanceKm === "") return "—";
  const num = Number(distanceKm);
  if (isNaN(num) || num <= 0) return "—";
  const numStr = Number.isInteger(num) ? String(num) : num.toFixed(1);
  const formatted = useGujaratiDigits ? toGujaratiNumerals(numStr) : numStr;
  return `${formatted} કિ.મી.`;
}

const ENGLISH_MONTHS: Record<string, { index: number; gujarati: string; num: string }> = {
  january: { index: 1, gujarati: "જાન્યુઆરી", num: "01" },
  february: { index: 2, gujarati: "ફેબ્રુઆરી", num: "02" },
  march: { index: 3, gujarati: "માર્ચ", num: "03" },
  april: { index: 4, gujarati: "એપ્રિલ", num: "04" },
  may: { index: 5, gujarati: "મે", num: "05" },
  june: { index: 6, gujarati: "જૂન", num: "06" },
  july: { index: 7, gujarati: "જુલાઈ", num: "07" },
  august: { index: 8, gujarati: "ઓગસ્ટ", num: "08" },
  september: { index: 9, gujarati: "સપ્ટેમ્બર", num: "09" },
  october: { index: 10, gujarati: "ઓક્ટોબર", num: "10" },
  november: { index: 11, gujarati: "નવેમ્બર", num: "11" },
  december: { index: 12, gujarati: "ડિસેમ્બર", num: "12" },
  jan: { index: 1, gujarati: "જાન્યુઆરી", num: "01" },
  feb: { index: 2, gujarati: "ફેબ્રુઆરી", num: "02" },
  mar: { index: 3, gujarati: "માર્ચ", num: "03" },
  apr: { index: 4, gujarati: "એપ્રિલ", num: "04" },
  jun: { index: 6, gujarati: "જૂન", num: "06" },
  jul: { index: 7, gujarati: "જુલાઈ", num: "07" },
  aug: { index: 8, gujarati: "ઓગસ્ટ", num: "08" },
  sep: { index: 9, gujarati: "સપ્ટેમ્બર", num: "09" },
  sept: { index: 9, gujarati: "સપ્ટેમ્બર", num: "09" },
  oct: { index: 10, gujarati: "ઓક્ટોબર", num: "10" },
  nov: { index: 11, gujarati: "નવેમ્બર", num: "11" },
  dec: { index: 12, gujarati: "ડિસેમ્બર", num: "12" },
};

/**
 * Parses any period string (e.g. "September 2026", "09/2026", "2026") into components
 */
export function parsePeriodLabel(label: string | null | undefined) {
  if (!label) return null;
  const s = label.trim();

  // Check for "MM/YYYY" or "M/YYYY"
  const slashMatch = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const m = parseInt(slashMatch[1], 10);
    const y = parseInt(slashMatch[2], 10);
    const mStr = String(m).padStart(2, "0");
    const guName = GUJARATI_MONTHS[m - 1] ?? "";
    return { monthIndex: m, monthNum: mStr, year: y, gujaratiMonth: guName };
  }

  // Check for "MonthName YYYY"
  const nameMatch = s.match(/([A-Za-z]+)\s*(\d{4})/i);
  if (nameMatch) {
    const rawMonth = nameMatch[1].toLowerCase();
    const y = parseInt(nameMatch[2], 10);
    const found = ENGLISH_MONTHS[rawMonth];
    if (found) {
      return {
        monthIndex: found.index,
        monthNum: found.num,
        year: y,
        gujaratiMonth: found.gujarati,
      };
    }
  }

  // Check for Gujarati month name + year: e.g. "સપ્ટેમ્બર 2026"
  for (let i = 0; i < GUJARATI_MONTHS.length; i++) {
    const gm = GUJARATI_MONTHS[i];
    if (s.includes(gm)) {
      const yMatch = s.match(/(\d{4})/);
      const y = yMatch ? parseInt(yMatch[1], 10) : new Date().getFullYear();
      return {
        monthIndex: i + 1,
        monthNum: String(i + 1).padStart(2, "0"),
        year: y,
        gujaratiMonth: gm,
      };
    }
  }

  return null;
}

/**
 * Converts English period label ("September 2026") into Gujarati formats:
 * - "numeric" (Photo 1): "૦૯/૨૦૨૬" or "09/2026"
 * - "name" (Photo 2): "સપ્ટેમ્બર/૨૦૨૬" or "સપ્ટેમ્બર/2026"
 * - "display": "સપ્ટેમ્બર ૨૦૨૬" or "સપ્ટેમ્બર 2026"
 */
export function formatGujaratiPeriodLabel(
  periodLabel: string | null | undefined,
  options?: {
    useGujaratiDigits?: boolean;
    format?: "numeric" | "name" | "display";
  },
): string {
  if (!periodLabel) return "—";
  const parsed = parsePeriodLabel(periodLabel);
  const useGuj = options?.useGujaratiDigits ?? true;
  const fmt = options?.format ?? "display";

  if (!parsed) {
    if (/whole\s*year/i.test(periodLabel)) {
      const yMatch = periodLabel.match(/\d{4}/);
      const y = yMatch ? yMatch[0] : "";
      const yStr = useGuj ? toGujaratiNumerals(y) : y;
      return `આખું વર્ષ ${yStr}`.trim();
    }
    return useGuj ? toGujaratiNumerals(periodLabel) : periodLabel;
  }

  const mNum = useGuj ? toGujaratiNumerals(parsed.monthNum) : parsed.monthNum;
  const yStr = useGuj ? toGujaratiNumerals(parsed.year) : String(parsed.year);

  if (fmt === "numeric") {
    // Photo 1 format: "૦૫/૨૦૨૪"
    return `${mNum}/${yStr}`;
  }

  if (fmt === "name") {
    // Photo 2 format: "ફેબ્રુઆરી/૨૦૨૪"
    return `${parsed.gujaratiMonth}/${yStr}`;
  }

  // "display" format: "સપ્ટેમ્બર ૨૦૨૬"
  return `${parsed.gujaratiMonth} ${yStr}`;
}

/**
 * Translates any English month names (e.g. "September 2026") present in any text to Gujarati.
 */
export function translateEnglishMonthsInText(text: string | null | undefined, useGujaratiDigits = true): string {
  if (!text) return "";
  let res = text.replace(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/gi,
    (m) => ENGLISH_MONTHS[m.toLowerCase()]?.gujarati || m,
  );
  if (useGujaratiDigits) {
    res = res.replace(/(\d{4})/g, (yr) => toGujaratiNumerals(yr));
  }
  return res;
}

/**
 * Pre-fills standard Gujarat Police letterhead headers based on officer data
 */
/**
 * The report's day-type label ("Working Day", "Weekend Off", "Public
 * Holiday" …) in Gujarati, for the printed duty register.
 */
export function translateDayTypeToGujarati(dayType: string | null | undefined): string {
  if (!dayType) return "—";
  const v = dayType.trim().toLowerCase();
  if (v.includes("optional")) return "કામકાજનો દિવસ (મરજિયાત રજા)";
  if (v.startsWith("working")) return "કામકાજનો દિવસ";
  if (v.includes("weekend")) return "સાપ્તાહિક રજા";
  if (v.includes("public")) return "જાહેર રજા";
  if (v.includes("day off")) return "રજાનો દિવસ";
  return dayType;
}

/**
 * Known police designations and ranks with official Gujarat Police abbreviations.
 */
export const POLICE_RANK_TRANSLATIONS: Record<string, string> = {
  // Constables & Armed Constables
  wapc: "વુ.આ. પો.કો.",
  "w.a.p.c.": "વુ.આ. પો.કો.",
  "w.a.p.c": "વુ.આ. પો.કો.",
  "women armed police constable": "વુ.આ. પો.કો.",
  "woman armed police constable": "વુ.આ. પો.કો.",
  "female armed police constable": "વુ.આ. પો.કો.",
  wpc: "વુ.પો.કો.",
  "w.p.c.": "વુ.પો.કો.",
  "w.p.c": "વુ.પો.કો.",
  "women police constable": "વુ.પો.કો.",
  "woman police constable": "વુ.પો.કો.",
  "female police constable": "વુ.પો.કો.",
  apc: "આ.પો.કો.",
  "a.p.c.": "આ.પો.કો.",
  "a.p.c": "આ.પો.કો.",
  "armed police constable": "આ.પો.કો.",
  "armed constable": "આ.પો.કો.",
  pc: "પો.કો.",
  "p.c.": "પો.કો.",
  "p.c": "પો.કો.",
  "police constable": "પો.કો.",
  constable: "પો.કો.",
  "unarmed police constable": "બિ.આ.પો.કો.",
  "unarmed constable": "બિ.આ.પો.કો.",
  uapc: "બિ.આ.પો.કો.",
  "u.a.p.c.": "બિ.આ.પો.કો.",

  // Head Constables
  wahc: "વુ.આ. હે.કો.",
  "w.a.h.c.": "વુ.આ. હે.કો.",
  "woman armed head constable": "વુ.આ. હે.કો.",
  "women armed head constable": "વુ.આ. હે.કો.",
  whc: "વુ.હે.કો.",
  "w.h.c.": "વુ.હે.કો.",
  "woman head constable": "વુ.હે.કો.",
  "women head constable": "વુ.હે.કો.",
  ahc: "આ.હે.કો.",
  "a.h.c.": "આ.હે.કો.",
  "armed head constable": "આ.હે.કો.",
  hc: "હે.કો.",
  "h.c.": "હે.કો.",
  "head constable": "હે.કો.",
  "unarmed head constable": "બિ.આ.હે.કો.",

  // Officers
  asi: "એ.એસ.આઇ.",
  "a.s.i.": "એ.એસ.આઇ.",
  "assistant sub inspector": "એ.એસ.આઇ.",
  "asst sub inspector": "એ.એસ.આઇ.",
  psi: "પી.એસ.આઇ.",
  "p.s.i.": "પી.એસ.આઇ.",
  "police sub inspector": "પી.એસ.આઇ.",
  "sub inspector": "પી.એસ.આઇ.",
  pi: "પી.આઇ.",
  "p.i.": "પી.આઇ.",
  "police inspector": "પી.આઇ.",
  inspector: "પી.આઇ.",
  dysp: "ના.પો.અધિ.",
  "dy.sp": "ના.પો.અધિ.",
  "d.y.s.p.": "ના.પો.અધિ.",
  "deputy superintendent of police": "ના.પો.અધિ.",
  sp: "પો.અધિ.",
  "s.p.": "પો.અધિ.",
  "superintendent of police": "પો.અધિ.",
  cp: "પો.કમિ.",
  "c.p.": "પો.કમિ.",
  "commissioner of police": "પો.કમિ.",

  // Lokrakshak & others
  lrd: "લોકરક્ષક",
  "l.r.d.": "લોકરક્ષક",
  lokrakshak: "લોકરક્ષક",
  "lok rakshak": "લોકરક્ષક",
  wlrd: "મહિલા લોકરક્ષક",
  "w.l.r.d.": "મહિલા લોકરક્ષક",
  "women lokrakshak": "મહિલા લોકરક્ષક",
  "woman lokrakshak": "મહિલા લોકરક્ષક",
  driver: "ડ્રાઇવર",
  "police driver": "ડ્રાઇવર",
  grd: "જી.આર.ડી.",
  "g.r.d.": "જી.આર.ડી.",
  "home guard": "હોમગાર્ડ",
  homeguard: "હોમગાર્ડ",
};

/**
 * Checks if a string contains Gujarati Unicode characters.
 */
export function containsGujarati(text: string | null | undefined): boolean {
  if (!text) return false;
  return /[\u0A80-\u0AFF]/.test(text);
}

/**
 * Common names dictionary for highly accurate Gujarati conversions.
 */
const GUJARATI_NAME_MAP: Record<string, string> = {
  shruti: "શ્રુતિ",
  ajay: "અજય",
  ajaysinh: "અજયસિંહ",
  kirpal: "કિરપાલ",
  kirpalsinh: "કિરપાલસિંહ",
  kripal: "કિરપાલ",
  kripalsinh: "કિરપાલસિંહ",
  dilip: "દિલીપ",
  dilipsinh: "દિલીપસિંહ",
  dilipsingh: "દિલીપસિંહ",
  bhagwatsinh: "ભગવતસિંહ",
  bhagwat: "ભગવત",
  harsh: "હર્ષ",
  hardik: "હાર્દિક",
  jay: "જય",
  vijay: "વિજય",
  sanjay: "સંજય",
  amit: "અમિત",
  rahul: "રાહુલ",
  nikunj: "નિકુંજ",
  chirag: "ચિરાગ",
  bhavesh: "ભાવેશ",
  kamlesh: "કમલેશ",
  rajesh: "રાજેશ",
  mahesh: "મહેશ",
  ramesh: "રમેશ",
  suresh: "સુરેશ",
  dinesh: "દિનેશ",
  naresh: "નરેશ",
  hitesh: "હિતેશ",
  paresh: "પરેશ",
  kalpesh: "કલ્પેશ",
  mukesh: "મુકેશ",
  yogesh: "યોગેશ",
  jagdish: "જગદીશ",
  pravin: "પ્રવીણ",
  ashok: "અશોક",
  anand: "આનંદ",
  ketan: "કેતન",
  pratik: "પ્રતીક",
  dharmesh: "ધર્મેશ",
  vishal: "વિશાલ",
  pooja: "પૂજા",
  neha: "નેહા",
  priya: "પ્રિયા",
  shreya: "શ્રેયા",
  hetal: "હેતલ",
  kinjal: "કિંજલ",
  bhumika: "ભૂમિકા",
  payal: "પાયલ",
  artiben: "આરતીબેન",
  patel: "પટેલ",
  shah: "શાહ",
  joshi: "જોષી",
  parmar: "પરમાર",
  rathod: "રાઠોડ",
  jadeja: "જાડેજા",
  solanki: "સોલંકી",
  makwana: "મકવાણા",
  zala: "ઝાલા",
  chauhan: "ચૌહાણ",
  chavda: "ચાવડા",
  gohil: "ગોહિલ",
  vaghela: "વાઘેલા",
  barad: "બારડ",
  rabari: "રબારી",
  bharwad: "ભરવાડ",
  ahir: "આહીર",
  desai: "દેસાઈ",
  dave: "દવે",
  trivedi: "ત્રિવેદી",
  bhatt: "ભટ્ટ",
  pandya: "પંડ્યા",
  sharma: "શર્મા",
  verma: "વર્મા",
  modi: "મોદી",
  soni: "સોની",
  rajput: "રાજપૂત",
  rajpoot: "રાજપૂત",
};

/**
 * Phonetically transliterates a single English word to Gujarati script.
 */
function phoneticWordToGujarati(word: string): string {
  const lower = word.toLowerCase();
  if (GUJARATI_NAME_MAP[lower]) return GUJARATI_NAME_MAP[lower];

  // Compound suffix checks (e.g. sinh, singh, bhai, ben, kumar)
  if (lower.endsWith("sinh") && lower.length > 4) {
    const base = lower.slice(0, -4);
    return phoneticWordToGujarati(base) + "સિંહ";
  }
  if (lower.endsWith("singh") && lower.length > 5) {
    const base = lower.slice(0, -5);
    return phoneticWordToGujarati(base) + "સિંહ";
  }
  if (lower.endsWith("bhai") && lower.length > 4) {
    const base = lower.slice(0, -4);
    return phoneticWordToGujarati(base) + "ભાઈ";
  }
  if (lower.endsWith("ben") && lower.length > 3) {
    const base = lower.slice(0, -3);
    return phoneticWordToGujarati(base) + "બેન";
  }
  if (lower.endsWith("kumar") && lower.length > 5) {
    const base = lower.slice(0, -5);
    return phoneticWordToGujarati(base) + "કુમાર";
  }

  // Token-by-token phonetic parser
  let out = "";
  let i = 0;
  const len = lower.length;

  const CONSONANTS: Record<string, string> = {
    shr: "શ્ર",
    ksh: "ક્ષ",
    gy: "જ્ઞ",
    chh: "છ",
    ch: "ચ",
    kh: "ખ",
    gh: "ઘ",
    jh: "ઝ",
    th: "થ",
    dh: "ધ",
    ph: "ફ",
    bh: "ભ",
    sh: "શ",
    tr: "ત્ર",
    pr: "પ્ર",
    br: "બ્ર",
    dr: "દ્ર",
    kr: "ક્ર",
    gr: "ગ્ર",
    k: "ક",
    g: "ગ",
    j: "જ",
    z: "ઝ",
    t: "ત",
    d: "દ",
    n: "ન",
    p: "પ",
    f: "ફ",
    b: "બ",
    m: "મ",
    y: "ય",
    r: "ર",
    l: "લ",
    v: "વ",
    w: "વ",
    s: "સ",
    h: "હ",
  };

  const VOWEL_MATRAS: Record<string, string> = {
    aa: "ા",
    ee: "ી",
    oo: "ૂ",
    ai: "ૈ",
    au: "ૌ",
    ou: "ૌ",
    a: "", // implicit
    i: "િ",
    u: "ુ",
    e: "ે",
    o: "ો",
  };

  const INITIAL_VOWELS: Record<string, string> = {
    aa: "આ",
    ee: "ઈ",
    oo: "ઊ",
    ai: "ઐ",
    au: "ઔ",
    ou: "ઔ",
    a: "અ",
    i: "ઇ",
    u: "ઉ",
    e: "એ",
    o: "ઓ",
  };

  let prevWasConsonant = false;

  while (i < len) {
    // Check 3-char consonants
    const sub3 = lower.slice(i, i + 3);
    if (CONSONANTS[sub3]) {
      out += CONSONANTS[sub3];
      i += 3;
      prevWasConsonant = true;
      continue;
    }

    // Check 2-char consonants
    const sub2 = lower.slice(i, i + 2);
    if (CONSONANTS[sub2]) {
      out += CONSONANTS[sub2];
      i += 2;
      prevWasConsonant = true;
      continue;
    }

    // Check 2-char vowels
    if (VOWEL_MATRAS[sub2] !== undefined) {
      if (prevWasConsonant) {
        out += VOWEL_MATRAS[sub2];
      } else {
        out += INITIAL_VOWELS[sub2] || "અ";
      }
      i += 2;
      prevWasConsonant = false;
      continue;
    }

    // Check 1-char consonants
    const c1 = lower[i];
    if (CONSONANTS[c1]) {
      out += CONSONANTS[c1];
      i += 1;
      prevWasConsonant = true;
      continue;
    }

    // Check 1-char vowels
    if (VOWEL_MATRAS[c1] !== undefined) {
      if (prevWasConsonant) {
        // End of word 'a' usually sounds like 'ા' in names (e.g., Pooja -> પૂજા, Neha -> નેહા)
        if (c1 === "a" && i === len - 1) {
          out += "ા";
        } else {
          out += VOWEL_MATRAS[c1];
        }
      } else {
        out += INITIAL_VOWELS[c1] || "અ";
      }
      i += 1;
      prevWasConsonant = false;
      continue;
    }

    // Pass punctuation or numbers through
    out += c1;
    i++;
    prevWasConsonant = false;
  }

  return out;
}

/**
 * Transliterates an English string (name or words) to Gujarati script.
 * If the string already contains Gujarati characters, it is preserved untouched.
 */
export function transliterateToGujarati(text: string | null | undefined): string {
  if (!text) return "";
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (containsGujarati(trimmed)) return trimmed;

  return trimmed
    .split(/\s+/)
    .map((word) => phoneticWordToGujarati(word))
    .join(" ");
}

/**
 * Converts English Police Rank / Designation to official Gujarat Police acronym.
 * e.g. "W.A.P.C." / "WAPC" -> "વુ.આ. પો.કો.", "Police Constable" -> "પો.કો."
 * If already Gujarati, keeps it unchanged.
 */
export function formatGujaratiPoliceRank(post: string | null | undefined): string {
  if (!post) return "";
  const trimmed = post.trim();
  if (!trimmed) return "";
  if (containsGujarati(trimmed)) return trimmed;

  const key = trimmed.toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  if (POLICE_RANK_TRANSLATIONS[key]) {
    return POLICE_RANK_TRANSLATIONS[key];
  }
  const noDots = key.replace(/\./g, "").trim();
  if (POLICE_RANK_TRANSLATIONS[noDots]) {
    return POLICE_RANK_TRANSLATIONS[noDots];
  }
  return transliterateToGujarati(trimmed);
}

/**
 * Formats a buckle/badge number cleanly into Gujarati numerals.
 * e.g. "0782" or "BK-0782" -> "૦૭૮૨"
 */
export function formatGujaratiBuckleNumber(
  buckleInput: string | null | undefined,
  useGujaratiDigits = true,
): string {
  if (!buckleInput) return "";
  const cleaned = buckleInput.trim();
  if (!cleaned) return "";

  // Strip prefixes like "BK-", "Buckle #", "B.No-", "B.No.", "No.", "બ.નં-"
  const stripped = cleaned
    .replace(/^(bk|b\.?\s*no\.?|buckle\s*#?|no\.?|બ\.?\s*નં\.?-?)\s*/i, "")
    .trim();

  return useGujaratiDigits ? toGujaratiNumerals(stripped) : stripped;
}

/**
 * Formats the official Gujarat Police applicant / officer identification line:
 * e.g. "નામ- વુ.આ. પો.કો. શ્રુતિ અજયસિંહ બ.નં- ૦૭૮૨"
 * Displays above the subject line in printed / exported official reports.
 */
export function formatGujaratiApplicantLine(
  officer: {
    name?: string | null;
    post?: string | null;
    employeeCode?: string | null;
  } | null | undefined,
  useGujaratiDigits = true,
): string {
  if (!officer) return "";

  const rank = formatGujaratiPoliceRank(officer.post);
  const name = transliterateToGujarati(officer.name);
  const buckle = formatGujaratiBuckleNumber(officer.employeeCode, useGujaratiDigits);

  const parts = [rank, name].filter(Boolean).join(" ").trim();
  if (!parts && !buckle) return "";

  const nameSection = parts || "પોલીસ કર્મી";
  const buckleSection = buckle ? ` બ.નં- ${buckle}` : "";

  return `નામ- ${nameSection}${buckleSection}`.trim();
}

/**
 * Parses applicant line into segments indicating which portions are bold labels
 * (e.g. "નામ-", "નામ:", "નામ", "બ.નં-", "બ.નં:", "બ.નં.", "બ.નં") versus standard text.
 */
export function parseApplicantLineSegments(
  text: string,
): Array<{ text: string; isBold: boolean }> {
  if (!text) return [];
  const regex = /(?<=\s|^)(?:નામ\s*[-:]*|બ\.?\s*નં\.?\s*[-:]*)/g;
  const parts = text.split(regex);
  const matches = text.match(regex) || [];

  const segments: Array<{ text: string; isBold: boolean }> = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) {
      segments.push({ text: parts[i], isBold: false });
    }
    if (i < matches.length) {
      segments.push({ text: matches[i], isBold: true });
    }
  }
  return segments;
}

/**
 * Formats applicant line HTML with "નામ" and "બ.નં" labels enclosed in bold tags.
 * e.g. "નામ- વુ.આ. પો.કો. શ્રુતિ અજયસિંહ બ.નં- ૦૭૮૨" ->
 * '<strong class="font-bold text-black">નામ-</strong> વુ.આ. પો.કો. શ્રુતિ અજયસિંહ <strong class="font-bold text-black">બ.નં-</strong> ૦૭૮૨'
 */
export function formatApplicantLineBoldHtml(text: string): string {
  if (!text) return "";
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const safe = esc(text);
  return safe.replace(
    /(?<=\s|^)(?:નામ\s*[-:]*|બ\.?\s*નં\.?\s*[-:]*)/g,
    (match) => `<strong class="font-bold text-black">${match}</strong>`,
  );
}


/**
 * Formats and sanitizes a signatory block for Gujarati official letterhead:
 * - Converts English names (e.g. "kirpalsinh solanki" -> "કિરપાલસિંહ સોલંકી")
 * - Converts any digits (especially buckle number e.g. "0783" -> "૦૭૮૩") to Gujarati numerals
 * - Converts known English police ranks to Gujarati acronyms
 */
export function formatGujaratiSignatory(
  signatoryText: string | null | undefined,
  useGujaratiDigits = true,
): string {
  if (!signatoryText) return "";
  const lines = signatoryText.split("\n");
  const formattedLines = lines.map((line) => {
    let l = line.trim();
    if (!l) return "";

    // If the line is entirely English, transliterate it
    if (!containsGujarati(l)) {
      l = transliterateToGujarati(l);
    } else {
      // If line has Gujarati but also English words/names before or after,
      // e.g. "kirpalsinh solanki વુ. આ. લો. ર."
      l = l.replace(/\b[A-Za-z]+\b/g, (match) => {
        const lower = match.toLowerCase();
        if (lower === "qrt") return "QRT";
        if (POLICE_RANK_TRANSLATIONS[lower]) return POLICE_RANK_TRANSLATIONS[lower];
        return transliterateToGujarati(match);
      });
    }

    // Convert digits to Gujarati numerals if enabled
    if (useGujaratiDigits) {
      l = toGujaratiNumerals(l);
    }
    return l;
  });

  return formattedLines.join("\n");
}

export function getGujaratiReportHeaders(input: {
  reportType: "ta" | "holiday" | "duty" | "leave";
  periodLabel: string;
  monthIndex?: number;
  year?: number;
  officer?: {
    name?: string | null;
    post?: string | null;
    employeeCode?: string | null;
    posting?: string | null;
    department?: string | null;
  } | null;
  useGujaratiDigits?: boolean;
  printSettings?: {
    recipientTitle?: string | null;
    stationName?: string | null;
    signatoryName?: string | null;
  } | null;
}) {
  const { reportType, periodLabel, officer, useGujaratiDigits = true, printSettings } = input;

  const numericPeriod = formatGujaratiPeriodLabel(periodLabel, { useGujaratiDigits, format: "numeric" });
  const namedPeriod = formatGujaratiPeriodLabel(periodLabel, { useGujaratiDigits, format: "name" });
  const displayPeriod = formatGujaratiPeriodLabel(periodLabel, { useGujaratiDigits, format: "display" });

  const station = printSettings?.stationName || officer?.posting || officer?.department || "પોલીસ સ્ટેશન";
  const recipient = printSettings?.recipientTitle || (reportType === "holiday" ? "પો.ઇ.સા.શ્રી" : "પોલીસ સબ ઇન્સપેક્ટરશ્રી");
  const designation = formatGujaratiPoliceRank(officer?.post) || "પો.કો.";
  const buckleNo = formatGujaratiBuckleNumber(officer?.employeeCode, useGujaratiDigits);

  const officerName = transliterateToGujarati(officer?.name) || "પોલીસ અધિકારી";
  const rawSig = printSettings?.signatoryName?.trim();
  const officerDetails = rawSig
    ? (useGujaratiDigits ? toGujaratiNumerals(rawSig) : rawSig)
    : `${officerName}${designation ? `, ${designation}` : ""}${buckleNo ? ` બ.નં. ${buckleNo}` : ""}`;

  // Formats official applicant line: "નામ- વુ.આ. પો.કો. શ્રુતિ અજયસિંહ બ.નં- ૦૭૮૨"
  const fromLines = formatGujaratiApplicantLine(officer, useGujaratiDigits);

  const fallbackFooterRight = `${officerName}\n${designation}${buckleNo ? ` (${buckleNo})` : ""}\n${station}`.trim();
  const resolvedFooterRight = rawSig
    ? (useGujaratiDigits ? toGujaratiNumerals(rawSig) : rawSig)
    : fallbackFooterRight;

  if (reportType === "ta") {
    // Format 1: TA Bill (Photo 1) - e.g. "માહે- ૦૫/૨૦૨૪ નું મુસાફરી ભથ્થાબીલ"
    return {
      title: `માહે- ${numericPeriod} નું મુસાફરી ભથ્થાબીલ`,
      subject: `માહે- ${numericPeriod} નું મુસાફરી ભથ્થાબીલ રજૂ કરવા બાબત.`,
      salutation: `સવિનય જણાવવાનું કે હું નીચે સહી કરનાર ${officerDetails} નાએ માહે ${displayPeriod} દરમિયાન બજાવેલ ફરજ તેમજ મુસાફરીની વિગત નીચે મુજબ પત્રકમાં દર્શાવેલ છે.`,
      displayPeriod,
      numericPeriod,
      toLines: `પ્રતિ,\n${recipient},\n${station}`,
      fromLines: fromLines || `નામ: ${officerName} ${designation} બ.નં- ${buckleNo}`.trim(),
      footerLeft: "",
      footerRight: resolvedFooterRight,
    };
  }

  if (reportType === "duty" || reportType === "leave") {
    // Duty register / leave register: an information letter to the same
    // officer the TA bill goes to, not a claim.
    const isDuty = reportType === "duty";
    return {
      title: isDuty ? `માહે- ${numericPeriod} નું ફરજ પત્રક` : `માહે- ${numericPeriod} નું રજા પત્રક`,
      subject: isDuty
        ? `માહે- ${numericPeriod} દરમિયાન બજાવેલ ફરજની વિગત રજૂ કરવા બાબત.`
        : `માહે- ${numericPeriod} દરમિયાન ભોગવેલ રજાની વિગત રજૂ કરવા બાબત.`,
      salutation: isDuty
        ? `સવિનય જણાવવાનું કે હું નીચે સહી કરનાર ${officerDetails} નાએ માહે ${displayPeriod} દરમિયાન બજાવેલ ફરજની વિગત નીચે મુજબ પત્રકમાં દર્શાવેલ છે, જે આપશ્રીની જાણ સારૂ રજૂ છે.`
        : `સવિનય જણાવવાનું કે હું નીચે સહી કરનાર ${officerDetails} નાએ માહે ${displayPeriod} દરમિયાન ભોગવેલ રજાની વિગત નીચે મુજબ પત્રકમાં દર્શાવેલ છે, જે આપશ્રીની જાણ સારૂ રજૂ છે.`,
      displayPeriod,
      numericPeriod,
      toLines: `પ્રતિ,\n${recipient},\n${station}`,
      fromLines: fromLines || `નામ: ${officerName} ${designation} બ.નં- ${buckleNo}`.trim(),
      footerLeft: "",
      footerRight: resolvedFooterRight,
    };
  }

  // Format 2: Holiday Worked Claim (Photo 2) - e.g. "માહે - ફેબ્રુઆરી/૨૦૨૪ જાહેર રજાનો ક્લેઇમ"
  return {
    title: `માહે - ${namedPeriod} જાહેર રજાનો ક્લેઇમ`,
    subject: `માહે- ${namedPeriod} જાહેર રજાના ક્લેઇમનું બીલ મંજુર કરવા બાબત.`,
    salutation: `સવિનય જણાવવાનું કે હું નીચે સહી કરનાર ${officerDetails} નાએ માહે ${displayPeriod} દરમિયાન જાહેર રજાના દિવસોમાં બજાવેલ ફરજની વિગત નીચે મુજબ પત્રકમાં દર્શાવેલ છે.`,
    displayPeriod,
    numericPeriod,
    toLines: `પ્રતિ,\n${recipient}\n${station}\nગુજરાત પોલીસ`,
    fromLines: fromLines || `નામ- ${designation} ${officerName}${buckleNo ? ` બ.નં - ${buckleNo}` : ""}`.trim(),
    footerLeft: "",
    footerRight: rawSig ? (useGujaratiDigits ? toGujaratiNumerals(rawSig) : rawSig) : `લિ. સહી\n${officerName}\n${designation} (${buckleNo})`,
  };
}
