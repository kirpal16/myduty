import * as z from "zod";
import type { OfficerTimelineEventType } from "@/types/database";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const officerProfileDetailsSchema = z.object({
  fullName: z
    .string({ error: "Enter your full name." })
    .trim()
    .min(2, { error: "Name must be at least 2 characters." })
    .max(80, { error: "Name cannot exceed 80 characters." }),
  phone: z
    .string()
    .trim()
    .max(20, { error: "Phone number is too long." })
    .refine((v) => v === "" || /^[\d+\-() ]{6,}$/.test(v), {
      error: "Enter a valid contact number.",
    })
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  departmentId: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || v === "" || z.uuid().safeParse(v).success, {
      error: "Select a valid department.",
    }),
  designation: z
    .string()
    .trim()
    .max(100, { error: "Designation is too long." })
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  employeeCode: z
    .string()
    .trim()
    .max(50, { error: "Buckle/Employee code is too long." })
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  joiningDate: z
    .string()
    .trim()
    .refine((v) => v === "" || DATE_REGEX.test(v), {
      error: "Enter a valid date (YYYY-MM-DD).",
    })
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  joiningPlace: z
    .string()
    .trim()
    .max(100, { error: "Joining place is too long." })
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  currentPosting: z
    .string()
    .trim()
    .max(120, { error: "Current posting is too long." })
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  dateOfBirth: z
    .string()
    .trim()
    .refine((v) => v === "" || DATE_REGEX.test(v), {
      error: "Enter a valid date of birth (YYYY-MM-DD).",
    })
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  bloodGroup: z
    .string()
    .trim()
    .max(10, { error: "Blood group is invalid." })
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  emergencyContact: z
    .string()
    .trim()
    .max(50, { error: "Emergency contact is too long." })
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  homeDistrict: z
    .string()
    .trim()
    .max(100, { error: "Home district is too long." })
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  bio: z
    .string()
    .trim()
    .max(2000, { error: "Bio/Achievements cannot exceed 2000 characters." })
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
});

export const officerTimelineEventSchema = z
  .object({
    eventType: z.enum(
      [
        "JOINING",
        "TRAINING",
        "POSTING",
        "TRANSFER",
        "PROMOTION",
        "SPECIAL_DUTY",
        "ACHIEVEMENT",
        "OTHER",
      ] as const,
      { error: "Select an event type." }
    ),
    title: z
      .string({ error: "Enter a title for this milestone." })
      .trim()
      .min(2, { error: "Title must be at least 2 characters." })
      .max(150, { error: "Title cannot exceed 150 characters." }),
    designation: z
      .string()
      .trim()
      .max(100, { error: "Designation is too long." })
      .nullable()
      .optional()
      .transform((v) => (v ? v : null)),
    department: z
      .string()
      .trim()
      .max(120, { error: "Department/Station is too long." })
      .nullable()
      .optional()
      .transform((v) => (v ? v : null)),
    location: z
      .string()
      .trim()
      .max(120, { error: "Location/Place is too long." })
      .nullable()
      .optional()
      .transform((v) => (v ? v : null)),
    fromLocation: z
      .string()
      .trim()
      .max(120, { error: "From location is too long." })
      .nullable()
      .optional()
      .transform((v) => (v ? v : null)),
    toLocation: z
      .string()
      .trim()
      .max(120, { error: "To location is too long." })
      .nullable()
      .optional()
      .transform((v) => (v ? v : null)),
    startDate: z
      .string({ error: "Select a start date." })
      .trim()
      .regex(DATE_REGEX, { error: "Enter a valid start date (YYYY-MM-DD)." }),
    endDate: z
      .string()
      .trim()
      .nullable()
      .optional()
      .refine(
        (v) => v === null || v === undefined || v === "" || DATE_REGEX.test(v),
        {
          error: "Enter a valid end date (YYYY-MM-DD).",
        }
      )
      .transform((v) => (v ? v : null)),
    isCurrent: z.boolean().default(false),
    description: z
      .string()
      .trim()
      .max(2000, { error: "Description cannot exceed 2000 characters." })
      .nullable()
      .optional()
      .transform((v) => (v ? v : null)),
  })
  .refine(
    (data) => {
      if (!data.isCurrent && data.endDate && data.startDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    {
      message: "End date must be on or after start date.",
      path: ["endDate"],
    }
  );

export const createDepartmentSchema = z.object({
  name: z
    .string({ error: "Enter department name." })
    .trim()
    .min(2, { error: "Department name must have at least 2 characters." })
    .max(80, { error: "Department name cannot exceed 80 characters." }),
});

export function officerProfileValuesFromForm(formData: FormData) {
  const getStr = (key: string) => {
    const all = formData.getAll(key);
    if (all.length === 0) return null;
    const trimmedList = all.map((v) => String(v).trim());
    const nonEmpty = [...trimmedList].reverse().find((v) => v !== "");
    if (nonEmpty !== undefined) return nonEmpty;
    const last = trimmedList[trimmedList.length - 1];
    return last !== "" ? last : null;
  };

  const getFullName = () => {
    const all = formData.getAll("fullName");
    const trimmedList = all.map((v) => String(v).trim());
    const nonEmpty = [...trimmedList].reverse().find((v) => v !== "");
    return nonEmpty || trimmedList[trimmedList.length - 1] || "";
  };

  return {
    fullName: getFullName(),
    phone: getStr("phone"),
    departmentId: getStr("departmentId"),
    designation: getStr("designation"),
    employeeCode: getStr("employeeCode"),
    joiningDate: getStr("joiningDate"),
    joiningPlace: getStr("joiningPlace"),
    currentPosting: getStr("currentPosting"),
    dateOfBirth: getStr("dateOfBirth"),
    bloodGroup: getStr("bloodGroup"),
    emergencyContact: getStr("emergencyContact"),
    homeDistrict: getStr("homeDistrict"),
    bio: getStr("bio"),
  };
}

export function timelineValuesFromForm(formData: FormData) {
  const isCurrent =
    formData.get("isCurrent") === "true" || formData.get("isCurrent") === "on";

  const getStr = (key: string) => {
    const val = formData.get(key);
    return val !== null && val !== undefined && String(val).trim() !== ""
      ? String(val).trim()
      : null;
  };

  return {
    eventType:
      (formData.get("eventType") as OfficerTimelineEventType) || "POSTING",
    title: String(formData.get("title") ?? "").trim(),
    designation: getStr("designation"),
    department: getStr("department"),
    location: getStr("location"),
    fromLocation: getStr("fromLocation"),
    toLocation: getStr("toLocation"),
    startDate: String(formData.get("startDate") ?? "").trim(),
    endDate: isCurrent ? null : getStr("endDate"),
    isCurrent,
    description: getStr("description"),
  };
}
