import { ASTEROID_LOOT } from "../data/asteroidLoot.ts";
import { ASTEROID_FIELDS, CHUNK_CATALOG } from "../data/chunkCatalog.ts";
import { SCENERY_IMPACT_SECONDS, sceneryImpactDamage } from "../data/collisionDamage.ts";
import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { enemyActorDefinition } from "../data/enemyActorDefinition.ts";
import type { EnemyActorKind } from "../data/enemyActors.ts";
import {
  type EncounterEntry,
  encounterRate,
  ENEMY_AIM,
  type EnemyArchetype,
  enemyCatalog,
  enemyEncounterTuning,
  enemyOnly,
  escortTuning,
  FRIGATE_ESCORT_COUNT,
  LANCE_TELL,
  MINE_LAYER,
  PHASER_AIM_SECONDS,
} from "../data/enemyCatalog.ts";
import { ENEMY_SIZE_RATIOS } from "../data/enemyDimensions.ts";
import { WRECK_ID_PREFIX } from "../data/enemyIdentity.ts";
import { ENEMY_AVOIDANCE } from "../data/enemyNavigation.ts";
import { byPosition, ROUTE_POSITION, type RoutePosition } from "../data/galaxies.ts";
import { CURRENTS, HUNTING_PACKS, ORE_FIELDS } from "../data/galaxyFeatures.ts";
import { HOLODISKS } from "../data/holodisks.ts";
import { JOB_TUNING, LANDMARK_TUNING } from "../data/jobs.ts";
import { PHANTOM_DESTINATIONS, PHANTOM_FLAGSHIP, PHANTOM_TUNING } from "../data/phantom.ts";
import { RESOURCE_ROCKS } from "../data/resourceRocks.ts";
import { SCREEN } from "../data/screen.ts";
import { SIMULATION_STEP_SECONDS } from "../data/simulation.ts";
import { SPAWNER_POLICIES } from "../data/spawnerCatalog.ts";
import { CARTWHEEL_STORY_SHIPS } from "../data/storyShips.ts";
import type { GalaxyNumber, GameContent, Weapon } from "../data/types.ts";
import {
  BEAM,
  LANCE_HIT_RADIUS,
  MISSILE_HIT_RADIUS,
  weaponAt,
  type WeaponDefinition,
} from "../data/weaponCatalog.ts";
import type { StationGuardAnchor } from "./ai/stationGuardPatrol.ts";
import { worldNavigationQuery } from "./ai/worldNavigation.ts";
import { rollAsteroidLoot } from "./asteroidLoot.ts";
import {
  ASTEROID_SHAPES,
  asteroidSize,
  bounce,
  orbitMotion,
  placementRadius,
  reflectDirection,
  rockFrame,
  sceneryBound,
  sceneryShape,
  scenerySilhouette,
  type Silhouette,
  worldSceneryBlocksSegment,
  worldSceneryBodyContact,
  worldSceneryContact,
} from "./asteroids.ts";
import { planChunk } from "./chunkTemplates.ts";
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
  createEnemy,
  damageEnemy,
  enemyDefeated,
  type FireIntent,
  hardpointOffset,
  stepDebris,
  stepEnemy,
} from "./enemyAi.ts";
import { enemyEquipmentDefinition, rollEnemyWeaponLevel } from "./enemyEquipment.ts";
export { rollEncounter } from "./encounterRoll.ts";
import { flightEncounterSeed, flightWorldContext } from "./flightTopology.ts";
import {
  createFrigateEscorts,
  FRIGATE_ESCORT_ROLE,
  frigateEscortStation,
  requiredFrigateEscortId,
} from "./frigateEscorts.ts";
import {
  ACTIVE_CHUNK_RADIUS,
  beginFlightStep,
  escortPackId,
  liveEnemy,
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
import {
  hostileStationContext,
  materializeHostileStation,
  type PlannedHostileStation,
  type StationMaterialization,
  stationPopulationObjects,
} from "./hostileStations.ts";
import { phantomSongSpeed, stepPhantomAllies } from "./phantomAllies.ts";
import { playerWeaponCoverage, type PlayerWeaponCoverageContext } from "./playerWeaponCoverage.ts";
import { protectedRadius } from "./protectedPlaces.ts";
import {
  questGuardAnchor,
  questGuardFormationReach,
  questGuardHomePorts,
} from "./questGuardPlacement.ts";
import {
  readRequiredPlan,
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
  requiredWorldOccupantsPlacementClear,
  requiredWorldPlacementClear,
  requiredWorldPopulation,
  type RequiredWorldReservation,
} from "./requiredWorldReservations.ts";
import { routeGuardEvidence } from "./routeGuardEvidence.ts";
import { type PickupObstacle, stardustDiamond, stardustDropOffsets } from "./stardustPlacement.ts";
import { stationFormationClear } from "./stationPlacement.ts";
import { type ImpactFamily, impactFamily, type WeaponImpact } from "./weaponImpacts.ts";
import { worldCellAt, worldCellKey, worldCellsNear, worldGrid } from "./worldCells.ts";
import { worldDelta, worldDistance, worldPoint } from "./worldContacts.ts";
import { wrapPoint } from "./worldGeometry.ts";

export { activateRouteEncounter, syncFlightRegion } from "./geography.ts";
import {
  type Contact,
  outlineContact,
  outlinesContact,
  type Parts,
  partsReach,
  worldParts,
} from "./convex.ts";
import { debrisFrameOf, debrisSilhouette } from "./debrisBody.ts";
import {
  carriesStardust,
  dropRandom,
  rollAmmoDrop,
  rollEnemyDrop,
  rollRockAmmoDrop,
  rollSalvageDrop,
  splitStardust,
} from "./drops.ts";
import { enemyHull, enemyPartOutline } from "./enemyBody.ts";
import { landmarkSites } from "./landmarks.ts";
import { MINE_REACH, mineParts, mineSpin, mineTouches } from "./mineShape.ts";
import {
  clearNeedleEnemies,
  ensureNeedleDebris,
  isNeedleRim,
  needleChannelContains,
  needleChannelEntry,
  needleRimContact,
  needleRims,
} from "./needleFlight.ts";
import { nosePoint } from "./nose.ts";
import { worldClearOfOreFields, worldOreFieldsNear } from "./oreFields.ts";
import { orePickupSize, pickupOutline } from "./pickupBody.ts";
import { planPlayerVolley, projectileReach } from "./playerProjectiles.ts";
import { impactEntry, impactSurface } from "./projectileImpact.ts";
import { sceneryImpact } from "./sceneryImpact.ts";
import { rechargeShield } from "./shieldRecharge.ts";
import { shipBody, shipCircleContact, shipNearSegment, shipTouches } from "./shipBody.ts";
import { direction, speedFraction, stepShipMotion, turnToward } from "./shipPhysics.ts";
import {
  groupReach,
  memberPosition,
  worldFitsEncounter,
  worldRegionalEngagementAdmissions,
  worldSelectEncounter,
  worldSpawnerStage,
} from "./spawner.ts";
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
  Shot,
  SpaceObject,
  Vec,
} from "./types.ts";
import { noLevels, type ShipTuning, shipTuning } from "./upgrades.ts";
import { markVisited, visitedChunk } from "./visited.ts";
import { clampAmmo, ensureOwnedWeapons, grantedAmmo, shotsLeft, spendShot } from "./weapons.ts";

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
function frameOf(flight: FlightState, object: SpaceObject): number {
  if (debrisSilhouette(flight.galaxy, object)) {
    return debrisFrameOf(flight.galaxy, object, reducedMotions.get(flight) ?? false, flight.time);
  }
  const shape = sceneryShape(object);
  return shape
    ? rockFrame(
        shape,
        flight.seed,
        reducedMotions.get(flight) ?? false,
        object.id,
        flight.time,
        object.spinStart,
      )
    : 0;
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
  const grid = worldGrid(flightWorldContext(flight), content.tuning.chunkSize);
  return worldCellKey(grid, worldCellAt(grid, point));
}

/** Whether a point lies inside an existing friendly protected place. */
function pendingRequiredRoutes(flight: FlightState): readonly RequiredWorldReservation[] {
  return Object.values(flight.requiredPlans ?? {}).flatMap((plan) =>
    requiredPlanActors(plan).map((guard) => ({ guard, site: plan.site })),
  );
}

function requiredFootprintClear(
  content: GameContent,
  flight: FlightState,
  footprint: OptionalWorldFootprint,
): boolean {
  const context = { ...flightWorldContext(flight), content, galaxy: flight.galaxy };
  const authored =
    flight.galaxy === 3 || (flight.galaxy === 4 && flight.needle)
      ? stationPopulationObjects(flight)
      : [];
  return (
    requiredWorldPlacementClear(context, requiredRouteGeometry(content, flight), footprint) &&
    requiredWorldOccupantsPlacementClear(
      context,
      {
        actors: authored.filter(
          (object) =>
            liveEnemy(object) &&
            (flight.galaxy === 4
              ? object.enemy?.packId === "needle:exit"
              : object.routeId !== undefined ||
                object.enemy?.packId?.startsWith("route:") ||
                object.enemy?.escortOf?.startsWith("route:")),
        ),
        sites: authored.filter((object) => object.kind === "destination"),
      },
      footprint,
    )
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

function safe(content: GameContent, point: Vec, flight: FlightState): boolean {
  return (
    needleChannelContains({}, flight, point) ||
    flight.objects.some((o) => {
      const radius = protectedRadius(content, o);
      return radius !== null && worldDistance(flightWorldContext(flight), point, o) <= radius;
    })
  );
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
 * Whether an object's whole footprint stays outside every safe area and the safe radius of
 * every launch point, so no rock or drift path reaches one.
 */
function clearOfSafeAreas(content: GameContent, object: SpaceObject, flight: FlightState) {
  return (
    requiredPlacementClear(content, flight, object) &&
    flight.objects.every((o) => {
      const radius = protectedRadius(content, o);
      return radius === null || clearOf(flight, radius, o, object);
    }) &&
    arrivalPoints(flight).every((point) =>
      clearOf(flight, content.tuning.safeRadius, point, object),
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
const SCENERY = ["rock", "resource", "debris"];
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
  flight.shield = Math.max(0, flight.shield - impact.amount);
  flight.sinceDamage = 0;
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
  const outline = enemy && enemyHull(enemy);
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
  const reach = (ACTIVE_CHUNK_RADIUS + 1) * content.tuning.chunkSize;
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
  const reach = (ACTIVE_CHUNK_RADIUS + 1) * content.tuning.chunkSize;
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
  // A station's safe area holds no layout object or drift path from chunks generated before it.
  clearLayoutObjects(
    (object) =>
      object === station ||
      object.kind === "destination" ||
      clearOf(flight, ECONOMY.station.safeRadius, station, object),
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
  if (planningRequiredWorld.has(flight) || initializingRequiredChapter.has(flight)) {
    return;
  }
  worldActivateFlightRegion(flightWorldContext(flight), content, point, flight);
  ensureStations(content, point, flight);
  ensureDebrisRivers(content, point, flight);
  ensureNeedleDebris(content, flight);
  clearNeedleEnemies(flight);
  const size = content.tuning.chunkSize;
  const tuning = content.tuning.flight;
  const generated = generatedChunks(flight);
  const existing = new Set(flight.objects.map((object) => object.id));
  const grid = worldGrid(flightWorldContext(flight), size);
  for (const { x, y } of worldCellsNear(grid, size * 2, point)) {
    const key = `${x},${y}`;
    if (generated.has(key)) {
      continue;
    }
    flight.chunks.push(key);
    generated.add(key);
    chunkIndexes.get(flight)!.length = flight.chunks.length;
    const field = byPosition(ASTEROID_FIELDS, flight.galaxy);
    const plan = planChunk(CHUNK_CATALOG, {
      ...flightWorldContext(flight),
      asteroidDensity: tuning.asteroidDensity,
      asteroids: { field, shapes: ASTEROID_SHAPE_LIST },
      clearance: content.tuning.flight.shipRadius,
      galaxy: flight.galaxy,
      objectsPerChunk: tuning.objectsPerChunk,
      rockRadius: tuning.rockRadius,
      seed: flight.seed,
      shipRadius: tuning.shipRadius,
      size,
      spawnWeights: tuning.spawnWeights,
      x,
      y,
    });
    generateRegion(content, x, y, flight);
    for (const placement of plan.placements) {
      const shape = placement.asteroid ? ASTEROID_SHAPES.get(placement.asteroid) : undefined;
      const object: SpaceObject = {
        hp:
          placement.kind === "pickup"
            ? 1
            : placement.resource
              ? RESOURCE_ROCKS.classes[placement.resource].hp
              : shape
                ? field.hp[shape.size]
                : tuning.rockHp,
        id: placement.id,
        kind: placement.kind,
        radius: placement.kind === "pickup" ? tuning.pickupRadius : placement.radius,
        x: placement.x,
        y: placement.y,
        ...(shape ? { asteroid: shape.id } : {}),
        ...(placement.resource ? { resource: placement.resource } : {}),
      };
      // A drifting asteroid's place on its seeded path follows flight time, so paging and
      // saves resume it where it would be.
      if (placement.orbit) {
        object.orbit = { ...placement.orbit, x: placement.x, y: placement.y };
        const motion = orbitMotion(flight.time, object.orbit);
        object.x = motion.position.x;
        object.y = motion.position.y;
        object.velocity = motion.velocity;
      }
      if (object.kind !== "rock") {
        object.role = "discovery";
      }
      // A discovery cache holds Stardust; weapons come only from shops and enemy drops.
      if (object.kind === "pickup") {
        object.amount = ECONOMY.discoveryStardust;
      }
      const cachePickups: SpaceObject[] | null =
        object.kind === "pickup"
          ? stardustDiamond(ECONOMY, object).map((point, index, points) => ({
              ...object,
              ...point,
              amount: object.amount! / points.length,
              id: `${object.id}:stardust:${index}`,
              radius: ECONOMY.stardustPickupRadius,
              role: "stardust",
            }))
          : null;
      // Asteroids and resource rocks are not placed in currents or ore fields, drift loops
      // included; an ore field holds only its own rocks.
      const footprint = placementRadius(object) + (object.orbit?.radius ?? 0);
      const at = object.orbit ?? object;
      if (
        !existing.has(object.id) &&
        (object.kind !== "pickup" ||
          !flight.objects.some((candidate) => candidate.id.startsWith(`${object.id}:stardust:`))) &&
        !Object.hasOwn(flight.world.notables, object.id) &&
        clearOf(flight, content.tuning.safeRadius, flight.player, object) &&
        clearOfSafeAreas(content, object, flight) &&
        clearOfLandmarks(object, flight) &&
        (cachePickups === null ||
          cachePickups.every(
            (pickup) =>
              clearOf(flight, content.tuning.safeRadius, flight.player, pickup) &&
              clearOfSafeAreas(content, pickup, flight) &&
              clearOfLandmarks(pickup, flight),
          )) &&
        (object.kind === "pickup" ||
          (!worldInCurrent(flightWorldContext(flight), flight.galaxy, footprint, object) &&
            worldClearOfOreFields(flightWorldContext(flight), flight.galaxy, footprint, at)))
      ) {
        if (cachePickups) {
          for (const pickup of cachePickups) {
            canonicalObject(flight, pickup);
            flight.objects.push(pickup);
            existing.add(pickup.id);
          }
        } else {
          canonicalObject(flight, object);
          flight.objects.push(object);
          existing.add(object.id);
        }
      }
    }
    placeOreFields(content, x, y, existing, flight);
  }
}

/**
 * The platform's hull never turns: Art draws it once, as heading 0, which faces world +x, so
 * its turret mounts and muzzles take heading 0 too.
 */
export const PLATFORM_FACING: Readonly<Vec> = { x: 1, y: 0 };

/**
 * Cartwheel's seeded ore fields whose centres fall in chunk (x, y): their resource rocks and,
 * at a guarded field, a retained platform facing `PLATFORM_FACING`. A field within the
 * ore-field clearance of a station, the hub or a quantum jump arrival is left out.
 */
function placeOreFields(
  content: GameContent,
  x: number,
  y: number,
  existing: Set<string>,
  flight: FlightState,
): void {
  const size = content.tuning.chunkSize;
  const centre = { x: (x + 0.5) * size, y: (y + 0.5) * size };
  for (const field of worldOreFieldsNear(flightWorldContext(flight), flight.galaxy, size, centre)) {
    if (Math.floor(field.x / size) !== x || Math.floor(field.y / size) !== y) {
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
    field.rocks.forEach((rock, index) => {
      const object: SpaceObject = {
        ...rock,
        hp: RESOURCE_ROCKS.classes[rock.resource].hp,
        id: `${field.id}:${index}`,
        kind: "resource",
        radius: ASTEROID_SHAPES.get(rock.asteroid)!.radius,
        role: "discovery",
      };
      if (
        !existing.has(object.id) &&
        !Object.hasOwn(flight.world.notables, object.id) &&
        clearOf(flight, content.tuning.safeRadius, flight.player, object) &&
        clearOfSafeAreas(content, object, flight) &&
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
): SpaceObject {
  const weaponLevel = rollEnemyWeaponLevel(
    { encounterSeed: flightEncounterSeed(flight), galaxy: flight.galaxy },
    id,
  );
  const definition = enemyActorDefinition(flight.galaxy, archetype, id, weaponLevel);
  return {
    ...point,
    enemy: createEnemy(definition, { archetype, escortOf, id, packId, phase, weaponLevel }, point),
    hp: definition.hp,
    id,
    kind: "enemy",
    radius: content.tuning.flight.shipRadius * definition.sizeRatio,
  };
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
      content.tuning.flight.shipRadius,
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
      content.tuning.flight.shipRadius,
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
  const population = requiredWorldPopulation(flight, reservations);
  const placement = {
    ...flight,
    objects: [...population, ...reservations.map(({ site }) => site)],
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
  options: { packId?: string; escortOf?: string; home?: Vec; routeId?: string } = {},
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

/**
 * Whether chunk index `index` hosts an encounter cell for a possibly fractional chunk
 * spacing: it contains a multiple of the spacing. Integer spacings host every multiple.
 */
export function hostsEncounterCell(spacing: number, index: number): boolean {
  return Math.ceil(index / spacing) * spacing < index + 1;
}

/**
 * Chunk spacing of encounter cells. Areal density follows the galaxy's encounter rate, so
 * the spacing shrinks with its square root; adjacent cells stay a quiet distance apart.
 */
export function encounterSpacing(content: GameContent, galaxy: GalaxyNumber): number {
  const base = Math.max(
    3,
    Math.ceil(enemyEncounterTuning.quietDistance / content.tuning.chunkSize),
  );
  return base / Math.sqrt(encounterRate(galaxy));
}

/** Ships too heavy to drift with a current, and the fixed platform. */
const DRIFT_PROOF: readonly EnemyActorKind[] = ["frigate", "capital", "platform", "hostileStation"];

/** Flight starts and Travel arrivals, which encounters keep clear of. */
function arrivalPoints(flight: FlightState): Vec[] {
  return [FLIGHT_START, ...(flight.arrivals ?? [])];
}
const FLIGHT_START: Vec = { x: 0, y: 0 };

/** Complete encounter footprint; callers without a galaxy use Sunflower's policy. */
export function encounterReach(
  content: GameContent,
  archetype: EnemyArchetype,
  count: number,
  escorts: EncounterEntry["escorts"],
  galaxy: GalaxyNumber = 1,
): number {
  return groupReach(SPAWNER_POLICIES[galaxy], content.tuning.flight.shipRadius, {
    archetype,
    count,
    ...(escorts ? { escorts } : {}),
  });
}

/** Whether ships placed within `reach` of `point` could come within the calm radius. */
function nearArrival(
  content: GameContent,
  flight: FlightState,
  reach: number,
  point: Vec,
): boolean {
  return arrivalPoints(flight).some(
    (arrival) =>
      worldDistance(flightWorldContext(flight), arrival, point) <
      content.tuning.flight.arrivalCalm + reach,
  );
}

function generateRegion(content: GameContent, x: number, y: number, flight: FlightState): void {
  const size = content.tuning.chunkSize;
  // One encounter cell per quiet-distance grid; adjacent chunk traversal cannot duplicate it.
  const spacing = encounterSpacing(content, flight.galaxy);
  if (!hostsEncounterCell(spacing, x) || !hostsEncounterCell(spacing, y)) {
    return;
  }
  const next = random(hash(flightEncounterSeed(flight) ^ 9173, x, y));
  const center = { x: (x + 0.5) * size, y: (y + 0.5) * size };
  if (
    worldDistance(flightWorldContext(flight), center, flight.player) <
      content.tuning.safeRadius * 2 ||
    safe(content, center, flight)
  ) {
    return;
  }
  const region = Math.floor(next() * 4);
  if (region === 3) {
    const [low, high] = enemyEncounterTuning.debris.count;
    const count = low + Math.floor(next() * (high - low + 1));
    const angle = next() * Math.PI * 2;
    const [slow, fast] = enemyEncounterTuning.debris.speed;
    const speed = slow + next() * (fast - slow);
    for (let i = 0; i < count; i++) {
      const point = { x: center.x + (next() - 0.5) * size, y: center.y + (next() - 0.5) * size };
      const id = `ballistic:${x},${y}:${i}`;
      if (
        !safe(content, point, flight) &&
        requiredPlacementClear(content, flight, {
          ...point,
          hp: 1,
          id,
          kind: "debris",
          radius: content.tuning.flight.rockRadius,
        }) &&
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
  const archetypeRoll = next();
  const policy = SPAWNER_POLICIES[flight.galaxy];
  const stage = worldSpawnerStage(flightWorldContext(flight), policy, center);
  const previous = flight.objects.find((object) => object.enemy?.packId === packId)?.enemy;
  const escortObject = flight.objects.find(
    (object) => object.enemy?.packId === escortPackId(packId),
  );
  const escort = escortObject?.enemy;
  const initialized = Object.hasOwn(combat(flight).initialPackSizes, packId);
  // A represented pack keeps its original composition across geographic region changes.
  const plan =
    initialized && (previous || escort)
      ? {
          archetype:
            (previous?.archetype === "hostileStation" ? undefined : previous?.archetype) ??
            (escortObject?.role === FRIGATE_ESCORT_ROLE
              ? ("frigate" as const)
              : ("capital" as const)),
          count: combat(flight).initialPackSizes[packId] ?? 0,
          ...(previous?.archetype === "capital" || previous?.archetype === "frigate" || escort
            ? {
                escorts: {
                  archetype:
                    (escort?.archetype === "hostileStation" ? undefined : escort?.archetype) ??
                    ("fighter" as const),
                  count: combat(flight).initialPackSizes[escortPackId(packId)] ?? 0,
                },
              }
            : {}),
        }
      : worldSelectEncounter(
          hostileStationContext(flight),
          policy,
          stage,
          content.tuning.flight.shipRadius,
          requiredWorldPopulation(flight, pendingRequiredRoutes(flight)),
          center,
          countRoll,
          archetypeRoll,
        );
  if (!plan) {
    return;
  }
  const { archetype, count, escorts } = plan;
  // Half of Cartwheel's claim jumpers gather at the nearest ore field within this cell's reach.
  if (ORE_FIELDS.galaxies.includes(flight.galaxy) && archetype === "fighter") {
    const reach = (spacing * size) / 2;
    const field = worldOreFieldsNear(flightWorldContext(flight), flight.galaxy, reach, center).sort(
      (a, b) =>
        worldDistance(flightWorldContext(flight), a, center) -
        worldDistance(flightWorldContext(flight), b, center),
    )[0];
    const angle = next() * Math.PI * 2;
    if (field && next() < ORE_FIELDS.jumperShare) {
      const edge = ORE_FIELDS.diameter / 2;
      center.x = field.x + Math.cos(angle) * edge;
      center.y = field.y + Math.sin(angle) * edge;
    }
  }
  // Launches and jump arrivals begin calm: the whole encounter stays clear of them.
  if (
    nearArrival(
      content,
      flight,
      encounterReach(content, archetype, count, escorts, flight.galaxy),
      center,
    )
  ) {
    return;
  }
  // Reserve the complete optional formation before creating any of its mandatory escorts.
  if (
    !requiredFootprintClear(content, flight, {
      center,
      radius: encounterReach(content, archetype, count, escorts, flight.galaxy),
    })
  ) {
    return;
  }
  // Relocated claim jumpers must also fit the actual destination neighbourhood.
  if (
    !initialized &&
    !worldFitsEncounter(
      hostileStationContext(flight),
      policy,
      stage,
      content.tuning.flight.shipRadius,
      requiredWorldPopulation(flight, pendingRequiredRoutes(flight)),
      center,
      plan,
    )
  ) {
    return;
  }
  if (archetype === "frigate" && !initialized) {
    const leaders = Array.from({ length: count }, (_, index) => {
      const leader = spawnEnemy(
        content,
        flight,
        "frigate",
        `${packId}:${index}`,
        memberPosition(policy.memberSpacing, count, center, index),
        packId,
        next() * Math.PI * 2,
      );
      leader.persistent = false;
      return leader;
    });
    const followers = leaders.flatMap((leader, leaderIndex) =>
      createFrigateEscorts(
        {
          encounterSeed: flightEncounterSeed(flight),
          galaxy: flight.galaxy,
          id: (index) => `${escortPackId(packId)}:${leaderIndex * FRIGATE_ESCORT_COUNT + index}`,
          packId: escortPackId(packId),
          persistent: false,
          shipRadius: content.tuning.flight.shipRadius,
        },
        leader,
      ),
    );
    const whole = [...leaders, ...followers];
    if (
      whole.some(
        (member) =>
          safe(content, member, flight) ||
          !requiredPlacementClear(content, flight, member) ||
          needleChannelContains({ radius: member.radius }, flight, member) ||
          flight.objects.some((other) => !clearOf(flight, member.radius, member, other)),
      )
    ) {
      return;
    }
    if (
      whole.some((member, index) =>
        whole.slice(index + 1).some((other) => !clearOf(flight, member.radius, member, other)),
      )
    ) {
      return;
    }
    for (const member of whole) {
      canonicalObject(flight, member);
      flight.objects.push(member);
    }
    combat(flight).initialPackSizes[packId] = leaders.length;
    combat(flight).initialPackSizes[escortPackId(packId)] = followers.length;
    return;
  }
  admitGroup(content, flight, next, { archetype, count, escortOf: null, packId }, (index) =>
    memberPosition(policy.memberSpacing, count, center, index),
  );
  if (escorts) {
    // Escorts form their own pack, so regeneration restores each group's survivors by count.
    const gap =
      enemyCatalog[archetype].sizeRatio * content.tuning.flight.shipRadius +
      escortTuning.stationGap;
    admitGroup(
      content,
      flight,
      next,
      {
        ...escorts,
        escortOf:
          archetype === "frigate"
            ? (index: number) => `${packId}:${Math.floor(index / FRIGATE_ESCORT_COUNT)}`
            : `${packId}:0`,
        packId: escortPackId(packId),
        ...(archetype === "frigate" ? { role: FRIGATE_ESCORT_ROLE } : {}),
      },
      (_, phase) => ({ x: center.x + Math.cos(phase) * gap, y: center.y + Math.sin(phase) * gap }),
    );
  }
}

/**
 * Admits a seeded group as one pack. A pack seen before admits only its unloaded survivor
 * budget, preserving its casualty count; escorts start on their stations.
 */
function admitGroup(
  content: GameContent,
  flight: FlightState,
  next: () => number,
  group: {
    archetype: EnemyArchetype;
    count: number;
    escortOf: string | null | ((index: number) => string);
    packId: string;
    role?: string;
  },
  place: (index: number, phase: number) => Vec,
): void {
  if (flight.galaxy === 6 && flight.phantom?.phase === "salvaged") {
    return;
  }
  const { archetype, count, escortOf, packId } = group;
  const state = combat(flight);
  const initialized = Object.hasOwn(state.initialPackSizes, packId);
  let budget = initialized ? (state.unloadedPackMembers?.[packId] ?? 0) : count;
  let admitted = 0;
  const existing = flight.objects.filter(
    (object) => object.hp > 0 && object.enemy?.packId === packId,
  ).length;
  // A pack recorded under an earlier roster can exceed this cell's roll; keep its slots.
  const slots = initialized ? Math.max(count, state.initialPackSizes[packId] ?? 0) : count;
  for (let i = 0; i < slots && budget > 0; i++) {
    const phase = next() * Math.PI * 2;
    const object = spawnEnemy(
      content,
      flight,
      archetype,
      `${packId}:${i}`,
      place(i, phase),
      packId,
      phase,
      typeof escortOf === "function" ? escortOf(i) : escortOf,
    );
    if (group.role) {
      object.role = group.role;
    }
    if (persistentObject(object)) {
      object.persistent = false;
    }
    if (
      !safe(content, object, flight) &&
      !needleChannelContains({ radius: object.radius }, flight, object) &&
      !flight.objects.some((other) => other.id === object.id) &&
      !Object.hasOwn(flight.world.notables, object.id)
    ) {
      canonicalObject(flight, object);
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
  const destinations = flight.objects.filter((object) => protectedRadius(content, object) !== null);
  const positions = new Map<SpaceObject, Vec>();
  const maxRadius = flight.objects.reduce(
    (radius, object) => Math.max(radius, object.radius),
    content.tuning.safeRadius,
  );
  const guardSet = new Set(guards);
  // A capital ignores unplaced capital guards; each of those is placed against it afterward.
  const blocked = (guard: SpaceObject, point: Vec): boolean =>
    destinations.some(
      (object) =>
        worldDistance(flightWorldContext(flight), object, point) <
        (protectedRadius(content, object) ?? 0) + guard.radius + 120,
    ) ||
    flight.objects.some(
      (object) =>
        object !== guard &&
        !(capital(guard) && capital(object) && guardSet.has(object) && !positions.has(object)) &&
        ["enemy", "rock", "resource", "debris"].includes(object.kind) &&
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
 * A summoned guard holds fire until its centre is inside the current play view, `viewportWidth`
 * wide at the 720x360 base's aspect around Ada, then fights as usual; disabled, destroyed or gone,
 * it is released too.
 */
function releaseSummonedGuards(viewportWidth: number, flight: FlightState): void {
  if (!flight.summonedGuards) {
    return;
  }
  const view = { height: (viewportWidth * SCREEN.height) / SCREEN.width, width: viewportWidth };
  flight.summonedGuards = flight.summonedGuards.filter((id) => {
    const guard = flight.objects.find((object) => object.id === id);
    if (!guard || guard.hp <= 0 || guard.enemy?.disabled) {
      return false;
    }
    const context = flightWorldContext(flight);
    const point = worldPoint(context, flight.player, guard);
    if (!onScreen(view, flight.player, { radius: 0, x: point.x, y: point.y })) {
      return true;
    }
    if (guard.enemy) {
      const pursuit = enemyEquipmentDefinition(flight.galaxy, guard.enemy).pursuit;
      // A remote summons starts its local fight here instead of immediately leashing back.
      if (
        worldDistance(context, guard.enemy.home, guard) >= pursuit.homeRadius ||
        worldDistance(context, guard.enemy.home, flight.player) > pursuit.homeRadius
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
function guardPack(content: GameContent, leader: Vec, flight: FlightState): void {
  const { pack, packSize } = HOLODISKS.guard;
  const packId = "route:holodisk:pack";
  for (let i = 0; i < packSize; i++) {
    const angle = (i * Math.PI * 2) / packSize;
    const member = spawnEnemy(
      content,
      flight,
      pack,
      `${packId}:${i}`,
      { x: leader.x + Math.cos(angle) * 90, y: leader.y + Math.sin(angle) * 90 },
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
      content.tuning.safeRadius +
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
  const offset = content.tuning.safeRadius + radius + 120;
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
  // Story destinations keep storySpacing from each other and clear of the galaxy's fixed
  // stations and landmarks.
  const crowded = (point: Vec) =>
    flight.objects.some(
      (o) =>
        o.kind === "destination" && worldDistance(flightWorldContext(flight), o, point) < spacing,
    ) ||
    worldStationsNear(
      flightStationContext(flight),
      ECONOMY,
      flight.galaxy,
      ECONOMY.station.destinationClearance,
      point,
    ).length > 0 ||
    landmarkSites(flight.galaxy).some(
      (site) =>
        worldDistance(flightWorldContext(flight), site, point) < LANDMARK_TUNING.placeClearance,
    );
  while (crowded(target)) {
    target.x -= heading.y * spacing;
    target.y += heading.x * spacing;
  }
  // They also keep a current's clearance: the nearest clear point within a short reach, so
  // the destination stays near where it would have been and its chunks stay in one region.
  if (worldInCurrent(flightWorldContext(flight), flight.galaxy, CURRENTS.clearance, target)) {
    const step = CURRENTS.width[1] / 2;
    search: for (let ring = 1; ring <= 8; ring++) {
      for (let spoke = 0; spoke < 16; spoke++) {
        const angle = (spoke * Math.PI) / 8;
        const point = {
          x: target.x + Math.cos(angle) * ring * step,
          y: target.y + Math.sin(angle) * ring * step,
        };
        if (
          !worldInCurrent(flightWorldContext(flight), flight.galaxy, CURRENTS.clearance, point) &&
          !crowded(point)
        ) {
          target.x = point.x;
          target.y = point.y;
          break search;
        }
      }
    }
  }
  return ensureDestinationAt(content, id, target, flight);
}

/** A seeded chapter site uses the same destination creation and safe-area clearance as exploration. */
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
  // A destination's safe area holds no layout object or drift path from earlier chunks.
  clearLayoutObjects(
    (o) => o.kind === "destination" || clearOf(flight, content.tuning.safeRadius, object, o),
    flight,
  );
  relocateRouteGuards(content, flight);
  flight.shots = flight.shots.filter(
    (s) =>
      !s.enemy || worldDistance(flightWorldContext(flight), s, object) > content.tuning.safeRadius,
  );
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
    (o) => o.kind === "destination" || clearOf(flight, content.tuning.safeRadius, object, o),
    flight,
  );
  flight.shots = flight.shots.filter(
    (s) =>
      !s.enemy || worldDistance(flightWorldContext(flight), s, object) > content.tuning.safeRadius,
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
      .filter((id) => !readRequiredRolePlan(flight, id))
      .map((id) => {
        const point = progress.requiredSites?.[id];
        return point
          ? ensureDestinationAt(content, id, point, projection)
          : ensureDestination(content, id, projection);
      });
    for (const site of sites) {
      ensureRouteEncounter(content, site.id, projection);
    }
    placeGuards(
      content,
      projection.objects.filter((actor) => actor.enemy?.packId === "route:holodisk:pack"),
      projection,
    );
    const population = stationPopulationObjects(projection);
    for (const site of sites) {
      const leader = population.find((actor) => actor.id === `route:${site.id}`)!;
      const actors = [
        leader,
        ...population.filter(
          (actor) =>
            actor.id !== leader.id &&
            (actor.enemy?.escortOf === leader.id ||
              (site.id === "holodisk" && actor.enemy?.packId === "route:holodisk:pack")),
        ),
      ];
      if (!progress.requiredSites?.[site.id]) {
        const reach = questGuardFormationReach(
          questGuardPlacementContext(content, projection),
          actors,
        );
        const span = requiredSiteSpan(content, reach);
        const heading = direction(length(flight.facing) ? flight.facing : { x: 0, y: -1 });
        const offset = worldDelta(flightWorldContext(flight), flight.player, site);
        const distance = Math.max(0, span - offset.x * heading.x - offset.y * heading.y);
        const delta = { x: heading.x * distance, y: heading.y * distance };
        site.x += delta.x;
        site.y += delta.y;
        canonicalObject(flight, site);
        for (const actor of actors) {
          actor.x += delta.x;
          actor.y += delta.y;
          if (actor.enemy) {
            actor.enemy.position.x += delta.x;
            actor.enemy.position.y += delta.y;
            actor.enemy.home.x += delta.x;
            actor.enemy.home.y += delta.y;
          }
          canonicalObject(flight, actor);
        }
      }
      storeRequiredRolePlan(progress, flight, {
        actors,
        role: site.id === "holodisk" ? "whirlpool-holodisk" : "whirlpool-capital",
        site,
      });
    }
  } finally {
    planningRequiredWorld.delete(projection);
  }
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
  const key = chunk(flight, content, object);
  markVisited(flight.visited, key);
  flight.shots = flight.shots.filter(
    (s) =>
      !s.enemy || worldDistance(flightWorldContext(flight), s, object) > content.tuning.safeRadius,
  );
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
  const definition = weaponAt(flight.weapon, flight.levels.weapons[flight.weapon]);
  const family = impactFamily(flight.weapon);
  // One shot uses one; emptying the weapon switches to Laser after this shot.
  if (spendShot(flight)) {
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
  flight.fireCooldown += releaseFriendlyVolley(
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
): number {
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
  return volley.interval;
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
 * battle square. Danger has no release time and no safe-area exemption.
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
/** Removes `amount` HP from Ada's shield unless she is in a safe area. */
function damage(content: GameContent, amount: number, flight: FlightState): void {
  if (safe(content, flight.player, flight)) {
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
/** Undocking leaves Ada at rest where she docked, so Use offers Dock again at once. */
export function undockFlight(flight: FlightState): void {
  flight.velocity = { x: 0, y: 0 };
  movementHeadings.delete(flight);
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
function move(
  content: GameContent,
  dt: number,
  input: FlightInput,
  events: FlightEvent[],
  flight: FlightState,
): void {
  const magnitude = Math.min(1, length(input.move));
  const physics = towing(flight, shipTuning(ECONOMY, content, flight.levels).physics);
  const top = physics.maxSpeed;
  const motion = stepShipMotion(
    physics,
    dt,
    { maxSpeed: top },
    {
      direction: input.move,
      speed:
        (input.throttle === undefined
          ? movementSpeedFraction(content.tuning, magnitude)
          : Math.min(1, Math.max(0, input.throttle))) * top,
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
      flight.freshDistance += worldDistance(flightWorldContext(flight), before, flight.player);
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
}
/**
 * Whether an enemy presses Ada: engaged, neither returning nor fleeing, within its perception,
 * with targetable saying neither it nor Ada is inside a friendly safe zone.
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
export function dronesNear(content: GameContent, flight: FlightState): boolean {
  const adaSafe = safe(content, flight.player, flight);
  return flight.objects.some(
    (object) =>
      object.kind === "enemy" &&
      object.hp > 0 &&
      presses(!adaSafe && !safe(content, object, flight), flight, object),
  );
}

function enemies(
  content: GameContent,
  dt: number,
  flight: FlightState,
  events: FlightEvent[],
  shotDelays: Map<string, number>,
): void {
  if (flight.galaxy === 6 && flight.phantom?.phase === "salvaged") {
    flight.shots = flight.shots.filter((shot) => !shot.enemy);
    flight.mines = [];
    for (const object of flight.objects) {
      if (object.enemy) {
        object.enemy.engaged = false;
        object.enemy.velocity = { x: 0, y: 0 };
      }
    }
    return;
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
    }
    // Hit circles follow the catalog, so saves from earlier sizes adopt the current ones.
    object.radius = content.tuning.flight.shipRadius * ENEMY_SIZE_RATIOS[object.enemy.archetype];
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
          !safe(content, flight.player, flight) &&
          !safe(content, object, flight) &&
          worldDistance(flightWorldContext(flight), object, flight.player) <= definition.perception
        );
      })
      .map((object) => object.id),
  );
  const admissions = worldRegionalEngagementAdmissions(
    hostileStationContext(flight),
    SPAWNER_POLICIES[flight.galaxy],
    requiredWorldPopulation(flight, pendingRequiredRoutes(flight)),
    eligible,
    flight.player,
  );
  for (const object of objects) {
    const state = object.enemy!;
    const base = enemyEquipmentDefinition(flight.galaxy, state);
    const blockade =
      flight.galaxy === 6 && PHANTOM_DESTINATIONS.some((id) => id === object.routeId);
    const song = phantomSongSpeed(flight.phantom?.allies ?? [], object);
    const definition =
      blockade || song !== 1
        ? {
            ...base,
            physics:
              song === 1
                ? base.physics
                : { ...base.physics, maxSpeed: base.physics.maxSpeed * song },
            pursuit: blockade
              ? { ...base.pursuit, homeRadius: PHANTOM_TUNING.blockadeReach }
              : base.pursuit,
          }
        : base;
    const targetable = !safe(content, flight.player, flight) && !safe(content, object, flight);
    const visible = visibility.get(object.id)!;
    const before = { x: object.x, y: object.y };
    const escortLeader =
      object.role === FRIGATE_ESCORT_ROLE
        ? flight.objects.find(
            (other) => other.id === state.escortOf && other.hp > 0 && !other.enemy?.disabled,
          )
        : undefined;
    const approach = escortLeader ? frigateEscortStation(escortLeader, state.phase) : flight.player;
    const navigationQuery = worldNavigationQuery(
      {
        ...flightWorldContext(flight),
        drawnOf: (entry) => drawnOf(flight, entry),
        frameOf: (entry) => frameOf(flight, entry),
      },
      flight.objects,
      definition,
      { ...state, position: before, radius: object.radius },
    );
    const stationGuardAnchor = guardPatrolFrame(content, flight, object);
    const intent = stepEnemy(
      definition,
      {
        ...flightWorldContext(flight),
        adaWidth: content.tuning.flight.shipRadius * 2,
        dormantPackMembers: worldRetainedPackMembers(flightWorldContext(flight), content, flight),
        dt,
        engagementAdmitted: admissions.has(object.id),
        initialPackSizes: combat(flight).initialPackSizes,
        lead: ENEMY_AIM.lead[ROUTE_POSITION[flight.galaxy]],
        loadedPackMembers,
        ...(navigationQuery ? { navigationQuery } : {}),
        peers,
        player: flight.player,
        playerVelocity: aimVelocity,
        ...(stationGuardAnchor ? { stationGuardAnchor } : {}),
        summoned: flight.summonedGuards?.includes(object.id) ?? false,
        ...(flight.summonedGuards?.includes(object.id)
          ? {
              summonTarget: guardApproach(
                flightWorldContext(flight),
                flight.objects.flatMap((other) => {
                  const radius = protectedRadius(content, other);
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
    object.enemy = intent.state;
    if (intent.effects.defeated) {
      destroyEnemy(object, flight);
      events.push({ id: object.id, type: "enemyDestroyed" });
      continue;
    }
    let velocity = intent.velocity;
    // Enemies bounce off scenery by the same rule as Ada; safe areas and peers still block.
    const { sceneryRecoil, sceneryRestitution } = content.tuning.flight;
    const onContact = (normal: Vec, surface: Vec): void => {
      velocity = bounce(sceneryRestitution, sceneryRecoil, normal, surface, velocity);
      object.enemy!.velocity = { ...velocity };
    };
    // Small craft drift with a current; frigates, capitals and platforms are too heavy.
    const drift = DRIFT_PROOF.includes(state.archetype)
      ? { x: 0, y: 0 }
      : worldFlowAt(flightWorldContext(flight), flight.galaxy, object);
    const steps = Math.max(
      1,
      Math.ceil((Math.hypot(velocity.x + drift.x, velocity.y + drift.y) * dt) / 4),
    );
    for (let i = 0; i < steps; i++) {
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
              (protectedRadius(content, other) !== null
                ? worldDistance(flightWorldContext(flight), other, point) <
                  (protectedRadius(content, other) ?? 0) + object.radius
                : other.kind === "enemy" &&
                  other.hp > 0 &&
                  !other.enemy?.salvaged &&
                  worldDistance(flightWorldContext(flight), other, point) <
                    enemySpacing(object, other)),
          );
        if (!blocked) {
          object[axis] = point[axis];
        } else {
          object.enemy.velocity[axis] = 0;
        }
      }
      const point = { x: object.x, y: object.y };
      const hull = enemyHull(object.enemy);
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
    const rings = new Map<number, Vec[]>();
    for (const fire of intent.fire) {
      const amount = content.tuning.flight.playerShotDamage * fire.damageRatio;
      const shared = enemyOnly(fire.weapon) ? null : weaponAt(fire.weapon, fire.level);
      if (fire.projectile === "beam") {
        chargeEnemyBeam(amount, shared?.beamRange ?? 0, before, fire, object.id, flight);
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
      const reach = shared ? projectileReach(shared, fire.speed, lifetime) : { life: lifetime };
      flight.shots.push({
        ...fire.origin,
        ...(shared?.blastRadius ? { blast: shared.blastRadius } : {}),
        damage: amount,
        effectFamily: impactFamily(fire.weapon),
        enemy: true,
        ...(fire.weapon === "ringBurst" ? { enemyWeapon: "ringBurst" as const } : {}),
        ...reach,
        hitIds: [],
        id,
        piercing: false,
        projectile: fire.projectile,
        velocity: { x: fire.aim.x * fire.speed, y: fire.aim.y * fire.speed },
      });
    }
    for (const [delay, origins] of rings) {
      const emissions = ringEmissions.get(flight) ?? [];
      emissions.push({ age: -delay, at: { ...before }, origins, spawnRadius: object.radius });
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

/** The mine's spin for collision, as drawn: still under reduced motion. */
function spinOf(flight: FlightState, mine: Mine): number {
  return mineSpin(reducedMotions.get(flight) ?? false, Math.max(0, mine.age));
}

/** Whether a mine still collides: laid, and neither fizzling nor popped. */
function armed(mine: Mine): boolean {
  return mine.end === undefined && mine.age >= 0;
}

/**
 * Ages each mine: one touching Ada's drawn ship pops and damages her; one past its life fizzles,
 * harmless. Each goes once its fizzle or pop has played.
 */
function stepMines(content: GameContent, dt: number, flight: FlightState): void {
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
      !needleChannelContains({}, flight, flight.player) &&
      mineTouches(
        spinOf(flight, mine),
        mine,
        body,
        worldPoint(flightWorldContext(flight), mine, flight.player),
      )
    ) {
      damage(content, mine.damage, flight);
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
            mineParts(spinOf(flight, mine)),
            mine,
            worldPoint(flightWorldContext(flight), mine, shot),
            MISSILE_HIT_RADIUS,
          ) !== null
        : mineTouches(
            spinOf(flight, mine),
            mine,
            SHOT_PARTS,
            worldPoint(flightWorldContext(flight), mine, shot),
          ))
    ) {
      shot.hitIds.push(mine.id);
      mine.end = { age: 0, kind: "pop" };
      if (shot.blast !== undefined) {
        const contact = outlineContact(
          mineParts(spinOf(flight, mine)),
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
function debrisTouchesAda(flight: FlightState, object: SpaceObject, from: Vec, to: Vec): boolean {
  const end = worldPoint(flightWorldContext(flight), from, to);
  const drawn = drawnOf(flight, object);
  if (!drawn) {
    return shipNearSegment(
      flight.facing,
      worldPoint(flightWorldContext(flight), from, flight.player),
      from,
      worldPoint(flightWorldContext(flight), from, to),
      object.radius,
    );
  }
  const frame = frameOf(flight, object);
  const body = shipBody(flight.facing);
  const steps = Math.max(1, Math.ceil(distance(from, end) / 2));
  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const at = { ...object, x: from.x + (end.x - from.x) * t, y: from.y + (end.y - from.y) * t };
    if (
      worldSceneryBodyContact(flightWorldContext(flight), at, flight.player, body, frame, 0, drawn)
    ) {
      return true;
    }
  }
  return false;
}

/** Ballistic debris keeps constant velocity; ordinary asteroids hold their centres. */
function moveDebris(
  content: GameContent,
  dt: number,
  events: FlightEvent[],
  flight: FlightState,
): void {
  for (const object of flight.objects) {
    if (object.river) {
      // River debris follows its current and bumps Ada on contact like other traveling debris.
      const from = { x: object.x, y: object.y };
      placeRiverRock(flight, object);
      if (debrisTouchesAda(flight, object, from, object)) {
        bumpAda(content, flight, events, object);
      }
      continue;
    }
    if (object.orbit && (object.kind === "rock" || object.kind === "resource")) {
      // Legacy circular paths settle at their current centre without changing HP or drops.
      delete object.orbit;
      delete object.velocity;
      continue;
    }
    if (object.kind !== "debris" || !object.velocity) {
      continue;
    }
    const next = stepDebris(dt, { id: object.id, position: object, velocity: object.velocity });
    // Protected regions absorb traveling debris without changing its ballistic heading.
    if (
      flight.objects.some((area) => {
        const radius = protectedRadius(content, area);
        return (
          radius !== null &&
          segmentDistance(
            worldPoint(flightWorldContext(flight), object, area),
            object,
            next.position,
          ) <
            radius + object.radius
        );
      })
    ) {
      object.hp = 0;
      continue;
    }
    // A bump, though the debris may pass through her between frames (rules.md: 1 a bump).
    if (debrisTouchesAda(flight, object, object, next.position)) {
      bumpAda(content, flight, events, object);
    }
    object.x = next.position.x;
    object.y = next.position.y;
    canonicalPosition(flight, object);
  }
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
      if (shot.enemy) {
        const entry = needleChannelEntry({ radius }, flight, shot, next);
        if (entry !== null) {
          shot.x += (next.x - shot.x) * entry;
          shot.y += (next.y - shot.y) * entry;
          shot.life = 0;
          break;
        }
      }
      shot.x = next.x;
      shot.y = next.y;
      canonicalPosition(flight, shot);
      if (shot.enemy) {
        if (safe(content, shot, flight)) {
          shot.life = 0;
          continue;
        }
        const struck = touchesAda(flight, shot, radius);
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
        enemyImpact(content, shot, struck, flight);
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
        enemyImpact(content, shot, false, flight);
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
function enemyImpact(content: GameContent, shot: Shot, struck: boolean, flight: FlightState): void {
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
  if (struck || (shot.blast !== undefined && touchesAda(flight, shot, shot.blast))) {
    damage(content, shot.damage, flight);
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
          enemyHull(enemy),
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
  const hull = enemy && enemyHull(enemy);
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
    const definition = enemyEquipmentDefinition(flight.galaxy, object.enemy);
    const disabled = object.enemy.disabled;
    object.enemy = damageEnemy(definition, { amount, hardpointId: part }, object.enemy);
    object.hp = enemyDefeated(object.enemy) ? 0 : Math.max(1, object.enemy.hp);
    if (object.hp > 0 && !disabled && object.enemy.disabled) {
      events.push({ id: object.id, type: "enemyDisabled" });
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
      id: object.id,
      ...(object.kind === "resource" ? { resource: true as const } : {}),
      type: "asteroidDestroyed",
      x: object.x,
      y: object.y,
    });
  }
  if (object.kind === "debris") {
    events.push({ id: object.id, type: "debrisCleared" });
  }
  if (object.kind === "rock" || object.kind === "resource") {
    dropFromRock(content, object, flight);
  }
}

/** An ammo outcome replaces the destroyed asteroid's combined ore/Stardust payout. */
function dropFromRock(content: GameContent, object: SpaceObject, flight: FlightState): void {
  if (rollRockAmmoDrop(ECONOMY, ammoOwned(flight), dropRandom(flight.seed, `ammo:${object.id}`))) {
    pushAmmoPack(content, object, flight);
    return;
  }
  const next = dropRandom(flight.seed, object.id);
  const loot = rollAsteroidLoot(ASTEROID_LOOT, asteroidSize(object), next);
  const chunks = Math.floor(loot.ore / 5);
  const orePieces = chunks + (loot.ore % 5);
  const amounts = Array.from({ length: orePieces }, (_, index) => (index < chunks ? 5 : 1));
  const widths = amounts.map(orePickupSize);
  const span =
    widths.reduce((sum, width) => sum + width, 0) +
    Math.max(0, orePieces - 1) * ECONOMY.stardustPickupGap;
  let edge = -span / 2;
  const obstacles: PickupObstacle[] = [];
  for (let p = 0; p < orePieces; p++) {
    const centre = edge + widths[p]! / 2;
    edge += widths[p]! + ECONOMY.stardustPickupGap;
    obstacles.push({ radius: (widths[p]! * Math.SQRT2) / 2, x: centre, y: 0 });
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
  releaseStardust(
    obstacles,
    object,
    ROCK_RELEASE.spread,
    next,
    loot.stardust,
    loot.stardust,
    release,
    flight,
  );
}

/** The weapons ammo packs drop for: those Ada owns, not those a story grants for the flight. */
function ammoOwned(flight: FlightState): readonly Weapon[] {
  return (flight.ownedWeapons ?? []).filter((weapon) => !flight.grantedWeapons?.includes(weapon));
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
 * A missile's blast damages every other live enemy within its radius of the impact, and never
 * Ada; a multipart ship takes it at its nearest live hardpoint in reach. The blast shows one
 * flash, which stands in for the destruction flash of every enemy the impact destroys, the
 * struck one included. `struck` is null for a missile that exploded at the end of its reach.
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
    if (armed(mine) && worldDistance(flightWorldContext(flight), mine, at) <= radius) {
      mine.end = { age: 0, kind: "pop" };
    }
  }
  for (const object of [...flight.objects]) {
    if (object === struck || object.kind !== "enemy" || object.hp <= 0 || object.enemy?.salvaged) {
      continue;
    }
    const position = ROUTE_POSITION[flight.galaxy];
    const part = hitPart(content, flight, radius + partReach(content), radius, at, object);
    if (part === null && !enemyTouched(flight, position, object, at, radius)) {
      continue;
    }
    hit(content, amount, part, object, flight, events);
    markBlasted(object, flight);
  }
  if (struck) {
    markBlasted(struck, flight);
  }
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

/** A hitscan beam's visible flash, view-only and never saved; a hit also shows a spark at `to`. */
export interface BeamFlash {
  from: Vec;
  to: Vec;
  hit: boolean;
  age: number;
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
              family: "compactBright",
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
      const hull = enemyHull(object.enemy);
      if (hull) {
        drawn(object, null, hull);
      } else {
        consider(object, null, object, object.radius);
      }
    }
  }
  const struck = first as { object: SpaceObject; part: string | null; at: number } | null;
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
  fire: Pick<FireIntent, "aim" | "delay" | "hardpointId" | "origin" | "weapon">,
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
    end: { ...fire.origin },
    fired: false,
    hardpointId: fire.hardpointId,
    kind,
    muzzle: { ...fire.origin },
    offset: { x: fire.origin.x - ship.x, y: fire.origin.y - ship.y },
    ownerId,
    range,
    stopped: false,
  });
  enemyBeams.set(flight, beams);
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
    const boundary = needleChannelEntry({ radius: halfWidth }, flight, beam.muzzle, {
      x: beam.muzzle.x + beam.direction.x * beam.range,
      y: beam.muzzle.y + beam.direction.y * beam.range,
    });
    const stop = Math.min(
      obstacleStop(beam.muzzle, beam.direction, beam.range, flight, halfWidth),
      boundary === null ? beam.range : beam.range * boundary,
    );
    let reach = stop;
    if (beam.age >= BEAM_TIMING[beam.kind].fires) {
      beam.fired = true;
      for (let at = 0; at <= stop; at = at < stop && at + 2 > stop ? stop : at + 2) {
        const point = {
          x: beam.muzzle.x + beam.direction.x * at,
          y: beam.muzzle.y + beam.direction.y * at,
        };
        if (needleChannelContains({ radius: halfWidth }, flight, point)) {
          reach = at;
          break;
        }
        if (touchesAda(flight, point, halfWidth)) {
          reach = at;
          damage(content, beam.damage, flight);
          break;
        }
      }
    }
    beam.stopped = reach < beam.range;
    beam.end = {
      x: beam.muzzle.x + beam.direction.x * reach,
      y: beam.muzzle.y + beam.direction.y * reach,
    };
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
  // CLEANUP (added 2026-11-15): Bind station wreck/reward effects only after its policy is supplied.
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
const ROCK_RELEASE = ECONOMY.destruction.fighter.reduced;

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
  cap: number,
  amount: number,
  release: PickupRelease,
  flight: FlightState,
) {
  const pieces = splitStardust(cap, amount);
  const candidates = pieces.map((_, index) => {
    const angle = (index / pieces.length) * Math.PI * 2 + (next() * 2 - 1) * 0.3;
    const reach = spread * (0.6 + next() * 0.4);
    return { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach * 0.8 };
  });
  const offsets = stardustDropOffsets({ ...ECONOMY, obstacles }, candidates);
  pieces.forEach((value, index) => {
    const screen = offsets[index]!;
    flight.objects.push({
      amount: value,
      hp: 1,
      id: `stardust:${flight.nextId++}`,
      kind: "pickup",
      radius: ECONOMY.stardustPickupRadius,
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
 * Salvages the disabled heavy nearest Ada within Talk range: it drops its Stardust and twice the
 * heavy weapon chance around its hull, then powers down, spared. Returns whether one was.
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
  const drop = rollSalvageDrop(ECONOMY, flight.galaxy, enemy.archetype, next);
  releaseStardust(
    [],
    object,
    ECONOMY.destruction[enemy.archetype].spread,
    next,
    ECONOMY.pickupCap[enemy.archetype],
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
    const drop = rollEnemyDrop(ECONOMY, flight.galaxy, object.wreck.archetype, next);
    releaseStardust(
      [],
      object,
      timing.spread,
      next,
      ECONOMY.pickupCap[object.wreck.archetype],
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
    move(content, slice, input, events, flight);
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
    enemies(content, slice, flight, events, shotDelays);
    clearNeedleEnemies(flight);
    if (flight.phantom?.phase !== "salvaged") {
      stepEnemyBeams(content, slice, viewportWidth, flight);
      stepRingEmissions(slice, flight);
    }
    if (flight.phantom?.allies.length) {
      for (const intent of stepPhantomAllies(ship.physics, slice, flight, flight.phantom.allies)) {
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
    stepMines(content, slice, flight);
    stepWrecks(content, slice, input.reducedMotion ?? false, flight);
    for (const object of flight.objects) {
      if (object.kind === "hazard" && touchesAda(flight, object, object.radius)) {
        object.cooldown = Math.max(0, (object.cooldown ?? 0) - slice);
        if (!object.cooldown) {
          damage(content, content.tuning.hazardDamage, flight);
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
    // Snap the switch wait to zero within float error of its end.
    const wait = flight.weaponSwitchFor - slice;
    flight.weaponSwitchFor = wait > 1e-9 ? wait : 0;
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
      worldDistance(flightWorldContext(flight), object, flight.player) <= ECONOMY.station.safeRadius
    ) {
      events.push({ id: object.id, type: "stationDiscovered" });
    }
  }
  return events;
}
