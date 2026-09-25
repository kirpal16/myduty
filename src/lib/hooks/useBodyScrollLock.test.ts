import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { __scrollLockInternals as sl } from "./useBodyScrollLock";

/**
 * The suite runs in the `node` environment and has no component tests, so
 * rather than pull in jsdom for one file the handful of DOM surfaces this hook
 * actually touches are stubbed. The logic under test — the reference count and
 * what gets restored — is the part that matters, and it is pure.
 */
type Style = Record<string, string>;

let bodyStyle: Style;
let scrollTo: ReturnType<typeof vi.fn>;

beforeEach(() => {
  sl.reset();
  bodyStyle = {
    overflow: "",
    position: "",
    top: "",
    width: "",
    paddingRight: "",
  };
  scrollTo = vi.fn();

  vi.stubGlobal("document", {
    body: { style: bodyStyle },
    // scrollHeight is read to force a layout flush before restoring scroll —
    // see the comment in unlock(). It only needs to be readable here.
    documentElement: { clientWidth: 1000, scrollHeight: 2000 },
  });
  vi.stubGlobal("window", {
    scrollY: 0,
    innerWidth: 1000, // same as clientWidth => no scrollbar to compensate
    scrollTo,
  });
  vi.stubGlobal("getComputedStyle", () => ({ paddingRight: "0px" }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("scroll lock — reference counting", () => {
  it("locks the page on the first overlay", () => {
    sl.lock();
    expect(bodyStyle.overflow).toBe("hidden");
    expect(bodyStyle.position).toBe("fixed");
    expect(sl.count).toBe(1);
  });

  it("a second overlay counts rather than re-locking", () => {
    sl.lock();
    sl.lock();
    expect(sl.count).toBe(2);
    expect(bodyStyle.position).toBe("fixed");
  });

  it("closing the INNER overlay leaves the page locked", () => {
    // The exact bug this guards. The old code reset overflow to "unset" on any
    // close, so shutting a modal opened over the drawer unlocked the page
    // while the drawer was still open.
    sl.lock();
    sl.lock();
    sl.unlock();

    expect(sl.count).toBe(1);
    expect(bodyStyle.position).toBe("fixed");
    expect(bodyStyle.overflow).toBe("hidden");
  });

  it("only the last release restores the page", () => {
    sl.lock();
    sl.lock();
    sl.unlock();
    sl.unlock();

    expect(sl.count).toBe(0);
    expect(bodyStyle.position).toBe("");
    expect(bodyStyle.overflow).toBe("");
  });

  it("an extra unlock cannot drive the count negative", () => {
    sl.lock();
    sl.unlock();
    sl.unlock();
    sl.unlock();
    expect(sl.count).toBe(0);
  });
});

describe("scroll lock — restoring what was actually there", () => {
  it("puts pre-existing inline styles back rather than clearing them", () => {
    // "unset" is not the same as whatever was there before.
    bodyStyle.overflow = "auto";
    bodyStyle.paddingRight = "8px";

    sl.lock();
    expect(bodyStyle.overflow).toBe("hidden");

    sl.unlock();
    expect(bodyStyle.overflow).toBe("auto");
    expect(bodyStyle.paddingRight).toBe("8px");
  });

  it("restores the scroll position, which position:fixed discards", () => {
    vi.stubGlobal("window", { scrollY: 420, innerWidth: 1000, scrollTo });

    sl.lock();
    expect(bodyStyle.top).toBe("-420px");

    sl.unlock();
    expect(scrollTo).toHaveBeenCalledWith({ top: 420, left: 0, behavior: "instant" });
  });

  it("compensates for the scrollbar so the layout does not jump sideways", () => {
    // A desktop with a 15px scrollbar: innerWidth exceeds clientWidth.
    vi.stubGlobal("window", { scrollY: 0, innerWidth: 1015, scrollTo });

    sl.lock();
    expect(bodyStyle.paddingRight).toBe("15px");

    sl.unlock();
    expect(bodyStyle.paddingRight).toBe("");
  });
});
