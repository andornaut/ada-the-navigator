import { describe, expect, it } from "vitest";

import { CONTENT } from "./content.ts";
import type { Weapon } from "./types.ts";
import { WEAPON_CATALOG, weaponAt, type WeaponDefinition } from "./weaponCatalog.ts";

/**
 * Hits per volley on a single target: every bolt or dot of a fan (up close every Scattershot
 * dot hits). A missile or beam hits one target once; blast and range growth are bonuses.
 */
function hits(definition: WeaponDefinition): number {
  return definition.anglesDegrees.length;
}
/** Effective output: damage x fire rate x hits per volley. */
const output = (definition: WeaponDefinition) =>
  (definition.damageRatio / definition.intervalSeconds) * hits(definition);

describe("weapon levels", () => {
  it.each(Object.keys(WEAPON_CATALOG) as Weapon[])(
    "grows %s's single-target output 1.5 times per level",
    (weapon) => {
      const [first, second, third] = WEAPON_CATALOG[weapon].map(output) as [number, number, number];
      expect(second / first).toBeCloseTo(1.5, 9);
      expect(third / first).toBeCloseTo(2.25, 9);
    },
  );

  it("grows the Heavy Missile's blast and the Phaser's range as a bonus", () => {
    // The Heavy Missile's levels are felt through fire rate, with damage keeping the 1.5 steps.
    expect(WEAPON_CATALOG.heavyMissile.map((level) => level.intervalSeconds)).toEqual([
      1.2, 1, 0.8,
    ]);
    expect(WEAPON_CATALOG.heavyMissile.map((level) => level.damageRatio)).toEqual([8, 10, 12]);
    const blasts = WEAPON_CATALOG.heavyMissile.map((level) => level.blastRadius);
    const ranges = WEAPON_CATALOG.phaser.map((level) => level.beamRange);
    expect(blasts).toEqual([60, 72, 85]);
    expect(ranges).toEqual([320, 384, 460.8]);
  });

  it("sets Gameplay's level 1 values", () => {
    const laser = weaponAt("laser", 1);
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
    // The Phaser's 4x damage at a 4x interval matches Laser's single-target output.
    const phaser = weaponAt("phaser", 1);
    expect(phaser).toMatchObject({ beamRange: 320, projectileKind: "beam" });
    expect(phaser.damageRatio).toBe(laser.damageRatio * 4);
    expect(phaser.intervalSeconds).toBeCloseTo(laser.intervalSeconds * 4, 9);
  });

  it("grows each weapon only along its own dimensions", () => {
    const changed = (weapon: Weapon) => {
      const [first, ...rest] = WEAPON_CATALOG[weapon];
      return (Object.keys(first) as (keyof WeaponDefinition)[]).filter((key) =>
        rest.some((level) => JSON.stringify(level[key]) !== JSON.stringify(first[key])),
      );
    };
    expect(changed("laser").sort()).toEqual(["damageRatio", "intervalSeconds", "speedRatio"]);
    expect(changed("rapidMissile").sort()).toEqual(["damageRatio", "intervalSeconds"]);
    expect(changed("heavyMissile").sort()).toEqual([
      "blastRadius",
      "damageRatio",
      "intervalSeconds",
    ]);
    expect(changed("multiLaser").sort()).toEqual(["anglesDegrees", "damageRatio", "speedRatio"]);
    expect(changed("scattershot").sort()).toEqual(["anglesDegrees", "damageRatio"]);
    expect(changed("phaser").sort()).toEqual(["beamRange", "damageRatio"]);
  });

  it("flies Laser bolts at 500, 600 and 700 and Multi-Laser's slower, at 400, 500 and 600", () => {
    const speeds = (weapon: Weapon) =>
      WEAPON_CATALOG[weapon].map(
        (level) => CONTENT.tuning.flight.projectileSpeed * level.speedRatio,
      );
    expect(CONTENT.tuning.flight.projectileSpeed).toBe(600);
    speeds("laser").forEach((speed, index) =>
      expect(speed).toBeCloseTo([500, 600, 700][index]!, 9),
    );
    speeds("multiLaser").forEach((speed, index) =>
      expect(speed).toBeCloseTo([400, 500, 600][index]!, 9),
    );
    // The other projectile weapons keep their ratios at every level.
    expect(speeds("rapidMissile").map((speed) => speed / 600)).toEqual([1.3, 1.3, 1.3]);
    expect(speeds("heavyMissile").map((speed) => speed / 600)).toEqual([0.6, 0.6, 0.6]);
    expect(speeds("scattershot").map((speed) => speed / 600)).toEqual([1, 1, 1]);
  });

  it("clamps levels outside 1 to 3", () => {
    expect(weaponAt("laser", 0)).toBe(WEAPON_CATALOG.laser[0]);
    expect(weaponAt("laser", 9)).toBe(WEAPON_CATALOG.laser[2]);
  });
});
