import {
  ASTEROID_ART,
  type AsteroidArt,
  type AsteroidArtCatalog,
  type AsteroidSize,
} from "../data/asteroid-catalog.ts";
import type { ResourceClass } from "../data/resource-rocks.ts";
import type { SpaceObject, Vec } from "./types.ts";

/**
 * An asteroid in world units (art/asteroids.md "Footprint"): one footprint per drawn frame,
 * convex parts as offsets from the object position, with the widest frame's radius for the
 * broad phase and placement.
 */
export interface AsteroidShape {
  readonly id: string;
  readonly size: AsteroidSize;
  readonly radius: number;
  readonly frames: readonly (readonly (readonly Vec[])[])[];
  readonly drift: AsteroidArt["drift"];
  readonly spin: AsteroidArt["spin"];
}
export interface Contact {
  /** Unit vector from the obstacle surface toward the circle center. */
  readonly normal: Vec;
  /** Overlap depth along the normal. */
  readonly depth: number;
}

export function asteroidShape(art: AsteroidArt): AsteroidShape {
  return {
    drift: art.drift,
    frames: art.frames.map((frame) => frame.footprint),
    id: art.id,
    radius: art.footprintRadius,
    size: art.size,
    spin: art.spin,
  };
}

export function asteroidShapes(catalog: AsteroidArtCatalog): ReadonlyMap<string, AsteroidShape> {
  return new Map(catalog.asteroids.map((art) => [art.id, asteroidShape(art)]));
}

export const ASTEROID_SHAPES = asteroidShapes(ASTEROID_ART);

function hash(seed: number, text: string): number {
  let value = seed >>> 0 || 0x811c9dc5;
  for (const character of text) {
    value = Math.imul(value ^ character.charCodeAt(0), 0x01000193) >>> 0;
  }
  value ^= value >>> 15;
  value = Math.imul(value, 0x2c1b3c6d) >>> 0;
  return (value ^ (value >>> 12)) >>> 0;
}
/** A stable value in [0, 1) for a seed, an id and a salt. */
function unit(seed: number, id: string, salt: string): number {
  return hash(seed, `${id}:${salt}`) / 0x100000000;
}

/**
 * The frame a rock shows and collides with at `seconds` of flight (art/asteroids.md
 * "Classes"): one rate per rock within its spin range and one direction, both from the level
 * seed, so frame floor(angle / step) mod count plays ascending or descending. Still rocks and
 * reduced motion show frame 0.
 */
export function rockFrame(
  shape: { readonly frames: readonly unknown[]; readonly spin: AsteroidShape["spin"] },
  seed: number,
  reducedMotion: boolean,
  id: string,
  seconds: number,
): number {
  if (!shape.spin || reducedMotion || shape.frames.length < 2) {
    return 0;
  }
  const [slow, fast] = shape.spin.degPerSecond;
  const rate = slow + unit(seed, id, "spin-rate") * (fast - slow);
  const direction = unit(seed, id, "spin-direction") < 0.5 ? -1 : 1;
  const angle = unit(seed, id, "spin-phase") * 360 + direction * rate * seconds;
  const turned = ((angle % 360) + 360) % 360;
  return Math.floor(turned / (360 / shape.frames.length)) % shape.frames.length;
}

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
/** The plain shapes of a resource class's size, the footprints its rocks collide on. */
export function resourceShapes(
  shapes: readonly AsteroidShape[],
  resource: ResourceClass,
): AsteroidShape[] {
  return shapes.filter((shape) => shape.size === resource);
}

export function sceneryShape(object: SpaceObject): AsteroidShape | null {
  return object.asteroid ? (ASTEROID_SHAPES.get(object.asteroid) ?? null) : null;
}

/** Size class of a rock: its asteroid variant's size; a plain circle rock counts as small. */
export function asteroidSize(object: SpaceObject): AsteroidSize {
  return sceneryShape(object)?.size ?? "small";
}

/** Deepest overlap of a circle with a scenery object, or null when they do not touch. */
export function sceneryContact(
  object: SpaceObject,
  center: Vec,
  radius: number,
  frame = 0,
): Contact | null {
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
  for (const part of shape.frames[frame] ?? shape.frames[0]!) {
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
  frame = 0,
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
    if (sceneryContact(object, at, Math.max(inflate, 1e-6), frame)) {
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
