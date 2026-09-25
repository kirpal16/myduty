import { describe, it, expect } from "vitest";
import * as z from "zod";
import { fieldErrors, failed, invalid, succeeded } from "./formState";

describe("fieldErrors", () => {
  it("keys a simple issue by its field name", () => {
    const schema = z.object({ email: z.email({ error: "Enter an email." }) });
    const parsed = schema.safeParse({ email: "nope" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    expect(fieldErrors(parsed.error)).toEqual({ email: ["Enter an email."] });
  });

  it("collects several issues on the same field", () => {
    const schema = z.object({
      password: z
        .string()
        .min(8, { error: "At least 8 characters." })
        .regex(/\d/, { error: "Include a digit." }),
    });
    const parsed = schema.safeParse({ password: "short" });
    if (parsed.success) throw new Error("expected failure");

    expect(fieldErrors(parsed.error).password).toEqual([
      "At least 8 characters.",
      "Include a digit.",
    ]);
  });

  it("keeps the FULL dotted path for a nested issue", () => {
    // The bug this replaces: every per-day issue collapsed onto "perDay",
    // a key no form renders, so a bad amount on day three was invisible.
    const schema = z.object({
      perDay: z.array(z.object({ taAmount: z.number().min(0, { error: "No negatives." }) })),
    });
    const parsed = schema.safeParse({
      perDay: [{ taAmount: 10 }, { taAmount: 5 }, { taAmount: -3 }],
    });
    if (parsed.success) throw new Error("expected failure");

    const errors = fieldErrors(parsed.error);
    expect(errors["perDay.2.taAmount"]).toEqual(["No negatives."]);
  });

  it("also records the parent key, so a form rendering only the parent still shows something", () => {
    const schema = z.object({
      perDay: z.array(z.object({ taAmount: z.number().min(0, { error: "No negatives." }) })),
    });
    const parsed = schema.safeParse({ perDay: [{ taAmount: -1 }] });
    if (parsed.success) throw new Error("expected failure");

    expect(fieldErrors(parsed.error).perDay).toEqual(["No negatives."]);
  });

  it("does not duplicate a message when the path is a single segment", () => {
    const schema = z.object({ name: z.string().min(1, { error: "Required." }) });
    const parsed = schema.safeParse({ name: "" });
    if (parsed.success) throw new Error("expected failure");

    expect(fieldErrors(parsed.error).name).toEqual(["Required."]);
  });

  it("puts a refinement issue on the field its path names", () => {
    // Cross-field rules are the reason validation runs the whole schema
    // rather than one picked field.
    const schema = z
      .object({ startsAt: z.string(), endsAt: z.string() })
      .refine((d) => d.endsAt > d.startsAt, {
        error: "End time must be after start time.",
        path: ["endsAt"],
      });
    const parsed = schema.safeParse({ startsAt: "18:00", endsAt: "09:00" });
    if (parsed.success) throw new Error("expected failure");

    expect(fieldErrors(parsed.error)).toEqual({
      endsAt: ["End time must be after start time."],
    });
  });

  it("files a pathless issue under 'form'", () => {
    const schema = z.object({ a: z.string() }).refine(() => false, {
      error: "Something is wrong overall.",
    });
    const parsed = schema.safeParse({ a: "x" });
    if (parsed.success) throw new Error("expected failure");

    expect(fieldErrors(parsed.error).form).toEqual(["Something is wrong overall."]);
  });
});

describe("state constructors", () => {
  it("distinguishes a failure from a success", () => {
    expect(failed("Nope.")).toEqual({ message: "Nope." });
    expect(succeeded()).toEqual({ ok: true });
    expect(succeeded("Saved.")).toEqual({ ok: true, message: "Saved." });
  });

  it("carries field errors, with an optional summary", () => {
    expect(invalid({ name: ["Required."] })).toEqual({ errors: { name: ["Required."] } });
    expect(invalid({ name: ["Required."] }, "Check the form.")).toEqual({
      errors: { name: ["Required."] },
      message: "Check the form.",
    });
  });

  it("never marks a failure as ok", () => {
    // The client keys "show a success toast" off `ok`, so this must not leak.
    expect(failed("Nope.")?.ok).toBeUndefined();
    expect(invalid({ a: ["b"] })?.ok).toBeUndefined();
  });
});
