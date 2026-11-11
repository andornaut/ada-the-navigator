import { CHUNK_CATALOG } from "../data/chunk-catalog.ts";
import {
  type EncounterEntry,
  type EnemyArchetype,
  enemyCatalog,
  enemyEncounterTuning,
  sectorEncounters,
} from "../data/enemy-catalog.ts";
import { SCREEN } from "../data/screen.ts";
import type { PrototypeContent, SectorId } from "../data/types.ts";
import { WEAPON_CATALOG } from "../data/weapon-catalog.ts";
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
  beginFlightStep,
  persistentObject,
  prunePackState,
  recordObjectRemoval,
  recordUnloadedPackMember,
  retainedPackMembers,
  retainedRouteBlocked,
  syncFlightRegion,
} from "./geography.ts";

export { activateRouteEncounter, syncFlightRegion } from "./geography.ts";
import { planPlayerVolley } from "./player-projectiles.ts";
import { direction, speedFraction, stepShipMotion, turnToward } from "./ship-physics.ts";
import type {
  FlightEvent,
  FlightInput,
  FlightState,
  SectorProgress,
  SpaceObject,
  Vec,
} from "./types.ts";
import { markVisited, visitedChunk } from "./visited.ts";
import {
  collectWeapon,
  ensureOwnedWeapons,
  loseSelectedWeapon,
  UPGRADE_WEAPONS,
} from "./weapons.ts";

const length = (v: Vec) => Math.hypot(v.x, v.y);
const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
/**
 * Smoothed requested movement direction per flight. It is transient so saves gain
 * no field; a restored or newly pressed stick starts from the velocity heading.
 */
const movementHeadings = new WeakMap<FlightState, Vec>();
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
function safe(content: PrototypeContent, point: Vec, flight: FlightState): boolean {
  return flight.objects.some(
    (o) => o.kind === "destination" && distance(point, o) <= content.tuning.safeRadius,
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
      const plan = planChunk(CHUNK_CATALOG, {
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
      const next = random(hash(flight.seed ^ 17, x, y));
      generateRegion(content, x, y, flight);
      for (const placement of plan.placements) {
        const object: SpaceObject = {
          ...placement,
          hp: placement.kind === "pickup" ? 1 : tuning.rockHp,
          radius: placement.kind === "pickup" ? tuning.pickupRadius : tuning.rockRadius,
        };
        if (object.kind !== "rock") {
          object.role = "discovery";
        }
        if (object.kind === "pickup") {
          object.weapon =
            UPGRADE_WEAPONS[Math.floor(next() * UPGRADE_WEAPONS.length)] ?? "missiles";
        }
        if (
          !existing.has(object.id) &&
          !Object.hasOwn(flight.world.notables, object.id) &&
          distance(object, flight.player) > content.tuning.safeRadius &&
          !safe(content, object, flight)
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
): SpaceObject {
  const definition = enemyCatalog[archetype];
  return {
    ...point,
    enemy: createEnemy(definition, { archetype, id, packId, phase }, point),
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
): { archetype: EnemyArchetype; count: number } {
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
  return {
    archetype: chosen?.archetype ?? "fighter",
    count: low + Math.floor(countRoll * (high - low + 1)),
  };
}

function generateRegion(
  content: PrototypeContent,
  x: number,
  y: number,
  flight: FlightState,
): void {
  const size = content.tuning.chunkSize;
  // One encounter cell per quiet-distance grid; adjacent chunk traversal cannot duplicate it.
  const span = Math.max(3, Math.ceil(enemyEncounterTuning.quietDistance / size));
  if (x % span !== 0 || y % span !== 0) {
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
  const { archetype, count } = rollEncounter(sectorEncounters[flight.sector], countRoll, next());
  const state = combat(flight);
  const initialized = Object.hasOwn(state.initialPackSizes, packId);
  // Preserve the casualty count and admit only the represented pack's unloaded survivor budget.
  let budget = initialized ? (state.unloadedPackMembers?.[packId] ?? 0) : count;
  let admitted = 0;
  const existing = flight.objects.filter(
    (object) => object.hp > 0 && object.enemy?.packId === packId,
  ).length;
  for (let i = 0; i < count && budget > 0; i++) {
    const object = spawnEnemy(
      content,
      archetype,
      `${packId}:${i}`,
      {
        x: center.x + i * 85,
        y: center.y,
      },
      packId,
      next() * Math.PI * 2,
    );
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
    (object.enemy?.archetype === "capital" || object.enemy?.archetype === "oversizedCapital") &&
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
  const destinations = flight.objects.filter((object) => object.kind === "destination");
  const positions = new Map<SpaceObject, Vec>();
  const maxRadius = flight.objects.reduce(
    (radius, object) => Math.max(radius, object.radius),
    content.tuning.safeRadius,
  );
  const guardSet = new Set(guards);
  // A capital ignores unplaced capital guards; each of those is placed against it afterward.
  const blocked = (guard: SpaceObject, point: Vec): boolean =>
    destinations.some(
      (object) => distance(object, point) < content.tuning.safeRadius + guard.radius + 120,
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
  const archetype =
    flight.sector === 1 ? "frigate" : flight.sector === 2 ? "capital" : "oversizedCapital";
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
  while (
    flight.objects.some(
      (o) => o.kind === "destination" && distance(o, target) < content.tuning.safeRadius * 2,
    )
  ) {
    target.x -= heading.y * content.tuning.safeRadius * 2.5;
    target.y += heading.x * content.tuning.safeRadius * 2.5;
  }
  generate(content, target, flight);
  const object: SpaceObject = { ...target, hp: 1, id, kind: "destination", radius: 30, role: id };
  flight.objects.push(object);
  clearLayoutObjects(
    (o) => o.kind === "destination" || distance(o, object) > content.tuning.safeRadius,
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

export function createFlight(
  content: PrototypeContent,
  sector: SectorId,
  seed: number,
  progress: SectorProgress,
): FlightState {
  const flight: FlightState = {
    ammo: 0,
    cargo: 0,
    chunks: [],
    dangerFor: 0,
    facing: { x: 0, y: -1 },
    fireCooldown: 0,
    freshChunk: "0,0",
    freshDistance: 0,
    nextId: 0,
    objects: [],
    player: { x: 0, y: 0 },
    sector,
    seed,
    shield: content.tuning.shieldMax,
    shots: [],
    sinceDamage: content.tuning.shieldRechargeDelay,
    time: 0,
    velocity: { x: 0, y: 0 },
    visited: {},
    weapon: "basic",
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
  const object = flight.objects.find((o) => o.kind === "destination" && o.id === id);
  if (!object) {
    return false;
  }
  beginFlightStep(flight);
  generate(content, object, flight);
  flight.player = { x: object.x, y: object.y };
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
): void {
  ensureOwnedWeapons(flight);
  const volley = planPlayerVolley(WEAPON_CATALOG[flight.weapon], {
    aim,
    baseDamage: content.tuning.flight.playerShotDamage,
    baseLifetime: content.tuning.flight.projectileLifetime,
    baseSpeed: content.tuning.maxSpeed * content.tuning.flight.projectileSpeedFactor,
    origin: flight.player,
    viewportWidth,
  });
  for (const projectile of volley.projectiles) {
    flight.shots.push({
      ...projectile,
      enemy: false,
      hitIds: [],
      id: `shot:${flight.nextId++}`,
      piercing: false,
    });
  }
  flight.fireCooldown += volley.interval;
}

function damage(content: PrototypeContent, flight: FlightState): void {
  if (safe(content, flight.player, flight)) {
    return;
  }
  flight.shield = Math.max(0, flight.shield - content.tuning.enemyDamage);
  if (flight.shield === 0 && loseSelectedWeapon(flight)) {
    flight.shield = content.tuning.shieldMax;
  }
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
/** Current ship speed as a fraction of Ada's maximum speed, clamped to [0, 1], for jets. */
export function shipSpeedFraction(
  tuning: Pick<PrototypeContent["tuning"], "maxSpeed" | "physics">,
  flight: Pick<FlightState, "velocity">,
): number {
  return speedFraction(adaMaxSpeed(tuning), flight.velocity);
}
function move(
  content: PrototypeContent,
  dt: number,
  input: FlightInput,
  flight: FlightState,
): void {
  const magnitude = Math.min(1, length(input.move));
  const motion = stepShipMotion(
    content.tuning.physics,
    dt,
    {
      direction: input.move,
      speed: movementSpeedFraction(content.tuning, magnitude) * adaMaxSpeed(content.tuning),
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
  const steps = Math.max(1, Math.ceil((length(flight.velocity) * dt) / 4));
  for (let i = 0; i < steps; i++) {
    const before = { ...flight.player };
    const key = chunk(content, before);
    for (const axis of ["x", "y"] as const) {
      flight.player[axis] += (flight.velocity[axis] * dt) / steps;
      if (
        flight.objects.some(
          (o) =>
            ["rock", "resource", "debris"].includes(o.kind) &&
            o.hp > 0 &&
            distance(o, flight.player) < o.radius + content.tuning.flight.shipRadius,
        )
      ) {
        flight.player[axis] = before[axis];
        flight.velocity[axis] = 0;
      }
    }
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
    flight.facing = turnToward(
      dt,
      content.tuning.physics.aimTurnSeconds,
      flight.velocity,
      flight.facing,
    );
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
  }
  const peers = objects.flatMap((object) => (object.enemy ? [object.enemy] : []));
  for (const object of objects) {
    const state = object.enemy!;
    const definition = enemyCatalog[state.archetype];
    const targetable = !safe(content, flight.player, flight) && !safe(content, object, flight);
    const visible = !flight.objects.some(
      (obstacle) =>
        ["rock", "resource", "debris"].includes(obstacle.kind) &&
        segmentDistance(obstacle, object, flight.player) < obstacle.radius,
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
      object.hp = 0;
      events.push({ type: "enemyDisabled" });
      continue;
    }
    const steps = Math.max(1, Math.ceil((length(intent.velocity) * dt) / 4));
    for (let i = 0; i < steps; i++) {
      for (const axis of ["x", "y"] as const) {
        const point = { x: object.x, y: object.y };
        point[axis] += (intent.velocity[axis] * dt) / steps;
        const blocked = flight.objects.some(
          (other) =>
            other !== object &&
            (other.kind === "destination"
              ? distance(other, point) < content.tuning.safeRadius + object.radius
              : ["rock", "resource", "debris", "enemy"].includes(other.kind) &&
                other.hp > 0 &&
                distance(other, point) < enemySpacing(object, other)),
        );
        if (!blocked) {
          object[axis] = point[axis];
        } else {
          object.enemy.velocity[axis] = 0;
        }
      }
    }
    object.enemy.position = { x: object.x, y: object.y };
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
    object.cooldown = Math.max(0, (object.cooldown ?? 0) - dt);
    if (
      targetable &&
      distance(object, flight.player) < object.radius + content.tuning.flight.shipRadius &&
      !object.cooldown
    ) {
      damage(content, flight);
      object.cooldown = content.tuning.flight.damageInterval;
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

function moveDebris(content: PrototypeContent, dt: number, flight: FlightState): void {
  for (const object of flight.objects) {
    if (object.kind !== "debris" || !object.velocity) {
      continue;
    }
    object.cooldown = Math.max(0, (object.cooldown ?? 0) - dt);
    const next = stepDebris(dt, { id: object.id, position: object, velocity: object.velocity });
    // Protected regions absorb traveling debris without changing its ballistic heading.
    if (
      flight.objects.some(
        (destination) =>
          destination.kind === "destination" &&
          segmentDistance(destination, object, next.position) <
            content.tuning.safeRadius + object.radius,
      )
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
              ["rock", "resource", "debris"].includes(object.kind) &&
              object.hp > 0 &&
              distance(shot, object) <= object.radius + 3,
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
      for (const object of flight.objects) {
        if (
          !["enemy", "rock", "resource", "debris"].includes(object.kind) ||
          object.hp <= 0 ||
          shot.hitIds.includes(object.id) ||
          distance(shot, object) > object.radius + 3
        ) {
          continue;
        }
        shot.hitIds.push(object.id);
        if (object.kind === "enemy" && object.enemy) {
          const definition = enemyCatalog[object.enemy.archetype];
          const enemy = object.enemy;
          const adaWidth = content.tuning.flight.shipRadius * 2;
          const part = definition.hardpoints.find((part) => {
            if (!enemy.hardpoints.some((value) => value.id === part.id && value.hp > 0)) {
              return false;
            }
            const offset = hardpointOffset(definition, adaWidth, enemy.facing, part);
            return (
              distance(shot, { x: object.x + offset.x, y: object.y + offset.y }) <=
              content.tuning.flight.shipRadius + 6
            );
          });
          // Large hulls only consume a shot at a live hardpoint; this keeps interior parts reachable.
          if (definition.hardpoints.length && !part) {
            shot.hitIds.pop();
            continue;
          }
          object.enemy = damageEnemy(
            definition,
            { amount: shot.damage, hardpointId: part?.id ?? null },
            object.enemy,
          );
          object.hp = enemyEffects(definition, object.enemy).defeated
            ? 0
            : Math.max(1, object.enemy.hp);
        } else {
          object.hp -= shot.damage;
        }
        if (!shot.piercing) {
          shot.life = 0;
        }
        if (object.hp <= 0) {
          if (object.kind === "enemy") {
            events.push({ type: "enemyDisabled" });
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
        if (shot.life <= 0) {
          break;
        }
      }
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

export function stepFlight(
  content: PrototypeContent,
  dt: number,
  input: FlightInput,
  flight: FlightState,
): FlightEvent[] {
  beginFlightStep(flight);
  const events: FlightEvent[] = [];
  if (!Number.isFinite(dt) || dt <= 0 || flight.shield <= 0) {
    return events;
  }
  syncFlightRegion(content, flight);
  // Settle capitals that the region sync just paged in from dormant chunks.
  settleResumedCapitals(content, flight);
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
    flight.fireCooldown = Math.max(0, flight.fireCooldown - slice);
    if (aiming && flight.fireCooldown <= 0) {
      fire(content, input.viewportWidth ?? SCREEN.width, flight.facing, flight);
    }
    const shotDelays = new Map<string, number>();
    const threat = enemies(content, slice, flight, events, shotDelays);
    shots(content, slice, flight, events, shotDelays);
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
      if (
        object.kind !== "pickup" ||
        distance(object, flight.player) > object.radius + content.tuning.flight.pickupReach
      ) {
        continue;
      }
      if (object.role === "cargo") {
        flight.cargo++;
        object.hp = 0;
      } else if (object.weapon) {
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
    if (flight.sinceDamage >= content.tuning.shieldRechargeDelay) {
      flight.shield = Math.min(
        content.tuning.shieldMax,
        flight.shield + content.tuning.shieldRechargeRate * slice,
      );
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
  }
  return events;
}
