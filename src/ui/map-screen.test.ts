import { describe, expect, it } from "vitest";

import { MAP_SCREEN_STYLE, panelHeight, travelState } from "./map-screen.ts";

describe("map screen place panel", () => {
  it("offers Travel here only for destinations and stations, refused in danger then towing", () => {
    expect(travelState(false, false, null)).toEqual({ offered: false, reason: null });
    expect(travelState(true, true, { travel: false })).toEqual({ offered: false, reason: null });
    expect(travelState(false, false, { travel: true })).toEqual({ offered: true, reason: null });
    expect(travelState(true, true, { travel: true })).toEqual({ offered: true, reason: "danger" });
    expect(travelState(false, true, { travel: true })).toEqual({ offered: true, reason: "towing" });
  });

  it("is 80 high, or 108 with the reason line", () => {
    expect(panelHeight(false)).toBe(80);
    expect(panelHeight(true)).toBe(108);
  });

  it("keeps main's job marks: an orange face on a target and a diamond for a job's own spot", () => {
    expect(MAP_SCREEN_STYLE).toContain(".ada-map-place[data-job]{\n  --face:#feae34");
    expect(MAP_SCREEN_STYLE).toContain('.ada-map-place[data-kind="job"]{');
    expect(MAP_SCREEN_STYLE).toContain("rotate(45deg)");
  });
});
