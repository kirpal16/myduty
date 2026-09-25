// Mirrors the permissions catalog after 0019_user_prefs_and_permissions.sql.
//
// This is a log book: your own entries are always yours to create, edit and
// delete — that's inherent, not a grant. What's left here governs only
// *elevated visibility* (seeing other people's records) and *shared config*.
export const PERMISSIONS = {
  DUTY_VIEW_ALL: "DUTY_VIEW_ALL",
  LEAVE_VIEW_ALL: "LEAVE_VIEW_ALL",
  STORAGE_VIEW_ALL: "STORAGE_VIEW_ALL",
  HOLIDAY_CREATE: "HOLIDAY_CREATE",
  HOLIDAY_DELETE: "HOLIDAY_DELETE",
  REPORT_VIEW: "REPORT_VIEW",
  REPORT_EXPORT: "REPORT_EXPORT",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
