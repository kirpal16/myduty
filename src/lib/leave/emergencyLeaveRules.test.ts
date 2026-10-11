import { describe, it, expect } from "vitest";
import { isSickOrEmergencyLeave } from "./emergencyLeaveRules";

describe("isSickOrEmergencyLeave", () => {
  it("identifies Sick Leave by code", () => {
    expect(isSickOrEmergencyLeave({ name: "Any", code: "SICK" })).toBe(true);
    expect(isSickOrEmergencyLeave({ name: "Any", code: "sick" })).toBe(true);
    expect(isSickOrEmergencyLeave({ name: "Any", code: "SL" })).toBe(true);
  });

  it("identifies Medical Leave by code", () => {
    expect(isSickOrEmergencyLeave({ name: "Any", code: "MEDICAL" })).toBe(true);
    expect(isSickOrEmergencyLeave({ name: "Any", code: "medical" })).toBe(true);
    expect(isSickOrEmergencyLeave({ name: "Any", code: "ML" })).toBe(true);
  });

  it("identifies Sick & Medical Leave by name", () => {
    expect(isSickOrEmergencyLeave({ name: "Sick Leave", code: null })).toBe(true);
    expect(isSickOrEmergencyLeave({ name: "Medical Leave", code: null })).toBe(true);
    expect(isSickOrEmergencyLeave({ name: "બીમારી રજા", code: null })).toBe(true);
    expect(isSickOrEmergencyLeave({ name: "માંદગી રજા", code: null })).toBe(true);
    expect(isSickOrEmergencyLeave({ name: "મેડિકલ રજા", code: null })).toBe(true);
  });

  it("does NOT classify routine leaves as emergency leaves", () => {
    expect(isSickOrEmergencyLeave({ name: "Casual Leave", code: "CL" })).toBe(false);
    expect(isSickOrEmergencyLeave({ name: "Privilege Leave", code: "PL" })).toBe(false);
    expect(isSickOrEmergencyLeave({ name: "Earned Leave", code: "EL" })).toBe(false);
    expect(isSickOrEmergencyLeave({ name: "Special Leave", code: "SPL" })).toBe(false);
    expect(isSickOrEmergencyLeave({ name: "Holiday Leave", code: "HL" })).toBe(false);
    expect(isSickOrEmergencyLeave({ name: "Leave Without Pay", code: "LWP" })).toBe(false);
    expect(isSickOrEmergencyLeave(null)).toBe(false);
    expect(isSickOrEmergencyLeave(undefined)).toBe(false);
  });
});
