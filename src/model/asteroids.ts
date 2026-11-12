import {
  ASTEROID_ART,
  type AsteroidArt,
  type AsteroidArtCatalog,
  type AsteroidSize,
  RESOURCE_ART,
  type ResourceRockCatalog,
} from "../data/asteroidCatalog.ts";
import { resourceArtId, type ResourceClass } from "../data/resourceRocks.ts";
import {
  closestOnSegment,
  type Contact,
  grown,
  type Parts,
  partsReach,
  segmentNearParts,
  toScreen,
  unionContact,
  worldContact,
  worldParts,
} from "./convex.ts";
import type { SpaceObject, Vec } from "./types.ts";

export type { Contact } from "./convex.ts";

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
  return { frames, reach: Math.max(...frames.map(partsReach)) };
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

/** The plain shapes of a resource class's size, the footprints its rocks collide on. */
export function resourceShapes(
  shapes: readonly AsteroidShape[],
  resource: ResourceClass,
): AsteroidShape[] {
  return shapes.filter((shape) => shape.size === resource);
}

export function sceneryShape(object: Pick<SpaceObject, "asteroid">): AsteroidShape | null {
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
export function scenerySilhouette(
  object: Pick<SpaceObject, "asteroid" | "kind">,
): Silhouette | null {
  if (!object.asteroid) {
    return null;
  }
  return (
    (object.kind === "resource" ? RESOURCE_SILHOUETTES.get(object.asteroid) : undefined) ??
    sceneryShape(object)?.silhouette ??
    null
  );
}

const WORLD_REACH = new WeakMap<Silhouette, number>();
/**
 * A silhouette's radius on the world plane: the farthest point of any frame's outline from the
 * pivot, as the world offset that projects to it.
 */
export function silhouetteWorldReach(drawn: Silhouette): number {
  let reach = WORLD_REACH.get(drawn);
  if (reach === undefined) {
    reach = Math.max(...drawn.frames.map((parts) => partsReach(worldParts(parts))));
    WORLD_REACH.set(drawn, reach);
  }
  return reach;
}

/**
 * The radius a clearance stated as radius plus a margin measures (gameplay/rules.md): a drawn
 * rock's silhouette radius on the world plane, over all its frames; else the object's radius.
 */
export function placementRadius(object: Pick<SpaceObject, "asteroid" | "kind" | "radius">): number {
  const drawn = scenerySilhouette(object);
  return drawn ? silhouetteWorldReach(drawn) : object.radius;
}

/**
 * Deepest overlap of a body with a scenery object, or null when they do not touch. A rock is met
 * where it is drawn: the body's offset is projected to the screen and tested against the frame's
 * silhouette grown by `radius` screen px, and the contact comes back in world units. A circle
 * obstacle meets a world circle of `radius`. `drawn` defaults to the object's rock silhouette;
 * a caller passes another drawn object's, such as traveling debris.
 */
export function sceneryContact(
  object: SpaceObject,
  center: Vec,
  radius: number,
  frame = 0,
  drawn = scenerySilhouette(object),
): Contact | null {
  const dx = center.x - object.x;
  const dy = center.y - object.y;
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
 * Deepest overlap of a drawn body, its outline in screen px from `center`, with a scenery object,
 * or null when they do not touch. Against a rock the outlines meet on the screen, as the body's
 * position against the rock frame's silhouette grown by the body; against a circle obstacle the
 * body's outline meets the world circle. A `margin` grows the contact, in screen px against a
 * rock and world units against a circle. The contact pushes the body, in world units.
 */
export function sceneryBodyContact(
  object: SpaceObject,
  center: Vec,
  body: Parts,
  frame = 0,
  margin = 0,
  drawn = scenerySilhouette(object),
): Contact | null {
  if (!drawn) {
    const contact = unionContact(
      worldParts(body),
      { x: object.x - center.x, y: object.y - center.y },
      object.radius + margin,
    );
    return (
      contact && { depth: contact.depth, normal: { x: -contact.normal.x, y: -contact.normal.y } }
    );
  }
  const screen = toScreen({ x: center.x - object.x, y: center.y - object.y });
  if (Math.hypot(screen.x, screen.y) >= drawn.reach + partsReach(body) + margin) {
    return null;
  }
  const contact = unionContact(
    grown(drawn.frames[frame] ?? drawn.frames[0]!, body),
    screen,
    margin,
  );
  return contact && worldContact(contact);
}

/**
 * World units from a scenery object's position beyond which a body of `radius` cannot touch it:
 * a screen offset of length r comes from a world offset of at most r * sqrt(2).
 */
export function sceneryBound(
  object: SpaceObject,
  radius: number,
  drawn = scenerySilhouette(object),
): number {
  return drawn ? (drawn.reach + radius) * Math.SQRT2 : object.radius + radius;
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
  drawn = scenerySilhouette(object),
): boolean {
  const nearest = closestOnSegment(object, start, end);
  if (
    Math.hypot(nearest.x - object.x, nearest.y - object.y) >= sceneryBound(object, inflate, drawn)
  ) {
    return false;
  }
  if (!drawn) {
    return true;
  }
  const a = toScreen({ x: start.x - object.x, y: start.y - object.y });
  const b = toScreen({ x: end.x - object.x, y: end.y - object.y });
  return segmentNearParts(drawn.frames[frame] ?? drawn.frames[0]!, a, b, inflate);
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
