import { describe, expect, it } from "vitest";

import { menuActions } from "./menuCard.ts";
import { type NavigationActivity, navigationEntry } from "./navigationEntry.ts";

const active: NavigationActivity = {
  background: false,
  dialogue: false,
  docked: false,
  flight: { shield: 1 },
  jumping: false,
  mandatoryStory: false,
  mapOpen: false,
  mode: "space",
};

describe("caller-owned Pause/Menu policy", () => {
  it("uses Pause only for active pausable simulation", () => {
    expect(navigationEntry(active)).toBe("pause");
  });
  it.each([
    { flight: null, mode: "home" },
    { mapOpen: true },
    { mandatoryStory: true },
    { dialogue: true },
    { docked: true },
    { jumping: true },
    { background: true },
    { flight: { shield: 0 } },
  ] satisfies Partial<NavigationActivity>[])("uses Menu in nonpausable context %j", (facts) => {
    expect(navigationEntry({ ...active, ...facts })).toBe("menu");
  });
  it("keeps Start actions bounded and story Menu free of flight navigation", () => {
    expect(menuActions("start")).toEqual(["achievements", "settings"]);
    expect(menuActions("start")).toEqual(["achievements", "settings"]);
    expect(menuActions("nonplay")).toEqual(["achievements", "settings"]);
    expect(menuActions("start")).toBe(menuActions("nonplay"));
  });
});
