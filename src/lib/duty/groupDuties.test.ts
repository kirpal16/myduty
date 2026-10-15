import { describe, it, expect } from "vitest";
import { groupDutiesByDayOrGroup, calculateMinutes, formatMinutes } from "./groupDuties";

describe("groupDuties", () => {
  it("calculates shift minutes correctly", () => {
    expect(calculateMinutes("2026-10-18T10:00:00", "2026-10-18T18:00:00")).toBe(480);
    expect(calculateMinutes("2026-10-18T20:00:00", "2026-10-18T23:00:00")).toBe(180);
  });

  it("formats minutes in English and Gujarati", () => {
    expect(formatMinutes(480, false)).toBe("8h");
    expect(formatMinutes(495, false)).toBe("8h 15m");
    expect(formatMinutes(480, true)).toBe("૮ કલાક");
    expect(formatMinutes(495, true)).toBe("૮ કલાક ૧૫ મિ.");
  });

  it("unifies two shifts on the same day for an officer into 1 entry", () => {
    const rawDuties = [
      {
        id: "duty-2",
        user_id: "user-1",
        starts_at: "2026-10-18T20:00:00",
        ends_at: "2026-10-18T23:00:00",
        status: "SCHEDULED",
        duty_types: { name: "Standby Duty" },
        users: { full_name: "kirpalsinh solanki" },
        ta_amount: 100,
        ta_distance_km: 10,
        ta_from_place: "Station",
        ta_to_place: "Post",
      },
      {
        id: "duty-1",
        user_id: "user-1",
        starts_at: "2026-10-18T10:00:00",
        ends_at: "2026-10-18T18:00:00",
        status: "SCHEDULED",
        duty_types: { name: "Patrolling" },
        users: { full_name: "kirpalsinh solanki" },
        ta_amount: 150,
        ta_distance_km: 25,
        ta_from_place: "HQ",
        ta_to_place: "Sector 4",
      },
    ];

    const grouped = groupDutiesByDayOrGroup(rawDuties, false, true);
    expect(grouped).toHaveLength(1);

    const entry = grouped[0];
    expect(entry.shiftCount).toBe(2);
    expect(entry.isMultiShift).toBe(true);
    expect(entry.allIds).toEqual(["duty-1", "duty-2"]);
    expect(entry.earliestStart).toBe("2026-10-18T10:00:00");
    expect(entry.latestEnd).toBe("2026-10-18T23:00:00");
    expect(entry.totalDurationMinutes).toBe(480 + 180);
    expect(entry.totalTaAmount).toBe(250);
    expect(entry.totalTaDistanceKm).toBe(35);
    expect(entry.combinedDutyTypeLabel).toBe("Patrolling + Standby Duty");

    // When enableMultiDuty is false, each shift remains completely independent
    const standalone = groupDutiesByDayOrGroup(rawDuties, false, false);
    expect(standalone).toHaveLength(2);
    expect(standalone[0].shiftCount).toBe(1);
    expect(standalone[0].isMultiShift).toBe(false);
    expect(standalone[1].shiftCount).toBe(1);
    expect(standalone[1].isMultiShift).toBe(false);
  });

  it("ensures shifts on same day like 08:00-12:00 and 14:00-18:00 do not overlap when normalized", async () => {
    const { toWallClockISO } = await import("@/lib/format/datetime");
    const shift1 = {
      startsAt: new Date(toWallClockISO("2026-10-15T08:00")),
      endsAt: new Date(toWallClockISO("2026-10-15T12:00")),
    };
    const shift2 = {
      startsAt: new Date(toWallClockISO("2026-10-15T14:00")),
      endsAt: new Date(toWallClockISO("2026-10-15T18:00")),
    };

    const overlaps =
      shift1.startsAt < shift2.endsAt && shift2.startsAt < shift1.endsAt;
    expect(overlaps).toBe(false);
  });
});
