import { describe, it, expect } from "vitest";
import { serialiseFormEntries } from "./useFormDirty";

/**
 * The suite runs in the `node` environment with no DOM, so these exercise the
 * comparison semantics directly — the same approach `useBodyScrollLock.test.ts`
 * takes. What the hook adds on top is event wiring; what decides whether a
 * Save button is enabled is right here.
 */
type Entry = [string, string | File];
const entries = (...e: Entry[]) => serialiseFormEntries(e as [string, never][]);

describe("serialiseFormEntries", () => {
  it("is stable for identical values, so an untouched form stays clean", () => {
    const before = entries(["allocated", "60"], ["carryForward", "on"]);
    const after = entries(["allocated", "60"], ["carryForward", "on"]);
    expect(after).toBe(before);
  });

  it("changes when a value changes", () => {
    expect(entries(["allocated", "60"])).not.toBe(entries(["allocated", "61"]));
  });

  it("returns to the original string when a value is typed back", () => {
    // Change it, change it back — the Save button must go quiet again.
    const original = entries(["allocated", "60"]);
    const edited = entries(["allocated", "61"]);
    const reverted = entries(["allocated", "60"]);

    expect(edited).not.toBe(original);
    expect(reverted).toBe(original);
  });

  it("changes when a field UNMOUNTS", () => {
    // The maximum-balance input disappears when carry-forward is switched
    // off. That is a genuinely different rule to save, so it must read dirty.
    const withMax = entries(["carryForward", "on"], ["maxAccumulated", "100"]);
    const withoutMax = entries(["allocated", "60"]);
    expect(withoutMax).not.toBe(withMax);
  });

  it("changes when a checkbox is unticked, which drops its key entirely", () => {
    // An unchecked box submits nothing at all rather than "off".
    const ticked = entries(["allocated", "60"], ["carryForward", "on"]);
    const unticked = entries(["allocated", "60"]);
    expect(unticked).not.toBe(ticked);
  });

  it("does not confuse two fields whose values are swapped", () => {
    expect(entries(["a", "1"], ["b", "2"])).not.toBe(entries(["a", "2"], ["b", "1"]));
  });

  it("does not let a value containing the separator forge another field", () => {
    // "a=1 b=2" as a single value must not equal two fields of those values.
    const forged = entries(["a", "1 b=2"]);
    const real = entries(["a", "1"], ["b", "2"]);
    expect(forged).not.toBe(real);
  });

  it("treats an empty string as a real value, not as absent", () => {
    // Clearing a box is a change worth saving — and worth warning about.
    expect(entries(["allocated", ""])).not.toBe(entries(["allocated", "60"]));
    expect(entries(["allocated", ""])).not.toBe(entries());
  });

  it("identifies a file by name, size and modified time rather than content", () => {
    const file = (name: string, size: number, lastModified: number) =>
      ({ name, size, lastModified }) as File;

    const a = entries(["file", file("scan.pdf", 1024, 111)]);
    const same = entries(["file", file("scan.pdf", 1024, 111)]);
    const renamed = entries(["file", file("other.pdf", 1024, 111)]);
    const resized = entries(["file", file("scan.pdf", 2048, 111)]);

    expect(same).toBe(a);
    expect(renamed).not.toBe(a);
    expect(resized).not.toBe(a);
  });

  it("is consistent for a form with no fields", () => {
    // The exact encoding is an implementation detail; that two empty forms
    // agree, and differ from a populated one, is not.
    expect(entries()).toBe(entries());
    expect(entries()).not.toBe(entries(["a", ""]));
  });
});
