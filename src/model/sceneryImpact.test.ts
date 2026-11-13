import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { sceneryImpact } from "./sceneryImpact.ts";
import type { ObjectKind } from "./types.ts";

const tuning = CONTENT.tuning.flight;
const ship = Object.freeze({ shield: 10, time: 1 });

describe("scenery impact admission", () => {
  it.each(["rock", "resource", "debris"] as const)(
    "admits one basic Laser hit against live %s",
    (kind) => {
      const obstacle = Object.freeze({ hp: 3, kind });
      expect(sceneryImpact(tuning, ship, obstacle)).toEqual({ amount: 1, damageObstacle: true });
      expect(ship).toEqual({ shield: 10, time: 1 });
      expect(obstacle).toEqual({ hp: 3, kind });
    },
  );

  it("retains the exact shared half-second repeat policy", () => {
    const obstacle = { hp: 3, kind: "rock" as const };
    expect(sceneryImpact(tuning, { ...ship, lastBump: 0.6 }, obstacle)).toBeNull();
    expect(sceneryImpact(tuning, { ...ship, lastBump: 0.5 }, obstacle)).toEqual({
      amount: 1,
      damageObstacle: true,
    });
  });

  it.each([
    "station",
    "destination",
    "enemy",
    "hazard",
    "pickup",
    "wreck",
  ] as const satisfies readonly ObjectKind[])(
    "never makes a %s a destructible scenery target",
    (kind) => expect(sceneryImpact(tuning, ship, { hp: 1, kind })).toBeNull(),
  );

  it("preserves Ada's impact against indestructible scenery without giving it finite HP", () => {
    expect(sceneryImpact(tuning, ship, { hp: Infinity, kind: "rock" })).toEqual({
      amount: 1,
      damageObstacle: false,
    });
  });

  it("admits neither dead obstacles nor a second impact after Ada's shield depletes", () => {
    expect(sceneryImpact(tuning, ship, { hp: 0, kind: "rock" })).toBeNull();
    expect(sceneryImpact(tuning, { shield: 0, time: 1 }, { hp: 3, kind: "rock" })).toBeNull();
  });
});
