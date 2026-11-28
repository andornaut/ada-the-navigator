import { SCENERY_IMPACT_SECONDS, sceneryImpactDamage } from "../../data/collisionDamage.ts";
import { CONTENT } from "../../data/content.ts";
import { ENEMY_SIZE_RATIOS } from "../../data/enemyDimensions.ts";
import { ROUTE_POSITION } from "../../data/galaxies.ts";
import type { GameContent } from "../../data/types.ts";
import { bounce, reflectDirection, worldSceneryBodyContact } from "../asteroids.ts";
import { outlinesContact } from "../convex.ts";
import { enemyHull } from "../enemyBody.ts";
import { isNeedleRim, needleRimContact, needleRims } from "../needleFlight.ts";
import { sceneryImpact } from "../sceneryImpact.ts";
import { shipBody, shipCircleContact } from "../shipBody.ts";
import type { FlightEvent, FlightState, SpaceObject, Vec } from "../types.ts";
import { flightWorldContext, worldPoint } from "../world/index.ts";
import { hit } from "./hitResolution.ts";
import { arrivalGraceActive as adaProtected } from "./lifecycle.ts";
import { reflectPilotHeading } from "./pilotMovement.ts";
import {
  resolveScenery,
  type SceneryContactOf,
  type SceneryResolution,
} from "./sceneryResolution.ts";

/**
 * Resolve Ada's contact with an enemy hull. Null means no contact. Otherwise return whether
 * the ships were closing. Each
 * reflects against the other's velocity; Ada takes the share m_enemy / (m_ada + m_enemy) of
 * her reflected change and of the push-out, with mass as size ratio squared, and the enemy
 * the rest. Their relative motion then matches a scenery bounce, so they always separate.
 */
function bounceShipContact(
  reflectAdaHeading: (flight: FlightState, normal: Vec) => void,
  tuning: Pick<GameContent["tuning"]["flight"], "sceneryRecoil" | "sceneryRestitution">,
  flight: FlightState,
  object: SpaceObject,
): boolean | null {
  const enemy = object.enemy;
  const { sceneryRecoil, sceneryRestitution } = tuning;
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
    return null;
  }
  const { normal } = contact;
  const approach =
    (flight.velocity.x - enemy.velocity.x) * normal.x +
    (flight.velocity.y - enemy.velocity.y) * normal.y;
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
  reflectAdaHeading(flight, normal);
  if (enemy.heading) {
    enemy.heading = reflectDirection(inward, enemy.heading);
  }
  return approach < 0;
}

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
export function adaSceneryContact(
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
export function bumpAda(
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
  scenery: SceneryResolution,
  content: GameContent,
  flight: FlightState,
  object: SpaceObject,
): boolean {
  const closing = bounceShipContact(reflectPilotHeading, content.tuning.flight, flight, object);
  if (closing === null) {
    return false;
  }
  settleAda(scenery, content, flight);
  return closing;
}

/** Ada's drawn ship against scenery at her current facing. */
export function adaContact(flight: FlightState): SceneryContactOf {
  const world = flightWorldContext(flight);
  return (object, position, frame, drawn) =>
    isNeedleRim(object)
      ? needleRimContact({ body: shipBody(flight.facing), position, world }, object)
      : worldSceneryBodyContact(world, object, position, shipBody(flight.facing), frame, 0, drawn);
}

/** Pushes Ada's drawn ship out of scenery and bounces her off what she touched. */
export function settleAda(
  scenery: SceneryResolution,
  content: GameContent,
  flight: FlightState,
): void {
  resolveScenery(
    scenery,
    flight,
    adaContact(flight),
    adaSceneryContact(content, null, flight),
    flight.player,
    undefined,
    needleRims(flight),
  );
}
