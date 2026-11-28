import { type Silhouette, worldSceneryBlocksSegment } from "../asteroids.ts";
import type { Contact } from "../convex.ts";
import type { FlightState, SpaceObject, Vec } from "../types.ts";
import type { WorldContext } from "../world/index.ts";

export interface SceneryResolution {
  readonly kinds: readonly string[];
  readonly drawnOf: (flight: FlightState, object: SpaceObject) => Silhouette | null;
  readonly frameOf: (flight: FlightState, object: SpaceObject) => number;
}

/** Checks the live scenery against a segment in the caller's local chart. */
export function sceneryBlocksFlightSegment(
  scenery: SceneryResolution,
  world: WorldContext,
  flight: FlightState,
  segment: {
    readonly from: Vec;
    readonly to: Vec;
    readonly clearance: number;
    readonly excludedId?: string;
  },
): boolean {
  return flight.objects.some(
    (object) =>
      scenery.kinds.includes(object.kind) &&
      object.hp > 0 &&
      object.id !== segment.excludedId &&
      worldSceneryBlocksSegment(
        world,
        object,
        segment.from,
        segment.to,
        segment.clearance,
        scenery.frameOf(flight, object),
        scenery.drawnOf(flight, object),
      ),
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
  scenery: SceneryResolution,
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
      if (!scenery.kinds.includes(object.kind) || object.hp <= 0) {
        continue;
      }
      const contact = contactOf(
        object,
        position,
        scenery.frameOf(flight, object),
        scenery.drawnOf(flight, object),
      );
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

/** The unit sum of directions, or null when they cancel. */
function combined(directions: readonly Vec[]): Vec | null {
  const sum = directions.reduce((total, d) => ({ x: total.x + d.x, y: total.y + d.y }), {
    x: 0,
    y: 0,
  });
  const size = Math.hypot(sum.x, sum.y);
  return size > 1e-6 ? { x: sum.x / size, y: sum.y / size } : null;
}
