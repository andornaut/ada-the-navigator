import { placementRadius, sceneryShape } from "./asteroids.ts";
import type { RetaliatorAsteroid } from "./retaliatorNavigation.ts";
import type { SpaceObject, Vec } from "./types.ts";
import { periodicWorldGrid, worldCellAt, worldCellKey, worldCellsNear } from "./worldCells.ts";
import { type WorldContext, worldDistance } from "./worldContacts.ts";

/** A slice-local index of real loaded asteroids, shared by every industrial ship's idle input. */
export function retaliatorAsteroidQuery(
  context: WorldContext,
  chunkSize: number,
  objects: readonly SpaceObject[],
): (radius: number, home: Vec) => readonly RetaliatorAsteroid[] {
  const grid = periodicWorldGrid(context, chunkSize);
  const cells = new Map<string, RetaliatorAsteroid[]>();
  let maximumReach = 0;
  for (const object of objects) {
    if (object.hp <= 0 || !["rock", "resource"].includes(object.kind) || !sceneryShape(object)) {
      continue;
    }
    const physicalReach = placementRadius(object);
    const entry = { id: object.id, physicalReach, position: { x: object.x, y: object.y } };
    const key = worldCellKey(grid, worldCellAt(grid, object));
    const entries = cells.get(key) ?? [];
    entries.push(entry);
    cells.set(key, entries);
    maximumReach = Math.max(maximumReach, physicalReach);
  }
  return (radius, home) => {
    const result: RetaliatorAsteroid[] = [];
    for (const cell of worldCellsNear(grid, radius + maximumReach, home)) {
      for (const asteroid of cells.get(worldCellKey(grid, cell)) ?? []) {
        if (worldDistance(context, home, asteroid.position) <= radius + asteroid.physicalReach) {
          result.push(asteroid);
        }
      }
    }
    return result.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  };
}
