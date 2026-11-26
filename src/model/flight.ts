import { randomStream } from "@andornaut/game-kit/runtime/random";

import { ASTEROID_ART } from "../data/asteroidCatalog.ts";
import { ASTEROID_LOOT, CRYSTAL_MINIMUM_ORE } from "../data/asteroidLoot.ts";
import {
  NEEDLE_CADENCE,
  SUNFLOWER_CAPITAL_BOSS,
  WHIRLPOOL_CAPITAL_BOSS,
} from "../data/capitalBosses.ts";
import { ASTEROID_FIELDS, CHUNK_CATALOG } from "../data/chunkCatalog.ts";
import { SCENERY_IMPACT_SECONDS, sceneryImpactDamage } from "../data/collisionDamage.ts";
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
  FRIGATE_ESCORT_COUNT,
  LANCE_TELL,
  MINE_LAYER,
  PHASER_AIM_SECONDS,
} from "../data/enemyCatalog.ts";
import { ENEMY_SIZE_RATIOS } from "../data/enemyDimensions.ts";
import {
  type HeavyHullProfile,
  ordinaryHeavy,
  PHANTOM_FLAGSHIP_ID,
  retaliatorVariant,
  WRECK_ID_PREFIX,
} from "../data/enemyIdentity.ts";
import { ENEMY_AVOIDANCE, ENEMY_KEEP_MOVING, MINING_HULLS } from "../data/enemyNavigation.ts";
import { spacingRadius } from "../data/enemySpacing.ts";
import { byPosition, ROUTE_POSITION, type RoutePosition } from "../data/galaxies.ts";
import { CURRENTS, HUNTING_PACKS, ORE_FIELDS } from "../data/galaxyFeatures.ts";
import { HOLODISKS } from "../data/holodisks.ts";
import { JOB_TUNING, LANDMARK_TUNING } from "../data/jobs.ts";
import { PHANTOM_DESTINATIONS, PHANTOM_FLAGSHIP, PHANTOM_TUNING } from "../data/phantom.ts";
import { SCREEN } from "../data/screen.ts";
import { SIMULATION_STEP_SECONDS } from "../data/simulation.ts";
import { SPAWNER_POLICIES } from "../data/spawnerCatalog.ts";
import { CARTWHEEL_STORY_SHIPS } from "../data/storyShips.ts";
import { TARGET_MARKER_RANGE } from "../data/targetMarkers.ts";
import type { GalaxyNumber, GameContent, Weapon } from "../data/types.ts";
import {
  BEAM,
  LANCE_HIT_RADIUS,
  MISSILE_HIT_RADIUS,
  weaponAt,
  type WeaponDefinition,
} from "../data/weaponCatalog.ts";
import { minerNeedsPick, outlineEdge, type TracedEdge } from "./ai/edgeTrace.ts";
import type { StationGuardAnchor } from "./ai/stationGuardPatrol.ts";
import { worldNavigationQuery } from "./ai/worldNavigation.ts";
import { rollAsteroidLoot } from "./asteroidLoot.ts";
import {
  ASTEROID_SHAPES,
  asteroidSize,
  bounce,
  placementRadius,
  reflectDirection,
  sceneryBound,
  scenerySilhouette,
  type Silhouette,
  silhouetteWorldReach,
  worldSceneryBlocksSegment,
  worldSceneryBodyContact,
  worldSceneryContact,
} from "./asteroids.ts";
import { planChunkCaches } from "./chunkCaches.ts";
import { onScreen } from "./conversations.ts";
import {
  pointOnCurrent,
  worldCurrentInCell,
  worldCurrentsNear,
  worldFlowAt,
  worldInCurrent,
} from "./currents.ts";
import {
  averageVelocity,
  circlingSide,
  createEnemy,
  damageEnemy,
  type EnemyContext,
  enemyDefeated,
  enemyFireLine,
  enemyIntegrity,
  type EnemyState,
  type FireIntent,
  hardpointOffset,
  stepDebris,
  stepEnemy,
} from "./enemyAi.ts";
import { enemyEquipmentDefinition, rollEnemyWeaponLevel } from "./enemyEquipment.ts";
import {
  type ProceduralPoi,
  type ProceduralPoiOpportunityEligibility,
  proceduralPoisNear,
} from "./proceduralPois.ts";
export { rollEncounter } from "./encounterRoll.ts";
import { cartwheelRequiredSites } from "./cartwheelRequiredSites.ts";
import { exclusionZoneRadius } from "./exclusionZones.ts";
import { flightEncounterSeed, flightWorldContext } from "./flightTopology.ts";
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
import { MOVING_ROCK_PREFIX, ricochetRocks } from "./rockRicochet.ts";
import { routeGuardEvidence } from "./routeGuardEvidence.ts";
import {
  discoveryStardustId,
  type PickupObstacle,
  pickupRowGap,
  pickupSpacingRadius,
  stardustDropOffsets,
} from "./stardustPlacement.ts";
import { stationFormationClear } from "./stationPlacement.ts";
import { type ImpactFamily, impactFamily, type WeaponImpact } from "./weaponImpacts.ts";
import {
  periodicWorldGrid,
  worldCell,
  worldCellAt,
  worldCellCenter,
  worldCellKey,
  worldCellsNear,
  type WorldGrid,
} from "./worldCells.ts";
import { type WorldContext, worldDelta, worldDistance, worldPoint } from "./worldContacts.ts";
import { wrapPoint } from "./worldGeometry.ts";

export { activateRouteEncounter, syncFlightRegion } from "./geography.ts";
import {
  type Contact,
  inside,
  outlineContact,
  outlinesContact,
  type Parts,
  partsReach,
  screenOutlineContact,
  toScreen,
  worldParts,
} from "./convex.ts";
import { debrisSilhouette } from "./debrisBody.ts";
import {
  carriesStardust,
  dropRandom,
  rollAmmoDrop,
  rollEnemyDrop,
  rollRockAmmoDrop,
  rollSalvageDrop,
  splitResourcePickup,
} from "./drops.ts";
import { enemyHull, enemyPartOutline, enemyPhysicalBody } from "./enemyBody.ts";
import { enemyBeamReach, planEnemyProjectile } from "./enemyProjectiles.ts";
import { landmarkSites } from "./landmarks.ts";
import { MINE_PARTS, MINE_REACH, mineTouches } from "./mineShape.ts";
import { activeNeedleCourses } from "./needle.ts";
import {
  clearNeedleEnemies,
  ensureNeedleDebris,
  isNeedleRim,
  needleChannelContains,
  needleRimContact,
  needleRims,
} from "./needleFlight.ts";
import { nosePoint } from "./nose.ts";
import { ORE_FIELD_ROLE, worldOreFieldsNear } from "./oreFields.ts";
import {
  orePickupSize,
  pickupOutline,
  stardustPickupReach,
  stardustPickupSize,
} from "./pickupBody.ts";
import { planPlayerVolley, type PlayerVolley } from "./playerProjectiles.ts";
import { impactEntry, impactSurface } from "./projectileImpact.ts";
import { SceneryFrames } from "./sceneryFrames.ts";
import { sceneryImpact } from "./sceneryImpact.ts";
import { rechargeShield } from "./shieldRecharge.ts";
import {
  SHIP_REACH,
  shipBody,
  shipCircleContact,
  shipNearSegment,
  shipTouches,
  shipTouchesScreenCircle,
} from "./shipBody.ts";
import { direction, speedFraction, stepShipMotion, turnToward } from "./shipPhysics.ts";
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
  Mine,
  PickupRelease,
  RequiredRoleEncounterPlan,
  Shot,
  SpaceObject,
  Vec,
} from "./types.ts";
import { leveledValue, noLevels, type ShipTuning, shipTuning } from "./upgrades.ts";
import { markVisited, visitedChunk } from "./visited.ts";
import { clampAmmo, ensureOwnedWeapons, grantedAmmo, shotsLeft, spendAmmo } from "./weapons.ts";

const length = (v: Vec) => Math.hypot(v.x, v.y);
const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
/**
 * Smoothed requested movement direction per flight. It is transient so saves gain
 * no field; a restored or newly pressed stick starts from the velocity heading.
 */
const movementHeadings = new WeakMap<FlightState, Vec>();
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
function chunk(flight: FlightState, content: GameContent, point: Vec): string {
  const grid = periodicWorldGrid(flightWorldContext(flight), content.tuning.chunkSize);
  return worldCellKey(grid, worldCellAt(grid, point));
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
            : object.routeId !== undefined ||
              object.enemy?.packId?.startsWith("route:") ||
              object.enemy?.escortOf?.startsWith("route:")),
      ),
    ],
    sites: [
      ...authored.filter((object) => object.kind === "destination"),
      ...cartwheelSiteGeometry(flight),
      ...(whirlpoolProtectedDisks.get(flight) ?? []),
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
    const heading = movementHeadings.get(flight);
    if (heading) {
      movementHeadings.set(flight, reflectDirection(normal, heading));
    }
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

/**
 * An enemy hull touching Ada bounces both ships by the scenery rule, without damage. Each
 * reflects against the other's velocity; Ada takes the share m_enemy / (m_ada + m_enemy) of
 * her reflected change and of the push-out, with mass as size ratio squared, and the enemy
 * the rest. Their relative motion then matches a scenery bounce, so they always separate.
 */
export function bounceShips(content: GameContent, flight: FlightState, object: SpaceObject): void {
  const enemy = object.enemy;
  const { sceneryRecoil, sceneryRestitution } = content.tuning.flight;
  // The enemy's drawn hull, or its hull circle without Art's outline, against Ada's drawn ship.
  const outline = enemy && enemyHull(enemy, ROUTE_POSITION[flight.galaxy]);
  const contact =
    enemy &&
    (outline
      ? outlinesContact(
          outline,
          worldPoint(flightWorldContext(flight), flight.player, object),
          shipBody(flight.facing),
          flight.player,
        )
      : shipCircleContact(
          flight.facing,
          flight.player,
          worldPoint(flightWorldContext(flight), flight.player, object),
          object.radius,
        ));
  if (!enemy || !contact) {
    return;
  }
  const { normal } = contact;
  const inward = { x: -normal.x, y: -normal.y };
  const mass = ENEMY_SIZE_RATIOS[enemy.archetype] ** 2;
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
  const depth = contact.depth + 0.01;
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
  settleAda(content, flight);
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
/** Screen px between world points `from` and `to`, through the nearest world image of `to`. */
function screenGap(flight: FlightState, from: Vec, to: Vec): number {
  const local = worldPoint(flightWorldContext(flight), from, to);
  const screen = toScreen({ x: local.x - from.x, y: local.y - from.y });
  return Math.hypot(screen.x, screen.y);
}
function canonicalPosition(flight: FlightState, point: Vec): void {
  if (flight.topology) {
    Object.assign(point, wrapPoint(flight.topology.side, point));
  }
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
  return (object, position, frame, drawn) =>
    isNeedleRim(object)
      ? needleRimContact({ body: shipBody(flight.facing), position }, object)
      : worldSceneryBodyContact(
          flightWorldContext(flight),
          object,
          position,
          shipBody(flight.facing),
          frame,
          0,
          drawn,
        );
}

/** Pushes Ada's drawn ship out of scenery and bounces her off what she touched. */
function settleAda(content: GameContent, flight: FlightState): void {
  resolveScenery(
    flight,
    adaContact(flight),
    adaSceneryContact(content, null, flight),
    flight.player,
    undefined,
    needleRims(flight),
  );
}

/** A body's overlap with a scenery object from `position`, at the object's current frame. */
export type SceneryContactOf = (
  object: SpaceObject,
  position: Vec,
  frame: number,
  drawn: Silhouette | null,
) => Contact | null;

const SCENERY_PASSES = 16;
// The least share of a contact's normal a combined push may carry: below it the push would run
// past 50 times the contact's depth.
const SCENERY_COMBINED_MIN = 0.02;

/**
 * Pushes a body at `position` out of overlapping scenery, deepest contact first, reporting each
 * object's first contact with its velocity and identity. In a notch between two silhouette
 * parts the escape normals oppose, so pushing out of one part re-enters the other:
 * a push back against an escape normal already taken from that object goes along the
 * normalized sum of the two instead. A body still overlapping after SCENERY_PASSES has `undo`
 * return it to where its move began (its position, or the heading it turned from), and
 * onContact reflects it off the combined normal, so it bounces rather than freezing. Without an
 * undo it stays where the passes left it.
 */
export function resolveScenery(
  flight: FlightState,
  contactOf: SceneryContactOf,
  onContact: (normal: Vec, surface: Vec, object: SpaceObject) => void,
  position: Vec,
  undo?: () => void,
  additional: readonly SpaceObject[] = [],
): void {
  const touched = new Set<SpaceObject>();
  const escapes = new Map<SpaceObject, Vec[]>();
  const deepestAt = () => {
    let deepest: { contact: Contact; object: SpaceObject } | null = null;
    for (const object of [...flight.objects, ...additional]) {
      if (!SCENERY.includes(object.kind) || object.hp <= 0) {
        continue;
      }
      const contact = contactOf(object, position, frameOf(flight, object), drawnOf(flight, object));
      if (contact && (!deepest || contact.depth > deepest.contact.depth)) {
        deepest = { contact, object };
      }
    }
    return deepest;
  };
  for (let pass = 0; pass < SCENERY_PASSES; pass++) {
    const deepest = deepestAt();
    if (!deepest) {
      return;
    }
    const { depth, normal } = deepest.contact;
    const taken = escapes.get(deepest.object) ?? [];
    escapes.set(deepest.object, [...taken, normal]);
    const opposed = taken.find((earlier) => earlier.x * normal.x + earlier.y * normal.y < 0);
    const both = opposed && combined([opposed, normal]);
    // Far enough along the combined normal to clear this contact; normals that nearly cancel
    // leave the alternation to the pass limit.
    const along = both ? both.x * normal.x + both.y * normal.y : 0;
    const [push, distance] =
      both && along > SCENERY_COMBINED_MIN
        ? [both, (depth + 0.01) / along]
        : [normal, depth + 0.01];
    position.x += push.x * distance;
    position.y += push.y * distance;
    if (!touched.has(deepest.object)) {
      touched.add(deepest.object);
      onContact(normal, deepest.object.velocity ?? { x: 0, y: 0 }, deepest.object);
    }
  }
  const stuck = undo && deepestAt();
  if (!stuck) {
    return;
  }
  const at = { ...position };
  undo();
  // The escape normals' mean direction, or back along the move where they mostly cancel.
  const taken = escapes.get(stuck.object) ?? [];
  const mean = combined(taken);
  const agree = mean
    ? taken.reduce((sum, d) => sum + d.x * mean.x + d.y * mean.y, 0) > taken.length / 2
    : false;
  const back = combined([{ x: position.x - at.x, y: position.y - at.y }]);
  const normal = (agree ? mean : back) ?? mean ?? stuck.contact.normal;
  onContact(normal, stuck.object.velocity ?? { x: 0, y: 0 }, stuck.object);
}

/** An undo that returns position to where it is now. */
function returnTo(position: Vec): () => void {
  const { x, y } = position;
  return () => {
    position.x = x;
    position.y = y;
  };
}

/** The unit sum of directions, or null when they cancel. */
function combined(directions: readonly Vec[]): Vec | null {
  const sum = directions.reduce((total, d) => ({ x: total.x + d.x, y: total.y + d.y }), {
    x: 0,
    y: 0,
  });
  const size = length(sum);
  return size > 1e-6 ? { x: sum.x / size, y: sum.y / size } : null;
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

/**
 * A debris river rock's place: it follows its current's centre line at the peak flow speed,
 * entering at one end and leaving at the other, then re-entering at the start.
 */
function placeRiverRock(flight: FlightState, object: SpaceObject): void {
  const river = object.river!;
  const match = /^current:(-?\d+),(-?\d+)$/.exec(river.current);
  const current = match
    ? worldCurrentInCell(flightWorldContext(flight), flight.galaxy, {
        x: Number(match[1]),
        y: Number(match[2]),
      })
    : null;
  if (!current) {
    object.hp = 0;
    return;
  }
  const arc =
    (((river.arc + CURRENTS.peakFlow * flight.time) % current.length) + current.length) %
    current.length;
  const { point, tangent } = pointOnCurrent(current, arc);
  // Adding 0 turns -0 into 0, so a saved and restored rock compares equal.
  object.x = point.x + 0;
  object.y = point.y + 0;
  object.velocity = {
    x: tangent.x * CURRENTS.peakFlow + 0,
    y: tangent.y * CURRENTS.peakFlow + 0,
  };
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

function generate(content: GameContent, point: Vec, flight: FlightState): void {
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
    placeAmbient(content, grid, worldCell(grid, cell), existing, flight);
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
    placeGroup(content, ambientPackId(key), group, existing, flight);
  }
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
 * A planned enemy group as one pack of members on its line and, for frigates and capitals, an
 * escort pack. A pack seen before adds back only its unloaded survivors, preserving its
 * casualty count.
 */
function placeGroup(
  content: GameContent,
  packId: string,
  group: readonly SpawnPlacement[],
  existing: Set<string>,
  flight: FlightState,
): void {
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
    const reach = ORE_FIELDS.clearance + ORE_FIELDS.diameter / 2;
    const hub = flight.objects.find(
      (object) => object.kind === "destination" && object.id === "hub",
    );
    if (
      worldStationsNear(flightStationContext(flight), ECONOMY, flight.galaxy, reach, field)
        .length ||
      (hub && worldDistance(flightWorldContext(flight), hub, field) < reach) ||
      (flight.arrivals ?? []).some(
        (arrival) => worldDistance(flightWorldContext(flight), arrival, field) < reach,
      )
    ) {
      continue;
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
  clearLayoutObjects(
    (other) => other.kind === "destination" || clearOf(flight, object.radius, object, other),
    flight,
  );
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

function clearLocalGuardSummons(flight: FlightState): void {
  if (!flight.summonedGuards) {
    return;
  }
  flight.summonedGuards = flight.summonedGuards.filter((id) => {
    const guard = flight.objects.find((object) => object.id === id) ?? flight.world.notables[id];
    return guard == null || !localGuardMember(flight, guard);
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
    return { x: course.x * speed, y: course.y * speed };
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
function cueGuards(content: GameContent, flight: FlightState, events: FlightEvent[]): void {
  const cued = flight.objects.filter(
    (object) =>
      object.kind === "destination" &&
      !flight.guardCues?.includes(object.id) &&
      worldDistance(flightWorldContext(flight), object, flight.player) <=
        content.tuning.talkRange &&
      routeBlocked(object.id, flight),
  );
  for (const destination of cued) {
    (flight.guardCues ??= []).push(destination.id);
    worldActivateRouteEncounter(flightWorldContext(flight), content, destination.id, flight);
    const leaders = flight.objects.filter((guard) => guard.routeId === destination.id);
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
        !flight.summonedGuards?.includes(guard.id)
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
  if (galaxy === 6 && object.id === PHANTOM_FLAGSHIP_ID && object.enemy?.archetype === "capital") {
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
  generate(content, point, flight);
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
  generate(content, target, flight);
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
  generate(content, flight.player, flight);
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

export function teleport(content: GameContent, id: string, flight: FlightState): boolean {
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
  const arrival = { x: object.x, y: object.y };
  // A jump arrival begins calm: no new encounter is placed near it, and ordinary encounter
  // ships already near it leave without counting as casualties. Guards keep their posts.
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
  generate(content, object, flight);
  flight.player = arrival;
  flight.velocity = { x: 0, y: 0 };
  flight.freshChunk = null;
  beginArrivalGrace(content, flight);
  const key = chunk(flight, content, object);
  markVisited(flight.visited, key);
  worldSyncFlightRegion(flightWorldContext(flight), content, flight);
  return true;
}

function fire(
  content: GameContent,
  viewportWidth: number,
  viewportHeight: number,
  aim: Vec,
  flight: FlightState,
  events: FlightEvent[],
): void {
  ensureOwnedWeapons(flight);
  const weapon = flight.weapon;
  let definition = weaponAt(weapon, flight.levels.weapons[weapon]);
  const family = impactFamily(weapon);
  if (weapon === "multiLaser") {
    const ammo = flight.ammo.multiLaser;
    if (ammo === 0) {
      spendAmmo(flight, 0);
      events.push({ type: "outOfAmmo" });
      return;
    }
    if (ammo < definition.anglesDegrees.length) {
      // Preserve authored order for equal offsets (including roundoff in even fans).
      const anglesDegrees = [...definition.anglesDegrees].sort((left, right) => {
        const difference = Math.abs(left) - Math.abs(right);
        return Math.abs(difference) < 1e-9 ? 0 : difference;
      });
      definition = { ...definition, anglesDegrees: anglesDegrees.slice(0, ammo) };
    }
  } else if (spendAmmo(flight, 1)) {
    events.push({ type: "outOfAmmo" });
  }
  // Every shot and beam leaves the ship's nose for its heading; ranges run from there.
  const origin = nosePoint(flight.facing, flight.player);
  const coverage = { centre: { ...flight.player }, viewportHeight, viewportWidth };
  if (definition.projectileKind === "beam") {
    fireBeam(coverage, content, definition, aim, origin, flight, events);
    flight.fireCooldown += definition.intervalSeconds;
    return;
  }
  const volley = releaseFriendlyVolley(
    coverage,
    flight.velocity,
    family,
    content,
    definition,
    origin,
    aim,
    viewportWidth,
    flight,
    events,
  );
  flight.fireCooldown += volley.interval;
  if (weapon === "multiLaser" && spendAmmo(flight, volley.projectiles.length)) {
    events.push({ type: "outOfAmmo" });
  }
}

/** The player's and an ally's shots share canonical damage, range and collision handling. */
function releaseFriendlyVolley(
  coverage: PlayerWeaponCoverageContext | undefined,
  inheritedVelocity: Vec | undefined,
  family: ImpactFamily,
  content: GameContent,
  definition: WeaponDefinition,
  origin: Vec,
  aim: Vec,
  viewportWidth: number,
  flight: FlightState,
  events: FlightEvent[],
): PlayerVolley {
  const volley = planPlayerVolley(definition, {
    ...(coverage === undefined ? {} : { coverage }),
    ...(inheritedVelocity === undefined ? {} : { inheritedVelocity }),
    aim,
    baseDamage: content.tuning.flight.playerShotDamage,
    baseLifetime: content.tuning.flight.projectileLifetime,
    baseSpeed: content.tuning.flight.projectileSpeed,
    origin,
    viewportWidth,
  });
  for (const projectile of volley.projectiles) {
    const shot: Shot = {
      ...projectile,
      effectFamily: family,
      enemy: false,
      hitIds: [],
      id: `shot:${flight.nextId++}`,
      piercing: false,
    };
    flight.shots.push(shot);
    // A shot that starts inside an obstacle Ada is touching strikes it at once.
    strike(content, shot, flight, events);
  }
  return volley;
}

/**
 * Whether Ada is in battle: an enemy chasing or attacking her is inside the battle square,
 * centred on her and reaching half the game area's width plus the battle margin along each axis.
 * Idle enemies, retaliators not yet hit, fleeing or returning enemies and disabled heavies do not
 * count.
 */
export function inBattle(
  content: GameContent,
  viewportWidth: number,
  flight: Pick<FlightState, "objects" | "player" | "topology">,
): boolean {
  const reach = viewportWidth / 2 + content.tuning.battleMargin;
  return flight.objects.some((object) => {
    const enemy = object.enemy;
    const offset = worldDelta(flightWorldContext(flight), flight.player, object);
    return (
      object.kind === "enemy" &&
      object.hp > 0 &&
      enemy !== undefined &&
      enemy.engaged &&
      !enemy.returning &&
      !enemy.fleeing &&
      !enemy.disabled &&
      Math.abs(offset.x) <= reach &&
      Math.abs(offset.y) <= reach
    );
  });
}
/**
 * Whether Ada is in danger (rules.md): in battle, or with an enemy shot in flight inside the
 * battle square. Danger has no release time.
 */
export function inDanger(
  content: GameContent,
  viewportWidth: number,
  flight: Pick<FlightState, "objects" | "player" | "shots" | "topology">,
): boolean {
  const reach = viewportWidth / 2 + content.tuning.battleMargin;
  return (
    inBattle(content, viewportWidth, flight) ||
    flight.shots.some((shot) => {
      const offset = worldDelta(flightWorldContext(flight), flight.player, shot);
      return shot.enemy && Math.abs(offset.x) <= reach && Math.abs(offset.y) <= reach;
    })
  );
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
 * Fraction of maxSpeed requested by a movement deflection from 0 (just past the dead zone)
 * to 1 (full reach). No input requests no speed; any input requests at least minSpeedFraction.
 */
export function movementSpeedFraction(
  tuning: Pick<GameContent["tuning"], "minSpeedFraction" | "speedCurveExponent">,
  deflection: number,
): number {
  const m = Math.min(1, Math.max(0, deflection));
  if (!m) {
    return 0;
  }
  return tuning.minSpeedFraction + (1 - tuning.minSpeedFraction) * m ** tuning.speedCurveExponent;
}
/**
 * Current ship speed as a fraction of Ada's maximum speed at her engine level, clamped to
 * [0, 1], for jets. Flights without levels use the base engine.
 */
export function shipSpeedFraction(
  content: GameContent,
  flight: Pick<FlightState, "velocity"> & Partial<Pick<FlightState, "levels">>,
): number {
  const physics = shipTuning(ECONOMY, content, flight.levels ?? noLevels()).physics;
  return speedFraction(physics.maxSpeed, flight.velocity);
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
  movementHeadings.delete(flight);
  return true;
}
/**
 * Undocking leaves Ada at rest where she docked, so Use offers Dock again at once, and starts her
 * arrival grace.
 */
export function undockFlight(content: GameContent, flight: FlightState): void {
  flight.velocity = { x: 0, y: 0 };
  movementHeadings.delete(flight);
  beginArrivalGrace(content, flight);
}
/**
 * While a tow line is attached, Ada's current handling scaled by the tow multipliers
 * (gameplay/quests.md "Tow handling"): a lower top speed, slower speed changes, wider turns.
 */
export function towing<
  T extends {
    accelerationSeconds: number;
    brakingSeconds: number;
    maxSpeed: number;
    turnSeconds: number;
  },
>(flight: Pick<FlightState, "tow">, physics: T): T {
  if (!flight.tow) {
    return physics;
  }
  const { responseScale, topSpeedScale, turnScale } = JOB_TUNING.tow;
  return {
    ...physics,
    accelerationSeconds: physics.accelerationSeconds * responseScale,
    brakingSeconds: physics.brakingSeconds * responseScale,
    maxSpeed: physics.maxSpeed * topSpeedScale,
    turnSeconds: physics.turnSeconds * turnScale,
  };
}
type FreshTravel = (distance: number, seconds: number, point: Vec) => void;

function move(
  content: GameContent,
  dt: number,
  input: FlightInput,
  events: FlightEvent[],
  flight: FlightState,
  freshTravel?: FreshTravel,
): Vec {
  const magnitude = Math.min(1, length(input.move));
  const physics = towing(flight, shipTuning(ECONOMY, content, flight.levels).physics);
  const top = physics.maxSpeed;
  const speedFraction =
    input.throttle === undefined
      ? movementSpeedFraction(content.tuning, magnitude)
      : Math.min(1, Math.max(0, input.throttle));
  const motion = stepShipMotion(
    physics,
    dt,
    { maxSpeed: top },
    {
      direction: input.move,
      speed: speedFraction * top,
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
  const contactOf = adaContact(flight);
  const onContact = adaSceneryContact(content, events, flight);
  // Drifting scenery can reach a resting ship, so contacts resolve before any travel.
  resolveScenery(flight, contactOf, onContact, flight.player, undefined, needleRims(flight));
  // A current's flow adds drift outside Ada's physics and speed cap.
  const drift = worldFlowAt(flightWorldContext(flight), flight.galaxy, flight.player);
  const travel = { x: flight.velocity.x + drift.x, y: flight.velocity.y + drift.y };
  const steps = Math.max(1, Math.ceil((length(travel) * dt) / 4));
  for (let i = 0; i < steps; i++) {
    const before = { ...flight.player };
    const key = chunk(flight, content, before);
    flight.player.x += (travel.x * dt) / steps;
    flight.player.y += (travel.y * dt) / steps;
    resolveScenery(
      flight,
      contactOf,
      onContact,
      flight.player,
      () => {
        flight.player.x = before.x;
        flight.player.y = before.y;
      },
      needleRims(flight),
    );
    canonicalPosition(flight, flight.player);
    const afterKey = chunk(flight, content, flight.player);
    if (flight.freshChunk === key) {
      const distance = worldDistance(flightWorldContext(flight), before, flight.player);
      const previous = flight.freshDistance;
      flight.freshDistance += distance;
      if (freshTravel && magnitude > 0 && speedFraction > 0 && flight.freshDistance > previous) {
        freshTravel(flight.freshDistance - previous, dt / steps, flight.player);
      }
    }
    if (afterKey !== key) {
      flight.freshChunk = visitedChunk(flight.visited, afterKey) ? null : afterKey;
      markVisited(flight.visited, afterKey);
    }
  }
  if (
    input.turn === undefined &&
    length(input.aim) <= 0.01 &&
    worldDistance(flightWorldContext(flight), start, flight.player) > 0.001 &&
    length(flight.velocity)
  ) {
    const turnedFrom = flight.facing;
    const settled = returnTo(flight.player);
    flight.facing = turnToward(dt, physics.aimTurnSeconds, flight.velocity, flight.facing);
    // A new heading draws a new outline, which may reach scenery; one wedged in it keeps the old.
    resolveScenery(
      flight,
      contactOf,
      onContact,
      flight.player,
      () => {
        settled();
        flight.facing = turnedFrom;
      },
      needleRims(flight),
    );
  }
  return start;
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

function enemies(
  viewport: Readonly<Pick<PlayerWeaponCoverageContext, "viewportHeight" | "viewportWidth">>,
  content: GameContent,
  dt: number,
  playerDisplacement: Vec,
  flight: FlightState,
  events: FlightEvent[],
  shotDelays: Map<string, number>,
): void {
  // Once the flagship is salvaged Phantom's drones stand down: they patrol home and never fire.
  const standDown = flight.galaxy === 6 && flight.phantom?.phase === "salvaged";
  if (standDown) {
    flight.shots = flight.shots.filter((shot) => !shot.enemy);
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
    const targetable = !standDown && !adaProtected(flight);
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
    const intent = stepEnemy(
      definition,
      {
        ...flightWorldContext(flight),
        adaWidth: content.tuning.flight.shipRadius * 2,
        dormantPackMembers: worldRetainedPackMembers(flightWorldContext(flight), content, flight),
        dt,
        enemyDrift: drift,
        engagementAdmitted: admissions.has(object.id),
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
        summoned: (!standDown && flight.summonedGuards?.includes(object.id)) ?? false,
        ...(!standDown && flight.summonedGuards?.includes(object.id)
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
    bounceShips(content, flight, object);
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
        chargeEnemyBeam(
          amount,
          shared ? enemyBeamReach(coverage, fire) : 0,
          before,
          fire,
          object.id,
          flight,
        );
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
      shotDelays.set(id, fire.delay);
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
      flight.shots.push({
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
      });
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

/** Lays a mine where the mine layer fires, unless its ship already has its most out. */
function layMine(
  damage: number,
  fire: Pick<FireIntent, "delay" | "origin">,
  ownerId: string,
  flight: FlightState,
): void {
  const out = flight.mines.filter((mine) => mine.ownerId === ownerId && !mine.end).length;
  if (
    out >= MINE_LAYER.count ||
    needleChannelContains({ radius: MINE_CHANNEL_REACH }, flight, fire.origin)
  ) {
    return;
  }
  flight.mines.push({
    age: -fire.delay,
    damage,
    id: `mine:${flight.nextId++}`,
    ownerId,
    x: fire.origin.x,
    y: fire.origin.y,
  });
}

/** How long a mine's fizzle and pop play (art/weapons.md "Mine"). */
const MINE_END_SECONDS = { fizzle: 0.2, pop: 0.22 } as const;
// The inverse isometric projection stretches a screen-space radius by at most sqrt(2).
const MINE_CHANNEL_REACH = Math.SQRT2 * MINE_REACH;
/** A shot's strike against a mine's drawn silhouette: a 6 px square about the shot. */
const SHOT_PARTS: Parts = [
  [
    { x: -3, y: -3 },
    { x: 3, y: -3 },
    { x: 3, y: 3 },
    { x: -3, y: 3 },
  ],
];

const shotRadius = (shot: Shot) => (shot.projectile === "missile" ? MISSILE_HIT_RADIUS : 3);

/** Whether a mine still collides: laid, and neither fizzling nor popped. */
function armed(mine: Mine): boolean {
  return mine.end === undefined && mine.age >= 0;
}

/**
 * Ages each mine: one touching Ada's drawn ship pops and damages her; one past its life fizzles,
 * harmless. Each goes once its fizzle or pop has played.
 */
function stepMines(dt: number, flight: FlightState): void {
  const body = shipBody(flight.facing);
  flight.mines = flight.mines.filter(
    (mine) => !needleChannelContains({ radius: MINE_CHANNEL_REACH }, flight, mine),
  );
  for (const mine of flight.mines) {
    mine.age += dt;
    if (mine.end) {
      mine.end.age += dt;
    } else if (mine.age >= MINE_LAYER.lifeSeconds) {
      mine.end = { age: mine.age - MINE_LAYER.lifeSeconds, kind: "fizzle" };
    } else if (
      armed(mine) &&
      mineTouches(mine, body, worldPoint(flightWorldContext(flight), mine, flight.player))
    ) {
      damage(mine.damage, flight);
      mine.end = { age: 0, kind: "pop" };
    }
  }
  flight.mines = flight.mines.filter(
    (mine) => !mine.end || mine.end.age < MINE_END_SECONDS[mine.end.kind],
  );
}

/** Ada's shot pops each armed mine it touches that it has not; true once the shot is spent. */
function strikeMines(
  content: GameContent,
  shot: Shot,
  flight: FlightState,
  events: FlightEvent[],
): boolean {
  for (const mine of flight.mines) {
    if (
      armed(mine) &&
      !shot.hitIds.includes(mine.id) &&
      (shot.projectile === "missile"
        ? outlineContact(
            MINE_PARTS,
            mine,
            worldPoint(flightWorldContext(flight), mine, shot),
            MISSILE_HIT_RADIUS,
          ) !== null
        : mineTouches(mine, SHOT_PARTS, worldPoint(flightWorldContext(flight), mine, shot)))
    ) {
      shot.hitIds.push(mine.id);
      mine.end = { age: 0, kind: "pop" };
      if (shot.blast !== undefined) {
        const contact = outlineContact(
          MINE_PARTS,
          mine,
          worldPoint(flightWorldContext(flight), mine, shot),
          shotRadius(shot),
        );
        const at = contact
          ? impactSurface({ contact, projected: false, radius: shotRadius(shot) }, shot)
          : shot;
        blast(content, shot.damage, shot.blast, at, null, flight, events);
      }
      if (!shot.piercing) {
        shot.life = 0;
        return true;
      }
    }
  }
  return false;
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

/**
 * Whether traveling debris moving from `from` to `to` meets Ada's drawn ship: its drawn piece
 * outline against hers, sampled every 2 units along the move; its circle without debris art.
 */
function debrisTouchesAda(
  world: WorldContext,
  flight: FlightState,
  object: SpaceObject,
  from: Vec,
  to: Vec,
): boolean {
  const end = worldPoint(world, from, to);
  const player = worldPoint(world, from, flight.player);
  const drawn = drawnOf(flight, object);
  if (!drawn) {
    return shipNearSegment(flight.facing, player, from, end, object.radius);
  }
  if (segmentDistance(player, from, end) > silhouetteWorldReach(drawn) + SHIP_REACH) {
    return false;
  }
  const frame = frameOf(flight, object);
  const body = shipBody(flight.facing);
  const steps = Math.max(1, Math.ceil(distance(from, end) / 2));
  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const at = { ...object, x: from.x + (end.x - from.x) * t, y: from.y + (end.y - from.y) * t };
    if (worldSceneryBodyContact(world, at, flight.player, body, frame, 0, drawn)) {
      return true;
    }
  }
  return false;
}

/**
 * Ballistic debris keeps constant velocity, struck static rocks settle and other asteroids hold
 * their centres; then moving rocks ricochet off the asteroids they touch.
 */
function moveDebris(
  content: GameContent,
  dt: number,
  events: FlightEvent[],
  flight: FlightState,
): void {
  const world = flightWorldContext(flight);
  let exclusionZones: { area: Vec; radius: number }[] | undefined;
  let arrivalDisks: typeof exclusionZones;
  for (const object of flight.objects) {
    if (object.river) {
      // River debris follows its current and bumps Ada on contact like other traveling debris.
      const from = { x: object.x, y: object.y };
      placeRiverRock(flight, object);
      if (debrisTouchesAda(world, flight, object, from, object)) {
        bumpAda(content, flight, events, object);
      }
      continue;
    }
    if (object.orbit && object.kind === "rock") {
      // Legacy circular paths settle at their current centre without changing HP or drops.
      delete object.orbit;
      delete object.velocity;
      continue;
    }
    const settling = object.kind === "rock" && object.settle !== undefined;
    if (!object.velocity || (object.kind !== "debris" && !settling)) {
      continue;
    }
    const next = settling
      ? settleRock(dt, object)
      : stepDebris(dt, { id: object.id, position: object, velocity: object.velocity });
    // Existing protected objects absorb all moving debris; moving rocks, struck static rocks
    // among them, also end at arrival disks.
    if (!exclusionZones) {
      exclusionZones = [];
      for (const area of flight.objects) {
        const radius = exclusionZoneRadius(content, area);
        if (radius !== null) {
          exclusionZones.push({ area, radius });
        }
      }
    }
    const reach = placementRadius(object);
    const crosses = ({ area, radius }: { area: Vec; radius: number }): boolean =>
      segmentDistance(worldPoint(world, object, area), object, next.position) < radius + reach;
    if (
      exclusionZones.some(crosses) ||
      ((settling || object.id.startsWith(MOVING_ROCK_PREFIX)) &&
        (arrivalDisks ??= arrivalPoints(flight).map((area) => ({
          area,
          radius: content.tuning.exclusionRadius,
        }))).some(crosses))
    ) {
      object.hp = 0;
      continue;
    }
    // A bump, though the debris may pass through her between frames (rules.md: 1 a bump).
    if (debrisTouchesAda(world, flight, object, object, next.position)) {
      bumpAda(content, flight, events, object);
    }
    object.x = next.position.x;
    object.y = next.position.y;
    canonicalPosition(flight, object);
  }
  ricochetRocks(
    { chunkSize: content.tuning.chunkSize, frameOf: (rock) => frameOf(flight, rock), world },
    content.tuning.flight.rockRicochet,
    flight.objects,
  );
}

/**
 * A struck static rock's move over `dt`: its speed falls evenly to rest at the end of its
 * settle time, where it stays as a static rock again.
 */
function settleRock(dt: number, object: SpaceObject): { position: Vec } {
  const velocity = object.velocity!;
  const left = object.settle!;
  const step = Math.min(dt, left);
  const after = (left - step) / left;
  // The mean of the speeds at the start and the end of the step, which fall linearly.
  const mean = (1 + after) / 2;
  const position = {
    x: object.x + velocity.x * mean * step,
    y: object.y + velocity.y * mean * step,
  };
  if (left - step <= 1e-9) {
    delete object.velocity;
    delete object.settle;
  } else {
    object.velocity = { x: velocity.x * after, y: velocity.y * after };
    object.settle = left - step;
  }
  return { position };
}

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
            projectileSceneryContact(flight, object, shot, radius),
        );
        if (!struck && !blocked) {
          continue;
        }
        const bodyContact = outlineContact(shipBody(flight.facing), flight.player, shot, radius);
        const point = blocked
          ? projectileContact(flight, blocked, shot, radius, from)
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
      if (strikeMines(content, shot, flight, events)) {
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
    const impacts = projectileImpacts.get(flight) ?? [];
    impacts.push({
      ...shot,
      age: 0,
      direction: { ...shot.velocity },
      family: shot.effectFamily,
      id: shot.id,
      targetId: "",
    });
    projectileImpacts.set(flight, impacts);
  }
  if (shot.blast !== undefined) {
    const blasts = blastFlashes.get(flight) ?? [];
    blasts.push({ age: 0, radius: shot.blast, x: shot.x, y: shot.y });
    blastFlashes.set(flight, blasts);
  }
  if (struck || (shot.blast !== undefined && blastCoversAda(flight, shot, shot.blast))) {
    damage(shot.damage, flight);
  }
}

/** Missile widths are world-space circles against the existing drawn scenery outlines. */
function projectileSceneryContact(
  flight: FlightState,
  object: SpaceObject,
  at: Vec,
  radius: number,
) {
  const drawn = drawnOf(flight, object);
  if (radius === MISSILE_HIT_RADIUS && drawn) {
    const frame = frameOf(flight, object);
    const image = worldPoint(flightWorldContext(flight), at, object);
    return outlineContact(drawn.frames[frame] ?? drawn.frames[0]!, image, at, radius);
  }
  return worldSceneryContact(
    flightWorldContext(flight),
    object,
    at,
    radius,
    frameOf(flight, object),
    drawn,
  );
}

/** The detected contact's surface, refined within the existing sampled movement segment. */
function projectileContact(
  flight: FlightState,
  object: SpaceObject,
  point: Vec,
  radius: number,
  from = point,
  part?: string | null,
): Vec {
  const contactAt = (at: Vec) => {
    if (object.kind !== "enemy") {
      return projectileSceneryContact(flight, object, at, radius);
    }
    const local = worldPoint(flightWorldContext(flight), object, at);
    const enemy = object.enemy;
    const outlines = enemy
      ? [
          ...(part ? [enemyPartOutline(ROUTE_POSITION[flight.galaxy], enemy, part)] : []),
          enemyHull(enemy, ROUTE_POSITION[flight.galaxy]),
          ...enemy.hardpoints.map((part) =>
            enemyPartOutline(ROUTE_POSITION[flight.galaxy], enemy, part.id),
          ),
        ]
      : [];
    for (const outline of outlines) {
      const contact = outline && outlineContact(outline, object, local, radius);
      if (contact) {
        return contact;
      }
    }
    return null;
  };
  const at = impactEntry(
    (at) => contactAt(at) !== null,
    worldPoint(flightWorldContext(flight), point, from),
    point,
  );
  const contact = contactAt(at);
  if (contact) {
    return impactSurface(
      {
        contact,
        projected:
          object.kind !== "enemy" &&
          radius !== MISSILE_HIT_RADIUS &&
          drawnOf(flight, object) !== null,
        radius,
      },
      at,
    );
  }
  // Circle-only enemies use the same outward normal and overlap as their collision fallback.
  const image = worldPoint(flightWorldContext(flight), at, object);
  const normal = direction({ x: at.x - image.x, y: at.y - image.y });
  return { x: image.x + normal.x * object.radius, y: image.y + normal.y * object.radius };
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
        : !projectileSceneryContact(flight, object, shot, shotRadius(shot)))
    ) {
      continue;
    }
    shot.hitIds.push(object.id);
    const part = hitPart(content, flight, partReach(content), shotRadius(shot), shot, object);
    const at = projectileContact(flight, object, shot, shotRadius(shot), from, part);
    const impacts = projectileImpacts.get(flight) ?? [];
    impacts.push({
      ...at,
      age: 0,
      id: `${shot.id}:${object.id}`,
      targetId: object.id,
      ...(shot.effectFamily ? { direction: { ...shot.velocity }, family: shot.effectFamily } : {}),
    });
    projectileImpacts.set(flight, impacts);
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

/** How near a point must be to a live hardpoint to strike it. */
function partReach(content: GameContent): number {
  return content.tuning.flight.shipRadius + 6;
}

/** A multipart enemy's live hardpoints, in world coordinates. */
function liveParts(
  content: GameContent,
  galaxy: GalaxyNumber,
  object: SpaceObject,
): { id: string; x: number; y: number }[] {
  const enemy = object.enemy;
  if (!enemy) {
    return [];
  }
  const definition = enemyEquipmentDefinition(galaxy, enemy);
  const adaWidth = content.tuning.flight.shipRadius * 2;
  return definition.hardpoints
    .filter((part) => enemy.hardpoints.some((value) => value.id === part.id && value.hp > 0))
    .map((part) => {
      const offset = hardpointOffset(definition, adaWidth, enemy.facing, part);
      return { id: part.id, x: object.x + offset.x, y: object.y + offset.y };
    });
}

/**
 * Whether a strike of `reach` at `point` touches an enemy where it is drawn: its hull or, on a
 * heavy, a hardpoint's base or top; its hull circle without Art's outline.
 */
function enemyTouched(
  flight: FlightState,
  position: RoutePosition,
  object: SpaceObject,
  point: Vec,
  reach: number,
): boolean {
  const localPoint = worldPoint(flightWorldContext(flight), object, point);
  const enemy = object.enemy;
  const hull = enemy && enemyHull(enemy, position);
  if (!enemy || !hull) {
    return worldDistance(flightWorldContext(flight), localPoint, object) <= object.radius + reach;
  }
  return (
    outlineContact(hull, object, localPoint, reach) !== null ||
    enemy.hardpoints.some((part) => {
      const outline = enemyPartOutline(position, enemy, part.id);
      return outline !== null && outlineContact(outline, object, localPoint, reach) !== null;
    })
  );
}

/**
 * The live hardpoint a strike at `point` lands on, before the hull; null for the hull alone and
 * for scenery. A drawn hardpoint is in reach when the strike's `tolerance` touches its base or
 * top; one without Art's outline when its anchor is within `reach`.
 */
function hitPart(
  content: GameContent,
  flight: FlightState,
  reach: number,
  tolerance: number,
  point: Vec,
  object: SpaceObject,
): string | null {
  const galaxy = flight.galaxy;
  const localPoint = worldPoint(flightWorldContext(flight), object, point);
  const enemy = object.enemy;
  if (object.kind !== "enemy" || !enemy) {
    return null;
  }
  if (!enemy.hardpoints.length) {
    return null;
  }
  let nearest: { id: string; gap: number } | undefined;
  for (const part of liveParts(content, galaxy, object)) {
    const outline = enemyPartOutline(ROUTE_POSITION[galaxy], enemy, part.id);
    const contact = outline && outlineContact(outline, object, localPoint, tolerance);
    // A drawn part ranks by overlap depth, deepest first; an undrawn one by its anchor gap.
    const gap = outline
      ? contact
        ? -contact.depth
        : Infinity
      : worldDistance(flightWorldContext(flight), localPoint, part);
    if ((outline ? contact !== null : gap <= reach) && (!nearest || gap < nearest.gap)) {
      nearest = { gap, id: part.id };
    }
  }
  return nearest?.id ?? null;
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
      (object.id === PHANTOM_FLAGSHIP || object.id === NEEDLE_CADENCE.id) &&
      part !== null &&
      object.hp > 0 &&
      !before.disabled &&
      !after.disabled &&
      before.hardpoints.every(({ hp }) => hp > 0) &&
      after.hardpoints.some(({ hp, id }) => id === part && hp === 0)
    ) {
      events.push({ id: object.id, type: "enemyFirstHardpointLost" });
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
 * An ammo outcome replaces the destroyed asteroid's combined ore/Stardust payout. A crystal rock
 * skips the ammo roll and gives at least `CRYSTAL_MINIMUM_ORE`; further ore and Stardust roll as
 * usual. A moving rock rolls under its placed rock's id and keeps its flag, so it drops what that
 * rock would have dropped had it stayed still.
 */
function dropFromRock(content: GameContent, object: SpaceObject, flight: FlightState): void {
  const size = asteroidSize(object);
  const crystal = object.crystals !== undefined;
  const id = object.id.startsWith(MOVING_ROCK_PREFIX)
    ? object.id.slice(MOVING_ROCK_PREFIX.length)
    : object.id;
  if (
    !crystal &&
    rollRockAmmoDrop(ECONOMY, ammoOwned(flight), size, dropRandom(flight.seed, `ammo:${id}`))
  ) {
    pushAmmoPack(content, object, flight);
    return;
  }
  const next = dropRandom(flight.seed, id);
  const rolled = rollAsteroidLoot(ASTEROID_LOOT, size, next);
  const loot = crystal ? { ...rolled, ore: Math.max(CRYSTAL_MINIMUM_ORE, rolled.ore) } : rolled;
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
  const blasts = blastFlashes.get(flight) ?? [];
  blasts.push({ age: 0, radius, x: at.x, y: at.y });
  blastFlashes.set(flight, blasts);
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
 * What a blast circle of screen radius `radius` at `at` covers of an enemy as drawn: the live
 * hardpoint it overlaps deepest (one without Art's outline when its anchor is within the radius
 * and a hardpoint's reach on screen), else its hull, or null when it covers neither.
 */
function blastCover(
  content: GameContent,
  flight: FlightState,
  radius: number,
  at: Vec,
  object: SpaceObject,
): { part: string | null } | null {
  const enemy = object.enemy;
  if (!enemy) {
    return null;
  }
  const position = ROUTE_POSITION[flight.galaxy];
  const local = worldPoint(flightWorldContext(flight), object, at);
  let nearest: { gap: number; id: string } | undefined;
  for (const part of liveParts(content, flight.galaxy, object)) {
    const outline = enemyPartOutline(position, enemy, part.id);
    const contact = outline && screenOutlineContact(outline, object, local, radius);
    const gap = outline ? (contact ? -contact.depth : Infinity) : screenGap(flight, part, local);
    if (
      (outline ? contact !== null : gap <= radius + partReach(content)) &&
      (!nearest || gap < nearest.gap)
    ) {
      nearest = { gap, id: part.id };
    }
  }
  if (nearest) {
    return { part: nearest.id };
  }
  const hull = enemyHull(enemy, position);
  const covered = hull
    ? screenOutlineContact(hull, object, local, radius) !== null ||
      enemy.hardpoints.some((part) => {
        const outline = enemyPartOutline(position, enemy, part.id);
        return outline !== null && screenOutlineContact(outline, object, local, radius) !== null;
      })
    : screenGap(flight, object, local) <= object.radius + radius;
  return covered ? { part: null } : null;
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

/**
 * A hitscan beam's visible flash, view-only and never saved: `from` and `to` are the fire-time
 * line, where the hit landed; a hit also shows a spark at `to`.
 */
export interface BeamFlash {
  from: Vec;
  to: Vec;
  hit: boolean;
  age: number;
}

/**
 * Ada's beam as drawn now: it stays on her nose and turns with her aim, at the length it fired
 * with (gameplay/rules.md, Phaser).
 */
export function drawnBeamFlash(flight: FlightState, flash: BeamFlash): { from: Vec; to: Vec } {
  const span = length(flight.facing);
  const reach = length({ x: flash.to.x - flash.from.x, y: flash.to.y - flash.from.y });
  if (!span) {
    return { from: flash.from, to: flash.to };
  }
  const from = nosePoint(flight.facing, flight.player);
  return {
    from,
    to: {
      x: from.x + (flight.facing.x / span) * reach,
      y: from.y + (flight.facing.y / span) * reach,
    },
  };
}
const beamFlashes = new WeakMap<FlightState, BeamFlash[]>();

/** A missile blast's visible flash at its impact, view-only and never saved. */
export interface BlastFlash extends Vec {
  radius: number;
  age: number;
}
export interface ProjectileImpact extends Vec {
  readonly family?: ImpactFamily;
  readonly direction?: Vec;
  readonly id: string;
  readonly targetId: string;
  age: number;
}
const projectileImpacts = new WeakMap<FlightState, ProjectileImpact[]>();
/** Short-lived contact records survive consumed shots so feedback retains the actual hit point. */
export function activeProjectileImpacts(flight: FlightState): readonly ProjectileImpact[] {
  return projectileImpacts.get(flight) ?? [];
}
const blastFlashes = new WeakMap<FlightState, BlastFlash[]>();
/** How long a blast shows: the longest blast effect, the Heavy Missile's 340 ms. */
export const BLAST_FLASH_SECONDS = 0.34;

/** The flight's beam flashes still showing. */
export function activeBeamFlashes(flight: FlightState): readonly BeamFlash[] {
  return beamFlashes.get(flight) ?? [];
}

const impactViewIds = new WeakMap<object, string>();
let nextImpactViewId = 0;
function impactViewId(entry: object): string {
  let id = impactViewIds.get(entry);
  if (id === undefined) {
    id = `impact:${nextImpactViewId++}`;
    impactViewIds.set(entry, id);
  }
  return id;
}

/** Explicit family snapshots for the existing contact renderer and Art's procedural fixture. */
export function activeWeaponImpacts(flight: FlightState): readonly WeaponImpact[] {
  return [
    ...activeProjectileImpacts(flight).flatMap((impact): WeaponImpact[] =>
      impact.family && impact.family !== "missile" ? [{ ...impact, family: impact.family }] : [],
    ),
    ...activeBlastFlashes(flight).map((flash): WeaponImpact => ({
      ...flash,
      blastRadius: flash.radius,
      family: "missile",
      id: impactViewId(flash),
    })),
    ...activeBeamFlashes(flight).flatMap((flash): WeaponImpact[] =>
      flash.hit
        ? [
            {
              ...flash.to,
              age: flash.age,
              direction: { x: flash.to.x - flash.from.x, y: flash.to.y - flash.from.y },
              family: "phaserRings",
              id: impactViewId(flash),
            },
          ]
        : [],
    ),
  ];
}

/** The flight's blast flashes still showing. */
export function activeBlastFlashes(flight: FlightState): readonly BlastFlash[] {
  return blastFlashes.get(flight) ?? [];
}

function ageFlashes(dt: number, flight: FlightState): void {
  const impacts = projectileImpacts.get(flight) ?? [];
  for (const impact of impacts) {
    impact.age += dt;
  }
  projectileImpacts.set(
    flight,
    impacts.filter((impact) => impact.age < 0.65),
  );
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
  for (let at = entry; at <= exit; at = at < exit && at + 2 > exit ? exit : at + 2) {
    const point = { x: origin.x + direction.x * at, y: origin.y + direction.y * at };
    if (
      halfWidth === BEAM.halfWidth
        ? outlineContact(drawn.frames[frame] ?? drawn.frames[0]!, imageObject, point, halfWidth)
        : worldSceneryContact(
            flightWorldContext(flight),
            imageObject,
            point,
            halfWidth,
            frame,
            drawn,
          )
    ) {
      return at;
    }
  }
  return null;
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
  const direction = { x: aim.x / span, y: aim.y / span };
  let first: { object: SpaceObject; part: string | null; at: number } | null = null;
  const nearer = (object: SpaceObject, part: string | null, at: number | null) => {
    if (at !== null && (!first || at < first.at)) {
      first = { at, object, part };
    }
  };
  const consider = (object: SpaceObject, part: string | null, center: Vec, radius: number) =>
    nearer(
      object,
      part,
      rayCircle(
        origin,
        direction,
        range,
        worldPoint(flightWorldContext(flight), origin, center),
        radius + BEAM.halfWidth,
      ),
    );
  // Where the beam first meets a drawn outline, within its half-width, refined in 2-unit steps.
  const drawn = (object: SpaceObject, part: string | null, outline: Parts) => {
    const bound = partsReach(worldParts(outline)) + BEAM.halfWidth;
    const image = worldPoint(flightWorldContext(flight), origin, object);
    const entry = rayCircle(origin, direction, range, image, bound);
    if (entry === null) {
      return;
    }
    const exit = Math.min(range, entry + 2 * bound);
    for (let at = entry; at <= exit; at = at < exit && at + 2 > exit ? exit : at + 2) {
      const point = { x: origin.x + direction.x * at, y: origin.y + direction.y * at };
      if (outlineContact(outline, image, point, BEAM.halfWidth)) {
        nearer(object, part, at);
        return;
      }
    }
  };
  for (const object of flight.objects) {
    if (object.hp <= 0) {
      continue;
    }
    if (SCENERY.includes(object.kind)) {
      nearer(
        object,
        null,
        sceneryEntry(
          flight,
          origin,
          direction,
          range,
          frameOf(flight, object),
          drawnOf(flight, object),
          object,
        ),
      );
    } else if (object.kind === "enemy" && object.enemy && !object.enemy.salvaged) {
      // A heavy's live hardpoints take the beam first, then its hull.
      for (const part of liveParts(content, flight.galaxy, object)) {
        const outline = enemyPartOutline(ROUTE_POSITION[flight.galaxy], object.enemy, part.id);
        if (outline) {
          drawn(object, part.id, outline);
        } else {
          consider(object, part.id, part, partReach(content));
        }
      }
      const hull = enemyHull(object.enemy, ROUTE_POSITION[flight.galaxy]);
      if (hull) {
        drawn(object, null, hull);
      } else {
        consider(object, null, object, object.radius);
      }
    }
  }
  const struck = first as {
    object: SpaceObject;
    part: string | null;
    at: number;
  } | null;
  // A mine nearer than whatever else the beam meets pops and stops it.
  let popped: { at: number; mine: Mine } | null = null;
  for (const mine of flight.mines) {
    const at = armed(mine)
      ? rayCircle(
          origin,
          direction,
          struck?.at ?? range,
          worldPoint(flightWorldContext(flight), origin, mine),
          MINE_REACH + BEAM.halfWidth,
        )
      : null;
    if (at !== null && (!popped || at < popped.at)) {
      popped = { at, mine };
    }
  }
  if (popped) {
    popped.mine.end = { age: 0, kind: "pop" };
    const flashes = beamFlashes.get(flight) ?? [];
    flashes.push({
      age: 0,
      from: origin,
      hit: true,
      to: { x: origin.x + direction.x * popped.at, y: origin.y + direction.y * popped.at },
    });
    beamFlashes.set(flight, flashes);
    return;
  }
  const reach = struck ? struck.at : range;
  const end = { x: origin.x + direction.x * reach, y: origin.y + direction.y * reach };
  const contact = struck
    ? projectileContact(flight, struck.object, end, BEAM.halfWidth, end, struck.part)
    : end;
  const flashes = beamFlashes.get(flight) ?? [];
  flashes.push({
    age: 0,
    from: origin,
    hit: struck !== null,
    to: contact,
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

/**
 * An enemy Phaser or charged lance shot and its tell: a Phaser's aim line is fixed where it
 * started; a lance's line follows its ship and tracks Ada, then holds still. The beam fires
 * along the line. `end` stops at the first obstacle, and at Ada once the beam hits her.
 * View-only timing, never saved: a restored flight drops a shot still in its tell.
 */
export interface EnemyBeam {
  /** Seconds since the tell appeared. */
  age: number;
  damage: number;
  direction: Vec;
  /**
   * A fired Phaser's visible beam this step: from its ship's current muzzle along the weapon's
   * current aim at the length it fired with. `muzzle` and `end` keep the fire-time line, where
   * the hit landed. Null before it fires, and always for a lance.
   */
  drawn: { from: Vec; to: Vec } | null;
  end: Vec;
  fired: boolean;
  hardpointId: string | null;
  kind: "lance" | "phaser";
  muzzle: Vec;
  /** The muzzle's offset from its ship, which a lance's line follows while it tracks. */
  offset: Vec;
  ownerId: string;
  range: number;
  /** Whether an obstacle, or Ada on firing, stopped the line short of its range. */
  stopped: boolean;
  /** The volley that picked the drawn barrel it fired from. */
  volley: number;
}
/** When each beam fires after its tell begins, and how long its beam then shows. */
const BEAM_TIMING = {
  // art/weapons.md "Charged lance": the beam shows for 300 ms.
  lance: {
    fires: LANCE_TELL.trackSeconds + LANCE_TELL.lockSeconds,
    shows: Math.max(0.3, BEAM.sparkSeconds),
  },
  phaser: { fires: PHASER_AIM_SECONDS, shows: Math.max(BEAM.flashSeconds, BEAM.sparkSeconds) },
} as const;

/** A unit world heading's length on screen. */
function projectedLength(heading: Vec): number {
  return Math.hypot(heading.x - heading.y, (heading.x + heading.y) / 2);
}
const enemyBeams = new WeakMap<FlightState, EnemyBeam[]>();

/** The flight's enemy Phaser shots still aiming or showing. */
export function activeEnemyBeams(flight: FlightState): readonly EnemyBeam[] {
  return enemyBeams.get(flight) ?? [];
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

/**
 * Starts an enemy Phaser's or lance's tell along its aim from the muzzle; its delay counts
 * toward the tell. `ship` is where the ship was when it fired.
 */
function chargeEnemyBeam(
  damage: number,
  range: number,
  ship: Vec,
  fire: Pick<FireIntent, "aim" | "delay" | "hardpointId" | "origin" | "volley" | "weapon">,
  ownerId: string,
  flight: FlightState,
): void {
  const span = length(fire.aim);
  const kind = fire.weapon === "chargedLance" ? "lance" : "phaser";
  if (!span || (kind === "phaser" && range <= 0)) {
    return;
  }
  const beams = enemyBeams.get(flight) ?? [];
  beams.push({
    age: -fire.delay,
    damage,
    direction: { x: fire.aim.x / span, y: fire.aim.y / span },
    drawn: null,
    end: { ...fire.origin },
    fired: false,
    hardpointId: fire.hardpointId,
    kind,
    muzzle: { ...fire.origin },
    offset: { x: fire.origin.x - ship.x, y: fire.origin.y - ship.y },
    ownerId,
    range,
    stopped: false,
    volley: fire.volley,
  });
  enemyBeams.set(flight, beams);
}

/**
 * Moves a fired Phaser's visible beam onto its ship's current muzzle and aim at its fire-time
 * length; the beam holds where it last was once its ship or weapon can no longer aim.
 */
function followEnemyBeam(content: GameContent, flight: FlightState, beam: EnemyBeam): void {
  const owner = flight.objects.find((object) => object.id === beam.ownerId);
  const line =
    owner?.enemy && owner.hp > 0
      ? enemyFireLine(
          enemyEquipmentDefinition(flight.galaxy, owner.enemy),
          content.tuning.flight.shipRadius * 2,
          beam.hardpointId,
          beam.volley,
          owner.enemy,
        )
      : null;
  if (!line) {
    return;
  }
  const reach = length({ x: beam.end.x - beam.muzzle.x, y: beam.end.y - beam.muzzle.y });
  beam.drawn = {
    from: line.origin,
    to: { x: line.origin.x + line.aim.x * reach, y: line.origin.y + line.aim.y * reach },
  };
}

/** Whether a lance's ship and mount can still fire it: alive, armed and powered. */
function lanceHolds(beam: EnemyBeam, flight: FlightState): SpaceObject | undefined {
  const owner = flight.objects.find((object) => object.id === beam.ownerId);
  const enemy = owner?.enemy;
  return owner &&
    owner.hp > 0 &&
    enemy &&
    !enemy.disabled &&
    !enemy.salvaged &&
    enemy.hardpoints.some((part) => part.id === beam.hardpointId && part.hp > 0)
    ? owner
    : undefined;
}

/**
 * Ages each enemy Phaser and lance shot. A lance's line follows its ship and aims at Ada while
 * it tracks, then holds still, and runs as far as the game area is wide on screen; it goes out
 * if its ship or mount can no longer fire. Each line stops at the first obstacle. When its tell
 * ends the beam fires along it and damages Ada where it first meets her drawn ship within the
 * beam half-width. Each shows for its beam and spark, then goes.
 */
function stepEnemyBeams(
  content: GameContent,
  dt: number,
  viewportWidth: number,
  flight: FlightState,
): void {
  const beams = enemyBeams.get(flight);
  if (!beams) {
    return;
  }
  const out = new Set<EnemyBeam>();
  for (const beam of beams) {
    beam.age += dt;
    if (beam.fired) {
      if (beam.kind === "phaser") {
        followEnemyBeam(content, flight, beam);
      }
      continue;
    }
    if (beam.kind === "lance") {
      const owner = lanceHolds(beam, flight);
      if (!owner) {
        out.add(beam);
        continue;
      }
      if (beam.age < LANCE_TELL.trackSeconds) {
        beam.muzzle = { x: owner.x + beam.offset.x, y: owner.y + beam.offset.y };
        const toward = worldDelta(flightWorldContext(flight), beam.muzzle, flight.player);
        const span = length(toward);
        if (span) {
          beam.direction = { x: toward.x / span, y: toward.y / span };
        }
      }
      beam.range = viewportWidth / projectedLength(beam.direction);
    }
    const halfWidth = beam.kind === "lance" ? LANCE_HIT_RADIUS : BEAM.halfWidth;
    const stop = obstacleStop(beam.muzzle, beam.direction, beam.range, flight, halfWidth);
    let reach = stop;
    if (beam.age >= BEAM_TIMING[beam.kind].fires) {
      beam.fired = true;
      for (let at = 0; at <= stop; at = at < stop && at + 2 > stop ? stop : at + 2) {
        const point = {
          x: beam.muzzle.x + beam.direction.x * at,
          y: beam.muzzle.y + beam.direction.y * at,
        };
        if (touchesAda(flight, point, halfWidth)) {
          reach = at;
          damage(beam.damage, flight);
          break;
        }
      }
    }
    beam.stopped = reach < beam.range;
    beam.end = {
      x: beam.muzzle.x + beam.direction.x * reach,
      y: beam.muzzle.y + beam.direction.y * reach,
    };
    if (beam.fired && beam.kind === "phaser") {
      beam.drawn = { from: { ...beam.muzzle }, to: { ...beam.end } };
    }
  }
  enemyBeams.set(
    flight,
    beams.filter(
      (beam) =>
        !out.has(beam) && beam.age < BEAM_TIMING[beam.kind].fires + BEAM_TIMING[beam.kind].shows,
    ),
  );
}

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

/** The id of the wreck that replaces a destroyed enemy. */
export function wreckId(enemyId: string): string {
  return `${WRECK_ID_PREFIX}${enemyId}`;
}

/** A defeated enemy is replaced by a wreck that breaks apart, then releases its drops. */
function destroyEnemy(object: SpaceObject, flight: FlightState): void {
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
function stepWrecks(
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
    // The ammo roll has its own stream, so it never moves the Stardust's spread.
    const ammo = dropRandom(flight.seed, `ammo:${object.id}`);
    if (rollAmmoDrop(ECONOMY, ammoOwned(flight), object.wreck.archetype, ammo)) {
      pushAmmoPack(content, object, flight);
    }
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
  clearLocalGuardSummons(flight);
  const ship = shipTuning(ECONOMY, content, flight.levels);
  const oreBefore = flight.shieldOreSpent ?? 0;
  let remaining = dt;
  while (remaining > 1e-9 && flight.shield > 0) {
    const slice = Math.min(remaining, SIMULATION_STEP_SECONDS);
    remaining -= slice;
    flight.time += slice;
    flight.sinceDamage += slice;
    generate(content, flight.player, flight);
    moveDebris(content, slice, events, flight);
    const playerBeforeMove = move(content, slice, input, events, flight, freshTravel);
    worldSyncFlightRegion(flightWorldContext(flight), content, flight);
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
      fire(
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
    enemies(
      { viewportHeight: input.viewportHeight ?? SCREEN.height, viewportWidth },
      content,
      slice,
      worldDelta(flightWorldContext(flight), playerBeforeMove, flight.player),
      flight,
      events,
      shotDelays,
    );
    clearNeedleEnemies(flight);
    if (flight.phantom?.phase !== "salvaged") {
      stepEnemyBeams(content, slice, viewportWidth, flight);
      stepRingEmissions(slice, flight);
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
    shots(content, slice, flight, events, shotDelays);
    stepMines(slice, flight);
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
  cueGuards(content, flight, events);
  for (const object of flight.objects) {
    if (
      object.kind === "destination" &&
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
