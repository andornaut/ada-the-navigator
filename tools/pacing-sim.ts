/**
 * Headless Stardust pacing simulation for Gameplay review.
 *
 * World content comes from the game's own generators and drop rolls: chunk plans
 * (asteroids and discovery caches), encounter cells and their galaxy tables, station
 * sites, enemy and asteroid drops and pickup splitting. A scripted player explores,
 * fights encounters met in passing, shoots some asteroids and collects pickups inside
 * tractor range. An upgrade weapon spends one shot per volley; the player tops up each owned
 * weapon's ammunition at every station reached. Every behavioural assumption is a named,
 * overridable parameter.
 *
 * With --jobs the player also takes and completes station jobs (gameplay/quests.md) back to
 * back, through the game's own job boards, landmarks and rewards.
 *
 * Usage: node tools/pacing-sim.ts [--galaxy 1|2|3] [--seeds 50] [--minutes 90]
 *   [--scenario name] [--set key=value ...] [--json] [--real] [--weapons] [--jobs]
 * --weapons prints each weapon's single-target output and kill times per level.
 * Values given to --set are JSON; dotted keys reach nested parameters or overrides,
 * for example --set behaviour.hitRate=0.4 or --set economy.discoveryStardust=5.
 */
import { pathToFileURL } from "node:url";

import { ASTEROID_SIZES, type AsteroidSize } from "../src/data/asteroidCatalog.ts";
import { ASTEROID_FIELDS, CHUNK_CATALOG } from "../src/data/chunkCatalog.ts";
import { CONTENT } from "../src/data/content.ts";
import { ECONOMY, type EconomyCatalog, type UpgradeWeapon } from "../src/data/economy.ts";
import {
  type EncounterEntry,
  encounterTable,
  type EnemyArchetype,
  enemyCatalog,
  enemyDefinition,
  HEAVIES,
} from "../src/data/enemyCatalog.ts";
import { byPosition, ROUTE_POSITION, type RoutePosition } from "../src/data/galaxies.ts";
import { HOLODISKS } from "../src/data/holodisks.ts";
import { JOB_TUNING, JOB_TYPES, type JobType } from "../src/data/jobs.ts";
import { galaxyProjects } from "../src/data/projects.ts";
import { SCREEN } from "../src/data/screen.ts";
import type { GalaxyNumber, Weapon } from "../src/data/types.ts";
import { weaponAt } from "../src/data/weaponCatalog.ts";
import { ASTEROID_SHAPES, orbitMotion, placementRadius } from "../src/model/asteroids.ts";
import { planChunk } from "../src/model/chunkTemplates.ts";
import {
  dropRandom,
  rollAsteroidStardust,
  rollEnemyDrop,
  rollSalvageDrop,
  splitStardust,
} from "../src/model/drops.ts";
import {
  createFlight,
  encounterReach,
  encounterSpacing,
  hostsEncounterCell,
  rollEncounter,
  stepFlight,
  wreckId,
} from "../src/model/flight.ts";
import {
  acceptJob,
  type BoardContext,
  completeJob,
  heldJob,
  type JobBook,
  nearestSafePlace,
  pullTow,
  stationBoard,
} from "../src/model/jobs.ts";
import { chartLandmarks, landmarkById } from "../src/model/landmarks.ts";
import { clearOfOreFields } from "../src/model/oreFields.ts";
import { stationById, type StationSite, stationsNear } from "../src/model/stations.ts";
import type { FlightState, JobTarget } from "../src/model/types.ts";
import { applyUpgrade, chooseUpgrade, type UpgradeGift } from "../src/model/upgradeDrops.ts";
import { newEconomy } from "../src/model/upgrades.ts";
import { addPacks, noAmmo } from "../src/model/weapons.ts";

export interface Behaviour {
  /** Cruise speed while exploring, as a fraction of Ada's 200 world units per second. */
  speedFraction: number;
  /** Seconds between exploration heading changes, inclusive range. */
  headingSeconds: [number, number];
  /** Standard deviation of each heading change, degrees. */
  turnDegrees: number;
  /** Chance the player detours to a discovery cache once it is on screen. */
  cacheChase: number;
  /**
   * Chance the player detours to an undiscovered station once it is on screen or marked by
   * the direction indicator (within the station data's indicator range).
   */
  stationChase: number;
  /** Chance the player fights a sight-aggressive pack that engages within its perception. */
  fightChance: number;
  /** Chance the player attacks a retaliator once it is on screen. */
  retaliatorFightChance: number;
  /** Fraction of fired volleys that hit the target. */
  hitRate: number;
  /** Seconds of manoeuvring per fight on top of the time spent shooting. */
  engageSeconds: number;
  /** Chance a fleeing enemy is chased down and destroyed. */
  fleeKillChance: number;
  /** Extra seconds spent chasing each fleeing enemy that is destroyed. */
  fleeChaseSeconds: number;
  /** Fraction of a destroyed enemy's pickups (Stardust and upgrades) collected. */
  dropCollection: number;
  /**
   * Chance the player salvages a heavy met in open space, by destroying its weapon hardpoints,
   * instead of breaking its hull; route guards are always destroyed.
   */
  salvageShare: number;
  /** Seconds spent collecting after a fight. */
  collectSeconds: number;
  /**
   * Most asteroids shot per minute while on screen. Each costs the firing time its size's hit
   * points take with the current weapon at the hit rate.
   */
  asteroidsPerMinute: number;
  /** Farthest asteroid the player shoots at, world units. */
  asteroidRange: number;
  /** Chance the player detours for an asteroid's Stardust when it is outside tractor range. */
  asteroidCollect: number;
  /** Chance a fought encounter ends in a quantum jump home (shield depleted). */
  depletionChance: number;
  /**
   * Minutes into play at which each of the galaxy's story route guard fights happens, in
   * ROUTE_GUARDS order; empty disables them.
   */
  guardMinutes: number[];
  /** Seconds of manoeuvring per route guard fight on top of the time spent shooting. */
  guardSeconds: number;
  /**
   * Packs of each owned upgrade weapon's ammunition the player tops up to at each station
   * reached, while the balance allows; 0 never buys ammunition.
   */
  restockPacks: number;
  /**
   * Takes station jobs back to back: docks at a station to take one at random from its board,
   * flies its route, and after completing it heads for the nearest discovered station for the
   * next. One held job at a time, as in the game.
   */
  jobs: boolean;
  /** Seconds docked to read a board and take a job, or to hand over a delivery. */
  dockSeconds: number;
  /**
   * Chance the player takes a job when docked without one. Declining sends the player back to
   * exploring until the next station is discovered.
   */
  jobTake: number;
  /** Chance a delivery to a discovered station or known outpost uses Travel instead of flying. */
  jobTravel: number;
  /** Seconds a Travel jump takes, with its effect. */
  travelSeconds: number;
}

export interface Prices {
  /** The cheapest shop weapon: the first weapon a player can buy. */
  firstWeapon: number;
  /** Cartwheel's hub holodisk price; only Cartwheel's summary reports the time to save it. */
  holodisk: number;
  /**
   * The galaxy's community projects funded in table order, as the Stardust saved by each: a
   * donation pays what the balance covers and part payments persist, so the nth project is funded
   * once the earnings since the chapter ended reach the first n costs.
   */
  projects: number[];
}

export interface EconomyOverrides {
  asteroidStardust?: Partial<Record<AsteroidSize, [number, number]>>;
  discoveryStardust?: number;
  ammoPackPrice?: number;
  upgradeDropChance?: Partial<EconomyCatalog["upgradeDropChance"]>;
  station?: Partial<
    Pick<EconomyCatalog["station"], "cellSize" | "chance" | "indicatorRange" | "jitter">
  >;
}

export interface Scenario {
  name: string;
  description: string;
  economy: EconomyOverrides;
  /** Chunk spawn weight for discovery caches; the base is CONTENT's. */
  cacheSpawnWeight?: number;
  /** Replacement encounter tables per galaxy; the base is the catalog's galaxyEncounters. */
  encounters?: Partial<Record<GalaxyNumber, readonly EncounterEntry[]>>;
  /** Weapons owned at the start, as carried over from earlier galaxies. */
  startWeapons?: UpgradeWeapon[];
  prices: Partial<Prices>;
  behaviour: Partial<Behaviour>;
}

export const DEFAULT_BEHAVIOUR: Behaviour = {
  speedFraction: 0.7,
  headingSeconds: [15, 45],
  turnDegrees: 50,
  cacheChase: 0.6,
  stationChase: 1,
  fightChance: 0.8,
  retaliatorFightChance: 0.5,
  hitRate: 0.5,
  engageSeconds: 4,
  fleeKillChance: 0.6,
  fleeChaseSeconds: 1.5,
  dropCollection: 0.85,
  salvageShare: 0.5,
  collectSeconds: 2,
  asteroidsPerMinute: 4,
  asteroidRange: 300,
  asteroidCollect: 0.6,
  depletionChance: 0.02,
  guardMinutes: [3, 6, 9],
  guardSeconds: 8,
  restockPacks: 3,
  jobs: false,
  dockSeconds: 10,
  jobTake: 1,
  jobTravel: 0.5,
  travelSeconds: 4,
};

/** Named value sets for comparison; `current` changes nothing. */
export const SCENARIOS: Readonly<Record<string, Omit<Scenario, "behaviour" | "name">>> = {
  current: { description: "Current data", economy: {}, prices: {} },
  armed: {
    description: "Typical use of the stronger weapons: Heavy Missile, Scattershot and Phaser owned",
    economy: {},
    prices: {},
    startWeapons: ["heavyMissile", "scattershot", "phaser"],
  },
};

/**
 * Each galaxy's required story route guard fights, mirroring flight.ts's route encounters:
 * one guard per distinct required destination, and galaxy three's holodisk leader and pack.
 * Cartwheel's miner and visitors wait beside the hub without guards, so only the hub has one.
 */
const ROUTE_GUARDS: Readonly<
  Partial<Record<GalaxyNumber, readonly (readonly EnemyArchetype[])[]>>
> = {
  1: [["frigate"], ["frigate"], ["frigate"]],
  2: [["capital"]],
  3: [
    ["capital"],
    ["capital"],
    [
      HOLODISKS.guard.leader,
      ...Array.from({ length: HOLODISKS.guard.packSize }, () => HOLODISKS.guard.pack),
    ],
  ],
};

type Source = "enemies" | "asteroids" | "caches" | "guards" | "jobs";
const SOURCES: readonly Source[] = ["enemies", "asteroids", "caches", "guards", "jobs"];
const SMALL: readonly EnemyArchetype[] = ["swarm", "fighter", "interceptor", "retaliator"];

interface Pickup {
  amount: number;
  id: string;
  source: Source;
  x: number;
  y: number;
}
interface Rock {
  id: string;
  size: AsteroidSize;
  x: number;
  y: number;
}
interface Pack {
  archetype: EnemyArchetype;
  count: number;
  decided: boolean;
  escorts: EncounterEntry["escorts"] | null;
  id: string;
  x: number;
  y: number;
}
interface Chunk {
  caches: Pickup[];
  dust: Pickup[];
  pack: Pack | null;
  rocks: Rock[];
}
interface Target {
  id: string;
  kind: "cache" | "dust" | "station";
  since: number;
  x: number;
  y: number;
}

export interface RunResult {
  galaxy: GalaxyNumber;
  seed: number;
  minutes: number;
  /** Seconds at which the balance first reached each price, or null. */
  firstWeaponSeconds: number | null;
  holodiskSeconds: number | null;
  /** Seconds at which each cumulative project total was first reached, or null. */
  projectsSeconds: (number | null)[];
  stardust: Record<Source, number>;
  enemyStardust: Partial<Record<EnemyArchetype, number>>;
  /** Encounters within reach, those fought, and enemies destroyed, by archetype. */
  met: Partial<Record<EnemyArchetype, number>>;
  fought: Partial<Record<EnemyArchetype, number>>;
  destroyed: Partial<Record<EnemyArchetype, number>>;
  asteroidsShot: number;
  /** Asteroids by size: generated in the chunks the run visited, and shot. */
  asteroidSizes: { seen: Record<AsteroidSize, number>; shot: Record<AsteroidSize, number> };
  /** Seconds spent shooting asteroids. */
  asteroidSeconds: number;
  cachesCollected: number;
  stationSeconds: number[];
  weaponsFound: UpgradeWeapon[];
  /** Seconds at which the first upgrade weapon was found, or null. */
  weaponFoundSeconds: number | null;
  /** Upgrade drops collected, by the kind of gift each gave. */
  upgrades: Partial<Record<UpgradeGift["kind"], number>>;
  /** Heavies salvaged rather than destroyed. */
  salvaged: Partial<Record<EnemyArchetype, number>>;
  jumps: number;
  /** Stardust spent on ammunition packs, and the packs bought. */
  ammoSpent: number;
  packsBought: number;
  /** Packs gained from dropped weapons Ada already owned. */
  duplicatePacks: number;
  /** Times the equipped weapon ran out of ammunition. */
  emptied: number;
  /** Station jobs completed, by type. */
  jobs: Partial<Record<JobType, number>>;
  /** Balance at the end of each minute. */
  balance: number[];
}

/** Mirrors flight.ts's private encounter-cell hash; the test checks it against createFlight. */
function cellHash(seed: number, x: number, y: number): number {
  let n = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}
/** Mirrors flight.ts's private encounter-cell LCG. */
function lcg(seed: number): () => number {
  let n = seed;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
/** The player's behaviour stream, independent of the world's seeded content. */
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function scenarioEconomy(overrides: EconomyOverrides): EconomyCatalog {
  return {
    ...ECONOMY,
    asteroidStardust: { ...ECONOMY.asteroidStardust, ...overrides.asteroidStardust },
    discoveryStardust: overrides.discoveryStardust ?? ECONOMY.discoveryStardust,
    ammo: { ...ECONOMY.ammo, packPrice: overrides.ammoPackPrice ?? ECONOMY.ammo.packPrice },
    upgradeDropChance: { ...ECONOMY.upgradeDropChance, ...overrides.upgradeDropChance },
    station: { ...ECONOMY.station, ...overrides.station },
  };
}

export interface WorldOptions {
  catalog: EconomyCatalog;
  galaxy: GalaxyNumber;
  seed: number;
  spawnWeights: typeof CONTENT.tuning.flight.spawnWeights;
  encounters: readonly EncounterEntry[];
}

/**
 * Gameplay's typical income per route position (gameplay/economy.md): Stardust per minute without
 * jobs, as this simulation measures it. Every pacing target is a price divided by it.
 */
const TYPICAL_INCOME: Readonly<Partial<Record<RoutePosition, number>>> = {
  1: 8,
  2: 10,
  3: 9,
  5: 15,
};

/** A galaxy's typical income, or null for a position Gameplay has not measured. */
function typicalIncome(galaxy: GalaxyNumber): number | null {
  return TYPICAL_INCOME[ROUTE_POSITION[galaxy]] ?? null;
}

const tuning = CONTENT.tuning;
const size = tuning.chunkSize;
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

/** Whether a world offset from Ada is inside the isometric viewport (scene.ts projection). */
export function onScreen(dx: number, dy: number, margin = 0): boolean {
  return (
    Math.abs(dx - dy) <= SCREEN.width / 2 + margin && Math.abs(dx + dy) <= SCREEN.height + margin
  );
}

/** Where every flight launches; layout and encounters keep clear of it. */
const FLIGHT_START = { x: 0, y: 0 };

/**
 * One chunk's layout objects and encounter pack, as flight.ts generates them with Ada at
 * `player`. Resource rocks carry cargo, not Stardust, and debris drops nothing, so both
 * are omitted.
 */
export function generateChunk(
  options: WorldOptions,
  player: { x: number; y: number },
  x: number,
  y: number,
): Chunk {
  const { catalog, galaxy, seed } = options;
  const flight = tuning.flight;
  const stationSafe = (point: { x: number; y: number }) =>
    stationsNear(catalog, galaxy, catalog.station.safeRadius, point).length > 0;
  const chunk: Chunk = { caches: [], dust: [], pack: null, rocks: [] };
  const spacing = encounterSpacing(CONTENT, galaxy);
  if (hostsEncounterCell(spacing, x) && hostsEncounterCell(spacing, y)) {
    const next = lcg(cellHash(seed ^ 9173, x, y));
    const center = { x: (x + 0.5) * size, y: (y + 0.5) * size };
    if (distance(center, player) >= tuning.safeRadius * 2 && !stationSafe(center)) {
      if (Math.floor(next() * 4) !== 3) {
        const countRoll = next();
        const roll = rollEncounter(options.encounters, countRoll, next());
        const { archetype, count } = roll;
        const escorts = roll.escorts ?? null;
        // A flight's start begins calm: the whole encounter stays clear of it.
        const reach = encounterReach(CONTENT, archetype, count, roll.escorts);
        if (distance(center, FLIGHT_START) >= tuning.flight.arrivalCalm + reach) {
          chunk.pack = {
            archetype,
            count,
            decided: false,
            escorts,
            id: `pack:${x},${y}`,
            ...center,
          };
        }
      }
    }
  }
  const plan = planChunk(CHUNK_CATALOG, {
    asteroids: {
      field: byPosition(ASTEROID_FIELDS, galaxy),
      shapes: [...ASTEROID_SHAPES.values()],
    },
    clearance: flight.shipRadius,
    objectsPerChunk: flight.objectsPerChunk,
    rockRadius: flight.rockRadius,
    galaxy,
    seed,
    shipRadius: flight.shipRadius,
    size,
    spawnWeights: options.spawnWeights,
    x,
    y,
  });
  for (const placement of plan.placements) {
    // A drifting asteroid keeps clear of Ada and safe areas over its whole path, a drawn rock by
    // its silhouette radius, as in flight.ts.
    const reach =
      (placement.kind === "pickup" ? flight.pickupRadius : placementRadius(placement)) +
      (placement.orbit?.radius ?? 0);
    // Asteroids keep out of ore fields, as in flight.ts; caches may lie there.
    const clear =
      distance(placement, player) - reach > tuning.safeRadius &&
      distance(placement, FLIGHT_START) - reach > tuning.safeRadius &&
      stationsNear(catalog, galaxy, catalog.station.safeRadius + reach, placement).length === 0 &&
      (placement.kind === "pickup" || clearOfOreFields(galaxy, reach, placement));
    if (!clear) {
      continue;
    }
    // Positions are taken at flight time 0; the sim does not move drifting asteroids.
    const at = placement.orbit
      ? orbitMotion(0, { ...placement.orbit, x: placement.x, y: placement.y }).position
      : placement;
    if (placement.kind === "rock") {
      const size = placement.asteroid ? ASTEROID_SHAPES.get(placement.asteroid)?.size : undefined;
      chunk.rocks.push({ id: placement.id, size: size ?? "small", x: at.x, y: at.y });
    } else if (placement.kind === "pickup") {
      chunk.caches.push({
        amount: catalog.discoveryStardust,
        id: placement.id,
        source: "caches",
        x: at.x,
        y: at.y,
      });
    }
  }
  return chunk;
}

const DAMAGE = tuning.flight.playerShotDamage;
/**
 * Projectiles of one level 1 volley that reach a single small target when the volley hits;
 * the player buys nothing, so found weapons stay at level 1.
 */
const ON_TARGET: Readonly<Record<Weapon, number>> = {
  heavyMissile: 1,
  laser: 1,
  multiLaser: 1.4,
  phaser: 1,
  rapidMissile: 1,
  scattershot: 2.5,
};
/** Projectiles of a volley at `level` that reach one small target; fans keep their share. */
function onTarget(weapon: Weapon, level: number): number {
  const count = weaponAt(weapon, level).anglesDegrees.length;
  return (ON_TARGET[weapon] * count) / weaponAt(weapon, 1).anglesDegrees.length;
}
/** Seconds of firing to deal `hp` to one target at the behaviour's hit rate. */
function volleySeconds(behaviour: Behaviour, weapon: Weapon, hp: number, level = 1): number {
  const definition = weaponAt(weapon, level);
  const perVolley = DAMAGE * definition.damageRatio * onTarget(weapon, level);
  return (Math.ceil(hp / perVolley - 1e-9) * definition.intervalSeconds) / behaviour.hitRate;
}

export interface WeaponStanding {
  weapon: Weapon;
  level: number;
  /** Damage per second on one small target when every volley hits. */
  singleTargetDps: number;
  /** Seconds to destroy one of each archetype at the behaviour's hit rate. */
  killSeconds: Partial<Record<EnemyArchetype, number>>;
}

/**
 * Every weapon at every level against one target in a galaxy (Sunflower by default): the check
 * that no level 3 dominates.
 */
export function weaponStandings(behaviour: Behaviour, galaxy: GalaxyNumber = 1): WeaponStanding[] {
  const archetypes = [...SMALL, "frigate", "capital"] as const;
  return (Object.keys(ON_TARGET) as Weapon[]).flatMap((weapon) =>
    [1, 2, 3].map((level) => {
      const definition = weaponAt(weapon, level);
      return {
        killSeconds: Object.fromEntries(
          archetypes.map((archetype) => [
            archetype,
            killSeconds(behaviour, galaxy, weapon, archetype, level),
          ]),
        ),
        level,
        singleTargetDps:
          (DAMAGE * definition.damageRatio * onTarget(weapon, level)) / definition.intervalSeconds,
        weapon,
      };
    }),
  );
}
/**
 * Seconds of firing to destroy one ship in a galaxy: its position's hull, which every hit
 * lowers, a heavy's hardpoint hits included.
 */
function killSeconds(
  behaviour: Behaviour,
  galaxy: GalaxyNumber,
  weapon: Weapon,
  archetype: EnemyArchetype,
  level = 1,
): number {
  return volleySeconds(behaviour, weapon, enemyDefinition(galaxy, archetype).hp, level);
}
/**
 * Seconds of firing to disable one heavy in a galaxy: each weapon hardpoint shot down in turn,
 * so surplus damage on one never carries to the next.
 */
function salvageSeconds(
  behaviour: Behaviour,
  galaxy: GalaxyNumber,
  weapon: Weapon,
  archetype: EnemyArchetype,
): number {
  return enemyDefinition(galaxy, archetype)
    .hardpoints.filter((part) => part.kind === "weapon")
    .reduce((sum, part) => sum + volleySeconds(behaviour, weapon, part.hp), 0);
}
/**
 * Seconds of firing to destroy one asteroid: bigger sizes hold more hit points and so cost
 * proportionally more firing time.
 */
export function asteroidKillSeconds(
  behaviour: Behaviour,
  galaxy: GalaxyNumber,
  weapon: Weapon,
  size: AsteroidSize,
): number {
  return volleySeconds(behaviour, weapon, byPosition(ASTEROID_FIELDS, galaxy).hp[size]);
}
/** Hull damage after which a ship in a galaxy flees on its own, or null when it never does. */
function fleeAfter(galaxy: GalaxyNumber, archetype: EnemyArchetype): number | null {
  const { hp, morale } = enemyDefinition(galaxy, archetype);
  for (let taken = 1; taken < hp; taken++) {
    if (morale.individualHpRatio > 0 && (hp - taken) / hp <= morale.individualHpRatio) {
      return taken;
    }
  }
  return null;
}

export interface SimulationInput {
  behaviour: Behaviour;
  catalog: EconomyCatalog;
  minutes: number;
  prices: Prices;
  galaxy: GalaxyNumber;
  seed: number;
  spawnWeights: typeof CONTENT.tuning.flight.spawnWeights;
  encounters: readonly EncounterEntry[];
  /** Weapons owned at the start, from earlier galaxies. */
  startWeapons: readonly UpgradeWeapon[];
}

const noSizes = () =>
  Object.fromEntries(ASTEROID_SIZES.map((size) => [size, 0])) as Record<AsteroidSize, number>;

export function simulate(input: SimulationInput): RunResult {
  const { behaviour, catalog, galaxy, prices } = input;
  const rng = mulberry(cellHash(0x51ed, input.seed, galaxy));
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
  const result: RunResult = {
    asteroidSeconds: 0,
    ammoSpent: 0,
    asteroidSizes: { seen: noSizes(), shot: noSizes() },
    asteroidsShot: 0,
    balance: [],
    cachesCollected: 0,
    destroyed: {},
    duplicatePacks: 0,
    emptied: 0,
    enemyStardust: {},
    firstWeaponSeconds: null,
    fought: {},
    holodiskSeconds: null,
    jumps: 0,
    met: {},
    minutes: input.minutes,
    packsBought: 0,
    projectsSeconds: prices.projects.map(() => null),
    galaxy,
    jobs: {},
    seed: input.seed,
    stardust: { asteroids: 0, caches: 0, enemies: 0, guards: 0, jobs: 0 },
    salvaged: {},
    stationSeconds: [],
    upgrades: {},
    weaponFoundSeconds: null,
    weaponsFound: [],
  };
  const add = (record: Partial<Record<EnemyArchetype, number>>, key: EnemyArchetype, n = 1) => {
    record[key] = (record[key] ?? 0) + n;
  };
  const end = input.minutes * 60;
  const dt = 0.25;
  const speed = tuning.physics.maxSpeed * behaviour.speedFraction;
  // Every pickup collects its margin past the drawn ship, approximated by the ship's circle,
  // once the tractor beam has drawn it in from its pull radius.
  const tractor =
    catalog.tractorRadius.base + tuning.flight.shipRadius + tuning.flight.pickupMargin;
  let balance = 0;
  let time = 0;
  let flightSeed = 0;
  let world: WorldOptions;
  let chunks = new Map<string, Chunk>();
  let position = { x: 0, y: 0 };
  let heading = rng() * Math.PI * 2;
  let nextTurn = 0;
  let target: Target | null = null;
  let bucket = 0;
  // A starting loadout carries over from earlier galaxies with a new weapon's packs each; its
  // first weapon is equipped.
  const owned: UpgradeWeapon[] = [...input.startWeapons];
  let weapon: Weapon = owned[0] ?? "laser";
  const ammo = noAmmo();
  for (const each of owned) {
    addPacks(catalog, each, catalog.ammo.grantPacks, ammo);
  }
  /**
   * Spends a volley's shot for each interval of `seconds` fired with the equipped weapon. An
   * emptied weapon switches to Laser, and the player re-equips the first owned weapon with
   * ammunition left. A fight's remaining time keeps the weapon it started with.
   */
  const spend = (seconds: number) => {
    if (weapon === "laser") {
      return;
    }
    ammo[weapon] = Math.max(0, ammo[weapon] - seconds / weaponAt(weapon, 1).intervalSeconds);
    if (ammo[weapon] === 0) {
      result.emptied++;
      weapon = owned.find((each) => ammo[each] > 0) ?? "laser";
    }
  };
  /** Fires for `seconds` with the equipped weapon, advancing time. */
  const shoot = (seconds: number) => {
    spend(seconds);
    advance(seconds);
  };
  /** Tops each owned weapon up to the behaviour's packs while the balance allows. */
  const restock = () => {
    const price = catalog.ammo.packPrice;
    for (const each of owned) {
      const target = behaviour.restockPacks * catalog.ammo.pack[each];
      while (ammo[each] < target && balance >= price) {
        balance -= price;
        ammo[each] += catalog.ammo.pack[each];
        result.ammoSpent += price;
        result.packsBought++;
      }
    }
    if (weapon === "laser") {
      weapon = owned.find((each) => ammo[each] > 0) ?? "laser";
    }
  };
  const declined = new Set<string>();
  const stations = new Set<string>();
  let guard = 0;
  // Station jobs: the game's boards and the galaxy's one optional task slot, charted landmarks,
  // discovered stations, the flight's known outposts, a towed craft and a hunt's search point.
  const book: JobBook = { jobs: { boards: {}, made: 0 }, tasks: {} };
  const progress = { charted: [] as string[], stations: [] as string[] };
  const known = new Map<string, StationSite>();
  const emptyBoards = new Set<string>();
  const outpostCount = galaxy === 3 ? 2 : 3;
  let outposts: JobTarget[] = [];
  let tow: { x: number; y: number } | null = null;
  let search: { x: number; y: number } | null = null;
  let travelDecided = false;
  // Whether the player heads for a station to take the next job.
  let seeking = true;
  const earn = (source: Source, amount: number) => {
    result.stardust[source] += amount;
    balance += amount;
    if (result.firstWeaponSeconds === null && balance >= prices.firstWeapon) {
      result.firstWeaponSeconds = time;
    }
    if (result.holodiskSeconds === null && balance >= prices.holodisk) {
      result.holodiskSeconds = time;
    }
    prices.projects.forEach((total, index) => {
      if (result.projectsSeconds[index] === null && balance >= total) {
        result.projectsSeconds[index] = time;
      }
    });
  };
  const newFlight = () => {
    flightSeed = cellHash(0x0f17, input.seed, result.jumps + galaxy * 1000) || 1;
    world = {
      catalog,
      encounters: input.encounters,
      galaxy,
      seed: flightSeed,
      spawnWeights: input.spawnWeights,
    };
    chunks = new Map();
    position = { x: 0, y: 0 };
    target = null;
    declined.clear();
    // Known outposts are placed ahead of the launch point in turn, as ensureDestination does.
    outposts = outposts.map(({ id }, index) => ({
      id,
      x: Math.ceil(index / 2) * (index % 2 ? 1 : -1) * tuning.safeRadius * 2.5,
      y: -tuning.chunkSize * 2,
    }));
    // A flight's end loses a delivery's item and returns a towed craft to its spot.
    const held = heldJob(galaxy, book);
    if (held?.type === "delivery") {
      held.carrying = false;
    }
    tow = null;
    search = null;
    travelDecided = false;
  };
  newFlight();
  const advance = (seconds: number) => {
    const before = Math.floor(time / 60);
    time += seconds;
    for (let minute = before; minute < Math.min(Math.floor(time / 60), input.minutes); minute++) {
      result.balance[minute] = balance;
    }
  };
  // Upgrade levels, paints and ownership as the game's economy holds them, for choosing gifts.
  const gear = newEconomy(catalog);
  gear.ownedWeapons = owned;
  /**
   * Collects one enemy's drop, destroyed or salvaged, with the player's collection efficiency.
   * An upgrade drop's gift is chosen from what the player can use, as the game does.
   */
  const loot = (archetype: EnemyArchetype, id: string, source: Source, salvaged = false) => {
    const next = dropRandom(flightSeed, wreckId(id));
    const drop = (salvaged ? rollSalvageDrop : rollEnemyDrop)(catalog, galaxy, archetype, next);
    const pieces = splitStardust(catalog.pickupCap[archetype], drop.stardust);
    const collected = pieces.reduce(
      (sum, piece) => sum + (rng() < behaviour.dropCollection ? piece : 0),
      0,
    );
    earn(source, collected);
    if (source === "enemies") {
      add(result.enemyStardust, archetype, collected);
    }
    if (drop.upgrade && rng() < behaviour.dropCollection) {
      const gift = chooseUpgrade(catalog, gear, dropRandom(flightSeed, `upgrade:${id}`));
      result.upgrades[gift.kind] = (result.upgrades[gift.kind] ?? 0) + 1;
      if (gift.kind === "weapon") {
        owned.push(gift.weapon);
        addPacks(catalog, gift.weapon, catalog.ammo.grantPacks, ammo);
        result.weaponsFound.push(gift.weapon);
        result.weaponFoundSeconds ??= time;
        weapon = gift.weapon;
      } else if (gift.kind === "ammo") {
        addPacks(catalog, gift.weapon, 1, ammo);
        result.duplicatePacks++;
      } else {
        applyUpgrade(catalog, gift, gear);
      }
    }
  };
  // A jump home costs only the flight: weapons and Stardust stay.
  const jumpHome = () => {
    result.jumps++;
    newFlight();
  };
  /** Fights one pack, destroying members as morale allows and advancing time as it goes. */
  const fightGroup = (archetype: EnemyArchetype, count: number, id: string) => {
    const definition = enemyDefinition(galaxy, archetype);
    const flee = fleeAfter(galaxy, archetype);
    let lost = 0;
    for (let member = 0; member < count; member++) {
      const packFlees = count > 1 && lost / count >= definition.morale.packLossRatio;
      const fleeing = packFlees || flee !== null;
      if (fleeing && rng() >= behaviour.fleeKillChance) {
        shoot(packFlees ? 0 : volleySeconds(behaviour, weapon, flee ?? 0));
        continue;
      }
      // A heavy is salvaged by destroying its weapon hardpoints, or destroyed at 0 hull.
      const salvaged = HEAVIES.includes(archetype) && rng() < behaviour.salvageShare;
      shoot(
        salvaged
          ? salvageSeconds(behaviour, galaxy, weapon, archetype)
          : killSeconds(behaviour, galaxy, weapon, archetype),
      );
      advance(fleeing ? behaviour.fleeChaseSeconds : 0);
      lost++;
      add(salvaged ? result.salvaged : result.destroyed, archetype);
      loot(archetype, `${id}:${member}`, "enemies", salvaged);
    }
  };
  /** Fights one pack and any escorts, advancing time as it goes. */
  const fight = (pack: Pack) => {
    advance(behaviour.engageSeconds);
    fightGroup(pack.archetype, pack.count, pack.id);
    if (pack.escorts) {
      fightGroup(pack.escorts.archetype, pack.escorts.count, `${pack.id}:escorts`);
    }
    advance(behaviour.collectSeconds);
  };
  const region = () => {
    const cx = Math.floor(position.x / size);
    const cy = Math.floor(position.y / size);
    for (const key of chunks.keys()) {
      const [x, y] = key.split(",").map(Number) as [number, number];
      if (Math.abs(x - cx) > 3 || Math.abs(y - cy) > 3) {
        chunks.delete(key);
      }
    }
    for (let x = cx - 2; x <= cx + 2; x++) {
      for (let y = cy - 2; y <= cy + 2; y++) {
        const key = `${x},${y}`;
        if (!chunks.has(key)) {
          const chunk = generateChunk(world, position, x, y);
          for (const rock of chunk.rocks) {
            result.asteroidSizes.seen[rock.size]++;
          }
          chunks.set(key, chunk);
        }
      }
    }
    return [...chunks.values()];
  };
  const boardContext = (): BoardContext => ({ hostiles: [], outposts, progress, galaxy });
  const finishJob = () => {
    const held = heldJob(galaxy, book)!;
    const reward = completeJob(boardContext(), stationById(catalog, galaxy, held.station), book);
    result.jobs[held.type] = (result.jobs[held.type] ?? 0) + 1;
    earn("jobs", reward);
    tow = null;
    search = null;
    travelDecided = false;
  };
  /** Docks at a station: reloads or hands over a delivery, or takes a job from its board. */
  const dock = (site: StationSite) => {
    const held = heldJob(galaxy, book);
    if (held?.type === "delivery") {
      if (held.station === site.id && !held.carrying) {
        advance(behaviour.dockSeconds);
        held.carrying = true;
      } else if (held.target.id === site.id && held.carrying) {
        advance(behaviour.dockSeconds);
        finishJob();
      }
      return;
    }
    if (held || !behaviour.jobs) {
      return;
    }
    advance(behaviour.dockSeconds);
    seeking = rng() < behaviour.jobTake;
    if (!seeking) {
      return;
    }
    const board = stationBoard(boardContext(), book, site);
    const offer = board[Math.floor(rng() * board.length)];
    if (!offer) {
      emptyBoards.add(site.id);
      return;
    }
    acceptJob(galaxy, site.id, offer.id, book);
  };
  const outpost = (id: string) => outposts.find((place) => place.id === id);
  /**
   * Where the held job sends the player now, with how near counts as arriving, or the nearest
   * discovered station with offers to take the next job from.
   */
  const jobGoal = ():
    ({ x: number; y: number } & { reach: number; station?: StationSite }) | null => {
    const held = heldJob(galaxy, book);
    if (!held) {
      if (!behaviour.jobs || !seeking) {
        return null;
      }
      const sites = [...known.values()].filter((site) => !emptyBoards.has(site.id));
      const nearest = sites.sort((a, b) => distance(a, position) - distance(b, position))[0];
      return nearest ? { ...nearest, reach: catalog.station.safeRadius, station: nearest } : null;
    }
    if (held.type === "survey") {
      const site = landmarkById(galaxy, held.target.id)!;
      return { reach: 0, x: site.x, y: site.y };
    }
    if (held.type === "delivery") {
      const id = held.carrying ? held.target.id : held.station;
      const site = stationById(catalog, galaxy, id);
      if (site) {
        return { ...site, reach: catalog.station.safeRadius, station: site };
      }
      const place = outpost(id) ?? held.target;
      return { reach: tuning.safeRadius, x: place.x, y: place.y };
    }
    if (held.type === "rescue") {
      if (!tow) {
        return { reach: JOB_TUNING.tow.attach, x: held.target.x, y: held.target.y };
      }
      const place = nearestSafePlace(outposts, stationById(catalog, galaxy, held.station), tow)!;
      return { reach: 0, x: place.x, y: place.y };
    }
    const { hunt } = JOB_TUNING;
    if (!held.entered) {
      return { reach: hunt.radius, x: held.target.x, y: held.target.y };
    }
    if (distance(held.spot!, position) <= hunt.penny) {
      return { reach: 0, x: held.spot!.x, y: held.spot!.y };
    }
    // Searching the marked area: wander between random points in it until Penny senses the item.
    if (!search || distance(search, position) < 1) {
      const reach = Math.sqrt(rng()) * hunt.radius;
      const angle = rng() * Math.PI * 2;
      search = {
        x: held.target.x + Math.cos(angle) * reach,
        y: held.target.y + Math.sin(angle) * reach,
      };
    }
    return { reach: 0, ...search };
  };
  /** The held job's progress after a move: charting, docking, Use, the tow line and the hunt. */
  const stepJob = (goal: ReturnType<typeof jobGoal>) => {
    chartLandmarks(galaxy, progress, position);
    const held = heldJob(galaxy, book);
    if (!held) {
      if (goal?.station && distance(goal, position) <= goal.reach) {
        dock(goal.station);
      }
      return;
    }
    if (held.type === "survey" && progress.charted.includes(held.target.id)) {
      finishJob();
    } else if (held.type === "delivery") {
      const place = outpost(held.target.id);
      const site = stationById(catalog, galaxy, held.target.id);
      // Travel here from the Map, once per carried item, to a place the player knows.
      if (held.carrying && !travelDecided) {
        travelDecided = true;
        const reachable = place ?? (site && known.has(site.id) ? site : undefined);
        if (reachable && rng() < behaviour.jobTravel) {
          advance(behaviour.travelSeconds);
          position = { x: reachable.x, y: reachable.y };
        }
      }
      if (goal?.station && distance(goal, position) <= goal.reach) {
        dock(goal.station);
      } else if (held.carrying && place && distance(place, position) <= tuning.safeRadius) {
        finishJob();
      }
    } else if (held.type === "rescue") {
      if (tow) {
        pullTow(position, tow);
        const place = nearestSafePlace(outposts, stationById(catalog, galaxy, held.station), tow);
        if (place && distance(place, tow) <= JOB_TUNING.tow.complete) {
          finishJob();
        }
      } else if (distance(held.target, position) <= JOB_TUNING.tow.attach) {
        tow = { x: held.target.x, y: held.target.y };
      }
    } else if (held.type === "hunt") {
      if (distance(held.target, position) <= JOB_TUNING.hunt.radius) {
        held.entered = true;
      }
      // The tractor beam draws the lost item in like every pickup.
      if (distance(held.spot!, position) <= tractor) {
        finishJob();
      }
    }
  };
  let dustId = 0;
  const running = () => time < end;
  while (running()) {
    const near = region();
    const guards = ROUTE_GUARDS[galaxy]?.[guard];
    if (
      guards &&
      guard < behaviour.guardMinutes.length &&
      time >= (behaviour.guardMinutes[guard] ?? Infinity) * 60
    ) {
      advance(behaviour.guardSeconds);
      guards.forEach((archetype, index) => {
        shoot(killSeconds(behaviour, galaxy, weapon, archetype));
        add(result.destroyed, archetype);
        loot(archetype, `route:guard-${guard}:${index}`, "guards");
      });
      // A route guard marks a story destination reached: an outpost the player now knows.
      if (guard < outpostCount) {
        outposts.push({ id: `outpost:${guard}`, x: position.x, y: position.y });
      }
      guard++;
      continue;
    }
    const indicatorRange = catalog.station.indicatorRange;
    const stationReach = Math.max(4 * size, indicatorRange);
    for (const site of stationsNear(catalog, galaxy, stationReach, position)) {
      if (stations.has(site.id)) {
        continue;
      }
      const gap = distance(site, position);
      if (gap <= catalog.station.safeRadius) {
        stations.add(site.id);
        known.set(site.id, site);
        progress.stations.push(site.id);
        result.stationSeconds.push(time);
        restock();
        if (target?.id === site.id) {
          target = null;
        }
        dock(site);
      } else if (
        target?.kind !== "station" &&
        !declined.has(site.id) &&
        (gap <= indicatorRange ||
          onScreen(site.x - position.x, site.y - position.y, catalog.station.radius))
      ) {
        if (rng() < behaviour.stationChase) {
          target = { id: site.id, kind: "station", since: time, x: site.x, y: site.y };
        } else {
          declined.add(site.id);
        }
      }
    }
    let fought = false;
    let jumped = false;
    for (const chunk of near) {
      const pack = chunk.pack;
      if (!pack || pack.decided) {
        continue;
      }
      const definition = enemyCatalog[pack.archetype];
      const reach =
        definition.aggression === "sight"
          ? distance(pack, position) <= enemyDefinition(galaxy, pack.archetype).perception
          : onScreen(pack.x - position.x, pack.y - position.y);
      if (!reach) {
        continue;
      }
      pack.decided = true;
      add(result.met, pack.archetype);
      const chance =
        definition.aggression === "sight" ? behaviour.fightChance : behaviour.retaliatorFightChance;
      if (rng() < chance) {
        add(result.fought, pack.archetype);
        fight(pack);
        fought = true;
        if (rng() < behaviour.depletionChance) {
          jumpHome();
          jumped = true;
          break;
        }
      }
    }
    if (fought || jumped) {
      continue;
    }
    bucket = Math.min(1, bucket + (behaviour.asteroidsPerMinute * dt) / 60);
    if (bucket >= 1) {
      let best: { chunk: Chunk; rock: Rock } | null = null;
      for (const chunk of near) {
        for (const rock of chunk.rocks) {
          const gap = distance(rock, position);
          if (
            gap <= behaviour.asteroidRange &&
            onScreen(rock.x - position.x, rock.y - position.y) &&
            (!best || gap < distance(best.rock, position))
          ) {
            best = { chunk, rock };
          }
        }
      }
      if (best) {
        bucket = 0;
        result.asteroidsShot++;
        result.asteroidSizes.shot[best.rock.size]++;
        best.chunk.rocks.splice(best.chunk.rocks.indexOf(best.rock), 1);
        const seconds = asteroidKillSeconds(behaviour, galaxy, weapon, best.rock.size);
        result.asteroidSeconds += seconds;
        shoot(seconds);
        const amount = rollAsteroidStardust(
          catalog,
          best.rock.size,
          dropRandom(flightSeed, best.rock.id),
        );
        if (amount > 0) {
          const dust: Pickup = {
            amount,
            id: `dust:${dustId++}`,
            source: "asteroids",
            x: best.rock.x,
            y: best.rock.y,
          };
          best.chunk.dust.push(dust);
          if (!target && distance(dust, position) > tractor && rng() < behaviour.asteroidCollect) {
            target = { id: dust.id, kind: "dust", since: time, x: dust.x, y: dust.y };
          }
        }
      }
    }
    if (!target) {
      for (const chunk of near) {
        for (const cache of chunk.caches) {
          if (declined.has(cache.id) || !onScreen(cache.x - position.x, cache.y - position.y)) {
            continue;
          }
          if (rng() < behaviour.cacheChase) {
            target = { id: cache.id, kind: "cache", since: time, x: cache.x, y: cache.y };
            break;
          }
          declined.add(cache.id);
        }
        if (target) {
          break;
        }
      }
    }
    if (target && time - target.since > (target.kind === "station" ? 60 : 20)) {
      declined.add(target.id);
      target = null;
    }
    if (time >= nextTurn) {
      heading += (gauss() * behaviour.turnDegrees * Math.PI) / 180;
      const [low, high] = behaviour.headingSeconds;
      nextTurn = time + low + rng() * (high - low);
    }
    // Detours come first; otherwise the held job's route, else the exploration heading.
    const job = jobGoal();
    const aim = target ?? job;
    const goal = aim ? Math.atan2(aim.y - position.y, aim.x - position.x) : heading;
    // Towing scales Ada's top speed (gameplay/quests.md "Tow handling").
    const cruise = (tow ? JOB_TUNING.tow.topSpeedScale : 1) * speed * dt;
    const step = aim ? Math.min(cruise, distance(aim, position)) : cruise;
    const start = { ...position };
    position = { x: position.x + Math.cos(goal) * step, y: position.y + Math.sin(goal) * step };
    advance(dt);
    stepJob(job);
    for (const chunk of near) {
      for (const list of [chunk.caches, chunk.dust]) {
        for (let index = list.length - 1; index >= 0; index--) {
          const pickup = list[index]!;
          if (segmentDistance(pickup, start, position) <= tractor) {
            list.splice(index, 1);
            if (pickup.source === "caches") {
              result.cachesCollected++;
            }
            earn(pickup.source, pickup.amount);
            if (target?.id === pickup.id) {
              target = null;
            }
          }
        }
      }
    }
    if (target?.kind !== "station" && target && distance(target, position) < 1) {
      target = null;
    }
  }
  result.balance.length = input.minutes;
  return result;
}

function segmentDistance(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const square = dx * dx + dy * dy;
  const t = square
    ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / square))
    : 0;
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
}

export interface Distribution {
  p10: number;
  median: number;
  p90: number;
  mean: number;
}
export function distribution(values: readonly number[]): Distribution {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) => {
    if (!sorted.length) {
      return Number.NaN;
    }
    const index = (sorted.length - 1) * q;
    const low = Math.floor(index);
    const high = Math.ceil(index);
    return sorted[low]! + (sorted[high]! - sorted[low]!) * (index - low);
  };
  const mean = sorted.reduce((sum, value) => sum + value, 0) / (sorted.length || 1);
  return { mean, median: at(0.5), p10: at(0.1), p90: at(0.9) };
}

export interface Summary {
  scenario: string;
  /** Station jobs completed per hour, by type. */
  jobsPerHour: Record<JobType, number>;
  galaxy: GalaxyNumber;
  runs: number;
  minutes: number;
  prices: Prices;
  /** Minutes until the balance first reaches each price; unreached runs count as the run length. */
  firstWeaponMinutes: Distribution;
  firstWeaponUnreached: number;
  holodiskMinutes: Distribution;
  holodiskUnreached: number;
  /** Minutes until each project in table order is funded; unreached runs count as the run length. */
  projectsMinutes: Distribution[];
  projectsUnreached: number[];
  /** Stardust per minute excluding the one-off story guards. */
  stardustPerMinute: Distribution;
  stardustPerMinuteFirst20: Distribution;
  sourcePerMinute: Record<Source, number>;
  sourceShare: Record<Source, number>;
  guardStardustPerRun: number;
  enemyStardustPerMinute: Partial<Record<EnemyArchetype, number>>;
  metPerMinute: Partial<Record<EnemyArchetype, number>>;
  foughtPerMinute: Partial<Record<EnemyArchetype, number>>;
  destroyedPerMinute: Partial<Record<EnemyArchetype, number>>;
  asteroidsPerMinute: number;
  /** Share of asteroids by size: generated in visited chunks, and shot. */
  asteroidSizeShare: { seen: Record<AsteroidSize, number>; shot: Record<AsteroidSize, number> };
  /** Share of play time spent shooting asteroids. */
  asteroidTimeShare: number;
  cachesPerMinute: number;
  stationsPerHour: Distribution;
  /** Minutes from flight start to the first station, and between later stations. */
  firstStationMinutes: Distribution;
  stationGapMinutes: Distribution;
  runsWithWeaponFound: number;
  /** Minutes until an upgrade pickup first gives a weapon; unfound runs count as the run length. */
  weaponFoundMinutes: Distribution;
  /** Runs that found an upgrade weapon within the first 20 and 40 minutes. */
  weaponFoundBy: { 20: number; 40: number };
  jumpsPerHour: number;
  /** The ammunition pack price in effect. */
  packPrice: number;
  /** Stardust spent on ammunition per minute, and as a share of all Stardust earned. */
  ammoSpentPerMinute: number;
  ammoShareOfIncome: number;
  packsPerHour: number;
  emptiedPerHour: number;
  duplicatePacksPerHour: number;
  /** Upgrade pickups collected per hour, by the kind of gift. */
  upgradesPerHour: Partial<Record<UpgradeGift["kind"], number>>;
  /** Heavies salvaged per minute, by archetype. */
  salvagedPerMinute: Partial<Record<EnemyArchetype, number>>;
}

export function summarise(
  scenario: string,
  prices: Prices,
  packPrice: number,
  runs: readonly RunResult[],
): Summary {
  const minutes = runs[0]?.minutes ?? 0;
  const perMinute = (values: number) => values / (runs.length * minutes);
  const times = (pick: (run: RunResult) => number | null) =>
    runs.map((run) => (pick(run) ?? minutes * 60) / 60);
  const totals = Object.fromEntries(
    SOURCES.map((source) => [source, runs.reduce((sum, run) => sum + run.stardust[source], 0)]),
  ) as Record<Source, number>;
  const income = SOURCES.reduce((sum, source) => sum + totals[source], 0);
  const byArchetype = (pick: (run: RunResult) => Partial<Record<EnemyArchetype, number>>) => {
    const record: Partial<Record<EnemyArchetype, number>> = {};
    for (const run of runs) {
      for (const [key, value] of Object.entries(pick(run))) {
        record[key as EnemyArchetype] = (record[key as EnemyArchetype] ?? 0) + value;
      }
    }
    for (const key of Object.keys(record) as EnemyArchetype[]) {
      record[key] = perMinute(record[key]!);
    }
    return record;
  };
  const ordinary = (run: RunResult) =>
    SOURCES.filter((source) => source !== "guards").reduce(
      (sum, source) => sum + run.stardust[source],
      0,
    );
  const sizeShare = (kind: "seen" | "shot") => {
    const counts = noSizes();
    for (const run of runs) {
      for (const size of ASTEROID_SIZES) {
        counts[size] += run.asteroidSizes[kind][size];
      }
    }
    const all = ASTEROID_SIZES.reduce((sum, size) => sum + counts[size], 0) || 1;
    for (const size of ASTEROID_SIZES) {
      counts[size] /= all;
    }
    return counts;
  };
  const gaps = runs.flatMap((run) =>
    run.stationSeconds.slice(1).map((value, index) => (value - run.stationSeconds[index]!) / 60),
  );
  const ammoSpent = runs.reduce((sum, run) => sum + run.ammoSpent, 0);
  const perHour = (pick: (run: RunResult) => number) =>
    perMinute(runs.reduce((sum, run) => sum + pick(run), 0)) * 60;
  return {
    ammoShareOfIncome: income ? ammoSpent / income : 0,
    ammoSpentPerMinute: perMinute(ammoSpent),
    asteroidSizeShare: { seen: sizeShare("seen"), shot: sizeShare("shot") },
    asteroidTimeShare:
      runs.reduce((sum, run) => sum + run.asteroidSeconds, 0) / (runs.length * minutes * 60 || 1),
    asteroidsPerMinute: perMinute(runs.reduce((sum, run) => sum + run.asteroidsShot, 0)),
    cachesPerMinute: perMinute(runs.reduce((sum, run) => sum + run.cachesCollected, 0)),
    destroyedPerMinute: byArchetype((run) => run.destroyed),
    duplicatePacksPerHour: perHour((run) => run.duplicatePacks),
    emptiedPerHour: perHour((run) => run.emptied),
    enemyStardustPerMinute: byArchetype((run) => run.enemyStardust),
    firstStationMinutes: distribution(times((run) => run.stationSeconds[0] ?? null)),
    firstWeaponMinutes: distribution(times((run) => run.firstWeaponSeconds)),
    firstWeaponUnreached: runs.filter((run) => run.firstWeaponSeconds === null).length,
    foughtPerMinute: byArchetype((run) => run.fought),
    guardStardustPerRun: totals.guards / (runs.length || 1),
    holodiskMinutes: distribution(times((run) => run.holodiskSeconds)),
    holodiskUnreached: runs.filter((run) => run.holodiskSeconds === null).length,
    jobsPerHour: Object.fromEntries(
      JOB_TYPES.map((type) => [
        type,
        perMinute(runs.reduce((sum, run) => sum + (run.jobs[type] ?? 0), 0)) * 60,
      ]),
    ) as Record<JobType, number>,
    jumpsPerHour: perMinute(runs.reduce((sum, run) => sum + run.jumps, 0)) * 60,
    metPerMinute: byArchetype((run) => run.met),
    minutes,
    packPrice,
    packsPerHour: perHour((run) => run.packsBought),
    prices,
    projectsMinutes: prices.projects.map((_, index) =>
      distribution(times((run) => run.projectsSeconds[index] ?? null)),
    ),
    projectsUnreached: prices.projects.map(
      (_, index) => runs.filter((run) => run.projectsSeconds[index] === null).length,
    ),
    runs: runs.length,
    salvagedPerMinute: byArchetype((run) => run.salvaged),
    upgradesPerHour: Object.fromEntries(
      (["weapon", "weaponLevel", "track", "paint", "ammo"] as const).map((kind) => [
        kind,
        perHour((run) => run.upgrades[kind] ?? 0),
      ]),
    ),
    runsWithWeaponFound: runs.filter((run) => run.weaponsFound.length > 0).length,
    weaponFoundBy: {
      20: runs.filter((run) => (run.weaponFoundSeconds ?? Infinity) <= 1200).length,
      40: runs.filter((run) => (run.weaponFoundSeconds ?? Infinity) <= 2400).length,
    },
    weaponFoundMinutes: distribution(times((run) => run.weaponFoundSeconds)),
    scenario,
    galaxy: runs[0]?.galaxy ?? 1,
    sourcePerMinute: Object.fromEntries(
      SOURCES.map((source) => [source, perMinute(totals[source])]),
    ) as Record<Source, number>,
    sourceShare: Object.fromEntries(
      SOURCES.map((source) => [source, income ? totals[source] / income : 0]),
    ) as Record<Source, number>,
    stardustPerMinute: distribution(runs.map((run) => ordinary(run) / minutes)),
    stardustPerMinuteFirst20: distribution(
      runs.map((run) => {
        const at20 = run.balance[Math.min(19, run.balance.length - 1)] ?? 0;
        return at20 / 20;
      }),
    ),
    stationGapMinutes: distribution(gaps),
    stationsPerHour: distribution(runs.map((run) => (run.stationSeconds.length * 60) / minutes)),
  };
}

export interface RunOptions {
  behaviour: Behaviour;
  minutes: number;
  scenario: Scenario;
  galaxy: GalaxyNumber;
  seeds: number;
}
export function runScenario(options: RunOptions): { runs: RunResult[]; summary: Summary } {
  const { scenario } = options;
  const catalog = scenarioEconomy(scenario.economy);
  const prices: Prices = {
    firstWeapon: Math.min(...Object.values(ECONOMY.weaponPrices)),
    holodisk: HOLODISKS.hubPrice,
    projects: galaxyProjects(options.galaxy).map((_, index, projects) =>
      projects.slice(0, index + 1).reduce((sum, { cost }) => sum + cost, 0),
    ),
    ...scenario.prices,
  };
  const spawnWeights = {
    ...tuning.flight.spawnWeights,
    // Weight taken from caches moves to the skipped enemy slot, so rock and resource
    // densities stay unchanged.
    ...(scenario.cacheSpawnWeight === undefined
      ? {}
      : {
          enemy:
            tuning.flight.spawnWeights.enemy +
            tuning.flight.spawnWeights.pickup -
            scenario.cacheSpawnWeight,
          pickup: scenario.cacheSpawnWeight,
        }),
  };
  const runs = Array.from({ length: options.seeds }, (_, index) =>
    simulate({
      behaviour: options.behaviour,
      catalog,
      minutes: options.minutes,
      prices,
      encounters: scenario.encounters?.[options.galaxy] ?? encounterTable(options.galaxy),
      startWeapons: scenario.startWeapons ?? [],
      galaxy: options.galaxy,
      seed: index + 1,
      spawnWeights,
    }),
  );
  return { runs, summary: summarise(scenario.name, prices, catalog.ammo.packPrice, runs) };
}

export interface RealLoopResult {
  galaxy: GalaxyNumber;
  seed: number;
  minutes: number;
  /** Stardust collected from discovery caches and from released drops (enemies and asteroids). */
  caches: number;
  drops: number;
  cachesCollected: number;
  enemiesDestroyed: number;
  depleted: number;
  stations: number;
  /** Packs that engaged Ada, by archetype. */
  engaged: Partial<Record<EnemyArchetype, number>>;
}

/**
 * Cross-check through the real flight loop: a bot explores with the scripted heading walk at
 * the behaviour's cruise speed, steers around obstacles, aims at the nearest live enemy with a
 * first-order lead and fires; it makes no detours and never aims at asteroids. Pickups come
 * only from the tractor beam along the way. Shield depletion starts a new flight.
 */
export function realLoop(
  behaviour: Behaviour,
  minutes: number,
  galaxy: GalaxyNumber,
  seed: number,
): RealLoopResult {
  const rng = mulberry(cellHash(0x7ea1, seed, galaxy));
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
  const result: RealLoopResult = {
    cachesCollected: 0,
    caches: 0,
    depleted: 0,
    drops: 0,
    enemiesDestroyed: 0,
    engaged: {},
    minutes,
    galaxy,
    seed,
    stations: 0,
  };
  const deflection =
    ((behaviour.speedFraction - tuning.minSpeedFraction) / (1 - tuning.minSpeedFraction)) **
    (1 / tuning.speedCurveExponent);
  const newFlight = (): FlightState =>
    createFlight(CONTENT, galaxy, cellHash(0x0f17, seed, result.depleted + galaxy * 1000) || 1, {
      known: [],
    });
  let flight = newFlight();
  let heading = rng() * Math.PI * 2;
  let nextTurn = 0;
  let stuck = 0;
  const engagedPacks = new Set<string>();
  const stations = new Set<string>();
  const dt = 1 / 30;
  const shotSpeed = tuning.flight.projectileSpeed;
  for (let time = 0; time < minutes * 60; time += dt) {
    if (time >= nextTurn) {
      heading += (gauss() * behaviour.turnDegrees * Math.PI) / 180;
      const [low, high] = behaviour.headingSeconds;
      nextTurn = time + low + rng() * (high - low);
    }
    const player = { ...flight.player };
    const probe = { x: player.x + Math.cos(heading) * 70, y: player.y + Math.sin(heading) * 70 };
    const blocked = flight.objects.some(
      (object) =>
        ["rock", "resource", "debris"].includes(object.kind) &&
        object.hp > 0 &&
        segmentDistance(object, player, probe) < object.radius + tuning.flight.shipRadius + 4,
    );
    stuck = Math.hypot(flight.velocity.x, flight.velocity.y) < 20 && time > 2 ? stuck + dt : 0;
    if (blocked || stuck > 0.5) {
      heading += (rng() < 0.5 ? 1 : -1) * (Math.PI / 4);
      stuck = 0;
    }
    let aim = { x: 0, y: 0 };
    let nearest = Infinity;
    for (const object of flight.objects) {
      if (object.kind !== "enemy" || object.hp <= 0 || !object.enemy) {
        continue;
      }
      const { archetype, engaged, packId, velocity } = object.enemy;
      if (engaged && packId && !engagedPacks.has(packId)) {
        engagedPacks.add(packId);
        result.engaged[archetype] = (result.engaged[archetype] ?? 0) + 1;
      }
      const gap = distance(object, player);
      if (gap < nearest && gap <= (archetype === "retaliator" ? 300 : 450)) {
        nearest = gap;
        const lead = gap / shotSpeed;
        aim = {
          x: object.x + velocity.x * lead - player.x,
          y: object.y + velocity.y * lead - player.y,
        };
      }
    }
    const caches = new Map(
      flight.objects
        .filter(
          (object) =>
            object.kind === "pickup" &&
            object.role === "discovery" &&
            object.amount !== undefined &&
            distance(object, player) < 200,
        )
        .map((object) => [object.id, object.amount ?? 0]),
    );
    const move = { x: Math.cos(heading) * deflection, y: Math.sin(heading) * deflection };
    const events = stepFlight(CONTENT, dt, { aim, move, use: false }, flight);
    const remaining = new Set(flight.objects.map((object) => object.id));
    let fromCaches = 0;
    for (const [id, amount] of caches) {
      if (!remaining.has(id)) {
        result.cachesCollected++;
        fromCaches += amount;
      }
    }
    result.caches += fromCaches;
    for (const event of events) {
      if (event.type === "stardust") {
        result.drops += event.amount;
      } else if (event.type === "enemyDestroyed") {
        result.enemiesDestroyed++;
      } else if (event.type === "stationDiscovered" && !stations.has(event.id)) {
        stations.add(event.id);
        result.stations++;
      } else if (event.type === "depleted") {
        result.depleted++;
        flight = newFlight();
        engagedPacks.clear();
        break;
      }
    }
    result.drops -= fromCaches;
  }
  return result;
}

function assign(target: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  let node = target;
  for (const key of keys.slice(0, -1)) {
    const child = node[key];
    if (typeof child !== "object" || child === null) {
      node[key] = {};
    }
    node = node[key] as Record<string, unknown>;
  }
  node[keys.at(-1)!] = value;
}

const round = (value: number, digits = 1) => Number(value.toFixed(digits));
const formatShare = (share: Record<AsteroidSize, number>) =>
  ASTEROID_SIZES.map((size) => `${size} ${round(share[size] * 100)}%`).join(", ");
function formatDistribution(value: Distribution, digits = 1): string {
  return `${round(value.median, digits)} (p10 ${round(value.p10, digits)}, p90 ${round(value.p90, digits)})`;
}
export function formatSummary(summary: Summary): string {
  const income = typicalIncome(summary.galaxy);
  // A price's target minutes at the galaxy's typical income.
  const target = (price: number) => (income ? `; target ${round(price / income)}` : "");
  const lines = [
    `## ${summary.scenario}, galaxy ${summary.galaxy}: ${summary.runs} seeds x ${summary.minutes} min`,
    `Prices: first weapon ${summary.prices.firstWeapon}, ` +
      `projects ${summary.prices.projects.join(", ")} (cumulative), ` +
      `ammunition pack ${summary.packPrice}`,
    `Minutes to first weapon: ${formatDistribution(summary.firstWeaponMinutes)}; ` +
      `unreached ${summary.firstWeaponUnreached}${target(summary.prices.firstWeapon)}`,
    // Only Cartwheel sells a hub holodisk.
    ...(summary.galaxy === 2
      ? [
          `Minutes to save ${summary.prices.holodisk} (Cartwheel's holodisk): ` +
            `${formatDistribution(summary.holodiskMinutes)}; ` +
            `unreached ${summary.holodiskUnreached}${target(summary.prices.holodisk)}`,
        ]
      : []),
    ...summary.projectsMinutes.map((minutes, index) => {
      const saved = summary.prices.projects[index]!;
      return (
        `Minutes to fund project ${index + 1} (${saved} saved): ` +
        `${formatDistribution(minutes)}; ` +
        `unreached ${summary.projectsUnreached[index]}${target(saved)}`
      );
    }),
    `Stardust/min without guards: ${formatDistribution(summary.stardustPerMinute)}; ` +
      `typical ${income ?? "not measured"}`,
    `Balance/min over first 20 min (with guards): ${formatDistribution(summary.stardustPerMinuteFirst20)}`,
    `Per minute by source: ${SOURCES.map((s) => `${s} ${round(summary.sourcePerMinute[s], 2)}`).join(", ")}`,
    `Share by source: ${SOURCES.map((s) => `${s} ${round(summary.sourceShare[s] * 100)}%`).join(", ")}`,
    `Guard Stardust per run: ${round(summary.guardStardustPerRun)}`,
    `Enemy Stardust/min: ${formatRecord(summary.enemyStardustPerMinute, 2)}`,
    `Encounters met/min: ${formatRecord(summary.metPerMinute, 3)}`,
    `Encounters fought/min: ${formatRecord(summary.foughtPerMinute, 3)}`,
    `Enemies destroyed/min: ${formatRecord(summary.destroyedPerMinute, 3)}`,
    `Heavies salvaged/min: ${formatRecord(summary.salvagedPerMinute, 3)}`,
    `Upgrade pickups/hour: ${Object.entries(summary.upgradesPerHour)
      .map(([kind, value]) => `${kind} ${round(value ?? 0, 2)}`)
      .join(", ")}`,
    `Asteroids shot/min: ${round(summary.asteroidsPerMinute, 2)}; ` +
      `caches collected/min: ${round(summary.cachesPerMinute, 2)}`,
    `Asteroid sizes seen: ${formatShare(summary.asteroidSizeShare.seen)}; ` +
      `shot: ${formatShare(summary.asteroidSizeShare.shot)}; ` +
      `time shooting asteroids: ${round(summary.asteroidTimeShare * 100, 1)}%`,
    `Stations/hour: ${formatDistribution(summary.stationsPerHour)}`,
    `Minutes to first station: ${formatDistribution(summary.firstStationMinutes)}`,
    `Minutes between stations: ${formatDistribution(summary.stationGapMinutes)}`,
    `Runs with a weapon found: ${summary.runsWithWeaponFound}; ` +
      `minutes to first found weapon: ${formatDistribution(summary.weaponFoundMinutes)}`,
    `Runs with a weapon found by 20 min: ${summary.weaponFoundBy[20]}, by 40 min: ${summary.weaponFoundBy[40]}`,
    `Jumps home/hour: ${round(summary.jumpsPerHour, 2)}`,
    `Ammunition: ${round(summary.ammoSpentPerMinute, 2)} Stardust/min, ` +
      `${round(summary.ammoShareOfIncome * 100, 1)}% of income; packs bought/hour ` +
      `${round(summary.packsPerHour, 1)}, weapons emptied/hour ${round(summary.emptiedPerHour, 1)}, ` +
      `duplicate packs/hour ${round(summary.duplicatePacksPerHour, 2)}`,
    `Jobs completed/hour: ${Object.entries(summary.jobsPerHour)
      .map(([type, value]) => `${type} ${round(value ?? 0, 2)}`)
      .join(", ")}`,
  ];
  return lines.join("\n");
}
function formatRecord(record: Partial<Record<EnemyArchetype, number>>, digits: number): string {
  const keys = [...SMALL, "frigate", "capital"].filter(
    (key) => record[key as EnemyArchetype] !== undefined,
  );
  return (
    keys.map((key) => `${key} ${round(record[key as EnemyArchetype]!, digits)}`).join(", ") ||
    "none"
  );
}

function main(argv: readonly string[]): void {
  const options = {
    json: false,
    minutes: 90,
    real: false,
    weapons: false,
    scenario: "current",
    galaxy: 1 as GalaxyNumber,
    seeds: 50,
  };
  const scenario: Record<string, unknown> = {};
  const behaviour = structuredClone(DEFAULT_BEHAVIOUR) as unknown as Record<string, unknown>;
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--json") {
      options.json = true;
    } else if (flag === "--weapons") {
      options.weapons = true;
    } else if (flag === "--real") {
      options.real = true;
    } else if (flag === "--jobs") {
      behaviour.jobs = true;
    } else if (flag === "--galaxy" && value) {
      options.galaxy = Number(value) as GalaxyNumber;
      index++;
    } else if (flag === "--seeds" && value) {
      options.seeds = Number(value);
      index++;
    } else if (flag === "--minutes" && value) {
      options.minutes = Number(value);
      index++;
    } else if (flag === "--scenario" && value) {
      options.scenario = value;
      index++;
    } else if (flag === "--set" && value) {
      const split = value.indexOf("=");
      const key = value.slice(0, split);
      const parsed: unknown = JSON.parse(value.slice(split + 1));
      if (key.startsWith("behaviour.")) {
        assign(behaviour, key.slice("behaviour.".length), parsed);
      } else {
        assign(scenario, key, parsed);
      }
      index++;
    } else {
      console.error(
        "Usage: node tools/pacing-sim.ts [--galaxy 1|2] [--seeds N] [--minutes N] " +
          "[--scenario name] [--set key=json ...] [--json] [--real] [--weapons] [--jobs]",
      );
      process.exit(2);
    }
  }
  if (options.weapons) {
    console.log(JSON.stringify(weaponStandings(behaviour as unknown as Behaviour), null, 1));
    return;
  }
  if (options.real) {
    const results = Array.from({ length: options.seeds }, (_, index) =>
      realLoop(behaviour as unknown as Behaviour, options.minutes, options.galaxy, index + 1),
    );
    const total = (pick: (run: RealLoopResult) => number) =>
      results.reduce((sum, run) => sum + pick(run), 0) / (results.length * options.minutes);
    const engaged: Partial<Record<EnemyArchetype, number>> = {};
    for (const run of results) {
      for (const [key, value] of Object.entries(run.engaged)) {
        engaged[key as EnemyArchetype] = (engaged[key as EnemyArchetype] ?? 0) + value;
      }
    }
    for (const key of Object.keys(engaged) as EnemyArchetype[]) {
      engaged[key] = engaged[key]! / (results.length * options.minutes);
    }
    const summary = {
      cachesCollectedPerMinute: total((run) => run.cachesCollected),
      cacheStardustPerMinute: total((run) => run.caches),
      depletedPerHour: total((run) => run.depleted) * 60,
      dropStardustPerMinute: total((run) => run.drops),
      enemiesDestroyedPerMinute: total((run) => run.enemiesDestroyed),
      engagedPacksPerMinute: engaged,
      stationsPerHour: total((run) => run.stations) * 60,
    };
    console.log(JSON.stringify(options.json ? { results, summary } : summary, null, 1));
    return;
  }
  const base = SCENARIOS[options.scenario];
  if (!base) {
    console.error(
      `Unknown scenario ${options.scenario}; known: ${Object.keys(SCENARIOS).join(", ")}`,
    );
    process.exit(2);
  }
  const merged: Scenario = {
    ...base,
    behaviour: {},
    economy: { ...base.economy, ...(scenario.economy as EconomyOverrides | undefined) },
    name:
      options.scenario +
      (behaviour.jobs ? " with jobs" : "") +
      (Object.keys(scenario).length ? " (with --set)" : ""),
    prices: { ...base.prices, ...(scenario.prices as Partial<Prices> | undefined) },
    ...(scenario.cacheSpawnWeight === undefined
      ? {}
      : { cacheSpawnWeight: scenario.cacheSpawnWeight as number }),
    ...(scenario.encounters === undefined
      ? {}
      : { encounters: scenario.encounters as NonNullable<Scenario["encounters"]> }),
    ...(scenario.startWeapons === undefined
      ? {}
      : { startWeapons: scenario.startWeapons as UpgradeWeapon[] }),
  };
  const { runs, summary } = runScenario({
    behaviour: behaviour as unknown as Behaviour,
    minutes: options.minutes,
    scenario: merged,
    galaxy: options.galaxy,
    seeds: options.seeds,
  });
  if (options.json) {
    console.log(JSON.stringify({ behaviour, runs, scenario: merged, summary }));
  } else {
    console.log(formatSummary(summary));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
