import { expect, it } from "vitest";

import {
  ENEMY_FIRE,
  ENEMY_ONLY_DAMAGE,
  enemyDefinition,
  enemyFire,
  fireDamageRatio,
  PHANTOM_FLAGSHIP_ID,
} from "./enemyCatalog.ts";
import { ENEMY_SHARED_WEAPON_TUNING } from "./enemyWeaponLevels.ts";
import type { Weapon } from "./types.ts";
import { WEAPON_CATALOG, weaponAt, weaponSpeed } from "./weaponCatalog.ts";

it("uses equipped player intervals and damage while retaining the level-one projectile speed policy", () => {
  for (const weapon of Object.keys(WEAPON_CATALOG) as Weapon[]) {
    for (const level of [1, 2, 3] as const) {
      const fire = enemyFire("fighter", { level, weapon });
      const player = weaponAt(weapon, level);
      expect(fire.interval).toBe(player.intervalSeconds);
      expect(ENEMY_SHARED_WEAPON_TUNING.damageMultiplier).toBe(1);
      expect(fireDamageRatio(fire)).toBe(player.damageRatio);
      expect(fire.projectileSpeed).toBe(weaponSpeed(weapon, 1) * 0.6);
    }
  }
});

it.each([
  [1, 0.25, 0.4, 4],
  [3, 0.25, 0.4, 4],
  [4, 0.35, 0.5, 3],
  [5, 0.35, 0.5, 3],
  [2, 0.45, 0.6, 2],
  [6, 0.45, 0.6, 2],
] as const)(
  "uses the approved absolute mount rates in galaxy %i",
  (galaxy, standard, faster, lanceSeconds) => {
    for (const level of [1, 2, 3] as const) {
      const check = (fire: ReturnType<typeof enemyFire>, weapon: Weapon, rate: number) => {
        expect(fire.weapon).toBe(weapon);
        expect(fire.level).toBe(level);
        expect(fire.interval).toBeCloseTo(weaponAt(weapon, level).intervalSeconds / rate, 12);
      };
      check(enemyDefinition(galaxy, "swarm", "", level).fire, "laser", standard);
      check(enemyDefinition(galaxy, "fighter", "", level).fire, "multiLaser", standard);
      check(enemyDefinition(galaxy, "interceptor", "", level).fire, "phaser", standard);
      check(enemyDefinition(galaxy, "retaliator", "", level).fire, "rapidMissile", faster);

      const frigate = enemyDefinition(galaxy, "frigate", "", level).hardpoints;
      const lasers = frigate.filter(
        (part) => part.kind === "weapon" && part.fire.weapon === "laser",
      );
      const launcher = frigate.find(
        (part) => part.kind === "weapon" && part.fire.weapon === "heavyMissile",
      );
      expect(lasers.length).toBeGreaterThan(0);
      expect(launcher?.kind).toBe("weapon");
      if (launcher?.kind === "weapon") {
        check(launcher.fire, "heavyMissile", faster);
      }
      for (const part of lasers) {
        if (part.kind === "weapon") {
          check(part.fire, "laser", standard);
        }
      }

      const platform = enemyDefinition(galaxy, "platform", "", level).hardpoints;
      for (const part of platform) {
        if (part.kind === "weapon") {
          check(part.fire, "laser", faster);
          expect(part.fire.burst).toEqual({ count: 2, gap: 0.15 });
        }
      }

      const capitalIds = galaxy === 6 ? ["", PHANTOM_FLAGSHIP_ID] : [""];
      for (const id of capitalIds) {
        const capital = enemyDefinition(galaxy, "capital", id, level);
        const shared = capital.hardpoints.flatMap((part) =>
          part.kind === "weapon" &&
          (part.fire.weapon === "laser" || part.fire.weapon === "scattershot")
            ? [part.fire]
            : [],
        );
        expect(shared.map(({ weapon }) => weapon)).toEqual(
          expect.arrayContaining(["laser", "scattershot"]),
        );
        for (const fire of shared) {
          check(
            fire,
            fire.weapon as "laser" | "scattershot",
            fire.weapon === "laser" ? standard : faster,
          );
        }
        const special = capital.hardpoints.find(
          (part) =>
            part.kind === "weapon" &&
            (part.fire.weapon === "chargedLance" || part.fire.weapon === "mineLayer"),
        );
        expect(special?.kind).toBe("weapon");
        if (special?.kind === "weapon") {
          expect(special.fire.level).toBe(1);
          expect(special.fire.interval).toBe(
            special.fire.weapon === "mineLayer" ? 2 : lanceSeconds,
          );
        }
      }

      if (galaxy === 5 || galaxy === 2 || galaxy === 6) {
        const station = enemyDefinition(galaxy, "hostileStation", "", level);
        const launchers = station.hardpoints.filter(
          (part) => part.kind === "weapon" && part.fire.weapon === "rapidMissile",
        );
        expect(launchers.length).toBeGreaterThan(0);
        const ring = station.hardpoints.find((part) => part.id === "weapon-5");
        expect(ring).toMatchObject({
          fire: { interval: galaxy === 5 ? 3 : 2, level: 1, weapon: "ringBurst" },
          kind: "weapon",
        });
        for (const part of launchers) {
          if (part.kind === "weapon") {
            check(part.fire, "rapidMissile", standard);
          }
        }
      }
    }
  },
);

it("keeps enemy-only damage and the level-one policy independent of cadence", () => {
  expect(ENEMY_ONLY_DAMAGE).toEqual({ chargedLance: 6, mineLayer: 3, ringBurst: 1.5 });
  for (const weapon of ["chargedLance", "mineLayer", "ringBurst"] as const) {
    const fire = enemyFire("capital", { level: 3, weapon });
    expect(fire.level).toBe(1);
    expect(fire.interval).toBe(ENEMY_FIRE[weapon].interval);
    expect(fireDamageRatio(fire)).toBe(ENEMY_ONLY_DAMAGE[weapon]);
  }
});
