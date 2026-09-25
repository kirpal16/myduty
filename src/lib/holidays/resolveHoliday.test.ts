import { describe, it, expect } from "vitest";
import {
  resolveHoliday,
  resolveHolidaysForRange,
  countHolidays,
  holidayKindLabel,
  type HolidayRecord,
} from "./resolveHoliday";

const d = (s: string) => {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(y, m - 1, day, 12, 0, 0, 0); // midday: no DST/TZ edge
};

describe("resolveHoliday — R2 classification table", () => {
  it("GLOBAL db row -> public_holiday", () => {
    const rows: HolidayRecord[] = [
      { name: "Founders Day", holiday_date: "2026-09-08", scope: "GLOBAL" },
    ];
    const r = resolveHoliday(d("2026-09-08"), rows);
    expect(r).toMatchObject({ isHoliday: true, kind: "public_holiday", source: "db" });
    expect(r.name).toBe("Founders Day");
  });

  it("government db row -> public_holiday even at USER scope", () => {
    const rows: HolidayRecord[] = [
      { name: "Diwali", holiday_date: "2026-09-08", scope: "USER", is_government: true },
    ];
    expect(resolveHoliday(d("2026-09-08"), rows).kind).toBe("public_holiday");
  });

  it("gazetted date -> public_holiday, now via a seeded DB row", () => {
    // Migration 0025 seeds the gazetted catalog as GLOBAL rows, so the
    // resolver no longer reads the TypeScript catalog at all.
    const rows: HolidayRecord[] = [
      {
        name: "Republic Day",
        holiday_date: "2026-01-26",
        scope: "GLOBAL",
        is_government: true,
      },
    ];
    const r = resolveHoliday(d("2026-01-26"), rows);
    expect(r).toMatchObject({ isHoliday: true, kind: "public_holiday", source: "db" });
  });

  it("a gazetted date with no DB row is NOT a holiday", () => {
    // The catalog is a seed for the database, not a live fallback: if 0025
    // has not run, the calendar says so rather than quietly inventing a day.
    expect(resolveHoliday(d("2026-01-26")).isHoliday).toBe(false);
  });

  it("a gazetted holiday falling on a Sunday resolves once, as a public holiday", () => {
    // 2026-11-08 (Diwali) is a Sunday. The DB row must win over the weekend
    // rule so the day is named, and it must not produce two results.
    expect(d("2026-11-08").getDay()).toBe(0);
    const rows: HolidayRecord[] = [
      { name: "Diwali", holiday_date: "2026-11-08", scope: "GLOBAL", is_government: true },
    ];
    const r = resolveHoliday(d("2026-11-08"), rows);
    expect(r).toMatchObject({ isHoliday: true, kind: "public_holiday", source: "db" });
    expect(r.name).toBe("Diwali");
  });

  it("Sunday -> weekend", () => {
    const r = resolveHoliday(d("2026-09-06")); // a Sunday
    expect(new Date(d("2026-09-06")).getDay()).toBe(0);
    expect(r).toMatchObject({ isHoliday: true, kind: "weekend", source: "sunday" });
  });

  it("2nd Saturday -> weekend", () => {
    const r = resolveHoliday(d("2026-09-12"));
    expect(d("2026-09-12").getDay()).toBe(6);
    expect(Math.ceil(12 / 7)).toBe(2);
    expect(r).toMatchObject({ isHoliday: true, kind: "weekend", source: "saturday" });
    expect(r.name).toBe("2nd Saturday");
  });

  it("4th Saturday -> weekend", () => {
    const r = resolveHoliday(d("2026-09-26"));
    expect(Math.ceil(26 / 7)).toBe(4);
    expect(r).toMatchObject({ isHoliday: true, kind: "weekend" });
    expect(r.name).toBe("4th Saturday");
  });

  it("PROFILE db row -> day_off", () => {
    const rows: HolidayRecord[] = [
      { name: "Unit rest day", holiday_date: "2026-09-08", scope: "PROFILE" },
    ];
    expect(resolveHoliday(d("2026-09-08"), rows).kind).toBe("day_off");
  });

  it("USER db row -> day_off", () => {
    const rows: HolidayRecord[] = [
      { name: "My birthday", holiday_date: "2026-09-08", scope: "USER" },
    ];
    expect(resolveHoliday(d("2026-09-08"), rows).kind).toBe("day_off");
  });

  it.each([
    ["1st Saturday", "2026-09-05"],
    ["3rd Saturday", "2026-09-19"],
    ["5th Saturday", "2026-08-29"],
  ])("%s is NOT a holiday", (_label, date) => {
    expect(d(date).getDay()).toBe(6);
    expect(resolveHoliday(d(date))).toMatchObject({
      isHoliday: false,
      qualifiesForHolidayAllowance: false,
    });
  });

  it("an ordinary weekday is not a holiday", () => {
    const r = resolveHoliday(d("2026-09-08")); // Tuesday
    expect(r.isHoliday).toBe(false);
    expect(r.kind).toBeUndefined();
  });

  it("an invalid date is not a holiday", () => {
    expect(resolveHoliday(new Date("nope")).isHoliday).toBe(false);
  });
});

describe("resolveHoliday — precedence", () => {
  it("a db row overrides the weekend rule", () => {
    // 2026-09-06 is a Sunday, but the office declared it a working day is not
    // expressible; what IS expressible is naming it something more specific.
    const rows: HolidayRecord[] = [
      { name: "Election duty day", holiday_date: "2026-09-06", scope: "PROFILE" },
    ];
    const r = resolveHoliday(d("2026-09-06"), rows);
    expect(r.source).toBe("db");
    expect(r.kind).toBe("day_off");
  });

  it("only the database and the weekend rule are consulted", () => {
    // Every source is now a row, so there is no second list to disagree with.
    const rows: HolidayRecord[] = [
      { name: "Local observance", holiday_date: "2026-01-26", scope: "USER" },
    ];
    expect(resolveHoliday(d("2026-01-26"), rows).source).toBe("db");
    expect(resolveHoliday(d("2028-11-08")).isHoliday).toBe(false);
  });
});

describe("qualifiesForHolidayAllowance", () => {
  it.each<[string, HolidayRecord[], string]>([
    ["public holiday", [{ name: "X", holiday_date: "2026-09-08", scope: "GLOBAL" }], "2026-09-08"],
    ["weekend", [], "2026-09-06"],
    ["day off", [{ name: "Y", holiday_date: "2026-09-08", scope: "USER" }], "2026-09-08"],
  ])("all three kinds qualify: %s", (_l, rows, date) => {
    const r = resolveHoliday(d(date), rows);
    expect(r.isHoliday).toBe(true);
    expect(r.qualifiesForHolidayAllowance).toBe(true);
  });

  it("a working day does not qualify", () => {
    expect(resolveHoliday(d("2026-09-08")).qualifiesForHolidayAllowance).toBe(false);
  });
});

describe("resolveHolidaysForRange", () => {
  it("resolves every day inclusively", () => {
    const range = resolveHolidaysForRange(d("2026-09-01"), d("2026-09-30"));
    expect(range.size).toBe(30);
    expect(range.has("2026-09-01")).toBe(true);
    expect(range.has("2026-09-30")).toBe(true);
  });

  it("counts the weekend rule alone when no rows are supplied", () => {
    const range = resolveHolidaysForRange(d("2026-09-01"), d("2026-09-30"));
    // Sundays 6, 13, 20, 27 + Saturdays 12 (2nd) and 26 (4th) = 6.
    // Gazetted days are DB rows now, so none are counted without them.
    expect(countHolidays(range)).toBe(6);
  });

  it("counts weekend days plus the seeded gazetted rows", () => {
    const gazetted: HolidayRecord[] = [
      { name: "Janmashtami", holiday_date: "2026-09-04", scope: "GLOBAL", is_government: true },
      { name: "Samvatsari", holiday_date: "2026-09-14", scope: "GLOBAL", is_government: true },
      { name: "Eid-e-Milad", holiday_date: "2026-09-25", scope: "GLOBAL", is_government: true },
    ];
    const range = resolveHolidaysForRange(d("2026-09-01"), d("2026-09-30"), gazetted);
    expect(countHolidays(range)).toBe(9);
  });

  it("a gazetted row on a weekend day does not add a second holiday", () => {
    // 2026-09-13 is a Sunday and already counts. Naming it must not make it two.
    const base = resolveHolidaysForRange(d("2026-09-01"), d("2026-09-30"));
    const withOverlap = resolveHolidaysForRange(d("2026-09-01"), d("2026-09-30"), [
      { name: "Overlapping festival", holiday_date: "2026-09-13", scope: "GLOBAL" },
    ]);
    expect(countHolidays(withOverlap)).toBe(countHolidays(base));
  });

  it("a single-day range yields one entry", () => {
    expect(resolveHolidaysForRange(d("2026-09-08"), d("2026-09-08")).size).toBe(1);
  });

  it("an inverted range yields nothing", () => {
    expect(resolveHolidaysForRange(d("2026-09-10"), d("2026-09-08")).size).toBe(0);
  });
});

describe("holidayKindLabel", () => {
  it("labels each kind", () => {
    expect(holidayKindLabel("public_holiday")).toBe("Public Holiday");
    expect(holidayKindLabel("optional_holiday")).toBe("Optional Holiday");
    expect(holidayKindLabel("weekend")).toBe("Weekend Off");
    expect(holidayKindLabel("day_off")).toBe("Day Off");
    expect(holidayKindLabel(undefined)).toBe("Working Day");
  });
});

describe("resolveHoliday — optional holidays", () => {
  it("resolves an optional holiday on a weekday with kind optional_holiday and no extra pay", () => {
    // 2026-09-08 is a Tuesday
    const rows: HolidayRecord[] = [
      {
        name: "Parsi New Year",
        holiday_date: "2026-09-08",
        scope: "GLOBAL",
        is_government: true,
        is_optional: true,
      },
    ];
    const r = resolveHoliday(d("2026-09-08"), rows);
    expect(r.isHoliday).toBe(true);
    expect(r.kind).toBe("optional_holiday");
    expect(r.qualifiesForHolidayAllowance).toBe(false);
  });

  it("optional holiday on a Sunday resolves as weekend and qualifies for allowance", () => {
    // 2026-09-06 is a Sunday
    const rows: HolidayRecord[] = [
      {
        name: "Sunday Observance",
        holiday_date: "2026-09-06",
        scope: "GLOBAL",
        is_government: true,
        is_optional: true,
      },
    ];
    const r = resolveHoliday(d("2026-09-06"), rows);
    expect(r.isHoliday).toBe(true);
    expect(r.kind).toBe("weekend");
    expect(r.qualifiesForHolidayAllowance).toBe(true);
  });

  it("countHolidays excludes optional holidays from the count", () => {
    const rows: HolidayRecord[] = [
      {
        name: "Optional Day",
        holiday_date: "2026-09-08", // Tuesday
        scope: "GLOBAL",
        is_government: true,
        is_optional: true,
      },
    ];
    const base = resolveHolidaysForRange(d("2026-09-01"), d("2026-09-30"));
    const withOptional = resolveHolidaysForRange(d("2026-09-01"), d("2026-09-30"), rows);
    expect(countHolidays(withOptional)).toBe(countHolidays(base));
  });
});
