import { describe, expect, it } from "vitest";

import { coarsePointer, touchControlsActive, useDiscShown } from "./coarse-pointer.ts";

function host(matches: boolean) {
  const queries: string[] = [];
  const list = { matches };
  return {
    list,
    matchMedia: (query: string) => {
      queries.push(query);
      return list as unknown as MediaQueryList;
    },
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

  it("show the Use disc on a touch screen while an action is in reach, never on desktop", () => {
    expect(useDiscShown(host(true), true, false, true)).toBe(true);
    expect(useDiscShown(host(true), true, false, false)).toBe(false);
    expect(useDiscShown(host(false), true, false, true)).toBe(false);
    expect(useDiscShown(host(true), true, true, true)).toBe(false);
    expect(useDiscShown(host(true), false, false, true)).toBe(false);
  });
});
