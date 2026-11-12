import {
  type Contact,
  type Parts,
  partsReach,
  segmentNearParts,
  unionContact,
  worldParts,
} from "./convex.ts";
import { SHIP_HEADINGS, shipHeading, shipSilhouette } from "./nose.ts";
import type { Vec } from "./types.ts";

/**
 * Ada's ship as drawn (art/ship.md "Collision"): the silhouette of the heading frame her facing
 * shows, in screen px from her position.
 */
export function shipBody(facing: Vec): Parts {
  return shipSilhouette(shipHeading(facing));
}

/** World units from Ada's position to the farthest point of her silhouette over every heading. */
export const SHIP_REACH = Math.max(
  ...Array.from({ length: SHIP_HEADINGS }, (_, heading) =>
    partsReach(worldParts(shipSilhouette(heading))),
  ),
);

/**
 * Overlap of Ada's drawn ship with a world circle, or null when they do not touch: the normal is
 * the world direction that pushes Ada off the circle and the depth how far.
 */
export function shipCircleContact(
  facing: Vec,
  player: Vec,
  center: Vec,
  radius: number,
): Contact | null {
  const offset = { x: center.x - player.x, y: center.y - player.y };
  if (Math.hypot(offset.x, offset.y) >= SHIP_REACH + radius) {
    return null;
  }
  const contact = unionContact(worldParts(shipBody(facing)), offset, radius);
  return (
    contact && { depth: contact.depth, normal: { x: -contact.normal.x, y: -contact.normal.y } }
  );
}

/** Whether Ada's drawn ship touches a world circle. */
export function shipTouches(facing: Vec, player: Vec, center: Vec, radius: number): boolean {
  return shipCircleContact(facing, player, center, radius) !== null;
}

/** Whether a world segment passes within `inflate` of Ada's drawn ship. */
export function shipNearSegment(
  facing: Vec,
  player: Vec,
  start: Vec,
  end: Vec,
  inflate: number,
): boolean {
  const a = { x: start.x - player.x, y: start.y - player.y };
  const b = { x: end.x - player.x, y: end.y - player.y };
  return segmentNearParts(worldParts(shipBody(facing)), a, b, inflate);
}
