import { ANDROMEDA_PLACES } from "../data/andromeda.ts";
import { CONTENT } from "../data/content.ts";
import { deliveryDestination } from "../data/destinations.ts";
import { ECONOMY, type UpgradeTrack } from "../data/economy.ts";
import { enemyCatalog, enemyDefinition } from "../data/enemyCatalog.ts";
import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import { HUNTING_PACKS } from "../data/galaxyFeatures.ts";
import { JOB_TYPES } from "../data/jobs.ts";
import { NEEDLE_PLACES } from "../data/needle.ts";
import { PHANTOM_DESTINATIONS } from "../data/phantom.ts";
import { galaxyProjects } from "../data/projects.ts";
import { RESOURCE_ROCKS } from "../data/resourceRocks.ts";
import { OVERNIGHT_SLEEP } from "../data/storybook.ts";
import { CARTWHEEL_STORY_SHIPS } from "../data/storyShips.ts";
import type { GalaxyNumber, GameContent, Weapon } from "../data/types.ts";
import { WEAPON_CATALOG } from "../data/weaponCatalog.ts";
import { validActivity } from "./activities.ts";
import { validAndromedaProgress } from "./andromeda.ts";
import { settlementById } from "./andromedaPlaces.ts";
import { ASTEROID_SHAPES } from "./asteroids.ts";
import { holodisksHeld } from "./conversations.ts";
import { enemyDefeated } from "./enemyAi.ts";
import { ACTIVE_CHUNK_RADIUS, encounterOf, persistentObject } from "./geography.ts";
import { isLandmark } from "./landmarks.ts";
import { validExplored } from "./map.ts";
import { readNeedleChapterProgress, validNeedleFlight } from "./needleRuntime.ts";
import { validPhantomFlight, validPhantomProgress } from "./phantom.ts";
import { namesStation, stationById } from "./stations.ts";
import { currentPage } from "./storybook.ts";
import { readStoryCursor } from "./storyCursor.ts";
import { resolveStoryScene } from "./storyScenes.ts";
import type {
  AmmoCounts,
  EconomyState,
  FlightState,
  GameState,
  PersistentWorldState,
  SpaceObject,
  UpgradeLevels,
} from "./types.ts";
import { shipTuning } from "./upgrades.ts";
import { chunkCoordinates, validVisitedPages } from "./visited.ts";
import { clampAmmo, UPGRADE_WEAPONS } from "./weapons.ts";

/** The save format this build writes and reads. */
export const SAVE_VERSION: GameState["version"] = 12;

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
  4: NEEDLE_PLACES,
  5: [ANDROMEDA_PLACES.beacon, ANDROMEDA_PLACES.pip],
  6: PHANTOM_DESTINATIONS,
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
function enemyState(galaxy: GalaxyNumber, value: unknown): boolean {
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
    !(value.returnSeconds === undefined || nonnegative(value.returnSeconds)) ||
    !(value.retreat === undefined || retreatState(value.age as number, value.retreat)) ||
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
  const definition = enemyDefinition(
    galaxy,
    value.archetype as keyof typeof enemyCatalog,
    value.id as string,
  );
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
function retreatState(age: number, value: unknown): boolean {
  return (
    record(value) &&
    ["morale", "hitAndRun"].includes(String(value.kind)) &&
    vector(value.origin) &&
    record(value.away) &&
    vector(value.away) &&
    finite(value.away.x) &&
    finite(value.away.y) &&
    Math.abs(Math.hypot(value.away.x, value.away.y) - 1) < 1e-6 &&
    finite(value.startedAt) &&
    value.startedAt >= 0 &&
    value.startedAt <= age &&
    (value.endedAt === undefined ||
      (finite(value.endedAt) && value.endedAt >= value.startedAt && value.endedAt <= age))
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
  galaxy: GalaxyNumber,
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
    (value.kind !== "station" || stationById(ECONOMY, galaxy, value.id) !== null) &&
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
        enemyState(galaxy, value.enemy) &&
        record(value.enemy) &&
        value.enemy.id === value.id)) &&
    nonnegative(value.radius) &&
    finite(value.hp) &&
    (value.role === undefined || typeof value.role === "string") &&
    (value.persistent === undefined || typeof value.persistent === "boolean") &&
    (value.cooldown === undefined || nonnegative(value.cooldown)) &&
    (value.behavior === undefined ||
      ["pursue", "shoot", "guard"].includes(String(value.behavior))) &&
    (value.upgrade === undefined || (value.upgrade === true && value.kind === "pickup")) &&
    (value.ammoPack === undefined || (value.ammoPack === true && value.kind === "pickup"))
  );
}
function persistentWorld(
  galaxy: GalaxyNumber,
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
      !spaceObject(galaxy, routes, object) ||
      object.id !== id ||
      !persistentObject(object) ||
      object.hp <= 0 ||
      object.kind === "destination" ||
      object.id.startsWith("whale-debris:") ||
      (object.kind === "enemy" && object.enemy && enemyDefeated(object.enemy))
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
      enemyDefeated(object.enemy)
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
    (selected === "laser" || value.includes(selected))
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
        ECONOMY.weaponUpgradePrices[weapon as Weapon].length,
      ),
    ) &&
    (Object.keys(ECONOMY.trackPrices) as UpgradeTrack[]).every((track) =>
      boundedLevel(value[track], ECONOMY.trackPrices[track].length),
    )
  );
}

/** Optional prototype fields preserve ordinary saves without a migration. */
function rechargeState(value: Record<string, unknown>): boolean {
  return (
    (value.shieldRechargeCredit === undefined ||
      (nonnegative(value.shieldRechargeCredit) &&
        (value.shieldRechargeCredit as number) <= ECONOMY.shieldRecharge.capacityPerOre)) &&
    (value.shieldOreSpent === undefined ||
      (Number.isSafeInteger(value.shieldOreSpent) && nonnegative(value.shieldOreSpent)))
  );
}

function economyState(value: unknown): value is EconomyState {
  return (
    record(value) &&
    rechargeState(value) &&
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
    value.paints.includes(value.paint) &&
    (value.cargo === undefined || (Number.isSafeInteger(value.cargo) && nonnegative(value.cargo)))
  );
}
/** Each paid amount is a whole number of Stardust toward one of the galaxy's projects, at most its cost. */
/** Each greeted place is one of the galaxy's stations, greeted a whole number of times. */
function greetingCounts(galaxy: GalaxyNumber, value: unknown): boolean {
  return (
    record(value) &&
    Object.entries(value).every(
      ([id, docked]) =>
        namesStation(ECONOMY, galaxy, id) && Number.isSafeInteger(docked) && Number(docked) > 0,
    )
  );
}
function donations(galaxy: GalaxyNumber, value: unknown): boolean {
  return (
    record(value) &&
    Object.entries(value).every(([id, paid]) => {
      const project = galaxyProjects(galaxy).find((entry) => entry.id === id);
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
function revealedProjects(galaxy: GalaxyNumber, donated: unknown, value: unknown): boolean {
  const paid = record(donated) ? donated : {};
  return (
    strings(value) &&
    Array.isArray(value) &&
    new Set(value).size === value.length &&
    value.every((id) => {
      const project = galaxyProjects(galaxy).find((entry) => entry.id === id);
      return project !== undefined && paid[id] === project.cost;
    })
  );
}
function stationIds(galaxy: GalaxyNumber, value: unknown): boolean {
  return (
    strings(value) &&
    Array.isArray(value) &&
    new Set(value).size === value.length &&
    value.every((id) => namesStation(ECONOMY, galaxy, String(id)))
  );
}

/** Charted landmark ids: distinct landmarks of the galaxy. */
function chartedIds(galaxy: GalaxyNumber, value: unknown): boolean {
  return (
    Array.isArray(value) &&
    strings(value) &&
    new Set(value).size === value.length &&
    value.every((id) => isLandmark(galaxy, String(id)))
  );
}
/**
 * A saved job offer: a station of the galaxy issues it, and its target is a landmark for a
 * survey, a station or outpost for a delivery, or a spot for a rescue or hunt.
 */
function jobOffer(galaxy: GalaxyNumber, value: unknown): boolean {
  if (
    !record(value) ||
    typeof value.id !== "string" ||
    !JOB_TYPES.includes(value.type as (typeof JOB_TYPES)[number]) ||
    typeof value.station !== "string" ||
    !namesStation(ECONOMY, galaxy, value.station) ||
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
    return isLandmark(galaxy, target);
  }
  if (value.type === "delivery") {
    return (
      target !== value.station &&
      (stationById(ECONOMY, galaxy, target) !== null ||
        ((destinationIds[galaxy] ?? []).includes(target) && deliveryDestination(target)))
    );
  }
  return target === "" && (value.type === "rescue" || vector(value.spot));
}
// Every galaxy has stations, so job boards and held tasks.
const GALAXY_KEYS = GALAXY_NUMBERS.map(String);
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
  const galaxies = GALAXY_KEYS;
  return Object.entries(value.boards).every(
    ([galaxy, stations]) =>
      galaxies.includes(galaxy) &&
      record(stations) &&
      Object.entries(stations).every(
        ([station, offers]) =>
          namesStation(ECONOMY, Number(galaxy) as GalaxyNumber, station) &&
          Array.isArray(offers) &&
          offers.every(
            (offer) =>
              jobOffer(Number(galaxy) as GalaxyNumber, offer) &&
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
      ([galaxy, task]) =>
        GALAXY_KEYS.includes(galaxy) &&
        record(task) &&
        ((task.kind === "job" &&
          jobOffer(Number(galaxy) as GalaxyNumber, task) &&
          (task.carrying === undefined || typeof task.carrying === "boolean") &&
          (task.entered === undefined || typeof task.entered === "boolean")) ||
          (task.kind === "activity" && validActivity(Number(galaxy) as GalaxyNumber, task))),
    )
  );
}

/**
 * Restores a complete snapshot of the current save version, or null. A save of any other
 * version, or one with a missing or malformed field, is rejected whole: a partial restore can
 * invalidate quest state. The result shares no references with `saved`.
 */
export function restoreSave(saved: unknown): GameState | null {
  return restoreGameSave(CONTENT, saved);
}

export function restoreGameSave(content: GameContent, saved: unknown): GameState | null {
  try {
    const value: unknown = typeof saved === "string" ? JSON.parse(saved) : structuredClone(saved);
    if (
      !record(value) ||
      value.version !== SAVE_VERSION ||
      !["home", "space"].includes(String(value.mode)) ||
      !GALAXY_NUMBERS.includes(value.selectedGalaxy as GalaxyNumber) ||
      !record(value.progress)
    ) {
      return null;
    }
    if (
      !Array.isArray(value.unlocked) ||
      !value.unlocked.includes(1) ||
      value.unlocked.some((v) => !GALAXY_NUMBERS.includes(v as GalaxyNumber)) ||
      !value.unlocked.includes(value.selectedGalaxy)
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
    for (const id of GALAXY_NUMBERS) {
      const p = value.progress[id];
      if (
        !record(p) ||
        (p.andromeda !== undefined && (id !== 5 || !validAndromedaProgress(p.andromeda))) ||
        (p.needle !== undefined && (id !== 4 || !readNeedleChapterProgress(p.needle))) ||
        (p.phantom !== undefined &&
          (id !== 6 ||
            !validPhantomProgress(p.phantom) ||
            (p.phantom.aftermathComplete === true && (!p.questComplete || !p.holodisk)))) ||
        !Number.isInteger(p.stage) ||
        !nonnegative(p.stage) ||
        Number(p.stage) > (id === 1 ? 4 : id === 5 ? 6 : 5) ||
        !strings(p.known) ||
        ![null, "food", "toolkit", "parts", ...(id === 5 ? ["beaconParts"] : [])].includes(
          p.questItem as string | null,
        ) ||
        (Array.isArray(p.known) &&
          p.known.some(
            (v) =>
              !destinationIds[id]?.includes(v) &&
              !(id === 5 && typeof v === "string" && settlementById(ECONOMY, v)),
          )) ||
        (p.resolved === true && p.questComplete !== true)
      ) {
        return null;
      }
      if (
        !["introduced", "questComplete", "resolved"].every((k) => typeof p[k] === "boolean") ||
        !["deposited", "destroyedEnemies", "discoveries"].every((k) => nonnegative(p[k])) ||
        !["holodisk", "opened"].every((k) => typeof p[k] === "boolean") ||
        !stationIds(id as GalaxyNumber, p.stations) ||
        !donations(id as GalaxyNumber, p.donated) ||
        !greetingCounts(id as GalaxyNumber, p.greetings) ||
        !chartedIds(id as GalaxyNumber, p.charted) ||
        !revealedProjects(id as GalaxyNumber, p.donated, p.revealed) ||
        !validExplored(CONTENT.tuning.chunkSize, p.explored) ||
        (p.activityCompleted !== undefined && typeof p.activityCompleted !== "boolean") ||
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
        // Version 12 never reads a partially integrated periodic chart.
        f.topology !== undefined ||
        (f.needle !== undefined && (f.galaxy !== 4 || !validNeedleFlight(f.needle))) ||
        (f.phantom !== undefined && (f.galaxy !== 6 || !validPhantomFlight(f.phantom))) ||
        f.galaxy !== value.selectedGalaxy ||
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
        !rechargeState(f) ||
        !Number.isSafeInteger(f.cargo) ||
        !ammoCounts(f.ammo) ||
        (f.lastBump !== undefined && !Number.isFinite(f.lastBump)) ||
        (f.tow !== undefined && !vector(f.tow)) ||
        (f.calf !== undefined &&
          !(
            record(f.calf) &&
            vector(f.calf) &&
            vector(f.calf.velocity) &&
            typeof f.calf.following === "boolean"
          )) ||
        !upgradeLevels(f.levels) ||
        // The shield never holds more than its level's capacity.
        (f.shield as number) > shipTuning(ECONOMY, CONTENT, f.levels).shieldMax
      ) {
        return null;
      }
      const routes = destinationIds[value.selectedGalaxy as number] ?? [];
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
      if (
        (f.guardCues !== undefined && !strings(f.guardCues)) ||
        (f.summonedGuards !== undefined && !strings(f.summonedGuards))
      ) {
        return null;
      }
      // Run-only granted weapons are a subset of the flight's roster.
      if (
        f.grantedWeapons !== undefined &&
        (!weaponOwnership(f.grantedWeapons, "laser") ||
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
          spaceObject(value.selectedGalaxy as GalaxyNumber, routes, object),
        )
      ) {
        return null;
      }
      if (!persistentWorld(value.selectedGalaxy as GalaxyNumber, routes, f.objects, f.world)) {
        return null;
      }
      if (f.combat !== undefined && !unloadedPackState(f.objects, f.world, f.combat)) {
        return null;
      }
      if (
        !Array.isArray(f.mines) ||
        !Array.from(f.mines).every(
          (mine) =>
            record(mine) &&
            vector(mine) &&
            typeof mine.id === "string" &&
            typeof mine.ownerId === "string" &&
            finite(mine.age) &&
            finite(mine.damage) &&
            mine.damage > 0 &&
            (mine.end === undefined ||
              (record(mine.end) &&
                nonnegative(mine.end.age) &&
                ["fizzle", "pop"].includes(String(mine.end.kind)))),
        )
      ) {
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
            finite(s.damage) &&
            s.damage > 0 &&
            (s.blast === undefined ||
              (s.projectile === "missile" && finite(s.blast) && s.blast > 0)) &&
            (s.enemyWeapon === undefined ||
              (s.enemy && s.enemyWeapon === "ringBurst" && s.projectile === "bolt")) &&
            (s.fade === undefined ||
              (s.projectile === "dot" &&
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
    if (value.pendingStory !== undefined) {
      const pending = value.pendingStory;
      if (
        !record(pending) ||
        Reflect.ownKeys(pending).length !== 2 ||
        !Object.hasOwn(pending, "cursor") ||
        !Object.hasOwn(pending, "slept") ||
        !["cursor", "slept"].every((key) => {
          const descriptor = Object.getOwnPropertyDescriptor(pending, key);
          return descriptor && "value" in descriptor && descriptor.enumerable;
        }) ||
        !finite(pending.slept) ||
        pending.slept < 0 ||
        pending.slept > OVERNIGHT_SLEEP.seconds
      ) {
        return null;
      }
      const state = value as unknown as GameState;
      const position = readStoryCursor(
        {
          resolve: (reference) =>
            resolveStoryScene(
              {
                content,
                holodisks: holodisksHeld(state.progress),
                labels: {
                  continue: content.labels.continue ?? "continue",
                  pickUpRock: content.labels.pickUpRock ?? "pickUpRock",
                },
              },
              reference,
            ),
        },
        pending.cursor,
      );
      if (!position || (!currentPage(position).sleep && pending.slept !== 0)) {
        return null;
      }
    }
    const restored = value as unknown as GameState;
    restored.economy.ammo = clampAmmo(ECONOMY, restored.economy.ammo);
    if (restored.flight) {
      restored.flight.ammo = clampAmmo(ECONOMY, restored.flight.ammo);
    }
    return restored;
  } catch {
    return null;
  }
}
