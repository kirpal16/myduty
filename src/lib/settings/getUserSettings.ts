import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type UserSettings = {
  /** Extra pay for one worked holiday. 0 means the officer has not set one. */
  holidayDayRate: number;
  /** Daily salary rate used for unpaid leave (Binpagari Leave / LWP) salary deduction calculations. */
  dailySalaryRate: number;
  /** "HH:MM", ready for an <input type="time"> or a datetime-local suffix. */
  defaultShiftStart: string;
  defaultShiftEnd: string;
  printRecipientTitle: string;
  printStationName: string;
  printSignatoryName: string;
  printDefaultVehicle: "private" | "government";
  printUseGujaratiDigits: boolean;
  printHeaderLine1?: string;
  printHeaderLine2?: string;
  printHeaderLine1En?: string;
  printHeaderLine2En?: string;
  printFooterPlace?: string;
  printFooterNote?: string;
};

/**
 * The standard shift most duties follow, used when the officer has saved
 * nothing yet. Kept identical to the column defaults in 0021_user_settings.sql and 0041.
 */
export const DEFAULT_USER_SETTINGS: UserSettings = {
  holidayDayRate: 0,
  dailySalaryRate: 0,
  defaultShiftStart: "10:00",
  defaultShiftEnd: "18:00",
  printRecipientTitle: "પોલીસ સબ ઇન્સપેક્ટરશ્રી",
  printStationName: "",
  printSignatoryName: "",
  printDefaultVehicle: "private",
  printUseGujaratiDigits: true,
  printHeaderLine1: "ગુજરાત પોલીસ (GUJARAT POLICE)",
  printHeaderLine2: "QRT અરવલ્લી પોલીસ",
  printHeaderLine1En: "Gujarat Police",
  printHeaderLine2En: "Duty & Roster Records",
  printFooterPlace: "અરવલ્લી",
  printFooterNote: "",
};

/** Postgres `time` comes back as "10:00:00"; the form wants "10:00". */
function toHHMM(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  return value.slice(0, 5);
}

/**
 * No row exists until the officer saves settings for the first time, so a
 * missing row is the normal case and falls back to the defaults rather than
 * being an error. Cached per request, like getCurrentUser.
 */
export const getUserSettings = cache(async (): Promise<UserSettings> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return DEFAULT_USER_SETTINGS;

  const { data } = await supabase
    .from("user_settings")
    .select("holiday_day_rate, daily_salary_rate, default_shift_start, default_shift_end, print_recipient_title, print_station_name, print_signatory_name, print_default_vehicle, print_use_gujarati_digits")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return DEFAULT_USER_SETTINGS;

  return {
    holidayDayRate: Number(data.holiday_day_rate ?? 0),
    dailySalaryRate: Number(data.daily_salary_rate ?? 0),
    defaultShiftStart: toHHMM(data.default_shift_start, DEFAULT_USER_SETTINGS.defaultShiftStart),
    defaultShiftEnd: toHHMM(data.default_shift_end, DEFAULT_USER_SETTINGS.defaultShiftEnd),
    printRecipientTitle: data.print_recipient_title ?? DEFAULT_USER_SETTINGS.printRecipientTitle,
    printStationName: data.print_station_name ?? DEFAULT_USER_SETTINGS.printStationName,
    printSignatoryName: data.print_signatory_name ?? DEFAULT_USER_SETTINGS.printSignatoryName,
    printDefaultVehicle: (data.print_default_vehicle as "private" | "government") || DEFAULT_USER_SETTINGS.printDefaultVehicle,
    printUseGujaratiDigits: data.print_use_gujarati_digits ?? DEFAULT_USER_SETTINGS.printUseGujaratiDigits,
  };
});
