import { toDateKey } from "@/lib/format/datetime";
import {
  translateDutyTypeToGujarati,
  toGujaratiNumerals,
} from "@/lib/reports/gujaratiReportUtils";

export interface RawDutyRecord {
  id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  location?: string | null;
  notes?: string | null;
  duty_group_id?: string | null;
  ta_from_place?: string | null;
  ta_to_place?: string | null;
  ta_vehicle_type?: string | null;
  ta_distance_km?: number | null;
  ta_amount?: number | null;
  is_holiday?: boolean | null;
  is_holiday_duty?: boolean | null;
  manual_holiday_claim?: boolean | null;
  holiday_allowance?: number | null;
  duty_types?: unknown;
  users?: unknown;
}

export interface GroupedShiftItem<T extends RawDutyRecord = RawDutyRecord> {
  id: string;
  duty: T;
  rawTypeName: string;
  typeName: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  durationLabel: string;
  location?: string | null;
  notes?: string | null;
  taFrom?: string | null;
  taTo?: string | null;
  taDistanceKm?: number | null;
  taAmount?: number | null;
  isHolidayDuty?: boolean | null;
}

export interface GroupedDuty<T extends RawDutyRecord = RawDutyRecord> {
  groupKey: string;
  primaryId: string;
  allIds: string[];
  userId: string;
  officerName: string;
  dateKey: string;
  shiftCount: number;
  isMultiShift: boolean;
  shifts: GroupedShiftItem<T>[];

  // Aggregated metadata
  dutyTypeNames: string[];
  combinedDutyTypeLabel: string;
  earliestStart: string;
  latestEnd: string;
  totalDurationMinutes: number;
  totalDurationLabel: string;

  // Locations
  locations: string[];
  locationDisplay: string;

  // TA & Financials
  totalTaDistanceKm: number;
  totalTaAmount: number;
  hasTa: boolean;
  taRouteDisplay: string;
  taVehicleTypes: string[];

  // Holiday
  isHolidayDuty: boolean;
  isHoliday: boolean;
  manualHolidayClaim: boolean;
  totalHolidayAllowance: number;

  // Overall status
  status: string;

  // Primary reference duty (first shift)
  primaryDuty: T;
}

/**
 * Calculates duration in minutes between two ISO datetime strings.
 */
export function calculateMinutes(startsAt: string, endsAt: string): number {
  const s = new Date(startsAt).getTime();
  const e = new Date(endsAt).getTime();
  if (isNaN(s) || isNaN(e) || e <= s) return 0;
  return Math.floor((e - s) / (1000 * 60));
}

/**
 * Formats duration minutes into human-readable English or Gujarati.
 */
export function formatMinutes(minutes: number, isGujarati: boolean): string {
  if (minutes <= 0) return isGujarati ? "૦ કલાક" : "0h";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (isGujarati) {
    const hStr = hours > 0 ? `${toGujaratiNumerals(hours)} કલાક` : "";
    const mStr = mins > 0 ? `${toGujaratiNumerals(mins)} મિ.` : "";
    return [hStr, mStr].filter(Boolean).join(" ") || "૦ કલાક";
  }

  const hStr = hours > 0 ? `${hours}h` : "";
  const mStr = mins > 0 ? `${mins}m` : "";
  return [hStr, mStr].filter(Boolean).join(" ") || "0h";
}

/**
 * Groups a flat array of duty records by officer and date (or shared duty_group_id on the same date).
 * Ensures multiple shifts on the same day appear as a single unified entry.
 */
export function groupDutiesByDayOrGroup<T extends RawDutyRecord>(
  duties: readonly T[],
  isGujarati: boolean = false,
  enableMultiDuty: boolean = true
): GroupedDuty<T>[] {
  if (!duties || duties.length === 0) return [];

  // Group by composite key: userId + (duty_group_id ? duty_group_id : dateKey)
  // If enableMultiDuty is false, keep each duty completely isolated (single duty mode)
  const map = new Map<string, T[]>();

  for (const d of duties) {
    const dateKey = toDateKey(d.starts_at);
    // Key by user_id and dateKey so any multiple shifts for the same officer on the same operational day merge cleanly.
    // When enableMultiDuty is disabled, each duty has its own isolated key so it is never merged.
    const key = enableMultiDuty ? `${d.user_id}_${dateKey}` : `duty_${d.id}`;
    const list = map.get(key) ?? [];
    list.push(d);
    map.set(key, list);
  }

  const result: GroupedDuty<T>[] = [];

  for (const [groupKey, rawShifts] of map.entries()) {
    // Sort shifts chronologically by starts_at
    const sorted = [...rawShifts].sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    );

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const officerName =
      (first.users as unknown as { full_name: string } | null)?.full_name ?? "—";
    const dateKey = toDateKey(first.starts_at);

    let totalDurationMinutes = 0;
    let totalTaDistanceKm = 0;
    let totalTaAmount = 0;
    let totalHolidayAllowance = 0;
    let isHolidayDuty = false;
    let isHoliday = false;
    let manualHolidayClaim = false;

    const dutyTypeNamesSet = new Set<string>();
    const locationsSet = new Set<string>();
    const routesList: string[] = [];
    const vehicleTypesSet = new Set<string>();

    const shiftItems: GroupedShiftItem<T>[] = sorted.map((s) => {
      const rawTypeName =
        (s.duty_types as unknown as { name: string } | null)?.name ?? "Duty";
      const typeName =
        isGujarati && rawTypeName !== "Duty"
          ? translateDutyTypeToGujarati(rawTypeName)
          : rawTypeName;

      dutyTypeNamesSet.add(typeName);

      const durationMins = calculateMinutes(s.starts_at, s.ends_at);
      totalDurationMinutes += durationMins;

      if (s.location && s.location.trim()) {
        locationsSet.add(s.location.trim());
      }

      if (s.ta_distance_km) {
        totalTaDistanceKm += Number(s.ta_distance_km);
      }
      if (s.ta_amount) {
        totalTaAmount += Number(s.ta_amount);
      }
      if (s.ta_vehicle_type) {
        vehicleTypesSet.add(s.ta_vehicle_type);
      }

      if (s.ta_from_place || s.ta_to_place) {
        const from = s.ta_from_place || "?";
        const to = s.ta_to_place || "?";
        routesList.push(`${from} → ${to}`);
      }

      if (s.is_holiday_duty) isHolidayDuty = true;
      if (s.is_holiday) isHoliday = true;
      if (s.manual_holiday_claim) manualHolidayClaim = true;
      if (s.holiday_allowance) {
        totalHolidayAllowance += Number(s.holiday_allowance);
      }

      return {
        id: s.id,
        duty: s,
        rawTypeName,
        typeName,
        startsAt: s.starts_at,
        endsAt: s.ends_at,
        durationMinutes: durationMins,
        durationLabel: formatMinutes(durationMins, isGujarati),
        location: s.location,
        notes: s.notes,
        taFrom: s.ta_from_place,
        taTo: s.ta_to_place,
        taDistanceKm: s.ta_distance_km,
        taAmount: s.ta_amount,
        isHolidayDuty: s.is_holiday_duty,
      };
    });

    const shiftCount = sorted.length;
    const isMultiShift = shiftCount > 1;

    const dutyTypeNames = Array.from(dutyTypeNamesSet);
    const combinedDutyTypeLabel = dutyTypeNames.join(" + ");

    const locations = Array.from(locationsSet);
    const locationDisplay = locations.join(", ") || "—";

    const taRouteDisplay = routesList.join(", ") || "—";
    const hasTa = totalTaAmount > 0 || totalTaDistanceKm > 0 || routesList.length > 0;

    const totalDurationLabel = formatMinutes(totalDurationMinutes, isGujarati);

    result.push({
      groupKey,
      primaryId: first.id,
      allIds: sorted.map((s) => s.id),
      userId: first.user_id,
      officerName,
      dateKey,
      shiftCount,
      isMultiShift,
      shifts: shiftItems,

      dutyTypeNames,
      combinedDutyTypeLabel,
      earliestStart: first.starts_at,
      latestEnd: last.ends_at,
      totalDurationMinutes,
      totalDurationLabel,

      locations,
      locationDisplay,

      totalTaDistanceKm,
      totalTaAmount,
      hasTa,
      taRouteDisplay,
      taVehicleTypes: Array.from(vehicleTypesSet),

      isHolidayDuty,
      isHoliday,
      manualHolidayClaim,
      totalHolidayAllowance,

      status: first.status,
      primaryDuty: first,
    });
  }

  // Sort overall groups descending by earliestStart
  return result.sort(
    (a, b) => new Date(b.earliestStart).getTime() - new Date(a.earliestStart).getTime()
  );
}
