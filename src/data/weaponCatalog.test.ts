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
  it.each(
    (Object.keys(WEAPON_CATALOG) as Weapon[]).filter(
      (weapon) => weapon !== "rapidMissile" && weapon !== "multiLaser",
    ),
  )("grows %s's single-target output 1.5 times per level", (weapon) => {
    const [first, second, third] = WEAPON_CATALOG[weapon].map(output) as [number, number, number];
    expect(second / first).toBeCloseTo(1.5, 9);
    expect(third / first).toBeCloseTo(2.25, 9);
  });

  it("grows Multi-Laser's output by bolts alone, 4/3 then 5/3 times level 1", () => {
    const [first, second, third] = WEAPON_CATALOG.multiLaser.map(output) as [
      number,
      number,
      number,
    ];
    expect(second / first).toBeCloseTo(4 / 3, 9);
    expect(third / first).toBeCloseTo(5 / 3, 9);
    expect(WEAPON_CATALOG.multiLaser.map((level) => level.damageRatio)).toEqual([0.7, 0.7, 0.7]);
    expect(WEAPON_CATALOG.multiLaser.map((level) => level.intervalSeconds)).toEqual([
      0.3, 0.3, 0.3,
    ]);
  });

  it("grows Rapid Missile's output by fire rate alone, 1.2 then 1.5 times level 1", () => {
    const [first, second, third] = WEAPON_CATALOG.rapidMissile.map(output) as [
      number,
      number,
      number,
    ];
    expect(second / first).toBeCloseTo(1.2, 9);
    expect(third / first).toBeCloseTo(1.5, 9);
    expect(WEAPON_CATALOG.rapidMissile.map((level) => level.damageRatio)).toEqual([1.5, 1.5, 1.5]);
    WEAPON_CATALOG.rapidMissile.forEach((level, index) =>
      expect(level.intervalSeconds).toBeCloseTo([0.3, 0.25, 0.2][index]!, 9),
    );
  });

  it("makes Rapid Missile faster and Heavy Missile more damaging per hit at every level", () => {
    const perSecond = (level: WeaponDefinition) => level.damageRatio / level.intervalSeconds;
    for (const index of [0, 1, 2]) {
      const rapid = WEAPON_CATALOG.rapidMissile[index]!;
      const heavy = WEAPON_CATALOG.heavyMissile[index]!;
      expect(rapid.speedRatio).toBeGreaterThan(heavy.speedRatio);
      expect(rapid.intervalSeconds).toBeLessThan(heavy.intervalSeconds);
      expect(heavy.damageRatio).toBeGreaterThan(rapid.damageRatio);
    }
    // Rapid ties Heavy at level 1 (5 a second); Heavy deals more at levels 2 and 3 (7.5 against
    // 6, 11.25 against 7.5).
    WEAPON_CATALOG.heavyMissile.forEach((level, index) =>
      expect(perSecond(level)).toBeCloseTo([5, 7.5, 11.25][index]!, 9),
    );
    WEAPON_CATALOG.rapidMissile.forEach((level, index) =>
      expect(perSecond(level)).toBeCloseTo([5, 6, 7.5][index]!, 9),
    );
  });

  it("keeps the Heavy Missile's blast at 50 and the Phaser's range at 370", () => {
    // The Heavy Missile fires every 2 s at every level; damage alone makes its 1.5 steps.
    expect(WEAPON_CATALOG.heavyMissile.map((level) => level.intervalSeconds)).toEqual([2, 2, 2]);
    expect(WEAPON_CATALOG.heavyMissile.map((level) => level.damageRatio)).toEqual([10, 15, 22.5]);
    const blasts = WEAPON_CATALOG.heavyMissile.map((level) => level.blastRadius);
    const ranges = WEAPON_CATALOG.phaser.map((level) => level.beamRange);
    expect(blasts).toEqual([50, 50, 50]);
    expect(ranges).toEqual([370, 370, 370]);
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
      damageRatio: 10,
      intervalSeconds: 2,
      rangeWorld: 220,
    });
    expect(CONTENT.tuning.flight.projectileSpeed * weaponAt("heavyMissile", 1).speedRatio).toBe(
      400,
    );
    expect([1, 2, 3].map((level) => weaponAt("heavyMissile", level).blastRadius)).toEqual([
      50, 50, 50,
    ]);
    // The Phaser deals 6.5x Laser damage once a second, then 9.75 and 14.625.
    const phaser = weaponAt("phaser", 1);
    expect(phaser).toMatchObject({ beamRange: 370, intervalSeconds: 1, projectileKind: "beam" });
    expect(phaser.damageRatio).toBe(laser.damageRatio * 6.5);
    expect(WEAPON_CATALOG.phaser.map((level) => level.damageRatio)).toEqual([6.5, 9.75, 14.625]);
    // A level 1 Scattershot volley deals 6 every 1 s within 100, fading from 65%; levels 2 and 3
    // share 9 and 13.5 across their 9 and 11 dots.
    const volley = (level: WeaponDefinition) => level.damageRatio * level.anglesDegrees.length;
    const [dot1, dot2, dot3] = WEAPON_CATALOG.scattershot;
    for (const dot of WEAPON_CATALOG.scattershot) {
      expect(dot).toMatchObject({ fadeStartFraction: 0.65, intervalSeconds: 1, rangeWorld: 100 });
    }
    expect(dot1!.damageRatio).toBeCloseTo(6 / 7, 9);
    expect(volley(dot1!)).toBeCloseTo(6, 9);
    expect(volley(dot2!)).toBeCloseTo(9, 9);
    expect(volley(dot3!)).toBeCloseTo(13.5, 9);
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
    expect(changed("heavyMissile").sort()).toEqual(["damageRatio"]);
    expect(changed("multiLaser").sort()).toEqual(["anglesDegrees", "speedRatio"]);
    expect(changed("scattershot").sort()).toEqual(["anglesDegrees", "damageRatio"]);
    expect(changed("phaser").sort()).toEqual(["damageRatio"]);
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
    // Each bolt reaches 370 at every level; its lifetime follows from its speed.
    for (const weapon of ["laser", "multiLaser"] as const) {
      expect(
        WEAPON_CATALOG[weapon].map(({ fadeStartFraction, rangeWorld }) => [
          rangeWorld,
          fadeStartFraction,
        ]),
      ).toEqual([
        [370, null],
        [370, null],
        [370, null],
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

  it("sets each weapon's level 1 single-target damage per second", () => {
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
    [3.33, 2.33, 5, 5, 6.0, 6.5].forEach((value, index) =>
      expect(ladder[index]).toBeCloseTo(value, 1),
    );
    // Multi-Laser's full fan of 3 bolts deals 7 a second, more than Laser.
    expect(perSecond("multiLaser")).toBeCloseTo(7, 9);
    expect(perSecond("multiLaser")).toBeGreaterThan(perSecond("laser"));
  });

  it("clamps levels outside 1 to 3", () => {
    expect(weaponAt("laser", 0)).toBe(WEAPON_CATALOG.laser[0]);
    expect(weaponAt("laser", 9)).toBe(WEAPON_CATALOG.laser[2]);
  });
});
