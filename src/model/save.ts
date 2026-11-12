import { deliveryDestination } from "../data/destinations.ts";
import { ECONOMY, type UpgradeTrack } from "../data/economy.ts";
import { enemyCatalog } from "../data/enemy-catalog.ts";
import { SECTORS } from "../data/galaxies.ts";
import { HUNTING_PACKS } from "../data/galaxy-features.ts";
import { JOB_TYPES } from "../data/jobs.ts";
import { galaxyProjects } from "../data/projects.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { RESOURCE_ROCKS } from "../data/resource-rocks.ts";
import { CARTWHEEL_STORY_SHIPS } from "../data/story-ships.ts";
import type { SectorId } from "../data/types.ts";
import { WEAPON_CATALOG } from "../data/weapon-catalog.ts";
import { validActivity } from "./activities.ts";
import { ASTEROID_SHAPES } from "./asteroids.ts";
import { enemyEffects } from "./enemy-ai.ts";
import { ACTIVE_CHUNK_RADIUS, encounterOf, persistentObject } from "./geography.ts";
import { isLandmark } from "./landmarks.ts";
import { validExplored } from "./map.ts";
import { newProgress } from "./progress.ts";
import { fundedProjects } from "./projects.ts";
import { namesStation, stationById } from "./stations.ts";
import type {
  AmmoCounts,
  EconomyState,
  FlightState,
  GameState,
  PersistentWorldState,
  SpaceObject,
  UpgradeLevels,
} from "./types.ts";
import { chunkCoordinates, validVisitedPages } from "./visited.ts";
import { UPGRADE_WEAPONS } from "./weapons.ts";

/** The save format this build writes and reads. */
export const SAVE_VERSION: GameState["version"] = 2;

/**
 * Whether saved was written by a newer build: its version is above SAVE_VERSION. Such a save is
 * never read or overwritten here; the game requires the newer version first. Any other save this
 * build cannot read, older or malformed, resets to a new game.
 */
export function newerSave(saved: unknown): boolean {
  let value = saved;
  if (typeof saved === "string") {
    try {
      value = JSON.parse(saved) as unknown;
    } catch {
      return false;
    }
  }
  return record(value) && finite(value.version) && value.version > SAVE_VERSION;
}

/** Storage access can fail in private browsing or when quotas are exhausted. */
export function readSave(storage: Pick<Storage, "getItem">, key: string): unknown {
  try {
    return JSON.parse(storage.getItem(key) ?? "null") as unknown;
  } catch {
    return null;
  }
}
export function writeSave(storage: Pick<Storage, "setItem">, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function vector(value: unknown): boolean {
  return (
    record(value) &&
    finite(value.x) &&
    finite(value.y) &&
    Math.abs(value.x) <= Number.MAX_SAFE_INTEGER / 2 &&
    Math.abs(value.y) <= Number.MAX_SAFE_INTEGER / 2
  );
}
function strings(value: unknown): boolean {
  return Array.isArray(value) && Array.from(value).every((v) => typeof v === "string");
}
const destinationIds: Record<number, readonly string[]> = {
  1: ["growers", "workshop", "salvagers"],
  2: ["hub", "miner", "visitors"],
  3: ["whale", "family", "holodisk"],
};
/** Saved achievements: id and count lists, non-negative counts and a blockade flag. */
function achievementState(value: unknown): boolean {
  return (
    record(value) &&
    ["unlocked", "allies", "projects", "paints", "sensed", "found"].every((key) =>
      strings(value[key]),
    ) &&
    ["jobs", "activities", "finds"].every(
      (key) => Number.isInteger(value[key]) && nonnegative(value[key]),
    ) &&
    typeof value.blockade === "boolean" &&
    record(value.charted) &&
    Object.values(value.charted).every(strings)
  );
}

function nonnegative(value: unknown): boolean {
  return finite(value) && value >= 0;
}
function enemyState(value: unknown): boolean {
  if (
    !record(value) ||
    typeof value.archetype !== "string" ||
    !Object.hasOwn(enemyCatalog, value.archetype) ||
    typeof value.id !== "string" ||
    !(value.packId === null || typeof value.packId === "string") ||
    !["disabled", "engaged", "fleeing", "returning", "salvaged"].every(
      (key) => typeof value[key] === "boolean",
    ) ||
    !["home", "position", "velocity"].every((key) => vector(value[key])) ||
    !(value.lastSeen === null || vector(value.lastSeen)) ||
    !["age", "hp", "lastSeenAge", "primaryCooldown", "pursuitSeconds"].every((key) =>
      nonnegative(value[key]),
    ) ||
    !finite(value.phase) ||
    !vector(value.facing) ||
    !nullableVector(value.heading) ||
    !nullableVector(value.aim) ||
    !(value.escortOf === null || typeof value.escortOf === "string") ||
    !tacticState(value.tactic) ||
    !Array.isArray(value.hardpoints)
  ) {
    return false;
  }
  const definition = enemyCatalog[value.archetype as keyof typeof enemyCatalog];
  const hardpoints: unknown[] = value.hardpoints;
  return (
    hardpoints.length === definition.hardpoints.length &&
    definition.hardpoints.every(
      (part) => hardpoints.filter((entry) => record(entry) && entry.id === part.id).length === 1,
    ) &&
    hardpoints.every(
      (part) =>
        record(part) &&
        nonnegative(part.hp) &&
        nonnegative(part.cooldown) &&
        (part.burst === undefined ||
          (Number.isInteger(part.burst) && (part.burst as number) >= 0)) &&
        nullableVector(part.aim),
    )
  );
}
function tacticState(value: unknown): boolean {
  return (
    record(value) &&
    ["attack", "retreat", "pass"].includes(String(value.phase)) &&
    ["integrity", "seconds", "volleys"].every((key) => nonnegative(value[key]))
  );
}
/** An unset orientation is null. */
function nullableVector(value: unknown): boolean {
  return value === null || vector(value);
}
function combatState(
  routes: readonly string[],
  value: unknown,
): value is NonNullable<FlightState["combat"]> {
  return (
    record(value) &&
    record(value.initialPackSizes) &&
    Object.entries(value.initialPackSizes).every(
      ([id, size]) =>
        id.length > 0 &&
        !["__proto__", "prototype", "constructor"].includes(id) &&
        Number.isSafeInteger(size) &&
        nonnegative(size),
    ) &&
    (value.unloadedPackMembers === undefined ||
      (record(value.unloadedPackMembers) &&
        Object.entries(value.unloadedPackMembers).every(
          ([id, count]) =>
            id.length > 0 &&
            !["__proto__", "prototype", "constructor"].includes(id) &&
            Number.isSafeInteger(count) &&
            nonnegative(count),
        ))) &&
    strings(value.routeEncounters) &&
    (value.routeEncounters as string[]).every((id) => routes.includes(id)) &&
    (value.huntingPacks === undefined ||
      (strings(value.huntingPacks) &&
        (value.huntingPacks as string[]).every((id) => HUNTING_PACKS.destinations.includes(id))))
  );
}
function wreckState(value: unknown): boolean {
  return (
    record(value) &&
    typeof value.archetype === "string" &&
    Object.hasOwn(enemyCatalog, value.archetype) &&
    nonnegative(value.age) &&
    vector(value.facing) &&
    (value.released === undefined || typeof value.released === "boolean") &&
    (value.blasted === undefined || typeof value.blasted === "boolean")
  );
}
const OBJECT_KINDS = [
  "rock",
  "resource",
  "enemy",
  "hazard",
  "pickup",
  "destination",
  "debris",
  "station",
  "wreck",
];
function spaceObject(
  sector: SectorId,
  routes: readonly string[],
  value: unknown,
): value is SpaceObject {
  return (
    record(value) &&
    vector(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    !["__proto__", "prototype", "constructor"].includes(value.id) &&
    OBJECT_KINDS.includes(String(value.kind)) &&
    (value.kind !== "station" || stationById(ECONOMY, sector, value.id) !== null) &&
    (value.kind === "wreck" ? wreckState(value.wreck) : value.wreck === undefined) &&
    (value.release === undefined ||
      (value.kind === "pickup" &&
        record(value.release) &&
        nonnegative(value.release.at) &&
        (value.release.from === undefined || vector(value.release.from)))) &&
    (value.amount === undefined ||
      (value.kind === "pickup" &&
        Number.isSafeInteger(value.amount) &&
        nonnegative(value.amount))) &&
    (value.routeId === undefined ||
      (typeof value.routeId === "string" && routes.includes(value.routeId))) &&
    (value.velocity === undefined || vector(value.velocity)) &&
    (value.asteroid === undefined ||
      ((value.kind === "rock" || value.kind === "debris" || value.kind === "resource") &&
        typeof value.asteroid === "string" &&
        ASTEROID_SHAPES.has(value.asteroid))) &&
    (value.orbit === undefined ||
      (value.kind === "rock" &&
        record(value.orbit) &&
        vector(value.orbit) &&
        nonnegative(value.orbit.radius) &&
        finite(value.orbit.rate) &&
        finite(value.orbit.phase))) &&
    (value.spinStart === undefined ||
      (typeof value.asteroid === "string" &&
        Number.isInteger(value.spinStart) &&
        nonnegative(value.spinStart) &&
        (value.spinStart as number) < (ASTEROID_SHAPES.get(value.asteroid)?.frames.length ?? 0))) &&
    (value.resource === undefined ||
      (value.kind === "resource" &&
        typeof value.resource === "string" &&
        Object.hasOwn(RESOURCE_ROCKS.classes, value.resource))) &&
    (value.river === undefined ||
      (value.kind === "debris" &&
        record(value.river) &&
        typeof value.river.current === "string" &&
        finite(value.river.arc))) &&
    (value.enemy === undefined ||
      (value.kind === "enemy" &&
        enemyState(value.enemy) &&
        record(value.enemy) &&
        value.enemy.id === value.id)) &&
    nonnegative(value.radius) &&
    finite(value.hp) &&
    (value.role === undefined || typeof value.role === "string") &&
    (value.persistent === undefined || typeof value.persistent === "boolean") &&
    (value.cooldown === undefined || nonnegative(value.cooldown)) &&
    (value.behavior === undefined ||
      ["pursue", "shoot", "guard"].includes(String(value.behavior))) &&
    (value.weapon === undefined || UPGRADE_WEAPONS.some((weapon) => weapon === value.weapon))
  );
}
function persistentWorld(
  sector: SectorId,
  routes: readonly string[],
  active: readonly SpaceObject[],
  value: unknown,
): value is PersistentWorldState {
  if (
    !record(value) ||
    value.version !== 1 ||
    !record(value.notables) ||
    Object.keys(value).some((key) => !["version", "notables"].includes(key))
  ) {
    return false;
  }
  const ids = new Set(active.map((object) => object.id));
  if (ids.size !== active.length) {
    return false;
  }
  for (const [id, object] of Object.entries(value.notables)) {
    if (!id || ["__proto__", "prototype", "constructor"].includes(id) || ids.has(id)) {
      return false;
    }
    ids.add(id);
    if (object === null) {
      continue;
    }
    if (
      !spaceObject(sector, routes, object) ||
      object.id !== id ||
      !persistentObject(object) ||
      object.hp <= 0 ||
      object.kind === "destination" ||
      object.id.startsWith("whale-debris:") ||
      (object.kind === "enemy" &&
        object.enemy &&
        enemyEffects(enemyCatalog[object.enemy.archetype], object.enemy).defeated)
    ) {
      return false;
    }
  }
  return true;
}
function unloadedPackState(
  active: readonly SpaceObject[],
  world: PersistentWorldState,
  combat: NonNullable<FlightState["combat"]>,
): boolean {
  const unloaded = combat.unloadedPackMembers ?? {};
  const represented = new Map<string, number>();
  for (const object of [...active, ...Object.values(world.notables)]) {
    if (
      !object ||
      object.kind !== "enemy" ||
      object.hp <= 0 ||
      !object.enemy?.packId ||
      enemyEffects(enemyCatalog[object.enemy.archetype], object.enemy).defeated
    ) {
      continue;
    }
    represented.set(object.enemy.packId, (represented.get(object.enemy.packId) ?? 0) + 1);
  }
  return (
    [...represented].every(
      ([id, count]) =>
        Object.hasOwn(combat.initialPackSizes, id) &&
        count + (unloaded[id] ?? 0) <= combat.initialPackSizes[id]!,
    ) &&
    // A role's unloaded survivors need a represented member somewhere in their encounter.
    Object.entries(unloaded).every(
      ([id, count]) =>
        Number.isSafeInteger(count) &&
        count > 0 &&
        Object.hasOwn(combat.initialPackSizes, id) &&
        [...represented.keys()].some((pack) => encounterOf(pack) === encounterOf(id)),
    )
  );
}

function weaponOwnership(value: unknown, selected: unknown): boolean {
  return (
    strings(value) &&
    Array.isArray(value) &&
    Array.from(value).every((weapon) => UPGRADE_WEAPONS.some((id) => id === weapon)) &&
    new Set(value).size === value.length &&
    (selected === "basic" || value.includes(selected))
  );
}

/** Levels run from 1, the base, to one more than the number of priced levels. */
function boundedLevel(value: unknown, prices: number): boolean {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= prices + 1;
}
/** Every upgrade weapon's shots left, each a whole number, none negative. */
function ammoCounts(value: unknown): value is AmmoCounts {
  return (
    record(value) &&
    Object.keys(value).length === UPGRADE_WEAPONS.length &&
    UPGRADE_WEAPONS.every(
      (weapon) => Number.isSafeInteger(value[weapon]) && nonnegative(value[weapon]),
    )
  );
}
function upgradeLevels(value: unknown): value is UpgradeLevels {
  return (
    record(value) &&
    record(value.weapons) &&
    Object.keys(value.weapons).length === Object.keys(WEAPON_CATALOG).length &&
    Object.keys(WEAPON_CATALOG).every((weapon) =>
      boundedLevel(
        (value.weapons as Record<string, unknown>)[weapon],
        ECONOMY.weaponUpgradePrices.length,
      ),
    ) &&
    (Object.keys(ECONOMY.trackPrices) as UpgradeTrack[]).every((track) =>
      boundedLevel(value[track], ECONOMY.trackPrices[track].length),
    )
  );
}

function economyState(value: unknown): value is EconomyState {
  return (
    record(value) &&
    Number.isSafeInteger(value.stardust) &&
    nonnegative(value.stardust) &&
    Object.hasOwn(WEAPON_CATALOG, String(value.weapon)) &&
    weaponOwnership(value.ownedWeapons, value.weapon) &&
    upgradeLevels(value.levels) &&
    ammoCounts(value.ammo) &&
    strings(value.paints) &&
    Array.isArray(value.paints) &&
    new Set(value.paints).size === value.paints.length &&
    value.paints.includes(ECONOMY.defaultPaint) &&
    value.paints.every((scheme) => Object.hasOwn(ECONOMY.paints, scheme)) &&
    value.paints.includes(value.paint)
  );
}
/** Each paid amount is a whole number of Stardust toward one of the galaxy's projects, at most its cost. */
function donations(sector: SectorId, value: unknown): boolean {
  return (
    record(value) &&
    Object.entries(value).every(([id, paid]) => {
      const project = galaxyProjects(sector).find((entry) => entry.id === id);
      return (
        project !== undefined &&
        Number.isInteger(paid) &&
        nonnegative(paid) &&
        Number(paid) <= project.cost
      );
    })
  );
}
/** Each revealed project appears once and is one of the galaxy's projects, fully paid. */
function revealedProjects(sector: SectorId, donated: unknown, value: unknown): boolean {
  const paid = record(donated) ? donated : {};
  return (
    strings(value) &&
    Array.isArray(value) &&
    new Set(value).size === value.length &&
    value.every((id) => {
      const project = galaxyProjects(sector).find((entry) => entry.id === id);
      return project !== undefined && paid[id] === project.cost;
    })
  );
}
function stationIds(sector: SectorId, value: unknown): boolean {
  return (
    strings(value) &&
    Array.isArray(value) &&
    new Set(value).size === value.length &&
    value.every((id) => namesStation(ECONOMY, sector, String(id)))
  );
}

/** Charted landmark ids: distinct landmarks of the galaxy. */
function chartedIds(sector: SectorId, value: unknown): boolean {
  return (
    Array.isArray(value) &&
    strings(value) &&
    new Set(value).size === value.length &&
    value.every((id) => isLandmark(sector, String(id)))
  );
}
/**
 * A saved job offer: a station of the galaxy issues it, and its target is a landmark for a
 * survey, a station or outpost for a delivery, or a spot for a rescue or hunt.
 */
function jobOffer(sector: SectorId, value: unknown): boolean {
  if (
    !record(value) ||
    typeof value.id !== "string" ||
    !JOB_TYPES.includes(value.type as (typeof JOB_TYPES)[number]) ||
    typeof value.station !== "string" ||
    !namesStation(ECONOMY, sector, value.station) ||
    !nonnegative(value.reward) ||
    typeof value.item !== "string" ||
    !record(value.target) ||
    !vector(value.target) ||
    typeof value.target.id !== "string" ||
    (value.spot !== undefined && !vector(value.spot))
  ) {
    return false;
  }
  const target = value.target.id;
  if (value.type === "survey") {
    return isLandmark(sector, target);
  }
  if (value.type === "delivery") {
    return (
      target !== value.station &&
      (stationById(ECONOMY, sector, target) !== null ||
        ((destinationIds[sector] ?? []).includes(target) && deliveryDestination(target)))
    );
  }
  return target === "" && (value.type === "rescue" || vector(value.spot));
}
const SECTOR_KEYS = ["1", "2", "3"];
/** Saved job boards. */
function jobsState(value: unknown): boolean {
  if (
    !record(value) ||
    !record(value.boards) ||
    !Number.isSafeInteger(value.made) ||
    !nonnegative(value.made)
  ) {
    return false;
  }
  const sectors = SECTOR_KEYS;
  return Object.entries(value.boards).every(
    ([sector, stations]) =>
      sectors.includes(sector) &&
      record(stations) &&
      Object.entries(stations).every(
        ([station, offers]) =>
          namesStation(ECONOMY, Number(sector) as SectorId, station) &&
          Array.isArray(offers) &&
          offers.every(
            (offer) =>
              jobOffer(Number(sector) as SectorId, offer) &&
              record(offer) &&
              offer.station === station,
          ),
      ),
  );
}
/** Saved optional task slots, one per galaxy: each a held job or an activity with its progress. */
function optionalTasks(value: unknown): boolean {
  return (
    record(value) &&
    Object.entries(value).every(
      ([sector, task]) =>
        SECTOR_KEYS.includes(sector) &&
        record(task) &&
        ((task.kind === "job" &&
          jobOffer(Number(sector) as SectorId, task) &&
          (task.carrying === undefined || typeof task.carrying === "boolean") &&
          (task.entered === undefined || typeof task.entered === "boolean")) ||
          (task.kind === "activity" && validActivity(Number(sector) as SectorId, task))),
    )
  );
}

/**
 * Restores a complete snapshot of the current save version, or null. A save of any other
 * version, or one with a missing or malformed field, is rejected whole: a partial restore can
 * invalidate quest state. The result shares no references with `saved`.
 */
export function restoreSave(saved: unknown): GameState | null {
  try {
    const value: unknown = typeof saved === "string" ? JSON.parse(saved) : structuredClone(saved);
    if (
      !record(value) ||
      value.version !== SAVE_VERSION ||
      !["home", "space"].includes(String(value.mode)) ||
      !SECTORS.includes(value.selectedSector as SectorId) ||
      !record(value.progress)
    ) {
      return null;
    }
    if (
      !Array.isArray(value.unlocked) ||
      !value.unlocked.includes(1) ||
      value.unlocked.some((v) => !SECTORS.includes(v as SectorId)) ||
      !value.unlocked.includes(value.selectedSector)
    ) {
      return null;
    }
    if (
      typeof value.notice !== "string" ||
      !["prologueSeen", "announceGalaxy", "started"].every(
        (key) => typeof value[key] === "boolean",
      ) ||
      !strings(value.seenConversations) ||
      !achievementState(value.achievements)
    ) {
      return null;
    }
    for (const id of SECTORS) {
      const p = value.progress[id];
      if (
        !record(p) ||
        !Number.isInteger(p.stage) ||
        !nonnegative(p.stage) ||
        Number(p.stage) > (id === 1 ? 4 : 5) ||
        !strings(p.known) ||
        ![null, "food", "toolkit", "parts"].includes(p.questItem as string | null) ||
        (Array.isArray(p.known) && p.known.some((v) => !destinationIds[id]?.includes(v))) ||
        (p.resolved === true && p.questComplete !== true)
      ) {
        return null;
      }
      if (
        !["introduced", "questComplete", "resolved"].every((k) => typeof p[k] === "boolean") ||
        !["deposited", "discoveries", "disabledEnemies"].every((k) => nonnegative(p[k])) ||
        !["holodisk", "opened"].every((k) => typeof p[k] === "boolean") ||
        !stationIds(id as SectorId, p.stations) ||
        !donations(id as SectorId, p.donated) ||
        !chartedIds(id as SectorId, p.charted) ||
        !revealedProjects(id as SectorId, p.donated, p.revealed) ||
        !validExplored(PROTOTYPE.tuning.chunkSize, p.explored) ||
        (p.guides !== undefined && !(Number.isSafeInteger(p.guides) && nonnegative(p.guides))) ||
        (p.replayScene !== undefined &&
          !(
            typeof p.replayScene === "string" &&
            Object.hasOwn(CARTWHEEL_STORY_SHIPS.scenes, p.replayScene)
          ))
      ) {
        return null;
      }
    }
    if (
      !economyState(value.economy) ||
      !jobsState(value.jobs) ||
      !optionalTasks(value.tasks) ||
      !(value.docked === null || (typeof value.docked === "string" && value.mode === "space"))
    ) {
      return null;
    }
    if (value.dialogue !== null) {
      const d = value.dialogue;
      if (
        !record(d) ||
        !["title", "text", "context"].every((k) => typeof d[k] === "string") ||
        !Array.isArray(d.choices) ||
        !d.choices.every(
          (c) => record(c) && typeof c.id === "string" && typeof c.label === "string",
        )
      ) {
        return null;
      }
    }
    if (value.flight !== null) {
      const f = value.flight;
      if (
        !record(f) ||
        f.sector !== value.selectedSector ||
        !["player", "velocity", "facing"].every((k) => vector(f[k])) ||
        ![
          "seed",
          "time",
          "shield",
          "sinceDamage",
          "dangerFor",
          "cargo",
          "fireCooldown",
          "freshDistance",
          "nextId",
          "weaponSwitchFor",
        ].every((k) => nonnegative(f[k])) ||
        !ammoCounts(f.ammo) ||
        !(f.dockId === null || typeof f.dockId === "string") ||
        (f.tow !== undefined && !vector(f.tow)) ||
        (f.calf !== undefined &&
          !(
            record(f.calf) &&
            vector(f.calf) &&
            vector(f.calf.velocity) &&
            typeof f.calf.following === "boolean"
          )) ||
        !upgradeLevels(f.levels)
      ) {
        return null;
      }
      const routes = destinationIds[value.selectedSector as number] ?? [];
      if (f.combat !== undefined && !combatState(routes, f.combat)) {
        return null;
      }
      if (
        !Number.isSafeInteger(f.seed) ||
        !Number.isSafeInteger(f.nextId) ||
        !(
          f.freshChunk === null ||
          (typeof f.freshChunk === "string" && chunkCoordinates(f.freshChunk) !== null)
        )
      ) {
        return null;
      }
      if (
        !Object.hasOwn(WEAPON_CATALOG, String(f.weapon)) ||
        !strings(f.chunks) ||
        !Array.isArray(f.chunks) ||
        f.chunks.length > (ACTIVE_CHUNK_RADIUS * 2 + 1) ** 2 ||
        new Set(f.chunks).size !== f.chunks.length ||
        !f.chunks.every((key) => typeof key === "string" && chunkCoordinates(key) !== null) ||
        !validVisitedPages(f.visited) ||
        f.dormant !== undefined ||
        f.exploredChunks !== undefined
      ) {
        return null;
      }
      if (f.ownedWeapons !== undefined && !weaponOwnership(f.ownedWeapons, f.weapon)) {
        return null;
      }
      if (
        f.storyScene !== undefined &&
        !(
          record(f.storyScene) &&
          nonnegative(f.storyScene.at) &&
          typeof f.storyScene.lineDue === "boolean" &&
          typeof f.storyScene.id === "string" &&
          Object.hasOwn(CARTWHEEL_STORY_SHIPS.scenes, f.storyScene.id)
        )
      ) {
        return null;
      }
      // Travel arrivals are bounded by the destinations and stations Ada can reach.
      if (
        f.arrivals !== undefined &&
        !(Array.isArray(f.arrivals) && f.arrivals.length <= 256 && f.arrivals.every(vector))
      ) {
        return null;
      }
      // Run-only granted weapons are a subset of the flight's roster.
      if (
        f.grantedWeapons !== undefined &&
        (!weaponOwnership(f.grantedWeapons, "basic") ||
          !Array.isArray(f.ownedWeapons) ||
          !(f.grantedWeapons as unknown[]).every((weapon) =>
            (f.ownedWeapons as unknown[]).includes(weapon),
          ))
      ) {
        return null;
      }
      if (
        !Array.isArray(f.objects) ||
        !Array.from(f.objects).every((object) =>
          spaceObject(value.selectedSector as SectorId, routes, object),
        )
      ) {
        return null;
      }
      if (!persistentWorld(value.selectedSector as SectorId, routes, f.objects, f.world)) {
        return null;
      }
      if (f.combat !== undefined && !unloadedPackState(f.objects, f.world, f.combat)) {
        return null;
      }
      if (
        !Array.isArray(f.shots) ||
        !Array.from(f.shots).every(
          (s) =>
            record(s) &&
            vector(s) &&
            vector(s.velocity) &&
            typeof s.id === "string" &&
            typeof s.enemy === "boolean" &&
            typeof s.piercing === "boolean" &&
            (s.projectile === undefined ||
              ["bolt", "missile", "dot"].includes(String(s.projectile))) &&
            (s.enemy || (finite(s.damage) && s.damage > 0)) &&
            (s.blast === undefined ||
              (!s.enemy && s.projectile === "missile" && finite(s.blast) && s.blast > 0)) &&
            (s.fade === undefined ||
              (!s.enemy &&
                s.projectile === "dot" &&
                record(s.fade) &&
                finite(s.fade.initialLife) &&
                s.fade.initialLife > 0 &&
                finite(s.fade.projectedRange) &&
                s.fade.projectedRange > 0 &&
                finite(s.fade.fadeStartFraction) &&
                s.fade.fadeStartFraction >= 0 &&
                s.fade.fadeStartFraction < 1 &&
                finite(s.life) &&
                s.life <= s.fade.initialLife)) &&
            finite(s.life) &&
            strings(s.hitIds),
        )
      ) {
        return null;
      }
    }
    if (value.mode === "space" && value.flight === null) {
      return null;
    }
    return value as unknown as GameState;
  } catch {
    return null;
  }
}
