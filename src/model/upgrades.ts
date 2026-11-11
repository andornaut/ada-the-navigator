import type { EconomyCatalog, LeveledValue } from "../data/economy.ts";
import type { ShipPhysics } from "../data/ship-physics.ts";
import type { PrototypeContent } from "../data/types.ts";
import type { WeaponDefinition } from "../data/weapon-catalog.ts";
import type { EconomyState, UpgradeLevels } from "./types.ts";

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
    levels: noLevels(),
    ownedWeapons: [],
    paint: catalog.defaultPaint,
    paints: [catalog.defaultPaint],
    stardust: 0,
    weapon: "basic",
  };
}

export function noLevels(): UpgradeLevels {
  return {
    engine: 0,
    shield: 0,
    shieldRecharge: 0,
    tractor: 0,
    weapons: { basic: 0, missiles: 0, scattershot: 0, tripleLaser: 0 },
  };
}

/** The base value at level 0, else the bought level's value; levels past the table clamp. */
export function leveledValue(value: LeveledValue, level: number): number {
  if (level <= 0 || !value.levels.length) {
    return value.base;
  }
  return value.levels[Math.min(level, value.levels.length) - 1]!;
}

/** Each level adds its fraction to the base multiplier: level 2 at +10% is x1.2. */
const scale = (fraction: number, level: number) => Math.max(0, 1 + fraction * level);

export function shipTuning(
  catalog: EconomyCatalog,
  content: PrototypeContent,
  levels: UpgradeLevels,
): ShipTuning {
  const { effects } = catalog;
  const base = content.tuning.physics;
  const seconds = scale(effects.engineSeconds, levels.engine);
  return {
    physics: {
      ...base,
      accelerationSeconds: base.accelerationSeconds * seconds,
      brakingSeconds: base.brakingSeconds * seconds,
      speedRatio: base.speedRatio * scale(effects.engineSpeed, levels.engine),
    },
    shieldMax: content.tuning.shieldMax * scale(effects.shieldCapacity, levels.shield),
    shieldRechargeDelay:
      content.tuning.shieldRechargeDelay *
      scale(effects.shieldRechargeDelay, levels.shieldRecharge),
    shieldRechargeRate:
      content.tuning.shieldRechargeRate * scale(effects.shieldRechargeRate, levels.shieldRecharge),
    tractorRadius: leveledValue(catalog.tractorRadius, levels.tractor),
    tractorSpeed: leveledValue(catalog.tractorSpeed, levels.tractor),
  };
}

export function upgradedWeapon(
  catalog: EconomyCatalog,
  level: number,
  definition: WeaponDefinition,
): WeaponDefinition {
  return {
    ...definition,
    damageRatio: definition.damageRatio * scale(catalog.effects.weaponDamage, level),
    intervalSeconds: definition.intervalSeconds * scale(catalog.effects.weaponInterval, level),
  };
}
