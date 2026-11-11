import { describe, expect, it } from "vitest";

import { coarsePointer, touchControlsActive } from "./coarse-pointer.ts";

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
});
