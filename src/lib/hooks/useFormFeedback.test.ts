import { describe, it, expect } from "vitest";
import { errorId, firstInvalidControl, sameMessages } from "./useFormFeedback";

/**
 * Re-validating a field must not produce a new errors object when nothing
 * changed: every needless render while an input event is in flight risked
 * writing the old value back into a controlled date input.
 */
describe("sameMessages", () => {
  it("treats absent and empty as the same", () => {
    expect(sameMessages(undefined, undefined)).toBe(true);
    expect(sameMessages(undefined, [])).toBe(true);
  });

  it("compares messages in order", () => {
    expect(sameMessages(["Enter a date."], ["Enter a date."])).toBe(true);
    expect(sameMessages(["Enter a date."], ["End must be after start."])).toBe(false);
    expect(sameMessages(["a", "b"], ["b", "a"])).toBe(false);
    expect(sameMessages(["a"], undefined)).toBe(false);
  });
});

/**
 * The suite runs in `node` with no DOM, so the hook's React behaviour is
 * exercised in the browser rather than here. What IS testable — and what has
 * a wrong answer that looks plausible — is which field gets scrolled to.
 */

type FakeEl = {
  tagName: string;
  type?: string;
  attrs: Record<string, string>;
  getAttribute(name: string): string | null;
};

function el(name: string, opts: { type?: string; tag?: string } = {}): FakeEl {
  return {
    tagName: opts.tag ?? "INPUT",
    type: opts.type,
    attrs: opts.type ? { name, type: opts.type } : { name },
    getAttribute(attr: string) {
      return this.attrs[attr] ?? null;
    },
  };
}

/** A form stub: querySelectorAll("[name]") returns the controls in DOM order. */
function form(controls: FakeEl[], visible: Record<string, FakeEl> = {}) {
  return {
    querySelectorAll: () => controls,
    querySelector: (selector: string) => {
      const match = /\[data-field="([^"]+)"\]/.exec(selector);
      return match ? (visible[match[1]] ?? null) : null;
    },
  } as unknown as HTMLFormElement;
}

describe("firstInvalidControl", () => {
  it("returns the first invalid control in DOM order, not error-object order", () => {
    // The trap: Object.keys follows the SCHEMA's field order, which need not
    // match the screen. Here the error object names endsAt first, but the
    // officer sees startsAt higher up the page.
    const controls = [el("dutyTypeId"), el("startsAt"), el("endsAt")];
    const errors = {
      endsAt: ["End must be after start."],
      startsAt: ["Enter a start time."],
    };

    const found = firstInvalidControl(form(controls), errors) as unknown as FakeEl;
    expect(found.getAttribute("name")).toBe("startsAt");
  });

  it("skips controls that are valid", () => {
    const controls = [el("a"), el("b"), el("c")];
    const found = firstInvalidControl(form(controls), {
      c: ["Wrong."],
    }) as unknown as FakeEl;
    expect(found.getAttribute("name")).toBe("c");
  });

  it("returns null when nothing on the form matches an error", () => {
    // A server error for a field this form does not render must not throw.
    expect(firstInvalidControl(form([el("a")]), { somethingElse: ["Wrong."] })).toBeNull();
  });

  it("returns null for an empty error object", () => {
    expect(firstInvalidControl(form([el("a")]), {})).toBeNull();
  });

  it("ignores an error with an empty message list", () => {
    expect(firstInvalidControl(form([el("a")]), { a: [] })).toBeNull();
  });
});

describe("errorId", () => {
  it("is stable for a plain field name", () => {
    expect(errorId("startDate")).toBe("err-startDate");
    expect(errorId("startDate")).toBe(errorId("startDate"));
  });

  it("produces a valid id from a nested path", () => {
    // "perDay.2.taAmount" must not put dots in an id that aria-describedby
    // and getElementById have to resolve.
    const id = errorId("perDay.2.taAmount");
    expect(id).toBe("err-perDay-2-taAmount");
    expect(id).not.toContain(".");
  });

  it("gives different fields different ids", () => {
    expect(errorId("a.b")).not.toBe(errorId("a.c"));
  });
});
