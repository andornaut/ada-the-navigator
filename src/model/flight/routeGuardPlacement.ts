import { SCREEN } from "../../data/screen.ts";
import type { GameContent } from "../../data/types.ts";
import { enemyDefeated } from "../enemyAi.ts";
import { enemyHull } from "../enemyBody.ts";
import { exclusionZoneRadius } from "../exclusionZones.ts";
import { flightWorldContext } from "../flightTopology.ts";
import type { FlightState, SpaceObject, Vec } from "../types.ts";
import { worldDelta, worldDistance } from "../worldContacts.ts";

/**
 * A capital that holds the spacing between capitals: live, not destroyed and not salvaged. A
 * salvaged hulk stays where Ada left it (gameplay/ships.md "State").
 */
export function capital(object: SpaceObject): boolean {
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

export function enemySpacing(first: SpaceObject, second: SpaceObject): number {
  return first.radius + second.radius + (capital(first) && capital(second) ? capitalGap() : 0);
}

/** Plan all guard positions before applying layout changes to their persistent state. */
export function placeGuards(
  routePlacementRandom: (seed: number, id: string) => () => number,
  content: GameContent,
  guards: SpaceObject[],
  flight: FlightState,
): void {
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
