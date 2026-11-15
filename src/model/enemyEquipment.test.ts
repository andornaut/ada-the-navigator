import { expect, it } from "vitest";

import {
  enemyCatalog,
  enemyDefinition,
  enemyFire,
  enemyOnly,
  fireDamageRatio,
} from "../data/enemyCatalog.ts";
import { equippedEnemyWeaponLevel } from "../data/enemyWeaponLevels.ts";
import type { EnemyWeapon } from "../data/types.ts";
import { WEAPON_CATALOG, weaponAt } from "../data/weaponCatalog.ts";
import { enemyEquipmentDefinition, rollEnemyWeaponLevel } from "./enemyEquipment.ts";

it("equips all six shared weapons while keeping the three enemy-only weapons at level one", () => {
  for (const weapon of [
    ...Object.keys(WEAPON_CATALOG),
    "chargedLance",
    "mineLayer",
    "ringBurst",
  ] as EnemyWeapon[]) {
    const profile = enemyFire("capital", { level: 3, weapon });
    expect(profile.level).toBe(enemyOnly(weapon) ? 1 : 3);
    expect(equippedEnemyWeaponLevel(3, weapon)).toBe(profile.level);
    if (!enemyOnly(weapon)) {
      expect(profile.angles).toEqual(weaponAt(weapon, 3).anglesDegrees);
      expect(fireDamageRatio(profile)).toBe(weaponAt(weapon, 3).damageRatio);
    }
  }
});

it("uses one stable per-enemy result within an encounter and a fresh encounter seed can reroll it", () => {
  const context = { encounterSeed: 71, galaxy: 6 } as const;
  const ids = Array.from({ length: 16 }, (_, index) => `equipment:${index}`);
  const first = ids.map((id) => rollEnemyWeaponLevel(context, id));
  expect(ids.map((id) => rollEnemyWeaponLevel(context, id))).toEqual(first);
  expect(new Set(first)).toEqual(new Set([2, 3]));
  expect(ids.map((id) => rollEnemyWeaponLevel({ ...context, encounterSeed: 72 }, id))).not.toEqual(
    first,
  );
  expect(context).toEqual({ encounterSeed: 71, galaxy: 6 });
});

it("isolates equipped levels while preserving active mounts, hulls and projectile speeds", () => {
  for (const archetype of [
    "capital",
    "frigate",
    "platform",
    "fighter",
    "interceptor",
    "retaliator",
    "swarm",
  ] as const) {
    const identity = { archetype, id: `equipment:${archetype}` };
    const legacy = enemyEquipmentDefinition(6, identity);
    const upgraded = enemyEquipmentDefinition(6, { ...identity, weaponLevel: 3 });
    expect(legacy).toBe(enemyDefinition(6, archetype, identity.id, 1));
    expect(upgraded).toBe(enemyEquipmentDefinition(6, { ...identity, weaponLevel: 3 }));
    expect(upgraded).not.toBe(legacy);
    expect(upgraded.hp).toBe(legacy.hp);
    expect(upgraded.physics).toEqual(enemyCatalog[archetype].physics);
    const primaryRatio = enemyOnly(upgraded.fire.weapon)
      ? 1
      : weaponAt(upgraded.fire.weapon, 3).intervalSeconds /
        weaponAt(upgraded.fire.weapon, 1).intervalSeconds;
    expect(upgraded.fire.interval).toBeCloseTo(legacy.fire.interval * primaryRatio, 12);
    expect(upgraded.fire.projectileSpeed).toBe(legacy.fire.projectileSpeed);
    expect(upgraded.hardpoints.map((part) => [part.id, part.kind, part.hp])).toEqual(
      legacy.hardpoints.map((part) => [part.id, part.kind, part.hp]),
    );
    for (const part of upgraded.hardpoints) {
      if (part.kind === "weapon") {
        expect(part.fire.level).toBe(enemyOnly(part.fire.weapon) ? 1 : 3);
        const original = legacy.hardpoints.find((entry) => entry.id === part.id)!;
        if (original.kind !== "weapon") {
          throw Error("expected weapon mount");
        }
        const ratio = enemyOnly(part.fire.weapon)
          ? 1
          : weaponAt(part.fire.weapon, 3).intervalSeconds /
            weaponAt(part.fire.weapon, 1).intervalSeconds;
        expect(part.fire.interval).toBeCloseTo(original.fire.interval * ratio, 12);
        expect(part.fire.projectileSpeed).toBe(original.fire.projectileSpeed);
      }
    }
  }
});
