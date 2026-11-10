import { enemyCatalog } from "../data/enemy-catalog.ts";
import type { PrototypeContent } from "../data/types.ts";
import { enemyEffects } from "./enemy-ai.ts";
import type { FlightState, SpaceObject, Vec } from "./types.ts";
import { chunkCoordinates } from "./visited.ts";

export const ACTIVE_CHUNK_RADIUS = 3;
const archived = new WeakMap<FlightState, Set<string>>();
const emptyIds: ReadonlySet<string> = new Set();
interface WorldIndex {
  chunks: Map<string, Set<string>>;
  packs: Record<string, number>;
  routes: Map<string, Set<string>>;
}
const indexes = new WeakMap<FlightState["world"], WorldIndex>();

export function archivedObjectIds(flight: FlightState): ReadonlySet<string> {
  return archived.get(flight) ?? emptyIds;
}
export function beginFlightStep(flight: FlightState): void {
  archived.set(flight, new Set());
}
function coordinates(content: PrototypeContent, point: Vec): Vec {
  return {
    x: Math.floor(point.x / content.tuning.chunkSize),
    y: Math.floor(point.y / content.tuning.chunkSize),
  };
}
function key(content: PrototypeContent, point: Vec): string {
  const at = coordinates(content, point);
  return `${at.x},${at.y}`;
}
function near(first: Vec, second: Vec): boolean {
  return (
    Math.abs(first.x - second.x) <= ACTIVE_CHUNK_RADIUS &&
    Math.abs(first.y - second.y) <= ACTIVE_CHUNK_RADIUS
  );
}
function liveEnemy(object: SpaceObject): boolean {
  return (
    object.kind === "enemy" &&
    object.hp > 0 &&
    (!object.enemy || !enemyEffects(enemyCatalog[object.enemy.archetype], object.enemy).defeated)
  );
}
export function persistentObject(object: SpaceObject): boolean {
  return (
    object.persistent === true ||
    object.kind === "destination" ||
    object.id.startsWith("whale-debris:") ||
    object.routeId !== undefined ||
    (object.kind === "enemy" &&
      object.enemy !== undefined &&
      ["frigate", "capital", "oversizedCapital"].includes(object.enemy.archetype))
  );
}
function account(
  content: PrototypeContent,
  index: WorldIndex,
  object: SpaceObject,
  add: boolean,
): void {
  const at = key(content, object);
  const chunk = index.chunks.get(at) ?? new Set<string>();
  if (add) {
    chunk.add(object.id);
    index.chunks.set(at, chunk);
  } else {
    chunk.delete(object.id);
    if (!chunk.size) {
      index.chunks.delete(at);
    }
  }
  if (!liveEnemy(object)) {
    return;
  }
  const packId = object.enemy?.packId;
  if (packId) {
    const count = (index.packs[packId] ?? 0) + (add ? 1 : -1);
    if (count > 0) {
      index.packs[packId] = count;
    } else {
      delete index.packs[packId];
    }
  }
  if (object.routeId) {
    const guards = index.routes.get(object.routeId) ?? new Set<string>();
    if (add) {
      guards.add(object.id);
      index.routes.set(object.routeId, guards);
    } else {
      guards.delete(object.id);
      if (!guards.size) {
        index.routes.delete(object.routeId);
      }
    }
  }
}
function indexWorld(content: PrototypeContent, flight: FlightState): WorldIndex {
  let index = indexes.get(flight.world);
  if (!index) {
    index = { chunks: new Map(), packs: {}, routes: new Map() };
    for (const object of Object.values(flight.world.notables)) {
      if (object) {
        account(content, index, object, true);
      }
    }
    indexes.set(flight.world, index);
  }
  return index;
}
export function retainedPackMembers(
  content: PrototypeContent,
  flight: FlightState,
): Readonly<Record<string, number>> {
  return indexWorld(content, flight).packs;
}
export function retainedRouteBlocked(id: string, flight: FlightState): boolean {
  const index = indexes.get(flight.world);
  return index
    ? Boolean(index.routes.get(id)?.size)
    : Object.values(flight.world.notables).some(
        (object) => object !== null && object.routeId === id && liveEnemy(object),
      );
}
function activate(content: PrototypeContent, id: string, flight: FlightState): void {
  const object = flight.world.notables[id];
  if (!object) {
    return;
  }
  account(content, indexWorld(content, flight), object, false);
  delete flight.world.notables[id];
  flight.objects.push(object);
}
export function activateFlightRegion(
  content: PrototypeContent,
  point: Vec,
  flight: FlightState,
): void {
  const center = coordinates(content, point);
  const index = indexWorld(content, flight);
  for (let x = center.x - ACTIVE_CHUNK_RADIUS; x <= center.x + ACTIVE_CHUNK_RADIUS; x++) {
    for (let y = center.y - ACTIVE_CHUNK_RADIUS; y <= center.y + ACTIVE_CHUNK_RADIUS; y++) {
      for (const id of [...(index.chunks.get(`${x},${y}`) ?? [])]) {
        activate(content, id, flight);
      }
    }
  }
}
/** Null records suppress defeated notable identities before any later template admission. */
export function recordObjectRemoval(
  content: PrototypeContent,
  object: SpaceObject,
  flight: FlightState,
): void {
  if (!persistentObject(object)) {
    return;
  }
  const previous = Object.hasOwn(flight.world.notables, object.id)
    ? flight.world.notables[object.id]
    : undefined;
  if (previous) {
    account(content, indexWorld(content, flight), previous, false);
  }
  flight.world.notables[object.id] = null;
}
export function syncFlightRegion(content: PrototypeContent, flight: FlightState): void {
  activateFlightRegion(content, flight.player, flight);
  const center = coordinates(content, flight.player);
  const index = indexWorld(content, flight);
  const active: SpaceObject[] = [];
  let removed = archived.get(flight);
  if (!removed) {
    removed = new Set();
    archived.set(flight, removed);
  }
  for (const object of flight.objects) {
    if (
      object.kind === "destination" ||
      object.id.startsWith("whale-debris:") ||
      near(coordinates(content, object), center)
    ) {
      active.push(object);
      continue;
    }
    removed.add(object.id);
    if (persistentObject(object)) {
      if (object.hp > 0 && !(object.kind === "enemy" && !liveEnemy(object))) {
        flight.world.notables[object.id] = object;
        account(content, index, object, true);
      } else {
        recordObjectRemoval(content, object, flight);
      }
    } else if (liveEnemy(object) && object.enemy?.packId && flight.combat) {
      const pack = object.enemy.packId;
      flight.combat.initialPackSizes[pack] = Math.max(
        0,
        (flight.combat.initialPackSizes[pack] ?? 0) - 1,
      );
    }
  }
  flight.objects = active;
  flight.chunks = flight.chunks.filter((value) => {
    const point = chunkCoordinates(value);
    return point !== null && near(point, center);
  });
  if (flight.combat) {
    const packs = new Set([
      ...Object.keys(index.packs),
      ...active.flatMap((object) => (object.enemy?.packId ? [object.enemy.packId] : [])),
    ]);
    for (const id of Object.keys(flight.combat.initialPackSizes)) {
      if (!packs.has(id)) {
        delete flight.combat.initialPackSizes[id];
      }
    }
  }
}
export function activateRouteEncounter(
  content: PrototypeContent,
  id: string,
  flight: FlightState,
): void {
  const guards = [...(indexWorld(content, flight).routes.get(id) ?? [])];
  for (const identity of guards) {
    activate(content, identity, flight);
  }
}
