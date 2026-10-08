// Gujarat Government Holidays & Indian Gazetted Holidays rule engine

export interface GujaratGovtHoliday {
  name: string;
  nameGujarati?: string;
  date: string; // YYYY-MM-DD
  isGovernment: boolean;
  isOptional?: boolean;
}

function toLocalDate(dateInput: Date | string): Date {
  if (typeof dateInput === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateInput);
    if (m) {
      return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }
  }
  return dateInput instanceof Date ? dateInput : new Date(dateInput);
}

/**
 * Checks if a given date is Sunday (Official Weekly Holiday)
 */
export function isSunday(dateInput: Date | string): boolean {
  const d = toLocalDate(dateInput);
  return d.getDay() === 0;
}

/**
 * Checks if a given date is 2nd Saturday or 4th Saturday
 * (Government / Bank Public Holiday in Gujarat / India)
 */
export function isSecondOrFourthSaturday(dateInput: Date | string): boolean {
  const d = toLocalDate(dateInput);
  if (d.getDay() !== 6) return false;
  const dayOfMonth = d.getDate();
  const weekNumber = Math.ceil(dayOfMonth / 7);
  return weekNumber === 2 || weekNumber === 4;
}

/**
 * Checks if a given date is any weekend holiday (Sunday or 2nd/4th Sat)
 * or an Official Gujarat Government Gazetted Holiday
 */
export function isWeekendHoliday(dateInput: Date | string): {
  isHoliday: boolean;
  title?: string;
  type?: "sunday" | "second_saturday" | "fourth_saturday" | "government_holiday";
  holidayName?: string;
} {
  const d = toLocalDate(dateInput);
  if (isNaN(d.getTime())) return { isHoliday: false };

  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const dateStr = `${year}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (isSunday(d)) {
    return {
      isHoliday: true,
      title: "Sunday (સાપ્તાહિક જાહેર રજા)",
      type: "sunday",
    };
  }
  if (d.getDay() === 6) {
    const dayOfMonth = d.getDate();
    const weekNumber = Math.ceil(dayOfMonth / 7);
    if (weekNumber === 2) {
      return {
        isHoliday: true,
        title: "2nd Saturday Off (બીજો શનિવાર રજા)",
        type: "second_saturday",
      };
    }
    if (weekNumber === 4) {
      return {
        isHoliday: true,
        title: "4th Saturday Off (ચોથો શનિવાર રજા)",
        type: "fourth_saturday",
      };
    }
  }

  // Check Gujarat Government Catalog. No fallback to another year: the
  // gazetted dates move every year (they follow lunar calendars), so
  // borrowing 2026's list for 2028 invented holidays that do not exist.
  // An unknown year simply has no gazetted holidays until the catalog is
  // extended — see getGazettedHolidays().
  const catalog = GUJARAT_GOVT_HOLIDAYS_CATALOG[year] ?? [];
  const matched = catalog.find((h) => h.date === dateStr);
  if (matched) {
    return {
      isHoliday: true,
      title: `Govt Holiday: ${matched.name}`,
      holidayName: matched.name,
      type: "government_holiday",
    };
  }

  return { isHoliday: false };
}

/**
 * Official Published Gujarat Government Gazetted Holidays Catalog (ગુજરાત સરકાર જાહેર રજાઓની યાદી)
 */
export const GUJARAT_GOVT_HOLIDAYS_CATALOG: Record<number, GujaratGovtHoliday[]> = {
  2026: [
    { name: "Makar Sankranti / Uttarayan (ઉત્તરાયણ)", date: "2026-01-14", isGovernment: true },
    { name: "Vasi Uttarayan (વાસી ઉત્તરાયણ)", date: "2026-01-15", isGovernment: true },
    { name: "Republic Day (પ્રજાસત્તાક દિન)", date: "2026-01-26", isGovernment: true },
    { name: "Maha Shivratri (મહા શિવરાત્રિ)", date: "2026-02-15", isGovernment: true },
    { name: "Holi 2nd Day - Dhuleti (ધૂળેટી)", date: "2026-03-04", isGovernment: true },
    { name: "Cheti Chand (ચેટીચાંદ)", date: "2026-03-20", isGovernment: true },
    { name: "Ramzan-Id / Eid-ul-Fitr (રમઝાન ઈદ)", date: "2026-03-21", isGovernment: true },
    { name: "Shree Ram Navami (રામ નવમી)", date: "2026-03-28", isGovernment: true },
    { name: "Mahavir Janma Kalyanak (મહાવીર જયંતિ)", date: "2026-03-31", isGovernment: true },
    { name: "Good Friday (ગુડ ફ્રાઈડે)", date: "2026-04-03", isGovernment: true },
    { name: "Dr. B. R. Ambedkar Jayanti (ડૉ. બાબાસાહેબ આંબેડકર જયંતિ)", date: "2026-04-14", isGovernment: true },
    { name: "Gujarat Gaurav Divas (ગુજરાત ગૌરવ દિવસ)", date: "2026-05-01", isGovernment: true },
    { name: "Bakri-Id / Eid-ul-Adha (બકરી ઈદ)", date: "2026-05-28", isGovernment: true },
    { name: "Muharram (મોહરમ)", date: "2026-06-26", isGovernment: true },
    { name: "Independence Day (સ્વાતંત્ર્ય દિન)", date: "2026-08-15", isGovernment: true },
    { name: "Raksha Bandhan (રક્ષાબંધન)", date: "2026-08-28", isGovernment: true },
    { name: "Janmashtami (જન્માષ્ટમી)", date: "2026-09-04", isGovernment: true },
    { name: "Samvatsari / Ganesh Chaturthi (સંવત્સરી / ગણેશ ચતુર્થી)", date: "2026-09-14", isGovernment: true },
    { name: "Eid-e-Milad (ઈદ-એ-મિલાદ)", date: "2026-09-25", isGovernment: true },
    { name: "Mahatma Gandhi Jayanti (ગાંધી જયંતિ)", date: "2026-10-02", isGovernment: true },
    { name: "Dussehra / Vijaya Dashami (વિજયાદશમી - દશેરા)", date: "2026-10-20", isGovernment: true },
    { name: "Sardar Vallabhbhai Patel Jayanti (સરદાર પટેલ જયંતિ)", date: "2026-10-31", isGovernment: true },
    { name: "Diwali (દિવાળી)", date: "2026-11-08", isGovernment: true },
    { name: "New Year Day / Bestu Varas (નૂતન વર્ષાભિનંદન / બેસતું વર્ષ)", date: "2026-11-10", isGovernment: true },
    { name: "Bhai Bij (ભાઈબીજ)", date: "2026-11-11", isGovernment: true },
    { name: "Guru Nanak Jayanti (ગુરુ નાનક જયંતિ)", date: "2026-11-24", isGovernment: true },
    { name: "Christmas (નાતાલ)", date: "2026-12-25", isGovernment: true },
  ],
  2027: [
    { name: "Makar Sankranti / Uttarayan (ઉત્તરાયણ)", date: "2027-01-14", isGovernment: true },
    { name: "Republic Day (પ્રજાસત્તાક દિન)", date: "2027-01-26", isGovernment: true },
    { name: "Maha Shivratri (મહા શિવરાત્રિ)", date: "2027-03-06", isGovernment: true },
    { name: "Holi 2nd Day - Dhuleti (ધૂળેટી)", date: "2027-03-23", isGovernment: true },
    { name: "Dr. B. R. Ambedkar Jayanti (ડૉ. બાબાસાહેબ આંબેડકર જયંતિ)", date: "2027-04-14", isGovernment: true },
    { name: "Gujarat Gaurav Divas (ગુજરાત ગૌરવ દિવસ)", date: "2027-05-01", isGovernment: true },
    { name: "Independence Day (સ્વાતંત્ર્ય દિન)", date: "2027-08-15", isGovernment: true },
    { name: "Janmashtami (જન્માષ્ટમી)", date: "2027-08-25", isGovernment: true },
    { name: "Mahatma Gandhi Jayanti (ગાંધી જયંતિ)", date: "2027-10-02", isGovernment: true },
    { name: "Dussehra (દશેરા)", date: "2027-10-10", isGovernment: true },
    { name: "Diwali (દિવાળી)", date: "2027-10-29", isGovernment: true },
    { name: "New Year Day / Bestu Varas (બેસતું વર્ષ)", date: "2027-10-31", isGovernment: true },
    { name: "Christmas (નાતાલ)", date: "2027-12-25", isGovernment: true },
  ],
};

/**
 * Returns all automated weekend holidays (Sundays + 2nd/4th Saturdays) for a given year & month (0-indexed month)
 */
export function getMonthWeekendHolidays(year: number, month: number) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const holidays: { id: string; name: string; date: string; type: "sunday" | "second_saturday" | "fourth_saturday" }[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;

    if (d.getDay() === 0) {
      holidays.push({
        id: `auto-sunday-${dateStr}`,
        name: "Sunday (સાપ્તાહિક રજા)",
        date: dateStr,
        type: "sunday",
      });
    } else if (d.getDay() === 6) {
      const weekNumber = Math.ceil(day / 7);
      if (weekNumber === 2) {
        holidays.push({
          id: `auto-sat2-${dateStr}`,
          name: "2nd Saturday Off (બીજો શનિવાર)",
          date: dateStr,
          type: "second_saturday",
        });
      } else if (weekNumber === 4) {
        holidays.push({
          id: `auto-sat4-${dateStr}`,
          name: "4th Saturday Off (ચોથો શનિવાર)",
          date: dateStr,
          type: "fourth_saturday",
        });
      }
    }
  }

  return holidays;
}

/**
 * Official Published Gujarat Government Optional Holidays Catalog (ગુજરાત સરકાર મરજિયાત રજાઓની યાદી)
 * Government employees may choose up to 2 days per calendar year.
 */
export const GUJARAT_GOVT_OPTIONAL_HOLIDAYS_CATALOG: Record<number, GujaratGovtHoliday[]> = {
  2026: [
    { name: "Christian New Year Day (ખ્રિસ્તી નૂતન વર્ષ)", date: "2026-01-01", isGovernment: true, isOptional: true },
    { name: "Vasi Uttarayan (વાસી ઉત્તરાયણ - મકરસંક્રાંતિ પછીનો દિવસ)", date: "2026-01-15", isGovernment: true, isOptional: true },
    { name: "Vishvakarma Jayanti (વિશ્વકર્મા જયંતી - મહા સુદ-૧૩)", date: "2026-01-31", isGovernment: true, isOptional: true },
    { name: "Shab-e-Barat / Dhani Matang Dev Jayanti (શબ-એ-બરાત / ધણી માતંગ દેવશ્રી જન્મ જયંતી)", date: "2026-02-04", isGovernment: true, isOptional: true },
    { name: "Holi (હોળી)", date: "2026-03-03", isGovernment: true, isOptional: true },
    { name: "Shahadat-e-Hazrat Ali (શહાદત-એ-હઝરત અલી)", date: "2026-03-11", isGovernment: true, isOptional: true },
    { name: "Gudi Padwa (ગુડી પડવો - ચૈત્ર સુદ-૧)", date: "2026-03-19", isGovernment: true, isOptional: true },
    { name: "Jamshedi Navroz (જમશેદી નવરોઝ - પારસી શહેનશાહી અને કદમી)", date: "2026-03-21", isGovernment: true, isOptional: true },
    { name: "Hatkeshwar Jayanti (હાટકેશ્વર જયંતી)", date: "2026-04-01", isGovernment: true, isOptional: true },
    { name: "Hanuman Jayanti / Pesach (હનુમાન જયંતી / પેસાહ)", date: "2026-04-02", isGovernment: true, isOptional: true },
    { name: "Mahaprabhuji Prakatyotsav - Vallabhacharya Jayanti (મહાપ્રભુજીનો પ્રાકટ્યોત્સવ - વલ્લભાચાર્ય જયંતી)", date: "2026-04-13", isGovernment: true, isOptional: true },
    { name: "Jagadguru Shankaracharya Jayanti (શ્રી આદ્ય જગદગુરુ શંકરાચાર્ય જયંતી - વૈશાખ સુદ-૫)", date: "2026-04-21", isGovernment: true, isOptional: true },
    { name: "Zarthost-no-Diso - Kadmi (જરથોસ્તનો દિશો - પારસી કદમી)", date: "2026-04-22", isGovernment: true, isOptional: true },
    { name: "Buddha Purnima (બુધ્ધ પૂર્ણિમા - વૈશાખ સુદ-૧૫)", date: "2026-05-01", isGovernment: true, isOptional: true },
    { name: "Shavuot / Zarthost-no-Diso - Shahenshahi (શાવુઓથ / જરથોસ્તનો દિશો - પારસી શહેનશાહી)", date: "2026-05-22", isGovernment: true, isOptional: true },
    { name: "Guru Arjan Dev Martyrdom Day (ગુરુ અર્જુનદેવનો શહીદ દિન)", date: "2026-06-18", isGovernment: true, isOptional: true },
    { name: "9th Muharram (નવમો મોહરમ)", date: "2026-06-25", isGovernment: true, isOptional: true },
    { name: "Gatha Gahambars - Kadmi (ગાથા ગહમ્બર - ત્રીજી ગાથા - પારસી કદમી)", date: "2026-07-13", isGovernment: true, isOptional: true },
    { name: "Parsi New Year Eve - Kadmi (પારસી નૂતનવર્ષના આરંભ પૂર્વેનો દિવસ - પાંચમી ગાથા - પારસી કદમી)", date: "2026-07-15", isGovernment: true, isOptional: true },
    { name: "Rath Yatra / Parsi New Year - Kadmi (રથયાત્રા - અષાઢી બીજ / પારસી નૂતન વર્ષ - પારસી કદમી)", date: "2026-07-16", isGovernment: true, isOptional: true },
    { name: "Khordad Sal - Kadmi (ખોરદાદ સાલ - પારસી કદમી)", date: "2026-07-21", isGovernment: true, isOptional: true },
    { name: "Tisha B'Av (તિશા-બ-અવ - યહુદી)", date: "2026-07-23", isGovernment: true, isOptional: true },
    { name: "Gatha Gahambars / Shahadat-e-Imam Hasan (ગાથા ગહમ્બર - ત્રીજી ગાથા / શહાદત-એ-ઇમામ હસન)", date: "2026-08-12", isGovernment: true, isOptional: true },
    { name: "Parsi New Year Eve - Shahenshahi (પારસી નૂતન વર્ષના આરંભ પૂર્વેનો દિવસ - પાંચમી ગાથા - પારસી શહેનશાહી)", date: "2026-08-14", isGovernment: true, isOptional: true },
    { name: "Khordad Sal - Shahenshahi (ખોરદાદ સાલ - પારસી શહેનશાહી)", date: "2026-08-20", isGovernment: true, isOptional: true },
    { name: "Onam (ઓણમ)", date: "2026-08-26", isGovernment: true, isOptional: true },
    { name: "Eid-e-Maulud (ઇદ-એ-મૌલૂદ)", date: "2026-08-31", isGovernment: true, isOptional: true },
    { name: "Nand Utsav (નંદ ઉત્સવ - જન્માષ્ટમી પછીનો દિવસ - શ્રાવણ વદ-૯)", date: "2026-09-05", isGovernment: true, isOptional: true },
    { name: "Paryushan Parva Start - Chaturthi Paksha (શ્રાવણ વદ-૧૨ - પર્યુષણ મહાપર્વનો પ્રારંભદિન - ચતુર્થી પક્ષ)", date: "2026-09-08", isGovernment: true, isOptional: true },
    { name: "Paryushan Parva Start - Panchami Paksha (શ્રાવણ વદ-૧૩ - પર્યુષણ મહાપર્વનો પ્રારંભદિન - પંચમી પક્ષ)", date: "2026-09-09", isGovernment: true, isOptional: true },
    { name: "Ganesh Chaturthi (ગણેશ ચતુર્થી - ભાદરવા સુદ-૪)", date: "2026-09-14", isGovernment: true, isOptional: true },
    { name: "Samvatsari - Panchami Paksha (સંવત્સરી - પંચમી પક્ષ)", date: "2026-09-16", isGovernment: true, isOptional: true },
    { name: "Yom Kippur (યોમ કિપ્પુર - યહુદી)", date: "2026-09-21", isGovernment: true, isOptional: true },
    { name: "Dhan Teras (ધન તેરસ)", date: "2026-11-07", isGovernment: true, isOptional: true },
    { name: "Dev Diwali (દેવ દિવાળી)", date: "2026-11-24", isGovernment: true, isOptional: true },
  ],
  2027: [
    { name: "Christian New Year Day (ખ્રિસ્તી નૂતન વર્ષ દિન)", date: "2027-01-01", isGovernment: true, isOptional: true },
    { name: "Guru Gobind Singh Jayanti (ગુરુ ગોવિંદસિંહ જન્મજયંતિ)", date: "2027-01-15", isGovernment: true, isOptional: true },
    { name: "Shab-e-Barat (શબ-એ-બરાત)", date: "2027-01-24", isGovernment: true, isOptional: true },
    { name: "Vishvakarma Jayanti (વિશ્વકર્મા જયંતિ)", date: "2027-02-15", isGovernment: true, isOptional: true },
    { name: "Jamshedi Navroz (જમશેદી નવરોઝ)", date: "2027-03-21", isGovernment: true, isOptional: true },
    { name: "Hanuman Jayanti (હનુમાન જયંતિ)", date: "2027-04-21", isGovernment: true, isOptional: true },
    { name: "Buddha Purnima (બુદ્ધ પૂર્ણિમા)", date: "2027-05-20", isGovernment: true, isOptional: true },
    { name: "Guru Purnima (ગુરુ પૂર્ણિમા)", date: "2027-07-18", isGovernment: true, isOptional: true },
    { name: "Parsi New Year (પારસી નૂતન વર્ષ)", date: "2027-08-16", isGovernment: true, isOptional: true },
    { name: "Onam (ઓણમ)", date: "2027-09-13", isGovernment: true, isOptional: true },
    { name: "Anant Chaturdashi (અનંત ચતુર્દશી)", date: "2027-09-15", isGovernment: true, isOptional: true },
    { name: "Dhan Teras (ધન તેરસ)", date: "2027-10-27", isGovernment: true, isOptional: true },
    { name: "Kali Chaudas (કાળી ચૌદશ)", date: "2027-10-28", isGovernment: true, isOptional: true },
    { name: "Kartiki Purnima / Dev Diwali (દેવ દિવાળી)", date: "2027-11-13", isGovernment: true, isOptional: true },
    { name: "Boxing Day (બોક્સિંગ ડે)", date: "2027-12-26", isGovernment: true, isOptional: true },
  ],
};

/**
 * The gazetted list for a year, or an empty list if the catalog does not
 * cover it. Callers that care (the holiday importer, the calendar) can warn
 * rather than silently showing nothing.
 */
export function getGazettedHolidays(year: number): GujaratGovtHoliday[] {
  return GUJARAT_GOVT_HOLIDAYS_CATALOG[year] ?? [];
}

/** The optional list for a year, or an empty list if the catalog does not cover it. */
export function getOptionalHolidays(year: number): GujaratGovtHoliday[] {
  return GUJARAT_GOVT_OPTIONAL_HOLIDAYS_CATALOG[year] ?? [];
}

/** Whether the hardcoded gazetted catalog covers a year at all. */
export function hasGazettedCatalog(year: number): boolean {
  return GUJARAT_GOVT_HOLIDAYS_CATALOG[year] !== undefined;
}

/** Whether the hardcoded optional catalog covers a year at all. */
export function hasOptionalHolidayCatalog(year: number): boolean {
  return GUJARAT_GOVT_OPTIONAL_HOLIDAYS_CATALOG[year] !== undefined;
}

/** The years the gazetted catalog covers, ascending. */
export function gazettedCatalogYears(): number[] {
  return Object.keys(GUJARAT_GOVT_HOLIDAYS_CATALOG)
    .map(Number)
    .sort((a, b) => a - b);
}

/** The years the optional catalog covers, ascending. */
export function optionalCatalogYears(): number[] {
  return Object.keys(GUJARAT_GOVT_OPTIONAL_HOLIDAYS_CATALOG)
    .map(Number)
    .sort((a, b) => a - b);
}
