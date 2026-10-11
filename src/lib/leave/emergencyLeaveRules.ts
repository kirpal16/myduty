/**
 * Rules and guards for emergency / medical leave types.
 *
 * Emergency and sick leaves (e.g. Sick Leave, Medical Leave) are taken only
 * when required due to illness or personal medical emergency. Unlike routine
 * leaves (such as Casual Leave or Privilege Leave), officers are not expected
 * to spend or exhaust their sick leave balance before year-end.
 *
 * Therefore, in year-end expiry warnings, emergency leaves are not marked as
 * "lost" or "at risk"; they are presented informatively as available emergency quota.
 */

export type LeaveTypeIdentity = {
  name?: string | null;
  code?: string | null;
};

export function isSickOrEmergencyLeave(type: LeaveTypeIdentity | null | undefined): boolean {
  if (!type) return false;
  const code = (type.code ?? "").toUpperCase().trim();
  const name = (type.name ?? "").toLowerCase().trim();

  return (
    code === "SICK" ||
    code === "SL" ||
    code === "MEDICAL" ||
    code === "ML" ||
    name.includes("sick") ||
    name.includes("medical") ||
    name.includes("બીમારી") ||
    name.includes("માંદગી") ||
    name.includes("મેડિકલ")
  );
}
