import { randomStream } from "@andornaut/game-kit/random";

import {
  type EnemyArchetype,
  type EnemyDefinition,
  enemyDefinition,
} from "../data/enemyCatalog.ts";
import { selectEnemyWeaponLevel } from "../data/enemyWeaponLevels.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import type { GalaxyNumber, WeaponLevel } from "../data/types.ts";

export interface EnemyEquipmentContext {
  readonly encounterSeed: number;
  readonly galaxy: GalaxyNumber;
}

export interface EquippedEnemyIdentity {
  readonly archetype: EnemyArchetype;
  readonly id: string;
  /** Absent on legacy enemies, which keep their existing level-one equipment. */
  readonly weaponLevel?: WeaponLevel;
}

/** A dedicated identity stream leaves encounter, role, profile and loot draws untouched. */
export function rollEnemyWeaponLevel(context: EnemyEquipmentContext, id: string): WeaponLevel {
  const roll = randomStream(context.encounterSeed, `enemy-weapon-level:${id}`)();
  return selectEnemyWeaponLevel(ROUTE_POSITION[context.galaxy], roll);
}

/** Reconstructs equipment from the saved roll without sampling or resetting combat clocks. */
export function enemyEquipmentDefinition(
  galaxy: GalaxyNumber,
  enemy: EquippedEnemyIdentity,
): EnemyDefinition {
  return enemyDefinition(galaxy, enemy.archetype, enemy.id, enemy.weaponLevel ?? 1);
}
