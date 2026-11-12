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

/** A new save's economy: no Stardust, Basic only and the free paint scheme. */
export function newEconomy(catalog: EconomyCatalog): EconomyState {
  return {
    ammo: noAmmo(),
    levels: noLevels(),
    ownedWeapons: [],
    paint: catalog.defaultPaint,
    paints: [catalog.defaultPaint],
    stardust: 0,
    weapon: "basic",
  };
}

/** Every track and weapon starts at level 1, the base. */
export function noLevels(): UpgradeLevels {
  return {
    engine: 1,
    shield: 1,
    shieldRecharge: 1,
    tractor: 1,
    weapons: {
      basic: 1,
      heavyMissile: 1,
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
    shieldMax: content.tuning.shieldMax * multiplier(effects.shieldCapacity, levels.shield),
    shieldRechargeDelay:
      content.tuning.shieldRechargeDelay *
      multiplier(effects.shieldRechargeDelay, levels.shieldRecharge),
    shieldRechargeRate:
      content.tuning.shieldRechargeRate *
      multiplier(effects.shieldRechargeRate, levels.shieldRecharge),
    tractorRadius: leveledValue(catalog.tractorRadius, levels.tractor),
    tractorSpeed: leveledValue(catalog.tractorSpeed, levels.tractor),
  };
}
