import { describe, it, expect } from "vitest";
import { isUserOnlyPath, isAdminPath } from "./routeAccess";

describe("isUserOnlyPath", () => {
  it.each(["/dashboard", "/calendar", "/holidays/mine", "/leave/balance"])(
    "%s is officer-only",
    (p) => expect(isUserOnlyPath(p)).toBe(true),
  );

  it("matches nested routes", () => {
    expect(isUserOnlyPath("/calendar/2026-09")).toBe(true);
  });

  it("does not match a prefix that is only a string prefix", () => {
    // /holidays is the admin-facing list; only /holidays/mine is officer-only.
    expect(isUserOnlyPath("/holidays")).toBe(false);
    expect(isUserOnlyPath("/dashboards")).toBe(false);
    expect(isUserOnlyPath("/leave")).toBe(false);
  });

  it.each(["/duty", "/reports", "/storage", "/settings", "/admin/users"])(
    "%s is shared or admin",
    (p) => expect(isUserOnlyPath(p)).toBe(false),
  );
});

describe("isAdminPath", () => {
  it("matches the admin area", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/users/123")).toBe(true);
  });

  it("does not match a lookalike", () => {
    expect(isAdminPath("/administration")).toBe(false);
    expect(isAdminPath("/duty")).toBe(false);
  });
});
