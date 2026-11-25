import { describe, expect, it } from "vitest";

import { ENEMY_NAVIGATION } from "../data/enemyCatalog.ts";
import { enemyAssetKey, INDUSTRIAL_BODY_KEYS, retaliatorVariant } from "../data/enemyIdentity.ts";
import { enemyRandom } from "../data/enemyRandom.ts";
import { retaliatorNavigation, type RetaliatorNavigationContext } from "./retaliatorNavigation.ts";

const context: RetaliatorNavigationContext = {
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
    expect(enemyAssetKey({ archetype: "capital", id: "phantomFlagship" })).toBe("archie");
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
  it("patrols the Mining Freighter around home, its asteroid work being edge tracing", () => {
    const before = JSON.stringify({ context, miner });
    expect(retaliatorNavigation(context, miner)).toEqual({
      anchor: miner.home,
      patrolRadius: [80, 150],
    });
    expect(JSON.stringify({ context, miner })).toBe(before);
  });
});
