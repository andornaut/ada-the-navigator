/**
 * Headless Stardust pacing simulation for Gameplay review.
 *
 * World content comes from the game's own generators and drop rolls: chunk plans
 * (asteroids and discovery caches), encounter cells and their sector tables, station
 * sites, enemy and asteroid drops and pickup splitting. A scripted player explores,
 * fights encounters met in passing, shoots some asteroids and collects pickups inside
 * tractor range. Every behavioural assumption is a named, overridable parameter.
 *
 * Usage: node tools/pacing-sim.ts [--sector 1|2] [--seeds 50] [--minutes 90]
 *   [--scenario current|drops|mixed|...] [--set key=value ...] [--json]
 * Values given to --set are JSON; dotted keys reach nested parameters or overrides,
 * for example --set behaviour.hitRate=0.4 or --set economy.discoveryStardust=5.
 */
import { pathToFileURL } from "node:url";

import { CHUNK_CATALOG } from "../src/data/chunk-catalog.ts";
import { ECONOMY, type EconomyCatalog, type UpgradeWeapon } from "../src/data/economy.ts";
import {
  type EnemyArchetype,
  enemyCatalog,
  enemyEncounterTuning,
  sectorEncounters,
} from "../src/data/enemy-catalog.ts";
import { HOLODISKS } from "../src/data/holodisks.ts";
import { PROTOTYPE } from "../src/data/prototype.ts";
import { SCREEN } from "../src/data/screen.ts";
import type { SectorId, Weapon } from "../src/data/types.ts";
import { WEAPON_CATALOG } from "../src/data/weapon-catalog.ts";
import { planChunk } from "../src/model/chunk-templates.ts";
import {
  dropRandom,
  rollAsteroidStardust,
  rollEnemyDrop,
  splitStardust,
} from "../src/model/drops.ts";
import { createFlight, rollEncounter, stepFlight, wreckId } from "../src/model/flight.ts";
import { stationsNear } from "../src/model/stations.ts";
import type { FlightState } from "../src/model/types.ts";

export interface Behaviour {
  /** Cruise speed while exploring, as a fraction of Ada's 200 world units per second. */
  speedFraction: number;
  /** Seconds between exploration heading changes, inclusive range. */
  headingSeconds: [number, number];
  /** Standard deviation of each heading change, degrees. */
  turnDegrees: number;
  /** Chance the player detours to a discovery cache once it is on screen. */
  cacheChase: number;
  /** Chance the player detours to an undiscovered station once it is on screen. */
  stationChase: number;
  /**
   * Hypothetical station direction indicator range in world units; 0 means stations are
   * found only once on screen, as now.
   */
  stationIndicatorRange: number;
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
  /** Fraction of a destroyed enemy's pickups (Stardust and weapons) collected. */
  dropCollection: number;
  /** Seconds spent collecting after a fight. */
  collectSeconds: number;
  /** Most asteroids shot per minute; asteroids are shot in passing while on screen. */
  asteroidsPerMinute: number;
  /** Farthest asteroid the player shoots at, world units. */
  asteroidRange: number;
  /** Chance the player detours for an asteroid's Stardust when it is outside tractor range. */
  asteroidCollect: number;
  /** Chance a fought encounter ends in a quantum jump home (shield depleted). */
  depletionChance: number;
  /** Minutes into play at which each story route guard is destroyed; empty disables them. */
  guardMinutes: number[];
  /** Seconds of manoeuvring per route guard fight on top of the time spent shooting. */
  guardSeconds: number;
}

export interface Prices {
  /** The cheapest shop weapon: the first weapon a player can buy. */
  firstWeapon: number;
  /** Galaxy two's hub holodisk. */
  holodisk: number;
}

export interface EconomyOverrides {
  enemyStardust?: Partial<Record<EnemyArchetype, number>>;
  asteroidStardust?: [number, number];
  discoveryStardust?: number;
  ownedWeaponStardust?: number;
  weaponDropChance?: Partial<Record<EnemyArchetype, number>>;
  jumpFee?: number;
  station?: Partial<Pick<EconomyCatalog["station"], "cellSize" | "chance" | "jitter">>;
}

export interface Scenario {
  name: string;
  description: string;
  economy: EconomyOverrides;
  /** Chunk spawn weight for discovery caches; the base is PROTOTYPE's. */
  cacheSpawnWeight?: number;
  prices: Partial<Prices>;
  behaviour: Partial<Behaviour>;
}

export const DEFAULT_BEHAVIOUR: Behaviour = {
  speedFraction: 0.7,
  headingSeconds: [15, 45],
  turnDegrees: 50,
  cacheChase: 0.6,
  stationChase: 1,
  stationIndicatorRange: 0,
  fightChance: 0.8,
  retaliatorFightChance: 0.5,
  hitRate: 0.5,
  engageSeconds: 4,
  fleeKillChance: 0.6,
  fleeChaseSeconds: 1.5,
  dropCollection: 0.85,
  collectSeconds: 2,
  asteroidsPerMinute: 4,
  asteroidRange: 300,
  asteroidCollect: 0.6,
  depletionChance: 0.02,
  guardMinutes: [3, 6, 9],
  guardSeconds: 8,
};

/** Rarer small-craft and frigate weapon drops, so the first weapon is usually bought. */
const rareWeaponDrops = {
  fighter: 0.005,
  frigate: 0.05,
  interceptor: 0.005,
  retaliator: 0.005,
  swarm: 0.005,
};
/** Stations 4000 apart on a grid with a 1000 band (at least 3000 apart), 90% occupied. */
const denseStations = { cellSize: 4000, chance: 0.9, jitter: 1000 };

/** Named value sets for comparison; `current` changes nothing. */
export const SCENARIOS: Readonly<Record<string, Omit<Scenario, "behaviour" | "name">>> = {
  current: { description: "Current data", economy: {}, prices: {} },
  drops: {
    cacheSpawnWeight: 0.0095,
    description:
      "Rewards only: enemy Stardust floor(HP / 2), at least 1; asteroids 1; rarer caches of 5; " +
      "rarer weapon drops; prices unchanged",
    economy: {
      asteroidStardust: [1, 1],
      discoveryStardust: 5,
      enemyStardust: {
        capital: 9,
        fighter: 2,
        frigate: 5,
        interceptor: 1,
        oversizedCapital: 11,
        retaliator: 4,
        swarm: 1,
      },
      weaponDropChance: rareWeaponDrops,
    },
    prices: {},
  },
  "drops-stations": {
    cacheSpawnWeight: 0.0095,
    description: "The drops scenario with dense stations",
    economy: {
      asteroidStardust: [1, 1],
      discoveryStardust: 5,
      enemyStardust: {
        capital: 9,
        fighter: 2,
        frigate: 5,
        interceptor: 1,
        oversizedCapital: 11,
        retaliator: 4,
        swarm: 1,
      },
      station: denseStations,
      weaponDropChance: rareWeaponDrops,
    },
    prices: {},
  },
  mixed: {
    cacheSpawnWeight: 0.0105,
    description:
      "Rewards and prices: enemy Stardust equal to HP; asteroids 1-2; rarer caches of 10; " +
      "rarer weapon drops; every shop price, the holodisk, the jump fee and the duplicate " +
      "weapon conversion doubled",
    economy: {
      asteroidStardust: [1, 2],
      discoveryStardust: 10,
      enemyStardust: {
        capital: 19,
        fighter: 4,
        frigate: 10,
        interceptor: 3,
        oversizedCapital: 22,
        retaliator: 8,
        swarm: 2,
      },
      jumpFee: 20,
      ownedWeaponStardust: 50,
      weaponDropChance: rareWeaponDrops,
    },
    prices: { firstWeapon: 300, holodisk: 600 },
  },
};

type Source = "enemies" | "asteroids" | "caches" | "duplicates" | "guards";
const SOURCES: readonly Source[] = ["enemies", "asteroids", "caches", "duplicates", "guards"];
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
  x: number;
  y: number;
}
interface Pack {
  archetype: EnemyArchetype;
  count: number;
  decided: boolean;
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
  sector: SectorId;
  seed: number;
  minutes: number;
  /** Seconds at which the balance first reached each price, or null. */
  firstWeaponSeconds: number | null;
  holodiskSeconds: number | null;
  stardust: Record<Source, number>;
  enemyStardust: Partial<Record<EnemyArchetype, number>>;
  /** Encounters within reach, those fought, and enemies destroyed, by archetype. */
  met: Partial<Record<EnemyArchetype, number>>;
  fought: Partial<Record<EnemyArchetype, number>>;
  destroyed: Partial<Record<EnemyArchetype, number>>;
  asteroidsShot: number;
  cachesCollected: number;
  stationSeconds: number[];
  weaponsFound: UpgradeWeapon[];
  /** Seconds at which the first upgrade weapon was found, or null. */
  weaponFoundSeconds: number | null;
  jumps: number;
  feesPaid: number;
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
    asteroidStardust: overrides.asteroidStardust ?? ECONOMY.asteroidStardust,
    discoveryStardust: overrides.discoveryStardust ?? ECONOMY.discoveryStardust,
    enemyStardust: { ...ECONOMY.enemyStardust, ...overrides.enemyStardust },
    jumpFee: overrides.jumpFee ?? ECONOMY.jumpFee,
    ownedWeaponStardust: overrides.ownedWeaponStardust ?? ECONOMY.ownedWeaponStardust,
    weaponDropChance: { ...ECONOMY.weaponDropChance, ...overrides.weaponDropChance },
    station: { ...ECONOMY.station, ...overrides.station },
  };
}

export interface WorldOptions {
  catalog: EconomyCatalog;
  sector: SectorId;
  seed: number;
  spawnWeights: typeof PROTOTYPE.tuning.flight.spawnWeights;
}

const tuning = PROTOTYPE.tuning;
const size = tuning.chunkSize;
const span = Math.max(3, Math.ceil(enemyEncounterTuning.quietDistance / size));
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

/** Whether a world offset from Ada is inside the isometric viewport (scene.ts projection). */
export function onScreen(dx: number, dy: number, margin = 0): boolean {
  return (
    Math.abs(dx - dy) <= SCREEN.width / 2 + margin && Math.abs(dx + dy) <= SCREEN.height + margin
  );
}

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
  const { catalog, sector, seed } = options;
  const flight = tuning.flight;
  const stationSafe = (point: { x: number; y: number }) =>
    stationsNear(catalog, sector, catalog.station.safeRadius, point).length > 0;
  const chunk: Chunk = { caches: [], dust: [], pack: null, rocks: [] };
  if (x % span === 0 && y % span === 0) {
    const next = lcg(cellHash(seed ^ 9173, x, y));
    const center = { x: (x + 0.5) * size, y: (y + 0.5) * size };
    if (distance(center, player) >= tuning.safeRadius * 2 && !stationSafe(center)) {
      if (Math.floor(next() * 4) !== 3) {
        const countRoll = next();
        const { archetype, count } = rollEncounter(sectorEncounters[sector], countRoll, next());
        chunk.pack = { archetype, count, decided: false, id: `pack:${x},${y}`, ...center };
      }
    }
  }
  const plan = planChunk(CHUNK_CATALOG, {
    clearance: flight.shipRadius,
    objectsPerChunk: flight.objectsPerChunk,
    rockRadius: flight.rockRadius,
    sector,
    seed,
    shipRadius: flight.shipRadius,
    size,
    spawnWeights: options.spawnWeights,
    x,
    y,
  });
  for (const placement of plan.placements) {
    if (distance(placement, player) <= tuning.safeRadius || stationSafe(placement)) {
      continue;
    }
    if (placement.kind === "rock") {
      chunk.rocks.push({ id: placement.id, x: placement.x, y: placement.y });
    } else if (placement.kind === "pickup") {
      chunk.caches.push({
        amount: catalog.discoveryStardust,
        id: placement.id,
        source: "caches",
        x: placement.x,
        y: placement.y,
      });
    }
  }
  return chunk;
}

const DAMAGE = tuning.flight.playerShotDamage;
/** Projectiles of one volley that reach a single small target when the volley hits. */
const ON_TARGET: Readonly<Record<Weapon, number>> = {
  basic: 1,
  missiles: 1,
  scattershot: 2.5,
  tripleLaser: 1.4,
};
function volleySeconds(behaviour: Behaviour, weapon: Weapon, hp: number): number {
  const definition = WEAPON_CATALOG[weapon];
  const perVolley = DAMAGE * definition.damageRatio * ON_TARGET[weapon];
  return (Math.ceil(hp / perVolley - 1e-9) * definition.intervalSeconds) / behaviour.hitRate;
}
function totalHp(archetype: EnemyArchetype): number {
  const definition = enemyCatalog[archetype];
  return definition.hardpoints.length
    ? definition.hardpoints.reduce((sum, part) => sum + part.hp, 0)
    : definition.hp;
}
/** Hull damage after which a ship flees on its own, or null when it never does. */
function fleeAfter(archetype: EnemyArchetype): number | null {
  const { hp, morale } = enemyCatalog[archetype];
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
  sector: SectorId;
  seed: number;
  spawnWeights: typeof PROTOTYPE.tuning.flight.spawnWeights;
}

export function simulate(input: SimulationInput): RunResult {
  const { behaviour, catalog, prices, sector } = input;
  const rng = mulberry(cellHash(0x51ed, input.seed, sector));
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
  const result: RunResult = {
    asteroidsShot: 0,
    balance: [],
    cachesCollected: 0,
    destroyed: {},
    enemyStardust: {},
    feesPaid: 0,
    firstWeaponSeconds: null,
    fought: {},
    holodiskSeconds: null,
    jumps: 0,
    met: {},
    minutes: input.minutes,
    sector,
    seed: input.seed,
    stardust: { asteroids: 0, caches: 0, duplicates: 0, enemies: 0, guards: 0 },
    stationSeconds: [],
    weaponFoundSeconds: null,
    weaponsFound: [],
  };
  const add = (record: Partial<Record<EnemyArchetype, number>>, key: EnemyArchetype, n = 1) => {
    record[key] = (record[key] ?? 0) + n;
  };
  const end = input.minutes * 60;
  const dt = 0.25;
  const speed = tuning.maxSpeed * tuning.physics.speedRatio * behaviour.speedFraction;
  const tractor = catalog.tractorRadius.base + tuning.flight.pickupReach;
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
  let weapon: Weapon = "basic";
  const owned: UpgradeWeapon[] = [];
  const declined = new Set<string>();
  const stations = new Set<string>();
  let guard = 0;
  const earn = (source: Source, amount: number) => {
    result.stardust[source] += amount;
    balance += amount;
    if (result.firstWeaponSeconds === null && balance >= prices.firstWeapon) {
      result.firstWeaponSeconds = time;
    }
    if (result.holodiskSeconds === null && balance >= prices.holodisk) {
      result.holodiskSeconds = time;
    }
  };
  const newFlight = () => {
    flightSeed = cellHash(0x0f17, input.seed, result.jumps + sector * 1000) || 1;
    world = { catalog, sector, seed: flightSeed, spawnWeights: input.spawnWeights };
    chunks = new Map();
    position = { x: 0, y: 0 };
    target = null;
    declined.clear();
  };
  newFlight();
  const advance = (seconds: number) => {
    const before = Math.floor(time / 60);
    time += seconds;
    for (let minute = before; minute < Math.min(Math.floor(time / 60), input.minutes); minute++) {
      result.balance[minute] = balance;
    }
  };
  /** Destroys one enemy and collects its drop with the player's collection efficiency. */
  const loot = (archetype: EnemyArchetype, id: string, source: Source) => {
    const next = dropRandom(flightSeed, wreckId(id));
    const drop = rollEnemyDrop(catalog, owned, archetype, next);
    const base = catalog.enemyStardust[archetype];
    const pieces = splitStardust(catalog.pickupCap[archetype], drop.stardust);
    const collected = pieces.reduce(
      (sum, piece) => sum + (rng() < behaviour.dropCollection ? piece : 0),
      0,
    );
    const share = drop.stardust ? collected / drop.stardust : 0;
    const duplicate = (drop.stardust - base) * share;
    earn(source, collected - duplicate);
    if (duplicate) {
      earn("duplicates", duplicate);
    }
    if (source === "enemies") {
      add(result.enemyStardust, archetype, collected - duplicate);
    }
    if (drop.weapon && rng() < behaviour.dropCollection) {
      owned.push(drop.weapon);
      result.weaponsFound.push(drop.weapon);
      result.weaponFoundSeconds ??= time;
      weapon = drop.weapon;
    }
  };
  const jumpHome = () => {
    const fee = Math.min(catalog.jumpFee, balance);
    balance -= fee;
    result.feesPaid += fee;
    result.jumps++;
    if (weapon !== "basic") {
      owned.splice(owned.indexOf(weapon), 1);
      weapon = "basic";
    }
    newFlight();
  };
  /** Fights one pack, destroying members as morale allows and advancing time as it goes. */
  const fight = (pack: Pack) => {
    const definition = enemyCatalog[pack.archetype];
    const flee = fleeAfter(pack.archetype);
    advance(behaviour.engageSeconds);
    let lost = 0;
    for (let member = 0; member < pack.count; member++) {
      const packFlees = pack.count > 1 && lost / pack.count >= definition.morale.packLossRatio;
      const fleeing = packFlees || flee !== null;
      if (fleeing && rng() >= behaviour.fleeKillChance) {
        advance(packFlees ? 0 : volleySeconds(behaviour, weapon, flee ?? 0));
        continue;
      }
      advance(
        volleySeconds(behaviour, weapon, definition.hp) +
          (fleeing ? behaviour.fleeChaseSeconds : 0),
      );
      lost++;
      add(result.destroyed, pack.archetype);
      loot(pack.archetype, `${pack.id}:${member}`, "enemies");
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
          chunks.set(key, generateChunk(world, position, x, y));
        }
      }
    }
    return [...chunks.values()];
  };
  let dustId = 0;
  const running = () => time < end;
  while (running()) {
    const near = region();
    if (
      guard < behaviour.guardMinutes.length &&
      time >= (behaviour.guardMinutes[guard] ?? Infinity) * 60
    ) {
      const archetype: EnemyArchetype = sector === 1 ? "frigate" : "capital";
      advance(behaviour.guardSeconds + volleySeconds(behaviour, weapon, totalHp(archetype)));
      add(result.destroyed, archetype);
      loot(archetype, `route:guard-${guard}`, "guards");
      guard++;
      continue;
    }
    const stationReach = Math.max(4 * size, behaviour.stationIndicatorRange);
    for (const site of stationsNear(catalog, sector, stationReach, position)) {
      if (stations.has(site.id)) {
        continue;
      }
      const gap = distance(site, position);
      if (gap <= catalog.station.safeRadius) {
        stations.add(site.id);
        result.stationSeconds.push(time);
        if (target?.id === site.id) {
          target = null;
        }
      } else if (
        target?.kind !== "station" &&
        !declined.has(site.id) &&
        (gap <= behaviour.stationIndicatorRange ||
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
          ? distance(pack, position) <= definition.perception
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
        best.chunk.rocks.splice(best.chunk.rocks.indexOf(best.rock), 1);
        const amount = rollAsteroidStardust(catalog, dropRandom(flightSeed, best.rock.id));
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
    const goal = target ? Math.atan2(target.y - position.y, target.x - position.x) : heading;
    const step = target ? Math.min(speed * dt, distance(target, position)) : speed * dt;
    const start = { ...position };
    position = { x: position.x + Math.cos(goal) * step, y: position.y + Math.sin(goal) * step };
    advance(dt);
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
  sector: SectorId;
  runs: number;
  minutes: number;
  prices: Prices;
  /** Minutes until the balance first reaches each price; unreached runs count as the run length. */
  firstWeaponMinutes: Distribution;
  firstWeaponUnreached: number;
  holodiskMinutes: Distribution;
  holodiskUnreached: number;
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
  cachesPerMinute: number;
  stationsPerHour: Distribution;
  /** Minutes from flight start to the first station, and between later stations. */
  firstStationMinutes: Distribution;
  stationGapMinutes: Distribution;
  runsWithWeaponFound: number;
  /** Minutes until the first upgrade weapon drop is collected; unfound runs count as the run length. */
  weaponFoundMinutes: Distribution;
  /** Runs that found an upgrade weapon within the first 20 and 40 minutes. */
  weaponFoundBy: { 20: number; 40: number };
  jumpsPerHour: number;
}

export function summarise(scenario: string, prices: Prices, runs: readonly RunResult[]): Summary {
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
  const gaps = runs.flatMap((run) =>
    run.stationSeconds.slice(1).map((value, index) => (value - run.stationSeconds[index]!) / 60),
  );
  return {
    asteroidsPerMinute: perMinute(runs.reduce((sum, run) => sum + run.asteroidsShot, 0)),
    cachesPerMinute: perMinute(runs.reduce((sum, run) => sum + run.cachesCollected, 0)),
    destroyedPerMinute: byArchetype((run) => run.destroyed),
    enemyStardustPerMinute: byArchetype((run) => run.enemyStardust),
    firstStationMinutes: distribution(times((run) => run.stationSeconds[0] ?? null)),
    firstWeaponMinutes: distribution(times((run) => run.firstWeaponSeconds)),
    firstWeaponUnreached: runs.filter((run) => run.firstWeaponSeconds === null).length,
    foughtPerMinute: byArchetype((run) => run.fought),
    guardStardustPerRun: totals.guards / (runs.length || 1),
    holodiskMinutes: distribution(times((run) => run.holodiskSeconds)),
    holodiskUnreached: runs.filter((run) => run.holodiskSeconds === null).length,
    jumpsPerHour: perMinute(runs.reduce((sum, run) => sum + run.jumps, 0)) * 60,
    metPerMinute: byArchetype((run) => run.met),
    minutes,
    prices,
    runs: runs.length,
    runsWithWeaponFound: runs.filter((run) => run.weaponsFound.length > 0).length,
    weaponFoundBy: {
      20: runs.filter((run) => (run.weaponFoundSeconds ?? Infinity) <= 1200).length,
      40: runs.filter((run) => (run.weaponFoundSeconds ?? Infinity) <= 2400).length,
    },
    weaponFoundMinutes: distribution(times((run) => run.weaponFoundSeconds)),
    scenario,
    sector: runs[0]?.sector ?? 1,
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
  sector: SectorId;
  seeds: number;
}
export function runScenario(options: RunOptions): { runs: RunResult[]; summary: Summary } {
  const { scenario } = options;
  const catalog = scenarioEconomy(scenario.economy);
  const prices: Prices = {
    firstWeapon: Math.min(...Object.values(ECONOMY.weaponPrices)),
    holodisk: HOLODISKS.hubPrice,
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
      sector: options.sector,
      seed: index + 1,
      spawnWeights,
    }),
  );
  return { runs, summary: summarise(scenario.name, prices, runs) };
}

export interface RealLoopResult {
  sector: SectorId;
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
  sector: SectorId,
  seed: number,
): RealLoopResult {
  const rng = mulberry(cellHash(0x7ea1, seed, sector));
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
  const result: RealLoopResult = {
    cachesCollected: 0,
    caches: 0,
    depleted: 0,
    drops: 0,
    enemiesDestroyed: 0,
    engaged: {},
    minutes,
    sector,
    seed,
    stations: 0,
  };
  const deflection =
    ((behaviour.speedFraction - tuning.minSpeedFraction) / (1 - tuning.minSpeedFraction)) **
    (1 / tuning.speedCurveExponent);
  const newFlight = (): FlightState =>
    createFlight(PROTOTYPE, sector, cellHash(0x0f17, seed, result.depleted + sector * 1000) || 1, {
      known: [],
    });
  let flight = newFlight();
  let heading = rng() * Math.PI * 2;
  let nextTurn = 0;
  let stuck = 0;
  const engagedPacks = new Set<string>();
  const stations = new Set<string>();
  const dt = 1 / 30;
  const shotSpeed = tuning.maxSpeed * tuning.flight.projectileSpeedFactor;
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
    const events = stepFlight(PROTOTYPE, dt, { aim, move, use: false }, flight);
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
      } else if (event.type === "enemyDisabled") {
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
function formatDistribution(value: Distribution, digits = 1): string {
  return `${round(value.median, digits)} (p10 ${round(value.p10, digits)}, p90 ${round(value.p90, digits)})`;
}
export function formatSummary(summary: Summary): string {
  const lines = [
    `## ${summary.scenario}, sector ${summary.sector}: ${summary.runs} seeds x ${summary.minutes} min`,
    `Prices: first weapon ${summary.prices.firstWeapon}, holodisk ${summary.prices.holodisk}`,
    `Minutes to first weapon: ${formatDistribution(summary.firstWeaponMinutes)}; ` +
      `unreached ${summary.firstWeaponUnreached}`,
    `Minutes to holodisk: ${formatDistribution(summary.holodiskMinutes)}; ` +
      `unreached ${summary.holodiskUnreached}`,
    `Stardust/min without guards: ${formatDistribution(summary.stardustPerMinute)}`,
    `Balance/min over first 20 min (with guards): ${formatDistribution(summary.stardustPerMinuteFirst20)}`,
    `Per minute by source: ${SOURCES.map((s) => `${s} ${round(summary.sourcePerMinute[s], 2)}`).join(", ")}`,
    `Share by source: ${SOURCES.map((s) => `${s} ${round(summary.sourceShare[s] * 100)}%`).join(", ")}`,
    `Guard Stardust per run: ${round(summary.guardStardustPerRun)}`,
    `Enemy Stardust/min: ${formatRecord(summary.enemyStardustPerMinute, 2)}`,
    `Encounters met/min: ${formatRecord(summary.metPerMinute, 3)}`,
    `Encounters fought/min: ${formatRecord(summary.foughtPerMinute, 3)}`,
    `Enemies destroyed/min: ${formatRecord(summary.destroyedPerMinute, 3)}`,
    `Asteroids shot/min: ${round(summary.asteroidsPerMinute, 2)}; ` +
      `caches collected/min: ${round(summary.cachesPerMinute, 2)}`,
    `Stations/hour: ${formatDistribution(summary.stationsPerHour)}`,
    `Minutes to first station: ${formatDistribution(summary.firstStationMinutes)}`,
    `Minutes between stations: ${formatDistribution(summary.stationGapMinutes)}`,
    `Runs with a weapon found: ${summary.runsWithWeaponFound}; ` +
      `minutes to first found weapon: ${formatDistribution(summary.weaponFoundMinutes)}`,
    `Runs with a weapon found by 20 min: ${summary.weaponFoundBy[20]}, by 40 min: ${summary.weaponFoundBy[40]}`,
    `Jumps home/hour: ${round(summary.jumpsPerHour, 2)}`,
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
    scenario: "current",
    sector: 1 as SectorId,
    seeds: 50,
  };
  const scenario: Record<string, unknown> = {};
  const behaviour = structuredClone(DEFAULT_BEHAVIOUR) as unknown as Record<string, unknown>;
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--json") {
      options.json = true;
    } else if (flag === "--real") {
      options.real = true;
    } else if (flag === "--sector" && value) {
      options.sector = Number(value) as SectorId;
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
        "Usage: node tools/pacing-sim.ts [--sector 1|2] [--seeds N] [--minutes N] " +
          "[--scenario name] [--set key=json ...] [--json] [--real]",
      );
      process.exit(2);
    }
  }
  if (options.real) {
    const results = Array.from({ length: options.seeds }, (_, index) =>
      realLoop(behaviour as unknown as Behaviour, options.minutes, options.sector, index + 1),
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
    name: options.scenario + (Object.keys(scenario).length ? " (with --set)" : ""),
    prices: { ...base.prices, ...(scenario.prices as Partial<Prices> | undefined) },
    ...(scenario.cacheSpawnWeight === undefined
      ? {}
      : { cacheSpawnWeight: scenario.cacheSpawnWeight as number }),
  };
  const { runs, summary } = runScenario({
    behaviour: behaviour as unknown as Behaviour,
    minutes: options.minutes,
    scenario: merged,
    sector: options.sector,
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
