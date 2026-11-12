import {
  ASTEROID_ART,
  type AsteroidArt,
  type AsteroidArtCatalog,
  type AsteroidSize,
  RESOURCE_ART,
  type ResourceRockCatalog,
} from "../data/asteroid-catalog.ts";
import { resourceArtId, type ResourceClass } from "../data/resource-rocks.ts";
import type { SpaceObject, Vec } from "./types.ts";

type Parts = readonly (readonly Vec[])[];
/** Screen px past an edge that tells a seam from the outline, where the next part continues. */
const SEAM_STEP = 1.5;

/**
 * A rock as drawn: one silhouette per frame, convex parts in screen px from the object's
 * projected position (the sprite pivot), with the farthest point over all frames as `reach`.
 */
export interface Silhouette {
  readonly frames: readonly Parts[];
  readonly reach: number;
}
/**
 * An asteroid in world units (art/asteroids.md "Footprint"): one footprint per drawn frame,
 * convex parts as offsets from the object position, with the widest frame's radius for the
 * broad phase and placement, and its drawn silhouette, which shots hit.
 */
export interface AsteroidShape {
  readonly id: string;
  readonly size: AsteroidSize;
  readonly radius: number;
  readonly frames: readonly Parts[];
  readonly silhouette: Silhouette;
  readonly drift: AsteroidArt["drift"];
  readonly spin: AsteroidArt["spin"];
}
export interface Contact {
  /** Unit vector from the obstacle surface toward the circle center. */
  readonly normal: Vec;
  /** Overlap depth along the normal. */
  readonly depth: number;
}

/**
 * A rock's drawn silhouette: each frame's `collision` parts moved from frame px to display px
 * from the pivot, where the sprite's origin sits on the object's projected position.
 */
export function silhouette(art: AsteroidArt): Silhouette {
  const scaleX = art.display.width / art.frame.width;
  const scaleY = art.display.height / art.frame.height;
  const originX = art.pivot.x * art.frame.width;
  const originY = art.pivot.y * art.frame.height;
  const frames = art.frames.map((frame) =>
    frame.collision.map((part) =>
      part.map((at) => ({ x: (at.x - originX) * scaleX, y: (at.y - originY) * scaleY })),
    ),
  );
  const reach = Math.max(
    ...frames.flatMap((parts) => parts.flatMap((part) => part.map((at) => Math.hypot(at.x, at.y)))),
  );
  return { frames, reach };
}

export function asteroidShape(art: AsteroidArt): AsteroidShape {
  return {
    drift: art.drift,
    frames: art.frames.map((frame) => frame.footprint),
    id: art.id,
    radius: art.footprintRadius,
    silhouette: silhouette(art),
    size: art.size,
    spin: art.spin,
  };
}

export function asteroidShapes(catalog: AsteroidArtCatalog): ReadonlyMap<string, AsteroidShape> {
  return new Map(catalog.asteroids.map((art) => [art.id, asteroidShape(art)]));
}

export const ASTEROID_SHAPES = asteroidShapes(ASTEROID_ART);

/**
 * Resource rock silhouettes by the plain shape a resource rock collides on: `asteroid-m1` maps
 * to `resource-m1`'s drawing, which is taller than the plain rock's.
 */
export function resourceSilhouettes(
  catalog: ResourceRockCatalog | undefined,
  shapes: ReadonlyMap<string, AsteroidShape>,
): ReadonlyMap<string, Silhouette> {
  const rocks = new Map((catalog?.rocks ?? []).map((art) => [art.id, art]));
  const silhouettes = new Map<string, Silhouette>();
  for (const shape of shapes.values()) {
    const art = rocks.get(resourceArtId(shape.id));
    if (art && art.frames.length === shape.frames.length) {
      silhouettes.set(shape.id, silhouette(art));
    }
  }
  return silhouettes;
}

const RESOURCE_SILHOUETTES = resourceSilhouettes(RESOURCE_ART, ASTEROID_SHAPES);

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
 * seed, so frame floor(angle / step) mod count plays ascending or descending. A rock with a
 * start frame begins on it. Still rocks show frame 0; reduced motion holds the start frame, or 0.
 */
export function rockFrame(
  shape: { readonly frames: readonly unknown[]; readonly spin: AsteroidShape["spin"] },
  seed: number,
  reducedMotion: boolean,
  id: string,
  seconds: number,
  start?: number,
): number {
  if (!shape.spin || shape.frames.length < 2) {
    return 0;
  }
  const count = shape.frames.length;
  if (reducedMotion) {
    return start === undefined ? 0 : ((start % count) + count) % count;
  }
  const [slow, fast] = shape.spin.degPerSecond;
  const rate = slow + unit(seed, id, "spin-rate") * (fast - slow);
  const direction = unit(seed, id, "spin-direction") < 0.5 ? -1 : 1;
  // A start frame begins the turn mid-frame, so it shows that frame at time 0.
  const phase =
    start === undefined ? unit(seed, id, "spin-phase") * 360 : ((start + 0.5) * 360) / count;
  const angle = phase + direction * rate * seconds;
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

/**
 * The silhouette a scenery object is drawn with: a resource rock's own drawing, else its asteroid
 * shape's; null for a circle obstacle.
 */
export function scenerySilhouette(object: SpaceObject): Silhouette | null {
  if (!object.asteroid) {
    return null;
  }
  return (
    (object.kind === "resource" ? RESOURCE_SILHOUETTES.get(object.asteroid) : undefined) ??
    sceneryShape(object)?.silhouette ??
    null
  );
}

/** A world offset on the screen: the play view's projection (x - y, (x + y) / 2). */
function toScreen(offset: Vec): Vec {
  return { x: offset.x - offset.y, y: (offset.x + offset.y) / 2 };
}

/**
 * A screen contact in world units. A screen edge with normal n is the world line with normal
 * P^T n, where P is the projection, and moving 1 world unit along that unit normal moves the
 * point |P^T n| screen px off the edge.
 */
function worldContact(screen: Contact): Contact {
  const { x, y } = screen.normal;
  const normal = { x: x + y / 2, y: y / 2 - x };
  const scale = Math.hypot(normal.x, normal.y);
  return { depth: screen.depth / scale, normal: { x: normal.x / scale, y: normal.y / scale } };
}

/**
 * Deepest overlap of a body with a scenery object, or null when they do not touch. A rock is met
 * where it is drawn: the body's offset is projected to the screen and tested against the frame's
 * silhouette grown by `radius` screen px, and the contact comes back in world units. A circle
 * obstacle meets a world circle of `radius`.
 */
export function sceneryContact(
  object: SpaceObject,
  center: Vec,
  radius: number,
  frame = 0,
): Contact | null {
  const dx = center.x - object.x;
  const dy = center.y - object.y;
  const drawn = scenerySilhouette(object);
  if (!drawn) {
    const gap = Math.hypot(dx, dy);
    if (gap >= object.radius + radius) {
      return null;
    }
    return gap > 1e-9
      ? { depth: object.radius + radius - gap, normal: { x: dx / gap, y: dy / gap } }
      : { depth: object.radius + radius, normal: { x: 1, y: 0 } };
  }
  const screen = toScreen({ x: dx, y: dy });
  if (Math.hypot(screen.x, screen.y) >= drawn.reach + radius) {
    return null;
  }
  const contact = unionContact(drawn.frames[frame] ?? drawn.frames[0]!, screen, radius);
  return contact && worldContact(contact);
}

/**
 * A circle against the union of convex parts that overlap at their seams. Outside the union the
 * nearest part decides. Inside it, the circle leaves through the nearest outer edge: an edge
 * point whose outward step lands in another part is a seam, not the outline.
 */
function unionContact(parts: Parts, center: Vec, radius: number): Contact | null {
  const container = parts.find((part) => inside(part, center));
  if (!container) {
    let deepest: Contact | null = null;
    for (const part of parts) {
      const contact = partContact(part, center, radius);
      if (contact && (!deepest || contact.depth > deepest.depth)) {
        deepest = contact;
      }
    }
    return deepest;
  }
  let best = Infinity;
  let exit: Vec | null = null;
  for (const part of parts) {
    const centroid = {
      x: part.reduce((sum, at) => sum + at.x, 0) / part.length,
      y: part.reduce((sum, at) => sum + at.y, 0) / part.length,
    };
    for (let index = 0; index < part.length; index++) {
      const a = part[index]!;
      const b = part[(index + 1) % part.length]!;
      const at = closestOnSegment(center, a, b);
      const gap = Math.hypot(at.x - center.x, at.y - center.y);
      if (gap >= best) {
        continue;
      }
      // The edge's outward unit normal, away from its part's centroid.
      const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      let normal = { x: (b.y - a.y) / length, y: (a.x - b.x) / length };
      if (normal.x * (at.x - centroid.x) + normal.y * (at.y - centroid.y) < 0) {
        normal = { x: -normal.x, y: -normal.y };
      }
      const step = { x: at.x + normal.x * SEAM_STEP, y: at.y + normal.y * SEAM_STEP };
      if (parts.some((other) => other !== part && inside(other, step))) {
        continue;
      }
      best = gap;
      exit = gap > 1e-9 ? { x: (at.x - center.x) / gap, y: (at.y - center.y) / gap } : normal;
    }
  }
  return exit ? { depth: best + radius, normal: exit } : partContact(container, center, radius);
}

/**
 * World units from a scenery object's position beyond which a body of `radius` cannot touch it:
 * a screen offset of length r comes from a world offset of at most r * sqrt(2).
 */
export function sceneryBound(object: SpaceObject, radius: number): number {
  const drawn = scenerySilhouette(object);
  return drawn ? (drawn.reach + radius) * Math.SQRT2 : object.radius + radius;
}

/** Whether screen segments ab and cd cross. */
function crosses(a: Vec, b: Vec, c: Vec, d: Vec): boolean {
  const side = (p: Vec, q: Vec, r: Vec) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

/**
 * Whether a segment passes within `inflate` of a scenery object where it is drawn: the projected
 * segment against the frame's silhouette in screen px, or a world circle for a circle obstacle.
 */
export function sceneryBlocksSegment(
  object: SpaceObject,
  start: Vec,
  end: Vec,
  inflate: number,
  frame = 0,
): boolean {
  const nearest = closestOnSegment(object, start, end);
  if (Math.hypot(nearest.x - object.x, nearest.y - object.y) >= sceneryBound(object, inflate)) {
    return false;
  }
  const drawn = scenerySilhouette(object);
  if (!drawn) {
    return true;
  }
  const a = toScreen({ x: start.x - object.x, y: start.y - object.y });
  const b = toScreen({ x: end.x - object.x, y: end.y - object.y });
  return (drawn.frames[frame] ?? drawn.frames[0]!).some(
    (part) =>
      inside(part, a) ||
      part.some((corner, index) => {
        const next = part[(index + 1) % part.length]!;
        if (crosses(a, b, corner, next)) {
          return true;
        }
        const gaps = [
          Math.hypot(...delta(corner, closestOnSegment(corner, a, b))),
          Math.hypot(...delta(a, closestOnSegment(a, corner, next))),
          Math.hypot(...delta(b, closestOnSegment(b, corner, next))),
        ];
        return Math.min(...gaps) < inflate;
      }),
  );
}

function delta(a: Vec, b: Vec): [number, number] {
  return [a.x - b.x, a.y - b.y];
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
