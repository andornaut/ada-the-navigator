import { describe, expect, it } from "vitest";

import { ENEMY_NAVIGATION } from "../data/enemyCatalog.ts";
import { enemyAssetKey, INDUSTRIAL_BODY_KEYS, retaliatorVariant } from "../data/enemyIdentity.ts";
import { enemyRandom } from "../data/enemyRandom.ts";
import { retaliatorNavigation, type RetaliatorNavigationContext } from "./retaliatorNavigation.ts";
import { worldDistance } from "./worldContacts.ts";

const context: RetaliatorNavigationContext = {
  asteroids: [],
  navigation: ENEMY_NAVIGATION,
  physicalReach: 20,
  pursuit: { homeRadius: 2000 },
};
function actor(variant: (typeof INDUSTRIAL_BODY_KEYS)[number]) {
  for (let index = 0; index < 100; index++) {
    const value = {
      archetype: "retaliator" as const,
      home: { x: 0, y: 0 },
      id: `industrial:${index}`,
    };
    if (retaliatorVariant(value) === variant) {
      return value;
    }
  }
  throw Error("Missing variant fixture");
}
const cargo = actor("retaliatorCargoHauler");
const miner = actor("retaliatorMiningFreighter");
describe("industrial idle navigation", () => {
  it("rolls the three hulls from the asset identity stream and keeps identity fallbacks", () => {
    for (let index = 0; index < 100; index++) {
      const id = `industrial:${index}`;
      // The Manta gunship, then the two industrial bodies, with equal weight.
      const body = [undefined, ...INDUSTRIAL_BODY_KEYS][
        Math.floor(enemyRandom(`retaliator-body:${id}`)() * 3)
      ];
      const identity = { archetype: "retaliator" as const, id };
      expect(enemyAssetKey(identity)).toBe(body ?? "retaliator");
      expect(retaliatorVariant(identity)).toBe(body);
    }
    expect(enemyAssetKey({ archetype: "retaliator" })).toBe("retaliator");
    expect(enemyAssetKey({ archetype: "capital", id: "phantomFlagship" })).toBe("gadget");
    expect(retaliatorNavigation(context, { ...miner, id: "" })).toBeUndefined();
    expect(retaliatorNavigation(context, { ...miner, archetype: "fighter" })).toBeUndefined();
  });
  it("extends cargo loops using existing approach tuning without exceeding leash or wrapped reach", () => {
    const plan = retaliatorNavigation(context, cargo)!;
    expect(plan).toEqual({ anchor: cargo.home, patrolRadius: [260, 330] });
    expect(plan.anchor).not.toBe(cargo.home);
    expect(
      retaliatorNavigation({ ...context, pursuit: { homeRadius: 400 } }, cargo)?.patrolRadius,
    ).toEqual([200, 200]);
    expect(retaliatorNavigation({ ...context, worldSide: 1000 }, cargo)?.patrolRadius).toEqual([
      250, 250,
    ]);
  });
  it("chooses nearest usable real asteroid and clears its full physical footprint", () => {
    const asteroids = [
      { id: "far", physicalReach: 40, position: { x: 1000, y: 0 } },
      { id: "near", physicalReach: 40, position: { x: 700, y: 0 } },
    ];
    const plan = retaliatorNavigation({ ...context, asteroids }, miner)!;
    expect(plan).toEqual({ anchor: { x: 260, y: 0 }, patrolRadius: [80, 150] });
    expect(worldDistance(context, plan.anchor, asteroids[1]!.position) - 300).toBe(140);
    expect(worldDistance(context, miner.home, plan.anchor) + 300).toBeLessThanOrEqual(2000);
    expect(
      retaliatorNavigation({ ...context, asteroids: [...asteroids].reverse() }, miner),
    ).toEqual(plan);
  });
  it("breaks equal-distance ties by stable ID independently of candidate order", () => {
    const asteroids = [
      { id: "b", physicalReach: 40, position: { x: 0, y: 700 } },
      { id: "a", physicalReach: 40, position: { x: 700, y: 0 } },
    ];
    const plan = retaliatorNavigation({ ...context, asteroids }, miner);
    expect(plan?.anchor).toEqual({ x: 260, y: 0 });
    expect(
      retaliatorNavigation({ ...context, asteroids: [...asteroids].reverse() }, miner),
    ).toEqual(plan);
  });
  it("projects toroidal candidates near home while retaining the same physical clearance", () => {
    const wrapped = {
      ...context,
      asteroids: [{ id: "across", physicalReach: 40, position: { x: -4800, y: 0 } }],
      worldSide: 10000,
    };
    const subject = { ...miner, home: { x: 4500, y: 0 } };
    expect(retaliatorNavigation(wrapped, subject)?.anchor).toEqual({ x: 4760, y: 0 });
  });
  it("falls back to home for absent, overlapping, invalid or unreachable asteroids without mutation", () => {
    const asteroids = [
      { id: "overlap", physicalReach: 40, position: { x: 100, y: 0 } },
      { id: "outside", physicalReach: 40, position: { x: 3000, y: 0 } },
      { id: "invalid", physicalReach: -1, position: { x: 700, y: 0 } },
    ];
    const before = JSON.stringify({ asteroids, context, miner });
    const fallback = { anchor: miner.home, patrolRadius: [80, 150] };
    expect(retaliatorNavigation(context, miner)).toEqual(fallback);
    expect(retaliatorNavigation({ ...context, asteroids }, miner)).toEqual(fallback);
    expect(JSON.stringify({ asteroids, context, miner })).toBe(before);
  });
});
