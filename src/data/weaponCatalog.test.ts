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
  it.each((Object.keys(WEAPON_CATALOG) as Weapon[]).filter((weapon) => weapon !== "rapidMissile"))(
    "grows %s's single-target output 1.5 times per level",
    (weapon) => {
      const [first, second, third] = WEAPON_CATALOG[weapon].map(output) as [number, number, number];
      expect(second / first).toBeCloseTo(1.5, 9);
      expect(third / first).toBeCloseTo(2.25, 9);
    },
  );

  it("grows Rapid Missile's output by fire rate alone, 1.2 then 1.5 times level 1", () => {
    const [first, second, third] = WEAPON_CATALOG.rapidMissile.map(output) as [
      number,
      number,
      number,
    ];
    expect(second / first).toBeCloseTo(1.2, 9);
    expect(third / first).toBeCloseTo(1.5, 9);
    expect(WEAPON_CATALOG.rapidMissile.map((level) => level.damageRatio)).toEqual([1.5, 1.5, 1.5]);
    expect(WEAPON_CATALOG.rapidMissile.map((level) => level.intervalSeconds)).toEqual([
      0.3, 0.25, 0.2,
    ]);
  });

  it("makes Rapid Missile faster and Heavy Missile more damaging at every level", () => {
    for (const index of [0, 1, 2]) {
      const rapid = WEAPON_CATALOG.rapidMissile[index]!;
      const heavy = WEAPON_CATALOG.heavyMissile[index]!;
      expect(rapid.speedRatio).toBeGreaterThan(heavy.speedRatio);
      expect(rapid.intervalSeconds).toBeLessThan(heavy.intervalSeconds);
      expect(heavy.damageRatio).toBeGreaterThan(rapid.damageRatio);
      expect(heavy.damageRatio / heavy.intervalSeconds).toBeGreaterThan(
        rapid.damageRatio / rapid.intervalSeconds,
      );
    }
  });

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
    });
    expect([1, 2, 3].map((level) => weaponAt("rapidMissile", level).blastRadius)).toEqual([
      25, 25, 25,
    ]);
    expect(weaponAt("heavyMissile", 1)).toMatchObject({
      damageRatio: 8,
      intervalSeconds: 1.2,
    });
    expect([1, 2, 3].map((level) => weaponAt("heavyMissile", level).blastRadius)).toEqual([
      60, 72, 85,
    ]);
    // The Phaser deals 9x Laser damage at a 4x interval, then 13.5 and 20.25.
    const phaser = weaponAt("phaser", 1);
    expect(phaser).toMatchObject({ beamRange: 320, projectileKind: "beam" });
    expect(phaser.damageRatio).toBe(laser.damageRatio * 9);
    expect(phaser.intervalSeconds).toBeCloseTo(laser.intervalSeconds * 4, 9);
    expect(WEAPON_CATALOG.phaser.map((level) => level.damageRatio)).toEqual([9, 13.5, 20.25]);
    // A level 1 Scattershot dot deals 0.46; levels 2 and 3 share 1.5 and 2.25 times that volley.
    const volley = (level: WeaponDefinition) => level.damageRatio * level.anglesDegrees.length;
    const [dot1, dot2, dot3] = WEAPON_CATALOG.scattershot;
    expect(dot1!.damageRatio).toBe(0.46);
    expect(volley(dot2!) / volley(dot1!)).toBeCloseTo(1.5, 9);
    expect(volley(dot3!) / volley(dot1!)).toBeCloseTo(2.25, 9);
  });

  it("grows each weapon only along its own dimensions", () => {
    const changed = (weapon: Weapon) => {
      const [first, ...rest] = WEAPON_CATALOG[weapon];
      return (Object.keys(first) as (keyof WeaponDefinition)[]).filter((key) =>
        rest.some((level) => JSON.stringify(level[key]) !== JSON.stringify(first[key])),
      );
    };
    expect(changed("laser").sort()).toEqual(["damageRatio", "intervalSeconds", "speedRatio"]);
    expect(changed("rapidMissile").sort()).toEqual(["intervalSeconds", "speedRatio"]);
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
    // Each bolt reaches 1200 at every level; its lifetime follows from its speed.
    for (const weapon of ["laser", "multiLaser"] as const) {
      expect(
        WEAPON_CATALOG[weapon].map(({ fadeStartFraction, rangeWorld }) => [
          rangeWorld,
          fadeStartFraction,
        ]),
      ).toEqual([
        [1200, null],
        [1200, null],
        [1200, null],
      ]);
    }
    // Each missile reaches 220 at every level; its lifetime follows from its speed.
    for (const weapon of ["rapidMissile", "heavyMissile"] as const) {
      expect(
        WEAPON_CATALOG[weapon].map(({ fadeStartFraction, rangeWorld }) => [
          rangeWorld,
          fadeStartFraction,
        ]),
      ).toEqual([
        [220, null],
        [220, null],
        [220, null],
      ]);
    }
    // The other projectile weapons keep their ratios at every level.
    speeds("rapidMissile").forEach((speed, index) =>
      expect(speed).toBeCloseTo([500, 600, 700][index]!, 9),
    );
    speeds("heavyMissile").forEach((speed) => expect(speed).toBeCloseTo(400, 9));
    expect(speeds("scattershot").map((speed) => speed / 600)).toEqual([1, 1, 1]);
  });

  it("orders the weapons by level 1 single-target damage per second", () => {
    // Every bolt or dot of a fan hitting, except Multi-Laser's, counted per bolt.
    const perSecond = (weapon: Weapon, hits = WEAPON_CATALOG[weapon][0].anglesDegrees.length) =>
      (WEAPON_CATALOG[weapon][0].damageRatio * hits) / WEAPON_CATALOG[weapon][0].intervalSeconds;
    const ladder = [
      perSecond("laser"),
      perSecond("multiLaser", 1),
      perSecond("rapidMissile"),
      perSecond("heavyMissile"),
      perSecond("scattershot"),
      perSecond("phaser"),
    ];
    [3.6, 3.3, 5, 6.7, 7.2, 8.0].forEach((value, index) =>
      expect(ladder[index]).toBeCloseTo(value, 1),
    );
    // Above Laser, each weapon in weapon order is stronger than the one before it.
    for (let index = 3; index < ladder.length; index++) {
      expect(ladder[index]!).toBeGreaterThan(ladder[index - 1]!);
    }
    expect(perSecond("multiLaser")).toBeGreaterThan(perSecond("laser"));
  });

  it("clamps levels outside 1 to 3", () => {
    expect(weaponAt("laser", 0)).toBe(WEAPON_CATALOG.laser[0]);
    expect(weaponAt("laser", 9)).toBe(WEAPON_CATALOG.laser[2]);
  });
});
