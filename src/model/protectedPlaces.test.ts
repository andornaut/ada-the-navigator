import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { protectedRadius } from "./protectedPlaces.ts";
import type { SpaceObject } from "./types.ts";

it("uses only destination and friendly station protection without protecting hostile actors", () => {
  for (const [kind, expected] of [
    ["destination", CONTENT.tuning.safeRadius],
    ["station", ECONOMY.station.safeRadius],
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
    expect(protectedRadius(CONTENT, object)).toBe(expected);
  }
});
