import { enemyDefinition, escortTuning, FRIGATE_ESCORT_COUNT } from "../data/enemyCatalog.ts";
import { spacingRadius } from "../data/enemySpacing.ts";
import { ROUTE_POSITION, type RoutePosition } from "../data/galaxies.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { createEnemy } from "./enemyAi.ts";
import { rollEnemyWeaponLevel } from "./enemyEquipment.ts";
import type { SpaceObject, Vec } from "./types.ts";

export const FRIGATE_ESCORT_ROLE = "frigateEscort";

export function requiredFrigateEscortId(leaderId: string, index: number): string {
  return `${leaderId}:escort:${index}`;
}

/** An escort's station at `phase`, the escort station gap beyond its leader's spacing radius. */
export function frigateEscortStation(
  position: RoutePosition,
  leader: SpaceObject,
  phase: number,
): Vec {
  const radius = leader.enemy ? spacingRadius(position, leader.enemy) : leader.radius;
  const gap = radius + escortTuning.stationGap;
  return { x: leader.x + Math.cos(phase) * gap, y: leader.y + Math.sin(phase) * gap };
}

/** Two opposite stations keep each frigate's mandatory fighters clear of the leader line. */
export function createFrigateEscorts(
  context: {
    encounterSeed: number;
    galaxy: GalaxyNumber;
    id: (index: number) => string;
    packId: string;
    persistent: boolean;
    shipRadius: number;
  },
  leader: SpaceObject,
): SpaceObject[] {
  return Array.from({ length: FRIGATE_ESCORT_COUNT }, (_, index) => {
    const id = context.id(index);
    const phase = Math.PI / 2 + index * Math.PI;
    const point = frigateEscortStation(ROUTE_POSITION[context.galaxy], leader, phase);
    const weaponLevel = rollEnemyWeaponLevel(context, id);
    const definition = enemyDefinition(context.galaxy, "fighter", id, weaponLevel);
    return {
      ...point,
      enemy: createEnemy(
        definition,
        {
          archetype: "fighter",
          escortOf: leader.id,
          id,
          packId: context.packId,
          phase,
          weaponLevel,
        },
        point,
      ),
      hp: definition.hp,
      id,
      kind: "enemy",
      persistent: context.persistent,
      radius: context.shipRadius * definition.sizeRatio,
      role: FRIGATE_ESCORT_ROLE,
    };
  });
}
