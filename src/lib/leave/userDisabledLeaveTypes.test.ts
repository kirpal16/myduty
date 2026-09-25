import { describe, it, expect } from "vitest";

describe("Leave type filtering for disabled types", () => {
  const sampleLeaveTypes = [
    { id: "lt-1", name: "Casual Leave", code: "CL", color: "#3b82f6", is_active: true },
    { id: "lt-2", name: "Privilege Leave", code: "PL", color: "#8b5cf6", is_active: true },
    { id: "lt-3", name: "Maternity Leave", code: "ML", color: "#ec4899", is_active: true },
    { id: "lt-4", name: "Study Leave", code: "SL", color: "#10b981", is_active: true },
  ];

  it("filters out leave types that the officer has disabled", () => {
    const disabledSet = new Set(["lt-3", "lt-4"]);

    const availableTypes = sampleLeaveTypes.filter((lt) => !disabledSet.has(lt.id));

    expect(availableTypes).toHaveLength(2);
    expect(availableTypes.map((t) => t.id)).toEqual(["lt-1", "lt-2"]);
    expect(availableTypes.some((t) => t.id === "lt-3")).toBe(false);
    expect(availableTypes.some((t) => t.id === "lt-4")).toBe(false);
  });

  it("includes all active leave types when none are disabled", () => {
    const disabledSet = new Set<string>();

    const availableTypes = sampleLeaveTypes.filter((lt) => !disabledSet.has(lt.id));

    expect(availableTypes).toHaveLength(4);
  });

  it("preserves a disabled leave type in edit mode if it is the one on the existing log", () => {
    const disabledSet = new Set(["lt-3"]);
    const existingLogLeaveTypeId = "lt-3";

    const availableForEdit = sampleLeaveTypes.filter(
      (lt) => !disabledSet.has(lt.id) || lt.id === existingLogLeaveTypeId,
    );

    expect(availableForEdit).toHaveLength(4);
    expect(availableForEdit.some((t) => t.id === "lt-3")).toBe(true);
  });
});
