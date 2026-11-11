import { ASTEROID_FIELDS, CHUNK_CATALOG } from "../data/chunk-catalog.ts";
import { ECONOMY } from "../data/economy.ts";
import {
  type EncounterEntry,
  type EnemyArchetype,
  enemyCatalog,
  enemyDefinition,
  enemyEncounterTuning,
  escortTuning,
  sectorEncounters,
  sectorEnemyTuning,
} from "../data/enemy-catalog.ts";
import { HOLODISKS } from "../data/holodisks.ts";
import { SCREEN } from "../data/screen.ts";
import type { PrototypeContent, SectorId } from "../data/types.ts";
import { BEAM, weaponAt, type WeaponDefinition } from "../data/weapon-catalog.ts";
import {
  ASTEROID_SHAPES,
  asteroidSize,
  bounce,
  orbitMotion,
  reflectDirection,
  rockFrame,
  sceneryBlocksSegment,
  sceneryContact,
  sceneryShape,
} from "./asteroids.ts";
import { planChunk } from "./chunk-templates.ts";
import {
  createEnemy,
  damageEnemy,
  enemyEffects,
  hardpointOffset,
  stepDebris,
  stepEnemy,
} from "./enemy-ai.ts";
import {
  activateFlightRegion,
  ACTIVE_CHUNK_RADIUS,
  beginFlightStep,
  escortPackId,
  persistentObject,
  prunePackState,
  recordObjectRemoval,
  recordUnloadedPackMember,
  retainedPackMembers,
  retainedRouteBlocked,
  syncFlightRegion,
} from "./geography.ts";

export { activateRouteEncounter, syncFlightRegion } from "./geography.ts";
import {
  carriesStardust,
  dropRandom,
  rollAsteroidStardust,
  rollEnemyDrop,
  splitStardust,
} from "./drops.ts";
import { nosePoint } from "./nose.ts";
import { planPlayerVolley } from "./player-projectiles.ts";
import { direction, speedFraction, stepShipMotion, turnToward } from "./ship-physics.ts";
import { stationById, stationsNear } from "./stations.ts";
import type {
  EconomyState,
  FlightEvent,
  FlightInput,
  FlightState,
  PickupRelease,
  SectorProgress,
  Shot,
  SpaceObject,
  Vec,
} from "./types.ts";
import { noLevels, shipTuning } from "./upgrades.ts";
import { markVisited, visitedChunk } from "./visited.ts";
import { collectWeapon, ensureOwnedWeapons, grantedAmmo, shotsLeft, spendShot } from "./weapons.ts";

const length = (v: Vec) => Math.hypot(v.x, v.y);
const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
/**
 * Smoothed requested movement direction per flight. It is transient so saves gain
 * no field; a restored or newly pressed stick starts from the velocity heading.
 */
const movementHeadings = new WeakMap<FlightState, Vec>();
// Whether the current step runs under reduced motion, which holds every rock on frame 0.
const reducedMotions = new WeakMap<FlightState, boolean>();
/** The frame a rock shows and collides with now: its spin frame, or 0 when it is still. */
function frameOf(flight: FlightState, object: SpaceObject): number {
  const shape = sceneryShape(object);
  return shape
    ? rockFrame(shape, flight.seed, reducedMotions.get(flight) ?? false, object.id, flight.time)
    : 0;
}
function hash(seed: number, x: number, y: number): number {
  let n = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}
function random(seed: number): () => number {
  let n = seed;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
function chunk(content: PrototypeContent, point: Vec): string {
  return `${Math.floor(point.x / content.tuning.chunkSize)},${Math.floor(point.y / content.tuning.chunkSize)}`;
}
/** Destinations and stations are safe areas; other objects protect nothing. */
function protectedRadius(content: PrototypeContent, object: SpaceObject): number | null {
  return object.kind === "destination"
    ? content.tuning.safeRadius
    : object.kind === "station"
      ? ECONOMY.station.safeRadius
      : null;
}
function safe(content: PrototypeContent, point: Vec, flight: FlightState): boolean {
  return flight.objects.some((o) => {
    const radius = protectedRadius(content, o);
    return radius !== null && distance(point, o) <= radius;
  });
}
/** An object's whole footprint: a drifting asteroid's covers its path around the orbit center. */
function footprint(object: SpaceObject): Vec & { radius: number } {
  return object.orbit
    ? { radius: object.radius + object.orbit.radius, x: object.orbit.x, y: object.orbit.y }
    : object;
}
/** Whether an object's footprint stays more than `clearance` from `point`. */
function clearOf(clearance: number, point: Vec, object: SpaceObject): boolean {
  const reach = footprint(object);
  return distance(reach, point) > clearance + reach.radius;
}
/**
 * Whether an object's whole footprint stays outside every safe area and the safe radius of
 * every launch point, so no rock or drift path reaches one.
 */
function clearOfSafeAreas(content: PrototypeContent, object: SpaceObject, flight: FlightState) {
  return (
    flight.objects.every((o) => {
      const radius = protectedRadius(content, o);
      return radius === null || clearOf(radius, o, object);
    }) && arrivalPoints(flight).every((point) => clearOf(content.tuning.safeRadius, point, object))
  );
}
const SCENERY = ["rock", "resource", "debris"];
const ASTEROID_SHAPE_LIST = [...ASTEROID_SHAPES.values()];
/**
 * Push a circle out of overlapping scenery along each contact normal and report every contact
 * once, with the obstacle's own velocity, so movers bounce and never stay embedded.
 */
/** Scenery reflects Ada's velocity and smoothed heading together, so recoil carries momentum. */
function adaSceneryContact(
  content: PrototypeContent,
  flight: FlightState,
): (normal: Vec, surface: Vec) => void {
  const { sceneryRecoil, sceneryRestitution } = content.tuning.flight;
  return (normal, surface) => {
    flight.velocity = bounce(sceneryRestitution, sceneryRecoil, normal, surface, flight.velocity);
    const heading = movementHeadings.get(flight);
    if (heading) {
      movementHeadings.set(flight, reflectDirection(normal, heading));
    }
  };
}

/**
 * An enemy hull touching Ada bounces both ships by the scenery rule, without damage. Each
 * reflects against the other's velocity; Ada takes the share m_enemy / (m_ada + m_enemy) of
 * her reflected change and of the push-out, with mass as size ratio squared, and the enemy
 * the rest. Their relative motion then matches a scenery bounce, so they always separate.
 */
export function bounceShips(
  content: PrototypeContent,
  flight: FlightState,
  object: SpaceObject,
): void {
  const enemy = object.enemy;
  const { sceneryRecoil, sceneryRestitution, shipRadius } = content.tuning.flight;
  const offset = { x: flight.player.x - object.x, y: flight.player.y - object.y };
  const gap = length(offset);
  const reach = object.radius + shipRadius;
  if (!enemy || gap >= reach) {
    return;
  }
  // Coincident centres separate along the enemy's facing.
  const normal = gap > 0 ? { x: offset.x / gap, y: offset.y / gap } : direction(enemy.facing);
  const inward = { x: -normal.x, y: -normal.y };
  const mass = enemyCatalog[enemy.archetype].sizeRatio ** 2;
  const adaShare = mass / (1 + mass);
  const enemyShare = 1 - adaShare;
  const ada = bounce(sceneryRestitution, sceneryRecoil, normal, enemy.velocity, flight.velocity);
  const hull = bounce(sceneryRestitution, sceneryRecoil, inward, flight.velocity, enemy.velocity);
  flight.velocity = {
    x: flight.velocity.x + (ada.x - flight.velocity.x) * adaShare,
    y: flight.velocity.y + (ada.y - flight.velocity.y) * adaShare,
  };
  enemy.velocity = {
    x: enemy.velocity.x + (hull.x - enemy.velocity.x) * enemyShare,
    y: enemy.velocity.y + (hull.y - enemy.velocity.y) * enemyShare,
  };
  const depth = reach - gap + 0.01;
  flight.player.x += normal.x * depth * adaShare;
  flight.player.y += normal.y * depth * adaShare;
  object.x += inward.x * depth * enemyShare;
  object.y += inward.y * depth * enemyShare;
  enemy.position = { x: object.x, y: object.y };
  const heading = movementHeadings.get(flight);
  if (heading) {
    movementHeadings.set(flight, reflectDirection(normal, heading));
  }
  if (enemy.heading) {
    enemy.heading = reflectDirection(inward, enemy.heading);
  }
  // Ada's push-out may meet scenery, which bounces her by its own rule.
  resolveScenery(flight, shipRadius, adaSceneryContact(content, flight), flight.player);
}

function resolveScenery(
  flight: FlightState,
  radius: number,
  onContact: (normal: Vec, surface: Vec) => void,
  position: Vec,
): void {
  const touched = new Set<SpaceObject>();
  for (let pass = 0; pass < 4; pass++) {
    let deepest: { contact: { normal: Vec; depth: number }; object: SpaceObject } | null = null;
    for (const object of flight.objects) {
      if (!SCENERY.includes(object.kind) || object.hp <= 0) {
        continue;
      }
      const contact = sceneryContact(object, position, radius, frameOf(flight, object));
      if (contact && (!deepest || contact.depth > deepest.contact.depth)) {
        deepest = { contact, object };
      }
    }
    if (!deepest) {
      return;
    }
    const { depth, normal } = deepest.contact;
    position.x += normal.x * (depth + 0.01);
    position.y += normal.y * (depth + 0.01);
    if (!touched.has(deepest.object)) {
      touched.add(deepest.object);
      onContact(normal, deepest.object.velocity ?? { x: 0, y: 0 });
    }
  }
}
/** Station sites within the active region become persistent station objects. */
function ensureStations(content: PrototypeContent, point: Vec, flight: FlightState): void {
  const reach = (ACTIVE_CHUNK_RADIUS + 1) * content.tuning.chunkSize;
  for (const site of stationsNear(ECONOMY, flight.sector, reach, point)) {
    if (
      !flight.objects.some((object) => object.id === site.id) &&
      !Object.hasOwn(flight.world.notables, site.id)
    ) {
      placeStation(site, flight);
    }
  }
}
function placeStation(site: Vec & { id: string }, flight: FlightState): SpaceObject {
  const station: SpaceObject = {
    hp: 1,
    id: site.id,
    kind: "station",
    radius: ECONOMY.station.radius,
    x: site.x,
    y: site.y,
  };
  flight.objects.push(station);
  // A station's safe area holds no layout object or drift path from chunks generated before it.
  clearLayoutObjects(
    (object) =>
      object === station ||
      object.kind === "destination" ||
      clearOf(ECONOMY.station.safeRadius, station, object),
    flight,
  );
  return station;
}
/** Ensures a discovered station is present, for travel. */
export function ensureStation(
  content: PrototypeContent,
  id: string,
  flight: FlightState,
): SpaceObject | null {
  const existing = flight.objects.find((o) => o.id === id && o.kind === "station");
  if (existing) {
    return existing;
  }
  const site = stationById(ECONOMY, flight.sector, id);
  if (!site) {
    return null;
  }
  activateFlightRegion(content, site, flight);
  return (
    flight.objects.find((o) => o.id === id && o.kind === "station") ?? placeStation(site, flight)
  );
}
const chunkIndexes = new WeakMap<
  FlightState,
  { keys: Set<string>; length: number; source: string[] }
>();
function generatedChunks(flight: FlightState): Set<string> {
  let index = chunkIndexes.get(flight);
  if (!index || index.source !== flight.chunks || index.length !== flight.chunks.length) {
    index = { keys: new Set(flight.chunks), length: flight.chunks.length, source: flight.chunks };
    chunkIndexes.set(flight, index);
  }
  return index.keys;
}

function generate(content: PrototypeContent, point: Vec, flight: FlightState): void {
  activateFlightRegion(content, point, flight);
  ensureStations(content, point, flight);
  const size = content.tuning.chunkSize;
  const tuning = content.tuning.flight;
  const generated = generatedChunks(flight);
  const existing = new Set(flight.objects.map((object) => object.id));
  const cx = Math.floor(point.x / size);
  const cy = Math.floor(point.y / size);
  for (let x = cx - 2; x <= cx + 2; x++) {
    for (let y = cy - 2; y <= cy + 2; y++) {
      const key = `${x},${y}`;
      if (generated.has(key)) {
        continue;
      }
      flight.chunks.push(key);
      generated.add(key);
      chunkIndexes.get(flight)!.length = flight.chunks.length;
      const field = ASTEROID_FIELDS[flight.sector];
      const plan = planChunk(CHUNK_CATALOG, {
        asteroids: { field, shapes: ASTEROID_SHAPE_LIST },
        clearance: content.tuning.flight.shipRadius,
        objectsPerChunk: tuning.objectsPerChunk,
        rockRadius: tuning.rockRadius,
        sector: flight.sector,
        seed: flight.seed,
        shipRadius: tuning.shipRadius,
        size,
        spawnWeights: tuning.spawnWeights,
        x,
        y,
      });
      generateRegion(content, x, y, flight);
      for (const placement of plan.placements) {
        const shape = placement.asteroid ? ASTEROID_SHAPES.get(placement.asteroid) : undefined;
        const object: SpaceObject = {
          hp: placement.kind === "pickup" ? 1 : shape ? field.hp[shape.size] : tuning.rockHp,
          id: placement.id,
          kind: placement.kind,
          radius: placement.kind === "pickup" ? tuning.pickupRadius : placement.radius,
          x: placement.x,
          y: placement.y,
          ...(shape ? { asteroid: shape.id } : {}),
        };
        // A drifting asteroid's place on its seeded path follows flight time, so paging and
        // saves resume it where it would be.
        if (placement.orbit) {
          object.orbit = { ...placement.orbit, x: placement.x, y: placement.y };
          const motion = orbitMotion(flight.time, object.orbit);
          object.x = motion.position.x;
          object.y = motion.position.y;
          object.velocity = motion.velocity;
        }
        if (object.kind !== "rock") {
          object.role = "discovery";
        }
        // A discovery cache holds Stardust; weapons come only from shops and enemy drops.
        if (object.kind === "pickup") {
          object.amount = ECONOMY.discoveryStardust;
        }
        if (
          !existing.has(object.id) &&
          !Object.hasOwn(flight.world.notables, object.id) &&
          clearOf(content.tuning.safeRadius, flight.player, object) &&
          clearOfSafeAreas(content, object, flight)
        ) {
          flight.objects.push(object);
          existing.add(object.id);
        }
      }
    }
  }
}

function combat(flight: FlightState) {
  return (flight.combat ??= { initialPackSizes: {}, routeEncounters: [] });
}

function spawnEnemy(
  content: PrototypeContent,
  archetype: EnemyArchetype,
  id: string,
  point: Vec,
  packId: string | null = null,
  phase = 0,
  escortOf: string | null = null,
): SpaceObject {
  const definition = enemyCatalog[archetype];
  return {
    ...point,
    enemy: createEnemy(definition, { archetype, escortOf, id, packId, phase }, point),
    hp: definition.hp,
    id,
    kind: "enemy",
    radius: content.tuning.flight.shipRadius * definition.sizeRatio,
  };
}

/**
 * Chooses an encounter's archetype by weight and its group size from that archetype's
 * inclusive range. Rolls are uniform in [0, 1); the count roll is drawn first so the
 * equal-weight shared table keeps its original seeded results.
 */
export function rollEncounter(
  table: readonly EncounterEntry[],
  countRoll: number,
  archetypeRoll: number,
): { archetype: EnemyArchetype; count: number; escorts?: EncounterEntry["escorts"] } {
  const total = table.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  let threshold = archetypeRoll * total;
  let chosen = table.at(-1);
  for (const entry of table) {
    const weight = Math.max(0, entry.weight);
    if (threshold < weight) {
      chosen = entry;
      break;
    }
    threshold -= weight;
  }
  const [low, high] = chosen?.groupSize ?? [1, 1];
  const result = {
    archetype: chosen?.archetype ?? "fighter",
    count: low + Math.floor(countRoll * (high - low + 1)),
  };
  return chosen?.escorts ? { ...result, escorts: chosen.escorts } : result;
}

/**
 * Whether chunk index `index` hosts an encounter cell for a possibly fractional chunk
 * spacing: it contains a multiple of the spacing. Integer spacings host every multiple.
 */
export function hostsEncounterCell(spacing: number, index: number): boolean {
  return Math.ceil(index / spacing) * spacing < index + 1;
}

/**
 * Chunk spacing of encounter cells. Areal density follows the galaxy's encounter rate, so
 * the spacing shrinks with its square root; adjacent cells stay a quiet distance apart.
 */
export function encounterSpacing(content: PrototypeContent, sector: SectorId): number {
  const base = Math.max(
    3,
    Math.ceil(enemyEncounterTuning.quietDistance / content.tuning.chunkSize),
  );
  return base / Math.sqrt(sectorEnemyTuning[sector].encounterRate);
}

/** Flight starts and Travel arrivals, which encounters keep clear of. */
function arrivalPoints(flight: FlightState): Vec[] {
  return [FLIGHT_START, ...(flight.arrivals ?? [])];
}
const FLIGHT_START: Vec = { x: 0, y: 0 };

/** Farthest an encounter's ships are placed from its cell centre, hulls included. */
export function encounterReach(
  content: PrototypeContent,
  archetype: EnemyArchetype,
  count: number,
  escorts: EncounterEntry["escorts"],
): number {
  const radius = (type: EnemyArchetype) =>
    enemyCatalog[type].sizeRatio * content.tuning.flight.shipRadius;
  const line = Math.max(0, count - 1) * 85 + radius(archetype);
  const ring = escorts
    ? radius(archetype) + escortTuning.stationGap + radius(escorts.archetype)
    : 0;
  return Math.max(line, ring);
}

/** Whether ships placed within `reach` of `point` could come within the calm radius. */
function nearArrival(
  content: PrototypeContent,
  flight: FlightState,
  reach: number,
  point: Vec,
): boolean {
  return arrivalPoints(flight).some(
    (arrival) => distance(arrival, point) < content.tuning.flight.arrivalCalm + reach,
  );
}

function generateRegion(
  content: PrototypeContent,
  x: number,
  y: number,
  flight: FlightState,
): void {
  const size = content.tuning.chunkSize;
  // One encounter cell per quiet-distance grid; adjacent chunk traversal cannot duplicate it.
  const spacing = encounterSpacing(content, flight.sector);
  if (!hostsEncounterCell(spacing, x) || !hostsEncounterCell(spacing, y)) {
    return;
  }
  const next = random(hash(flight.seed ^ 9173, x, y));
  const center = { x: (x + 0.5) * size, y: (y + 0.5) * size };
  if (
    distance(center, flight.player) < content.tuning.safeRadius * 2 ||
    safe(content, center, flight)
  ) {
    return;
  }
  const region = Math.floor(next() * 4);
  if (region === 3) {
    const [low, high] = enemyEncounterTuning.debris.count;
    const count = low + Math.floor(next() * (high - low + 1));
    const angle = next() * Math.PI * 2;
    const [slow, fast] = enemyEncounterTuning.debris.speedRatio;
    const speed = content.tuning.maxSpeed * (slow + next() * (fast - slow));
    for (let i = 0; i < count; i++) {
      const point = { x: center.x + (next() - 0.5) * size, y: center.y + (next() - 0.5) * size };
      const id = `ballistic:${x},${y}:${i}`;
      if (
        !safe(content, point, flight) &&
        !flight.objects.some((object) => object.id === id) &&
        !Object.hasOwn(flight.world.notables, id)
      ) {
        flight.objects.push({
          ...point,
          hp: content.tuning.flight.rockHp,
          id,
          kind: "debris",
          radius: content.tuning.flight.rockRadius,
          velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        });
      }
    }
    return;
  }
  const packId = `pack:${x},${y}`;
  const countRoll = next();
  const { archetype, count, escorts } = rollEncounter(
    sectorEncounters[flight.sector],
    countRoll,
    next(),
  );
  // Launches and jump arrivals begin calm: the whole encounter stays clear of them.
  if (nearArrival(content, flight, encounterReach(content, archetype, count, escorts), center)) {
    return;
  }
  admitGroup(content, flight, next, { archetype, count, escortOf: null, packId }, (index) => ({
    x: center.x + index * 85,
    y: center.y,
  }));
  if (escorts) {
    // Escorts form their own pack, so regeneration restores each group's survivors by count.
    const gap =
      enemyCatalog[archetype].sizeRatio * content.tuning.flight.shipRadius +
      escortTuning.stationGap;
    admitGroup(
      content,
      flight,
      next,
      { ...escorts, escortOf: `${packId}:0`, packId: escortPackId(packId) },
      (_, phase) => ({ x: center.x + Math.cos(phase) * gap, y: center.y + Math.sin(phase) * gap }),
    );
  }
}

/**
 * Admits a seeded group as one pack. A pack seen before admits only its unloaded survivor
 * budget, preserving its casualty count; escorts start on their stations.
 */
function admitGroup(
  content: PrototypeContent,
  flight: FlightState,
  next: () => number,
  group: { archetype: EnemyArchetype; count: number; escortOf: string | null; packId: string },
  place: (index: number, phase: number) => Vec,
): void {
  const { archetype, count, escortOf, packId } = group;
  const state = combat(flight);
  const initialized = Object.hasOwn(state.initialPackSizes, packId);
  let budget = initialized ? (state.unloadedPackMembers?.[packId] ?? 0) : count;
  let admitted = 0;
  const existing = flight.objects.filter(
    (object) => object.hp > 0 && object.enemy?.packId === packId,
  ).length;
  // A pack recorded under an earlier roster can exceed this cell's roll; keep its slots.
  const slots = initialized ? Math.max(count, state.initialPackSizes[packId] ?? 0) : count;
  for (let i = 0; i < slots && budget > 0; i++) {
    const phase = next() * Math.PI * 2;
    const object = spawnEnemy(
      content,
      archetype,
      `${packId}:${i}`,
      place(i, phase),
      packId,
      phase,
      escortOf,
    );
    if (persistentObject(object)) {
      object.persistent = false;
    }
    if (
      !safe(content, object, flight) &&
      !flight.objects.some((other) => other.id === object.id) &&
      !Object.hasOwn(flight.world.notables, object.id)
    ) {
      flight.objects.push(object);
      admitted++;
      budget--;
    }
  }
  if (!initialized) {
    state.initialPackSizes[packId] = existing + admitted;
  } else if (admitted && state.unloadedPackMembers) {
    if (budget > 0) {
      state.unloadedPackMembers[packId] = budget;
    } else {
      delete state.unloadedPackMembers[packId];
      if (!Object.keys(state.unloadedPackMembers).length) {
        delete state.unloadedPackMembers;
      }
    }
  }
}

/** Layout clearance changes the roster without recording a combat casualty. */
function clearLayoutObjects(keep: (object: SpaceObject) => boolean, flight: FlightState): void {
  flight.objects = flight.objects.filter((object) => {
    if (keep(object) || persistentObject(object)) {
      return true;
    }
    recordUnloadedPackMember(object, flight);
    return false;
  });
  prunePackState(flight);
}

function capital(object: SpaceObject): boolean {
  return (
    object.kind === "enemy" &&
    object.hp > 0 &&
    object.enemy?.archetype === "capital" &&
    !enemyEffects(enemyCatalog[object.enemy.archetype], object.enemy).defeated
  );
}

function capitalGap(): number {
  // The inverse isometric viewport has equal world bounding-box width and height.
  const span = SCREEN.width / 2 + SCREEN.height;
  return Math.hypot(span, span);
}

function enemySpacing(first: SpaceObject, second: SpaceObject): number {
  return first.radius + second.radius + (capital(first) && capital(second) ? capitalGap() : 0);
}

function routePlacementRandom(seed: number, id: string): () => number {
  let placementSeed = seed;
  const name = `route-placement:${id}`;
  for (let index = 0; index < name.length; index++) {
    placementSeed = hash(placementSeed, name.charCodeAt(index), index);
  }
  return random(placementSeed);
}

/** Move only capitals inside the gap of an earlier kept capital; paged-in capitals come last. */
function settleResumedCapitals(content: PrototypeContent, flight: FlightState): void {
  const kept: SpaceObject[] = [];
  const displaced: SpaceObject[] = [];
  for (const object of flight.objects.filter(capital)) {
    const crowded = kept.some((other) => distance(object, other) < enemySpacing(object, other));
    (crowded ? displaced : kept).push(object);
  }
  // Kept capitals are fixed obstacles, so each displaced capital fails reservation and searches.
  if (displaced.length) {
    placeGuards(content, displaced, flight);
  }
}

function relocateRouteGuards(content: PrototypeContent, flight: FlightState): void {
  placeGuards(
    content,
    flight.objects.filter(
      (object) =>
        object.kind === "enemy" &&
        persistentObject(object) &&
        object.hp > 0 &&
        (!object.enemy ||
          !enemyEffects(enemyCatalog[object.enemy.archetype], object.enemy).defeated),
    ),
    flight,
  );
}

/** Plan all guard positions before applying layout changes to their persistent state. */
function placeGuards(content: PrototypeContent, guards: SpaceObject[], flight: FlightState): void {
  const destinations = flight.objects.filter((object) => protectedRadius(content, object) !== null);
  const positions = new Map<SpaceObject, Vec>();
  const maxRadius = flight.objects.reduce(
    (radius, object) => Math.max(radius, object.radius),
    content.tuning.safeRadius,
  );
  const guardSet = new Set(guards);
  // A capital ignores unplaced capital guards; each of those is placed against it afterward.
  const blocked = (guard: SpaceObject, point: Vec): boolean =>
    destinations.some(
      (object) =>
        distance(object, point) < (protectedRadius(content, object) ?? 0) + guard.radius + 120,
    ) ||
    flight.objects.some(
      (object) =>
        object !== guard &&
        !(capital(guard) && capital(object) && guardSet.has(object) && !positions.has(object)) &&
        ["enemy", "rock", "resource", "debris"].includes(object.kind) &&
        object.hp > 0 &&
        distance(positions.get(object) ?? object, point) <
          Math.max(object.radius + guard.radius + 20, enemySpacing(guard, object)),
    );
  // Reserve valid existing capital positions before searching for displaced or newly added guards.
  for (const guard of guards) {
    if (capital(guard) && !blocked(guard, guard)) {
      positions.set(guard, { x: guard.x, y: guard.y });
    }
  }
  for (const guard of guards) {
    if (positions.has(guard)) {
      continue;
    }
    const point = { x: guard.x, y: guard.y };
    const spacing = capital(guard) ? Math.max(120, capitalGap()) : 120;
    const stride = 2 * (guard.radius + maxRadius + spacing);
    const angle = capital(guard) ? routePlacementRandom(flight.seed, guard.id)() * Math.PI * 2 : 0;
    const heading = { x: Math.cos(angle), y: Math.sin(angle) };
    // Each obstacle excludes less than one stride along this deterministic search direction.
    while (blocked(guard, point)) {
      point.x += heading.x * stride;
      point.y += heading.y * stride;
    }
    positions.set(guard, point);
  }
  for (const [guard, point] of positions) {
    if (guard.x === point.x && guard.y === point.y) {
      continue;
    }
    guard.x = point.x;
    guard.y = point.y;
    if (guard.enemy) {
      guard.enemy.home = { ...point };
      guard.enemy.position = { ...point };
      guard.enemy.velocity = { x: 0, y: 0 };
    }
  }
}

export { relocateRouteGuards as settleRouteEncounters };

export function routeBlocked(id: string, flight: FlightState): boolean {
  return (
    retainedRouteBlocked(id, flight) ||
    flight.objects.some(
      (object) => object.kind === "enemy" && object.routeId === id && object.hp > 0,
    )
  );
}

/**
 * The holodisk leader's pack. Its members persist so the fight cannot reroll, but only the
 * leader blocks the route, so a fleeing member never strands the holodisk.
 */
function guardPack(content: PrototypeContent, leader: Vec, flight: FlightState): void {
  const { pack, packSize } = HOLODISKS.guard;
  const packId = "route:holodisk:pack";
  for (let i = 0; i < packSize; i++) {
    const angle = (i * Math.PI * 2) / packSize;
    const member = spawnEnemy(
      content,
      pack,
      `${packId}:${i}`,
      { x: leader.x + Math.cos(angle) * 90, y: leader.y + Math.sin(angle) * 90 },
      packId,
      angle,
    );
    member.persistent = true;
    flight.objects.push(member);
  }
  combat(flight).initialPackSizes[packId] = packSize;
}

export function ensureRouteEncounter(
  content: PrototypeContent,
  id: string,
  flight: FlightState,
): SpaceObject | null {
  const existing = flight.objects.find(
    (object) => object.kind === "enemy" && object.routeId === id,
  );
  if (existing) {
    return existing;
  }
  if (
    Object.hasOwn(flight.world.notables, `route:${id}`) ||
    combat(flight).routeEncounters.includes(id)
  ) {
    return null;
  }
  const destination = flight.objects.find(
    (object) => object.kind === "destination" && object.id === id,
  );
  if (!destination) {
    return null;
  }
  const holodisk = id === "holodisk";
  const archetype: EnemyArchetype = holodisk
    ? HOLODISKS.guard.leader
    : flight.sector === 1
      ? "frigate"
      : "capital";
  activateFlightRegion(content, destination, flight);
  const radius = enemyCatalog[archetype].sizeRatio * content.tuning.flight.shipRadius;
  const heading = direction({
    x: flight.player.x - destination.x,
    y: flight.player.y - destination.y,
  });
  const approach = length(heading) ? heading : { x: 0, y: 1 };
  const offset = content.tuning.safeRadius + radius + 120;
  const point = { x: destination.x + approach.x * offset, y: destination.y + approach.y * offset };
  const object = spawnEnemy(content, archetype, `route:${id}`, point);
  object.routeId = id;
  // Clear the guard footprint and leave the protected destination untouched.
  clearLayoutObjects(
    (other) => other.kind === "destination" || distance(other, point) > other.radius + radius + 20,
    flight,
  );
  flight.objects.push(object);
  if (holodisk) {
    guardPack(content, point, flight);
  }
  relocateRouteGuards(content, flight);
  combat(flight).routeEncounters.push(id);
  return object;
}

export function ensureDestination(
  content: PrototypeContent,
  id: string,
  flight: FlightState,
): SpaceObject {
  const existing = flight.objects.find((o) => o.id === id && o.kind === "destination");
  if (existing) {
    return existing;
  }
  const heading = direction(
    length(flight.velocity)
      ? flight.velocity
      : length(flight.facing)
        ? flight.facing
        : { x: 0, y: -1 },
  );
  const span = content.tuning.chunkSize * 2;
  const index = flight.objects.filter((o) => o.kind === "destination").length;
  const offset = Math.ceil(index / 2) * (index % 2 ? 1 : -1) * content.tuning.safeRadius * 2.5;
  const target = {
    x: flight.player.x + heading.x * span - heading.y * offset,
    y: flight.player.y + heading.y * span + heading.x * offset,
  };
  // Story destinations keep clear of each other and of the sector's fixed stations.
  while (
    flight.objects.some(
      (o) => o.kind === "destination" && distance(o, target) < content.tuning.safeRadius * 2,
    ) ||
    stationsNear(ECONOMY, flight.sector, ECONOMY.station.destinationClearance, target).length > 0
  ) {
    target.x -= heading.y * content.tuning.safeRadius * 2.5;
    target.y += heading.x * content.tuning.safeRadius * 2.5;
  }
  generate(content, target, flight);
  const object: SpaceObject = { ...target, hp: 1, id, kind: "destination", radius: 30, role: id };
  flight.objects.push(object);
  // A destination's safe area holds no layout object or drift path from earlier chunks.
  clearLayoutObjects(
    (o) => o.kind === "destination" || clearOf(content.tuning.safeRadius, object, o),
    flight,
  );
  relocateRouteGuards(content, flight);
  flight.shots = flight.shots.filter(
    (s) => !s.enemy || distance(s, object) > content.tuning.safeRadius,
  );
  return object;
}

/** Reposition an undiscovered encounter only while its old location is outside the generated near field. */
export function placeDestinationAhead(
  content: PrototypeContent,
  id: string,
  flight: FlightState,
): SpaceObject {
  const existing = flight.objects.find((o) => o.id === id && o.kind === "destination");
  if (!existing || distance(existing, flight.player) > content.tuning.chunkSize * 2.5) {
    flight.objects = flight.objects.filter((o) => o !== existing);
    return ensureDestination(content, id, flight);
  }
  return existing;
}

export type Loadout = Pick<EconomyState, "ammo" | "levels" | "ownedWeapons" | "weapon">;

export function createFlight(
  content: PrototypeContent,
  sector: SectorId,
  seed: number,
  progress: Pick<SectorProgress, "known">,
  loadout: Loadout = {
    ammo: grantedAmmo([]),
    levels: noLevels(),
    ownedWeapons: [],
    weapon: "basic",
  },
): FlightState {
  const levels = structuredClone(loadout.levels);
  const flight: FlightState = {
    ammo: { ...loadout.ammo },
    cargo: 0,
    chunks: [],
    dangerFor: 0,
    dockId: null,
    facing: { x: 0, y: -1 },
    fireCooldown: 0,
    freshChunk: "0,0",
    freshDistance: 0,
    levels,
    nextId: 0,
    objects: [],
    ownedWeapons: [...loadout.ownedWeapons],
    player: { x: 0, y: 0 },
    sector,
    seed,
    shield: shipTuning(ECONOMY, content, levels).shieldMax,
    shots: [],
    sinceDamage: content.tuning.shieldRechargeDelay,
    time: 0,
    velocity: { x: 0, y: 0 },
    visited: {},
    // An empty saved selection starts the flight on Basic.
    weapon: shotsLeft(loadout.weapon, loadout) === 0 ? "basic" : loadout.weapon,
    weaponSwitchFor: 0,
    world: { notables: {}, version: 1 },
  };
  markVisited(flight.visited, "0,0");
  generate(content, flight.player, flight);
  for (const id of progress.known) {
    ensureDestination(content, id, flight);
  }
  syncFlightRegion(content, flight);
  return flight;
}

export function teleport(content: PrototypeContent, id: string, flight: FlightState): boolean {
  if (flight.dangerFor > 0) {
    return false;
  }
  const object = flight.objects.find(
    (o) => (o.kind === "destination" || o.kind === "station") && o.id === id,
  );
  if (!object) {
    return false;
  }
  beginFlightStep(flight);
  // Station arrivals stop inside the safe area, outside the dock, so travel never docks.
  const arrival =
    object.kind === "station"
      ? outsideDock(stationDockRadius(content) + 40, object)
      : { x: object.x, y: object.y };
  // A jump arrival begins calm: no new encounter is placed near it, and ordinary encounter
  // ships already near it leave without counting as casualties. Guards keep their posts.
  if (!arrivalPoints(flight).some((point) => point.x === arrival.x && point.y === arrival.y)) {
    flight.arrivals = [...(flight.arrivals ?? []), { ...arrival }];
  }
  clearLayoutObjects(
    (other) =>
      other.kind !== "enemy" ||
      distance(other, arrival) >= content.tuning.flight.arrivalCalm + other.radius,
    flight,
  );
  generate(content, object, flight);
  flight.player = arrival;
  flight.velocity = { x: 0, y: 0 };
  flight.freshChunk = null;
  const key = chunk(content, object);
  markVisited(flight.visited, key);
  flight.shots = flight.shots.filter(
    (s) => !s.enemy || distance(s, object) > content.tuning.safeRadius,
  );
  syncFlightRegion(content, flight);
  return true;
}

function fire(
  content: PrototypeContent,
  viewportWidth: number,
  aim: Vec,
  flight: FlightState,
  events: FlightEvent[],
): void {
  ensureOwnedWeapons(flight);
  const definition = weaponAt(flight.weapon, flight.levels.weapons[flight.weapon]);
  // One shot uses one; emptying the weapon switches to Basic after this shot.
  if (spendShot(flight)) {
    events.push({ type: "outOfAmmo" });
  }
  // Every shot and beam leaves the ship's nose for its heading; ranges run from there.
  const origin = nosePoint(flight.facing, flight.player);
  if (definition.projectileKind === "beam") {
    fireBeam(content, definition, aim, origin, flight, events);
    flight.fireCooldown += definition.intervalSeconds;
    return;
  }
  const volley = planPlayerVolley(definition, {
    aim,
    baseDamage: content.tuning.flight.playerShotDamage,
    baseLifetime: content.tuning.flight.projectileLifetime,
    baseSpeed: content.tuning.maxSpeed * content.tuning.flight.projectileSpeedFactor,
    origin,
    viewportWidth,
  });
  for (const projectile of volley.projectiles) {
    const shot: Shot = {
      ...projectile,
      enemy: false,
      hitIds: [],
      id: `shot:${flight.nextId++}`,
      piercing: false,
    };
    flight.shots.push(shot);
    // A shot that starts inside an obstacle Ada is touching strikes it at once.
    strike(content, shot, flight, events);
  }
  flight.fireCooldown += volley.interval;
}

function damage(content: PrototypeContent, flight: FlightState): void {
  if (safe(content, flight.player, flight)) {
    return;
  }
  flight.shield = Math.max(0, flight.shield - content.tuning.enemyDamage);
  flight.sinceDamage = 0;
  flight.dangerFor = content.tuning.dangerReleaseSeconds;
}
/**
 * Fraction of maxSpeed requested by a movement deflection from 0 (just past the dead zone)
 * to 1 (full reach). No input requests no speed; any input requests at least minSpeedFraction.
 */
export function movementSpeedFraction(
  tuning: Pick<PrototypeContent["tuning"], "minSpeedFraction" | "speedCurveExponent">,
  deflection: number,
): number {
  const m = Math.min(1, Math.max(0, deflection));
  if (!m) {
    return 0;
  }
  return tuning.minSpeedFraction + (1 - tuning.minSpeedFraction) * m ** tuning.speedCurveExponent;
}
/** Ada's maximum speed: the base maximum scaled by her physics speedRatio. */
function adaMaxSpeed(tuning: Pick<PrototypeContent["tuning"], "maxSpeed" | "physics">): number {
  return tuning.maxSpeed * tuning.physics.speedRatio;
}
/**
 * Current ship speed as a fraction of Ada's tuned maximum speed (base times her engine
 * tuning), clamped to [0, 1], for jets. Flights without levels use the base speed.
 */
export function shipSpeedFraction(
  content: PrototypeContent,
  flight: Pick<FlightState, "velocity"> & Partial<Pick<FlightState, "levels">>,
): number {
  const physics = shipTuning(ECONOMY, content, flight.levels ?? noLevels()).physics;
  return speedFraction(
    adaMaxSpeed({ maxSpeed: content.tuning.maxSpeed, physics }),
    flight.velocity,
  );
}
/** The point of a station's dock, where flying in docks. */
export function stationDock(station: Vec): Vec {
  return {
    x: station.x + ECONOMY.station.dockOffset.x,
    y: station.y + ECONOMY.station.dockOffset.y,
  };
}
/**
 * How near the dock Ada's centre must be to dock: her hull circle overlaps the dock's mouth
 * circle scaled by the dock forgiveness (gameplay/economy.md).
 */
export function stationDockRadius(content: PrototypeContent): number {
  const { dockForgiveness, dockMouthRadius } = ECONOMY.station;
  return dockMouthRadius * dockForgiveness + content.tuning.flight.shipRadius;
}
/** The point `distance` from a station's dock along its outward direction. */
function outsideDock(distance: number, station: Vec): Vec {
  const dock = stationDock(station);
  const outward = ECONOMY.station.dockOutward;
  return { x: dock.x + outward.x * distance, y: dock.y + outward.y * distance };
}
/**
 * Undocking places Ada at rest just outside the dock, so flying back in docks again.
 * Returns false without a flight at that station.
 */
export function undockFlight(content: PrototypeContent, id: string, flight: FlightState): boolean {
  const station = flight.objects.find((object) => object.kind === "station" && object.id === id);
  if (!station) {
    return false;
  }
  flight.player = outsideDock(stationDockRadius(content) + 1, station);
  flight.velocity = { x: 0, y: 0 };
  flight.dockId = null;
  movementHeadings.delete(flight);
  return true;
}
function move(
  content: PrototypeContent,
  dt: number,
  input: FlightInput,
  flight: FlightState,
): void {
  const magnitude = Math.min(1, length(input.move));
  // Engine tuning changes only Ada's physics; enemies keep reading the base maxSpeed.
  const physics = shipTuning(ECONOMY, content, flight.levels).physics;
  const top = adaMaxSpeed({ maxSpeed: content.tuning.maxSpeed, physics });
  const motion = stepShipMotion(
    physics,
    dt,
    { maxSpeed: top },
    {
      direction: input.move,
      speed: movementSpeedFraction(content.tuning, magnitude) * top,
    },
    { heading: movementHeadings.get(flight) ?? null, velocity: flight.velocity },
  );
  if (motion.heading) {
    movementHeadings.set(flight, motion.heading);
  } else {
    movementHeadings.delete(flight);
  }
  flight.velocity = motion.velocity;
  const start = { ...flight.player };
  const { shipRadius } = content.tuning.flight;
  const onContact = adaSceneryContact(content, flight);
  // Drifting scenery can reach a resting ship, so contacts resolve before any travel.
  resolveScenery(flight, shipRadius, onContact, flight.player);
  const steps = Math.max(1, Math.ceil((length(flight.velocity) * dt) / 4));
  for (let i = 0; i < steps; i++) {
    const before = { ...flight.player };
    const key = chunk(content, before);
    flight.player.x += (flight.velocity.x * dt) / steps;
    flight.player.y += (flight.velocity.y * dt) / steps;
    resolveScenery(flight, shipRadius, onContact, flight.player);
    const afterKey = chunk(content, flight.player);
    if (flight.freshChunk === key) {
      flight.freshDistance += distance(before, flight.player);
    }
    if (afterKey !== key) {
      flight.freshChunk = visitedChunk(flight.visited, afterKey) ? null : afterKey;
      markVisited(flight.visited, afterKey);
    }
  }
  if (
    length(input.aim) <= 0.01 &&
    distance(start, flight.player) > 0.001 &&
    length(flight.velocity)
  ) {
    flight.facing = turnToward(dt, physics.aimTurnSeconds, flight.velocity, flight.facing);
  }
}
function enemies(
  content: PrototypeContent,
  dt: number,
  flight: FlightState,
  events: FlightEvent[],
  shotDelays: Map<string, number>,
): boolean {
  let threatening = false;
  const objects = flight.objects.filter((object) => object.kind === "enemy" && object.hp > 0);
  for (const object of objects) {
    // Legacy saved ships gain canonical state without resetting their damage or identity.
    if (!object.enemy) {
      object.enemy = createEnemy(
        enemyCatalog.fighter,
        { archetype: "fighter", id: object.id, packId: null, phase: 0 },
        object,
      );
      object.enemy.hp = object.hp;
    }
    // Hit circles follow the catalog, so saves from earlier sizes adopt the current ones.
    object.radius =
      content.tuning.flight.shipRadius * enemyCatalog[object.enemy.archetype].sizeRatio;
  }
  const peers = objects.flatMap((object) => (object.enemy ? [object.enemy] : []));
  for (const object of objects) {
    const state = object.enemy!;
    const definition = enemyDefinition(flight.sector, state.archetype);
    const targetable = !safe(content, flight.player, flight) && !safe(content, object, flight);
    const visible = !flight.objects.some(
      (obstacle) =>
        SCENERY.includes(obstacle.kind) &&
        obstacle.hp > 0 &&
        sceneryBlocksSegment(obstacle, object, flight.player, 0, frameOf(flight, obstacle)),
    );
    const intent = stepEnemy(
      definition,
      {
        adaSpeed: content.tuning.maxSpeed,
        adaWidth: content.tuning.flight.shipRadius * 2,
        dormantPackMembers: retainedPackMembers(content, flight),
        dt,
        initialPackSizes: combat(flight).initialPackSizes,
        peers,
        player: flight.player,
        speedCapRatio: enemyEncounterTuning.speedCapRatio,
        targetable,
        visibility: visible ? "visible" : "occluded",
      },
      { ...state, position: { x: object.x, y: object.y } },
    );
    object.enemy = intent.state;
    if (intent.effects.defeated) {
      destroyEnemy(object, flight);
      events.push({ type: "enemyDisabled" });
      continue;
    }
    let velocity = intent.velocity;
    // Enemies bounce off scenery by the same rule as Ada; safe areas and peers still block.
    const { sceneryRecoil, sceneryRestitution } = content.tuning.flight;
    const onContact = (normal: Vec, surface: Vec): void => {
      velocity = bounce(sceneryRestitution, sceneryRecoil, normal, surface, velocity);
      object.enemy!.velocity = { ...velocity };
    };
    const steps = Math.max(1, Math.ceil((length(velocity) * dt) / 4));
    for (let i = 0; i < steps; i++) {
      for (const axis of ["x", "y"] as const) {
        const point = { x: object.x, y: object.y };
        point[axis] += (velocity[axis] * dt) / steps;
        const blocked = flight.objects.some(
          (other) =>
            other !== object &&
            (protectedRadius(content, other) !== null
              ? distance(other, point) < (protectedRadius(content, other) ?? 0) + object.radius
              : other.kind === "enemy" &&
                other.hp > 0 &&
                distance(other, point) < enemySpacing(object, other)),
        );
        if (!blocked) {
          object[axis] = point[axis];
        } else {
          object.enemy.velocity[axis] = 0;
        }
      }
      const point = { x: object.x, y: object.y };
      resolveScenery(flight, object.radius, onContact, point);
      object.x = point.x;
      object.y = point.y;
    }
    object.enemy.position = { x: object.x, y: object.y };
    bounceShips(content, flight, object);
    threatening ||=
      targetable &&
      intent.state.engaged &&
      !intent.state.returning &&
      !intent.state.fleeing &&
      distance(object, flight.player) <= definition.perception;
    for (const fire of intent.fire) {
      const id = `shot:${flight.nextId++}`;
      shotDelays.set(id, fire.delay);
      flight.shots.push({
        ...fire.origin,
        enemy: true,
        hitIds: [],
        id,
        life: content.tuning.flight.enemyProjectileLifetime,
        piercing: false,
        projectile: fire.projectile,
        velocity: { x: fire.aim.x * fire.speed, y: fire.aim.y * fire.speed },
      });
    }
  }
  return threatening;
}

function segmentDistance(point: Vec, start: Vec, end: Vec): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const square = dx * dx + dy * dy;
  const t = square
    ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / square))
    : 0;
  return distance(point, { x: start.x + dx * t, y: start.y + dy * t });
}

/** Ballistic debris keeps constant velocity and damages; drifting asteroids follow their path. */
function moveDebris(content: PrototypeContent, dt: number, flight: FlightState): void {
  for (const object of flight.objects) {
    if (object.orbit) {
      const motion = orbitMotion(flight.time, object.orbit);
      object.x = motion.position.x;
      object.y = motion.position.y;
      object.velocity = motion.velocity;
      continue;
    }
    if (object.kind !== "debris" || !object.velocity) {
      continue;
    }
    object.cooldown = Math.max(0, (object.cooldown ?? 0) - dt);
    const next = stepDebris(dt, { id: object.id, position: object, velocity: object.velocity });
    // Protected regions absorb traveling debris without changing its ballistic heading.
    if (
      flight.objects.some((area) => {
        const radius = protectedRadius(content, area);
        return (
          radius !== null && segmentDistance(area, object, next.position) < radius + object.radius
        );
      })
    ) {
      object.hp = 0;
      continue;
    }
    if (
      segmentDistance(flight.player, object, next.position) <
      object.radius + content.tuning.flight.shipRadius
    ) {
      if (!object.cooldown) {
        damage(content, flight);
        object.cooldown = content.tuning.flight.damageInterval;
      }
    }
    object.x = next.position.x;
    object.y = next.position.y;
  }
}

function shots(
  content: PrototypeContent,
  dt: number,
  flight: FlightState,
  events: FlightEvent[],
  shotDelays: ReadonlyMap<string, number>,
): void {
  for (const shot of flight.shots) {
    const elapsed = Math.max(0, dt - (shotDelays.get(shot.id) ?? 0));
    if (elapsed === 0) {
      continue;
    }
    const travelTime = Math.min(elapsed, Math.max(0, shot.life));
    const steps = Math.max(1, Math.ceil((length(shot.velocity) * travelTime) / 5));
    for (let i = 0; i < steps && shot.life > 0; i++) {
      shot.x += (shot.velocity.x * travelTime) / steps;
      shot.y += (shot.velocity.y * travelTime) / steps;
      if (shot.enemy) {
        if (safe(content, shot, flight)) {
          shot.life = 0;
        } else if (distance(shot, flight.player) < content.tuning.flight.shipRadius + 3) {
          damage(content, flight);
          shot.life = 0;
        }
        if (
          flight.objects.some(
            (object) =>
              SCENERY.includes(object.kind) &&
              object.hp > 0 &&
              sceneryContact(object, shot, 3, frameOf(flight, object)),
          )
        ) {
          shot.life = 0;
        }
        continue;
      }
      if (shot.damage === undefined) {
        shot.life = 0;
        continue;
      }
      strike(content, shot, flight, events);
    }
    shot.life = Math.max(0, shot.life - elapsed);
  }
  flight.shots = flight.shots.filter((s) => s.life > 0);
  for (const object of flight.objects) {
    if (object.hp <= 0) {
      recordObjectRemoval(content, object, flight);
    }
  }
  flight.objects = flight.objects.filter((o) => o.hp > 0);
}

/**
 * Ada's shot strikes every enemy and obstacle it touches at its position that it has not struck,
 * until it is spent; a large hull only takes it at a live hardpoint.
 */
function strike(
  content: PrototypeContent,
  shot: Shot,
  flight: FlightState,
  events: FlightEvent[],
): void {
  if (shot.damage === undefined) {
    return;
  }
  for (const object of flight.objects) {
    if (
      !["enemy", ...SCENERY].includes(object.kind) ||
      object.hp <= 0 ||
      shot.hitIds.includes(object.id) ||
      (object.kind === "enemy"
        ? distance(shot, object) > object.radius + 3
        : !sceneryContact(object, shot, 3, frameOf(flight, object)))
    ) {
      continue;
    }
    shot.hitIds.push(object.id);
    const part = hitPart(content, partReach(content), shot, object);
    // Large hulls only consume a shot at a live hardpoint; this keeps interior parts reachable.
    if (part === undefined) {
      shot.hitIds.pop();
      continue;
    }
    hit(content, shot.damage, part, object, flight, events);
    if (shot.blast !== undefined) {
      blast(content, shot.damage, shot.blast, shot, object, flight, events);
    }
    if (!shot.piercing) {
      shot.life = 0;
    }
    if (shot.life <= 0) {
      break;
    }
  }
}

/** How near a point must be to a live hardpoint to strike it. */
function partReach(content: PrototypeContent): number {
  return content.tuning.flight.shipRadius + 6;
}

/** A multipart enemy's live hardpoints, in world coordinates. */
function liveParts(
  content: PrototypeContent,
  object: SpaceObject,
): { id: string; x: number; y: number }[] {
  const enemy = object.enemy;
  if (!enemy) {
    return [];
  }
  const definition = enemyCatalog[enemy.archetype];
  const adaWidth = content.tuning.flight.shipRadius * 2;
  return definition.hardpoints
    .filter((part) => enemy.hardpoints.some((value) => value.id === part.id && value.hp > 0))
    .map((part) => {
      const offset = hardpointOffset(definition, adaWidth, enemy.facing, part);
      return { id: part.id, x: object.x + offset.x, y: object.y + offset.y };
    });
}

/**
 * The hardpoint a strike at `point` lands on: null for the hull of a ship without hardpoints
 * and for scenery, undefined when a multipart ship has no live hardpoint within `reach`.
 */
function hitPart(
  content: PrototypeContent,
  reach: number,
  point: Vec,
  object: SpaceObject,
): string | null | undefined {
  if (object.kind !== "enemy" || !object.enemy) {
    return null;
  }
  if (!enemyCatalog[object.enemy.archetype].hardpoints.length) {
    return null;
  }
  let nearest: { id: string; gap: number } | undefined;
  for (const part of liveParts(content, object)) {
    const gap = distance(point, part);
    if (gap <= reach && (!nearest || gap < nearest.gap)) {
      nearest = { gap, id: part.id };
    }
  }
  return nearest?.id;
}

/** Damages an enemy (at a hardpoint, or its hull for null) or scenery, then resolves its loss. */
function hit(
  content: PrototypeContent,
  amount: number,
  part: string | null,
  object: SpaceObject,
  flight: FlightState,
  events: FlightEvent[],
): void {
  if (object.hp <= 0) {
    return;
  }
  if (object.kind === "enemy" && object.enemy) {
    const definition = enemyCatalog[object.enemy.archetype];
    object.enemy = damageEnemy(definition, { amount, hardpointId: part }, object.enemy);
    object.hp = enemyEffects(definition, object.enemy).defeated ? 0 : Math.max(1, object.enemy.hp);
  } else {
    object.hp -= amount;
  }
  if (object.hp > 0) {
    return;
  }
  if (object.kind === "enemy") {
    destroyEnemy(object, flight);
    events.push({ type: "enemyDisabled" });
  }
  if (object.kind === "rock") {
    if (object.asteroid) {
      events.push({
        asteroid: object.asteroid,
        id: object.id,
        type: "asteroidDestroyed",
        x: object.x,
        y: object.y,
      });
    }
    const next = dropRandom(flight.seed, object.id);
    const stardust = rollAsteroidStardust(ECONOMY, asteroidSize(object), next);
    // The pickups are collectable at once; they draw from Art's release time (art/asteroids.md).
    const release = { at: flight.time + ROCK_RELEASE.releaseSeconds };
    releaseStardust(object, ROCK_RELEASE.spread, next, stardust, stardust, release, flight);
  }
  if (object.kind === "debris") {
    events.push({ id: object.id, type: "debrisCleared" });
  }
  if (object.kind === "resource") {
    for (let p = 0; p < content.tuning.flight.piecesPerRock; p++) {
      flight.objects.push({
        hp: 1,
        id: `piece:${flight.nextId++}`,
        kind: "pickup",
        radius: content.tuning.flight.pieceRadius,
        role: "cargo",
        x: object.x + (p - 1) * 12,
        y: object.y,
      });
    }
  }
}

/**
 * A missile's blast damages every other live enemy within its radius of the impact, and never
 * Ada; a multipart ship takes it at its nearest live hardpoint in reach. The blast shows one
 * flash, which stands in for the destruction flash of every enemy the impact destroys, the
 * struck one included.
 */
function blast(
  content: PrototypeContent,
  amount: number,
  radius: number,
  at: Vec,
  struck: SpaceObject,
  flight: FlightState,
  events: FlightEvent[],
): void {
  const blasts = blastFlashes.get(flight) ?? [];
  blasts.push({ age: 0, radius, x: at.x, y: at.y });
  blastFlashes.set(flight, blasts);
  for (const object of [...flight.objects]) {
    if (object === struck || object.kind !== "enemy" || object.hp <= 0) {
      continue;
    }
    const part = hitPart(content, radius + partReach(content), at, object);
    if (part === undefined || (part === null && distance(at, object) > radius + object.radius)) {
      continue;
    }
    hit(content, amount, part, object, flight, events);
    markBlasted(object, flight);
  }
  markBlasted(struck, flight);
}

/** Marks a destroyed enemy's wreck as destroyed by a blast. */
function markBlasted(object: SpaceObject, flight: FlightState): void {
  if (object.kind !== "enemy" || object.hp > 0) {
    return;
  }
  const wreck = flight.objects.find((other) => other.id === wreckId(object.id))?.wreck;
  if (wreck) {
    wreck.blasted = true;
  }
}

/** A hitscan beam's visible flash, view-only and never saved; a hit also shows a spark at `to`. */
export interface BeamFlash {
  from: Vec;
  to: Vec;
  hit: boolean;
  age: number;
}
const beamFlashes = new WeakMap<FlightState, BeamFlash[]>();

/** A missile blast's visible flash at its impact, view-only and never saved. */
export interface BlastFlash extends Vec {
  radius: number;
  age: number;
}
const blastFlashes = new WeakMap<FlightState, BlastFlash[]>();
/** How long a blast shows: the longest blast effect, the Heavy Missile's 340 ms. */
export const BLAST_FLASH_SECONDS = 0.34;

/** The flight's beam flashes still showing. */
export function activeBeamFlashes(flight: FlightState): readonly BeamFlash[] {
  return beamFlashes.get(flight) ?? [];
}

/** The flight's blast flashes still showing. */
export function activeBlastFlashes(flight: FlightState): readonly BlastFlash[] {
  return blastFlashes.get(flight) ?? [];
}

function ageFlashes(dt: number, flight: FlightState): void {
  const beams = beamFlashes.get(flight);
  if (beams) {
    beams.forEach((flash) => (flash.age += dt));
    beamFlashes.set(
      flight,
      beams.filter((flash) => flash.age < Math.max(BEAM.flashSeconds, BEAM.sparkSeconds)),
    );
  }
  const blasts = blastFlashes.get(flight);
  if (blasts) {
    blasts.forEach((flash) => (flash.age += dt));
    blastFlashes.set(
      flight,
      blasts.filter((flash) => flash.age < BLAST_FLASH_SECONDS),
    );
  }
}

/**
 * Where a ray from `origin` along unit `direction` first meets a circle, as a distance along
 * the ray within `range`, or null. An origin inside the circle meets it at 0.
 */
export function rayCircle(
  origin: Vec,
  direction: Vec,
  range: number,
  center: Vec,
  radius: number,
): number | null {
  const along = (center.x - origin.x) * direction.x + (center.y - origin.y) * direction.y;
  const square = (center.x - origin.x) ** 2 + (center.y - origin.y) ** 2 - along * along;
  if (square > radius * radius) {
    return null;
  }
  const half = Math.sqrt(radius * radius - square);
  if (along + half < 0) {
    return null;
  }
  const entry = Math.max(0, along - half);
  return entry <= range ? entry : null;
}

/**
 * Resolves a hitscan beam at once along the aim: it stops at the first enemy or obstacle
 * within range and damages only that enemy. Its flash ends at the hit point, or at full range
 * on a miss. A multipart ship blocks it only at a live hardpoint.
 */
/**
 * Where a beam first meets a scenery object's shape (its asteroid polygon, else its circle),
 * within the beam half-width: the bounding circle's entry, refined in 2-unit steps.
 */
function sceneryEntry(
  origin: Vec,
  direction: Vec,
  range: number,
  frame: number,
  object: SpaceObject,
): number | null {
  const shape = sceneryShape(object);
  const bound = (shape?.radius ?? object.radius) + BEAM.halfWidth;
  const entry = rayCircle(origin, direction, range, object, bound);
  if (entry === null || !shape) {
    return entry;
  }
  const exit = Math.min(range, entry + 2 * bound);
  for (let at = entry; at <= exit; at += 2) {
    const point = { x: origin.x + direction.x * at, y: origin.y + direction.y * at };
    if (sceneryContact(object, point, BEAM.halfWidth, frame)) {
      return at;
    }
  }
  return null;
}

function fireBeam(
  content: PrototypeContent,
  definition: WeaponDefinition,
  aim: Vec,
  origin: Vec,
  flight: FlightState,
  events: FlightEvent[],
): void {
  const range = definition.beamRange ?? 0;
  const span = length(aim);
  if (!span || range <= 0) {
    return;
  }
  const direction = { x: aim.x / span, y: aim.y / span };
  let first: { object: SpaceObject; part: string | null; at: number } | null = null;
  const nearer = (object: SpaceObject, part: string | null, at: number | null) => {
    if (at !== null && (!first || at < first.at)) {
      first = { at, object, part };
    }
  };
  const consider = (object: SpaceObject, part: string | null, center: Vec, radius: number) =>
    nearer(object, part, rayCircle(origin, direction, range, center, radius + BEAM.halfWidth));
  for (const object of flight.objects) {
    if (object.hp <= 0) {
      continue;
    }
    if (SCENERY.includes(object.kind)) {
      nearer(object, null, sceneryEntry(origin, direction, range, frameOf(flight, object), object));
    } else if (object.kind === "enemy" && object.enemy) {
      if (enemyCatalog[object.enemy.archetype].hardpoints.length) {
        for (const part of liveParts(content, object)) {
          consider(object, part.id, part, partReach(content));
        }
      } else {
        consider(object, null, object, object.radius);
      }
    }
  }
  const struck = first as { object: SpaceObject; part: string | null; at: number } | null;
  const reach = struck ? struck.at : range;
  const flashes = beamFlashes.get(flight) ?? [];
  flashes.push({
    age: 0,
    from: origin,
    hit: struck !== null,
    to: { x: origin.x + direction.x * reach, y: origin.y + direction.y * reach },
  });
  beamFlashes.set(flight, flashes);
  if (struck) {
    hit(
      content,
      content.tuning.flight.playerShotDamage * definition.damageRatio,
      struck.part,
      struck.object,
      flight,
      events,
    );
  }
}

/** The id of the wreck that replaces a destroyed enemy. */
export function wreckId(enemyId: string): string {
  return `wreck:${enemyId}`;
}

/** A defeated enemy is replaced by a wreck that breaks apart, then releases its drops. */
function destroyEnemy(object: SpaceObject, flight: FlightState): void {
  object.hp = 0;
  const id = wreckId(object.id);
  if (flight.objects.some((other) => other.id === id)) {
    return;
  }
  flight.objects.push({
    hp: 1,
    id,
    kind: "wreck",
    radius: object.radius,
    wreck: {
      age: 0,
      archetype: object.enemy?.archetype ?? "fighter",
      facing: { ...(object.enemy?.facing ?? { x: 0, y: -1 }) },
    },
    x: object.x,
    y: object.y,
  });
}

/**
 * A destroyed rock takes the generic reduced destruction at every motion setting
 * (art/asteroids.md "Destruction"), so the fighter's reduced timing stands in: its Stardust
 * appears in place at 240 ms, spread over 7.68 * U(0.6, 1) world units.
 */
const ROCK_RELEASE = ECONOMY.destruction.fighter.reduced;

/**
 * Releases a drop's Stardust pickups around a destroyed object (art/destruction.md): pickup
 * i of n heads to screen angle 2 pi i / n within 0.3 rad, at spread * U(0.6, 1) with the
 * screen-y offset squashed by 0.8. Each records its release for the view.
 */
function releaseStardust(
  at: Vec,
  spread: number,
  next: () => number,
  cap: number,
  amount: number,
  release: PickupRelease,
  flight: FlightState,
) {
  const pieces = splitStardust(cap, amount);
  pieces.forEach((value, index) => {
    const angle = (index / pieces.length) * Math.PI * 2 + (next() * 2 - 1) * 0.3;
    const reach = spread * (0.6 + next() * 0.4);
    const screen = { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach * 0.8 };
    flight.objects.push({
      amount: value,
      hp: 1,
      id: `stardust:${flight.nextId++}`,
      kind: "pickup",
      radius: ECONOMY.stardustPickupRadius,
      release: { ...release },
      role: "stardust",
      // The view's projection maps screen offsets back to world axes.
      x: at.x + screen.y + screen.x / 2,
      y: at.y + screen.y - screen.x / 2,
    });
  });
}

/** Reduced motion uses Art's reduced timing: a shorter fade, a later release, a tighter spread. */
function stepWrecks(
  content: PrototypeContent,
  dt: number,
  reducedMotion: boolean,
  flight: FlightState,
): void {
  for (const object of [...flight.objects]) {
    if (object.kind !== "wreck" || !object.wreck || object.hp <= 0) {
      continue;
    }
    object.wreck.age += dt;
    const destruction = ECONOMY.destruction[object.wreck.archetype];
    const timing = reducedMotion ? destruction.reduced : destruction;
    if (object.wreck.age >= timing.durationSeconds) {
      object.hp = 0;
    }
    if (object.wreck.released || object.wreck.age < timing.releaseSeconds) {
      continue;
    }
    object.wreck.released = true;
    const next = dropRandom(flight.seed, object.id);
    const drop = rollEnemyDrop(ECONOMY, flight.sector, object.wreck.archetype, next);
    releaseStardust(
      object,
      timing.spread,
      next,
      ECONOMY.pickupCap[object.wreck.archetype],
      drop.stardust,
      { at: flight.time, from: { x: object.x, y: object.y } },
      flight,
    );
    if (drop.weapon) {
      flight.objects.push({
        hp: 1,
        id: `drop:${flight.nextId++}`,
        kind: "pickup",
        radius: content.tuning.flight.pickupRadius,
        role: "drop",
        weapon: drop.weapon,
        x: object.x,
        y: object.y,
      });
    }
  }
}

/** The tractor beam draws Stardust inside its pull radius toward Ada at its pull speed. */
function pullStardust(
  radius: number,
  speed: number,
  dt: number,
  object: SpaceObject,
  flight: FlightState,
) {
  const gap = distance(object, flight.player);
  if (!carriesStardust(object) || gap > radius || gap === 0) {
    return;
  }
  const step = Math.min(gap, speed * dt);
  object.x += ((flight.player.x - object.x) / gap) * step;
  object.y += ((flight.player.y - object.y) / gap) * step;
}

export function stepFlight(
  content: PrototypeContent,
  dt: number,
  input: FlightInput,
  flight: FlightState,
): FlightEvent[] {
  beginFlightStep(flight);
  reducedMotions.set(flight, input.reducedMotion ?? false);
  const events: FlightEvent[] = [];
  if (!Number.isFinite(dt) || dt <= 0 || flight.shield <= 0) {
    return events;
  }
  syncFlightRegion(content, flight);
  // Settle capitals that the region sync just paged in from dormant chunks.
  settleResumedCapitals(content, flight);
  const ship = shipTuning(ECONOMY, content, flight.levels);
  let remaining = dt;
  while (remaining > 1e-9 && flight.shield > 0) {
    const slice = Math.min(remaining, 1 / 60);
    remaining -= slice;
    flight.time += slice;
    flight.sinceDamage += slice;
    generate(content, flight.player, flight);
    moveDebris(content, slice, flight);
    move(content, slice, input, flight);
    syncFlightRegion(content, flight);
    const aiming = length(input.aim) > 0.01;
    if (aiming) {
      flight.facing = turnToward(
        slice,
        content.tuning.physics.aimTurnSeconds,
        input.aim,
        flight.facing,
      );
    }
    ageFlashes(slice, flight);
    flight.fireCooldown = Math.max(0, flight.fireCooldown - slice);
    if (aiming && flight.fireCooldown <= 0) {
      fire(content, input.viewportWidth ?? SCREEN.width, flight.facing, flight, events);
    }
    const shotDelays = new Map<string, number>();
    const threat = enemies(content, slice, flight, events, shotDelays);
    shots(content, slice, flight, events, shotDelays);
    stepWrecks(content, slice, input.reducedMotion ?? false, flight);
    for (const object of flight.objects) {
      if (
        object.kind === "hazard" &&
        distance(object, flight.player) < object.radius + content.tuning.flight.shipRadius
      ) {
        object.cooldown = Math.max(0, (object.cooldown ?? 0) - slice);
        if (!object.cooldown) {
          damage(content, flight);
          object.cooldown = content.tuning.flight.damageInterval;
        }
      }
      if (object.kind !== "pickup" || object.hp <= 0) {
        continue;
      }
      pullStardust(ship.tractorRadius, ship.tractorSpeed, slice, object, flight);
      if (distance(object, flight.player) > object.radius + content.tuning.flight.pickupReach) {
        continue;
      }
      if (object.role === "cargo") {
        flight.cargo++;
        object.hp = 0;
      } else if (carriesStardust(object)) {
        events.push({ amount: object.amount ?? 0, type: "stardust" });
        object.hp = 0;
      } else if (object.weapon) {
        // A found weapon Ada already owns gives a pack of its ammunition instead.
        collectWeapon(object.weapon, flight);
        object.hp = 0;
      }
    }
    for (const object of flight.objects) {
      if (object.hp <= 0) {
        recordObjectRemoval(content, object, flight);
      }
    }
    flight.objects = flight.objects.filter((o) => o.hp > 0);
    const underFire = flight.shots.some(
      (s) => s.enemy && distance(s, flight.player) < content.tuning.safeRadius,
    );
    flight.dangerFor = safe(content, flight.player, flight)
      ? 0
      : threat || underFire
        ? content.tuning.dangerReleaseSeconds
        : Math.max(0, flight.dangerFor - slice);
    // Snap the switch wait to zero within float error of its end.
    const wait = flight.weaponSwitchFor - slice;
    flight.weaponSwitchFor = wait > 1e-9 ? wait : 0;
    if (flight.sinceDamage >= ship.shieldRechargeDelay) {
      flight.shield = Math.min(ship.shieldMax, flight.shield + ship.shieldRechargeRate * slice);
    }
    if (flight.shield <= 0) {
      events.push({ type: "depleted" });
    }
  }
  syncFlightRegion(content, flight);
  for (const object of flight.objects) {
    if (
      object.kind === "destination" &&
      !routeBlocked(object.id, flight) &&
      distance(object, flight.player) <= content.tuning.safeRadius
    ) {
      events.push({ id: object.id, type: "discovered" });
    }
    if (
      object.kind === "station" &&
      distance(object, flight.player) <= ECONOMY.station.safeRadius
    ) {
      events.push({ id: object.id, type: "stationDiscovered" });
    }
  }
  // Flying into a dock docks once; Ada must leave the dock before it docks her again.
  const dock = flight.objects.find(
    (object) =>
      object.kind === "station" &&
      distance(stationDock(object), flight.player) <= stationDockRadius(content),
  );
  if (!dock) {
    flight.dockId = null;
  } else if (flight.dockId !== dock.id && flight.shield > 0) {
    flight.dockId = dock.id;
    flight.velocity = { x: 0, y: 0 };
    events.push({ id: dock.id, type: "docked" });
  }
  return events;
}
