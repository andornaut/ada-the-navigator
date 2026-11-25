import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { exclusionZoneRadius } from "./exclusionZones.ts";
import type { SpaceObject } from "./types.ts";

it("gives only destinations and friendly stations an exclusion zone, never hostile actors", () => {
  for (const [kind, expected] of [
    ["destination", CONTENT.tuning.exclusionRadius],
    ["station", ECONOMY.station.exclusionRadius],
    ["enemy", null],
    ["rock", null],
    ["pickup", null],
  ] as const) {
    const object: SpaceObject = {
      hp: 1,
      id: kind === "enemy" ? "hostileStation" : kind,
      kind,
      radius: 999,
      x: 0,
      y: 0,
    };
    expect(exclusionZoneRadius(CONTENT, object)).toBe(expected);
  }
});
