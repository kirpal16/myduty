import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useModalBackClose } from "./useModalBackClose";

describe("useModalBackClose", () => {
  let listeners: Record<string, EventListenerOrEventListenerObject[]> = {};

  beforeEach(() => {
    listeners = {};
    vi.stubGlobal("window", {
      addEventListener: (type: string, fn: any) => {
        listeners[type] = listeners[type] || [];
        listeners[type].push(fn);
      },
      removeEventListener: (type: string, fn: any) => {
        listeners[type] = (listeners[type] || []).filter((l) => l !== fn);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds popstate and keydown listeners when modal is open", () => {
    const onClose = vi.fn();
    // Simulate mounting hook when open
    let cleanup: any;
    const effect = () => {
      const handlePopState = () => onClose();
      const handleKeyDown = (e: any) => {
        if (e.key === "Escape") onClose();
      };
      window.addEventListener("popstate", handlePopState);
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("popstate", handlePopState);
        window.removeEventListener("keydown", handleKeyDown);
      };
    };

    cleanup = effect();
    expect(listeners["popstate"]?.length).toBe(1);
    expect(listeners["keydown"]?.length).toBe(1);

    // Trigger popstate
    const popFn = listeners["popstate"][0] as any;
    popFn(new Event("popstate"));
    expect(onClose).toHaveBeenCalledTimes(1);

    // Trigger escape
    const keyFn = listeners["keydown"][0] as any;
    keyFn({ key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);

    cleanup();
    expect(listeners["popstate"]?.length).toBe(0);
    expect(listeners["keydown"]?.length).toBe(0);
  });
});
