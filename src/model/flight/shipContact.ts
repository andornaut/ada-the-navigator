import { ENEMY_SIZE_RATIOS } from "../../data/enemyDimensions.ts";
import { ROUTE_POSITION } from "../../data/galaxies.ts";
import type { GameContent } from "../../data/types.ts";
import { bounce, reflectDirection } from "../asteroids.ts";
import { outlinesContact } from "../convex.ts";
import { enemyHull } from "../enemyBody.ts";
import { flightWorldContext } from "../flightTopology.ts";
import { shipBody, shipCircleContact } from "../shipBody.ts";
import type { FlightState, SpaceObject, Vec } from "../types.ts";
import { worldPoint } from "../worldContacts.ts";

/**
 * Resolve Ada's contact with an enemy hull. Null means no contact. Otherwise return whether
 * the ships were closing. Each
 * reflects against the other's velocity; Ada takes the share m_enemy / (m_ada + m_enemy) of
 * her reflected change and of the push-out, with mass as size ratio squared, and the enemy
 * the rest. Their relative motion then matches a scenery bounce, so they always separate.
 */
export function bounceShipContact(
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
