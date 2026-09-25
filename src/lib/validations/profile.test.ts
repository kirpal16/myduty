import { describe, it, expect } from "vitest";
import {
  officerProfileDetailsSchema,
  officerTimelineEventSchema,
  createDepartmentSchema,
  officerProfileValuesFromForm,
} from "./profile";

describe("profile validations", () => {
  it("validates officer profile details correctly", () => {
    const valid = officerProfileDetailsSchema.safeParse({
      fullName: "Inspector Vikram Rathore",
      phone: "+91 98765 43210",
      departmentId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      designation: "Police Inspector (PI)",
      employeeCode: "BK-1049",
      joiningDate: "2015-06-01",
      joiningPlace: "Karai Police Academy",
      currentPosting: "Navrangpura Police Station",
      bloodGroup: "B+",
    });
    expect(valid.success).toBe(true);

    const invalidName = officerProfileDetailsSchema.safeParse({
      fullName: "A",
    });
    expect(invalidName.success).toBe(false);
  });

  it("validates timeline event with valid dates", () => {
    const valid = officerTimelineEventSchema.safeParse({
      eventType: "POSTING",
      title: "Station House Officer",
      designation: "Police Inspector",
      startDate: "2021-01-01",
      endDate: "2023-01-01",
      isCurrent: false,
    });
    expect(valid.success).toBe(true);

    const validWithNulls = officerTimelineEventSchema.safeParse({
      eventType: "JOINING",
      title: "Joined Gujarat Police",
      designation: null,
      department: null,
      location: null,
      fromLocation: null,
      toLocation: null,
      startDate: "2020-01-15",
      endDate: null,
      isCurrent: true,
      description: null,
    });
    expect(validWithNulls.success).toBe(true);

    const invalidDates = officerTimelineEventSchema.safeParse({
      eventType: "POSTING",
      title: "Station House Officer",
      startDate: "2023-01-01",
      endDate: "2021-01-01",
      isCurrent: false,
    });
    expect(invalidDates.success).toBe(false);
  });

  it("validates create department name", () => {
    expect(createDepartmentSchema.safeParse({ name: "Cyber Crime Cell" }).success).toBe(true);
    expect(createDepartmentSchema.safeParse({ name: " " }).success).toBe(false);
    expect(createDepartmentSchema.safeParse({ name: "A" }).success).toBe(false);
  });

  it("parses officer profile values from FormData, correctly handling duplicate entries", () => {
    const fd = new FormData();
    // Simulate what happens when a hidden input has empty default value and visible input has user-typed value
    fd.append("fullName", "Vikram Rathore");
    fd.append("designation", "");
    fd.append("designation", "Police Inspector");
    fd.append("currentPosting", "");
    fd.append("currentPosting", "Navrangpura PS");
    fd.append("joiningDate", "2021-03-10");
    fd.append("employeeCode", "BK-409");

    const parsed = officerProfileValuesFromForm(fd);
    expect(parsed.fullName).toBe("Vikram Rathore");
    expect(parsed.designation).toBe("Police Inspector");
    expect(parsed.currentPosting).toBe("Navrangpura PS");
    expect(parsed.joiningDate).toBe("2021-03-10");
    expect(parsed.employeeCode).toBe("BK-409");
  });
});
