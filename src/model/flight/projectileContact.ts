import { ROUTE_POSITION } from "../../data/galaxies.ts";
import { MISSILE_HIT_RADIUS } from "../../data/weaponCatalog.ts";
import { type Silhouette, worldSceneryContact } from "../asteroids.ts";
import { outlineContact } from "../convex.ts";
import { enemyHull, enemyPartOutline } from "../enemyBody.ts";
import { flightWorldContext } from "../flightTopology.ts";
import { impactEntry, impactSurface } from "../projectileImpact.ts";
import { direction } from "../shipPhysics.ts";
import type { FlightState, Shot, SpaceObject, Vec } from "../types.ts";
import { worldPoint } from "../worldContacts.ts";

export const shotRadius = (shot: Pick<Shot, "projectile">) =>
  shot.projectile === "missile" ? MISSILE_HIT_RADIUS : 3;

interface ProjectileScenery {
  readonly drawnOf: (flight: FlightState, object: SpaceObject) => Silhouette | null;
  readonly frameOf: (flight: FlightState, object: SpaceObject) => number;
}

/** Missile widths are world-space circles against the existing drawn scenery outlines. */
export function projectileSceneryContact(
  scenery: ProjectileScenery,
  flight: FlightState,
  object: SpaceObject,
  at: Vec,
  radius: number,
) {
  const drawn = scenery.drawnOf(flight, object);
  if (radius === MISSILE_HIT_RADIUS && drawn) {
    const frame = scenery.frameOf(flight, object);
    const image = worldPoint(flightWorldContext(flight), at, object);
    return outlineContact(drawn.frames[frame] ?? drawn.frames[0]!, image, at, radius);
  }
  return worldSceneryContact(
    flightWorldContext(flight),
    object,
    at,
    radius,
    scenery.frameOf(flight, object),
    drawn,
  );
}

/** The detected contact's surface, refined within the existing sampled movement segment. */
export function projectileContact(
  scenery: ProjectileScenery,
  flight: FlightState,
  object: SpaceObject,
  point: Vec,
  radius: number,
  from = point,
  part?: string | null,
): Vec {
  const contactAt = (at: Vec) => {
    if (object.kind !== "enemy") {
      return projectileSceneryContact(scenery, flight, object, at, radius);
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
          scenery.drawnOf(flight, object) !== null,
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
