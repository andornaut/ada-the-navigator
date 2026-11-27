import { ACTIVITIES } from "../data/activities.ts";
import { ANDROMEDA_PLACES } from "../data/andromeda.ts";
import { CRYSTAL_FLAGS, type CrystalFlag } from "../data/asteroidCatalog.ts";
import {
  ANDROMEDA_REDACT,
  CARTWHEEL_CLAIM,
  NEEDLE_CADENCE,
  SUNFLOWER_CAPITAL_BOSS,
  WHIRLPOOL_CAPITAL_BOSS,
} from "../data/capitalBosses.ts";
import { CONTENT } from "../data/content.ts";
import { deliveryDestination } from "../data/destinations.ts";
import { ECONOMY, type UpgradeTrack } from "../data/economy.ts";
import { enemyActorDefinition } from "../data/enemyActorDefinition.ts";
import { enemyActorAvailable, isEnemyActorKind } from "../data/enemyActors.ts";
import { enemyCatalog } from "../data/enemyCatalog.ts";
import { type HeavyHullProfile, isHeavyHullProfile, wreckEnemyId } from "../data/enemyIdentity.ts";
import { ENEMY_KEEP_MOVING } from "../data/enemyNavigation.ts";
import { GALAXY_NUMBERS, ROUTE_POSITION } from "../data/galaxies.ts";
import { HUNTING_PACKS } from "../data/galaxyFeatures.ts";
import { JOB_TYPES } from "../data/jobs.ts";
import { NEEDLE, NEEDLE_PLACES } from "../data/needle.ts";
import { PHANTOM_DESTINATIONS } from "../data/phantom.ts";
import { galaxyProjects } from "../data/projects.ts";
import { OVERNIGHT_SLEEP } from "../data/storybook.ts";
import { CARTWHEEL_STORY_SHIPS } from "../data/storyShips.ts";
import type { GalaxyNumber, GameContent, Vec, Weapon, WeaponLevel } from "../data/types.ts";
import { WEAPON_CATALOG } from "../data/weaponCatalog.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import { validActivity } from "../model/activities.ts";
import { validAndromedaProgress } from "../model/andromeda.ts";
import { settlementById } from "../model/andromedaPlaces.ts";
import { ASTEROID_SHAPES } from "../model/asteroids.ts";
import { holodisksHeld } from "../model/conversations.ts";
import { EARLY_LANCE_SECONDS, earlyEncounterKind } from "../model/earlyEncounterRuntime.ts";
import { enemyDefeated } from "../model/enemyAi.ts";
import { validExplorationSites, validExplorationState } from "../model/explorationState.ts";
import { flightWorldContext, validFlightTopology } from "../model/flightTopology.ts";
import { validGalaxyGeography } from "../model/galaxyGeography.ts";
import {
  ACTIVE_CHUNK_RADIUS,
  encounterOf,
  liveEnemy,
  persistentObject,
} from "../model/geography.ts";
import {
  validHostileStationEncounters,
  validHostileStationSites,
} from "../model/hostileStationPersistence.ts";
import { isLandmark } from "../model/landmarks.ts";
import { validExplored } from "../model/map.ts";
import {
  markerObjectTracked,
  validMarkerActors,
  validTargetKnowledge,
} from "../model/markerKnowledge.ts";
import { readNeedleChapterProgress, validNeedleFlight } from "../model/needleRuntime.ts";
import { worldOreFieldsNear } from "../model/oreFields.ts";
import { validPhantomFlight, validPhantomProgress } from "../model/phantom.ts";
import { pendingPhantomEncounterUnshared } from "../model/phantomRequiredPlans.ts";
import { requiredPlanConsistent, requiredPlanObjects } from "../model/requiredEncounterPlans.ts";
import { requiredRolePlanConsistent } from "../model/requiredRolePlans.ts";
import { SAVE_VERSION, type SaveRestore } from "../model/saveSchema.ts";
import { onSale, stationShopRows, stationStock } from "../model/shop.ts";
import {
  STATION_RESTOCK_SECONDS,
  type StationOffer,
  type StationRestockState,
} from "../model/stationRestock.ts";
import { HUB_STATION, namesSavedStation } from "../model/stations.ts";
import { stationShopCategories, stationSpecialty } from "../model/stationServices.ts";
import { currentPage, openingScene, resolutionScene } from "../model/storybook.ts";
import { readStoryCursor } from "../model/storyCursor.ts";
import { canReplayEarthChapter, resolveStoryScene } from "../model/storyScenes.ts";
import type {
  AmmoCounts,
  AnyRequiredEncounterPlan,
  EconomyState,
  FlightState,
  GalaxyProgress,
  GameState,
  PersistentWorldState,
  RequiredEncounterPlan,
  RequiredRoleEncounterPlan,
  SpaceObject,
  UpgradeLevels,
} from "../model/types.ts";
import { shipTuning } from "../model/upgrades.ts";
import { chunkCoordinates, validVisitedPages } from "../model/visited.ts";
import { clampAmmo, UPGRADE_WEAPONS } from "../model/weapons.ts";
import { periodicWorldGrid, worldCellKey } from "../model/worldCells.ts";

function validEarthChoices(content: GameContent, galaxy: GalaxyNumber, value: unknown): boolean {
  if (value === undefined) {
    return true;
  }
  if (!record(value) || !content.chapters[galaxy]) {
    return false;
  }
  return Reflect.ownKeys(value).every((key) => {
    if (key !== "opening" && key !== "resolution") {
      return false;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    const scene =
      key === "opening" ? openingScene(content, galaxy) : resolutionScene(content, galaxy);
    const branch: unknown = descriptor?.value;
    return (
      descriptor?.enumerable === true &&
      typeof branch === "string" &&
      scene.pages.find(({ id }) => id === key)?.choices?.some(({ next }) => next === branch)
    );
  });
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
function validCartwheelPatrol(value: unknown, time: unknown): boolean {
  if (!record(value) || !record(value.plan) || !Array.isArray(value.actors)) {
    return false;
  }
  const { actors, plan, warnedAt } = value;
  const { allocationId, anchor, approach, bypass, coverIds, fieldId, homes } = plan;
  return (
    typeof allocationId === "string" &&
    allocationId.startsWith("pack:") &&
    actors.length >= 1 &&
    actors.length <= 4 &&
    actors.every((id, index) => id === `${allocationId}:${index}`) &&
    typeof fieldId === "string" &&
    fieldId.startsWith("ore:") &&
    Array.isArray(coverIds) &&
    coverIds.length >= 2 &&
    new Set(coverIds).size === coverIds.length &&
    coverIds.every((id) => typeof id === "string" && id.startsWith("moving:")) &&
    Array.isArray(homes) &&
    homes.length === actors.length &&
    homes.every(vector) &&
    vector(anchor) &&
    [approach, bypass].every(
      (path) => Array.isArray(path) && path.length === 2 && path.every(vector),
    ) &&
    (warnedAt === undefined || (nonnegative(warnedAt) && finite(time) && warnedAt <= time))
  );
}

function pendingEarlyLance(value: unknown): boolean {
  return (
    record(value) &&
    finite(value.age) &&
    value.age >= 0 &&
    value.age < EARLY_LANCE_SECONDS &&
    nonnegative(value.damage) &&
    Number.isSafeInteger(value.volley) &&
    nonnegative(value.volley) &&
    record(value.direction) &&
    finite(value.direction.x) &&
    finite(value.direction.y) &&
    Math.abs(Math.hypot(value.direction.x, value.direction.y) - 1) < 1e-6 &&
    vector(value.muzzle) &&
    vector(value.offset)
  );
}
function earlyEncounter(galaxy: GalaxyNumber, id: string, value: unknown): boolean {
  if (value === undefined) {
    return true;
  }
  if (!record(value) || value.kind !== earlyEncounterKind(galaxy, id)) {
    return false;
  }
  switch (value.kind) {
    case "hammer":
      return value.phase === "telling"
        ? pendingEarlyLance(value.tell)
        : (value.phase === "ready" || value.phase === "complete") && value.tell === undefined;
    case "manta":
      return (
        nonnegative(value.elapsed) &&
        Array.isArray(value.courses) &&
        value.courses.length === 2 &&
        Array.from(value.courses).every(
          (course) =>
            record(course) && ["entry", "exit", "station"].every((key) => vector(course[key])),
        )
      );
    case "crossbow":
      return (
        nonnegative(value.elapsed) &&
        (value.pendingLance === undefined || pendingEarlyLance(value.pendingLance))
      );
    default:
      return false;
  }
}
function enemyState(galaxy: GalaxyNumber, value: unknown): boolean {
  if (
    !record(value) ||
    !isEnemyActorKind(value.archetype) ||
    !enemyActorAvailable(galaxy, value.archetype) ||
    typeof value.id !== "string" ||
    !earlyEncounter(galaxy, value.id, value.earlyEncounter) ||
    (value.hullProfile !== undefined &&
      !isHeavyHullProfile({ archetype: value.archetype, id: value.id }, value.hullProfile)) ||
    (value.weaponLevel !== undefined &&
      value.weaponLevel !== 1 &&
      value.weaponLevel !== 2 &&
      value.weaponLevel !== 3) ||
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
    !(value.firePhasesInitialized === undefined || value.firePhasesInitialized === true) ||
    !(value.patrolFlip === undefined || patrolFlip(value.age as number, value.patrolFlip)) ||
    !(value.miner === undefined || minerState(value.age as number, value.miner)) ||
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
  const definition = enemyActorDefinition(
    galaxy,
    value.archetype,
    value.id as string,
    (value.weaponLevel ?? 1) as WeaponLevel,
    value.hullProfile as HeavyHullProfile | undefined,
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
/** A flipped patrol: its side and the age it flipped at, no later than the ship's age. */
function patrolFlip(age: number, value: unknown): boolean {
  return (
    record(value) &&
    (value.side === 1 || value.side === -1) &&
    nonnegative(value.at) &&
    (value.at as number) <= age
  );
}
/** A miner's tracing: its rock or none, its arrival time, pick count and up to its recent picks. */
function minerState(age: number, value: unknown): boolean {
  return (
    record(value) &&
    (value.rock === null || typeof value.rock === "string") &&
    nonnegative(value.arrived) &&
    (value.arrived as number) <= age &&
    Number.isInteger(value.count) &&
    nonnegative(value.count) &&
    strings(value.picks) &&
    (value.picks as string[]).length <= ENEMY_KEEP_MOVING.recentPicks
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
    ["attack", "retreat", "pass", "loop"].includes(String(value.phase)) &&
    ["integrity", "seconds", "volleys"].every((key) => nonnegative(value[key]))
  );
}
/** An unset orientation is null. */
function nullableVector(value: unknown): boolean {
  return value === null || vector(value);
}
function validProfiledPacks(
  flight: Pick<FlightState, "topology">,
  content: GameContent,
  sizes: Record<string, unknown>,
  value: unknown,
): boolean {
  if (!record(value)) {
    return false;
  }
  const grid = periodicWorldGrid(flightWorldContext(flight), content.tuning.chunkSize);
  return Object.entries(value).every(([id, kind]) => {
    if (
      (kind !== "frigate" && kind !== "capital") ||
      !Object.hasOwn(sizes, id) ||
      !(typeof sizes[id] === "number" && sizes[id] > 0)
    ) {
      return false;
    }
    const cell = id.startsWith("pack:") ? chunkCoordinates(id.slice("pack:".length)) : null;
    return cell !== null && id === `pack:${worldCellKey(grid, cell)}`;
  });
}

function combatState(
  flight: Pick<FlightState, "topology">,
  content: GameContent,
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
    (value.profiledPacks === undefined ||
      validProfiledPacks(flight, content, value.initialPackSizes, value.profiledPacks)) &&
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
    (value.emptyRoutePlans === undefined ||
      (Array.isArray(value.emptyRoutePlans) && value.emptyRoutePlans.length === 0)) &&
    (value.huntingPacks === undefined ||
      (strings(value.huntingPacks) &&
        (value.huntingPacks as string[]).every((id) => HUNTING_PACKS.destinations.includes(id))))
  );
}
function wreckState(id: string, value: unknown): boolean {
  return (
    record(value) &&
    isEnemyActorKind(value.archetype) &&
    Object.hasOwn(enemyCatalog, value.archetype) &&
    (value.hullProfile === undefined ||
      isHeavyHullProfile(
        { archetype: value.archetype, id: wreckEnemyId(id) },
        value.hullProfile,
      )) &&
    nonnegative(value.age) &&
    vector(value.facing) &&
    (value.released === undefined || typeof value.released === "boolean") &&
    (value.blasted === undefined || typeof value.blasted === "boolean")
  );
}
const OBJECT_KINDS = [
  "rock",
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
    (value.kind !== "station" ||
      (value.id !== HUB_STATION && namesSavedStation(ECONOMY, galaxy, value.id))) &&
    (value.kind === "wreck" ? wreckState(value.id, value.wreck) : value.wreck === undefined) &&
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
    (value.settle === undefined ||
      (value.kind === "rock" &&
        vector(value.velocity) &&
        finite(value.settle) &&
        (value.settle as number) > 0)) &&
    (value.asteroid === undefined ||
      ((value.kind === "rock" || value.kind === "debris") &&
        typeof value.asteroid === "string" &&
        ASTEROID_SHAPES.has(value.asteroid))) &&
    (value.crystals === undefined ||
      (typeof value.asteroid === "string" &&
        CRYSTAL_FLAGS.includes(value.crystals as CrystalFlag))) &&
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
    (value.river === undefined ||
      (value.kind === "debris" &&
        record(value.river) &&
        typeof value.river.current === "string" &&
        finite(value.river.arc))) &&
    (value.enemy === undefined ||
      (value.kind === "enemy" &&
        enemyState(galaxy, value.enemy) &&
        record(value.enemy) &&
        (value.routeId === undefined || value.enemy.hullProfile === undefined) &&
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
function optionalBossActor(galaxy: 1 | 2 | 4 | 5, value: unknown): value is SpaceObject {
  const ids = {
    1: SUNFLOWER_CAPITAL_BOSS.id,
    2: CARTWHEEL_CLAIM.id,
    4: NEEDLE_CADENCE.id,
    5: ANDROMEDA_REDACT.id,
  };
  const id = ids[galaxy];
  return (
    spaceObject(galaxy, [], value) &&
    value.id === id &&
    value.kind === "enemy" &&
    value.persistent === true &&
    value.hp > 0 &&
    value.enemy?.archetype === "capital" &&
    value.enemy.packId === null &&
    value.enemy.escortOf === null &&
    !enemyDefeated(value.enemy)
  );
}

function validBossProgress(galaxy: GalaxyNumber, progress: Record<string, unknown>): boolean {
  const boss = progress.capitalBoss;
  if (boss === undefined) {
    return true;
  }
  if ((galaxy !== 1 && galaxy !== 4) || !record(boss) || !vector(boss.site)) {
    return false;
  }
  if (
    galaxy === 4
      ? readNeedleChapterProgress(progress.needle)?.eyeLit !== NEEDLE.eyeGates
      : progress.questComplete !== true || progress.stage !== 4
  ) {
    return false;
  }
  if (boss.firstHardpointLost !== undefined && (galaxy !== 4 || boss.firstHardpointLost !== true)) {
    return false;
  }
  const milestone = Number(boss.firstHardpointLost === true);
  switch (boss.phase) {
    case "active":
      return Object.keys(boss).length === 2 + milestone;
    case "away":
      return (
        Object.keys(boss).length === 3 + milestone &&
        optionalBossActor(galaxy, boss.actor) &&
        boss.actor.enemy?.salvaged === false
      );
    case "resolved":
      return (
        milestone === 0 &&
        (boss.outcome === "defeated" || boss.outcome === "salvaged") &&
        (galaxy === 1
          ? Object.keys(boss).length === 4 && typeof boss.cacheClaimed === "boolean"
          : Object.keys(boss).length === 3 && boss.cacheClaimed === undefined)
      );
    default:
      return false;
  }
}

function bossFlightConsistent(
  galaxy: 1 | 4,
  boss: GalaxyProgress["capitalBoss"],
  flight: FlightState,
): boolean {
  const id = galaxy === 4 ? NEEDLE_CADENCE.id : SUNFLOWER_CAPITAL_BOSS.id;
  const actor = flight.objects.find((object) => object.id === id) ?? flight.world.notables[id];
  const cacheId = SUNFLOWER_CAPITAL_BOSS.cacheId;
  const cache =
    galaxy === 1
      ? (flight.objects.find((object) => object.id === cacheId) ?? flight.world.notables[cacheId])
      : undefined;
  if (flight.galaxy !== galaxy) {
    return actor === undefined && cache === undefined;
  }
  if (boss?.phase === "active") {
    return (
      cache === undefined && optionalBossActor(galaxy, actor) && actor.enemy?.salvaged === false
    );
  }
  if (boss?.phase === "resolved") {
    const actorValid =
      actor == null ||
      (boss.outcome === "salvaged" &&
        optionalBossActor(galaxy, actor) &&
        actor.enemy?.salvaged === true);
    return (
      actorValid &&
      (galaxy === 4 ||
        (boss.cacheClaimed
          ? cache == null
          : cache?.kind === "pickup" &&
            cache.role === "cargo" &&
            cache.persistent === true &&
            cache.hp > 0 &&
            cache.amount === undefined))
    );
  }
  return !boss && actor === undefined && cache === undefined;
}

function validClaimProgress(galaxy: GalaxyNumber, progress: Record<string, unknown>): boolean {
  const claim = progress.claim;
  if (claim === undefined) {
    return true;
  }
  if (
    galaxy !== 2 ||
    Number(progress.stage) < 3 ||
    !Array.isArray(progress.known) ||
    !progress.known.includes(CARTWHEEL_STORY_SHIPS.station) ||
    !record(claim) ||
    !vector(claim.site) ||
    !vector(claim.fieldSite) ||
    (claim.firstHardpointLost !== undefined && claim.firstHardpointLost !== true)
  ) {
    return false;
  }
  const point = claim.fieldSite as Vec;
  if (
    !worldOreFieldsNear({ worldSide: GALAXY_SIDE }, 2, 1, point).some(
      (field) =>
        field.id === claim.fieldId &&
        field.guard === null &&
        field.x === point.x &&
        field.y === point.y,
    )
  ) {
    return false;
  }
  const entries = Object.keys(claim).length - Number(claim.firstHardpointLost === true);
  switch (claim.phase) {
    case "active":
      return entries === 4;
    case "away":
      return (
        entries === 5 && optionalBossActor(2, claim.actor) && claim.actor.enemy?.salvaged === false
      );
    case "resolved":
      return entries === 5 && (claim.outcome === "defeated" || claim.outcome === "salvaged");
    default:
      return false;
  }
}

function claimFlightConsistent(claim: GalaxyProgress["claim"], flight: FlightState): boolean {
  const { id } = CARTWHEEL_CLAIM;
  const actor = flight.objects.find((object) => object.id === id) ?? flight.world.notables[id];
  if (flight.galaxy !== 2) {
    return actor === undefined;
  }
  if (claim?.phase === "active") {
    return (
      optionalBossActor(2, actor) &&
      actor.enemy?.salvaged === false &&
      !flight.objects.some((object) => object.id.startsWith(`${claim.fieldId}:`))
    );
  }
  if (claim?.phase === "resolved") {
    return (
      actor == null ||
      (claim.outcome === "salvaged" &&
        optionalBossActor(2, actor) &&
        actor.enemy?.salvaged === true)
    );
  }
  return !claim && actor === undefined;
}

function validRedactProgress(galaxy: GalaxyNumber, progress: Record<string, unknown>): boolean {
  const boss = progress.redact;
  const known = Array.isArray(progress.known)
    ? progress.known.filter((id) => id === ANDROMEDA_REDACT.relayId).length
    : 0;
  if (boss === undefined) {
    return known === 0;
  }
  if (
    galaxy !== 5 ||
    progress.stage !== 6 ||
    progress.questComplete !== true ||
    !record(boss) ||
    !vector(boss.relay) ||
    !vector(boss.site) ||
    (boss.firstHardpointLost !== undefined && boss.firstHardpointLost !== true)
  ) {
    return false;
  }
  const entries = Object.keys(boss).length - Number(boss.firstHardpointLost === true);
  switch (boss.phase) {
    case "active":
      return entries === 3 && known === 0;
    case "away":
      return (
        entries === 4 &&
        known === 0 &&
        optionalBossActor(5, boss.actor) &&
        boss.actor.enemy?.salvaged === false
      );
    case "resolved":
      return (
        entries === 4 && known === 1 && (boss.outcome === "defeated" || boss.outcome === "salvaged")
      );
    default:
      return false;
  }
}

function redactFlightConsistent(boss: GalaxyProgress["redact"], flight: FlightState): boolean {
  const { id, relayId } = ANDROMEDA_REDACT;
  const actor = flight.objects.find((object) => object.id === id) ?? flight.world.notables[id];
  const relay = flight.objects.find((object) => object.id === relayId);
  if (flight.galaxy !== 5) {
    return actor === undefined && relay === undefined;
  }
  if (boss?.phase === "active") {
    return !relay && optionalBossActor(5, actor) && actor.enemy?.salvaged === false;
  }
  if (boss?.phase === "resolved") {
    return (
      relay?.kind === "destination" &&
      relay.x === boss.relay.x &&
      relay.y === boss.relay.y &&
      (actor == null ||
        (boss.outcome === "salvaged" &&
          optionalBossActor(5, actor) &&
          actor.enemy?.salvaged === true))
    );
  }
  return !boss && actor === undefined && relay === undefined;
}

function sounderActor(value: SpaceObject): boolean {
  const enemy = value.enemy;
  const { id, swarmPack } = WHIRLPOOL_CAPITAL_BOSS;
  return (
    value.kind === "enemy" &&
    value.persistent === true &&
    enemy !== undefined &&
    (value.id === id
      ? value.routeId === "holodisk" &&
        enemy.archetype === "capital" &&
        enemy.packId === null &&
        enemy.escortOf === null
      : value.routeId === undefined &&
        ((enemy.archetype === "fighter" && enemy.escortOf === id) ||
          (enemy.archetype === "swarm" && enemy.packId === swarmPack && enemy.escortOf === null)))
  );
}

function validSounderProgress(galaxy: GalaxyNumber, progress: Record<string, unknown>): boolean {
  const boss = progress.sounder;
  if (boss === undefined) {
    return true;
  }
  if (galaxy !== 3 || !record(boss) || progress.questComplete !== true || progress.stage !== 5) {
    return false;
  }
  if (boss.phase === "resolved") {
    return (
      Object.keys(boss).length === 2 &&
      (boss.outcome === "defeated" || boss.outcome === "disabled") &&
      record(progress.requiredSites) &&
      vector(progress.requiredSites.holodisk)
    );
  }
  if (progress.holodisk === true) {
    return false;
  }
  if (boss.phase === "away") {
    return (
      Object.keys(boss).length === 2 &&
      Array.isArray(boss.actors) &&
      boss.actors.length <= 7 &&
      boss.actors.every(
        (actor) => spaceObject(3, ["holodisk"], actor) && sounderActor(actor) && liveEnemy(actor),
      ) &&
      new Set(boss.actors.map((actor) => actor.id)).size === boss.actors.length &&
      boss.actors.some((actor) => actor.id === WHIRLPOOL_CAPITAL_BOSS.id) &&
      record(progress.requiredSites) &&
      vector(progress.requiredSites.holodisk)
    );
  }
  return (
    Object.keys(boss).length === 1 &&
    (boss.phase === "hidden" || boss.phase === "revealed" || boss.phase === "active")
  );
}

function sounderFlightConsistent(progress: GalaxyProgress, flight: FlightState): boolean {
  if (flight.galaxy !== 3) {
    return true;
  }
  const boss = progress.sounder;
  const { id } = WHIRLPOOL_CAPITAL_BOSS;
  const actor = flight.objects.find((object) => object.id === id) ?? flight.world.notables[id];
  const disk = flight.objects.some(
    (object) => object.kind === "destination" && object.id === "holodisk",
  );
  if (boss?.phase === "active") {
    return (
      !disk &&
      actor != null &&
      sounderActor(actor) &&
      liveEnemy(actor) &&
      progress.requiredSites?.holodisk !== undefined
    );
  }
  if (boss?.phase === "resolved") {
    return (
      (!actor ||
        (boss.outcome === "disabled" && sounderActor(actor) && actor.enemy?.disabled === true)) &&
      (!progress.holodisk || !disk)
    );
  }
  return !actor && boss?.phase !== "away" && (!boss || !disk);
}

function persistentWorld(
  galaxy: GalaxyNumber,
  routes: readonly string[],
  flight: Pick<FlightState, "seed" | "encounterSeed" | "markerActors">,
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
      (!persistentObject(object) &&
        !(markerObjectTracked(flight, object) && (object.kind !== "enemy" || liveEnemy(object)))) ||
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
        namesSavedStation(ECONOMY, galaxy, id) &&
        Number.isSafeInteger(docked) &&
        Number(docked) > 0,
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
    value.every((id) => namesSavedStation(ECONOMY, galaxy, String(id)))
  );
}

function stationOffer(value: unknown): value is StationOffer {
  if (!record(value) || Object.keys(value).length !== 2) {
    return false;
  }
  switch (value.kind) {
    case "ammo":
    case "weapon":
      return UPGRADE_WEAPONS.some((weapon) => weapon === value.weapon);
    case "weaponUpgrade":
      return typeof value.weapon === "string" && Object.hasOwn(WEAPON_CATALOG, value.weapon);
    case "track":
      return typeof value.track === "string" && Object.hasOwn(ECONOMY.trackPrices, value.track);
    case "paint":
      return (
        typeof value.scheme === "string" &&
        value.scheme !== ECONOMY.defaultPaint &&
        Object.hasOwn(ECONOMY.paints, value.scheme)
      );
    default:
      return false;
  }
}

function purchasedStock(
  economy: EconomyState,
  item: StationOffer,
  flightSeconds: number,
  value: unknown,
): boolean {
  if (value === undefined) {
    return true;
  }
  if (
    !record(value) ||
    Object.keys(value).length !== 2 ||
    !finite(value.availableAfter) ||
    value.availableAfter < STATION_RESTOCK_SECONDS ||
    value.availableAfter > flightSeconds + STATION_RESTOCK_SECONDS
  ) {
    return false;
  }
  if (item.kind === "ammo" || item.kind === "weapon") {
    return economy.ownedWeapons.includes(item.weapon) && value.level === null;
  }
  if (item.kind === "paint") {
    return economy.paints.includes(item.scheme) && value.level === null;
  }
  const [prices, installed] =
    item.kind === "track"
      ? [ECONOMY.trackPrices[item.track], economy.levels[item.track]]
      : [ECONOMY.weaponUpgradePrices[item.weapon], economy.levels.weapons[item.weapon]];
  const level = value.level;
  return (
    record(level) &&
    Object.keys(level).length === 2 &&
    level.max === prices.length + 1 &&
    finite(level.current) &&
    Number.isInteger(level.current) &&
    level.current >= 2 &&
    level.current <= installed &&
    (item.kind === "track" || item.weapon === "laser" || economy.ownedWeapons.includes(item.weapon))
  );
}

function validStationRestock(
  progress: GameState["progress"],
  economy: EconomyState,
  value: unknown,
): boolean {
  if (value === undefined) {
    return true;
  }
  if (
    !record(value) ||
    !finite(value.flightSeconds) ||
    value.flightSeconds < 0 ||
    value.flightSeconds > Number.MAX_SAFE_INTEGER - STATION_RESTOCK_SECONDS ||
    !record(value.stations)
  ) {
    return false;
  }
  const flightSeconds = value.flightSeconds;
  for (const [key, slots] of Object.entries(value.stations)) {
    const identity: unknown = JSON.parse(key);
    if (!Array.isArray(identity) || identity.length !== 2) {
      return false;
    }
    const [galaxy, id] = identity as [GalaxyNumber, unknown];
    if (
      !GALAXY_NUMBERS.includes(galaxy) ||
      typeof id !== "string" ||
      key !== JSON.stringify([galaxy, id]) ||
      !namesSavedStation(ECONOMY, galaxy, id) ||
      !record(slots)
    ) {
      return false;
    }
    const specialty = stationSpecialty(galaxy, id);
    const categories = stationShopCategories(
      {
        equipment: specialty === null || specialty === "equipment",
        exchange: true,
        heldTask: false,
        jobs: false,
        projects: false,
        weaponsAmmo: specialty === null || specialty === "weaponsAmmo",
      },
      id,
    );
    const position = ROUTE_POSITION[galaxy];
    const stock = stationStock(ECONOMY, position, id);
    for (const [slot, entry] of Object.entries(slots)) {
      if (!record(entry) || !stationOffer(entry.item) || !onSale(position, entry.item)) {
        return false;
      }
      const { item } = entry;
      const category =
        item.kind === "ammo"
          ? "ammo"
          : item.kind === "paint" || item.kind === "track"
            ? "equipment"
            : "weapons";
      const index = Number(slot.split(":")[1]);
      if (
        !categories?.includes(category) ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= stock[category].length ||
        slot !== `${category}:${index}` ||
        !purchasedStock(economy, item, flightSeconds, entry.purchased)
      ) {
        return false;
      }
    }
    const visit = { galaxy, state: value as unknown as StationRestockState, stationId: id };
    const visibleStock =
      galaxy === 2 && id === HUB_STATION && progress[galaxy].questComplete
        ? { ...stock, equipment: stock.equipment.slice(0, 3) }
        : stock;
    for (const category of categories ?? []) {
      const rows = stationShopRows(ECONOMY, economy, visibleStock, category, visit);
      const identities = rows.map(({ item }) =>
        item.kind === "weapon" || item.kind === "weaponUpgrade"
          ? item.weapon
          : JSON.stringify(item, ["kind", "scheme", "track", "weapon"]),
      );
      if (new Set(identities).size !== rows.length) {
        return false;
      }
    }
  }
  return true;
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
    !namesSavedStation(ECONOMY, galaxy, value.station) ||
    !nonnegative(value.reward) ||
    typeof value.item !== "string" ||
    !record(value.target) ||
    !vector(value.target) ||
    typeof value.target.id !== "string" ||
    (value.spot !== undefined && !vector(value.spot))
  ) {
    return false;
  }
  if (
    value.id.startsWith("lead:") &&
    (!/^lead:poi:[1-6]:-?\d+,-?\d+:0$/.test(value.id) ||
      !value.id.startsWith(`lead:poi:${galaxy}:`) ||
      (value.type !== "rescue" && (value.type !== "hunt" || galaxy === 6)))
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
      ((target !== HUB_STATION && namesSavedStation(ECONOMY, galaxy, target)) ||
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
          namesSavedStation(ECONOMY, Number(galaxy) as GalaxyNumber, station) &&
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
 * Restores the current format only; before version 1 an older save is not migrated. Other
 * versions and missing or malformed fields are rejected whole, so the store resets them: a partial
 * restore can invalidate quest state. The result shares no references with `saved`.
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
        id === 4 &&
        record(p) &&
        record(p.needle) &&
        p.needle.practiceLit === 3 &&
        Number.isInteger(p.needle.eyeLit) &&
        Number(p.needle.eyeLit) >= 0 &&
        Number(p.needle.eyeLit) <= 8 &&
        (p.needle.practiceThanked === true || Number(p.needle.eyeLit) > 0)
      ) {
        // Keep completed stages from the shorter courses in existing same-version saves.
        p.needle.practiceLit = NEEDLE.practiceGates;
        if (p.needle.eyeLit === 8) {
          p.needle.eyeLit = NEEDLE.eyeGates;
        }
      }
      if (
        !record(p) ||
        !validBossProgress(id, p) ||
        !validRedactProgress(id, p) ||
        !validClaimProgress(id, p) ||
        !validSounderProgress(id, p) ||
        (p.geography !== undefined && !validGalaxyGeography(p.geography)) ||
        (p.explorationSites !== undefined &&
          (!record(p.geography) ||
            typeof p.geography.seed !== "number" ||
            !validExplorationSites(GALAXY_SIDE, id, p.geography.seed, p.explorationSites))) ||
        (p.requiredSites !== undefined &&
          !(
            record(p.requiredSites) &&
            Object.entries(p.requiredSites).every(
              ([siteId, point]) => destinationIds[id]?.includes(siteId) && vector(point),
            )
          )) ||
        !validHostileStationSites(id, p.hostileSites) ||
        (record(p.hostileSites) &&
          Object.keys(p.hostileSites).length > 0 &&
          (!record(p.geography) || p.geography.seed === null || p.geography.seed === undefined)) ||
        !validEarthChoices(content, id, p.earthChoices) ||
        (p.markerKnowledge !== undefined && !validTargetKnowledge(p.markerKnowledge)) ||
        (p.andromeda !== undefined && (id !== 5 || !validAndromedaProgress(p.andromeda))) ||
        (p.needle !== undefined && (id !== 4 || !readNeedleChapterProgress(p.needle))) ||
        (p.needleMemoryRead !== undefined &&
          (id !== 4 || p.holodisk !== true || typeof p.needleMemoryRead !== "boolean")) ||
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
              !(
                id === 5 &&
                typeof v === "string" &&
                (v === ANDROMEDA_REDACT.relayId || settlementById(ECONOMY, v))
              ),
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
    if (record(value.tasks) && record(value.tasks[4])) {
      const task = value.tasks[4];
      if (task.kind === "activity" && task.id === "threadNeedle" && task.reward === 150) {
        task.reward = ACTIVITIES[4]!.reward;
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
    const progress = value.progress as unknown as GameState["progress"];
    if (!validStationRestock(progress, value.economy, value.stationRestock)) {
      return null;
    }
    const sunflowerBoss = progress[1].capitalBoss;
    const needleBoss = progress[4].capitalBoss;
    const redact = progress[5].redact;
    const claim = progress[2].claim;
    if (
      (sunflowerBoss?.phase === "active" &&
        (value.selectedGalaxy !== 1 || value.flight === null)) ||
      (needleBoss?.phase === "active" && (value.selectedGalaxy !== 4 || value.flight === null)) ||
      (redact?.phase === "active" && (value.selectedGalaxy !== 5 || value.flight === null)) ||
      (claim?.phase === "active" && (value.selectedGalaxy !== 2 || value.flight === null))
    ) {
      return null;
    }
    const whirlpool = progress[3];
    if (
      whirlpool.sounder?.phase === "active" &&
      (value.selectedGalaxy !== 3 || value.flight === null)
    ) {
      return null;
    }
    if (value.flight !== null) {
      const f = value.flight;
      if (
        !record(f) ||
        !validFlightTopology(f.topology) ||
        (f.exploration !== undefined &&
          !validExplorationState(
            {
              chunkSize: content.tuning.chunkSize,
              validRoleId: () => false,
              worldSide: f.topology.side,
            },
            f.exploration,
          )) ||
        (f.cartwheelMiningPatrol !== undefined &&
          (f.galaxy !== 2 || !validCartwheelPatrol(f.cartwheelMiningPatrol, f.time))) ||
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
        (f.trackedQuestId !== undefined && typeof f.trackedQuestId !== "string") ||
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
      const geography = (value.progress as unknown as GameState["progress"])[
        f.galaxy as GalaxyNumber
      ].geography;
      if (geography !== undefined && geography.seed !== f.seed) {
        return null;
      }
      const markerContext = f as unknown as FlightState;
      if (f.markerActors !== undefined && !validMarkerActors(markerContext, f.markerActors)) {
        return null;
      }
      const routes = destinationIds[value.selectedGalaxy as number] ?? [];
      if (f.combat !== undefined && !combatState(markerContext, content, routes, f.combat)) {
        return null;
      }
      if (
        !Number.isSafeInteger(f.seed) ||
        (f.encounterSeed !== undefined &&
          (!Number.isInteger(f.encounterSeed) ||
            (f.encounterSeed as number) < 0 ||
            (f.encounterSeed as number) > 0xffffffff)) ||
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
      if (
        !Array.isArray(f.objects) ||
        !Array.from(f.objects).every((object) =>
          spaceObject(value.selectedGalaxy as GalaxyNumber, routes, object),
        )
      ) {
        return null;
      }
      if (
        !persistentWorld(
          value.selectedGalaxy as GalaxyNumber,
          routes,
          markerContext,
          f.objects,
          f.world,
        )
      ) {
        return null;
      }
      if (
        !bossFlightConsistent(1, sunflowerBoss, f as unknown as FlightState) ||
        !bossFlightConsistent(4, needleBoss, f as unknown as FlightState) ||
        !redactFlightConsistent(redact, f as unknown as FlightState) ||
        !claimFlightConsistent(claim, f as unknown as FlightState) ||
        !sounderFlightConsistent(whirlpool, f as unknown as FlightState)
      ) {
        return null;
      }
      if (
        !validHostileStationEncounters(
          (value.progress as unknown as GameState["progress"])[
            value.selectedGalaxy as GalaxyNumber
          ],
          f as unknown as FlightState,
        )
      ) {
        return null;
      }
      if (f.requiredPlans !== undefined) {
        if (!record(f.requiredPlans)) {
          return null;
        }
        const progress = value.progress[value.selectedGalaxy as GalaxyNumber];
        const sites =
          record(progress) && record(progress.requiredSites) ? progress.requiredSites : {};
        const owned = new Set([
          ...f.objects.map((object) => object.id),
          ...Object.keys((f.world as PersistentWorldState).notables),
        ]);
        for (const [id, rawPlan] of Object.entries(f.requiredPlans)) {
          if (
            !routes.includes(id) ||
            !record(rawPlan) ||
            Object.keys(rawPlan).length !== 3 ||
            !spaceObject(value.selectedGalaxy as GalaxyNumber, routes, rawPlan.site)
          ) {
            return null;
          }
          let plan: AnyRequiredEncounterPlan;
          if (Object.hasOwn(rawPlan, "role")) {
            if (
              !Array.isArray(rawPlan.actors) ||
              !rawPlan.actors.every((actor) =>
                spaceObject(value.selectedGalaxy as GalaxyNumber, routes, actor),
              )
            ) {
              return null;
            }
            const rolePlan = rawPlan as unknown as RequiredRoleEncounterPlan;
            if (!requiredRolePlanConsistent(value.selectedGalaxy as number, rolePlan)) {
              return null;
            }
            plan = rolePlan;
          } else {
            if (
              !spaceObject(value.selectedGalaxy as GalaxyNumber, routes, rawPlan.leader) ||
              !Array.isArray(rawPlan.support) ||
              !rawPlan.support.every((actor) =>
                spaceObject(value.selectedGalaxy as GalaxyNumber, routes, actor),
              )
            ) {
              return null;
            }
            const legacyPlan = rawPlan as unknown as RequiredEncounterPlan;
            if (!requiredPlanConsistent(legacyPlan)) {
              return null;
            }
            plan = legacyPlan;
          }
          const point = sites[id];
          if (
            plan.site.id !== id ||
            (record(f.combat) &&
              Array.isArray(f.combat.routeEncounters) &&
              f.combat.routeEncounters.includes(id)) ||
            !record(point) ||
            plan.site.x !== point.x ||
            plan.site.y !== point.y
          ) {
            return null;
          }
          for (const actor of requiredPlanObjects(plan)) {
            if (owned.has(actor.id)) {
              return null;
            }
            owned.add(actor.id);
            if (
              record(f.markerActors) &&
              record(f.markerActors.knowledge) &&
              Object.hasOwn(f.markerActors.knowledge, actor.id)
            ) {
              return null;
            }
          }
        }
      }
      const pending = (f as unknown as FlightState).phantom?.pendingEncounter;
      if (pending !== undefined) {
        const flight = f as unknown as FlightState;
        if (
          !pending.actors.every((actor) => spaceObject(6, routes, actor)) ||
          !pendingPhantomEncounterUnshared(flight, pending)
        ) {
          return null;
        }
        if (pending.kind === "blockades") {
          const broken =
            (value.progress[value.selectedGalaxy as GalaxyNumber] as unknown as GalaxyProgress)
              .phantom?.broken ?? [];
          const expected = PHANTOM_DESTINATIONS.filter((id) => !broken.includes(id));
          if (
            Object.keys(pending.blockades).length !== expected.length ||
            expected.some((id) => !Object.hasOwn(pending.blockades, id))
          ) {
            return null;
          }
        }
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
      const pendingPellets = f.pendingPellets;
      if (
        pendingPellets !== undefined &&
        (!Array.isArray(pendingPellets) ||
          !Array.from(pendingPellets).every(
            (entry) =>
              record(entry) &&
              finite(entry.delay) &&
              entry.delay > 0 &&
              record(entry.shot) &&
              entry.shot.projectile === "dot" &&
              finite(entry.shot.life) &&
              entry.shot.life > 0 &&
              entry.shot.fade !== undefined,
          ))
      ) {
        return null;
      }
      if (
        !Array.isArray(f.shots) ||
        ![...f.shots, ...(pendingPellets ?? []).map(({ shot }) => shot)].every(
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
            (s.fan === undefined ||
              (s.projectile === "bolt" &&
                record(s.fan) &&
                Number.isInteger(s.fan.count) &&
                Number(s.fan.count) > 1 &&
                vector(s.fan.origin))) &&
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
                canReplay: (galaxy) => canReplayEarthChapter(content, state, galaxy),
                content,
                holodisks: holodisksHeld(state.progress),
                labels: {
                  next: content.labels.next ?? "next",
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
      const firstReplay = position.trail.findIndex(({ scene }) => scene.lead === "replay");
      if (position.scene.lead === "replay") {
        const start = firstReplay === -1 ? position.trail.length : firstReplay;
        const room = position.trail[start - 1];
        if (
          state.mode !== "home" ||
          state.flight !== null ||
          room?.page !== "room" ||
          position.trail.slice(start).some(({ scene }) => scene !== position.scene)
        ) {
          return null;
        }
      } else if (firstReplay !== -1) {
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

export const SAVE_RESTORE: SaveRestore = { restoreGameSave, restoreSave };
