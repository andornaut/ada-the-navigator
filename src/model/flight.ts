import { randomStream } from "@andornaut/game-kit/runtime/random";

import { ANDROMEDA_PLACES } from "../data/andromeda.ts";
import { ASTEROID_ART } from "../data/asteroidCatalog.ts";
import {
  ANDROMEDA_REDACT,
  CARTWHEEL_CLAIM,
  NEEDLE_CADENCE,
  SUNFLOWER_CAPITAL_BOSS,
  WHIRLPOOL_CAPITAL_BOSS,
} from "../data/capitalBosses.ts";
import { ASTEROID_FIELDS, CHUNK_CATALOG } from "../data/chunkCatalog.ts";
import {
  SCENERY_IMPACT_SECONDS,
  sceneryImpactDamage,
  SHIP_IMPACT_DAMAGE,
} from "../data/collisionDamage.ts";
import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { enemyActorDefinition } from "../data/enemyActorDefinition.ts";
import type { EnemyActorKind } from "../data/enemyActors.ts";
import {
  AUTHORED_PURSUIT_HOME_RADIUS,
  ENEMY_AIM,
  type EnemyArchetype,
  enemyCatalog,
  enemyOnly,
  escortTuning,
  FRIGATE_ESCORT_COUNT,
} from "../data/enemyCatalog.ts";
import { ENEMY_SIZE_RATIOS } from "../data/enemyDimensions.ts";
import {
  type HeavyHullProfile,
  ordinaryHeavy,
  PHANTOM_FLAGSHIP_ID,
  retaliatorVariant,
} from "../data/enemyIdentity.ts";
import { ENEMY_AVOIDANCE, ENEMY_KEEP_MOVING, MINING_HULLS } from "../data/enemyNavigation.ts";
import { spacingRadius } from "../data/enemySpacing.ts";
import { byPosition, ROUTE_POSITION } from "../data/galaxies.ts";
import { CURRENTS, HUNTING_PACKS, ORE_FIELDS } from "../data/galaxyFeatures.ts";
import { HOLODISKS } from "../data/holodisks.ts";
import { LANDMARK_TUNING } from "../data/jobs.ts";
import { PHANTOM_DESTINATIONS, PHANTOM_FLAGSHIP, PHANTOM_TUNING } from "../data/phantom.ts";
import { SCREEN } from "../data/screen.ts";
import { SIMULATION_STEP_SECONDS } from "../data/simulation.ts";
import { SPAWNER_POLICIES } from "../data/spawnerCatalog.ts";
import { CARTWHEEL_STORY_SHIPS } from "../data/storyShips.ts";
import { TARGET_MARKER_RANGE } from "../data/targetMarkers.ts";
import type { GalaxyNumber, GameContent } from "../data/types.ts";
import { BEAM, weaponAt, type WeaponDefinition } from "../data/weaponCatalog.ts";
import { minerNeedsPick, outlineEdge, type TracedEdge } from "./ai/edgeTrace.ts";
import type { StationGuardAnchor } from "./ai/stationGuardPatrol.ts";
import { worldNavigationQuery } from "./ai/worldNavigation.ts";
import {
  ASTEROID_SHAPES,
  bounce,
  placementRadius,
  sceneryBound,
  scenerySilhouette,
  type Silhouette,
  worldSceneryBlocksSegment,
  worldSceneryBodyContact,
  worldSceneryContact,
} from "./asteroids.ts";
import {
  CARTWHEEL_MINING_PATROL,
  type CartwheelMiningPatrolPlan,
  type CartwheelMiningRockPath,
  cartwheelPatrolAdmits,
  cartwheelPatrolRockPaths,
  planCartwheelMiningPatrol,
  warnCartwheelPatrol,
} from "./cartwheelMiningPatrol.ts";
import { planChunkCaches } from "./chunkCaches.ts";
import { onScreen } from "./conversations.ts";
import { worldCurrentsNear, worldFlowAt, worldInCurrent } from "./currents.ts";
import {
  hammerAllowsMount,
  mantaEscortCommand,
  mantaEscortCourse,
  type MantaEscortIndex,
  mantaEscortMayFire,
  type MantaEscortState,
} from "./earlyEncounterPatterns.ts";
import {
  EARLY_LANCE_MOUNT,
  earlyEncounterCueDue,
  earlyEncounterKind,
} from "./earlyEncounterRuntime.ts";
import {
  averageVelocity,
  circlingSide,
  createEnemy,
  damageEnemy,
  type EnemyAttackOpportunity,
  type EnemyContext,
  enemyDefeated,
  enemyIntegrity,
  type EnemyState,
  stepEnemy,
} from "./enemyAi.ts";
import { enemyEquipmentDefinition, rollEnemyWeaponLevel } from "./enemyEquipment.ts";
import {
  type ProceduralPoi,
  type ProceduralPoiOpportunityEligibility,
  proceduralPoisNear,
} from "./proceduralPois.ts";
export { rollEncounter } from "./encounterRoll.ts";
import { courierSpawnExclusions } from "./andromedaCourierAmbush.ts";
import { settlementsNear } from "./andromedaPlaces.ts";
import { selectCartwheelClaimField } from "./cartwheelClaimField.ts";
import { cartwheelRequiredSites } from "./cartwheelRequiredSites.ts";
import { exclusionZoneRadius } from "./exclusionZones.ts";
import { beamPoint, outlineBeamStrike, rayCircle, sampleBeam } from "./flight/beamContact.ts";
import { crossbowAttack, crossbowFrame } from "./flight/crossbow.ts";
import { inBattle, inDanger } from "./flight/danger.ts";
import { moveDebris, placeRiverRock } from "./flight/debrisMotion.ts";
import {
  destroyEnemy,
  dropFromRock,
  markBlasted,
  stepWrecks,
  wreckId,
} from "./flight/destruction.ts";
import {
  chargeEnemyBeam,
  rememberEarlyLance,
  restoreEarlyLance,
  stepEnemyBeams,
} from "./flight/enemyBeams.ts";
import {
  blastCover,
  enemyTouched,
  hitPart,
  liveParts,
  partReach,
  screenGap,
} from "./flight/enemyHitGeometry.ts";
import { movementSpeedFraction, shipSpeedFraction, towing } from "./flight/handling.ts";
import {
  ageFlashes,
  recordBeamFlash,
  recordBlastFlash,
  recordProjectileImpact,
} from "./flight/impactFeedback.ts";
import { armed, layMine, stepMines, strikeMines } from "./flight/mines.ts";
import {
  clearPilotHeading,
  flightChunkKey,
  type FreshTravel,
  movePilot,
  reflectPilotHeading,
} from "./flight/pilotMovement.ts";
import {
  projectileContact,
  projectileSceneryContact,
  shotRadius,
} from "./flight/projectileContact.ts";
import { resolveScenery, type SceneryContactOf } from "./flight/sceneryResolution.ts";
import { bounceShipContact } from "./flight/shipContact.ts";
import {
  firePlayerWeapon,
  releaseFriendlyVolley,
  releasePendingPellets,
} from "./flight/weaponRelease.ts";
import { canonicalPosition, flightEncounterSeed, flightWorldContext } from "./flightTopology.ts";
import {
  createFrigateEscorts,
  FRIGATE_ESCORT_ROLE,
  frigateEscortStation,
  requiredFrigateEscortId,
} from "./frigateEscorts.ts";
import {
  ACTIVE_CHUNK_RADIUS,
  ambientPackId,
  beginFlightStep,
  escortPackId,
  liveEnemy,
  packMemberId,
  persistentObject,
  recordUnloadedPackMember,
  retainedRouteBlocked,
  worldActivateFlightRegion,
  worldActivateRouteEncounter,
  worldPrunePackState,
  worldRecordObjectRemoval,
  worldRetainedPackMembers,
  worldSyncFlightRegion,
} from "./geography.ts";
import { guardApproach } from "./guardApproach.ts";
import { queueHostileStationReward } from "./hostileStationReward.ts";
import {
  hostileStationContext,
  materializeHostileStation,
  type PlannedHostileStation,
  type StationMaterialization,
  stationPopulationObjects,
} from "./hostileStations.ts";
import type { NeedleCadencePlacement } from "./needleExitPlan.ts";
import { activePhantomSong, phantomSongSpeed, stepPhantomAllies } from "./phantomAllies.ts";
import {
  nextPhantomBatchReserved,
  phantomFutureFlagshipGeometry,
  phantomRequiredActors,
} from "./phantomRequiredOccupants.ts";
import { readPendingPhantomEncounter } from "./phantomRequiredPlans.ts";
import { playerWeaponCoverage, type PlayerWeaponCoverageContext } from "./playerWeaponCoverage.ts";
import {
  questGuardAnchor,
  questGuardFormationReach,
  questGuardHomePorts,
} from "./questGuardPlacement.ts";
import {
  readRequiredPlan,
  rememberRequiredSite,
  requiredPlanActors,
  storeRequiredPlan,
  takeRequiredPlan,
} from "./requiredEncounterPlans.ts";
import {
  readRequiredRolePlan,
  storeRequiredRolePlan,
  takeRequiredRolePlan,
} from "./requiredRolePlans.ts";
import { requiredRouteGeometry } from "./requiredRouteGeometry.ts";
import {
  type OptionalWorldFootprint,
  type RequiredWorldOccupants,
  requiredWorldOccupantsPlacementClear,
  requiredWorldOccupantsPopulation,
  requiredWorldPlacementClear,
  requiredWorldPopulation,
  type RequiredWorldReservation,
} from "./requiredWorldReservations.ts";
import { retaliatorAsteroidQuery } from "./retaliatorAsteroids.ts";
import { INDUSTRIAL_HOME_RADIUS } from "./retaliatorNavigation.ts";
import { MOVING_ROCK_PREFIX } from "./rockRicochet.ts";
import { routeGuardEvidence } from "./routeGuardEvidence.ts";
import { discoveryStardustId } from "./stardustPlacement.ts";
import { stationFormationClear, type StationPlacementContext } from "./stationPlacement.ts";
import { impactFamily } from "./weaponImpacts.ts";
import {
  periodicWorldGrid,
  worldCell,
  worldCellAt,
  worldCellCenter,
  worldCellKey,
  worldCellsNear,
  type WorldGrid,
} from "./worldCells.ts";
import { segmentDistance, worldDelta, worldDistance, worldPoint } from "./worldContacts.ts";

export { activateRouteEncounter, syncFlightRegion } from "./geography.ts";
import {
  inside,
  outlineContact,
  outlinesContact,
  type Parts,
  partsReach,
  toScreen,
  worldParts,
} from "./convex.ts";
import { debrisSilhouette } from "./debrisBody.ts";
import { carriesStardust } from "./drops.ts";
import { enemyHull, enemyPartOutline, enemyPhysicalBody } from "./enemyBody.ts";
import { enemyBeamReach, planEnemyProjectile } from "./enemyProjectiles.ts";
import { landmarkSites } from "./landmarks.ts";
import { MINE_PARTS } from "./mineShape.ts";
import { activeNeedleCourses } from "./needle.ts";
import {
  clearNeedleEnemies,
  ensureNeedleDebris,
  isNeedleRim,
  needleChannelContains,
  needleRimContact,
  needleRims,
} from "./needleFlight.ts";
import {
  ORE_FIELD_CLEAR_RADIUS,
  ORE_FIELD_ROLE,
  type OreField,
  worldOreFieldsNear,
} from "./oreFields.ts";
import { pickupOutline, stardustPickupReach } from "./pickupBody.ts";
import { impactSurface } from "./projectileImpact.ts";
import { SceneryFrames } from "./sceneryFrames.ts";
import { sceneryImpact } from "./sceneryImpact.ts";
import { rechargeShield } from "./shieldRecharge.ts";
import { shipBody, shipTouches, shipTouchesScreenCircle } from "./shipBody.ts";
import { direction, turnToward } from "./shipPhysics.ts";
import {
  worldFitsEncounter,
  worldRegionalEngagementAdmissions,
  worldSpawnerStage,
} from "./spawner.ts";
import {
  type ExclusionZone,
  planRegion,
  type SpawnPlacement,
  type SpawnRules,
} from "./spawnPlanner.ts";
import {
  chunkSpawnReach,
  chunkSpawnRegion,
  spawnGatherReach,
  spawnRules,
  worldSpawnExclusions,
  worldSpawnSites,
} from "./spawnTargets.ts";
import {
  flightStationContext,
  HUB_STATION,
  worldStationById,
  worldStationsNear,
} from "./stations.ts";
import type {
  EconomyState,
  FlightEvent,
  FlightInput,
  FlightState,
  GalaxyProgress,
  RequiredRoleEncounterPlan,
  Shot,
  SpaceObject,
  Vec,
} from "./types.ts";
import { leveledValue, noLevels, type ShipTuning, shipTuning } from "./upgrades.ts";
import { markVisited, visitedChunk } from "./visited.ts";
import { clampAmmo, grantedAmmo, shotsLeft } from "./weapons.ts";

export { wreckId };
export { salvage, salvageTarget } from "./flight/destruction.ts";
export { activeEnemyBeams, type EnemyBeam } from "./flight/enemyBeams.ts";
export { inBattle, inDanger, movementSpeedFraction, shipSpeedFraction, towing };
export {
  activeBeamFlashes,
  activeBlastFlashes,
  activeProjectileImpacts,
  activeWeaponImpacts,
  type BeamFlash,
  BLAST_FLASH_SECONDS,
  type BlastFlash,
  drawnBeamFlash,
  type ProjectileImpact,
} from "./flight/impactFeedback.ts";

const length = (v: Vec) => Math.hypot(v.x, v.y);
/**
 * Ada's velocity averaged for enemy aim per flight (ENEMY_AIM.velocitySeconds). It is transient
 * like the movement heading: a restored or new flight starts it at her current velocity.
 */
const aimVelocities = new WeakMap<FlightState, Vec>();
/** Ada's averaged velocity for enemy aim after `dt` more seconds at her current velocity. */
function averageAimVelocity(dt: number, flight: FlightState): Vec {
  const next = averageVelocity(dt, aimVelocities.get(flight) ?? flight.velocity, flight.velocity);
  aimVelocities.set(flight, next);
  return next;
}
// Whether the current step runs under reduced motion, which holds every rock on frame 0.
const reducedMotions = new WeakMap<FlightState, boolean>();
/**
 * The silhouette a scenery object is drawn with in this flight: traveling debris's piece in its
 * galaxy, else a rock's; null for a circle obstacle.
 */
function drawnOf(flight: FlightState, object: SpaceObject): Silhouette | null {
  return debrisSilhouette(flight.galaxy, object) ?? scenerySilhouette(object);
}
/**
 * The frame a scenery object shows and collides with now: traveling debris's tumble frame, a
 * rock's spin frame, or 0 when it is still.
 */
const sceneryFrames = new SceneryFrames();
function frameOf(flight: FlightState, object: SpaceObject): number {
  return sceneryFrames.frame(flight, reducedMotions.get(flight) ?? false, object);
}
const projectileScenery = { drawnOf, frameOf };
const debrisMotion = { ...projectileScenery, arrivalPoints, bumpAda };
const weaponReleaseContact = { fireBeam, strike };

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

/** Whether a point lies inside an existing friendly protected place. */
function pendingRequiredRoutes(flight: FlightState): readonly RequiredWorldReservation[] {
  return Object.values(flight.requiredPlans ?? {}).flatMap((plan) =>
    requiredPlanActors(plan).map((guard) => ({ guard, site: plan.site })),
  );
}

/** Optional capacity counts canonical pending hulls once without treating home proxies as actors. */
function requiredPopulation(flight: FlightState): readonly SpaceObject[] {
  return requiredWorldOccupantsPopulation(flight, [
    ...pendingRequiredRoutes(flight).map(({ guard }) => guard),
    ...(readPendingPhantomEncounter(flight)?.actors ?? []),
  ]);
}

/**
 * Authored story actors and sites and Phantom's pending and future geometry, which optional
 * placements keep clear of beside the required routes.
 */
function requiredOccupants(content: GameContent, flight: FlightState): RequiredWorldOccupants {
  const authored =
    flight.galaxy === 2 ||
    flight.galaxy === 3 ||
    (flight.galaxy === 5 && andromedaRelaySites.has(flight)) ||
    flight.galaxy === 6 ||
    (flight.galaxy === 4 && flight.needle)
      ? stationPopulationObjects(flight)
      : [];
  return {
    actors: [
      ...phantomRequiredActors(flight),
      ...phantomFutureFlagshipGeometry(content, flight),
      ...authored.filter(
        (object) =>
          liveEnemy(object) &&
          (flight.galaxy === 4
            ? object.enemy?.packId === "needle:exit" || object.id === NEEDLE_CADENCE.id
            : flight.galaxy === 5
              ? object.id === ANDROMEDA_REDACT.id
              : object.id === CARTWHEEL_CLAIM.id ||
                object.routeId !== undefined ||
                object.enemy?.packId?.startsWith("route:") ||
                object.enemy?.escortOf?.startsWith("route:")),
      ),
    ],
    sites: [
      ...(flight.galaxy === 5 ? [] : authored.filter((object) => object.kind === "destination")),
      ...cartwheelSiteGeometry(flight),
      ...(whirlpoolProtectedDisks.get(flight) ?? []),
      ...(andromedaRelaySites.get(flight) ?? []),
    ],
  };
}

function requiredFootprintClear(
  content: GameContent,
  flight: FlightState,
  footprint: OptionalWorldFootprint,
): boolean {
  const context = { ...flightWorldContext(flight), content, galaxy: flight.galaxy };
  return (
    requiredWorldPlacementClear(context, requiredRouteGeometry(content, flight), footprint) &&
    requiredWorldOccupantsPlacementClear(context, requiredOccupants(content, flight), footprint)
  );
}

function requiredPlacementClear(
  content: GameContent,
  flight: FlightState,
  object: SpaceObject,
): boolean {
  return requiredFootprintClear(content, flight, {
    center: object.orbit ?? object,
    radius: placementRadius(object) + (object.orbit?.radius ?? 0),
  });
}

/**
 * The flight time each flight's arrival grace ends. It is never saved, so a flight resumed with
 * Continue has none.
 */
const arrivalGraceEnds = new WeakMap<FlightState, number>();

/** Starts Ada's arrival grace at a launch, quantum jump arrival, Travel arrival or undocking. */
export function beginArrivalGrace(content: GameContent, flight: FlightState): void {
  arrivalGraceEnds.set(flight, flight.time + content.tuning.flight.arrivalGrace);
}

/** Whether Ada's arrival grace still runs; it counts flight time, so pauses do not use it up. */
export function arrivalGraceActive(flight: FlightState): boolean {
  const end = arrivalGraceEnds.get(flight);
  return end !== undefined && flight.time < end;
}

/**
 * Whether Ada is protected while play runs: no enemy may target her and nothing damages her.
 * Docking, station menus and conversation cards pause the flight instead. No place protects her.
 */
function adaProtected(flight: FlightState): boolean {
  return arrivalGraceActive(flight);
}
/**
 * An object's whole reach for clearances: a drawn rock's silhouette radius, else its radius, and
 * a drifting asteroid's covers its path around the orbit center.
 */
function footprint(object: SpaceObject): Vec & { radius: number } {
  const radius = placementRadius(object);
  return object.orbit
    ? { radius: radius + object.orbit.radius, x: object.orbit.x, y: object.orbit.y }
    : { radius, x: object.x, y: object.y };
}
/** Whether an object's footprint stays more than `clearance` from `point`. */
function clearOf(flight: FlightState, clearance: number, point: Vec, object: SpaceObject): boolean {
  const reach = footprint(object);
  return worldDistance(flightWorldContext(flight), reach, point) > clearance + reach.radius;
}
/**
 * Whether an object's whole footprint stays outside every exclusion zone and the arrival clearance of
 * every launch point, so no rock or drift path reaches one.
 */
function clearOfExclusionZones(content: GameContent, object: SpaceObject, flight: FlightState) {
  return (
    requiredPlacementClear(content, flight, object) &&
    flight.objects.every((o) => {
      const radius = exclusionZoneRadius(content, o);
      return radius === null || clearOf(flight, radius, o, object);
    }) &&
    arrivalPoints(flight).every((point) =>
      clearOf(flight, content.tuning.exclusionRadius, point, object),
    )
  );
}
/**
 * Whether an object's footprint keeps clear of every landmark's charting range, so chunk
 * generation leaves the space around landmarks open (gameplay/quests.md "Landmarks").
 */
function clearOfLandmarks(object: SpaceObject, flight: FlightState): boolean {
  return landmarkSites(flight.galaxy).every((site) =>
    clearOf(flight, LANDMARK_TUNING.chart, site, object),
  );
}
const SCENERY = ["rock", "debris"];
const sceneryResolution = { ...projectileScenery, kinds: SCENERY };
const pilotScenery = {
  contactOf: adaContact,
  onContact: adaSceneryContact,
  resolution: sceneryResolution,
};
const ASTEROID_SHAPE_LIST = [...ASTEROID_SHAPES.values()];
/**
 * Push a circle out of overlapping scenery along each contact normal and report every contact
 * once, with the obstacle's own velocity, so movers bounce and never stay embedded.
 */
/** Seconds between scenery bumps that deal damage, and the damage each deals (rules.md). */
export const BUMP_DAMAGE = {
  amount: sceneryImpactDamage(CONTENT.tuning.flight),
  seconds: SCENERY_IMPACT_SECONDS,
} as const;

/**
 * Scenery reflects Ada's velocity and smoothed heading together, so recoil carries momentum. A
 * bump in flight deals 1 damage, at most once per 0.5 seconds, and counts as a hit for the
 * shield's recharge delay; settling Ada out of scenery she was placed in deals none.
 */
function adaSceneryContact(
  content: GameContent,
  events: FlightEvent[] | null,
  flight: FlightState,
): (normal: Vec, surface: Vec, object: SpaceObject) => void {
  const { sceneryRecoil, sceneryRestitution } = content.tuning.flight;
  return (normal, surface, object) => {
    if (events && !isNeedleRim(object)) {
      bumpAda(content, flight, events, object);
    }
    flight.velocity = bounce(sceneryRestitution, sceneryRecoil, normal, surface, flight.velocity);
    reflectPilotHeading(flight, normal);
  };
}

/** One admitted bump damages Ada and its destructible obstacle through the normal hit path. */
function bumpAda(
  content: GameContent,
  flight: FlightState,
  events: FlightEvent[],
  object: SpaceObject,
): void {
  const impact = sceneryImpact(content.tuning.flight, flight, object);
  if (!impact) {
    return;
  }
  flight.lastBump = flight.time;
  if (!adaProtected(flight)) {
    flight.shield = Math.max(0, flight.shield - impact.amount);
    flight.sinceDamage = 0;
  }
  if (impact.damageObstacle) {
    hit(content, impact.amount, null, object, flight, events);
  }
}

/** Resolves ship contact, then settles Ada against any scenery reached by the push-out. */
export function bounceShips(
  content: GameContent,
  flight: FlightState,
  object: SpaceObject,
): boolean {
  const closing = bounceShipContact(reflectPilotHeading, content.tuning.flight, flight, object);
  if (closing === null) {
    return false;
  }
  settleAda(content, flight);
  return closing;
}

function touchesAda(flight: FlightState, point: Vec, radius: number): boolean {
  return shipTouches(
    flight.facing,
    flight.player,
    worldPoint(flightWorldContext(flight), flight.player, point),
    radius,
  );
}
/** Whether a blast circle of screen radius `radius` at `point` overlaps Ada as drawn. */
function blastCoversAda(flight: FlightState, point: Vec, radius: number): boolean {
  return shipTouchesScreenCircle(
    flight.facing,
    flight.player,
    worldPoint(flightWorldContext(flight), flight.player, point),
    radius,
  );
}
function canonicalObject(flight: FlightState, object: SpaceObject): void {
  canonicalPosition(flight, object);
  if (object.enemy) {
    canonicalPosition(flight, object.enemy.position);
    canonicalPosition(flight, object.enemy.home);
    if (object.enemy.lastSeen) {
      canonicalPosition(flight, object.enemy.lastSeen);
    }
    if (object.enemy.retreat) {
      canonicalPosition(flight, object.enemy.retreat.origin);
    }
  }
}
/** Ada's drawn ship against scenery at her current facing. */
function adaContact(flight: FlightState): SceneryContactOf {
  const world = flightWorldContext(flight);
  return (object, position, frame, drawn) =>
    isNeedleRim(object)
      ? needleRimContact({ body: shipBody(flight.facing), position, world }, object)
      : worldSceneryBodyContact(world, object, position, shipBody(flight.facing), frame, 0, drawn);
}

/** Pushes Ada's drawn ship out of scenery and bounces her off what she touched. */
function settleAda(content: GameContent, flight: FlightState): void {
  resolveScenery(
    sceneryResolution,
    flight,
    adaContact(flight),
    adaSceneryContact(content, null, flight),
    flight.player,
    undefined,
    needleRims(flight),
  );
}

/**
 * A debris river's rocks for each current within the active region that carries one: evenly
 * spaced along the current, each at a seeded offset across it.
 */
function ensureDebrisRivers(content: GameContent, point: Vec, flight: FlightState): void {
  if (!CURRENTS.galaxies.includes(flight.galaxy)) {
    return;
  }
  const grid = periodicWorldGrid(flightWorldContext(flight), content.tuning.chunkSize);
  const reach = (ACTIVE_CHUNK_RADIUS + 1) * grid.pitch;
  const ids = new Set(flight.objects.map((object) => object.id));
  for (const current of worldCurrentsNear(
    flightWorldContext(flight),
    flight.galaxy,
    reach,
    point,
  )) {
    if (!current.debris) {
      continue;
    }
    const count = Math.max(1, Math.round((current.length / 1000) * CURRENTS.debrisPerThousand));
    const next = random(hash(flight.seed ^ 0x51e7, current.points[0]!.x, current.points[0]!.y));
    for (let index = 0; index < count; index++) {
      const id = `river:${current.id}:${index}`;
      if (ids.has(id) || Object.hasOwn(flight.world.notables, id)) {
        continue;
      }
      const river = {
        arc: ((index + next() * 0.6) / count) * current.length,
        current: current.id,
      };
      const object: SpaceObject = {
        hp: content.tuning.flight.rockHp,
        id,
        kind: "debris",
        radius: content.tuning.flight.rockRadius,
        river,
        x: 0,
        y: 0,
      };
      placeRiverRock(flight, object);
      canonicalObject(flight, object);
      flight.objects.push(object);
      ids.add(id);
    }
  }
}

/** Station sites within the active region become persistent station objects. */
function ensureStations(content: GameContent, point: Vec, flight: FlightState): void {
  const grid = periodicWorldGrid(flightWorldContext(flight), content.tuning.chunkSize);
  const reach = (ACTIVE_CHUNK_RADIUS + 1) * grid.pitch;
  for (const site of worldStationsNear(
    flightStationContext(flight),
    ECONOMY,
    flight.galaxy,
    reach,
    point,
  )) {
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
  // A station's exclusion zone holds no layout object or drift path from chunks generated before it.
  clearLayoutObjects(
    (object) =>
      object === station ||
      object.kind === "destination" ||
      clearOf(flight, ECONOMY.station.exclusionRadius, station, object),
    flight,
  );
  return station;
}
/** Ensures a discovered station is present, for travel. */
export function ensureStation(
  content: GameContent,
  id: string,
  flight: FlightState,
): SpaceObject | null {
  const existing = flight.objects.find((o) => o.id === id && o.kind === "station");
  if (existing) {
    return existing;
  }
  const site = worldStationById(flightStationContext(flight), ECONOMY, flight.galaxy, id);
  if (!site) {
    return null;
  }
  worldActivateFlightRegion(flightWorldContext(flight), content, site, flight);
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

const planningRequiredWorld = new WeakSet<FlightState>();
const initializingRequiredChapter = new WeakSet<FlightState>();

function generate(
  content: GameContent,
  point: Vec,
  cartwheelHubKnown: boolean,
  flight: FlightState,
): void {
  if (
    planningRequiredWorld.has(flight) ||
    initializingRequiredChapter.has(flight) ||
    !nextPhantomBatchReserved(flight)
  ) {
    return;
  }
  worldActivateFlightRegion(flightWorldContext(flight), content, point, flight);
  ensureStations(content, point, flight);
  ensureDebrisRivers(content, point, flight);
  ensureNeedleDebris(content, flight);
  clearNeedleEnemies(flight);
  const size = content.tuning.chunkSize;
  const generated = generatedChunks(flight);
  const existing = new Set(flight.objects.map((object) => object.id));
  const grid = periodicWorldGrid(flightWorldContext(flight), size);
  // Generated chunks may hold packs, whose sizes the combat record keeps.
  combat(flight);
  for (const cell of worldCellsNear(grid, grid.pitch * 2, point)) {
    const key = worldCellKey(grid, cell);
    if (generated.has(key)) {
      continue;
    }
    flight.chunks.push(key);
    generated.add(key);
    chunkIndexes.get(flight)!.length = flight.chunks.length;
    placeAmbient(content, grid, worldCell(grid, cell), existing, cartwheelHubKnown, flight);
    placeCaches(content, cell, existing, flight);
    placeOreFields(content, grid, cell, existing, flight);
  }
}

const ambientRules = new Map<string, SpawnRules>();

/**
 * The spawn rules for a flight's galaxy and world: the target catalog, with no enemy groups once
 * Phantom's flagship is salvaged.
 */
function flightSpawnRules(flight: FlightState): SpawnRules {
  const { worldSide } = flightWorldContext(flight);
  const quiet = flight.galaxy === 6 && flight.phantom?.phase === "salvaged";
  const key = `${flight.galaxy}:${worldSide}:${quiet}`;
  let rules = ambientRules.get(key);
  if (!rules) {
    const catalog = spawnRules(flight.galaxy, worldSide);
    rules = quiet
      ? { ...catalog, bands: catalog.bands.map((band) => ({ ...band, enemies: [] })) }
      : catalog;
    ambientRules.set(key, rules);
  }
  return rules;
}

/** A required actor's footprint: an enemy's spacing radius, else its placement radius. */
function actorFootprint(flight: FlightState, actor: SpaceObject): number {
  return actor.enemy
    ? spacingRadius(ROUTE_POSITION[flight.galaxy], actor.enemy)
    : placementRadius(actor);
}

/**
 * The exclusion zones within `radius` of `point`: the seeded world's (station exclusion zones,
 * launch and arrival radii, landmarks, currents and ore fields), Ada's clearance for rocks,
 * the exclusion zones of placed stations and destinations, required routes and their hulls,
 * with each required hull's local admission neighbourhood for enemies, and the Needle channel.
 */
function flightSpawnExclusions(
  content: GameContent,
  flight: FlightState,
  radius: number,
  point: Vec,
): ExclusionZone[] {
  const context = flightWorldContext(flight);
  const near = (at: Vec, reach: number) => worldDistance(context, at, point) <= radius + reach;
  const disc = (
    rule: string,
    applies: ExclusionZone["applies"],
    at: Vec,
    reach: number,
  ): ExclusionZone[] =>
    near(at, reach)
      ? [{ applies, rule, shape: { kind: "disc", radius: reach, x: at.x, y: at.y } }]
      : [];
  const { gap } = flightSpawnRules(flight);
  const occupants = requiredOccupants(content, flight);
  const routes = requiredRouteGeometry(content, flight);
  const required = {
    actors: [...routes.map(({ guard }) => guard), ...occupants.actors],
    sites: [...routes.map(({ site }) => site), ...occupants.sites],
  };
  return [
    ...worldSpawnExclusions(
      context,
      flight.galaxy,
      flight.seed,
      arrivalPoints(flight),
      radius,
      point,
    ),
    ...disc("player-clearance", ["rock", "moving"], flight.player, content.tuning.exclusionRadius),
    ...flight.objects.flatMap((object) => {
      if (object.id === SUNFLOWER_CAPITAL_BOSS.id && object.enemy && !object.enemy.salvaged) {
        return [
          ...disc(
            "authored-capital",
            ["rock", "moving"],
            object.enemy.home,
            Math.max(actorFootprint(flight, object), object.radius + content.tuning.talkRange) +
              gap,
          ),
          ...disc("authored-capital", ["enemy"], object, actorFootprint(flight, object) + gap),
        ];
      }
      if (object.id === SUNFLOWER_CAPITAL_BOSS.cacheId) {
        return disc("authored-cache", ["rock", "moving"], object, object.radius + gap);
      }
      const reach = exclusionZoneRadius(content, object);
      return reach === null
        ? []
        : disc(object.kind, ["rock", "moving", "path", "enemy"], object, reach);
    }),
    ...required.sites.flatMap((site) => {
      const reach = exclusionZoneRadius(content, site);
      return reach === null ? [] : disc("required", ["rock", "moving", "enemy"], site, reach);
    }),
    ...required.actors.flatMap((actor) => [
      // Rocks keep the spawn gap from a required hull's footprint.
      ...disc("required", ["rock", "moving"], actor, actorFootprint(flight, actor) + gap),
      // Ambient groups stay out of a required hull's local admission neighbourhood, so its
      // budget remains for the required encounter.
      ...disc(
        "required",
        ["enemy"],
        actor,
        2 * SPAWNER_POLICIES[flight.galaxy].localRadius + actorFootprint(flight, actor),
      ),
    ]),
    ...courierSpawnExclusions(flight, radius, point),
    ...(flight.cartwheelMiningPatrol
      ? [
          {
            applies: ["rock", "moving", "path"] as const,
            rule: "cartwheel-patrol-bypass",
            shape: {
              halfWidth: CARTWHEEL_MINING_PATROL.bypassWidth / 2,
              kind: "path" as const,
              points: flight.cartwheelMiningPatrol.plan.bypass,
            },
          },
        ]
      : []),
    ...activeNeedleCourses(flight).map((course) => ({
      applies: ["rock", "moving", "enemy"] as const,
      rule: "needle-channel",
      shape: { halfWidth: course.width / 2, kind: "path" as const, points: course.path },
    })),
  ];
}

/**
 * Plans one chunk's enemy groups, rocks and moving rocks, and adds each placement that is not
 * already present or recorded as removed. Rocks follow the galaxy's seed and enemy groups the
 * flight's encounter identity.
 */
function placeAmbient(
  content: GameContent,
  grid: WorldGrid,
  cell: Vec,
  existing: Set<string>,
  cartwheelHubKnown: boolean,
  flight: FlightState,
): void {
  const rules = flightSpawnRules(flight);
  const centre = worldCellCenter(grid, cell);
  const reach = chunkSpawnReach(rules);
  const region = chunkSpawnRegion(
    rules,
    flightSpawnExclusions(content, flight, reach, centre),
    worldSpawnSites(
      flightWorldContext(flight),
      flight.galaxy,
      reach + spawnGatherReach(rules),
      centre,
    ),
    cell,
  );
  const key = worldCellKey(grid, cell);
  const { placements } = planRegion(
    rules,
    { encounter: flightEncounterSeed(flight), world: flight.seed },
    region,
  );
  const groups = new Map<string, SpawnPlacement[]>();
  for (const placement of placements) {
    if (placement.chunk !== key) {
      continue;
    }
    if (placement.category === "enemy") {
      const group = groups.get(placement.group!) ?? [];
      group.push(placement);
      groups.set(placement.group!, group);
      continue;
    }
    placeRock(placement, existing, flight);
  }
  for (const group of groups.values()) {
    const pack = ambientPackId(key);
    const patrol =
      cartwheelHubKnown && flight.galaxy === 2 && !flight.cartwheelMiningPatrol
        ? planAmbientCartwheelPatrol(content, pack, group, existing, flight)
        : undefined;
    if (patrol) {
      const actors = group.map((_, index) => packMemberId(pack, index));
      placeGroup(
        content,
        pack,
        group.map((placement, index) => ({ ...placement, ...patrol.homes[index]! })),
        existing,
        flight,
      );
      // Keep the selected physical cover through normal paging, without changing how it moves.
      for (const object of flight.objects) {
        if (actors.includes(object.id) || patrol.coverIds.includes(object.id)) {
          object.persistent = true;
        }
      }
      flight.cartwheelMiningPatrol = { actors, plan: patrol };
    } else {
      placeGroup(content, pack, group, existing, flight);
    }
  }
}

/** Redirect one unspent, already-selected ordinary fighter pack in place of its usual spawn. */
function planAmbientCartwheelPatrol(
  content: GameContent,
  pack: string,
  group: readonly SpawnPlacement[],
  existing: ReadonlySet<string>,
  flight: FlightState,
): CartwheelMiningPatrolPlan | undefined {
  const anchor = group[0];
  if (
    !anchor ||
    group.length > 4 ||
    Object.hasOwn(combat(flight).initialPackSizes, pack) ||
    group.some(({ archetype, leader }, index) => {
      const id = packMemberId(pack, index);
      return (
        archetype !== "fighter" ||
        leader !== undefined ||
        existing.has(id) ||
        Object.hasOwn(flight.world.notables, id)
      );
    })
  ) {
    return undefined;
  }
  const world = flightWorldContext(flight);
  const fields = worldOreFieldsNear(world, flight.galaxy, content.tuning.chunkSize * 2, anchor)
    .filter((field) =>
      flight.objects.some(
        (object) => object.role === ORE_FIELD_ROLE && object.id.startsWith(`${field.id}:`),
      ),
    )
    .sort((a, b) => worldDistance(world, anchor, a) - worldDistance(world, anchor, b));
  if (!fields.length) {
    return undefined;
  }
  const actors = group.map((point, index) =>
    spawnEnemy(content, flight, "fighter", packMemberId(pack, index), point, pack),
  );
  const population = requiredWorldPopulation(flight, pendingRequiredRoutes(flight));
  const policy = SPAWNER_POLICIES[flight.galaxy];
  const route = requiredRouteGeometry(content, flight);
  const requiredSites = [
    ...route.map(({ site }) => site),
    ...requiredOccupants(content, flight).sites,
    ...flight.objects.filter((object) => object.kind === "destination" && object.id === "hub"),
  ];
  const result = planCartwheelMiningPatrol({
    ...world,
    admits: (plan) => {
      const placed = actors.map((actor, index) => ({ ...actor, ...plan.homes[index]! }));
      const reach = Math.max(
        ...placed.map(
          (actor) => worldDistance(world, actor, plan.anchor) + actorFootprint(flight, actor),
        ),
      );
      return (
        worldFitsEncounter(
          hostileStationContext(flight),
          policy,
          worldSpawnerStage(world, policy, plan.anchor),
          ROUTE_POSITION[flight.galaxy],
          population,
          plan.anchor,
          { archetype: "fighter", count: placed.length },
          reach,
        ) && stationFormationClear(questGuardPlacementContext(content, flight), placed)
      );
    },
    allocation: {
      anchor,
      fighters: actors.map((actor) => {
        const definition = enemyEquipmentDefinition(flight.galaxy, actor.enemy!);
        // The rounded bolt coverage fits within the per-axis play view. Allow the full screen
        // diagonal transformed to world units, plus the launcher's inherited motion.
        const coverage = Math.hypot(SCREEN.width, SCREEN.height) * Math.SQRT2;
        return {
          pursuitRadius: definition.pursuit.homeRadius,
          radius: actorFootprint(flight, actor),
          weaponReach:
            coverage * (1 + definition.physics.maxSpeed / definition.fire.projectileSpeed),
        };
      }),
      id: pack,
    },
    fieldIsClear: (field) =>
      claimedOreFields.get(flight) !== field.id &&
      requiredSites.every(
        (site) =>
          worldDistance(world, field, site) >= ORE_FIELDS.clearance + ORE_FIELDS.diameter / 2,
      ),
    fields,
    hubKnown: true,
    rocksNear: (field, radii) => cartwheelPatrolTerrain(content, field, radii, flight),
  });
  return result.status === "planned" ? result.plan : undefined;
}

/** Check seeded terrain beyond the active chunks before placing a patrol. */
function cartwheelPatrolTerrain(
  content: GameContent,
  field: Vec,
  radii: Readonly<{ homes: number; route: number }>,
  flight: FlightState,
): CartwheelMiningRockPath[] {
  const rocks = cartwheelPatrolRockPaths(placementRadius, field, radii.route, flight);
  const rules = flightSpawnRules(flight);
  const grid = periodicWorldGrid(flightWorldContext(flight), rules.chunkSize);
  const cell = worldCellAt(grid, field);
  const chunkReach = chunkSpawnReach(rules);
  // The reserved bypass excludes future ambient rocks when their chunks generate.
  // The pending rocks only need to leave the fighters' possible starting footprints clear.
  const span = Math.ceil((radii.homes + chunkReach) / grid.pitch);
  const radius = (span + 1) * grid.pitch * Math.SQRT2 + chunkReach;
  const generated = generatedChunks(flight);
  const { placements } = planRegion(
    rules,
    { encounter: flightEncounterSeed(flight), world: flight.seed },
    {
      cell: { x: cell.x - span, y: cell.y - span },
      columns: span * 2 + 1,
      exclusions: flightSpawnExclusions(content, flight, radius, field),
      rows: span * 2 + 1,
      sites: worldSpawnSites(grid, flight.galaxy, radius + spawnGatherReach(rules), field),
    },
  );
  for (const placement of placements) {
    if (placement.category !== "rock" || generated.has(placement.chunk)) {
      continue;
    }
    const asteroid = ASTEROID_SHAPES.get(placement.shape!)!;
    const movement = placement.moving?.velocity;
    const footprint = placementRadius({
      asteroid: asteroid.id,
      kind: movement ? "debris" : "rock",
      radius: asteroid.radius,
    });
    if (worldDistance(grid, field, placement) > radii.homes + footprint) {
      continue;
    }
    rocks.push({
      id: movement ? MOVING_ROCK_PREFIX + placement.id : placement.id,
      radius: footprint,
      start: { x: placement.x, y: placement.y },
      unspawned: "ambient",
    });
  }
  for (const ore of worldOreFieldsNear(
    grid,
    flight.galaxy,
    radii.route + ORE_FIELD_CLEAR_RADIUS,
    field,
  )) {
    if (generated.has(worldCellKey(grid, worldCellAt(grid, ore)))) {
      continue;
    }
    for (const [index, rock] of ore.rocks.entries()) {
      const shape = ASTEROID_SHAPES.get(rock.asteroid)!;
      rocks.push({
        id: `${ore.id}:${index}`,
        radius: placementRadius({ asteroid: shape.id, kind: "rock", radius: shape.radius }),
        start: rock,
        unspawned: "fixed",
      });
    }
  }
  return rocks;
}

/** A planned rock as a static asteroid, or as moving debris with its planned velocity. */
function placeRock(placement: SpawnPlacement, existing: Set<string>, flight: FlightState): void {
  const shape = ASTEROID_SHAPES.get(placement.shape!)!;
  const id = placement.moving ? `${MOVING_ROCK_PREFIX}${placement.id}` : placement.id;
  if (existing.has(id) || Object.hasOwn(flight.world.notables, id)) {
    return;
  }
  const object: SpaceObject = {
    asteroid: shape.id,
    hp: byPosition(ASTEROID_FIELDS, flight.galaxy).hp[shape.size],
    id,
    kind: placement.moving ? "debris" : "rock",
    radius: shape.radius,
    x: placement.x,
    y: placement.y,
    ...(placement.crystals ? { crystals: placement.crystals } : {}),
    ...(placement.moving ? { velocity: { ...placement.moving.velocity } } : {}),
  };
  canonicalObject(flight, object);
  flight.objects.push(object);
  existing.add(id);
}

/**
 * A planned enemy group as one pack of members on its line and, for frigates, an escort pack.
 * A pack seen before adds back only its unloaded survivors, preserving its casualty count.
 */
function placeGroup(
  content: GameContent,
  packId: string,
  group: readonly SpawnPlacement[],
  existing: Set<string>,
  flight: FlightState,
): void {
  // Saves can still own an earlier capital encounter at the same chunk key. Never spend its
  // replacement budget on the new roster while that encounter is still represented.
  const leaderId = packMemberId(packId, 0);
  if (
    flight.combat?.profiledPacks?.[packId] === "capital" ||
    flight.world.notables[leaderId]?.enemy?.archetype === "capital" ||
    (existing.has(leaderId) &&
      flight.objects.some(
        (object) => object.id === leaderId && object.enemy?.archetype === "capital",
      ))
  ) {
    return;
  }
  const leaders = group.filter((placement) => placement.leader === undefined);
  const archetype = leaders[0]!.archetype as EnemyArchetype;
  const ids = new Map(
    leaders.map((placement, index) => [placement.id, packMemberId(packId, index)]),
  );
  const phase = (id: string) =>
    randomStream(flightEncounterSeed(flight), `ambient-phase:${id}`)() * 2 * Math.PI;
  placePack(
    content,
    existing,
    flight,
    { archetype, escort: false, id: packId },
    (id) => ({ escortOf: null, phase: phase(id) }),
    leaders,
  );
  const escorts = group.filter((placement) => placement.leader !== undefined);
  if (!escorts.length) {
    return;
  }
  placePack(
    content,
    existing,
    flight,
    { archetype: escorts[0]!.archetype as EnemyArchetype, escort: true, id: escortPackId(packId) },
    (_, placement) => {
      const leader = leaders.find((member) => member.id === placement.leader)!;
      return {
        escortOf: ids.get(leader.id)!,
        phase: Math.atan2(placement.y - leader.y, placement.x - leader.x),
        ...(archetype === "frigate" ? { role: FRIGATE_ESCORT_ROLE } : {}),
      };
    },
    escorts,
  );
}

/** Adds one pack's members, by index, up to its unloaded survivors when seen before. */
function placePack(
  content: GameContent,
  existing: Set<string>,
  flight: FlightState,
  pack: { readonly archetype: EnemyArchetype; readonly escort: boolean; readonly id: string },
  member: (
    id: string,
    placement: SpawnPlacement,
  ) => { escortOf: string | null; phase: number; role?: string },
  placements: readonly SpawnPlacement[],
): void {
  const { archetype, id: packId } = pack;
  const state = combat(flight);
  const initialized = Object.hasOwn(state.initialPackSizes, packId);
  const profiled =
    !pack.escort &&
    ordinaryHeavy(archetype) &&
    (initialized ? state.profiledPacks?.[packId] === archetype : true);
  let budget = initialized ? (state.unloadedPackMembers?.[packId] ?? 0) : placements.length;
  let admitted = 0;
  for (const [index, placement] of placements.entries()) {
    if (budget <= 0) {
      break;
    }
    const id = packMemberId(packId, index);
    if (existing.has(id) || Object.hasOwn(flight.world.notables, id)) {
      continue;
    }
    const { escortOf, phase, role } = member(id, placement);
    const object = spawnEnemy(
      content,
      flight,
      archetype,
      id,
      { x: placement.x, y: placement.y },
      packId,
      phase,
      escortOf,
    );
    if (role) {
      object.role = role;
    }
    if (persistentObject(object)) {
      object.persistent = false;
    }
    canonicalObject(flight, object);
    flight.objects.push(object);
    existing.add(id);
    admitted++;
    budget--;
  }
  if (!initialized) {
    state.initialPackSizes[packId] = admitted;
    if (profiled && admitted > 0) {
      (state.profiledPacks ??= {})[packId] = archetype;
    }
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

/**
 * The chunk's discovery caches on their template slots, clear of Ada, exclusion zones and landmark
 * charting ranges.
 */
function placeCaches(
  content: GameContent,
  cell: Vec,
  existing: Set<string>,
  flight: FlightState,
): void {
  const tuning = content.tuning.flight;
  const caches = planChunkCaches(CHUNK_CATALOG, {
    ...flightWorldContext(flight),
    clearance: tuning.shipRadius,
    field: byPosition(ASTEROID_FIELDS, flight.galaxy),
    galaxy: flight.galaxy,
    objectsPerChunk: tuning.objectsPerChunk,
    radius: tuning.rockRadius,
    seed: flight.seed,
    shapes: ASTEROID_SHAPE_LIST,
    shipRadius: tuning.shipRadius,
    size: content.tuning.chunkSize,
    spawnWeights: tuning.spawnWeights,
    x: cell.x,
    y: cell.y,
  });
  for (const cache of caches) {
    // Keep the child namespace so a retained older diamond prevents refill.
    const prefix = `${cache.id}:stardust:`;
    const object: SpaceObject = {
      amount: ECONOMY.discoveryStardust,
      hp: 1,
      id: discoveryStardustId(cache.id, 0),
      kind: "pickup",
      radius: stardustPickupReach(ECONOMY.stardustPickupRadius, ECONOMY.discoveryStardust),
      role: "stardust",
      x: cache.x,
      y: cache.y,
    };
    if (
      !existing.has(object.id) &&
      !flight.objects.some((candidate) => candidate.id.startsWith(prefix)) &&
      !Object.hasOwn(flight.world.notables, cache.id) &&
      !Object.hasOwn(flight.world.notables, object.id) &&
      clearOf(flight, content.tuning.exclusionRadius, flight.player, object) &&
      clearOfExclusionZones(content, object, flight) &&
      clearOfLandmarks(object, flight)
    ) {
      canonicalObject(flight, object);
      flight.objects.push(object);
      existing.add(object.id);
    }
  }
}

/**
 * The platform's hull never turns: Art draws it once, as heading 0, which faces world +x, so
 * its turret mounts and muzzles take heading 0 too.
 */
export const PLATFORM_FACING: Readonly<Vec> = { x: 1, y: 0 };

/**
 * Cartwheel's seeded ore fields whose centres fall in chunk (x, y): their rocks, ordinary
 * asteroids with their size's HP marked with `ORE_FIELD_ROLE` and Art's ore-field crystals, and,
 * at a guarded field, a retained platform facing `PLATFORM_FACING`. A field within the
 * ore-field clearance of a station, the hub or a quantum jump arrival is left out.
 */
function placeOreFields(
  content: GameContent,
  grid: WorldGrid,
  cell: Vec,
  existing: Set<string>,
  flight: FlightState,
): void {
  const center = worldCellCenter(grid, cell);
  for (const field of worldOreFieldsNear(grid, flight.galaxy, grid.pitch, center)) {
    const owner = worldCellAt(grid, field);
    if (owner.x !== cell.x || owner.y !== cell.y) {
      continue;
    }
    if (claimedOreFields.get(flight) !== field.id) {
      placeOreField(content, field, existing, flight);
    }
  }
}

const claimedOreFields = new WeakMap<FlightState, string>();

function placeOreField(
  content: GameContent,
  field: OreField,
  existing: Set<string>,
  flight: FlightState,
): void {
  const reach = ORE_FIELDS.clearance + ORE_FIELDS.diameter / 2;
  const hub = flight.objects.find((object) => object.kind === "destination" && object.id === "hub");
  if (
    worldStationsNear(flightStationContext(flight), ECONOMY, flight.galaxy, reach, field).length ||
    (hub && worldDistance(flightWorldContext(flight), hub, field) < reach) ||
    (flight.arrivals ?? []).some(
      (arrival) => worldDistance(flightWorldContext(flight), arrival, field) < reach,
    )
  ) {
    return;
  }
  const hp = byPosition(ASTEROID_FIELDS, flight.galaxy).hp;
  field.rocks.forEach((rock, index) => {
    const shape = ASTEROID_SHAPES.get(rock.asteroid)!;
    const object: SpaceObject = {
      ...rock,
      crystals: ASTEROID_ART.crystals.selection.oreField,
      hp: hp[shape.size],
      id: `${field.id}:${index}`,
      kind: "rock",
      radius: shape.radius,
      role: ORE_FIELD_ROLE,
    };
    if (
      !existing.has(object.id) &&
      !Object.hasOwn(flight.world.notables, object.id) &&
      clearOf(flight, content.tuning.exclusionRadius, flight.player, object) &&
      clearOfExclusionZones(content, object, flight) &&
      flight.objects.every(
        (other) =>
          other.kind !== "rock" ||
          worldDistance(flightWorldContext(flight), other, object) > other.radius + object.radius,
      )
    ) {
      canonicalObject(flight, object);
      flight.objects.push(object);
      existing.add(object.id);
    }
  });
  const id = `platform:${field.id}`;
  if (field.guard && !existing.has(id) && !Object.hasOwn(flight.world.notables, id)) {
    const platform = spawnEnemy(content, flight, "platform", id, field.guard);
    platform.enemy!.facing = { ...PLATFORM_FACING };
    flight.objects.push(platform);
    existing.add(id);
  }
}

/** Keep the reserved field out of normal static-rock admission during the named encounter. */
export function holdCartwheelClaimField(flight: FlightState, id: string): void {
  claimedOreFields.set(flight, id);
}

/** Publish the same static field through its usual generator if its chunk is already loaded. */
export function openCartwheelClaimField(
  content: GameContent,
  flight: FlightState,
  claim: { readonly fieldId: string; readonly fieldSite: Vec },
): void {
  claimedOreFields.delete(flight);
  const world = flightWorldContext(flight);
  const grid = periodicWorldGrid(world, content.tuning.chunkSize);
  if (!generatedChunks(flight).has(worldCellKey(grid, worldCellAt(grid, claim.fieldSite)))) {
    return;
  }
  const field = worldOreFieldsNear(world, flight.galaxy, 1, claim.fieldSite).find(
    ({ id }) => id === claim.fieldId,
  );
  if (field) {
    placeOreField(content, field, new Set(flight.objects.map(({ id }) => id)), flight);
  }
}

function combat(flight: FlightState) {
  return (flight.combat ??= { initialPackSizes: {}, routeEncounters: [] });
}

export function placeExplorationSite(
  content: GameContent,
  flight: FlightState,
  options: {
    admitted: Readonly<Record<string, unknown>>;
    protectedSites: readonly Vec[];
    inRegion: (point: Vec) => boolean;
    opportunityEligibility: ProceduralPoiOpportunityEligibility;
    canPostLead: (site: ProceduralPoi) => boolean;
  },
): ProceduralPoi | undefined {
  const world = flightWorldContext(flight);
  if (world.worldSide === undefined) {
    return undefined;
  }
  const stationContext = flightStationContext(flight);
  const sites = proceduralPoisNear(
    {
      ...world,
      isProtected: (point, clearance) =>
        !options.inRegion(point) ||
        options.protectedSites.some(
          (site) => worldDistance(world, point, site) < clearance + content.tuning.exclusionRadius,
        ) ||
        !requiredFootprintClear(content, flight, { center: point, radius: clearance }) ||
        worldStationsNear(
          stationContext,
          ECONOMY,
          flight.galaxy,
          clearance + ECONOMY.station.exclusionRadius,
          point,
        ).length > 0 ||
        stationPopulationObjects(flight).some((object) => {
          const radius = exclusionZoneRadius(content, object);
          return radius !== null && worldDistance(world, object, point) < radius + clearance;
        }) ||
        landmarkSites(flight.galaxy).some(
          (site) => worldDistance(world, site, point) < LANDMARK_TUNING.spacing,
        ),
      opportunityEligibility: options.opportunityEligibility,
    },
    flight.galaxy,
    flight.seed,
    TARGET_MARKER_RANGE,
    flight.player,
  );
  for (const site of sites) {
    if (
      Object.hasOwn(options.admitted, site.id) ||
      (site.opportunity.kind === "job" && !options.canPostLead(site))
    ) {
      continue;
    }
    if (site.opportunity.kind === "salvage") {
      const id = `${site.id}:salvage`;
      // Planned chunks keep enemy groups out of the wreck's neighbourhood and rocks off its hull.
      const wreck = spawnEnemy(content, flight, "frigate", id, { x: site.x, y: site.y });
      if (
        !clearOfExclusionZones(content, wreck, flight) ||
        !stationFormationClear(questGuardPlacementContext(content, flight), [wreck])
      ) {
        continue;
      }
      wreck.enemy!.disabled = true;
      flight.objects.push(wreck);
      worldSyncFlightRegion(world, content, flight);
    }
    return site;
  }
  return undefined;
}

/** Place Hammer off the completed trade circuit, beyond its pursuit and perception reach. */
export function placeSunflowerCapitalBoss(
  content: GameContent,
  flight: FlightState,
  route: readonly [Vec, Vec, Vec],
): Vec | null {
  const [growers, workshop, salvagers] = route;
  const world = flightWorldContext(flight);
  const leg = worldDelta(world, workshop, salvagers);
  const midpoint = { x: workshop.x + leg.x / 2, y: workshop.y + leg.y / 2 };
  const hull = spawnEnemy(content, flight, "capital", SUNFLOWER_CAPITAL_BOSS.id, midpoint);
  const definition = enemyEquipmentDefinition(flight.galaxy, hull.enemy!);
  const distance = definition.perception + definition.pursuit.homeRadius + hull.radius;
  const heading = Math.atan2(leg.y, leg.x) + Math.PI / 2;
  const legs = [
    [FLIGHT_START, growers],
    [growers, workshop],
    [workshop, salvagers],
  ] as const;
  const nearby = stationPopulationObjects(flight);
  for (const reach of [distance * 1.25, TARGET_MARKER_RANGE]) {
    for (let index = 0; index < 8; index++) {
      const angle = heading + (index * Math.PI) / 4;
      const point = {
        x: midpoint.x + Math.cos(angle) * reach,
        y: midpoint.y + Math.sin(angle) * reach,
      };
      if (
        legs.some(
          ([from, to]) =>
            segmentDistance(worldPoint(world, from, point), from, worldPoint(world, from, to)) <
            distance,
        ) ||
        worldStationsNear(
          flightStationContext(flight),
          ECONOMY,
          flight.galaxy,
          ECONOMY.station.exclusionRadius + hull.radius,
          point,
        ).length > 0
      ) {
        continue;
      }
      const towardRoute = worldDelta(world, point, midpoint);
      const offset = hull.radius + content.tuning.talkRange;
      const site = {
        x: point.x + (towardRoute.x * offset) / reach,
        y: point.y + (towardRoute.y * offset) / reach,
      };
      canonicalPosition(flight, site);
      const cache = sunflowerBossCache(content, site);
      const actor = spawnEnemy(content, flight, "capital", SUNFLOWER_CAPITAL_BOSS.id, point);
      canonicalObject(flight, actor);
      if (
        nearby.some(
          (other) =>
            capital(other) && worldDistance(world, actor, other) < enemySpacing(actor, other),
        ) ||
        !clearOfExclusionZones(content, actor, flight) ||
        !clearOfExclusionZones(content, cache, flight) ||
        nearby.some((other) => other.hp > 0 && !clearOf(flight, other.radius, other, cache)) ||
        !stationFormationClear(questGuardPlacementContext(content, flight), [actor])
      ) {
        continue;
      }
      actor.persistent = true;
      flight.objects.push(actor);
      worldSyncFlightRegion(world, content, flight);
      return site;
    }
  }
  return null;
}

/** Admit the optional Crossbow in clear current-world space, keeping the Eye route untouched. */
export function placeNeedleCadence(
  content: GameContent,
  flight: FlightState,
  selectSite: (placement: NeedleCadencePlacement) => Vec | null,
): Vec | null {
  const world = flightWorldContext(flight);
  const actor = spawnEnemy(content, flight, "capital", NEEDLE_CADENCE.id, flight.player);
  actor.persistent = true;
  const definition = enemyEquipmentDefinition(flight.galaxy, actor.enemy!);
  const placement = questGuardPlacementContext(content, flight);
  const hullReach = questGuardFormationReach(placement, [actor]);
  const site = selectSite({
    canPlace: (point) => {
      Object.assign(actor, point);
      actor.enemy!.home = { ...point };
      actor.enemy!.position = { ...point };
      canonicalObject(flight, actor);
      return (
        clearOfExclusionZones(content, actor, flight) &&
        worldStationsNear(
          flightStationContext(flight),
          ECONOMY,
          flight.galaxy,
          ECONOMY.station.exclusionRadius + hullReach,
          actor,
        ).length === 0 &&
        !stationPopulationObjects(flight).some(
          (other) =>
            capital(other) && worldDistance(world, other, actor) < enemySpacing(actor, other),
        ) &&
        stationFormationClear(placement, [actor])
      );
    },
    hullReach,
    perception: definition.perception,
    pursuitRadius: actorPursuitHomeRadius(
      flight.galaxy,
      definition.pursuit.homeRadius,
      false,
      actor,
    ),
  });
  if (!site) {
    return null;
  }
  flight.objects.push(actor);
  worldSyncFlightRegion(world, content, flight);
  return { x: actor.x, y: actor.y };
}

const andromedaRelaySites = new WeakMap<FlightState, readonly SpaceObject[]>();

export function reserveAndromedaRelaySite(flight: FlightState, point: Vec): void {
  if (!andromedaRelaySites.has(flight)) {
    andromedaRelaySites.set(flight, [
      { ...point, hp: 1, id: ANDROMEDA_REDACT.relayId, kind: "destination", radius: 30 },
    ]);
  }
}

/** Find a clear pair outside Pip's routes without publishing them or clearing scenery. */
export function planRedactEncounter(
  placement: StationPlacementContext,
  otherStops: readonly string[],
): { readonly site: Vec; readonly relay: Vec } | null {
  const { content, flight } = placement;
  const world = flightWorldContext(flight);
  const population = stationPopulationObjects(flight);
  const beacon = population.find(({ id }) => id === ANDROMEDA_PLACES.beacon);
  const pip = population.find(({ id }) => id === ANDROMEDA_PLACES.pip);
  if (!beacon || !pip) {
    return null;
  }
  const actor = spawnEnemy(content, flight, "capital", ANDROMEDA_REDACT.id, beacon);
  actor.persistent = true;
  const definition = enemyEquipmentDefinition(flight.galaxy, actor.enemy!);
  const reach = questGuardFormationReach(placement, [actor]);
  const clearance =
    reach +
    definition.perception +
    actorPursuitHomeRadius(flight.galaxy, definition.pursuit.homeRadius, false, actor);
  const directionToPip = worldDelta(world, beacon, pip);
  const heading = Math.atan2(directionToPip.y, directionToPip.x);
  const routes = [pip, FLIGHT_START, ...population.filter(({ id }) => otherStops.includes(id))];
  for (const span of [clearance * 1.25, clearance * 1.65]) {
    for (let spoke = 0; spoke < 8; spoke++) {
      const angle = heading + Math.PI / 2 + (spoke * Math.PI) / 4;
      const offset = { x: Math.cos(angle), y: Math.sin(angle) };
      const at = (distance: number) => ({
        x: beacon.x + offset.x * distance,
        y: beacon.y + offset.y * distance,
      });
      const site = at(span);
      const relay = at(span + content.tuning.storySpacing);
      canonicalPosition(flight, site);
      canonicalPosition(flight, relay);
      Object.assign(actor, site);
      if (
        routes.some(
          (to) =>
            segmentDistance(
              worldPoint(world, beacon, site),
              beacon,
              worldPoint(world, beacon, to),
            ) <= clearance,
        ) ||
        !clearOfExclusionZones(content, actor, flight) ||
        worldStationsNear(
          flightStationContext(flight),
          ECONOMY,
          flight.galaxy,
          ECONOMY.station.exclusionRadius + reach,
          site,
        ).length > 0 ||
        settlementsNear(ECONOMY, content.tuning.exclusionRadius + reach, site).length > 0 ||
        population.some(
          (other) =>
            capital(other) && worldDistance(world, other, site) < enemySpacing(actor, other),
        ) ||
        !stationFormationClear(placement, [actor]) ||
        !destinationClear(content, flight, relay) ||
        settlementsNear(ECONOMY, content.tuning.storySpacing, relay).length > 0 ||
        !requiredFootprintClear(content, flight, {
          center: relay,
          radius: content.tuning.exclusionRadius,
        }) ||
        population.some(
          (other) => other.hp > 0 && !clearOf(flight, content.tuning.exclusionRadius, relay, other),
        )
      ) {
        continue;
      }
      return { relay, site };
    }
  }
  return null;
}

export function admitRedactEncounter(
  content: GameContent,
  flight: FlightState,
  site: Vec,
  relay: Vec,
): void {
  const actor = spawnEnemy(content, flight, "capital", ANDROMEDA_REDACT.id, site);
  actor.persistent = true;
  reserveAndromedaRelaySite(flight, relay);
  flight.objects.push(actor);
  worldSyncFlightRegion(flightWorldContext(flight), content, flight);
}

/** Select an untouched canonical field and admit one carrier outside its rock layout. */
export function placeCartwheelClaim(
  content: GameContent,
  flight: FlightState,
  hub: Vec,
): { readonly fieldId: string; readonly fieldSite: Vec; readonly site: Vec } | null {
  const world = flightWorldContext(flight);
  const grid = periodicWorldGrid(world, content.tuning.chunkSize);
  const actor = spawnEnemy(content, flight, "capital", CARTWHEEL_CLAIM.id, hub);
  actor.persistent = true;
  const definition = enemyEquipmentDefinition(flight.galaxy, actor.enemy!);
  const placement = questGuardPlacementContext(content, flight);
  const reach = questGuardFormationReach(placement, [actor]);
  const fieldOffset = ORE_FIELDS.diameter / 2 + ORE_FIELDS.guardGap + reach;
  const occupants = stationPopulationObjects(flight);
  const field = selectCartwheelClaimField({
    ...flightStationContext(flight),
    ...placement,
    canPlace: (candidate) => {
      const owner = worldCellAt(grid, candidate);
      const previouslyApproached = Array.from(
        worldCellsNear(grid, grid.pitch * 2, worldCellCenter(grid, owner)),
      ).some((cell) => visitedChunk(flight.visited, worldCellKey(grid, cell)));
      if (generatedChunks(flight).has(worldCellKey(grid, owner)) || previouslyApproached) {
        return false;
      }
      const offset = worldDelta(world, hub, candidate);
      const heading = Math.atan2(offset.y, offset.x);
      for (let spoke = 0; spoke < 8; spoke++) {
        const angle = heading + (spoke * Math.PI) / 4;
        Object.assign(actor, {
          x: candidate.x + Math.cos(angle) * fieldOffset,
          y: candidate.y + Math.sin(angle) * fieldOffset,
        });
        canonicalPosition(flight, actor);
        if (
          clearOfExclusionZones(content, actor, flight) &&
          worldStationsNear(
            flightStationContext(flight),
            ECONOMY,
            flight.galaxy,
            ECONOMY.station.exclusionRadius + reach,
            actor,
          ).length === 0 &&
          !occupants.some(
            (other) =>
              capital(other) && worldDistance(world, other, actor) < enemySpacing(actor, other),
          ) &&
          stationFormationClear(placement, [actor])
        ) {
          return true;
        }
      }
      return false;
    },
    combatClearance:
      fieldOffset +
      reach +
      definition.perception +
      actorPursuitHomeRadius(flight.galaxy, definition.pursuit.homeRadius, false, actor),
    flightStart: FLIGHT_START,
    hub,
  });
  if (!field) {
    return null;
  }
  const site = { x: actor.x, y: actor.y };
  actor.enemy!.home = { ...site };
  actor.enemy!.position = { ...site };
  holdCartwheelClaimField(flight, field.id);
  flight.objects.push(actor);
  worldSyncFlightRegion(world, content, flight);
  return { fieldId: field.id, fieldSite: { x: field.x, y: field.y }, site };
}

/** The repair cache is a single ordinary Ore pickup with a durable encounter identity. */
export function sunflowerBossCache(content: GameContent, site: Vec): SpaceObject {
  return {
    ...site,
    hp: 1,
    id: SUNFLOWER_CAPITAL_BOSS.cacheId,
    kind: "pickup",
    persistent: true,
    radius: content.tuning.flight.pieceRadius,
    role: "cargo",
  };
}

/** A new enemy with its galaxy's archetype changes, hit points and hardpoints. */
function spawnEnemy(
  content: GameContent,
  flight: FlightState,
  archetype: EnemyActorKind,
  id: string,
  point: Vec,
  packId: string | null = null,
  phase = 0,
  escortOf: string | null = null,
  hullProfile?: HeavyHullProfile,
): SpaceObject {
  const weaponLevel = rollEnemyWeaponLevel(
    { encounterSeed: flightEncounterSeed(flight), galaxy: flight.galaxy },
    id,
  );
  const definition = enemyActorDefinition(flight.galaxy, archetype, id, weaponLevel, hullProfile);
  const enemy = createEnemy(
    definition,
    {
      archetype,
      escortOf,
      ...(hullProfile === undefined ? {} : { hullProfile }),
      id,
      packId,
      phase,
      weaponLevel,
    },
    point,
  );
  return {
    ...point,
    enemy,
    hp: definition.hp,
    id,
    kind: "enemy",
    radius: enemyRadiusForFlight(
      flight,
      enemy,
      content.tuning.flight.shipRadius * definition.sizeRatio,
    ),
  };
}

function enemyRadiusForFlight(flight: FlightState, enemy: EnemyState, radius: number): number {
  if (enemy.archetype !== "hostileStation" || flight.galaxy === 2) {
    return radius;
  }
  const body = enemyPhysicalBody(ROUTE_POSITION[flight.galaxy], enemy);
  return body ? Math.max(radius, partsReach(worldParts(body))) : radius;
}

/** Canonical scenery and arrivals for read-only guard planning and explicit formation admission. */
export function questGuardPlacementContext(content: GameContent, flight: FlightState) {
  return {
    arrivals: arrivalPoints(flight),
    content,
    drawnOf: (object: SpaceObject) => drawnOf(flight, object),
    flight,
    frameOf: (object: SpaceObject) => frameOf(flight, object),
  };
}

/** Detached templates resolve the same canonical levels and identities without consuming shared draws. */
function questFrigateFormation(
  content: GameContent,
  flight: FlightState,
  id: string,
  siteId: string,
  point: Vec,
  supportCount = FRIGATE_ESCORT_COUNT,
) {
  const leader = spawnEnemy(content, flight, "frigate", id, { x: point.x, y: point.y });
  leader.routeId = siteId;
  leader.persistent = true;
  const followers = createFrigateEscorts(
    {
      encounterSeed: flightEncounterSeed(flight),
      galaxy: flight.galaxy,
      id: (index) => requiredFrigateEscortId(id, index),
      packId: escortPackId(id),
      persistent: true,
      shipRadius: content.tuning.flight.shipRadius,
    },
    leader,
  ).slice(0, supportCount);
  return { followers, leader };
}

/** Read-only local selection for a newly authored formation, independent of Ada and random streams. */
export function questFrigateHome(
  content: GameContent,
  flight: FlightState,
  id: string,
  siteId: string,
  supportCount = FRIGATE_ESCORT_COUNT,
): Vec | null {
  const context = questGuardPlacementContext(content, flight);
  const site = questGuardHomePorts(context).resolveSite(flight, siteId);
  if (!site) {
    return null;
  }
  const { followers, leader } = questFrigateFormation(
    content,
    flight,
    id,
    siteId,
    site,
    supportCount,
  );
  return questGuardHomePorts({
    ...context,
    flight: { ...flight, objects: [...flight.objects, ...followers] },
  }).recoveryHome(flightWorldContext(flight), site, leader);
}

/** An explicit local quest formation is appended atomically, without clearing any scenery. */
export function spawnQuestFrigateAt(
  content: GameContent,
  flight: FlightState,
  id: string,
  siteId: string,
  point: Vec,
  supportCount = FRIGATE_ESCORT_COUNT,
): SpaceObject | null {
  if (!Number.isInteger(supportCount) || supportCount < 0 || supportCount > FRIGATE_ESCORT_COUNT) {
    return null;
  }
  const represented = stationPopulationObjects(flight);
  const existing = represented.find((object) => object.id === id);
  if (existing) {
    return existing.enemy?.archetype === "frigate" && existing.routeId === siteId ? existing : null;
  }
  if (Object.hasOwn(flight.world.notables, id)) {
    return null;
  }
  const context = questGuardPlacementContext(content, flight);
  const ports = questGuardHomePorts(context);
  const site = ports.resolveSite(flight, siteId);
  if (!site) {
    return null;
  }
  const { followers, leader } = questFrigateFormation(
    content,
    flight,
    id,
    siteId,
    point,
    supportCount,
  );
  const packId = escortPackId(id);
  if (
    followers.some(
      (actor) =>
        represented.some((other) => other.id === actor.id) ||
        Object.hasOwn(flight.world.notables, actor.id),
    )
  ) {
    return null;
  }
  const planFlight = { ...flight, objects: [...flight.objects, ...followers] };
  const plannedPorts = questGuardHomePorts({ ...context, flight: planFlight });
  if (!plannedPorts.validHome(flightWorldContext(flight), site, leader, point)) {
    return null;
  }
  const actors = [leader, ...followers];
  const policy = SPAWNER_POLICIES[flight.galaxy];
  const world = hostileStationContext(flight);
  if (
    !worldFitsEncounter(
      world,
      policy,
      worldSpawnerStage(world, policy, point),
      ROUTE_POSITION[flight.galaxy],
      represented,
      point,
      {
        archetype: "frigate",
        count: 1,
        ...(supportCount
          ? { escorts: { archetype: "fighter" as const, count: supportCount } }
          : {}),
      },
      questGuardFormationReach(context, actors),
    ) ||
    !stationFormationClear(context, actors)
  ) {
    return null;
  }
  actors.forEach((actor) => canonicalObject(flight, actor));
  flight.objects.push(...actors);
  combat(flight).initialPackSizes[packId] = followers.length;
  return leader;
}

export interface RequiredFrigatePlan {
  readonly siteId: string;
  readonly leader: SpaceObject;
  readonly support: readonly SpaceObject[];
}

/** Required leaders are never optional; only their support uses the remaining local budget. */
export function planRequiredFrigate(
  content: GameContent,
  flight: FlightState,
  id: string,
  siteId: string,
  maxSupport = FRIGATE_ESCORT_COUNT,
): RequiredFrigatePlan | null {
  for (let count = maxSupport; count >= 0; count--) {
    const home = questFrigateHome(content, flight, id, siteId, count);
    if (!home) {
      continue;
    }
    const projection = structuredClone(flight);
    const leader = spawnQuestFrigateAt(content, projection, id, siteId, home, count);
    if (leader) {
      return {
        leader,
        siteId,
        support: stationPopulationObjects(projection).filter(
          (actor) => actor.enemy?.escortOf === leader.id,
        ),
      };
    }
  }
  return null;
}

export type RequiredRoutePlanningResult =
  | { readonly status: "blocked"; readonly siteId: string }
  | {
      readonly status: "planned";
      readonly plans: readonly RequiredFrigatePlan[];
      readonly sites: readonly SpaceObject[];
    };

/** Reserve every required leader before allocating support; planning changes no knowledge or world state. */
export function planRequiredRouteReservations(
  content: GameContent,
  flight: FlightState,
  sites: readonly SpaceObject[],
): RequiredRoutePlanningResult {
  const projection = structuredClone(flight);
  for (const site of sites) {
    if (!projection.objects.some((actor) => actor.id === site.id)) {
      projection.objects.push(structuredClone(site));
    }
  }
  const plans: RequiredFrigatePlan[] = [];
  for (const site of sites) {
    const plan = planRequiredFrigate(content, projection, `route:${site.id}`, site.id, 0);
    if (!plan) {
      return { siteId: site.id, status: "blocked" };
    }
    projection.objects.push(plan.leader);
    plans.push(plan);
  }
  for (const [index, reserved] of plans.entries()) {
    const withoutLeader = {
      ...projection,
      objects: projection.objects.filter((actor) => actor.id !== reserved.leader.id),
    };
    const plan = planRequiredFrigate(content, withoutLeader, reserved.leader.id, reserved.siteId);
    if (plan) {
      plans[index] = plan;
      projection.objects = [...withoutLeader.objects, plan.leader, ...plan.support];
    }
  }
  return { plans, sites: structuredClone(sites), status: "planned" };
}

/** Existing destination placement runs before optional chunks, on a detached planning flight. */
export function planRequiredWorld(
  content: GameContent,
  flight: FlightState,
  siteIds: readonly string[],
  rememberedSites: Readonly<Record<string, Vec>> = {},
): RequiredRoutePlanningResult {
  const projection = structuredClone(flight);
  planningRequiredWorld.add(projection);
  try {
    const sites = siteIds.map((id) => {
      const point = rememberedSites[id];
      return point
        ? ensureDestinationAt(content, id, point, projection)
        : ensureDestination(content, id, projection);
    });
    return planRequiredRouteReservations(content, projection, sites);
  } finally {
    planningRequiredWorld.delete(projection);
  }
}

export type RequiredRouteActivation =
  | { readonly status: "created" | "existing"; readonly guard: SpaceObject }
  | { readonly status: "resolved" | "blocked" | "unplanned" };

/** Existing authored eligibility activates exact reserved actors, with no reward or discovery mutation. */
export function activateRequiredRoute(
  content: GameContent,
  siteId: string,
  flight: FlightState,
): RequiredRouteActivation {
  const evidence = routeGuardEvidence(flight, siteId);
  if (evidence.status === "admitted") {
    return { guard: evidence.guard, status: "existing" };
  }
  if (evidence.status === "resolved") {
    return { status: "resolved" };
  }
  if (evidence.admissionRecorded) {
    return { status: "unplanned" };
  }
  const reservations = pendingRequiredRoutes(flight);
  const group = reservations.filter(({ site }) => site.id === siteId);
  const leader = group.find(
    ({ guard }) => guard.routeId === siteId && guard.enemy?.archetype === "frigate",
  );
  if (!leader) {
    return { status: "unplanned" };
  }
  const support = group.filter(({ guard }) => guard.enemy?.escortOf === leader.guard.id);
  if (group.length !== support.length + 1 || support.length > FRIGATE_ESCORT_COUNT) {
    return { status: "blocked" };
  }
  const actual = stationPopulationObjects(flight);
  const site = actual.find((object) => object.id === siteId);
  if (
    (Object.hasOwn(flight.world.notables, siteId) && flight.world.notables[siteId] === null) ||
    (site &&
      (site.kind !== leader.site.kind ||
        worldDistance(flightWorldContext(flight), site, leader.site) !== 0))
  ) {
    return { status: "blocked" };
  }
  const actors = [leader, ...support].map(({ guard }) => guard);
  if (
    actors.some(
      (actor) =>
        actual.some((other) => other.id === actor.id) ||
        Object.hasOwn(flight.world.notables, actor.id),
    )
  ) {
    return { status: "blocked" };
  }
  const otherReservations = reservations.filter(({ site }) => site.id !== siteId);
  const population = requiredWorldPopulation(flight, otherReservations);
  const projection = {
    ...flight,
    objects: [...population, ...reservations.map(({ site }) => site)],
  };
  const context = questGuardPlacementContext(content, projection);
  const policy = SPAWNER_POLICIES[flight.galaxy];
  if (
    !stationFormationClear(context, actors) ||
    !worldFitsEncounter(
      hostileStationContext(flight),
      policy,
      worldSpawnerStage(flightWorldContext(flight), policy, leader.guard),
      ROUTE_POSITION[flight.galaxy],
      population,
      leader.guard,
      {
        archetype: "frigate",
        count: 1,
        ...(support.length
          ? { escorts: { archetype: "fighter" as const, count: support.length } }
          : {}),
      },
      questGuardFormationReach(context, actors),
    )
  ) {
    return { status: "blocked" };
  }
  const transferred = takeRequiredPlan(flight, siteId);
  if (!transferred) {
    return { status: "unplanned" };
  }
  if (!site) {
    const destination = transferred.site;
    canonicalObject(flight, destination);
    flight.objects.push(destination);
  }
  actors.forEach((actor) => canonicalObject(flight, actor));
  flight.objects.push(...actors);
  const state = combat(flight);
  state.routeEncounters.push(siteId);
  state.initialPackSizes[escortPackId(leader.guard.id)] = support.length;
  return { guard: actors.find((actor) => actor.id === leader.guard.id)!, status: "created" };
}

/** Caller-supplied station plans have no implicit site, defender count, reward or replenishment. */
export function spawnPlannedHostileStation(
  content: GameContent,
  flight: FlightState,
  plan: PlannedHostileStation,
): StationMaterialization {
  const reservations = pendingRequiredRoutes(flight);
  const population = requiredPopulation(flight);
  const placement = {
    ...flight,
    objects: [
      ...population,
      ...reservations.map(({ site }) => site),
      ...phantomFutureFlagshipGeometry(content, flight),
    ],
  };
  return materializeHostileStation(
    {
      canPlace: (actors) =>
        stationFormationClear(
          {
            arrivals: arrivalPoints(flight),
            content,
            drawnOf: (object) => drawnOf(flight, object),
            flight: placement,
            frameOf: (object) => frameOf(flight, object),
          },
          actors,
        ),
      content,
      create: (kind, actor, packId) => {
        const object = spawnEnemy(content, flight, kind, actor.id, actor.point, packId);
        canonicalObject(flight, object);
        return object;
      },
      flight,
      population,
    },
    plan,
  );
}

function activateFrigateEscorts(
  content: GameContent,
  flight: FlightState,
  leader: SpaceObject,
): void {
  if (leader.enemy?.archetype !== "frigate") {
    return;
  }
  for (let index = 0; index < FRIGATE_ESCORT_COUNT; index++) {
    const retained = flight.world.notables[requiredFrigateEscortId(leader.id, index)];
    if (retained) {
      worldActivateFlightRegion(flightWorldContext(flight), content, retained, flight);
    }
  }
}

function installFrigateEscorts(
  content: GameContent,
  flight: FlightState,
  leader: SpaceObject,
): void {
  if (leader.enemy?.archetype !== "frigate") {
    return;
  }
  const packId = escortPackId(leader.enemy.packId ?? leader.id);
  const followers = createFrigateEscorts(
    {
      encounterSeed: flightEncounterSeed(flight),
      galaxy: flight.galaxy,
      id: (index) => requiredFrigateEscortId(leader.id, index),
      packId,
      persistent: true,
      shipRadius: content.tuning.flight.shipRadius,
    },
    leader,
  );
  for (const follower of followers) {
    clearLayoutObjects(
      (other) => other.kind === "destination" || clearOf(flight, follower.radius, follower, other),
      flight,
    );
    canonicalObject(flight, follower);
    flight.objects.push(follower);
  }
  const sizes = combat(flight).initialPackSizes;
  sizes[packId] = (sizes[packId] ?? 0) + followers.length;
}

/** A required chapter encounter uses canonical enemy state and persists beyond the active region. */
export function spawnChapterEnemy(
  content: GameContent,
  archetype: EnemyArchetype,
  id: string,
  point: Vec,
  flight: FlightState,
  options: {
    /** A placement that must fit without clearing any existing world objects. */
    admit?: (actor: SpaceObject) => boolean;
    packId?: string;
    escortOf?: string;
    home?: Vec;
    routeId?: string;
  } = {},
): SpaceObject | null {
  if (Object.hasOwn(flight.world.notables, id)) {
    const retained = flight.world.notables[id];
    if (!retained) {
      return null;
    }
    worldActivateFlightRegion(flightWorldContext(flight), content, retained, flight);
  }
  worldActivateFlightRegion(flightWorldContext(flight), content, point, flight);
  const existing = flight.objects.find((object) => object.id === id);
  if (existing) {
    activateFrigateEscorts(content, flight, existing);
    return existing.kind === "enemy" ? existing : null;
  }
  const object = spawnEnemy(
    content,
    flight,
    archetype,
    id,
    point,
    options.packId ?? null,
    0,
    options.escortOf ?? null,
  );
  object.persistent = true;
  if (options.routeId !== undefined) {
    object.routeId = options.routeId;
  }
  if (options.home) {
    object.enemy!.home = { ...options.home };
  }
  if (options.admit) {
    if (!options.admit(object)) {
      return null;
    }
  } else {
    clearLayoutObjects(
      (other) => other.kind === "destination" || clearOf(flight, object.radius, object, other),
      flight,
    );
  }
  canonicalObject(flight, object);
  flight.objects.push(object);
  if (options.packId) {
    const sizes = combat(flight).initialPackSizes;
    sizes[options.packId] = (sizes[options.packId] ?? 0) + 1;
  }
  installFrigateEscorts(content, flight, object);
  return object;
}

/** Ships too heavy to drift with a current, and the fixed platform. */
const DRIFT_PROOF: readonly EnemyActorKind[] = ["frigate", "capital", "platform", "hostileStation"];

/** Flight starts and Travel arrivals, which encounters keep clear of. */
function arrivalPoints(flight: FlightState): Vec[] {
  return [FLIGHT_START, ...(flight.arrivals ?? [])];
}
const FLIGHT_START: Vec = { x: 0, y: 0 };

/** Layout clearance changes the roster without recording a combat casualty. */
function clearLayoutObjects(keep: (object: SpaceObject) => boolean, flight: FlightState): void {
  flight.objects = flight.objects.filter((object) => {
    if (keep(object) || persistentObject(object)) {
      return true;
    }
    recordUnloadedPackMember(object, flight);
    return false;
  });
  worldPrunePackState(flightWorldContext(flight), flight);
}

/**
 * A capital that holds the spacing between capitals: live, not destroyed and not salvaged. A
 * salvaged hulk stays where Ada left it (gameplay/ships.md "State").
 */
function capital(object: SpaceObject): boolean {
  return (
    object.kind === "enemy" &&
    object.hp > 0 &&
    object.enemy?.archetype === "capital" &&
    !enemyDefeated(object.enemy) &&
    !object.enemy.salvaged
  );
}

/**
 * How far a ship's drawn hull reaches from its position on screen: at its own heading, or at
 * any heading for a ship that may turn. Without Art's outline, twice its hit radius.
 */
function hullReach(object: SpaceObject, anyHeading: boolean): number {
  const enemy = object.enemy;
  const facings = anyHeading
    ? Array.from({ length: 16 }, (_, index) => ({
        x: Math.cos((index * Math.PI) / 8),
        y: Math.sin((index * Math.PI) / 8),
      }))
    : [enemy?.facing ?? { x: 1, y: 0 }];
  let reach = 0;
  for (const facing of facings) {
    const hull = enemy ? enemyHull({ ...enemy, facing }) : null;
    if (!hull) {
      return object.radius * 2;
    }
    for (const point of hull.flat()) {
      reach = Math.max(reach, Math.hypot(point.x, point.y));
    }
  }
  return reach;
}

/** Whether a ship placed at `point` would overlap a salvaged hulk's drawn hull on screen. */
function overlapsHulk(
  flight: FlightState,
  guard: SpaceObject,
  point: Vec,
  hulk: SpaceObject,
): boolean {
  const { x: dx, y: dy } = worldDelta(flightWorldContext(flight), hulk, point);
  // The play view's isometric projection of the world offset, in screen px.
  const apart = Math.hypot(dx - dy, (dx + dy) / 2);
  return apart < hullReach(guard, true) + hullReach(hulk, false);
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
function settleResumedCapitals(content: GameContent, flight: FlightState): void {
  const kept: SpaceObject[] = [];
  const displaced: SpaceObject[] = [];
  for (const object of flight.objects.filter(capital)) {
    const crowded = kept.some(
      (other) =>
        worldDistance(flightWorldContext(flight), object, other) < enemySpacing(object, other),
    );
    (crowded ? displaced : kept).push(object);
  }
  // Kept capitals are fixed obstacles, so each displaced capital fails reservation and searches.
  if (displaced.length) {
    placeGuards(content, displaced, flight);
  }
}

function relocateRouteGuards(content: GameContent, flight: FlightState): void {
  placeGuards(
    content,
    flight.objects.filter(
      (object) =>
        object.kind === "enemy" &&
        persistentObject(object) &&
        object.hp > 0 &&
        (!object.enemy || (!enemyDefeated(object.enemy) && !object.enemy.salvaged)),
    ),
    flight,
  );
}

/** Plan all guard positions before applying layout changes to their persistent state. */
function placeGuards(content: GameContent, guards: SpaceObject[], flight: FlightState): void {
  const destinations = flight.objects.filter(
    (object) => exclusionZoneRadius(content, object) !== null,
  );
  const positions = new Map<SpaceObject, Vec>();
  const maxRadius = flight.objects.reduce(
    (radius, object) => Math.max(radius, object.radius),
    content.tuning.exclusionRadius,
  );
  const guardSet = new Set(guards);
  // A capital ignores unplaced capital guards; each of those is placed against it afterward.
  const blocked = (guard: SpaceObject, point: Vec): boolean =>
    destinations.some(
      (object) =>
        worldDistance(flightWorldContext(flight), object, point) <
        (exclusionZoneRadius(content, object) ?? 0) + guard.radius + 120,
    ) ||
    flight.objects.some(
      (object) =>
        object !== guard &&
        !(capital(guard) && capital(object) && guardSet.has(object) && !positions.has(object)) &&
        ["enemy", "rock", "debris"].includes(object.kind) &&
        object.hp > 0 &&
        // A salvaged hulk keeps no spacing, but nothing settles onto its drawn hull.
        (object.enemy?.salvaged
          ? overlapsHulk(flight, guard, point, object)
          : worldDistance(flightWorldContext(flight), positions.get(object) ?? object, point) <
            Math.max(object.radius + guard.radius + 20, enemySpacing(guard, object))),
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

/** Exact route-frigate identity also covers surviving followers without copying route IDs. */
function localGuardMember(flight: FlightState, guard: SpaceObject): boolean {
  const leader = guard.enemy?.escortOf
    ? (flight.objects.find((object) => object.id === guard.enemy!.escortOf) ??
      flight.world.notables[guard.enemy.escortOf])
    : guard;
  return leader?.enemy?.archetype === "frigate" && leader.routeId !== undefined;
}

function clearLocalGuardSummons(admitEnemy: FlightInput["admitEnemy"], flight: FlightState): void {
  if (!flight.summonedGuards) {
    return;
  }
  flight.summonedGuards = flight.summonedGuards.filter((id) => {
    const guard = flight.objects.find((object) => object.id === id) ?? flight.world.notables[id];
    return (
      guard == null || (!localGuardMember(flight, guard) && admitEnemy?.(flight, guard) !== false)
    );
  });
  if (!flight.summonedGuards.length) {
    delete flight.summonedGuards;
  }
}

/** Navigation accepts canonical geometry validity but never selects or applies a home. */
function guardPatrolFrame(
  content: GameContent,
  flight: FlightState,
  guard: SpaceObject,
): StationGuardAnchor | undefined {
  if (guard.enemy?.archetype !== "frigate" || guard.routeId === undefined) {
    return undefined;
  }
  const context = questGuardPlacementContext(content, flight);
  const ports = questGuardHomePorts(context);
  const site = ports.resolveSite(flight, guard.routeId);
  const world = flightWorldContext(flight);
  if (!site || !ports.validHome(world, site, guard, guard.enemy.home)) {
    return undefined;
  }
  const anchor = questGuardAnchor(context, guard);
  return anchor ? { ...anchor, center: worldPoint(world, guard, anchor.center) } : undefined;
}

/** Whether a ship is at rest: no orbit and no velocity. */
const atRest = (object: SpaceObject): boolean =>
  !object.orbit && !(object.velocity && (object.velocity.x || object.velocity.y));

/** The loop samples a miner checks for exclusion zones and the Needle channel. */
const MINER_LOOP_SAMPLES = 16;

/**
 * A Mining Freighter's runtime facts (gameplay/ships.md "Miners"): its traced rock's edge while
 * that rock is live and at rest, and, when it picks, the rocks that qualify. A rock qualifies when
 * it is live and at rest, its traced loop `offset` beyond its reach lies within the industrial
 * leash of home and clear of exclusion zones and the Needle channel, and the straight
 * course to the loop clears other scenery at the passage berth.
 */
function minerInput(
  content: GameContent,
  flight: FlightState,
  asteroids: () => ReturnType<typeof retaliatorAsteroidQuery>,
  offset: number,
  object: SpaceObject,
): NonNullable<EnemyContext["miner"]> {
  const state = object.enemy!;
  const world = flightWorldContext(flight);
  const traced = state.miner?.rock
    ? flight.objects.find(
        (other) =>
          other.id === state.miner!.rock && other.kind === "rock" && other.hp > 0 && atRest(other),
      )
    : undefined;
  let edge: TracedEdge | undefined;
  if (traced) {
    const centre = worldPoint(world, object, traced);
    const drawn = drawnOf(flight, traced);
    const frames = drawn?.frames.length ?? 0;
    const outline = drawn?.frames[((frameOf(flight, traced) % frames) + frames) % frames];
    if (outline) {
      edge = outlineEdge(worldParts(outline), centre, object);
    } else {
      const away = worldDelta(world, centre, object);
      const distance = Math.hypot(away.x, away.y);
      edge = {
        around: distance,
        distance: Math.max(0, distance - placementRadius(traced)),
        normal: distance ? { x: away.x / distance, y: away.y / distance } : { x: 0, y: -1 },
      };
    }
  }
  if (!minerNeedsPick(ENEMY_KEEP_MOVING, edge !== undefined, state)) {
    return edge ? { edge } : {};
  }
  const blocked = (point: Vec): boolean =>
    needleChannelContains({ radius: object.radius }, flight, point) ||
    flight.objects.some((other) => {
      const radius = exclusionZoneRadius(content, other);
      return radius !== null && worldDistance(world, point, other) <= radius + object.radius;
    });
  const candidates = asteroids()(INDUSTRIAL_HOME_RADIUS, state.home).filter((rock) => {
    const actual = flight.objects.find((other) => other.id === rock.id);
    const loop = rock.physicalReach + offset;
    if (
      !actual ||
      !atRest(actual) ||
      worldDistance(world, state.home, rock.position) + loop > INDUSTRIAL_HOME_RADIUS
    ) {
      return false;
    }
    const centre = worldPoint(world, object, rock.position);
    for (let index = 0; index < MINER_LOOP_SAMPLES; index++) {
      const angle = (index / MINER_LOOP_SAMPLES) * Math.PI * 2;
      if (blocked({ x: centre.x + Math.cos(angle) * loop, y: centre.y + Math.sin(angle) * loop })) {
        return false;
      }
    }
    const away = worldDelta(world, centre, object);
    const distance = Math.hypot(away.x, away.y) || 1;
    const entry = {
      x: centre.x + (away.x / distance) * loop,
      y: centre.y + (away.y / distance) * loop,
    };
    return !flight.objects.some(
      (other) =>
        other.id !== rock.id &&
        other.hp > 0 &&
        SCENERY.includes(other.kind) &&
        worldSceneryBlocksSegment(
          world,
          other,
          object,
          entry,
          ENEMY_AVOIDANCE.passageClearance + object.radius,
          frameOf(flight, other),
          drawnOf(flight, other),
        ),
    );
  });
  return {
    candidates: candidates.map((rock) => ({ id: rock.id, position: rock.position })),
    ...(edge ? { edge } : {}),
  };
}

/** World units within which a ship already counts as touching a peer or exclusion zone. */
const CONTACT_SLACK = 0.5;

/**
 * A powered enemy's velocity for one movement substep (gameplay/ships.md "Keep moving"): a peer
 * or protected-area contact never stops it. It slides along the contact at least at `floor` speed, two ships head
 * on turn the same way round it and pass, wedged between peers it leaves along their mean contact
 * direction, and at a Phantom blockade's reach it turns along the limit.
 */
function keepClear(
  content: GameContent,
  flight: FlightState,
  blockade: boolean,
  floor: number,
  velocity: Vec,
  drift: Vec,
  dt: number,
  object: SpaceObject,
): Vec {
  const enemy = object.enemy!;
  // A ship pressing its request into a contact would otherwise slide ever slower.
  const speed = Math.max(Math.hypot(velocity.x, velocity.y), floor);
  if (!speed) {
    return velocity;
  }
  const world = flightWorldContext(flight);
  /** `velocity` without its component into `normal` at `speed`, else along it on `side`. */
  const slide = (side: number, normal: Vec, current: Vec): Vec => {
    const into = current.x * normal.x + current.y * normal.y;
    if (into >= 0 && (current.x || current.y)) {
      return current;
    }
    const along = { x: current.x - into * normal.x, y: current.y - into * normal.y };
    const size = Math.hypot(along.x, along.y);
    const course =
      size > speed / 2
        ? { x: along.x / size, y: along.y / size }
        : { x: -normal.y * side, y: normal.x * side };
    // Canonicalize zero on axis-aligned slides so JSON saves preserve the velocity.
    return { x: course.x * speed + 0, y: course.y * speed + 0 };
  };
  let next = velocity;
  const ahead = { x: object.x + (next.x + drift.x) * dt, y: object.y + (next.y + drift.y) * dt };
  /** Within `reach` of `other` after this step, or touching it already. */
  const touches = (other: SpaceObject, reach: number): boolean =>
    worldDistance(world, other, ahead) < reach ||
    worldDistance(world, other, object) <= reach + CONTACT_SLACK;
  // Peers and exclusion zones it would enter or already touches all count as contacts, so a
  // slide off one never runs into another.
  const normals = flight.objects.flatMap((other) => {
    if (other === object) {
      return [];
    }
    const zone = exclusionZoneRadius(content, other);
    const contact =
      zone !== null
        ? touches(other, zone + object.radius)
        : other.kind === "enemy" &&
          other.hp > 0 &&
          !other.enemy?.salvaged &&
          touches(other, enemySpacing(object, other));
    if (!contact) {
      return [];
    }
    const away = worldDelta(world, other, object);
    const size = Math.hypot(away.x, away.y);
    return size ? [{ x: away.x / size, y: away.y / size }] : [];
  });
  if (normals.length === 1) {
    // Head on, both ships turn the same way round the contact, so they pass rather than pair.
    next = slide(1, normals[0]!, next);
  } else if (normals.length > 1) {
    // Wedged between peers, it leaves along the mean of the contact normals.
    const out = normals.reduce((sum, normal) => ({ x: sum.x + normal.x, y: sum.y + normal.y }), {
      x: 0,
      y: 0,
    });
    const size = Math.hypot(out.x, out.y);
    next = size
      ? { x: (out.x / size) * speed, y: (out.y / size) * speed }
      : slide(1, normals[0]!, next);
  }
  if (blockade && !enemy.fleeing) {
    const offset = worldDelta(world, enemy.home, {
      x: object.x + (next.x + drift.x) * dt,
      y: object.y + (next.y + drift.y) * dt,
    });
    const reach = Math.hypot(offset.x, offset.y);
    if (reach >= PHANTOM_TUNING.blockadeReach && reach > 0) {
      next = slide(circlingSide(enemy), { x: -offset.x / reach, y: -offset.y / reach }, next);
    }
  }
  return next;
}

/**
 * The first time each flight Ada comes within Talk range of a destination its guard still blocks
 * (gameplay/rules.md "Space encounters and feedback"), the guard is cued: a dormant retained
 * guard loads. Quest frigates and their surviving followers remain local to the exact site.
 * Other blocking encounters retain their existing summon and play-view handoff.
 * The cue event and stable marker identity are unchanged.
 */
function cueGuards(
  content: GameContent,
  admitEnemy: FlightInput["admitEnemy"],
  flight: FlightState,
  events: FlightEvent[],
): void {
  const cued = flight.objects.filter(
    (object) =>
      object.kind === "destination" &&
      !flight.guardCues?.includes(object.id) &&
      worldDistance(flightWorldContext(flight), object, flight.player) <=
        content.tuning.talkRange &&
      routeBlocked(object.id, flight),
  );
  for (const destination of cued) {
    const id = destination.id;
    if (
      admitEnemy &&
      !stationPopulationObjects(flight).some(
        (guard) =>
          guard.routeId === id &&
          liveEnemy(guard) &&
          !guard.enemy?.disabled &&
          admitEnemy(flight, guard),
      )
    ) {
      continue;
    }
    (flight.guardCues ??= []).push(id);
    worldActivateRouteEncounter(flightWorldContext(flight), content, id, flight);
    const leaders = flight.objects.filter(
      (guard) => guard.routeId === id && admitEnemy?.(flight, guard) !== false,
    );
    leaders.forEach((leader) => activateFrigateEscorts(content, flight, leader));
    const ids = new Set(leaders.map((leader) => leader.id));
    for (const guard of flight.objects) {
      if (
        guard.kind === "enemy" &&
        !localGuardMember(flight, guard) &&
        (guard.routeId === destination.id ||
          (guard.enemy?.escortOf != null && ids.has(guard.enemy.escortOf))) &&
        guard.hp > 0 &&
        !guard.enemy?.disabled &&
        !flight.summonedGuards?.includes(guard.id) &&
        admitEnemy?.(flight, guard) !== false
      ) {
        (flight.summonedGuards ??= []).push(guard.id);
      }
    }
    events.push({ id: destination.id, type: "guardCue" });
  }
}

/**
 * Whether a point's centre is inside the current play view: `viewportWidth` wide at the 720x360
 * base's aspect around Ada, by the shortest wrapped image.
 */
function insidePlayView(viewportWidth: number, flight: FlightState, point: Vec): boolean {
  const view = { height: (viewportWidth * SCREEN.height) / SCREEN.width, width: viewportWidth };
  const image = worldPoint(flightWorldContext(flight), flight.player, point);
  return onScreen(view, flight.player, { radius: 0, x: image.x, y: image.y });
}

function phantomBlockade(galaxy: GalaxyNumber, object: SpaceObject): boolean {
  return galaxy === 6 && PHANTOM_DESTINATIONS.some((id) => id === object.routeId);
}

/** Authored encounters and fighters attached to a leader retain their previous leash. */
function actorPursuitHomeRadius(
  galaxy: GalaxyNumber,
  homeRadius: number,
  blockade: boolean,
  object: SpaceObject,
): number {
  if (blockade) {
    return PHANTOM_TUNING.blockadeReach;
  }
  if (
    (galaxy === 6 && object.id === PHANTOM_FLAGSHIP_ID && object.enemy?.archetype === "capital") ||
    (galaxy === 2 && object.id === CARTWHEEL_CLAIM.id)
  ) {
    return homeRadius;
  }
  return persistentObject(object) || object.enemy?.escortOf != null
    ? AUTHORED_PURSUIT_HOME_RADIUS
    : homeRadius;
}

/**
 * A summoned guard holds fire until it is inside the current play view (insidePlayView), then
 * fights as usual; disabled, destroyed or gone, it is released too.
 */
function releaseSummonedGuards(viewportWidth: number, flight: FlightState): void {
  if (!flight.summonedGuards) {
    return;
  }
  flight.summonedGuards = flight.summonedGuards.filter((id) => {
    const guard = flight.objects.find((object) => object.id === id);
    if (!guard || guard.hp <= 0 || guard.enemy?.disabled) {
      return false;
    }
    if (!insidePlayView(viewportWidth, flight, guard)) {
      return true;
    }
    const context = flightWorldContext(flight);
    if (guard.enemy) {
      const { homeRadius } = enemyEquipmentDefinition(flight.galaxy, guard.enemy).pursuit;
      // Preserve the summons handoff before the separate in-fight blockade tether applies.
      const radius = actorPursuitHomeRadius(flight.galaxy, homeRadius, false, guard);
      // A remote summons starts its local fight here instead of immediately leashing back.
      if (
        worldDistance(context, guard.enemy.home, guard) >= radius ||
        worldDistance(context, guard.enemy.home, flight.player) > radius
      ) {
        guard.enemy.home = { x: guard.x, y: guard.y };
      }
    }
    return false;
  });
  if (!flight.summonedGuards.length) {
    delete flight.summonedGuards;
  }
}

export type RouteGuardPlanResult = ReturnType<typeof routeGuardEvidence>;

/** Only actual actor or tombstone evidence establishes a required guard's outcome. */
export function routeGuardPlanResult(flight: FlightState, id: string): RouteGuardPlanResult {
  return routeGuardEvidence(flight, id);
}

/** A guard blocks its route until it is disabled or destroyed (gameplay/rules.md). */
export function routeBlocked(id: string, flight: FlightState): boolean {
  // A guard loaded or dormant alike: a disabled one has stopped counting, as when retained.
  return (
    retainedRouteBlocked(id, flight) ||
    flight.objects.some(
      (object) => object.routeId === id && liveEnemy(object) && !object.enemy?.disabled,
    )
  );
}

/**
 * The holodisk leader's pack. Its members persist so the fight cannot reroll, but only the
 * leader blocks the route, so a fleeing member never strands the holodisk.
 */
function guardPack(
  content: GameContent,
  leader: Vec,
  flight: FlightState,
  packId = "route:holodisk:pack",
  spread = 90,
): void {
  const { pack, packSize } = HOLODISKS.guard;
  for (let i = 0; i < packSize; i++) {
    const angle = (i * Math.PI * 2) / packSize;
    const member = spawnEnemy(
      content,
      flight,
      pack,
      `${packId}:${i}`,
      { x: leader.x + Math.cos(angle) * spread, y: leader.y + Math.sin(angle) * spread },
      packId,
      angle,
    );
    member.persistent = true;
    flight.objects.push(member);
  }
  combat(flight).initialPackSizes[packId] = packSize;
}

/**
 * Places a hunting pack near each whale destination within `placeRange` of Ada, once per
 * flight: hunters on a seeded side of the destination, or its far side when that side holds
 * the route guard. Members are retained like route guards and chase as one pack.
 */
/**
 * A Whirlpool hunting pack of `count` fighters around a centre, kept with the flight. A pack
 * placed again under its id replaces its members.
 */
export function placeHuntingPack(
  content: GameContent,
  packId: string,
  centre: Vec,
  count: number,
  flight: FlightState,
): void {
  flight.objects = flight.objects.filter(
    (object) => object.kind !== "enemy" || object.enemy?.packId !== packId,
  );
  worldActivateFlightRegion(flightWorldContext(flight), content, centre, flight);
  for (let i = 0; i < count; i++) {
    const phase = (i * Math.PI * 2) / count;
    const member = spawnEnemy(
      content,
      flight,
      HUNTING_PACKS.archetype,
      `${packId}:${i}`,
      {
        x: centre.x + Math.cos(phase) * HUNTING_PACKS.spread,
        y: centre.y + Math.sin(phase) * HUNTING_PACKS.spread,
      },
      packId,
      phase,
    );
    member.persistent = true;
    flight.objects.push(member);
  }
  combat(flight).initialPackSizes[packId] = count;
}

export function ensureHuntingPacks(content: GameContent, flight: FlightState): void {
  if (!HUNTING_PACKS.galaxies.includes(flight.galaxy)) {
    return;
  }
  const placed = (combat(flight).huntingPacks ??= []);
  for (const destination of flight.objects.filter(
    (object) =>
      object.kind === "destination" &&
      HUNTING_PACKS.destinations.includes(object.id) &&
      !placed.includes(object.id) &&
      worldDistance(flightWorldContext(flight), object, flight.player) <= HUNTING_PACKS.placeRange,
  )) {
    const next = random(
      hash(flight.seed ^ 0x4a7e, destination.id.length, destination.id.charCodeAt(0)),
    );
    const [fewest, most] = HUNTING_PACKS.count;
    const count = fewest + Math.floor(next() * (most - fewest + 1));
    let angle = next() * Math.PI * 2;
    const at = (turn: number) => ({
      x: destination.x + Math.cos(turn) * HUNTING_PACKS.distance,
      y: destination.y + Math.sin(turn) * HUNTING_PACKS.distance,
    });
    const guard = flight.objects.find(
      (object) => object.kind === "enemy" && object.routeId === destination.id,
    );
    if (
      guard &&
      worldDistance(flightWorldContext(flight), guard, at(angle)) < HUNTING_PACKS.guardGap
    ) {
      angle += Math.PI;
    }
    placeHuntingPack(content, `hunt:${destination.id}`, at(angle), count, flight);
    placed.push(destination.id);
  }
}

function requiredSiteSpan(content: GameContent, reach: number): number {
  return Math.max(
    content.tuning.chunkSize * 2,
    content.tuning.flight.arrivalCalm +
      content.tuning.exclusionRadius +
      reach * 2 +
      ENEMY_AVOIDANCE.clearance,
  );
}

function routeArchetype(galaxy: GalaxyNumber, id: string): EnemyArchetype {
  return id === "holodisk" ? HOLODISKS.guard.leader : galaxy === 1 ? "frigate" : "capital";
}

export function ensureRouteEncounter(
  content: GameContent,
  id: string,
  flight: FlightState,
): SpaceObject | null {
  if (readRequiredRolePlan(flight, id)) {
    return null;
  }
  const existing = flight.objects.find(
    (object) => object.kind === "enemy" && object.routeId === id,
  );
  if (existing) {
    return existing;
  }
  if (
    isHeld(id, flight) ||
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
  const archetype = routeArchetype(flight.galaxy, id);
  if (archetype === "frigate" && flight.galaxy === 1 && !holodisk) {
    if (flight.requiredPlans) {
      const activated = activateRequiredRoute(content, id, flight);
      return activated.status === "created" || activated.status === "existing"
        ? activated.guard
        : null;
    }
    const guardId = `route:${id}`;
    const plan = planRequiredFrigate(content, flight, guardId, id);
    const guard = plan
      ? spawnQuestFrigateAt(content, flight, guardId, id, plan.leader, plan.support.length)
      : null;
    if (guard) {
      combat(flight).routeEncounters.push(id);
    }
    return guard;
  }
  worldActivateFlightRegion(flightWorldContext(flight), content, destination, flight);
  const radius = enemyCatalog[archetype].sizeRatio * content.tuning.flight.shipRadius;
  const heading = direction(worldDelta(flightWorldContext(flight), destination, flight.player));
  const approach = length(heading) ? heading : { x: 0, y: 1 };
  // Keep the initial hidden capital outside the strict placement boundary after rounding.
  const placementMargin =
    flight.galaxy === 3 && archetype === "capital" && planningRequiredWorld.has(flight) ? 0.01 : 0;
  const offset = content.tuning.exclusionRadius + radius + 120 + placementMargin;
  const point = { x: destination.x + approach.x * offset, y: destination.y + approach.y * offset };
  const object = spawnEnemy(content, flight, archetype, `route:${id}`, point);
  object.routeId = id;
  // Clear the guard footprint and leave the protected destination untouched.
  clearLayoutObjects(
    (other) =>
      other.kind === "destination" ||
      worldDistance(flightWorldContext(flight), other, point) > other.radius + radius + 20,
    flight,
  );
  canonicalObject(flight, object);
  flight.objects.push(object);
  if (holodisk) {
    guardPack(content, point, flight);
  }
  relocateRouteGuards(content, flight);
  installFrigateEscorts(content, flight, object);
  if (holodisk && object.enemy) {
    const ports = questGuardHomePorts(questGuardPlacementContext(content, flight));
    const home = ports.recoveryHome(flightWorldContext(flight), destination, object);
    if (home) {
      object.enemy.home = { x: home.x, y: home.y };
    }
  }
  combat(flight).routeEncounters.push(id);
  return object;
}

export function ensureDestination(
  content: GameContent,
  id: string,
  flight: FlightState,
): SpaceObject {
  const existing = flight.objects.find((o) => o.id === id && o.kind === "destination");
  if (existing) {
    return existing;
  }
  const rolePlan = readRequiredRolePlan(flight, id);
  if (rolePlan) {
    return rolePlan.site;
  }
  const pending = readRequiredPlan(flight, id);
  if (pending && !planningRequiredWorld.has(flight)) {
    activateRequiredRoute(content, id, flight);
    return (
      flight.objects.find((object) => object.kind === "destination" && object.id === id) ??
      pending.site
    );
  }
  const held = heldDestination(content, id, flight);
  if (held) {
    return held;
  }
  const heading = direction(
    length(flight.velocity)
      ? flight.velocity
      : length(flight.facing)
        ? flight.facing
        : { x: 0, y: -1 },
  );
  const baseSpan = content.tuning.chunkSize * 2;
  const leaderReach = planningRequiredWorld.has(flight)
    ? questGuardFormationReach(questGuardPlacementContext(content, flight), [
        spawnEnemy(
          content,
          flight,
          routeArchetype(flight.galaxy, id),
          `route:${id}`,
          flight.player,
        ),
      ])
    : 0;
  // A new planned site's inward guard edge also stays outside the existing launch calm area.
  const span = planningRequiredWorld.has(flight)
    ? requiredSiteSpan(content, leaderReach)
    : baseSpan;
  const index = flight.objects.filter((o) => o.kind === "destination").length;
  const spacing = content.tuning.storySpacing;
  const offset = Math.ceil(index / 2) * (index % 2 ? 1 : -1) * spacing;
  const target = {
    x: flight.player.x + heading.x * span - heading.y * offset,
    y: flight.player.y + heading.y * span + heading.x * offset,
  };
  while (destinationCrowded(content, flight, target)) {
    target.x -= heading.y * spacing;
    target.y += heading.x * spacing;
  }
  // A nearby clear point keeps the destination in its original region.
  for (const point of destinationCandidates(target)) {
    if (destinationClear(content, flight, point)) {
      return ensureDestinationAt(content, id, point, flight);
    }
  }
  return ensureDestinationAt(content, id, target, flight);
}

/** Story sites and their formations share the same bounded, ordered placement search. */
function* destinationCandidates(target: Vec): Iterable<Vec> {
  yield target;
  const step = CURRENTS.width[1] / 2;
  for (let ring = 1; ring <= 8; ring++) {
    for (let spoke = 0; spoke < 16; spoke++) {
      const angle = (spoke * Math.PI) / 8;
      yield {
        x: target.x + Math.cos(angle) * ring * step,
        y: target.y + Math.sin(angle) * ring * step,
      };
    }
  }
}

function destinationCrowded(content: GameContent, flight: FlightState, point: Vec): boolean {
  const world = flightWorldContext(flight);
  return (
    flight.objects.some(
      (object) =>
        object.kind === "destination" &&
        worldDistance(world, object, point) < content.tuning.storySpacing,
    ) ||
    worldStationsNear(
      flightStationContext(flight),
      ECONOMY,
      flight.galaxy,
      ECONOMY.station.destinationClearance,
      point,
    ).length > 0 ||
    landmarkSites(flight.galaxy).some(
      (site) => worldDistance(world, site, point) < LANDMARK_TUNING.placeClearance,
    )
  );
}

function destinationClear(content: GameContent, flight: FlightState, point: Vec): boolean {
  return (
    !worldInCurrent(flightWorldContext(flight), flight.galaxy, CURRENTS.clearance, point) &&
    !destinationCrowded(content, flight, point)
  );
}

/** A seeded chapter site uses the same destination creation and protected-area clearance as exploration. */
export function ensureDestinationAt(
  content: GameContent,
  id: string,
  point: Vec,
  flight: FlightState,
): SpaceObject {
  const existing = flight.objects.find(
    (object) => object.kind === "destination" && object.id === id,
  );
  if (existing) {
    return existing;
  }
  generate(content, point, false, flight);
  const object: SpaceObject = { ...point, hp: 1, id, kind: "destination", radius: 30, role: id };
  canonicalObject(flight, object);
  flight.objects.push(object);
  // A destination's exclusion zone holds no layout object or drift path from earlier chunks.
  clearLayoutObjects(
    (o) => o.kind === "destination" || clearOf(flight, content.tuning.exclusionRadius, object, o),
    flight,
  );
  relocateRouteGuards(content, flight);
  return object;
}

/**
 * Cartwheel's miner and visitors destinations stand at their holding points beside the hub
 * (gameplay/rules.md), placing the hub first; null for any other destination.
 */
function heldDestination(
  content: GameContent,
  id: string,
  flight: FlightState,
): SpaceObject | null {
  const offset =
    flight.galaxy === CARTWHEEL_STORY_SHIPS.galaxy &&
    Object.hasOwn(CARTWHEEL_STORY_SHIPS.destinations, id)
      ? CARTWHEEL_STORY_SHIPS.destinations[id as keyof typeof CARTWHEEL_STORY_SHIPS.destinations]
      : undefined;
  if (!offset) {
    return null;
  }
  const hub = ensureDestination(content, CARTWHEEL_STORY_SHIPS.station, flight);
  const target = { x: hub.x + offset.x, y: hub.y + offset.y };
  generate(content, target, false, flight);
  const object: SpaceObject = { ...target, hp: 1, id, kind: "destination", radius: 30, role: id };
  canonicalObject(flight, object);
  flight.objects.push(object);
  clearLayoutObjects(
    (o) => o.kind === "destination" || clearOf(flight, content.tuning.exclusionRadius, object, o),
    flight,
  );
  return object;
}

/** Whether a destination is held beside the hub, so it neither moves ahead nor has a guard. */
function isHeld(id: string, flight: FlightState): boolean {
  return (
    flight.galaxy === CARTWHEEL_STORY_SHIPS.galaxy &&
    Object.hasOwn(CARTWHEEL_STORY_SHIPS.destinations, id)
  );
}

/** Reposition an undiscovered encounter only while its old location is outside the generated near field. */
export function placeDestinationAhead(
  content: GameContent,
  id: string,
  flight: FlightState,
): SpaceObject {
  const existing = flight.objects.find((o) => o.id === id && o.kind === "destination");
  if (existing && isHeld(id, flight)) {
    return existing;
  }
  if (
    !existing ||
    worldDistance(flightWorldContext(flight), existing, flight.player) >
      content.tuning.chunkSize * 2.5
  ) {
    flight.objects = flight.objects.filter((o) => o !== existing);
    return ensureDestination(content, id, flight);
  }
  return existing;
}

export type Loadout = Pick<
  EconomyState,
  | "ammo"
  | "cargo"
  | "levels"
  | "ownedWeapons"
  | "weapon"
  | "shieldRechargeCredit"
  | "shieldOreSpent"
>;

export function createUnpopulatedFlight(
  content: GameContent,
  galaxy: GalaxyNumber,
  seed: number,
  loadout: Loadout = {
    ammo: grantedAmmo([]),
    levels: noLevels(),
    ownedWeapons: [],
    weapon: "laser",
  },
  encounterSeed?: number,
): FlightState {
  const levels = structuredClone(loadout.levels);
  const flight: FlightState = {
    ...(encounterSeed === undefined ? {} : { encounterSeed }),
    ammo: clampAmmo(ECONOMY, loadout.ammo),
    cargo: loadout.cargo ?? 0,
    ...(loadout.shieldRechargeCredit === undefined
      ? {}
      : { shieldRechargeCredit: loadout.shieldRechargeCredit }),
    ...(loadout.shieldOreSpent === undefined ? {} : { shieldOreSpent: loadout.shieldOreSpent }),
    chunks: [],
    dangerFor: 0,
    facing: { x: 0, y: -1 },
    fireCooldown: 0,
    freshChunk: "0,0",
    freshDistance: 0,
    galaxy,
    levels,
    mines: [],
    nextId: 0,
    objects: [],
    ownedWeapons: [...loadout.ownedWeapons],
    player: { x: 0, y: 0 },
    seed,
    shield: shipTuning(ECONOMY, content, levels).shieldMax,
    shots: [],
    sinceDamage: content.tuning.shieldRechargeDelay,
    time: 0,
    velocity: { x: 0, y: 0 },
    visited: {},
    // An empty saved selection starts the flight on Laser.
    weapon: shotsLeft(loadout.weapon, loadout) === 0 ? "laser" : loadout.weapon,
    weaponSwitchFor: 0,
    world: { notables: {}, version: 1 },
  };
  markVisited(flight.visited, "0,0");
  return flight;
}

/** Optional world generation starts only after the caller has installed required reservations. */
export function populateFlight(
  content: GameContent,
  progress: Pick<GalaxyProgress, "known" | "requiredSites">,
  flight: FlightState,
): void {
  generate(content, flight.player, flight.galaxy === 2 && progress.known.includes("hub"), flight);
  for (const id of progress.known) {
    const point = progress.requiredSites?.[id];
    if (point) {
      ensureDestinationAt(content, id, point, flight);
    } else {
      ensureDestination(content, id, flight);
    }
  }
  worldSyncFlightRegion(flightWorldContext(flight), content, flight);
}

/** Initialize the authored chapter before optional generation without changing placement policy. */
export function populateRequiredChapterFlight(
  content: GameContent,
  progress: GalaxyProgress,
  flight: FlightState,
  initialize: () => void,
): void {
  initializingRequiredChapter.add(flight);
  try {
    initialize();
  } finally {
    initializingRequiredChapter.delete(flight);
  }
  populateFlight(content, progress, flight);
}

/** Test the final site and rigid formation in a detached chart before committing that move. */
function placeWhirlpoolFormation(
  content: GameContent,
  projection: FlightState,
  site: SpaceObject,
  actors: readonly SpaceObject[],
  fixed = false,
): { site: SpaceObject; actors: readonly SpaceObject[] } | null {
  const world = flightWorldContext(projection);
  const reach = questGuardFormationReach(questGuardPlacementContext(content, projection), actors);
  const span = requiredSiteSpan(content, reach);
  const heading = direction(length(projection.facing) ? projection.facing : { x: 0, y: -1 });
  const fromLaunch = worldDelta(world, projection.player, site);
  const distance = Math.max(0, span - fromLaunch.x * heading.x - fromLaunch.y * heading.y);
  const preferred = { x: site.x + heading.x * distance, y: site.y + heading.y * distance };
  const moving = new Set([site.id, ...actors.map(({ id }) => id)]);
  const occupants = [
    ...stationPopulationObjects(projection),
    ...Object.values(projection.requiredPlans ?? {}).flatMap((plan) => [
      plan.site,
      ...requiredPlanActors(plan),
    ]),
  ].filter(({ id }) => !moving.has(id));
  const placement = {
    ...projection,
    objects: occupants,
    world: { ...projection.world, notables: {} },
  };
  for (const point of fixed ? [site] : destinationCandidates(preferred)) {
    const retry = worldDelta(world, preferred, point);
    if (
      !fixed &&
      (retry.x * heading.x + retry.y * heading.y < 0 ||
        !destinationClear(content, placement, point))
    ) {
      continue;
    }
    const delta = worldDelta(world, site, point);
    const shiftedSite = { ...site, ...point };
    canonicalObject(projection, shiftedSite);
    const shifted = actors.map((actor) => {
      const next = structuredClone(actor);
      for (const part of [next, next.enemy!.position, next.enemy!.home]) {
        part.x += delta.x;
        part.y += delta.y;
      }
      canonicalObject(projection, next);
      return next;
    });
    if (
      !stationFormationClear(
        questGuardPlacementContext(content, { ...placement, objects: [...occupants, shiftedSite] }),
        shifted,
      ) ||
      shifted.some(
        (actor) =>
          capital(actor) &&
          occupants.some(
            (other) =>
              capital(other) && worldDistance(world, actor, other) < enemySpacing(actor, other),
          ),
      )
    ) {
      continue;
    }
    return { actors: shifted, site: shiftedSite };
  }
  return null;
}

const whirlpoolProtectedDisks = new WeakMap<FlightState, readonly SpaceObject[]>();

/** Keep the site reserved while the family waypoint exists without a physical pickup. */
export function reserveWhirlpoolDiskSite(flight: FlightState, at: Vec): void {
  if (!whirlpoolProtectedDisks.has(flight)) {
    whirlpoolProtectedDisks.set(flight, [
      { ...at, hp: 1, id: "holodisk", kind: "destination", radius: 30, role: "holodisk" },
    ]);
  }
}

function planSounderFormation(
  content: GameContent,
  projection: FlightState,
  site: SpaceObject,
  fixed: boolean,
): RequiredRoleEncounterPlan | null {
  const world = flightWorldContext(projection);
  const { id, swarmPack } = WHIRLPOOL_CAPITAL_BOSS;
  const heading = worldDelta(world, site, FLIGHT_START);
  const bearing = Math.atan2(heading.y, heading.x);
  for (let slot = 0; slot < 8; slot++) {
    const angle = bearing + (slot * Math.PI) / 4;
    const leader = spawnEnemy(content, projection, "capital", id, site);
    const offset = content.tuning.exclusionRadius + actorFootprint(projection, leader) + 240;
    leader.x += Math.cos(angle) * offset;
    leader.y += Math.sin(angle) * offset;
    leader.enemy!.home = { x: leader.x, y: leader.y };
    leader.enemy!.position = { x: leader.x, y: leader.y };
    leader.routeId = site.id;
    leader.persistent = true;
    const escorts = createFrigateEscorts(
      {
        encounterSeed: flightEncounterSeed(projection),
        galaxy: projection.galaxy,
        id: (index) => requiredFrigateEscortId(id, index),
        packId: escortPackId(id),
        persistent: true,
        shipRadius: content.tuning.flight.shipRadius,
      },
      leader,
    );
    const draft: FlightState = {
      ...projection,
      combat: { initialPackSizes: {}, routeEncounters: [] },
      objects: [],
    };
    // Use the existing swarm with enough space for the larger hull and its two escorts.
    const spread = Math.max(...escorts.map((escort) => worldDistance(world, leader, escort))) + 90;
    guardPack(content, leader, draft, swarmPack, spread);
    const placed = placeWhirlpoolFormation(
      content,
      projection,
      site,
      [leader, ...escorts, ...draft.objects],
      fixed,
    );
    if (placed) {
      return { ...placed, role: "whirlpool-sounder" };
    }
  }
  return null;
}

/** Removes the superseded guard only, including dormant actors, without a combat reward. */
export function retireLegacyWhirlpoolDiskGuard(
  content: GameContent,
  progress: GalaxyProgress,
  flight: FlightState,
): void {
  const plan = readRequiredRolePlan(flight, "holodisk");
  if (plan?.role === "whirlpool-holodisk") {
    delete flight.requiredPlans!.holodisk;
  }
  const disk = flight.objects.find((object) => object.id === "holodisk");
  if (disk && !progress.requiredSites?.holodisk) {
    rememberRequiredSite(progress, "holodisk", disk);
  }
  const legacyId = "route:holodisk";
  const legacy = (object: SpaceObject) =>
    object.id === legacyId ||
    object.id === wreckId(legacyId) ||
    object.enemy?.escortOf === legacyId ||
    object.enemy?.packId === "route:holodisk:pack";
  const world = flightWorldContext(flight);
  for (const object of stationPopulationObjects(flight)) {
    if (legacy(object)) {
      worldRecordObjectRemoval(world, content, object, flight);
    }
  }
  if (disk || flight.objects.some(legacy)) {
    flight.objects = flight.objects.filter((object) => object !== disk && !legacy(object));
  }
  const state = flight.combat;
  if (state) {
    state.routeEncounters = state.routeEncounters.filter((id) => id !== "holodisk");
    worldPrunePackState(world, flight);
  }
}

export function whirlpoolSounderActor(object: SpaceObject): boolean {
  const { id, swarmPack } = WHIRLPOOL_CAPITAL_BOSS;
  return object.id === id || object.enemy?.escortOf === id || object.enemy?.packId === swarmPack;
}

export function restoreWhirlpoolSounder(
  content: GameContent,
  actors: readonly SpaceObject[],
  flight: FlightState,
): void {
  flight.objects.push(...actors);
  const state = combat(flight);
  if (!state.routeEncounters.includes("holodisk")) {
    state.routeEncounters.push("holodisk");
  }
  Object.assign(state.initialPackSizes, {
    [escortPackId(WHIRLPOOL_CAPITAL_BOSS.id)]: FRIGATE_ESCORT_COUNT,
    [WHIRLPOOL_CAPITAL_BOSS.swarmPack]: HOLODISKS.guard.packSize,
  });
  worldSyncFlightRegion(flightWorldContext(flight), content, flight);
  worldPrunePackState(flightWorldContext(flight), flight);
}

/** Reserve the existing G3 route roles on a detached world before optional population. */
export function planRequiredWhirlpoolRoutes(
  content: GameContent,
  progress: GalaxyProgress,
  flight: FlightState,
  siteIds: readonly string[],
): void {
  const projection = structuredClone(flight);
  planningRequiredWorld.add(projection);
  try {
    const sites = siteIds
      .filter((id) => id !== "holodisk" && !readRequiredRolePlan(flight, id))
      .map((id) => {
        const point = progress.requiredSites?.[id];
        return point
          ? ensureDestinationAt(content, id, point, projection)
          : ensureDestination(content, id, projection);
      });
    for (const site of sites) {
      ensureRouteEncounter(content, site.id, projection);
    }
    const population = stationPopulationObjects(projection);
    const plans: RequiredRoleEncounterPlan[] = [];
    for (const site of sites) {
      const leader = population.find((actor) => actor.id === `route:${site.id}`)!;
      const actors = [leader];
      const placed = progress.requiredSites?.[site.id]
        ? { actors, site }
        : placeWhirlpoolFormation(content, projection, site, actors);
      if (!placed) {
        throw new RangeError(`No clear formation for required Whirlpool site ${site.id}`);
      }
      Object.assign(site, placed.site);
      for (const [index, actor] of actors.entries()) {
        Object.assign(actor, placed.actors[index]);
      }
      plans.push({
        actors,
        role: "whirlpool-capital",
        site,
      });
    }
    if (siteIds.includes("holodisk") && !readRequiredRolePlan(flight, "holodisk")) {
      const saved = progress.requiredSites?.holodisk;
      const site = saved
        ? ensureDestinationAt(content, "holodisk", saved, projection)
        : ensureDestination(content, "holodisk", projection);
      const sounder = planSounderFormation(content, projection, site, saved !== undefined);
      if (sounder) {
        plans.push(sounder);
      }
    }
    for (const plan of plans) {
      storeRequiredRolePlan(progress, flight, plan);
    }
  } finally {
    planningRequiredWorld.delete(projection);
  }
}

/** Future held buoy sites reserve geometry without adding actors, markers or population. */
function cartwheelSiteGeometry(flight: FlightState): readonly SpaceObject[] {
  if (flight.galaxy !== 2) {
    return [];
  }
  const hub =
    readRequiredRolePlan(flight, CARTWHEEL_STORY_SHIPS.station)?.site ??
    stationPopulationObjects(flight).find(
      (object) => object.kind === "destination" && object.id === CARTWHEEL_STORY_SHIPS.station,
    );
  if (!hub) {
    return [];
  }
  return cartwheelRequiredSites(flightWorldContext(flight), hub, ["miner", "visitors"]).map(
    (site) => ({ ...hub, ...site }),
  );
}

/** Cartwheel reserves its sole authored capital; held regulars are geometry-only sites. */
export function planRequiredCartwheelRoute(
  content: GameContent,
  progress: GalaxyProgress,
  flight: FlightState,
): void {
  if (flight.galaxy !== 2 || readRequiredRolePlan(flight, CARTWHEEL_STORY_SHIPS.station)) {
    return;
  }
  const id = CARTWHEEL_STORY_SHIPS.station;
  const projection = structuredClone(flight);
  planningRequiredWorld.add(projection);
  try {
    const point = progress.requiredSites?.[id];
    const site = point
      ? ensureDestinationAt(content, id, point, projection)
      : ensureDestination(content, id, projection);
    if (
      progress.questComplete ||
      progress.known.includes(id) ||
      flight.combat?.routeEncounters.includes(id) ||
      Object.hasOwn(flight.world.notables, `route:${id}`)
    ) {
      ensureDestinationAt(content, id, site, flight);
      return;
    }
    const leader = ensureRouteEncounter(content, id, projection);
    if (!leader) {
      throw new Error("Required Cartwheel capital was not constructed");
    }
    storeRequiredRolePlan(progress, flight, { actors: [leader], role: "cartwheel-capital", site });
  } finally {
    planningRequiredWorld.delete(projection);
  }
}

/** Uses the same prevalidated full-state transfer as the other authored role plans. */
export function activateRequiredCartwheelRoute(
  content: GameContent,
  progress: GalaxyProgress,
  flight: FlightState,
  id: string,
): boolean {
  return flight.galaxy === 2 && id === CARTWHEEL_STORY_SHIPS.station
    ? activateRequiredWhirlpoolRoute(content, progress, flight, id)
    : true;
}

/** Authored model eligibility transfers reserved full states once after geometry validation. */
export function activateRequiredWhirlpoolRoute(
  content: GameContent,
  progress: GalaxyProgress,
  flight: FlightState,
  id: string,
): boolean {
  const plan = readRequiredRolePlan(flight, id);
  if (!plan) {
    return true;
  }
  const otherPlans = Object.values(flight.requiredPlans ?? {}).filter((entry) => entry !== plan);
  const projection = {
    ...flight,
    objects: [
      ...stationPopulationObjects(flight),
      plan.site,
      ...otherPlans.flatMap((entry) => [entry.site, ...requiredPlanActors(entry)]),
    ],
  };
  if (!stationFormationClear(questGuardPlacementContext(content, projection), plan.actors)) {
    return false;
  }
  const transferred = takeRequiredRolePlan(progress, flight, id);
  if (!transferred) {
    return false;
  }
  if (transferred.role === "whirlpool-sounder") {
    reserveWhirlpoolDiskSite(flight, transferred.site);
    restoreWhirlpoolSounder(content, transferred.actors, flight);
    return true;
  }
  for (const actor of [transferred.site, ...transferred.actors]) {
    canonicalObject(flight, actor);
    flight.objects.push(actor);
  }
  const state = combat(flight);
  state.routeEncounters.push(id);
  for (const actor of transferred.actors) {
    const pack = actor.enemy?.packId;
    if (pack) {
      state.initialPackSizes[pack] = (state.initialPackSizes[pack] ?? 0) + 1;
    }
  }
  worldSyncFlightRegion(flightWorldContext(flight), content, flight);
  return true;
}

export function populateRequiredFlight(
  content: GameContent,
  progress: GalaxyProgress,
  siteIds: readonly string[],
  flight: FlightState,
): RequiredRoutePlanningResult {
  const result = planRequiredWorld(content, flight, siteIds, progress.requiredSites);
  if (result.status !== "planned") {
    return result;
  }
  for (const plan of result.plans) {
    const site = result.sites.find((candidate) => candidate.id === plan.siteId)!;
    storeRequiredPlan(progress, flight, { leader: plan.leader, site, support: [...plan.support] });
  }
  populateFlight(content, progress, flight);
  return result;
}

export function createFlight(
  content: GameContent,
  galaxy: GalaxyNumber,
  seed: number,
  progress: Pick<GalaxyProgress, "known">,
  loadout?: Loadout,
  encounterSeed?: number,
): FlightState {
  const flight = createUnpopulatedFlight(content, galaxy, seed, loadout, encounterSeed);
  populateFlight(content, progress, flight);
  return flight;
}

export function teleport(content: GameContent, target: string | Vec, flight: FlightState): boolean {
  if (flight.dangerFor > 0) {
    return false;
  }
  const point =
    typeof target === "string"
      ? flight.objects.find(
          (o) => (o.kind === "destination" || o.kind === "station") && o.id === target,
        )
      : target;
  if (!point) {
    return false;
  }
  beginFlightStep(flight);
  const arrival = { x: point.x, y: point.y };
  // Destinations and stations keep their calm arrival zones. A map waypoint can be the
  // centre of a pending encounter, so it gets arrival grace without changing the site's roster.
  if (typeof target === "string") {
    if (!arrivalPoints(flight).some((point) => point.x === arrival.x && point.y === arrival.y)) {
      flight.arrivals = [...(flight.arrivals ?? []), { ...arrival }];
    }
    clearLayoutObjects(
      (other) =>
        other.kind !== "enemy" ||
        worldDistance(flightWorldContext(flight), other, arrival) >=
          content.tuning.flight.arrivalCalm + other.radius,
      flight,
    );
  }
  generate(content, arrival, false, flight);
  flight.player = arrival;
  flight.velocity = { x: 0, y: 0 };
  flight.freshChunk = null;
  beginArrivalGrace(content, flight);
  const key = flightChunkKey(content, flight, arrival);
  markVisited(flight.visited, key);
  worldSyncFlightRegion(flightWorldContext(flight), content, flight);
  return true;
}

/** Removes `amount` HP from Ada's shield unless she is protected (adaProtected). */
function damage(amount: number, flight: FlightState): void {
  if (adaProtected(flight)) {
    return;
  }
  flight.shield = Math.max(0, flight.shield - amount);
  flight.sinceDamage = 0;
}
/**
 * Whether Ada's drawn ship reaches a pickup at `center`, by the one pickup rule: within the
 * pickup margin, in world units on the world plane, between the ship's drawn body and the
 * pickup's drawn `outline`, or its circle of `radius`.
 */
export function pickupTouched(
  content: GameContent,
  flight: FlightState,
  center: Vec,
  radius: number,
  outline: Parts | null = null,
): boolean {
  const margin = content.tuning.flight.pickupMargin;
  return outline
    ? outlinesContact(
        outline,
        worldPoint(flightWorldContext(flight), flight.player, center),
        shipBody(flight.facing),
        flight.player,
        margin,
      ) !== null
    : touchesAda(flight, center, radius + margin);
}
/**
 * Docks at a station within Talk range (gameplay/economy.md): Ada stops where she is. Returns
 * false unless that station is in this flight and in range.
 */
export function dockFlight(content: GameContent, id: string, flight: FlightState): boolean {
  const station = flight.objects.find(
    (object) =>
      object.id === id &&
      (object.kind === "station" || (object.kind === "destination" && id === HUB_STATION)),
  );
  if (
    !station ||
    worldDistance(flightWorldContext(flight), station, flight.player) > content.tuning.talkRange
  ) {
    return false;
  }
  flight.velocity = { x: 0, y: 0 };
  clearPilotHeading(flight);
  return true;
}
/**
 * Undocking leaves Ada at rest where she docked, so Use offers Dock again at once, and starts her
 * arrival grace.
 */
export function undockFlight(content: GameContent, flight: FlightState): void {
  flight.velocity = { x: 0, y: 0 };
  clearPilotHeading(flight);
  beginArrivalGrace(content, flight);
}
/**
 * Whether an enemy presses Ada: engaged, neither returning nor fleeing, within its perception,
 * with targetable saying Ada is not protected (adaProtected).
 */
function presses(targetable: boolean, flight: FlightState, object: SpaceObject): boolean {
  const state = object.enemy;
  return (
    targetable &&
    state !== undefined &&
    state.engaged &&
    !state.returning &&
    !state.fleeing &&
    !state.disabled &&
    worldDistance(flightWorldContext(flight), object, flight.player) <=
      enemyEquipmentDefinition(flight.galaxy, state).perception
  );
}

/** Whether drones are near: a live enemy presses Ada, as the danger it sets measures. */
export function dronesNear(flight: FlightState): boolean {
  const targetable = !adaProtected(flight);
  return flight.objects.some(
    (object) => object.kind === "enemy" && object.hp > 0 && presses(targetable, flight, object),
  );
}

/** Use existing escort berth and hull distances for the two opposite crossing paths. */
function planMantaEscorts(flight: FlightState, leader: SpaceObject): MantaEscortState | undefined {
  const world = flightWorldContext(flight);
  const home = leader.enemy!.home;
  const toward = worldDelta(world, home, FLIGHT_START);
  const forward = length(toward) > 0 ? direction(toward) : { x: 1, y: 0 };
  const gap = spacingRadius(ROUTE_POSITION[flight.galaxy], leader.enemy!) + escortTuning.stationGap;
  const clear = (from: Vec, to: Vec) =>
    !flight.objects.some(
      (object) =>
        SCENERY.includes(object.kind) &&
        object.hp > 0 &&
        worldSceneryBlocksSegment(
          world,
          object,
          from,
          to,
          0,
          frameOf(flight, object),
          drawnOf(flight, object),
        ),
    );
  const course = (escort: MantaEscortIndex) => {
    const side = escort === 0 ? 1 : -1;
    const point = (offset: Vec) => ({ x: home.x + offset.x, y: home.y + offset.y });
    // Keep the two escorts on opposite sides and move a blocked pass outwards past the terrain.
    for (const offset of [0, escortTuning.stationGap / 2, escortTuning.stationGap]) {
      const distance = gap + offset;
      const station = { x: -forward.y * distance * side, y: forward.x * distance * side };
      for (const span of [escortTuning.stationGap, escortTuning.stationGap / 2]) {
        const entry = {
          x: station.x - forward.x * span * side,
          y: station.y - forward.y * span * side,
        };
        const exit = {
          x: station.x + forward.x * span * side,
          y: station.y + forward.y * span * side,
        };
        if (
          clear(point(entry), point(exit)) &&
          clear(point(station), point(entry)) &&
          clear(point(exit), point(station))
        ) {
          return mantaEscortCourse(
            {
              current: worldFlowAt(world, flight.galaxy, point(station)),
              reverseIsClear: true,
            },
            { entry, exit, station },
          );
        }
      }
    }
    return undefined;
  };
  const first = course(0);
  const second = course(1);
  return first && second ? { courses: [first, second], elapsed: 0 } : undefined;
}

function enemies(
  viewport: Readonly<Pick<PlayerWeaponCoverageContext, "viewportHeight" | "viewportWidth">>,
  content: GameContent,
  dt: number,
  playerDisplacement: Vec,
  admitEnemy: FlightInput["admitEnemy"],
  flight: FlightState,
  events: FlightEvent[],
  shotDelays: Map<string, number>,
): ReadonlySet<SpaceObject> | undefined {
  // Once the flagship is salvaged Phantom's drones stand down: they patrol home and never fire.
  const standDown = flight.galaxy === 6 && flight.phantom?.phase === "salvaged";
  if (standDown) {
    flight.shots = flight.shots.filter((shot) => !shot.enemy);
    if (flight.pendingPellets) {
      flight.pendingPellets = flight.pendingPellets.filter(({ shot }) => !shot.enemy);
    }
    flight.mines = [];
    for (const object of flight.objects) {
      if (object.enemy) {
        object.enemy.engaged = false;
      }
    }
  }
  const aimVelocity = averageAimVelocity(dt, flight);
  // A salvaged heavy is powered down: it neither moves nor fires, and nothing collides with it.
  const objects = flight.objects.filter(
    (object) => object.kind === "enemy" && object.hp > 0 && !object.enemy?.salvaged,
  );
  let withheld: Set<SpaceObject> | undefined;
  for (const object of objects) {
    // Legacy saved ships gain canonical state without resetting their damage or identity.
    if (!object.enemy) {
      object.enemy = createEnemy(
        enemyCatalog.fighter,
        { archetype: "fighter", id: object.id, packId: null, phase: 0 },
        object,
      );
      object.enemy.hp = object.hp;
      // Its saved damage is not a fresh hit.
      object.enemy.tactic.integrity = enemyIntegrity(object.enemy);
    }
    if (admitEnemy?.(flight, object) === false) {
      (withheld ??= new Set()).add(object);
      // A previously engaged actor must also forget its last target or it can keep investigating.
      object.enemy.engaged = false;
      object.enemy.lastSeen = null;
    }
    // Hit circles follow the catalog, so saves from earlier sizes adopt the current ones.
    object.radius = enemyRadiusForFlight(
      flight,
      object.enemy,
      content.tuning.flight.shipRadius * ENEMY_SIZE_RATIOS[object.enemy.archetype],
    );
  }
  const loadedPeers = objects.flatMap((object) => (object.enemy ? [object.enemy] : []));
  const loadedPackMembers: Record<string, number> = Object.create(null);
  for (const peer of loadedPeers) {
    if (peer.hp > 0 && peer.packId !== null) {
      loadedPackMembers[peer.packId] = (loadedPackMembers[peer.packId] ?? 0) + 1;
    }
  }
  Object.freeze(loadedPackMembers);
  const peers = loadedPeers.filter((peer) => peer.hp > 0 && !peer.disabled);
  const visibility = new Map(
    objects.map((object) => {
      const visible = !flight.objects.some(
        (obstacle) =>
          SCENERY.includes(obstacle.kind) &&
          obstacle.hp > 0 &&
          worldSceneryBlocksSegment(
            flightWorldContext(flight),
            obstacle,
            object,
            worldPoint(flightWorldContext(flight), object, flight.player),
            0,
            frameOf(flight, obstacle),
            drawnOf(flight, obstacle),
          ),
      );
      return [object.id, visible] as const;
    }),
  );
  const eligible = new Set(
    objects
      .filter((object) => {
        const definition = enemyEquipmentDefinition(flight.galaxy, object.enemy!);
        return (
          !withheld?.has(object) &&
          definition.aggression === "sight" &&
          visibility.get(object.id) &&
          !adaProtected(flight) &&
          worldDistance(flightWorldContext(flight), object, flight.player) <= definition.perception
        );
      })
      .map((object) => object.id),
  );
  const admissions = worldRegionalEngagementAdmissions(
    hostileStationContext(flight),
    SPAWNER_POLICIES[flight.galaxy],
    requiredPopulation(flight),
    eligible,
    flight.player,
  );
  const activeSong = activePhantomSong(flight.phantom?.allies ?? []);
  let industrialAsteroids: ReturnType<typeof retaliatorAsteroidQuery> | undefined;
  for (const object of objects) {
    const state = object.enemy!;
    const base = enemyEquipmentDefinition(flight.galaxy, state);
    const blockade = phantomBlockade(flight.galaxy, object);
    const song = phantomSongSpeed(activeSong, object);
    const definition =
      song === 1
        ? base
        : { ...base, physics: { ...base.physics, maxSpeed: base.physics.maxSpeed * song } };
    const combatAllowed = !standDown && !withheld?.has(object);
    const targetable = combatAllowed && !adaProtected(flight);
    const summoned = combatAllowed && flight.summonedGuards?.includes(object.id) === true;
    const visible = visibility.get(object.id)!;
    const before = { x: object.x, y: object.y };
    const escortLeader =
      object.role === FRIGATE_ESCORT_ROLE
        ? flight.objects.find(
            (other) => other.id === state.escortOf && other.hp > 0 && !other.enemy?.disabled,
          )
        : undefined;
    const approach = escortLeader
      ? frigateEscortStation(ROUTE_POSITION[flight.galaxy], escortLeader, state.phase)
      : flight.player;
    const industrialVariant = retaliatorVariant(state);
    const minerOffset =
      industrialVariant && MINING_HULLS.includes(industrialVariant)
        ? spacingRadius(ROUTE_POSITION[flight.galaxy], state) + ENEMY_KEEP_MOVING.edgeGap
        : null;
    const navigationQuery = worldNavigationQuery(
      {
        ...flightWorldContext(flight),
        drawnOf: (entry) => drawnOf(flight, entry),
        frameOf: (entry) => frameOf(flight, entry),
        // A miner checks its traced rock at the edge gap instead of the avoidance berths.
        ...(minerOffset !== null && state.miner?.rock
          ? { traced: { clearance: ENEMY_KEEP_MOVING.edgeGap / 2, id: state.miner.rock } }
          : {}),
      },
      flight.objects,
      definition,
      { ...state, position: before, radius: object.radius },
    );
    const stationGuardAnchor = guardPatrolFrame(content, flight, object);
    const industrialBody = industrialVariant
      ? enemyPhysicalBody(ROUTE_POSITION[flight.galaxy], state)
      : null;
    const industrialInput =
      industrialVariant && definition.navigation && industrialBody
        ? { physicalReach: partsReach(worldParts(industrialBody)) }
        : undefined;
    const minerFacts =
      minerOffset !== null && definition.navigation
        ? minerInput(
            content,
            flight,
            () =>
              (industrialAsteroids ??= retaliatorAsteroidQuery(
                flightWorldContext(flight),
                content.tuning.chunkSize,
                flight.objects,
              )),
            minerOffset,
            object,
          )
        : undefined;
    // Small craft drift with a current; frigates, capitals and platforms are too heavy.
    const drift = DRIFT_PROOF.includes(state.archetype)
      ? { x: 0, y: 0 }
      : worldFlowAt(flightWorldContext(flight), flight.galaxy, object);
    const kind = earlyEncounterKind(flight.galaxy, object.id);
    if (kind === "hammer" && !state.earlyEncounter) {
      state.earlyEncounter = { kind, phase: "ready" };
    }
    if (
      kind === "crossbow" &&
      !state.earlyEncounter &&
      (state.engaged || admissions.has(object.id))
    ) {
      state.earlyEncounter = { elapsed: 0, kind };
    }
    const early = state.earlyEncounter;
    const lanceAvailable =
      early?.kind === "hammer" &&
      !state.disabled &&
      definition.hardpoints.some(
        (part) =>
          part.id === EARLY_LANCE_MOUNT &&
          part.kind === "weapon" &&
          part.fire.weapon === "chargedLance",
      ) &&
      state.hardpoints.some((part) => part.id === EARLY_LANCE_MOUNT && part.hp > 0);
    if (early?.kind === "hammer" && early.phase === "ready" && !lanceAvailable) {
      state.earlyEncounter = { kind: "hammer", phase: "complete" };
    }
    const manta = escortLeader?.id === WHIRLPOOL_CAPITAL_BOSS.id ? escortLeader : undefined;
    if (
      manta?.enemy &&
      !manta.enemy.earlyEncounter &&
      (manta.enemy.engaged || admissions.has(manta.id))
    ) {
      const escortPlan = planMantaEscorts(flight, manta);
      if (escortPlan) {
        manta.enemy.earlyEncounter = { ...escortPlan, kind: "manta" };
      }
    }
    const mantaState = manta?.enemy?.earlyEncounter;
    const escort =
      manta && state.id === requiredFrigateEscortId(manta.id, 0)
        ? 0
        : manta && state.id === requiredFrigateEscortId(manta.id, 1)
          ? 1
          : undefined;
    const command =
      escort !== undefined && mantaState?.kind === "manta"
        ? mantaEscortCommand(mantaState, { escort, leader: manta! })
        : undefined;
    let firstTellDue = false;
    let lanceFailed = false;
    const allowAttack =
      kind === "crossbow"
        ? (attack: EnemyAttackOpportunity) =>
            crossbowAttack(
              { content, coverage: { ...viewport, centre: before }, flight },
              object,
              attack,
            )
        : early?.kind === "hammer" && early.phase !== "complete"
          ? (attack: EnemyAttackOpportunity) => {
              const allowed =
                !firstTellDue &&
                hammerAllowsMount({ lanceAvailable, phase: early.phase }, attack.hardpointId);
              if (allowed && lanceAvailable && attack.hardpointId === EARLY_LANCE_MOUNT) {
                if (!length(attack.aim)) {
                  lanceFailed = true;
                  return false;
                }
                firstTellDue = true;
              }
              return allowed;
            }
          : escort !== undefined && mantaState?.kind === "manta"
            ? (attack: EnemyAttackOpportunity) =>
                mantaEscortMayFire(mantaState.elapsed + attack.delay, escort)
            : undefined;
    const intent = stepEnemy(
      definition,
      {
        ...flightWorldContext(flight),
        adaWidth: content.tuning.flight.shipRadius * 2,
        ...(allowAttack ? { allowAttack } : {}),
        dormantPackMembers: worldRetainedPackMembers(flightWorldContext(flight), content, flight),
        dt,
        enemyDrift: drift,
        engagementAdmitted: admissions.has(object.id),
        ...(command ? { escortTarget: command.target } : {}),
        // An enemy fires only while it is inside the visible game area.
        inPlayView: insidePlayView(viewport.viewportWidth, flight, object),
        initialPackSizes: combat(flight).initialPackSizes,
        lead: ENEMY_AIM.lead[ROUTE_POSITION[flight.galaxy]],
        loadedPackMembers,
        ...(minerFacts ? { miner: minerFacts } : {}),
        ...(navigationQuery ? { navigationQuery } : {}),
        packSpacing: SPAWNER_POLICIES[flight.galaxy].memberSpacing,
        peers,
        player: flight.player,
        playerDisplacement,
        playerVelocity: aimVelocity,
        pursuitHomeRadius: actorPursuitHomeRadius(
          flight.galaxy,
          definition.pursuit.homeRadius,
          blockade,
          object,
        ),
        routePosition: ROUTE_POSITION[flight.galaxy],
        ...(industrialInput ? { retaliatorNavigation: industrialInput } : {}),
        ...(stationGuardAnchor ? { stationGuardAnchor } : {}),
        summoned,
        ...(summoned
          ? {
              summonTarget: guardApproach(
                flightWorldContext(flight),
                flight.objects.flatMap((other) => {
                  const radius = exclusionZoneRadius(content, other);
                  return radius === null ? [] : [{ radius, x: other.x, y: other.y }];
                }),
                approach,
                object,
              ),
            }
          : {}),
        targetable,
        visibility: visible ? "visible" : "occluded",
      },
      { ...state, position: { x: object.x, y: object.y } },
    );
    const launchVelocity = { ...intent.velocity };
    object.enemy = intent.state;
    if (lanceFailed) {
      object.enemy.earlyEncounter = { kind: "hammer", phase: "complete" };
    }
    if (intent.effects.defeated) {
      queueHostileStationReward(flight, events, object);
      destroyEnemy(object, flight);
      events.push({ id: object.id, type: "enemyDestroyed" });
      continue;
    }
    let velocity = intent.velocity;
    // Only a ship under power slides along a peer or a limit; one coasting keeps to its physics.
    const powered =
      definition.navigation !== null && !intent.effects.disabled && !intent.effects.movementStopped;
    // Enemies bounce off scenery by the same rule as Ada; exclusion zones and peers still block.
    const { sceneryRecoil, sceneryRestitution } = content.tuning.flight;
    const onContact = (normal: Vec, surface: Vec): void => {
      velocity = bounce(sceneryRestitution, sceneryRecoil, normal, surface, velocity);
      object.enemy!.velocity = { ...velocity };
    };
    const steps = Math.max(
      1,
      Math.ceil((Math.hypot(velocity.x + drift.x, velocity.y + drift.y) * dt) / 4),
    );
    for (let i = 0; i < steps; i++) {
      if (powered) {
        velocity = keepClear(
          content,
          flight,
          Boolean(blockade),
          definition.physics.maxSpeed * intent.effects.thrust * ENEMY_KEEP_MOVING.minimumShare,
          velocity,
          drift,
          dt / steps,
          object,
        );
      }
      object.enemy.velocity = { ...velocity };
      /** A live peer blocks `point`, unless the move takes the ships apart. */
      const peerBlocks = (point: Vec): boolean =>
        flight.objects.some(
          (other) =>
            other !== object &&
            exclusionZoneRadius(content, other) === null &&
            other.kind === "enemy" &&
            other.hp > 0 &&
            !other.enemy?.salvaged &&
            worldDistance(flightWorldContext(flight), other, point) < enemySpacing(object, other) &&
            worldDistance(flightWorldContext(flight), other, point) <=
              worldDistance(flightWorldContext(flight), other, object),
        );
      // A powered ship sliding along a contact moves on both axes at once, since one axis of a
      // slide alone closes on the peer.
      const sliding =
        powered &&
        !peerBlocks({
          x: object.x + ((velocity.x + drift.x) * dt) / steps,
          y: object.y + ((velocity.y + drift.y) * dt) / steps,
        });
      for (const axis of ["x", "y"] as const) {
        const point = { x: object.x, y: object.y };
        point[axis] += ((velocity[axis] + drift[axis]) * dt) / steps;
        if (blockade && !object.enemy.fleeing) {
          const offset = worldDelta(flightWorldContext(flight), object.enemy.home, point);
          const reach = length(offset);
          if (reach > PHANTOM_TUNING.blockadeReach) {
            point.x = object.enemy.home.x + (offset.x / reach) * PHANTOM_TUNING.blockadeReach;
            point.y = object.enemy.home.y + (offset.y / reach) * PHANTOM_TUNING.blockadeReach;
          }
        }
        const blocked =
          needleChannelContains({ radius: object.radius }, flight, point) ||
          flight.objects.some(
            (other) =>
              other !== object &&
              exclusionZoneRadius(content, other) !== null &&
              worldDistance(flightWorldContext(flight), other, point) <
                (exclusionZoneRadius(content, other) ?? 0) + object.radius,
          ) ||
          (!sliding && peerBlocks(point));
        if (!blocked) {
          object[axis] = point[axis];
        } else {
          object.enemy.velocity[axis] = 0;
        }
      }
      const point = { x: object.x, y: object.y };
      const hull = enemyHull(object.enemy, ROUTE_POSITION[flight.galaxy]);
      resolveScenery(
        sceneryResolution,
        flight,
        (obstacle, position, frame, drawn) =>
          hull
            ? worldSceneryBodyContact(
                flightWorldContext(flight),
                obstacle,
                position,
                hull,
                frame,
                0,
                drawn,
              )
            : worldSceneryContact(
                flightWorldContext(flight),
                obstacle,
                position,
                object.radius,
                frame,
                drawn,
              ),
        onContact,
        point,
      );
      object.x = point.x;
      object.y = point.y;
    }
    canonicalPosition(flight, object);
    object.enemy.position = { x: object.x, y: object.y };
    if (bounceShips(content, flight, object)) {
      damage(SHIP_IMPACT_DAMAGE, flight);
      hit(content, SHIP_IMPACT_DAMAGE, null, object, flight, events);
      if (object.hp <= 0) {
        continue;
      }
    }
    const coverage = { ...viewport, centre: before };
    const rings = new Map<number, Vec[]>();
    // A Multi-Laser volley's bolts share their delay and muzzle, and draw as one fan.
    const volley = (fire: (typeof intent.fire)[number]) =>
      `${fire.delay}:${fire.origin.x}:${fire.origin.y}`;
    const fans = new Map<string, number>();
    for (const fire of intent.fire) {
      if (fire.weapon === "multiLaser" && fire.projectile === "bolt") {
        fans.set(volley(fire), (fans.get(volley(fire)) ?? 0) + 1);
      }
    }
    for (const fire of intent.fire) {
      const amount = content.tuning.flight.playerShotDamage * fire.damageRatio;
      const shared = enemyOnly(fire.weapon) ? null : weaponAt(fire.weapon, fire.level);
      if (fire.projectile === "beam") {
        const beam = chargeEnemyBeam(
          amount,
          shared ? enemyBeamReach(coverage, fire) : 0,
          before,
          fire,
          object.id,
          flight,
        );
        if (
          beam &&
          beam.kind === "lance" &&
          beam.hardpointId === EARLY_LANCE_MOUNT &&
          (firstTellDue || early?.kind === "crossbow")
        ) {
          rememberEarlyLance(object, beam, "started");
        }
        continue;
      }
      if (fire.projectile === "mine") {
        layMine(amount, fire, object.id, flight);
        continue;
      }
      if (fire.weapon === "ringBurst") {
        rings.set(fire.delay, [...(rings.get(fire.delay) ?? []), fire.origin]);
      }
      const id = `shot:${flight.nextId++}`;
      // A shared weapon keeps its range, fade and blast whoever fires it.
      const lifetime = content.tuning.flight.enemyProjectileLifetime;
      const launch = planEnemyProjectile(
        {
          baseLifetime: lifetime,
          coverage,
          definition: shared,
          inheritedVelocity: launchVelocity,
        },
        fire,
      );
      const shot: Shot = {
        ...fire.origin,
        ...launch,
        damage: amount,
        effectFamily: impactFamily(fire.weapon),
        enemy: true,
        ...(fire.weapon === "ringBurst" ? { enemyWeapon: "ringBurst" as const } : {}),
        ...(fire.weapon === "multiLaser" && (fans.get(volley(fire)) ?? 0) > 1
          ? { fan: { count: fans.get(volley(fire))!, origin: { ...fire.origin } } }
          : {}),
        hitIds: [],
        id,
        piercing: false,
        projectile: fire.projectile,
      };
      if (fire.weapon === "scattershot" && fire.delay >= dt) {
        (flight.pendingPellets ??= []).push({ delay: fire.delay, shot });
      } else {
        shotDelays.set(id, fire.delay);
        flight.shots.push(shot);
      }
    }
    for (const [delay, origins] of rings) {
      const emissions = ringEmissions.get(flight) ?? [];
      emissions.push({
        age: -delay,
        at: { ...before },
        origins,
        spawnRadius: content.tuning.flight.shipRadius * definition.sizeRatio,
      });
      ringEmissions.set(flight, emissions);
    }
  }
  return withheld;
}

/** A ring burst's emission at its hull, view-only and never saved. */
export interface RingEmission {
  age: number;
  at: Vec;
  origins: readonly Vec[];
  spawnRadius: number;
}
const ringEmissions = new WeakMap<FlightState, RingEmission[]>();
/** How long a ring burst's emission shows (art/weapons.md "Ring burst"). */
const RING_EMISSION_SECONDS = 0.18;

/** The flight's ring burst emissions still showing. */
export function activeRingEmissions(flight: FlightState): readonly RingEmission[] {
  return ringEmissions.get(flight) ?? [];
}

/** A shot's strike against a mine's drawn silhouette: a 6 px square about the shot. */
const SHOT_PARTS: Parts = [
  [
    { x: -3, y: -3 },
    { x: 3, y: -3 },
    { x: 3, y: 3 },
    { x: -3, y: 3 },
  ],
];

const mineStrike = { blast, shotParts: SHOT_PARTS, shotRadius };

function shots(
  content: GameContent,
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
      const from = { x: shot.x, y: shot.y };
      const radius = shotRadius(shot);
      const next = {
        x: shot.x + (shot.velocity.x * travelTime) / steps,
        y: shot.y + (shot.velocity.y * travelTime) / steps,
      };
      shot.x = next.x;
      shot.y = next.y;
      canonicalPosition(flight, shot);
      if (shot.enemy) {
        const struck = touchesAda(flight, shot, radius);
        if (struck && adaProtected(flight)) {
          shot.life = 0;
          continue;
        }
        const blocked = flight.objects.find(
          (object) =>
            SCENERY.includes(object.kind) &&
            object.hp > 0 &&
            projectileSceneryContact(projectileScenery, flight, object, shot, radius),
        );
        if (!struck && !blocked) {
          continue;
        }
        const bodyContact = outlineContact(shipBody(flight.facing), flight.player, shot, radius);
        const point = blocked
          ? projectileContact(projectileScenery, flight, blocked, shot, radius, from)
          : bodyContact
            ? impactSurface({ contact: bodyContact, projected: false, radius }, shot)
            : shot;
        shot.x = point.x;
        shot.y = point.y;
        shot.life = 0;
        enemyImpact(shot, struck, flight);
        continue;
      }
      if (shot.damage === undefined) {
        shot.life = 0;
        continue;
      }
      if (strikeMines(mineStrike, content, shot, flight, events)) {
        continue;
      }
      strike(content, shot, flight, events, from);
    }
    // A missile still flying at the end of its reach explodes where it is.
    const reachEnd = shot.life > 0 && shot.life <= elapsed;
    shot.life = Math.max(0, shot.life - elapsed);
    if (reachEnd && shot.blast !== undefined) {
      if (shot.enemy) {
        enemyImpact(shot, false, flight);
      } else {
        blast(content, shot.damage, shot.blast, shot, null, flight, events);
      }
    }
  }
  flight.shots = flight.shots.filter((s) => s.life > 0);
  for (const object of flight.objects) {
    if (object.hp <= 0) {
      worldRecordObjectRemoval(flightWorldContext(flight), content, object, flight);
    }
  }
  flight.objects = flight.objects.filter((o) => o.hp > 0);
}

/**
 * An enemy shot spent on Ada, an obstacle or the end of its reach: a missile's blast shows and
 * damages Ada within its radius, and a direct hit damages her; either way, once.
 */
function enemyImpact(shot: Shot, struck: boolean, flight: FlightState): void {
  if (shot.blast === undefined && shot.effectFamily && shot.life <= 0) {
    recordProjectileImpact(flight, {
      ...shot,
      age: 0,
      direction: { ...shot.velocity },
      family: shot.effectFamily,
      id: shot.id,
      targetId: "",
    });
  }
  if (shot.blast !== undefined) {
    recordBlastFlash(flight, { age: 0, radius: shot.blast, x: shot.x, y: shot.y });
  }
  if (struck || (shot.blast !== undefined && blastCoversAda(flight, shot, shot.blast))) {
    damage(shot.damage, flight);
  }
}

/**
 * Ada's shot strikes every enemy and obstacle it touches at its position that it has not struck,
 * until it is spent; a large hull only takes it at a live hardpoint.
 */
function strike(
  content: GameContent,
  shot: Shot,
  flight: FlightState,
  events: FlightEvent[],
  from?: Vec,
): void {
  if (shot.damage === undefined) {
    return;
  }
  for (const object of flight.objects) {
    if (
      !["enemy", ...SCENERY].includes(object.kind) ||
      object.hp <= 0 ||
      object.enemy?.salvaged ||
      shot.hitIds.includes(object.id) ||
      (object.kind === "enemy"
        ? !enemyTouched(flight, ROUTE_POSITION[flight.galaxy], object, shot, shotRadius(shot))
        : !projectileSceneryContact(projectileScenery, flight, object, shot, shotRadius(shot)))
    ) {
      continue;
    }
    shot.hitIds.push(object.id);
    const part = hitPart(content, flight, partReach(content), shotRadius(shot), shot, object);
    const at = projectileContact(
      projectileScenery,
      flight,
      object,
      shot,
      shotRadius(shot),
      from,
      part,
    );
    recordProjectileImpact(flight, {
      ...at,
      age: 0,
      id: `${shot.id}:${object.id}`,
      targetId: object.id,
      ...(shot.effectFamily ? { direction: { ...shot.velocity }, family: shot.effectFamily } : {}),
    });
    hit(content, shot.damage, part, object, flight, events);
    if (shot.blast !== undefined) {
      blast(content, shot.damage, shot.blast, at, object, flight, events);
    }
    if (!shot.piercing) {
      shot.life = 0;
    }
    if (shot.life <= 0) {
      break;
    }
  }
}

/** Damages an enemy (at a hardpoint, or its hull for null) or scenery, then resolves its loss. */
function hit(
  content: GameContent,
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
    const before = object.enemy;
    const definition = enemyEquipmentDefinition(flight.galaxy, before);
    const after = damageEnemy(definition, { amount, hardpointId: part }, before);
    object.enemy = after;
    object.hp = enemyDefeated(after) ? 0 : Math.max(1, after.hp);
    if ((!before.disabled && after.disabled) || object.hp <= 0) {
      queueHostileStationReward(flight, events, object);
    }
    if (object.hp > 0 && !before.disabled && after.disabled) {
      events.push({ id: object.id, type: "enemyDisabled" });
    } else if (
      (object.id === PHANTOM_FLAGSHIP ||
        object.id === CARTWHEEL_CLAIM.id ||
        object.id === NEEDLE_CADENCE.id ||
        object.id === ANDROMEDA_REDACT.id) &&
      part !== null &&
      object.hp > 0 &&
      !before.disabled &&
      !after.disabled &&
      before.hardpoints.every(({ hp }) => hp > 0) &&
      after.hardpoints.some(({ hp, id }) => id === part && hp === 0)
    ) {
      events.push({ id: object.id, type: "enemyFirstHardpointLost" });
    }
    if (
      object.id === CARTWHEEL_CLAIM.id &&
      part !== null &&
      object.hp > 0 &&
      !before.disabled &&
      !after.disabled &&
      definition.hardpoints.some(
        (mount) =>
          mount.id === part && mount.kind === "weapon" && mount.fire.weapon === "mineLayer",
      ) &&
      before.hardpoints.some(({ hp, id }) => id === part && hp > 0) &&
      after.hardpoints.some(({ hp, id }) => id === part && hp === 0)
    ) {
      events.push({ hardpointId: part, id: object.id, type: "enemyMineLayerDisabled" });
    }
  } else {
    object.hp -= amount;
  }
  if (object.hp > 0) {
    return;
  }
  if (object.kind === "enemy") {
    destroyEnemy(object, flight);
    events.push({ id: object.id, type: "enemyDestroyed" });
  }
  if (object.asteroid) {
    events.push({
      asteroid: object.asteroid,
      ...(object.crystals ? { crystals: object.crystals } : {}),
      id: object.id,
      type: "asteroidDestroyed",
      x: object.x,
      y: object.y,
    });
  }
  if (object.kind === "debris") {
    events.push({ id: object.id, type: "debrisCleared" });
  }
  // A planned moving rock drops loot like the static rock it was chosen from.
  if (object.kind === "rock" || object.id.startsWith(MOVING_ROCK_PREFIX)) {
    dropFromRock(content, object, flight);
  }
}

/**
 * A missile's blast is a circle on screen of radius `radius` about the impact (gameplay/rules.md
 * "Missiles"): it deals full damage to every other live enemy or rock whose drawn shape
 * overlaps it. A multipart ship takes it at the live hardpoint it covers deepest. Armed mines
 * whose centre it covers pop. The blast shows one flash, which stands in for
 * the destruction flash of every enemy the impact destroys, the struck one included. `struck`,
 * damaged directly by its hit, is null for a missile that exploded at the end of its reach.
 */
function blast(
  content: GameContent,
  amount: number,
  radius: number,
  at: Vec,
  struck: SpaceObject | null,
  flight: FlightState,
  events: FlightEvent[],
): void {
  recordBlastFlash(flight, { age: 0, radius, x: at.x, y: at.y });
  for (const mine of flight.mines) {
    if (armed(mine) && screenGap(flight, at, mine) <= radius) {
      mine.end = { age: 0, kind: "pop" };
    }
  }
  for (const object of [...flight.objects]) {
    if (object === struck || object.hp <= 0 || object.enemy?.salvaged) {
      continue;
    }
    if (object.kind !== "enemy") {
      if (
        (object.kind === "rock" || (object.kind === "debris" && object.asteroid)) &&
        blastCoversRock(flight, radius, at, object)
      ) {
        hit(content, amount, null, object, flight, events);
      }
      continue;
    }
    const covered = blastCover(content, flight, radius, at, object);
    if (covered === null) {
      continue;
    }
    hit(content, amount, covered.part, object, flight, events);
    markBlasted(object, flight);
  }
  if (struck) {
    markBlasted(struck, flight);
  }
}

/** Circle-to-frame coverage, including exact edge contact after projection and wrapping. */
function blastCoversRock(
  flight: FlightState,
  radius: number,
  at: Vec,
  object: SpaceObject,
): boolean {
  const offset = toScreen(worldDelta(flightWorldContext(flight), object, at));
  const drawn = scenerySilhouette(object);
  // Nearest-image subtraction and projection can round a tangent just outside the edge.
  const reach = radius + 1e-9;
  if (Math.hypot(offset.x, offset.y) > (drawn?.reach ?? object.radius) + reach) {
    return false;
  }
  if (!drawn) {
    return coversFallbackRock(offset, object.radius, reach);
  }
  const frame = drawn.frames[frameOf(flight, object)] ?? drawn.frames[0]!;
  return frame.some(
    (part) =>
      inside(part, offset) ||
      part.some(
        (corner, index) =>
          segmentDistance(offset, corner, part[(index + 1) % part.length]!) <= reach,
      ),
  );
}

/** The nearest point on the legacy fallback drawing, an ellipse 70% as tall as it is wide. */
function coversFallbackRock(offset: Vec, widthRadius: number, blastRadius: number): boolean {
  const heightRadius = widthRadius * 0.7;
  if (widthRadius === 0 || Math.hypot(offset.x / widthRadius, offset.y / heightRadius) <= 1) {
    return true;
  }
  const a = widthRadius ** 2;
  const b = heightRadius ** 2;
  let low = 0;
  let high = widthRadius * Math.hypot(offset.x, offset.y);
  // Solve for the normal from the nearest point on the ellipse to the circle centre.
  for (let step = 0; step < 40; step++) {
    const t = (low + high) / 2;
    if (Math.hypot((widthRadius * offset.x) / (a + t), (heightRadius * offset.y) / (b + t)) > 1) {
      low = t;
    } else {
      high = t;
    }
  }
  return Math.hypot((offset.x * high) / (a + high), (offset.y * high) / (b + high)) <= blastRadius;
}

/**
 * Where a beam first meets a scenery object where it is drawn (its silhouette, else its circle),
 * within the beam half-width: the bounding circle's entry, refined in 2-unit steps.
 */
function sceneryEntry(
  flight: FlightState,
  origin: Vec,
  direction: Vec,
  range: number,
  frame: number,
  drawn: Silhouette | null,
  object: SpaceObject,
  halfWidth: number = BEAM.halfWidth,
): number | null {
  const imageObject = flight.topology
    ? { ...object, ...worldPoint(flightWorldContext(flight), origin, object) }
    : object;
  const bound = sceneryBound(imageObject, halfWidth, drawn);
  const entry = rayCircle(origin, direction, range, imageObject, bound);
  if (entry === null || !drawn) {
    return entry;
  }
  const exit = Math.min(range, entry + 2 * bound);
  return (
    sampleBeam(origin, direction, entry, exit, (point) =>
      halfWidth === BEAM.halfWidth
        ? outlineContact(drawn.frames[frame] ?? drawn.frames[0]!, imageObject, point, halfWidth)
        : worldSceneryContact(
            flightWorldContext(flight),
            imageObject,
            point,
            halfWidth,
            frame,
            drawn,
          ),
    )?.at ?? null
  );
}

function fireBeam(
  coverage: PlayerWeaponCoverageContext,
  content: GameContent,
  definition: WeaponDefinition,
  aim: Vec,
  origin: Vec,
  flight: FlightState,
  events: FlightEvent[],
): void {
  const span = length(aim);
  const range = playerWeaponCoverage(coverage, { direction: aim, origin });
  if (!span || range <= 0) {
    return;
  }
  const heading = { x: aim.x / span, y: aim.y / span };
  const world = flightWorldContext(flight);
  const halfWidth = BEAM.halfWidth;
  type Contact = { at: number; part: string | null; point: Vec };
  const line = { halfWidth, heading, origin, range };
  const outlineStrike = (center: Vec, outline: Parts) =>
    outlineBeamStrike(line, worldPoint(world, origin, center), outline);
  const circleStrike = (center: Vec, radius: number) => {
    const image = worldPoint(world, origin, center);
    const at = rayCircle(origin, heading, range, image, radius + halfWidth);
    if (at === null) {
      return null;
    }
    const point = beamPoint(origin, heading, at);
    const normal = { x: point.x - image.x, y: point.y - image.y };
    return { at, point: beamPoint(image, length(normal) ? direction(normal) : heading, radius) };
  };
  const strikes: (Contact & { object: SpaceObject })[] = [];
  for (const object of flight.objects) {
    if (object.hp <= 0) {
      continue;
    }
    if (SCENERY.includes(object.kind)) {
      const at = sceneryEntry(
        flight,
        origin,
        heading,
        range,
        frameOf(flight, object),
        drawnOf(flight, object),
        object,
      );
      if (at !== null) {
        const sample = beamPoint(origin, heading, at);
        const point = projectileContact(projectileScenery, flight, object, sample, halfWidth);
        strikes.push({ at, object, part: null, point });
      }
    } else if (object.kind === "enemy" && object.enemy && !object.enemy.salvaged) {
      const position = ROUTE_POSITION[flight.galaxy];
      const hull = enemyHull(object.enemy, position);
      const body = hull ? outlineStrike(object, hull) : circleStrike(object, object.radius);
      let first: Contact | null = body && { ...body, part: null };
      for (const part of liveParts(content, flight.galaxy, object)) {
        const outline = enemyPartOutline(position, object.enemy, part.id);
        const strike = outline
          ? outlineStrike(object, outline)
          : circleStrike(part, partReach(content));
        // A live hardpoint wins a tie with its hull, as for the original beam.
        if (
          strike &&
          (!first || strike.at < first.at || (strike.at === first.at && first.part === null))
        ) {
          first = { ...strike, part: part.id };
        }
      }
      if (first) {
        strikes.push({ ...first, object });
      }
    }
  }
  const impacts = [];
  for (const mine of flight.mines) {
    const strike = armed(mine) && outlineStrike(mine, MINE_PARTS);
    if (strike) {
      mine.end = { age: 0, kind: "pop" };
      impacts.push({ ...strike.point, targetId: mine.id });
    }
  }
  const amount = content.tuning.flight.playerShotDamage * definition.damageRatio;
  for (const strike of strikes.sort((a, b) => a.at - b.at)) {
    impacts.push({ ...strike.point, targetId: strike.object.id });
    hit(content, amount, strike.part, strike.object, flight, events);
  }
  recordBeamFlash(flight, {
    age: 0,
    from: origin,
    impacts,
    to: beamPoint(origin, heading, range),
  });
}

const offeredEarlyEncounterCue = new WeakSet<FlightState>();

function earlyLeader(flight: FlightState): SpaceObject | undefined {
  const id =
    flight.galaxy === 1
      ? SUNFLOWER_CAPITAL_BOSS.id
      : flight.galaxy === 3
        ? WHIRLPOOL_CAPITAL_BOSS.id
        : flight.galaxy === 4
          ? NEEDLE_CADENCE.id
          : undefined;
  return id ? flight.objects.find((object) => object.id === id) : undefined;
}

export function activeCrossbowSector(flight: FlightState) {
  const owner = flight.galaxy === 4 ? earlyLeader(flight) : undefined;
  const state = owner?.enemy?.earlyEncounter;
  return owner && state?.kind === "crossbow" && !owner.enemy?.disabled
    ? crossbowFrame(flight, owner, state.elapsed)
    : undefined;
}

/** How far along a line from `origin` the first live obstacle stops it, within `range`. */
function obstacleStop(
  origin: Vec,
  direction: Vec,
  range: number,
  flight: FlightState,
  halfWidth: number = BEAM.halfWidth,
): number {
  let stop = range;
  for (const object of flight.objects) {
    if (SCENERY.includes(object.kind) && object.hp > 0) {
      const entry = sceneryEntry(
        flight,
        origin,
        direction,
        stop,
        frameOf(flight, object),
        drawnOf(flight, object),
        object,
        halfWidth,
      );
      stop = entry === null ? stop : Math.min(stop, entry);
    }
  }
  return stop;
}

const enemyBeamContact = { crossbowFrame, damage, obstacleStop, touchesAda };

/** Ages each ring burst emission until it has shown. */
function stepRingEmissions(dt: number, flight: FlightState): void {
  const emissions = ringEmissions.get(flight);
  if (emissions) {
    emissions.forEach((emission) => (emission.age += dt));
    ringEmissions.set(
      flight,
      emissions.filter((emission) => emission.age < RING_EMISSION_SECONDS),
    );
  }
}

/**
 * A pickup's motion over `dt`, alike for every kind (gameplay/rules.md): a current drifts it
 * until it leaves the current, and the tractor beam draws it toward Ada at its pull speed while
 * its centre lies within the pull radius of hers.
 */
export function carryPickup(
  ship: Pick<ShipTuning, "tractorRadius" | "tractorSpeed">,
  dt: number,
  flight: FlightState,
  pickup: Vec,
): void {
  const drift = worldFlowAt(flightWorldContext(flight), flight.galaxy, pickup);
  pickup.x += drift.x * dt;
  pickup.y += drift.y * dt;
  canonicalPosition(flight, pickup);
  const delta = worldDelta(flightWorldContext(flight), pickup, flight.player);
  const gap = Math.hypot(delta.x, delta.y);
  if (gap > ship.tractorRadius || gap === 0) {
    return;
  }
  const step = Math.min(gap, ship.tractorSpeed * dt);
  pickup.x += (delta.x / gap) * step;
  pickup.y += (delta.y / gap) * step;
  canonicalPosition(flight, pickup);
}

export function stepFlight(
  content: GameContent,
  dt: number,
  input: FlightInput,
  flight: FlightState,
  freshTravel?: FreshTravel,
): FlightEvent[] {
  beginFlightStep(flight);
  reducedMotions.set(flight, input.reducedMotion ?? false);
  const events: FlightEvent[] = [];
  if (!Number.isFinite(dt) || dt <= 0 || flight.shield <= 0) {
    return events;
  }
  worldSyncFlightRegion(flightWorldContext(flight), content, flight);
  // Settle capitals that the region sync just paged in from dormant chunks.
  settleResumedCapitals(content, flight);
  const admitEnemy: FlightInput["admitEnemy"] =
    flight.galaxy === 2 && (input.cartwheelHubKnown || flight.cartwheelMiningPatrol)
      ? (state, actor) =>
          cartwheelPatrolAdmits(state, actor) && input.admitEnemy?.(state, actor) !== false
      : input.admitEnemy;
  clearLocalGuardSummons(admitEnemy, flight);
  const ship = shipTuning(ECONOMY, content, flight.levels);
  const oreBefore = flight.shieldOreSpent ?? 0;
  let remaining = dt;
  while (remaining > 1e-9 && flight.shield > 0) {
    const slice = Math.min(remaining, SIMULATION_STEP_SECONDS);
    remaining -= slice;
    flight.time += slice;
    flight.sinceDamage += slice;
    generate(content, flight.player, input.cartwheelHubKnown === true, flight);
    moveDebris(debrisMotion, content, slice, events, flight);
    const playerBeforeMove = movePilot(
      pilotScenery,
      content,
      slice,
      input,
      events,
      flight,
      freshTravel,
    );
    worldSyncFlightRegion(flightWorldContext(flight), content, flight);
    if (warnCartwheelPatrol(flight)) {
      events.push({ type: "cartwheelPatrolWarning" });
    }
    const aiming = length(input.aim) > 0.01;
    if (aiming) {
      flight.facing = turnToward(slice, ship.physics.aimTurnSeconds, input.aim, flight.facing);
      settleAda(content, flight);
    }
    ageFlashes(slice, flight);
    flight.fireCooldown = Math.max(0, flight.fireCooldown - slice);
    if (!aiming && input.turn) {
      const facing = flight.facing;
      flight.facing = turnToward(
        slice,
        towing(flight, ship.physics).turnSeconds,
        { x: -facing.y * input.turn, y: facing.x * input.turn },
        facing,
      );
      settleAda(content, flight);
    }
    if ((input.fire ?? aiming) && flight.fireCooldown <= 0) {
      firePlayerWeapon(
        weaponReleaseContact,
        content,
        input.viewportWidth ?? SCREEN.width,
        input.viewportHeight ?? SCREEN.height,
        flight.facing,
        flight,
        events,
      );
    }
    const shotDelays = new Map<string, number>();
    const viewportWidth = input.viewportWidth ?? SCREEN.width;
    const withheld = enemies(
      { viewportHeight: input.viewportHeight ?? SCREEN.height, viewportWidth },
      content,
      slice,
      worldDelta(flightWorldContext(flight), playerBeforeMove, flight.player),
      admitEnemy,
      flight,
      events,
      shotDelays,
    );
    clearNeedleEnemies(flight);
    const earlyOwner = earlyLeader(flight);
    const earlyCue = earlyOwner?.enemy?.earlyEncounter;
    if (
      earlyOwner &&
      earlyCue &&
      earlyOwner.hp > 0 &&
      !earlyOwner.enemy?.disabled &&
      !offeredEarlyEncounterCue.has(flight) &&
      earlyEncounterCueDue(earlyCue)
    ) {
      offeredEarlyEncounterCue.add(flight);
      events.push({ encounter: earlyCue.kind, id: earlyOwner.id, type: "earlyEncounterCue" });
    }
    restoreEarlyLance(flight, earlyOwner);
    if (flight.phantom?.phase !== "salvaged") {
      stepEnemyBeams(enemyBeamContact, content, slice, viewportWidth, flight);
      stepRingEmissions(slice, flight);
    }
    const earlyTiming = earlyOwner?.enemy?.earlyEncounter;
    if (earlyOwner?.enemy && (earlyTiming?.kind === "manta" || earlyTiming?.kind === "crossbow")) {
      earlyOwner.enemy.earlyEncounter = { ...earlyTiming, elapsed: earlyTiming.elapsed + slice };
    }
    if (flight.phantom?.allies.length) {
      const allyMotion = {
        accelerationSeconds: leveledValue(
          PHANTOM_TUNING.allyAccelerationSeconds,
          Math.floor(flight.levels.engine),
        ),
        maxSpeed: ship.physics.maxSpeed,
      };
      for (const intent of stepPhantomAllies(allyMotion, slice, flight, flight.phantom.allies)) {
        const aim = direction(worldDelta(flightWorldContext(flight), intent.from, intent.target));
        releaseFriendlyVolley(
          strike,
          undefined,
          undefined,
          impactFamily(intent.weapon),
          content,
          weaponAt(intent.weapon, intent.level),
          intent.from,
          aim,
          viewportWidth,
          flight,
          events,
        );
      }
    }
    releasePendingPellets(strike, content, slice, flight, events, shotDelays);
    shots(content, slice, flight, events, shotDelays);
    stepMines(damage, slice, flight);
    stepWrecks(content, slice, input.reducedMotion ?? false, flight);
    for (const object of flight.objects) {
      if (object.kind === "hazard" && touchesAda(flight, object, object.radius)) {
        object.cooldown = Math.max(0, (object.cooldown ?? 0) - slice);
        if (!object.cooldown) {
          damage(content.tuning.hazardDamage, flight);
          object.cooldown = content.tuning.flight.damageInterval;
        }
      }
      if (object.kind !== "pickup" || object.hp <= 0) {
        continue;
      }
      carryPickup(ship, slice, flight, object);
      if (!pickupTouched(content, flight, object, object.radius, pickupOutline(object))) {
        continue;
      }
      // Collected at contact; the zip into the ship is the view's.
      events.push({ id: object.id, type: "collected", x: object.x, y: object.y });
      if (object.role === "cargo") {
        flight.cargo += object.amount ?? 1;
        object.hp = 0;
      } else if (carriesStardust(object)) {
        events.push({ amount: object.amount ?? 0, type: "stardust" });
        object.hp = 0;
      } else if (object.upgrade) {
        // The game chooses the gift from what Ada can use as she collects it.
        events.push({ id: object.id, type: "upgradeCollected" });
        object.hp = 0;
      } else if (object.ammoPack) {
        events.push({ id: object.id, type: "ammoCollected" });
        object.hp = 0;
      }
    }
    for (const object of flight.objects) {
      if (object.hp <= 0) {
        worldRecordObjectRemoval(flightWorldContext(flight), content, object, flight);
      }
    }
    flight.objects = flight.objects.filter((o) => o.hp > 0);
    // A hit can wake an enemy after its AI step. Keep damage, but do not admit reserve combat.
    if (withheld) {
      for (const object of withheld) {
        if (object.enemy?.engaged) {
          object.enemy.engaged = false;
        }
      }
    }
    flight.dangerFor = inDanger(content, viewportWidth, flight) ? flight.dangerFor + slice : 0;
    rechargeShield(ship, slice, flight);
    if (flight.shield <= 0) {
      events.push({ type: "depleted" });
    }
  }
  if (flight.topology) {
    canonicalPosition(flight, flight.player);
    for (const object of flight.objects) {
      canonicalObject(flight, object);
    }
    for (const mine of flight.mines) {
      canonicalPosition(flight, mine);
    }
  }
  const orePaid = (flight.shieldOreSpent ?? 0) - oreBefore;
  if (orePaid > 0) {
    events.push({ amount: orePaid, total: flight.shieldOreSpent!, type: "shieldOreSpent" });
  }
  worldSyncFlightRegion(flightWorldContext(flight), content, flight);
  releaseSummonedGuards(input.viewportWidth ?? SCREEN.width, flight);
  cueGuards(content, admitEnemy, flight, events);
  for (const object of flight.objects) {
    if (
      object.kind === "destination" &&
      // The hidden relay's discovery is committed when the encounter resolves.
      object.id !== ANDROMEDA_REDACT.relayId &&
      !routeBlocked(object.id, flight) &&
      worldDistance(flightWorldContext(flight), object, flight.player) <= content.tuning.talkRange
    ) {
      events.push({ id: object.id, type: "discovered" });
    }
    if (
      object.kind === "station" &&
      worldDistance(flightWorldContext(flight), object, flight.player) <=
        ECONOMY.station.discoveryRadius
    ) {
      events.push({ id: object.id, type: "stationDiscovered" });
    }
  }
  return events;
}
