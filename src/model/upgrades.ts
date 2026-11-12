import type { EconomyCatalog, LeveledValue } from "../data/economy.ts";
import type { ShipPhysics } from "../data/ship-physics.ts";
import type { PrototypeContent } from "../data/types.ts";
import type { EconomyState, UpgradeLevels } from "./types.ts";
import { noAmmo } from "./weapons.ts";

/** Ada's effective ship values after bought upgrades. Enemy tuning never reads these. */
export interface ShipTuning {
  physics: ShipPhysics;
  shieldMax: number;
  shieldRechargeDelay: number;
  shieldRechargeRate: number;
  tractorRadius: number;
  tractorSpeed: number;
}

/** A new save's economy: no Stardust, Laser only and the free paint scheme. */
export function newEconomy(catalog: EconomyCatalog): EconomyState {
  return {
    ammo: noAmmo(),
    levels: noLevels(),
    ownedWeapons: [],
    paint: catalog.defaultPaint,
    paints: [catalog.defaultPaint],
    stardust: 0,
    weapon: "laser",
  };
}

/** Every track and weapon starts at level 1, the base. */
export function noLevels(): UpgradeLevels {
  return {
    engine: 1,
    shield: 1,
    tractor: 1,
    weapons: {
      heavyMissile: 1,
      laser: 1,
      multiLaser: 1,
      phaser: 1,
      rapidMissile: 1,
      scattershot: 1,
    },
  };
}

/** The base value at level 1, else that level's value; levels past the table clamp. */
export function leveledValue(value: LeveledValue, level: number): number {
  if (level <= 1 || !value.levels.length) {
    return value.base;
  }
  return value.levels[Math.min(level - 1, value.levels.length) - 1]!;
}

/** A level's multiplier from a levels 1, 2 and 3 table; out-of-range levels clamp. */
const multiplier = (table: readonly [number, number, number], level: number) =>
  table[Math.min(3, Math.max(1, Math.floor(level))) - 1]!;

export function shipTuning(
  catalog: EconomyCatalog,
  content: PrototypeContent,
  levels: UpgradeLevels,
): ShipTuning {
  const { effects } = catalog;
  const base = content.tuning.physics;
  const seconds = multiplier(effects.engineSeconds, levels.engine);
  const shieldLevel = (base: number, value: keyof EconomyCatalog["shieldLevels"]) =>
    leveledValue({ base, levels: catalog.shieldLevels[value] }, levels.shield);
  const capacity = shieldLevel(content.tuning.shieldMax, "capacity");
  return {
    physics: {
      ...base,
      accelerationSeconds: base.accelerationSeconds * seconds,
      brakingSeconds: base.brakingSeconds * seconds,
      maxSpeed: leveledValue(
        { base: base.maxSpeed, levels: catalog.engineMaxSpeed },
        levels.engine,
      ),
    },
    shieldMax: capacity,
    shieldRechargeDelay: shieldLevel(content.tuning.shieldRechargeDelay, "delay"),
    // The shield refills from empty in its fill time whatever its capacity.
    shieldRechargeRate: capacity / shieldLevel(content.tuning.shieldFillSeconds, "fill"),
    tractorRadius: leveledValue(catalog.tractorRadius, levels.tractor),
    tractorSpeed: leveledValue(catalog.tractorSpeed, levels.tractor),
  };
}
