import type { AsteroidSize } from "../../data/asteroidCatalog.ts";
import {
  ASTEROID_LOOT,
  ASTEROID_RESOURCE_FLOOR,
  CRYSTAL_MINIMUM_ORE,
} from "../../data/asteroidLoot.ts";
import { ECONOMY } from "../../data/economy.ts";
import { WRECK_ID_PREFIX } from "../../data/enemyIdentity.ts";
import { PHANTOM_FLAGSHIP, PHANTOM_TUNING } from "../../data/phantom.ts";
import type { GameContent, Vec, Weapon } from "../../data/types.ts";
import { type AsteroidLoot, rollAsteroidLoot } from "../asteroidLoot.ts";
import { asteroidSize } from "../asteroids.ts";
import {
  dropRandom,
  rollAmmoDrop,
  rollEnemyDrop,
  rollRockAmmoDrop,
  rollSalvageDrop,
  splitResourcePickup,
} from "../drops.ts";
import { flightWorldContext } from "../flightTopology.ts";
import { orePickupSize, stardustPickupReach, stardustPickupSize } from "../pickupBody.ts";
import { MOVING_ROCK_PREFIX } from "../rockRicochet.ts";
import {
  type PickupObstacle,
  pickupRowGap,
  pickupSpacingRadius,
  stardustDropOffsets,
} from "../stardustPlacement.ts";
import type { FlightState, PickupRelease, SpaceObject } from "../types.ts";
import { worldDistance } from "../worldContacts.ts";

const rockDropId = (id: string): string =>
  id.startsWith(MOVING_ROCK_PREFIX) ? id.slice(MOVING_ROCK_PREFIX.length) : id;

function rockLoot(size: AsteroidSize, crystal: boolean, next: () => number): AsteroidLoot {
  let { ore, stardust } = rollAsteroidLoot(ASTEROID_LOOT, size, next);
  if (crystal) {
    ore = Math.max(CRYSTAL_MINIMUM_ORE, ore);
    const { minimum, weights } = ASTEROID_LOOT.totals[size];
    const cap = minimum + weights.length - 1;
    stardust = Math.min(stardust, cap - ore);
  }
  for (let deficit = ASTEROID_RESOURCE_FLOOR[size] - ore - stardust; deficit > 0; deficit--) {
    if (next() < ASTEROID_LOOT.oreChance) {
      ore++;
    } else {
      stardust++;
    }
  }
  return { ore, stardust };
}

/** The rock's seeded ore content before any ammo replacement. */
export function seededRockOre(seed: number, object: SpaceObject): number {
  return rockLoot(
    asteroidSize(object),
    object.crystals !== undefined,
    dropRandom(seed, rockDropId(object.id)),
  ).ore;
}

/**
 * An ammo outcome replaces the destroyed asteroid's combined ore/Stardust payout. A crystal rock
 * skips the ammo roll and gives at least `CRYSTAL_MINIMUM_ORE` within its size's combined cap.
 * A moving rock rolls under its placed rock's id and keeps its flag, so it drops what that
 * rock would have dropped had it stayed still.
 */
export function dropFromRock(content: GameContent, object: SpaceObject, flight: FlightState): void {
  const size = asteroidSize(object);
  const crystal = object.crystals !== undefined;
  const id = rockDropId(object.id);
  if (
    !crystal &&
    rollRockAmmoDrop(ECONOMY, ammoOwned(flight), size, dropRandom(flight.seed, `ammo:${id}`))
  ) {
    pushAmmoPack(content, object, flight);
    return;
  }
  const next = dropRandom(flight.seed, id);
  const loot = rockLoot(size, crystal, next);
  const amounts = splitResourcePickup(loot.ore);
  const orePieces = amounts.length;
  const widths = amounts.map(orePickupSize);
  const gap = pickupRowGap(ECONOMY.stardustPickupGap);
  const span = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, orePieces - 1) * gap;
  let edge = -span / 2;
  const obstacles: PickupObstacle[] = [];
  for (let p = 0; p < orePieces; p++) {
    const centre = edge + widths[p]! / 2;
    edge += widths[p]! + gap;
    obstacles.push({ radius: pickupSpacingRadius(widths[p]!), x: centre, y: 0 });
    flight.objects.push({
      amount: amounts[p]!,
      hp: 1,
      id: `piece:${flight.nextId++}`,
      kind: "pickup",
      radius: content.tuning.flight.pieceRadius,
      role: "cargo",
      x: object.x + centre / 2,
      y: object.y - centre / 2,
    });
  }
  const release = { at: flight.time + ROCK_RELEASE.releaseSeconds };
  releaseStardust(obstacles, object, ROCK_RELEASE.spread, next, loot.stardust, release, flight);
}

/** The weapons ammo packs drop for: those Ada owns. */
function ammoOwned(flight: FlightState): readonly Weapon[] {
  return flight.ownedWeapons ?? [];
}

/** An ammo pack pickup at `at`, its pack chosen as Ada collects it. */
function pushAmmoPack(content: GameContent, at: Vec, flight: FlightState): void {
  flight.objects.push({
    ammoPack: true,
    hp: 1,
    id: `drop:${flight.nextId++}`,
    kind: "pickup",
    radius: content.tuning.flight.pickupRadius,
    role: "drop",
    x: at.x,
    y: at.y,
  });
}

/** Marks a destroyed enemy's wreck as destroyed by a blast. */
export function markBlasted(object: SpaceObject, flight: FlightState): void {
  if (object.kind !== "enemy" || object.hp > 0) {
    return;
  }
  const wreck = flight.objects.find((other) => other.id === wreckId(object.id))?.wreck;
  if (wreck) {
    wreck.blasted = true;
  }
}

/** The id of the wreck that replaces a destroyed enemy. */
export function wreckId(enemyId: string): string {
  return `${WRECK_ID_PREFIX}${enemyId}`;
}

/** A defeated enemy is replaced by a wreck that breaks apart, then releases its drops. */
export function destroyEnemy(object: SpaceObject, flight: FlightState): void {
  object.hp = 0;
  const archetype = object.enemy?.archetype ?? "fighter";
  if (archetype === "hostileStation") {
    return;
  }
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
      archetype,
      facing: { ...(object.enemy?.facing ?? { x: 0, y: -1 }) },
      ...(object.enemy?.hullProfile === undefined ? {} : { hullProfile: object.enemy.hullProfile }),
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
const ROCK_RELEASE = ECONOMY.rockRelease;

/**
 * Releases a drop's Stardust pickups around a destroyed object (art/destruction.md): pickup
 * i of n heads to screen angle 2 pi i / n within 0.3 rad, at spread * U(0.6, 1) with the
 * screen-y offset squashed by 0.8. Each records its release for the view.
 */
function releaseStardust(
  obstacles: readonly PickupObstacle[],
  at: Vec,
  spread: number,
  next: () => number,
  amount: number,
  release: PickupRelease,
  flight: FlightState,
) {
  const pieces = splitResourcePickup(amount);
  const candidates = pieces.map((value, index) => {
    const angle = (index / pieces.length) * Math.PI * 2 + (next() * 2 - 1) * 0.3;
    const reach = spread * (0.6 + next() * 0.4);
    return {
      radius: pickupSpacingRadius(stardustPickupSize(value)),
      x: Math.cos(angle) * reach,
      y: Math.sin(angle) * reach * 0.8,
    };
  });
  const offsets = stardustDropOffsets({ ...ECONOMY, obstacles }, candidates);
  pieces.forEach((value, index) => {
    const screen = offsets[index]!;
    flight.objects.push({
      amount: value,
      hp: 1,
      id: `stardust:${flight.nextId++}`,
      kind: "pickup",
      radius: stardustPickupReach(ECONOMY.stardustPickupRadius, value),
      release: { ...release },
      role: "stardust",
      // The view's projection maps screen offsets back to world axes.
      x: at.x + screen.y + screen.x / 2,
      y: at.y + screen.y - screen.x / 2,
    });
  });
}

/** The disabled heavy nearest Ada within Talk range that she can salvage. */
export function salvageTarget(content: GameContent, flight: FlightState): SpaceObject | undefined {
  return flight.objects
    .filter(
      (object) =>
        object.kind === "enemy" &&
        object.hp > 0 &&
        object.enemy?.disabled === true &&
        object.enemy.archetype !== "hostileStation" &&
        !object.enemy.salvaged &&
        worldDistance(flightWorldContext(flight), object, flight.player) <=
          content.tuning.talkRange,
    )
    .sort(
      (a, b) =>
        worldDistance(flightWorldContext(flight), a, flight.player) -
        worldDistance(flightWorldContext(flight), b, flight.player),
    )[0];
}

/**
 * Salvages the disabled heavy nearest Ada within Talk range: it drops half its rolled Stardust
 * and rolls for a heavy upgrade, then powers down, spared. Returns whether one was.
 */
export function salvage(content: GameContent, flight: FlightState): boolean {
  const object = salvageTarget(content, flight);
  const enemy = object?.enemy;
  if (!object || !enemy || enemy.archetype === "hostileStation") {
    return false;
  }
  enemy.salvaged = true;
  enemy.engaged = false;
  enemy.velocity = { x: 0, y: 0 };
  const next = dropRandom(flight.seed, `salvage:${object.id}`);
  const drop = rollSalvageDrop(
    ECONOMY,
    { id: object.id, seed: flight.seed },
    enemy.archetype,
    next,
  );
  releaseStardust(
    [],
    object,
    ECONOMY.destruction[enemy.archetype].spread,
    next,
    object.id === PHANTOM_FLAGSHIP ? PHANTOM_TUNING.salvageStardust : drop.stardust,
    { at: flight.time, from: { x: object.x, y: object.y } },
    flight,
  );
  if (drop.upgrade) {
    flight.objects.push({
      hp: 1,
      id: `drop:${flight.nextId++}`,
      kind: "pickup",
      radius: content.tuning.flight.pickupRadius,
      role: "drop",
      upgrade: true,
      x: object.x,
      y: object.y,
    });
  }
  return true;
}

/** Reduced motion uses Art's reduced timing: a shorter fade, a later release, a tighter spread. */
export function stepWrecks(
  content: GameContent,
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
    const drop = rollEnemyDrop(
      ECONOMY,
      { id: object.id, seed: flight.seed },
      object.wreck.archetype,
      next,
    );
    releaseStardust(
      [],
      object,
      timing.spread,
      next,
      object.id === PHANTOM_FLAGSHIP ? PHANTOM_TUNING.legacyWreckStardust : drop.stardust,
      { at: flight.time, from: { x: object.x, y: object.y } },
      flight,
    );
    if (drop.upgrade) {
      flight.objects.push({
        hp: 1,
        id: `drop:${flight.nextId++}`,
        kind: "pickup",
        radius: content.tuning.flight.pickupRadius,
        role: "drop",
        upgrade: true,
        x: object.x,
        y: object.y,
      });
    }
    // The ammo roll has its own stream, so it never moves the Stardust's spread.
    const ammo = dropRandom(flight.seed, `ammo:${object.id}`);
    if (rollAmmoDrop(ECONOMY, ammoOwned(flight), object.wreck.archetype, ammo)) {
      pushAmmoPack(content, object, flight);
    }
  }
}
