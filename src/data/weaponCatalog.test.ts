import { describe, expect, it } from "vitest";

import { planPlayerVolley } from "../model/playerProjectiles.ts";
import { CONTENT } from "./content.ts";
import { enemyFire } from "./enemyCatalog.ts";
import { SCREEN } from "./screen.ts";
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
  it.each([
    ["laser", [500, 600, 700], 300],
    ["multiLaser", [400, 400, 400], 240],
    ["rapidMissile", [500, 600, 700], 300],
    ["heavyMissile", [400, 400, 400], 240],
    ["scattershot", [600, 600, 600], 360],
  ] as const)(
    "preserves %s player volley and enemy profile world speeds",
    (weapon, playerSpeeds, enemySpeed) => {
      expect(CONTENT.tuning.flight.projectileSpeed).toBe(600);
      for (const level of [1, 2, 3] as const) {
        const volley = planPlayerVolley(weaponAt(weapon, level), {
          aim: { x: 1, y: 0 },
          baseDamage: CONTENT.tuning.flight.playerShotDamage,
          baseLifetime: CONTENT.tuning.flight.projectileLifetime,
          baseSpeed: CONTENT.tuning.flight.projectileSpeed,
          origin: { x: 0, y: 0 },
          viewportWidth: SCREEN.width,
        });
        expect(volley.projectiles.length).toBeGreaterThan(0);
        for (const shot of volley.projectiles) {
          expect(Math.hypot(shot.velocity.x, shot.velocity.y)).toBeCloseTo(
            playerSpeeds[level - 1]!,
            9,
          );
        }
        // Enemy projectile speeds always use the weapon's level 1 speed.
        expect(enemyFire("fighter", { level, weapon }).projectileSpeed).toBeCloseTo(enemySpeed, 9);
      }
    },
  );

  it.each([
    ["laser", 1.5, 2.25],
    ["phaser", 1.5, 2],
  ] as const)("scales %s's single-target output at levels 2 and 3", (weapon, level2, level3) => {
    const [first, second, third] = WEAPON_CATALOG[weapon].map(output) as [number, number, number];
    expect(second / first).toBeCloseTo(level2, 9);
    expect(third / first).toBeCloseTo(level3, 9);
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
      0.4, 0.4, 0.4,
    ]);
  });

  it("grows Rapid Missile's output by fire rate alone, 1.25 then 5/3 times level 1", () => {
    const [first, second, third] = WEAPON_CATALOG.rapidMissile.map(output) as [
      number,
      number,
      number,
    ];
    expect(second / first).toBeCloseTo(1.25, 9);
    expect(third / first).toBeCloseTo(5 / 3, 9);
    expect(WEAPON_CATALOG.rapidMissile.map((level) => level.damageRatio)).toEqual([2, 2, 2]);
    WEAPON_CATALOG.rapidMissile.forEach((level, index) =>
      expect(level.intervalSeconds).toBe([0.5, 0.4, 0.3][index]),
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
    // Heavy output is 2.5, 3.5 and 4.5 damage per second.
    WEAPON_CATALOG.heavyMissile.forEach((level, index) =>
      expect(perSecond(level)).toBeCloseTo([2.5, 3.5, 4.5][index]!, 9),
    );
    WEAPON_CATALOG.rapidMissile.forEach((level, index) =>
      expect(perSecond(level)).toBeCloseTo([4, 5, 20 / 3][index]!, 9),
    );
  });

  it("keeps the Heavy Missile's blast at 60 and the Phaser's range at 370", () => {
    // The Heavy Missile fires every 2 s at every level; only its damage grows.
    expect(WEAPON_CATALOG.heavyMissile.map((level) => level.intervalSeconds)).toEqual([2, 2, 2]);
    expect(WEAPON_CATALOG.heavyMissile.map((level) => level.damageRatio)).toEqual([5, 7, 9]);
    const blasts = WEAPON_CATALOG.heavyMissile.map((level) => level.blastRadius);
    const ranges = WEAPON_CATALOG.phaser.map((level) => level.beamRange);
    expect(blasts).toEqual([60, 60, 60]);
    expect(ranges).toEqual([370, 370, 370]);
  });

  it("sets Gameplay's level 1 values", () => {
    const laser = weaponAt("laser", 1);
    expect(weaponAt("rapidMissile", 1)).toMatchObject({
      blastRadius: 30,
      damageRatio: 2,
      intervalSeconds: 0.5,
    });
    expect([1, 2, 3].map((level) => weaponAt("rapidMissile", level).blastRadius)).toEqual([
      30, 30, 30,
    ]);
    expect(weaponAt("heavyMissile", 1)).toMatchObject({
      damageRatio: 5,
      intervalSeconds: 2,
      rangeWorld: 220,
    });
    expect(CONTENT.tuning.flight.projectileSpeed * weaponAt("heavyMissile", 1).speedRatio).toBe(
      400,
    );
    expect([1, 2, 3].map((level) => weaponAt("heavyMissile", level).blastRadius)).toEqual([
      60, 60, 60,
    ]);
    // The Phaser deals 4, 6 and 8 Laser damage every two seconds.
    const phaser = weaponAt("phaser", 1);
    expect(phaser).toMatchObject({ beamRange: 370, intervalSeconds: 2, projectileKind: "beam" });
    expect(phaser.damageRatio).toBe(laser.damageRatio * 4);
    expect(WEAPON_CATALOG.phaser.map((level) => level.damageRatio)).toEqual([4, 6, 8]);
    // Scattershot volleys deal 8.8, 14 and 21.6 across 11, 14 and 18 pellets.
    const volley = (level: WeaponDefinition) => level.damageRatio * level.anglesDegrees.length;
    const [dot1, dot2, dot3] = WEAPON_CATALOG.scattershot;
    for (const dot of WEAPON_CATALOG.scattershot) {
      expect(dot).toMatchObject({ fadeStartFraction: 0.65, intervalSeconds: 1, rangeWorld: 100 });
    }
    expect(dot1!.damageRatio).toBeCloseTo(0.8, 9);
    expect(volley(dot1!)).toBeCloseTo(8.8, 9);
    expect(volley(dot2!)).toBeCloseTo(14, 9);
    expect(volley(dot3!)).toBeCloseTo(21.6, 9);
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
    expect(changed("multiLaser").sort()).toEqual(["anglesDegrees"]);
    expect(changed("scattershot").sort()).toEqual(["anglesDegrees", "damageRatio", "pelletDelays"]);
    expect(changed("phaser").sort()).toEqual(["damageRatio"]);
  });

  it("flies Laser bolts at 500, 600 and 700 and Multi-Laser bolts at 400 at every level", () => {
    const speeds = (weapon: Weapon) =>
      WEAPON_CATALOG[weapon].map(
        (level) => CONTENT.tuning.flight.projectileSpeed * level.speedRatio,
      );
    expect(CONTENT.tuning.flight.projectileSpeed).toBe(600);
    speeds("laser").forEach((speed, index) =>
      expect(speed).toBeCloseTo([500, 600, 700][index]!, 9),
    );
    speeds("multiLaser").forEach((speed) => expect(speed).toBeCloseTo(400, 9));
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
    [3.33, 1.75, 4, 2.5, 8.8, 2].forEach((value, index) =>
      expect(ladder[index]).toBeCloseTo(value, 1),
    );
    // Multi-Laser's full fan of 3 bolts deals 5.25 a second, more than Laser.
    expect(perSecond("multiLaser")).toBeCloseTo(5.25, 9);
    expect(perSecond("multiLaser")).toBeGreaterThan(perSecond("laser"));
  });

  it("keeps the approved weapon-specific level 1 damage outputs", () => {
    const perSecond = (weapon: Weapon, hits = WEAPON_CATALOG[weapon][0].anglesDegrees.length) =>
      (WEAPON_CATALOG[weapon][0].damageRatio * hits) / WEAPON_CATALOG[weapon][0].intervalSeconds;
    const ladder = [
      perSecond("multiLaser", 1),
      perSecond("rapidMissile"),
      perSecond("heavyMissile"),
      perSecond("scattershot"),
      perSecond("phaser"),
    ];
    [1.75, 4, 2.5, 8.8, 2].forEach((expected, index) =>
      expect(ladder[index]).toBeCloseTo(expected, 9),
    );
    expect(perSecond("laser")).toBeGreaterThan(perSecond("multiLaser", 1));
    expect(perSecond("laser")).toBeLessThan(perSecond("multiLaser"));
  });

  it("clamps levels outside 1 to 3", () => {
    expect(weaponAt("laser", 0)).toBe(WEAPON_CATALOG.laser[0]);
    expect(weaponAt("laser", 9)).toBe(WEAPON_CATALOG.laser[2]);
  });
});
