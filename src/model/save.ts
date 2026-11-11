import { LEGACY_ASTEROIDS } from "../data/asteroid-catalog.ts";
import { CONVERSATIONS } from "../data/conversations.ts";
import { ECONOMY, type UpgradeTrack } from "../data/economy.ts";
import { enemyCatalog } from "../data/enemy-catalog.ts";
import { JOB_TYPES } from "../data/jobs.ts";
import { PROJECTS } from "../data/projects.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { RESOURCE_ROCKS } from "../data/resource-rocks.ts";
import { CARTWHEEL_STORY_SHIPS, DONATION_PROJECTS } from "../data/story-ships.ts";
import type { SectorId } from "../data/types.ts";
import { WEAPON_CATALOG } from "../data/weapon-catalog.ts";
import { newAchievements } from "./achievements.ts";
import { ASTEROID_SHAPES } from "./asteroids.ts";
import { enemyEffects, restoreEnemyState, type SavedEnemyState } from "./enemy-ai.ts";
import { ACTIVE_CHUNK_RADIUS, encounterOf, persistentObject } from "./geography.ts";
import { isLandmark } from "./landmarks.ts";
import { validExplored } from "./map.ts";
import { fundedProjects } from "./projects.ts";
import { stationById } from "./stations.ts";
import type {
  AmmoCounts,
  EconomyState,
  FlightState,
  GameState,
  PersistentWorldState,
  SpaceObject,
  UpgradeLevels,
} from "./types.ts";
import { newEconomy } from "./upgrades.ts";
import { chunkCoordinates, validVisitedPages } from "./visited.ts";
import { grantedAmmo, UPGRADE_WEAPONS } from "./weapons.ts";

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
    !["engaged", "fleeing", "returning"].every((key) => typeof value[key] === "boolean") ||
    !["home", "position", "velocity"].every((key) => vector(value[key])) ||
    !(value.lastSeen === null || vector(value.lastSeen)) ||
    !["age", "hp", "lastSeenAge", "primaryCooldown", "pursuitSeconds"].every((key) =>
      nonnegative(value[key]),
    ) ||
    !finite(value.phase) ||
    !(value.facing === undefined || vector(value.facing)) ||
    !optionalDirection(value.heading) ||
    !optionalDirection(value.aim) ||
    !(
      value.escortOf === undefined ||
      value.escortOf === null ||
      typeof value.escortOf === "string"
    ) ||
    !(value.tactic === undefined || tacticState(value.tactic)) ||
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
        optionalDirection(part.aim),
    )
  );
}
/** Retired oversized capitals' side weapons become the capital's forward turrets. */
const LEGACY_CAPITAL_PARTS: Readonly<Record<string, string>> = {
  port: "weapon-left",
  starboard: "weapon-right",
};
/** Sorted hardpoint ids of the earlier capital and the retired oversized capital. */
const LEGACY_CAPITAL_LAYOUTS: readonly (readonly string[])[] = [
  ["command", "engine-left", "engine-right", "weapon-left", "weapon-right"],
  ["center", "command", "engine-left", "engine-right", "port", "starboard"],
];
/**
 * Retired `oversizedCapital` enemies become capitals, and capitals saved with an earlier
 * hardpoint layout adopt the current one: matching parts keep their damage, cooldown and
 * aim, and new parts start whole.
 */
function migrateLegacyEnemy(value: unknown): void {
  if (!record(value) || !Array.isArray(value.hardpoints)) {
    return;
  }
  if (value.archetype === "oversizedCapital") {
    value.archetype = "capital";
  }
  if (value.archetype !== "capital") {
    return;
  }
  const parts = enemyCatalog.capital.hardpoints;
  const saved = (value.hardpoints as unknown[]).filter(record);
  const ids = saved.map((entry) => String(entry.id)).sort();
  // Only an exact earlier layout migrates; anything else is left for validation to reject.
  if (
    saved.length !== value.hardpoints.length ||
    !LEGACY_CAPITAL_LAYOUTS.some(
      (layout) => layout.length === ids.length && layout.every((id, index) => id === ids[index]),
    )
  ) {
    return;
  }
  value.hardpoints = parts.map((part) => {
    const match = saved.find(
      (entry) => entry.id === part.id || LEGACY_CAPITAL_PARTS[String(entry.id)] === part.id,
    );
    return match ? { ...match, id: part.id } : { aim: null, cooldown: 0, hp: part.hp, id: part.id };
  });
}
function migrateLegacyEnemies(value: unknown): unknown {
  if (record(value) && record(value.flight)) {
    const { objects, world } = value.flight;
    for (const object of Array.isArray(objects) ? (objects as unknown[]) : []) {
      if (record(object)) {
        migrateLegacyEnemy(object.enemy);
      }
    }
    if (record(world) && record(world.notables)) {
      for (const object of Object.values(world.notables)) {
        if (record(object)) {
          migrateLegacyEnemy(object.enemy);
        }
      }
    }
  }
  return value;
}
/** Behaviour state is absent from older saves. */
function tacticState(value: unknown): boolean {
  return (
    record(value) &&
    ["attack", "retreat", "pass"].includes(String(value.phase)) &&
    ["integrity", "seconds", "volleys"].every((key) => nonnegative(value[key]))
  );
}
/** Orientation fields are absent from older saves and null when unset. */
function optionalDirection(value: unknown): boolean {
  return value === undefined || value === null || vector(value);
}
/** Completes enemy orientation and behaviour state for older saves; validation has run. */
function restoreOrientation(object: SpaceObject | null): void {
  if (object?.enemy) {
    object.enemy = restoreEnemyState(object.enemy as SavedEnemyState);
  }
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
    (value.routeEncounters as string[]).every((id) => routes.includes(id))
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
      ((value.kind === "rock" || value.kind === "debris") &&
        typeof value.asteroid === "string" &&
        ASTEROID_SHAPES.has(value.asteroid))) &&
    (value.orbit === undefined ||
      (value.kind === "rock" &&
        record(value.orbit) &&
        vector(value.orbit) &&
        nonnegative(value.orbit.radius) &&
        finite(value.orbit.rate) &&
        finite(value.orbit.phase))) &&
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

/** Completes economy fields absent from older saves; validation has already run. */
function migrateEconomy(state: GameState): void {
  const flight = state.flight as
    (Omit<FlightState, "ammo"> & { ammo?: AmmoCounts | number; weaponLockFor?: number }) | null;
  if (!state.economy) {
    state.economy = newEconomy(ECONOMY);
    if (flight) {
      state.economy.ownedWeapons = [...(flight.ownedWeapons ?? [])];
      state.economy.weapon = flight.weapon;
    }
    state.economy.ammo = grantedAmmo(state.economy.ownedWeapons);
  }
  // Weapons owned before ammunition start with a new weapon's packs.
  state.economy.ammo ??= grantedAmmo(state.economy.ownedWeapons);
  state.docked ??= null;
  for (const progress of Object.values(state.progress)) {
    progress.stations ??= [];
    progress.donated ??= {};
    progress.charted ??= [];
    progress.revealed ??= [];
    progress.explored ??= [];
  }
  state.jobs ??= { boards: {}, made: 0 };
  state.tasks ??= {};
  if (flight) {
    if (typeof flight.ammo !== "object") {
      // Granted weapons get the same packs for the flight; they stay out of the economy.
      flight.ammo = {
        ...grantedAmmo(flight.grantedWeapons ?? []),
        ...Object.fromEntries(
          UPGRADE_WEAPONS.filter((weapon) => !flight.grantedWeapons?.includes(weapon)).map(
            (weapon) => [weapon, state.economy.ammo[weapon]],
          ),
        ),
      };
    }
    flight.levels ??= structuredClone(state.economy.levels);
    delete flight.weaponLockFor;
    flight.weaponSwitchFor ??= 0;
    flight.dockId ??= null;
  }
}
/** Saves from before the prologue skip it once any story or flight has begun. */
function pastStart(state: GameState): boolean {
  return (
    state.mode === "space" ||
    state.flight !== null ||
    state.unlocked.length > 1 ||
    Object.values(state.progress).some(begun)
  );
}
/** Whether a chapter's space story has begun. */
function begun(p: GameState["progress"][1]): boolean {
  return p.stage > 0 || p.introduced || p.questComplete || p.resolved || p.known.length > 0;
}
/**
 * Saves from before conversations count what was already played as heard: the first flight's
 * lessons once past the start, each begun galaxy's arrival, each known group's meeting and, with
 * anything mapped, the mapped reaction.
 */
function playedConversations(state: GameState): string[] {
  const heard = new Set<string>();
  if (pastStart(state)) {
    for (const lesson of ["move", "aim", "stardust", "dock"]) {
      heard.add(`lesson:${lesson}`);
    }
  }
  for (const id of [1, 2, 3] as const) {
    const p = state.progress[id];
    if (p.stage > 0 || p.introduced || p.resolved || p.known.length > 0) {
      heard.add(`arrival:${id}`);
    }
    for (const known of p.known) {
      heard.add(`meeting:${id}:${known}`);
    }
    if (p.known.length > 0 || (p.stations ?? []).length > 0) {
      heard.add("reaction:mapped");
    }
  }
  return CONVERSATIONS.flatMap((conversation) =>
    heard.has(conversation.id) ? [conversation.id] : [],
  );
}
/** Saves from before the announcement announce a later galaxy unlocked but not yet begun. */
function unvisitedUnlock(state: GameState): boolean {
  const latest = Math.max(...state.unlocked) as SectorId;
  const p = state.progress[latest];
  return latest > 1 && p.stage === 0 && !p.introduced && !p.resolved && p.known.length === 0;
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

/*
 * CLEANUP (added 2026-11-11): converts saves from before the five-weapon roster. Remove once
 * every stored save has been loaded and rewritten by a build with this migration.
 */
const LEGACY_WEAPONS: Readonly<Record<string, string>> = {
  missiles: "rapidMissile",
  tripleLaser: "multiLaser",
};
const legacyWeapon = (value: unknown) =>
  typeof value === "string" ? (LEGACY_WEAPONS[value] ?? value) : value;
const legacyWeapons = (value: unknown) => (Array.isArray(value) ? value.map(legacyWeapon) : value);
/** Bought levels 0 to 3 become levels 1 to 3: 0 is 1, 1 and 2 are 2, and 3 is 3. */
const legacyLevel = (value: unknown) =>
  typeof value === "number" ? Math.min(3, value === 0 ? 1 : value <= 2 ? 2 : 3) : value;

function migrateLegacyLevels(levels: unknown): void {
  if (!record(levels) || !record(levels.weapons)) {
    return;
  }
  const weapons = levels.weapons;
  if (!Object.hasOwn(weapons, "missiles") && !Object.hasOwn(weapons, "tripleLaser")) {
    return;
  }
  levels.weapons = {
    basic: legacyLevel(weapons.basic),
    heavyMissile: 1,
    multiLaser: legacyLevel(weapons.tripleLaser),
    phaser: 1,
    rapidMissile: legacyLevel(weapons.missiles),
    scattershot: legacyLevel(weapons.scattershot),
  };
  for (const track of ["engine", "shield", "shieldRecharge"]) {
    levels[track] = legacyLevel(levels[track]);
  }
  // The tractor had two bought levels, which become levels 2 and 3.
  if (typeof levels.tractor === "number") {
    levels.tractor = levels.tractor + 1;
  }
}

function migrateLegacyObjects(objects: unknown): void {
  for (const object of Array.isArray(objects)
    ? objects
    : Object.values(record(objects) ? objects : {})) {
    if (record(object) && object.weapon !== undefined) {
      object.weapon = legacyWeapon(object.weapon);
    }
    // A placeholder rock becomes the Art rock it was drawn as, at that rock's footprint radius.
    const rock = record(object) && typeof object.asteroid === "string" ? object : undefined;
    const art = rock ? LEGACY_ASTEROIDS[rock.asteroid as string] : undefined;
    if (rock && art) {
      rock.asteroid = art;
      rock.radius = ASTEROID_SHAPES.get(art)!.radius;
    }
  }
}

/** Renames Missiles and Triple Laser and maps bought levels onto levels 1 to 3, in place. */
function migrateLegacyWeapons(value: Record<string, unknown>): void {
  for (const holder of [value.economy, value.flight]) {
    if (!record(holder)) {
      continue;
    }
    holder.weapon = legacyWeapon(holder.weapon);
    holder.ownedWeapons = legacyWeapons(holder.ownedWeapons);
    if (holder.grantedWeapons !== undefined) {
      holder.grantedWeapons = legacyWeapons(holder.grantedWeapons);
    }
    migrateLegacyLevels(holder.levels);
  }
  if (record(value.flight)) {
    migrateLegacyObjects(value.flight.objects);
    if (record(value.flight.world)) {
      migrateLegacyObjects(value.flight.world.notables);
    }
  }
}
function economyState(value: unknown): value is EconomyState {
  return (
    record(value) &&
    Number.isSafeInteger(value.stardust) &&
    nonnegative(value.stardust) &&
    Object.hasOwn(WEAPON_CATALOG, String(value.weapon)) &&
    weaponOwnership(value.ownedWeapons, value.weapon) &&
    upgradeLevels(value.levels) &&
    (value.ammo === undefined || ammoCounts(value.ammo)) &&
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
      const project = PROJECTS[sector].find((entry) => entry.id === id);
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
      const project = PROJECTS[sector].find((entry) => entry.id === id);
      return project !== undefined && paid[id] === project.cost;
    })
  );
}
function stationIds(sector: SectorId, value: unknown): boolean {
  return (
    strings(value) &&
    Array.isArray(value) &&
    new Set(value).size === value.length &&
    value.every((id) => stationById(ECONOMY, sector, String(id)) !== null)
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
    stationById(ECONOMY, sector, value.station) === null ||
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
        (target !== "holodisk" && (destinationIds[sector] ?? []).includes(target)))
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
          stationById(ECONOMY, Number(sector) as SectorId, station) !== null &&
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
/** Saved optional task slots, one per galaxy: each a held job with its progress. */
function optionalTasks(value: unknown): boolean {
  return (
    record(value) &&
    Object.entries(value).every(
      ([sector, task]) =>
        SECTOR_KEYS.includes(sector) &&
        record(task) &&
        task.kind === "job" &&
        jobOffer(Number(sector) as SectorId, task) &&
        (task.carrying === undefined || typeof task.carrying === "boolean") &&
        (task.entered === undefined || typeof task.entered === "boolean"),
    )
  );
}

/**
 * Accept only complete snapshots; a partial restore can invalidate quest state. Saves
 * from before the economy gain an empty economy (or their flight's weapons), no
 * discovered stations and no switch wait; their unused ammunition count and weapon lock
 * timer are dropped.
 * Saves from before the prologue count it as seen once play has begun, and saves from before
 * holodisks count the holodisks of galaxies before the last unlocked one as recovered. A later
 * galaxy unlocked but not begun is announced at the next boarding.
 */
export function restoreSave(saved: unknown): GameState | null {
  try {
    const value: unknown = migrateLegacyEnemies(
      typeof saved === "string" ? JSON.parse(saved) : structuredClone(saved),
    );
    if (record(value)) {
      migrateLegacyWeapons(value);
    }
    if (
      !record(value) ||
      value.version !== 1 ||
      !["home", "space"].includes(String(value.mode)) ||
      ![1, 2, 3].includes(value.selectedSector as number) ||
      !record(value.progress)
    ) {
      return null;
    }
    if (
      !Array.isArray(value.unlocked) ||
      !value.unlocked.includes(1) ||
      value.unlocked.some((v) => ![1, 2, 3].includes(v)) ||
      !value.unlocked.includes(value.selectedSector)
    ) {
      return null;
    }
    if (
      typeof value.notice !== "string" ||
      (value.prologueSeen !== undefined && typeof value.prologueSeen !== "boolean") ||
      (value.announceGalaxy !== undefined && typeof value.announceGalaxy !== "boolean") ||
      (value.started !== undefined && typeof value.started !== "boolean") ||
      (value.seenConversations !== undefined && !strings(value.seenConversations)) ||
      (value.achievements !== undefined && !achievementState(value.achievements))
    ) {
      return null;
    }
    for (const id of [1, 2, 3]) {
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
        (p.stations !== undefined && !stationIds(id as SectorId, p.stations)) ||
        (p.donated !== undefined && !donations(id as SectorId, p.donated)) ||
        (p.charted !== undefined && !chartedIds(id as SectorId, p.charted)) ||
        (p.revealed !== undefined && !revealedProjects(id as SectorId, p.donated, p.revealed)) ||
        (p.explored !== undefined && !validExplored(PROTOTYPE.tuning.chunkSize, p.explored)) ||
        (p.holodisk !== undefined && typeof p.holodisk !== "boolean") ||
        (p.opened !== undefined && typeof p.opened !== "boolean") ||
        (p.funded !== undefined &&
          !(
            strings(p.funded) &&
            (p.funded as string[]).every((project) =>
              DONATION_PROJECTS[id as SectorId].includes(project),
            ) &&
            new Set(p.funded as string[]).size === (p.funded as string[]).length
          ))
      ) {
        return null;
      }
    }
    if (value.economy !== undefined && !economyState(value.economy)) {
      return null;
    }
    if (
      (value.jobs !== undefined && !jobsState(value.jobs)) ||
      (value.tasks !== undefined && !optionalTasks(value.tasks))
    ) {
      return null;
    }
    if (
      value.docked !== undefined &&
      value.docked !== null &&
      (typeof value.docked !== "string" || value.mode !== "space")
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
        ].every((k) => nonnegative(f[k])) ||
        // Before per-weapon ammunition, a flight kept one unused ammunition count.
        (f.ammo !== undefined && !nonnegative(f.ammo) && !ammoCounts(f.ammo)) ||
        (f.weaponLockFor !== undefined && !nonnegative(f.weaponLockFor)) ||
        (f.weaponSwitchFor !== undefined && !nonnegative(f.weaponSwitchFor)) ||
        (f.dockId !== undefined && f.dockId !== null && typeof f.dockId !== "string") ||
        (f.tow !== undefined && !vector(f.tow)) ||
        (f.levels !== undefined && !upgradeLevels(f.levels))
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
    const restored = structuredClone(value) as unknown as GameState;
    migrateEconomy(restored);
    // Galaxies unlocked before holodisks count each earlier galaxy's holodisk as recovered.
    for (const id of [1, 2, 3] as const) {
      const p = restored.progress[id] as Partial<GameState["progress"][1]>;
      if (typeof p.holodisk !== "boolean") {
        p.holodisk = restored.unlocked.some((unlocked) => unlocked > id);
      }
      // A chapter begun before storybook scenes has seen its opening.
      if (typeof p.opened !== "boolean") {
        p.opened = begun(p as GameState["progress"][1]);
      }
    }
    if (typeof value.started !== "boolean") {
      restored.started = pastStart(restored);
    }
    // Home panels from before storybook scenes are rebuilt from story progress.
    if (restored.mode === "home") {
      restored.dialogue = null;
    }
    if (typeof value.prologueSeen !== "boolean") {
      restored.prologueSeen = pastStart(restored);
    }
    if (typeof value.announceGalaxy !== "boolean") {
      restored.announceGalaxy = unvisitedUnlock(restored);
    }
    if (!Array.isArray(value.seenConversations)) {
      restored.seenConversations = playedConversations(restored);
    }
    // CLEANUP (added 2026-11-11): saves from before achievements start with their charted
    // landmarks and funded projects counted, and the model unlocks what they reached. Remove once
    // no save from before achievements remains in play.
    if (value.achievements === undefined) {
      restored.achievements = newAchievements();
      for (const sector of [1, 2, 3] as const) {
        const progress = restored.progress[sector];
        restored.achievements.charted[sector] = [...progress.charted];
        restored.achievements.projects.push(
          ...fundedProjects(PROJECTS[sector], progress).map(({ id }) => id),
        );
      }
    }
    if (restored.flight) {
      restored.flight.objects.forEach(restoreOrientation);
      Object.values(restored.flight.world.notables).forEach(restoreOrientation);
    }
    return restored;
  } catch {
    return null;
  }
}
