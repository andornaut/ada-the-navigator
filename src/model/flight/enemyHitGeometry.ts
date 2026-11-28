import { ROUTE_POSITION, type RoutePosition } from "../../data/galaxies.ts";
import type { GalaxyNumber, GameContent, Vec } from "../../data/types.ts";
import { hardpointOffset } from "../ai/index.ts";
import { outlineContact, screenOutlineContact, toScreen } from "../convex.ts";
import { enemyHull, enemyPartOutline } from "../enemyBody.ts";
import { enemyEquipmentDefinition } from "../enemyEquipment.ts";
import type { FlightState, SpaceObject } from "../types.ts";
import { flightWorldContext, worldDistance, worldPoint } from "../world/index.ts";

/** Screen px between world points `from` and `to`, through the nearest world image of `to`. */
export function screenGap(flight: FlightState, from: Vec, to: Vec): number {
  const local = worldPoint(flightWorldContext(flight), from, to);
  const screen = toScreen({ x: local.x - from.x, y: local.y - from.y });
  return Math.hypot(screen.x, screen.y);
}

/** How near a point must be to a live hardpoint to strike it. */
export function partReach(content: GameContent): number {
  return content.tuning.flight.shipRadius + 6;
}

/** A multipart enemy's live hardpoints, in world coordinates. */
export function liveParts(
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
    .filter((part) => enemy.hardpoints.some((value) => value.id === part.id))
    .map((part) => {
      const offset = hardpointOffset(definition, adaWidth, enemy.facing, part);
      return { id: part.id, x: object.x + offset.x, y: object.y + offset.y };
    });
}

/**
 * Whether a strike of `reach` at `point` touches an enemy where it is drawn: its hull or, on a
 * heavy, a hardpoint's base or top; its hull circle without Art's outline.
 */
export function enemyTouched(
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
export function hitPart(
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

/**
 * What a blast circle of screen radius `radius` at `at` covers of an enemy as drawn: the live
 * hardpoint it overlaps deepest (one without Art's outline when its anchor is within the radius
 * and a hardpoint's reach on screen), else its hull, or null when it covers neither.
 */
export function blastCover(
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
