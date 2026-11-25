import { expect, it } from "vitest";

import {
  ENEMY_FIRE,
  ENEMY_ONLY_DAMAGE,
  enemyFire,
  enemyFireRate,
  fireDamageRatio,
} from "./enemyCatalog.ts";
import { ENEMY_SHARED_WEAPON_TUNING } from "./enemyWeaponLevels.ts";
import { ROUTE } from "./galaxies.ts";
import type { GalaxyNumber, Weapon, WeaponLevel } from "./types.ts";
import { WEAPON_CATALOG, weaponAt, weaponSpeed } from "./weaponCatalog.ts";

it("maps the approved shared fire-rate shares through route order rather than galaxy ids", () => {
  expect(ROUTE.map((galaxy) => enemyFireRate(galaxy, "fighter", "laser"))).toEqual([
    0.25, 0.25, 0.3, 0.3, 0.35, 0.35,
  ]);
  expect(enemyFireRate(2, "hostileStation", "rapidMissile")).toBe(0.35);
  expect(enemyFireRate(3, "hostileStation", "rapidMissile")).toBe(0.25);
  expect(ENEMY_SHARED_WEAPON_TUNING.damageMultiplier).toBe(1);
});

it("uses equipped player intervals and damage while retaining the level-one projectile speed policy", () => {
  for (const weapon of Object.keys(WEAPON_CATALOG) as Weapon[]) {
    for (const level of [1, 2, 3] as const) {
      const fire = enemyFire("fighter", { level, weapon });
      const player = weaponAt(weapon, level);
      expect(fire.interval / enemyFireRate(2, "fighter", weapon)).toBe(
        player.intervalSeconds / 0.35,
      );
      expect(fireDamageRatio(fire)).toBe(player.damageRatio);
      expect(fire.projectileSpeed).toBe(weaponSpeed(weapon, 1) * 0.6);
    }
  }
});

it("preserves ship modifiers, relative swarm and industrial cadence, and platform burst gaps", () => {
  expect(enemyFireRate(1, "frigate", "laser")).toBe(0.25);
  expect(enemyFireRate(1, "frigate", "heavyMissile")).toBe(0.5);
  expect(enemyFireRate(1, "capital", "scattershot")).toBe(0.375);
  expect(enemyFireRate(1, "platform", "laser")).toBe(0.375);
  expect(enemyFireRate(1, "swarm", "laser") / enemyFireRate(1, "fighter", "laser")).toBe(7 / 9);
  expect(enemyFireRate(1, "retaliator", "rapidMissile")).toBe(0.25 * (5 / 4));
  expect(enemyFire("platform", { level: 3, weapon: "laser" }).burst).toEqual({
    count: 2,
    gap: 0.15,
  });
  const rapid1 = enemyFire("retaliator", { level: 1, weapon: "rapidMissile" });
  const rapid3 = enemyFire("retaliator", { level: 3, weapon: "rapidMissile" });
  expect(rapid3.interval / rapid1.interval).toBeCloseTo(2 / 3, 12);
});

it("fires frigate Lasers at ship rate 1 and the frigate Heavy Missile at ship rate 2", () => {
  const interval = (
    galaxy: GalaxyNumber,
    archetype: "capital" | "frigate",
    level: WeaponLevel,
    weapon: Weapon,
  ) => enemyFire(archetype, { level, weapon }).interval / enemyFireRate(galaxy, archetype, weapon);
  // Phantom shares 35% of the player rate and Sunflower 25%.
  expect(interval(6, "frigate", 3, "laser")).toBeCloseTo(0.57, 2);
  expect(interval(1, "frigate", 1, "laser")).toBeCloseTo(1.2, 2);
  expect(interval(1, "frigate", 1, "heavyMissile")).toBeCloseTo(2 / (0.25 * 2), 12);
  expect(interval(6, "capital", 3, "scattershot")).toBeCloseTo(1 / (0.35 * 1.5), 12);
});

it("retains enemy-only level-one intervals, damage and the existing galaxy curve", () => {
  expect(ENEMY_FIRE).toEqual({
    chargedLance: { interval: 6 },
    mineLayer: { interval: 5 },
    ringBurst: { interval: 3.5 },
  });
  for (const weapon of ["chargedLance", "mineLayer", "ringBurst"] as const) {
    const fire = enemyFire("capital", { level: 3, weapon });
    expect(fire.level).toBe(1);
    expect(fire.interval).toBe(ENEMY_FIRE[weapon].interval);
    expect(enemyFireRate(6, "capital", weapon)).toBe(2 * 1.5);
    expect(fireDamageRatio(fire)).toBe(ENEMY_ONLY_DAMAGE[weapon]);
  }
});
