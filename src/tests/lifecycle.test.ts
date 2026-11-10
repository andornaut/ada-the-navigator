import { describe, expect, it, vi } from "vitest";

import { followPageVisibility } from "../lifecycle.ts";

class PageDocument extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";
}

describe("published visibility adapter", () => {
  it("pauses once per hidden transition and resumes after page restoration", () => {
    const page = new EventTarget();
    const document = new PageDocument();
    const loop = { sleep: vi.fn(), wake: vi.fn() };
    const stop = followPageVisibility(page, document, loop);

    page.dispatchEvent(new Event("pagehide"));
    document.visibilityState = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    expect(loop.sleep).toHaveBeenCalledTimes(1);
    document.visibilityState = "visible";
    page.dispatchEvent(new Event("pageshow"));
    expect(loop.wake).toHaveBeenCalledTimes(1);

    stop();
    page.dispatchEvent(new Event("pagehide"));
    document.visibilityState = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    document.visibilityState = "visible";
    page.dispatchEvent(new Event("pageshow"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(loop.sleep).toHaveBeenCalledTimes(1);
    expect(loop.wake).toHaveBeenCalledTimes(1);
  });

  it("starts asleep when mounted in a hidden page", () => {
    const page = new EventTarget();
    const document = new PageDocument();
    document.visibilityState = "hidden";
    const loop = { sleep: vi.fn(), wake: vi.fn() };
    const stop = followPageVisibility(page, document, loop);
    expect(loop.sleep).toHaveBeenCalledTimes(1);
    document.visibilityState = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    expect(loop.wake).toHaveBeenCalledTimes(1);
    stop();
  });
});
