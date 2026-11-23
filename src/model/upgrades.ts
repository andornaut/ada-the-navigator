import type { EconomyCatalog, LeveledValue } from "../data/economy.ts";
import type { ShipPhysics } from "../data/shipPhysics.ts";
import type { GameContent } from "../data/types.ts";
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

export function shipTuning(
  catalog: EconomyCatalog,
  content: GameContent,
  levels: UpgradeLevels,
): ShipTuning {
  const base = content.tuning.physics;
  const capacity = leveledValue(
    { base: content.tuning.shieldMax, levels: catalog.shieldLevels.capacity },
    levels.shield,
  );
  const engineLevel = (value: keyof EconomyCatalog["engineLevels"]) =>
    leveledValue(
      { base: base[value], levels: catalog.engineLevels[value] },
      Math.floor(levels.engine),
    );
  return {
    physics: {
      ...base,
      accelerationSeconds: engineLevel("accelerationSeconds"),
      aimTurnSeconds: engineLevel("aimTurnSeconds"),
      brakingSeconds: engineLevel("brakingSeconds"),
      maxSpeed: engineLevel("maxSpeed"),
      turnSeconds: engineLevel("turnSeconds"),
    },
    shieldMax: capacity,
    shieldRechargeDelay: content.tuning.shieldRechargeDelay,
    // The shield refills from empty in its fill time whatever its capacity.
    shieldRechargeRate: capacity / content.tuning.shieldFillSeconds,
    tractorRadius: leveledValue(catalog.tractorRadius, levels.tractor),
    tractorSpeed: leveledValue(catalog.tractorSpeed, levels.tractor),
  };
}
