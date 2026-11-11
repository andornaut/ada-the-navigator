import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { REFUSAL, refusalFrames, refuse } from "./refusal.ts";

// An element's style as the cue sets it.
function target() {
  const style = new Map<string, string>();
  return {
    style: {
      removeProperty: (name: string) => {
        style.delete(name);
        return "";
      },
      setProperty: (name: string, value: string) => {
        style.set(name, value);
      },
    },
    values: style,
  };
}

describe("refusal cue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("alternates red every 80ms while shaking 3 logical px, for 320ms", () => {
    const frames = refusalFrames(false);
    expect(frames.map(({ at }) => at)).toEqual([0, 80, 160, 240, 320]);
    expect(frames.map(({ red }) => red)).toEqual([true, false, true, false, false]);
    expect(frames.map(({ offset }) => Math.abs(offset))).toEqual([3, 3, 3, 3, 0]);
    const element = target();
    refuse(element, false);
    vi.advanceTimersByTime(0);
    expect(element.values.get("color")).toBe(REFUSAL.color);
    expect(element.values.get("transform")).toBe("translateX(calc(var(--ada-unit) * -3px))");
    vi.advanceTimersByTime(80);
    expect(element.values.has("color")).toBe(false);
    expect(element.values.get("transform")).toBe("translateX(calc(var(--ada-unit) * 3px))");
    vi.advanceTimersByTime(240);
    expect(element.values.size).toBe(0);
  });

  it("holds red for 320ms without shaking under reduced motion", () => {
    expect(refusalFrames(true)).toEqual([
      { at: 0, offset: 0, red: true },
      { at: 320, offset: 0, red: false },
    ]);
    const element = target();
    refuse(element, true);
    vi.advanceTimersByTime(160);
    expect(element.values.get("color")).toBe(REFUSAL.color);
    expect(element.values.has("transform")).toBe(false);
    vi.advanceTimersByTime(160);
    expect(element.values.size).toBe(0);
  });

  it("restarts rather than overlapping on a second press", () => {
    const element = target();
    refuse(element, false);
    vi.advanceTimersByTime(250);
    refuse(element, true);
    vi.advanceTimersByTime(100);
    expect(element.values.get("color")).toBe(REFUSAL.color);
    expect(element.values.has("transform")).toBe(false);
    vi.advanceTimersByTime(220);
    expect(element.values.size).toBe(0);
  });
});
