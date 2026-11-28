import { BEAM } from "../../data/weaponCatalog.ts";
import { sceneryBound, type Silhouette, worldSceneryContact } from "../asteroids.ts";
import { outlineContact, type Parts, partsReach, rayCircle, worldParts } from "../convex.ts";
import { impactSurface } from "../projectileImpact.ts";
import type { FlightState, SpaceObject, Vec } from "../types.ts";
import { flightWorldContext, worldPoint } from "../world/index.ts";

export function beamPoint(origin: Vec, direction: Vec, at: number): Vec {
  return { x: origin.x + direction.x * at, y: origin.y + direction.y * at };
}

/** Use the same two-unit samples for beam bodies, including the exact end of the segment. */
export function sampleBeam<T>(
  origin: Vec,
  direction: Vec,
  start: number,
  end: number,
  contactAt: (point: Vec) => T | null,
): { at: number; contact: T; point: Vec } | null {
  for (let at = start; at <= end; at = at < end && at + 2 > end ? end : at + 2) {
    const point = beamPoint(origin, direction, at);
    const contact = contactAt(point);
    if (contact !== null) {
      return { at, contact, point };
    }
  }
  return null;
}

/**
 * Where a beam first meets a scenery object where it is drawn (its silhouette, else its circle),
 * within the beam half-width: the bounding circle's entry, refined in 2-unit steps.
 */
export function sceneryEntry(
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

/** Locate the first sampled contact and its actual drawn surface. */
export function outlineBeamStrike(
  line: { origin: Vec; heading: Vec; range: number; halfWidth: number },
  center: Vec,
  outline: Parts,
): { at: number; point: Vec } | null {
  const { halfWidth, heading, origin, range } = line;
  const bound = partsReach(worldParts(outline)) + halfWidth;
  const entry = rayCircle(origin, heading, range, center, bound);
  if (entry === null) {
    return null;
  }
  const hit = sampleBeam(origin, heading, entry, Math.min(range, entry + 2 * bound), (point) =>
    outlineContact(outline, center, point, halfWidth),
  );
  return (
    hit && {
      at: hit.at,
      point: impactSurface(
        { contact: hit.contact, projected: false, radius: halfWidth },
        hit.point,
      ),
    }
  );
}
