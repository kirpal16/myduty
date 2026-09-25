import { describe, it, expect } from "vitest";
import { userSettingsSchema, userSettingsValuesFromForm } from "./settings";

/**
 * An officer who never opens Settings still logs Binpagari leave, so an unset
 * daily salary rate has to be an ordinary state — 0, meaning "not priced" —
 * and never a validation failure.
 */
function formWith(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("holidayDayRate", "0");
  fd.set("defaultShiftStart", "10:00");
  fd.set("defaultShiftEnd", "18:00");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

describe("userSettings daily salary rate", () => {
  it("treats a missing field as 0 rather than failing", () => {
    const values = userSettingsValuesFromForm(formWith());
    expect(values.dailySalaryRate).toBe(0);
    expect(userSettingsSchema.safeParse(values).success).toBe(true);
  });

  it("treats a blank field as 0 rather than failing", () => {
    const values = userSettingsValuesFromForm(
      formWith({ dailySalaryRate: "   " }),
    );
    expect(values.dailySalaryRate).toBe(0);
    expect(userSettingsSchema.safeParse(values).success).toBe(true);
  });

  it("keeps a real rate", () => {
    const values = userSettingsValuesFromForm(
      formWith({ dailySalaryRate: "992" }),
    );
    expect(values.dailySalaryRate).toBe(992);
    expect(userSettingsSchema.safeParse(values).success).toBe(true);
  });

  // Blank means "not set"; anything else that is not a number must still fail
  // rather than quietly becoming 0.
  it("rejects a non-numeric rate instead of defaulting it", () => {
    const values = userSettingsValuesFromForm(
      formWith({ dailySalaryRate: "abc" }),
    );
    expect(userSettingsSchema.safeParse(values).success).toBe(false);
  });

  it("rejects a negative rate", () => {
    const values = userSettingsValuesFromForm(
      formWith({ dailySalaryRate: "-5" }),
    );
    expect(userSettingsSchema.safeParse(values).success).toBe(false);
  });
});
