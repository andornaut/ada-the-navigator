import { enemyCatalog } from "../data/enemy-catalog.ts";
import type { PrototypeContent } from "../data/types.ts";
import { enemyEffects } from "./enemy-ai.ts";
import type { FlightState, SpaceObject, Vec } from "./types.ts";

// Includes the generated near field, viewport, interactions and a chunk of movement margin.
export const ACTIVE_CHUNK_RADIUS = 3;

const archived = new WeakMap<FlightState, Set<string>>();
const emptyIds: ReadonlySet<string> = new Set<string>();
const routeCounts = new WeakMap<NonNullable<FlightState["dormant"]>, Map<string, number>>();

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
function liveEnemy(object: SpaceObject): boolean {
  return (
    object.kind === "enemy" &&
    object.hp > 0 &&
    (!object.enemy || !enemyEffects(enemyCatalog[object.enemy.archetype], object.enemy).defeated)
  );
}
function dormant(flight: FlightState) {
  return (flight.dormant ??= { packMembers: {}, pages: {}, routes: [], version: 1 });
}
function retainedRoutes(flight: FlightState): Map<string, number> {
  const state = dormant(flight);
  let counts = routeCounts.get(state);
  if (!counts) {
    counts = new Map();
    // Hydrate once per restored dormant state. Ordinary activation never rescans the archive.
    for (const encoded of Object.values(state.pages)) {
      if (!state.routes.some((id) => encoded.includes(JSON.stringify(id)))) {
        continue;
      }
      for (const object of JSON.parse(encoded) as SpaceObject[]) {
        if (object.routeId && liveEnemy(object)) {
          counts.set(object.routeId, (counts.get(object.routeId) ?? 0) + 1);
        }
      }
    }
    routeCounts.set(state, counts);
  }
  return counts;
}

function account(amount: number, objects: readonly SpaceObject[], flight: FlightState): void {
  const state = dormant(flight);
  for (const object of objects) {
    if (!liveEnemy(object)) {
      continue;
    }
    const packId = object.enemy?.packId;
    if (packId) {
      const count = (state.packMembers[packId] ?? 0) + amount;
      if (count > 0) {
        state.packMembers[packId] = count;
      } else {
        delete state.packMembers[packId];
      }
    }
    if (object.routeId) {
      const counts = retainedRoutes(flight);
      const count = (counts.get(object.routeId) ?? 0) + amount;
      if (count > 0) {
        counts.set(object.routeId, count);
        if (!state.routes.includes(object.routeId)) {
          state.routes.push(object.routeId);
        }
      } else {
        counts.delete(object.routeId);
        state.routes = state.routes.filter((id) => id !== object.routeId);
      }
    }
  }
}
function activatePage(key: string, flight: FlightState): void {
  const state = flight.dormant;
  const encoded = state?.pages[key];
  if (encoded === undefined) {
    return;
  }
  const objects = JSON.parse(encoded) as SpaceObject[];
  // Transfer ownership once. Restore validation checks record shapes and unique identities.
  account(-1, objects, flight);
  delete state!.pages[key];
  flight.objects.push(...objects);
}

/** Activate only spatially addressed pages, without traversing the visited world. */
export function activateFlightRegion(
  content: PrototypeContent,
  point: Vec,
  flight: FlightState,
): void {
  if (!flight.dormant) {
    return;
  }
  const center = coordinates(content, point);
  for (let x = center.x - ACTIVE_CHUNK_RADIUS; x <= center.x + ACTIVE_CHUNK_RADIUS; x++) {
    for (let y = center.y - ACTIVE_CHUNK_RADIUS; y <= center.y + ACTIVE_CHUNK_RADIUS; y++) {
      activatePage(`${x},${y}`, flight);
    }
  }
}

/** Inactive object records are immutable encoded pages. Projectiles keep their single global owner. */
export function syncFlightRegion(content: PrototypeContent, flight: FlightState): void {
  activateFlightRegion(content, flight.player, flight);
  const center = coordinates(content, flight.player);
  const pages = new Map<string, SpaceObject[]>();
  const active: SpaceObject[] = [];
  for (const object of flight.objects) {
    const point = coordinates(content, object);
    if (
      object.kind === "destination" ||
      object.id.startsWith("whale-debris:") ||
      (Math.abs(point.x - center.x) <= ACTIVE_CHUNK_RADIUS &&
        Math.abs(point.y - center.y) <= ACTIVE_CHUNK_RADIUS)
    ) {
      active.push(object);
      continue;
    }
    const key = `${point.x},${point.y}`;
    const page = pages.get(key) ?? [];
    page.push(object);
    pages.set(key, page);
  }
  if (!pages.size) {
    return;
  }
  const state = dormant(flight);
  for (const [key, objects] of pages) {
    const prior = state.pages[key];
    const existing = prior === undefined ? [] : (JSON.parse(prior) as SpaceObject[]);
    account(1, objects, flight);
    state.pages[key] = JSON.stringify([...existing, ...objects]);
    let ids = archived.get(flight);
    if (!ids) {
      ids = new Set();
      archived.set(flight, ids);
    }
    for (const object of objects) {
      ids.add(object.id);
    }
  }
  flight.objects = active;
}

/** Explicit quest relocation wakes every matching guard before their positions are translated. */
export function activateRouteEncounter(
  content: PrototypeContent,
  id: string,
  flight: FlightState,
): void {
  if (!flight.dormant?.routes.includes(id)) {
    return;
  }
  // Rare quest relocation searches encoded pages; ordinary simulation only addresses nearby keys.
  const marker = JSON.stringify(id);
  for (const key of Object.keys(flight.dormant.pages)) {
    const encoded = flight.dormant.pages[key];
    if (encoded === undefined || !encoded.includes(marker)) {
      continue;
    }
    const objects = JSON.parse(encoded) as SpaceObject[];
    const guard = objects.find((object) => object.routeId === id && liveEnemy(object));
    if (guard) {
      activatePage(key, flight);
      activateFlightRegion(content, guard, flight);
    }
  }
}
