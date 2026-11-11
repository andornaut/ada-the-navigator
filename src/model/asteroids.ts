import {
  ASTEROID_CATALOG,
  type AsteroidCatalog,
  type AsteroidEntry,
  type AsteroidSize,
} from "../data/asteroid-catalog.ts";
import type { SpaceObject, Vec } from "./types.ts";

/** An asteroid variant in world units: convex parts as offsets from the object position. */
export interface AsteroidShape {
  readonly id: string;
  readonly size: AsteroidSize;
  readonly radius: number;
  readonly parts: readonly (readonly Vec[])[];
  readonly drift: AsteroidEntry["drift"];
  readonly tint: string;
}
export interface Contact {
  /** Unit vector from the obstacle surface toward the circle center. */
  readonly normal: Vec;
  /** Overlap depth along the normal. */
  readonly depth: number;
}

/** Inverse of the isometric projection `screen = (x - y, (x + y) / 2)`. */
const unproject = (at: Vec): Vec => ({ x: at.x / 2 + at.y, y: at.y - at.x / 2 });

export function asteroidShape(entry: AsteroidEntry): AsteroidShape {
  const scale = {
    x: entry.display.width / entry.frame.width,
    y: entry.display.height / entry.frame.height,
  };
  const origin = { x: entry.pivot.x * entry.frame.width, y: entry.pivot.y * entry.frame.height };
  const parts = entry.collision.map((part) =>
    part.map((at) => unproject({ x: (at.x - origin.x) * scale.x, y: (at.y - origin.y) * scale.y })),
  );
  return {
    drift: entry.drift,
    id: entry.id,
    parts,
    radius: Math.max(...parts.flat().map((at) => Math.hypot(at.x, at.y))),
    size: entry.size,
    tint: entry.tint,
  };
}

export function asteroidShapes(catalog: AsteroidCatalog): ReadonlyMap<string, AsteroidShape> {
  return new Map(catalog.asteroids.map((entry) => [entry.id, asteroidShape(entry)]));
}

export const ASTEROID_SHAPES = asteroidShapes(ASTEROID_CATALOG);

function closestOnSegment(point: Vec, a: Vec, b: Vec): Vec {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const square = dx * dx + dy * dy;
  const t = square
    ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / square))
    : 0;
  return { x: a.x + dx * t, y: a.y + dy * t };
}

function inside(part: readonly Vec[], point: Vec): boolean {
  let sign = 0;
  for (let index = 0; index < part.length; index++) {
    const a = part[index]!;
    const b = part[(index + 1) % part.length]!;
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (cross === 0) {
      continue;
    }
    if (sign && Math.sign(cross) !== sign) {
      return false;
    }
    sign = Math.sign(cross);
  }
  return true;
}

/** Circle against one convex part, in the part's local frame. */
function partContact(part: readonly Vec[], center: Vec, radius: number): Contact | null {
  let nearest: Vec | null = null;
  let best = Infinity;
  for (let index = 0; index < part.length; index++) {
    const at = closestOnSegment(center, part[index]!, part[(index + 1) % part.length]!);
    const gap = Math.hypot(center.x - at.x, center.y - at.y);
    if (gap < best) {
      best = gap;
      nearest = at;
    }
  }
  if (!nearest) {
    return null;
  }
  const centroid = {
    x: part.reduce((sum, at) => sum + at.x, 0) / part.length,
    y: part.reduce((sum, at) => sum + at.y, 0) / part.length,
  };
  if (inside(part, center)) {
    // A center inside the part leaves through the nearest edge.
    const out =
      best > 1e-9
        ? { x: nearest.x - center.x, y: nearest.y - center.y }
        : { x: center.x - centroid.x, y: center.y - centroid.y };
    const scale = Math.hypot(out.x, out.y) || 1;
    return { depth: best + radius, normal: { x: out.x / scale, y: out.y / scale } };
  }
  if (best >= radius) {
    return null;
  }
  return {
    depth: radius - best,
    normal: { x: (center.x - nearest.x) / best, y: (center.y - nearest.y) / best },
  };
}

/** Collision shape of a scenery object: its asteroid polygon, or its circle when it has none. */
export function sceneryShape(object: SpaceObject): AsteroidShape | null {
  return object.asteroid ? (ASTEROID_SHAPES.get(object.asteroid) ?? null) : null;
}

/** Size class of a rock: its asteroid variant's size; a plain circle rock counts as small. */
export function asteroidSize(object: SpaceObject): AsteroidSize {
  return sceneryShape(object)?.size ?? "small";
}

/** Deepest overlap of a circle with a scenery object, or null when they do not touch. */
export function sceneryContact(object: SpaceObject, center: Vec, radius: number): Contact | null {
  const dx = center.x - object.x;
  const dy = center.y - object.y;
  const gap = Math.hypot(dx, dy);
  const shape = sceneryShape(object);
  if (!shape) {
    if (gap >= object.radius + radius) {
      return null;
    }
    return gap > 1e-9
      ? { depth: object.radius + radius - gap, normal: { x: dx / gap, y: dy / gap } }
      : { depth: object.radius + radius, normal: { x: 1, y: 0 } };
  }
  if (gap >= shape.radius + radius) {
    return null;
  }
  let deepest: Contact | null = null;
  for (const part of shape.parts) {
    const contact = partContact(part, { x: dx, y: dy }, radius);
    if (contact && (!deepest || contact.depth > deepest.depth)) {
      deepest = contact;
    }
  }
  return deepest;
}

/** Whether a segment passes within `inflate` of a scenery object's shape. */
export function sceneryBlocksSegment(
  object: SpaceObject,
  start: Vec,
  end: Vec,
  inflate: number,
): boolean {
  const shape = sceneryShape(object);
  const nearest = closestOnSegment(object, start, end);
  if (
    Math.hypot(nearest.x - object.x, nearest.y - object.y) >=
    (shape?.radius ?? object.radius) + inflate
  ) {
    return false;
  }
  if (!shape) {
    return true;
  }
  // Sample the segment at a step no larger than the inflation plus a few world units.
  const span = Math.hypot(end.x - start.x, end.y - start.y);
  const steps = Math.max(1, Math.ceil(span / Math.max(4, inflate)));
  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const at = { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
    if (sceneryContact(object, at, Math.max(inflate, 1e-6))) {
      return true;
    }
  }
  return false;
}

/**
 * Reflect a velocity off a surface moving with `surface`: the approaching normal component
 * of the relative velocity reverses at `restitution`, at least `recoil`, and the tangential
 * component is kept, so a mover never stops against scenery.
 */
export function bounce(
  restitution: number,
  recoil: number,
  normal: Vec,
  surface: Vec,
  velocity: Vec,
): Vec {
  const relative = { x: velocity.x - surface.x, y: velocity.y - surface.y };
  const approach = relative.x * normal.x + relative.y * normal.y;
  if (approach >= 0) {
    return velocity;
  }
  const away = Math.max(-approach * restitution, recoil);
  return {
    x: surface.x + relative.x - approach * normal.x + away * normal.x,
    y: surface.y + relative.y - approach * normal.y + away * normal.y,
  };
}

/** Position and velocity on a drift path at flight time `time`. */
export function orbitMotion(
  time: number,
  orbit: NonNullable<SpaceObject["orbit"]>,
): { position: Vec; velocity: Vec } {
  const angle = orbit.phase + orbit.rate * time;
  const speed = orbit.radius * orbit.rate;
  return {
    position: {
      x: orbit.x + Math.cos(angle) * orbit.radius,
      y: orbit.y + Math.sin(angle) * orbit.radius,
    },
    velocity: { x: -Math.sin(angle) * speed, y: Math.cos(angle) * speed },
  };
}

/** Reflect a direction about a surface it points into; directions already leaving are kept. */
export function reflectDirection(normal: Vec, direction: Vec): Vec {
  const into = direction.x * normal.x + direction.y * normal.y;
  if (into >= 0) {
    return direction;
  }
  const x = direction.x - 2 * into * normal.x;
  const y = direction.y - 2 * into * normal.y;
  const scale = Math.hypot(x, y) || 1;
  return { x: x / scale, y: y / scale };
}
