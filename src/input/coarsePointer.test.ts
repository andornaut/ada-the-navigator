import { describe, expect, it } from "vitest";

import { coarsePointer, touchControlsActive, useDiscShown } from "./coarsePointer.ts";

function host(matches: boolean, maxTouchPoints = 0) {
  const queries: string[] = [];
  const list = { matches };
  return {
    list,
    matchMedia: (query: string) => {
      queries.push(query);
      return list as unknown as MediaQueryList;
    },
    navigator: { maxTouchPoints },
    queries,
  };
}

describe("touch-only joysticks", () => {
  it("asks for the primary pointer once per window and follows its changes", () => {
    const touch = host(true);
    expect(coarsePointer(touch)).toBe(true);
    touch.list.matches = false;
    expect(coarsePointer(touch)).toBe(false);
    expect(touch.queries).toEqual(["(pointer: coarse)"]);
  });

  it("shows and accepts joysticks only on a coarse pointer while enabled and unobstructed", () => {
    expect(touchControlsActive(host(true), true, false)).toBe(true);
    expect(touchControlsActive(host(false), true, false)).toBe(false);
    expect(touchControlsActive(host(true), false, false)).toBe(false);
    expect(touchControlsActive(host(true), true, true)).toBe(false);
  });

  it("shows Use in reach on touchscreen and touch input devices", () => {
    expect(useDiscShown(host(true), true, true, false)).toBe(true);
    expect(useDiscShown(host(false, 1), true, true, false)).toBe(true);
    expect(useDiscShown(host(false), true, true, true)).toBe(true);
    expect(useDiscShown(host(false), true, true, false)).toBe(false);
    expect(useDiscShown(host(true), false, true, false)).toBe(false);
    expect(useDiscShown(host(true), true, false, true)).toBe(false);
  });
});
