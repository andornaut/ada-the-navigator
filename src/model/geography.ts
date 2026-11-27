import { ECONOMY } from "../data/economy.ts";
import type { GameContent } from "../data/types.ts";
import { enemyDefeated } from "./enemyAi.ts";
import { markerObjectTracked } from "./markerKnowledge.ts";
import { stationGuardSite } from "./stationGuardSite.ts";
import { worldStationById } from "./stations.ts";
import type { FlightState, SpaceObject, Vec } from "./types.ts";
import { chunkCoordinates } from "./visited.ts";
import {
  periodicWorldGrid,
  worldCell,
  worldCellAt,
  worldCellCenter,
  type WorldCellContext,
  worldCellKey,
  worldCellsNear,
  type WorldGrid,
} from "./worldCells.ts";
import { wrappedDelta } from "./worldGeometry.ts";

export interface GeographyContext extends WorldCellContext {
  readonly retainedEncounters?: ReadonlySet<string>;
}

export const ACTIVE_CHUNK_RADIUS = 3;
const archived = new WeakMap<FlightState, Set<string>>();
const emptyIds: ReadonlySet<string> = new Set();
const questGuardRecovery = new WeakMap<FlightState, ReadonlySet<string>>();
interface WorldIndex {
  worldSide: number | undefined;
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
function coordinates(context: GeographyContext, content: GameContent, point: Vec): Vec {
  return worldCellAt(periodicWorldGrid(context, content.tuning.chunkSize), point);
}
function key(context: GeographyContext, content: GameContent, point: Vec): string {
  const at = coordinates(context, content, point);
  return `${at.x},${at.y}`;
}
function near(context: GeographyContext, content: GameContent, first: Vec, second: Vec): boolean {
  const grid = periodicWorldGrid(context, content.tuning.chunkSize);
  const delta =
    grid.periodCells === undefined
      ? { x: second.x - first.x, y: second.y - first.y }
      : wrappedDelta(grid.periodCells, first, second);
  return Math.abs(delta.x) <= ACTIVE_CHUNK_RADIUS && Math.abs(delta.y) <= ACTIVE_CHUNK_RADIUS;
}
/** A live enemy: not destroyed, and not a salvaged heavy, which is spared and powered down. */
export function liveEnemy(object: SpaceObject): boolean {
  return (
    object.kind === "enemy" &&
    object.hp > 0 &&
    (!object.enemy || (!enemyDefeated(object.enemy) && !object.enemy.salvaged))
  );
}
/** A guard that still blocks its route: neither disabled nor destroyed. */
function blockingGuard(object: SpaceObject): boolean {
  return liveEnemy(object) && !object.enemy?.disabled;
}
export function persistentObject(object: SpaceObject): boolean {
  return (
    object.persistent === true ||
    object.kind === "destination" ||
    object.kind === "station" ||
    object.id.startsWith("whale-debris:") ||
    object.routeId !== undefined ||
    // Open-space encounters opt out so they regenerate by pack instead of accumulating.
    (object.persistent !== false &&
      object.kind === "enemy" &&
      object.enemy !== undefined &&
      ["frigate", "capital", "platform"].includes(object.enemy.archetype))
  );
}
/** Untouched seeded stations carry no object state beyond their canonical descriptor. */
function derivedStation(
  context: GeographyContext,
  flight: FlightState,
  object: SpaceObject,
): boolean {
  if (
    object.kind !== "station" ||
    Object.keys(object).length !== 6 ||
    object.hp !== 1 ||
    object.radius !== ECONOMY.station.radius
  ) {
    return false;
  }
  const site = worldStationById(context, ECONOMY, flight.galaxy, object.id);
  return site !== null && site.x === object.x && site.y === object.y;
}

function account(
  context: GeographyContext,
  content: GameContent,
  index: WorldIndex,
  object: SpaceObject,
  add: boolean,
): void {
  const at = key(context, content, object);
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
  if (object.routeId && blockingGuard(object)) {
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
function indexWorld(
  context: GeographyContext,
  content: GameContent,
  flight: FlightState,
): WorldIndex {
  let index = indexes.get(flight.world);
  if (!index || index.worldSide !== context.worldSide) {
    index = { chunks: new Map(), packs: {}, routes: new Map(), worldSide: context.worldSide };
    for (const object of Object.values(flight.world.notables)) {
      if (object) {
        account(context, content, index, object, true);
      }
    }
    indexes.set(flight.world, index);
  }
  return index;
}
export function worldRetainedPackMembers(
  context: GeographyContext,
  content: GameContent,
  flight: FlightState,
): Readonly<Record<string, number>> {
  const retained = indexWorld(context, content, flight).packs;
  const unloaded = flight.combat?.unloadedPackMembers;
  if (!unloaded) {
    return retained;
  }
  const counts = { ...retained };
  for (const [id, count] of Object.entries(unloaded)) {
    counts[id] = (counts[id] ?? 0) + count;
  }
  return counts;
}
export function retainedRouteBlocked(id: string, flight: FlightState): boolean {
  const index = indexes.get(flight.world);
  return index
    ? Boolean(index.routes.get(id)?.size)
    : Object.values(flight.world.notables).some(
        (object) => object !== null && object.routeId === id && blockingGuard(object),
      );
}
function activate(
  context: GeographyContext,
  content: GameContent,
  id: string,
  flight: FlightState,
): void {
  const object = flight.world.notables[id];
  if (!object) {
    return;
  }
  account(context, content, indexWorld(context, content, flight), object, false);
  delete flight.world.notables[id];
  if (!flight.objects.some((active) => active.id === object.id)) {
    flight.objects.push(object);
  }
}
interface ActivationNeighbourhood {
  readonly grid: WorldGrid;
  readonly cell: Vec;
  readonly radius: number;
  readonly keys: readonly string[];
}
const activationNeighbourhoods = new WeakMap<FlightState, ActivationNeighbourhood>();

export function worldActivateFlightRegion(
  context: GeographyContext,
  content: GameContent,
  point: Vec,
  flight: FlightState,
): void {
  const grid = periodicWorldGrid(context, content.tuning.chunkSize);
  const cell = worldCellAt(grid, point);
  let neighbourhood = activationNeighbourhoods.get(flight);
  if (
    !neighbourhood ||
    neighbourhood.cell.x !== cell.x ||
    neighbourhood.cell.y !== cell.y ||
    neighbourhood.radius !== ACTIVE_CHUNK_RADIUS ||
    neighbourhood.grid.worldSide !== grid.worldSide ||
    neighbourhood.grid.nominalPitch !== grid.nominalPitch ||
    neighbourhood.grid.pitch !== grid.pitch ||
    neighbourhood.grid.phase !== grid.phase ||
    neighbourhood.grid.periodCells !== grid.periodCells
  ) {
    const center = worldCellCenter(grid, cell);
    neighbourhood = {
      cell,
      grid,
      keys: Array.from(worldCellsNear(grid, ACTIVE_CHUNK_RADIUS * grid.pitch, center), (at) =>
        worldCellKey(grid, at),
      ),
      radius: ACTIVE_CHUNK_RADIUS,
    };
    activationNeighbourhoods.set(flight, neighbourhood);
  }
  const index = indexWorld(context, content, flight);
  for (const key of neighbourhood.keys) {
    // Only keys are cached: each invocation reads and snapshots the live membership.
    for (const id of [...(index.chunks.get(key) ?? [])]) {
      activate(context, content, id, flight);
    }
  }
}
/** Discards a temporary notable without retaining a defeat tombstone. */
export function worldDiscardNotable(
  context: GeographyContext,
  content: GameContent,
  id: string,
  flight: FlightState,
): void {
  const previous = flight.world.notables[id];
  if (previous) {
    account(context, content, indexWorld(context, content, flight), previous, false);
  }
  delete flight.world.notables[id];
}
/** Null records suppress defeated notable identities before any later template admission. */
export function worldRecordObjectRemoval(
  context: GeographyContext,
  content: GameContent,
  object: SpaceObject,
  flight: FlightState,
): void {
  if (!persistentObject(object) && !markerObjectTracked(flight, object)) {
    return;
  }
  const previous = Object.hasOwn(flight.world.notables, object.id)
    ? flight.world.notables[object.id]
    : undefined;
  if (previous) {
    account(context, content, indexWorld(context, content, flight), previous, false);
  }
  flight.world.notables[object.id] = null;
}
/** Noncombat removal preserves the casualty denominator while the pack remains represented. */
export function recordUnloadedPackMember(object: SpaceObject, flight: FlightState): void {
  const packId = object.enemy?.packId;
  const state = flight.combat;
  if (
    !liveEnemy(object) ||
    persistentObject(object) ||
    markerObjectTracked(flight, object) ||
    !packId ||
    !state ||
    !Object.hasOwn(state.initialPackSizes, packId)
  ) {
    return;
  }
  const unloaded = (state.unloadedPackMembers ??= {});
  unloaded[packId] = (unloaded[packId] ?? 0) + 1;
}

/** Existing required formations remain active with their site's normal chunk neighbourhood. */
function activateQuestGuardRecovery(
  context: GeographyContext,
  content: GameContent,
  flight: FlightState,
): ReadonlySet<string> {
  const leaders = questGuardRecovery.get(flight);
  if (!leaders?.size) {
    return emptyIds;
  }
  const actors = new Map([
    ...Object.values(flight.world.notables).flatMap((object) =>
      object ? [[object.id, object] as const] : [],
    ),
    ...flight.objects.map((object) => [object.id, object] as const),
  ]);
  const center = coordinates(context, content, flight.player);
  const active = new Set<string>();
  for (const id of leaders) {
    const guard = actors.get(id);
    if (
      !guard?.enemy ||
      guard.enemy.archetype !== "frigate" ||
      guard.enemy.disabled ||
      !liveEnemy(guard)
    ) {
      continue;
    }
    const site = stationGuardSite({ content, flight }, guard);
    if (
      site.status !== "present" ||
      !near(context, content, coordinates(context, content, site.center), center)
    ) {
      continue;
    }
    for (const actor of actors.values()) {
      if ((actor.id === id || actor.enemy?.escortOf === id) && liveEnemy(actor)) {
        active.add(actor.id);
      }
    }
  }
  for (const id of active) {
    activate(context, content, id, flight);
  }
  return active;
}

/** Ephemeral membership is reconstructed from each continued flight, never serialized. */
export function retainQuestGuardRecovery(
  context: GeographyContext,
  content: GameContent,
  guardIds: ReadonlySet<string>,
  flight: FlightState,
): ReadonlySet<string> {
  questGuardRecovery.set(flight, new Set(guardIds));
  return activateQuestGuardRecovery(context, content, flight);
}

export function worldSyncFlightRegion(
  context: GeographyContext,
  content: GameContent,
  flight: FlightState,
): void {
  const questGuards = activateQuestGuardRecovery(context, content, flight);
  worldActivateFlightRegion(context, content, flight.player, flight);
  const center = coordinates(context, content, flight.player);
  const index = indexWorld(context, content, flight);
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
      // A summoned guard stays loaded while it flies toward Ada (flight.ts cueGuards).
      flight.summonedGuards?.includes(object.id) ||
      questGuards.has(object.id) ||
      near(context, content, coordinates(context, content, object), center)
    ) {
      active.push(object);
      continue;
    }
    removed.add(object.id);
    if (
      (persistentObject(object) || markerObjectTracked(flight, object)) &&
      !derivedStation(context, flight, object)
    ) {
      if (object.hp > 0 && !(object.kind === "enemy" && !liveEnemy(object))) {
        flight.world.notables[object.id] = object;
        account(context, content, index, object, true);
      } else {
        worldRecordObjectRemoval(context, content, object, flight);
      }
    } else {
      recordUnloadedPackMember(object, flight);
    }
  }
  flight.objects = active;
  const grid = periodicWorldGrid(context, content.tuning.chunkSize);
  const seen = new Set<string>();
  const chunks = flight.chunks.flatMap((value) => {
    const point = chunkCoordinates(value);
    if (point === null || !near(context, content, point, center)) {
      return [];
    }
    if (context.worldSide === undefined) {
      return [value];
    }
    const identity = worldCellKey(grid, worldCell(grid, point));
    if (seen.has(identity)) {
      return [];
    }
    seen.add(identity);
    return [identity];
  });
  if (
    chunks.length !== flight.chunks.length ||
    chunks.some((value, index) => value !== flight.chunks[index])
  ) {
    flight.chunks = chunks;
  }
  worldPrunePackState(context, flight);
}

/** Unloaded counts alone never retain an otherwise unrepresented ordinary pack. */
/** Role packs of one encounter: a capital battle's escorts pack beside its capital's. */
const ESCORT_ROLE = ":escorts";
export function escortPackId(packId: string): string {
  return `${packId}${ESCORT_ROLE}`;
}
/** The encounter a pack belongs to; each role keeps its own pack and survivor count. */
export function encounterOf(packId: string): string {
  return packId.endsWith(ESCORT_ROLE) ? packId.slice(0, -ESCORT_ROLE.length) : packId;
}
/** The pack of the ambient group planned in the chunk with key `chunk`. */
export function ambientPackId(chunk: string): string {
  return `pack:${chunk}`;
}
/** A pack member's ship id, by its index in the pack. */
export function packMemberId(packId: string, index: number): string {
  return `${packId}:${index}`;
}

/**
 * Forgets an encounter once none of its members is loaded or retained. Role packs stay
 * while any role survives, so a destroyed role is not restored with the others.
 */
export function worldPrunePackState(context: GeographyContext, flight: FlightState): void {
  if (flight.combat) {
    const retained = indexes.get(flight.world)?.packs;
    const persistentPacks = retained
      ? Object.keys(retained)
      : Object.values(flight.world.notables).flatMap((object) =>
          object && liveEnemy(object) && object.enemy?.packId ? [object.enemy.packId] : [],
        );
    const packs = new Set([
      ...persistentPacks,
      ...flight.objects
        .filter(liveEnemy)
        .flatMap((object) => (object.enemy?.packId ? [object.enemy.packId] : [])),
    ]);
    const encounters = new Set([...packs].map(encounterOf));
    for (const id of Object.keys(flight.combat.initialPackSizes)) {
      if (!encounters.has(encounterOf(id)) && !context.retainedEncounters?.has(encounterOf(id))) {
        delete flight.combat.initialPackSizes[id];
        if (flight.combat.profiledPacks) {
          delete flight.combat.profiledPacks[id];
        }
        if (flight.combat.unloadedPackMembers) {
          delete flight.combat.unloadedPackMembers[id];
        }
      }
    }
    if (flight.combat.profiledPacks && !Object.keys(flight.combat.profiledPacks).length) {
      delete flight.combat.profiledPacks;
    }
    if (
      flight.combat.unloadedPackMembers &&
      !Object.keys(flight.combat.unloadedPackMembers).length
    ) {
      delete flight.combat.unloadedPackMembers;
    }
  }
}

export function worldActivateRouteEncounter(
  context: GeographyContext,
  content: GameContent,
  id: string,
  flight: FlightState,
): void {
  const guards = [...(indexWorld(context, content, flight).routes.get(id) ?? [])];
  for (const identity of guards) {
    activate(context, content, identity, flight);
  }
}

export function activateFlightRegion(content: GameContent, point: Vec, flight: FlightState): void {
  worldActivateFlightRegion({}, content, point, flight);
}
export function recordObjectRemoval(
  content: GameContent,
  object: SpaceObject,
  flight: FlightState,
): void {
  worldRecordObjectRemoval({}, content, object, flight);
}
export function syncFlightRegion(content: GameContent, flight: FlightState): void {
  worldSyncFlightRegion({}, content, flight);
}
export function activateRouteEncounter(
  content: GameContent,
  id: string,
  flight: FlightState,
): void {
  worldActivateRouteEncounter({}, content, id, flight);
}

export function prunePackState(flight: FlightState): void {
  worldPrunePackState({}, flight);
}
