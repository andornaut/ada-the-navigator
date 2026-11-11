import { describe, expect, it } from "vitest";

import type { Weapon } from "./types.ts";
import { WEAPON_CATALOG, weaponAt, type WeaponDefinition } from "./weapon-catalog.ts";

/** The hull radius a blast must reach past, for its catch radius. */
const HULL = 10;

/**
 * Hits per volley that grow with a level: every bolt or dot of a fan (up close every
 * Scattershot dot hits), a missile blast's catch radius and the Phaser's reach.
 */
function hits(definition: WeaponDefinition): number {
  if (definition.beamRange !== null) {
    return definition.beamRange;
  }
  if (definition.blastRadius !== null) {
    return definition.blastRadius + HULL;
  }
  return definition.anglesDegrees.length;
}
/** Effective output: damage x fire rate x hits per volley. */
const output = (definition: WeaponDefinition) =>
  (definition.damageRatio / definition.intervalSeconds) * hits(definition);

describe("weapon levels", () => {
  it.each(Object.keys(WEAPON_CATALOG) as Weapon[])(
    "grows %s's effective output about 1.5 times per level",
    (weapon) => {
      const [first, second, third] = WEAPON_CATALOG[weapon].map(output) as [number, number, number];
      expect(second / first).toBeCloseTo(1.5, 2);
      expect(third / first).toBeCloseTo(2.25, 2);
    },
  );

  it("sets Gameplay's level 1 values", () => {
    const basic = weaponAt("basic", 1);
    expect(weaponAt("rapidMissile", 1)).toMatchObject({
      blastRadius: 25,
      damageRatio: 1.5,
      intervalSeconds: 0.3,
      speedRatio: 1.3,
    });
    expect([1, 2, 3].map((level) => weaponAt("rapidMissile", level).blastRadius)).toEqual([
      25, 25, 25,
    ]);
    expect(weaponAt("heavyMissile", 1)).toMatchObject({
      damageRatio: 8,
      intervalSeconds: 1.2,
      speedRatio: 0.6,
    });
    expect([1, 2, 3].map((level) => weaponAt("heavyMissile", level).blastRadius)).toEqual([
      60, 72, 85,
    ]);
    // The Phaser's 4x damage at a 4x interval matches Basic's single-target output.
    const phaser = weaponAt("phaser", 1);
    expect(phaser).toMatchObject({ beamRange: 320, projectileKind: "beam" });
    expect(phaser.damageRatio).toBe(basic.damageRatio * 4);
    expect(phaser.intervalSeconds).toBeCloseTo(basic.intervalSeconds * 4, 9);
  });

  it("grows each weapon only along its own dimensions", () => {
    const changed = (weapon: Weapon) => {
      const [first, ...rest] = WEAPON_CATALOG[weapon];
      return (Object.keys(first) as (keyof WeaponDefinition)[]).filter((key) =>
        rest.some((level) => JSON.stringify(level[key]) !== JSON.stringify(first[key])),
      );
    };
    expect(changed("basic").sort()).toEqual(["damageRatio", "intervalSeconds"]);
    expect(changed("rapidMissile").sort()).toEqual(["damageRatio", "intervalSeconds"]);
    expect(changed("heavyMissile").sort()).toEqual(["blastRadius", "damageRatio"]);
    expect(changed("multiLaser").sort()).toEqual(["anglesDegrees", "damageRatio"]);
    expect(changed("scattershot").sort()).toEqual([
      "anglesDegrees",
      "damageRatio",
      "rangeScreenWidths",
    ]);
    expect(changed("phaser").sort()).toEqual(["beamRange", "damageRatio"]);
  });

  it("clamps levels outside 1 to 3", () => {
    expect(weaponAt("basic", 0)).toBe(WEAPON_CATALOG.basic[0]);
    expect(weaponAt("basic", 9)).toBe(WEAPON_CATALOG.basic[2]);
  });
});
