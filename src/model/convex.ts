import type { Vec } from "./types.ts";

/** A drawn outline as convex parts, which may overlap slightly at their seams. */
export type Parts = readonly (readonly Vec[])[];

export interface Contact {
  /** Unit vector from the obstacle surface toward the circle center. */
  readonly normal: Vec;
  /** Overlap depth along the normal. */
  readonly depth: number;
}

/** Screen px past an edge that tells a seam from the outline, where the next part continues. */
const SEAM_STEP = 1.5;

/** A world offset on the screen: the play view's projection (x - y, (x + y) / 2). */
export function toScreen(offset: Vec): Vec {
  return { x: offset.x - offset.y, y: (offset.x + offset.y) / 2 };
}

/** The world offset that projects to a screen offset. */
export function fromScreen(screen: Vec): Vec {
  return { x: screen.y + screen.x / 2, y: screen.y - screen.x / 2 };
}

const WORLD_PARTS = new WeakMap<Parts, Parts>();
/** A screen outline on the world plane: the parts whose projection is the outline. */
export function worldParts(screen: Parts): Parts {
  let parts = WORLD_PARTS.get(screen);
  if (!parts) {
    parts = screen.map((part) => part.map(fromScreen));
    WORLD_PARTS.set(screen, parts);
  }
  return parts;
}

/**
 * A screen contact in world units. A screen edge with normal n is the world line with normal
 * P^T n, where P is the projection, and moving 1 world unit along that unit normal moves the
 * point |P^T n| screen px off the edge.
 */
export function worldContact(screen: Contact): Contact {
  const { x, y } = screen.normal;
  const normal = { x: x + y / 2, y: y / 2 - x };
  const scale = Math.hypot(normal.x, normal.y);
  return { depth: screen.depth / scale, normal: { x: normal.x / scale, y: normal.y / scale } };
}

export function closestOnSegment(point: Vec, a: Vec, b: Vec): Vec {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const square = dx * dx + dy * dy;
  const t = square
    ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / square))
    : 0;
  return { x: a.x + dx * t, y: a.y + dy * t };
}

export function inside(part: readonly Vec[], point: Vec): boolean {
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
export function partContact(part: readonly Vec[], center: Vec, radius: number): Contact | null {
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

/**
 * A circle against the union of convex parts that overlap at their seams. Outside the union the
 * nearest part decides. Inside it, the circle leaves through the nearest outer edge: an edge
 * point whose outward step lands in another part is a seam, not the outline.
 */
export function unionContact(parts: Parts, center: Vec, radius: number): Contact | null {
  const container = parts.find((part) => inside(part, center));
  if (!container) {
    if (radius <= 0) {
      return null;
    }
    let deepest: Contact | null = null;
    for (const part of parts) {
      const contact = partContact(part, center, radius);
      if (contact && (!deepest || contact.depth > deepest.depth)) {
        deepest = contact;
      }
    }
    return deepest;
  }
  // Every edge's nearest point, nearest first; the first that is not a seam is the exit.
  const candidates: { a: Vec; at: Vec; b: Vec; gap: number; part: readonly Vec[] }[] = [];
  for (const part of parts) {
    for (let index = 0; index < part.length; index++) {
      const a = part[index]!;
      const b = part[(index + 1) % part.length]!;
      const at = closestOnSegment(center, a, b);
      candidates.push({ a, at, b, gap: Math.hypot(at.x - center.x, at.y - center.y), part });
    }
  }
  candidates.sort((p, q) => p.gap - q.gap);
  for (const { a, at, b, gap, part } of candidates) {
    // The edge's outward unit normal, away from its part's centroid.
    const centroid = {
      x: part.reduce((sum, point) => sum + point.x, 0) / part.length,
      y: part.reduce((sum, point) => sum + point.y, 0) / part.length,
    };
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    let normal = { x: (b.y - a.y) / length, y: (a.x - b.x) / length };
    if (normal.x * (at.x - centroid.x) + normal.y * (at.y - centroid.y) < 0) {
      normal = { x: -normal.x, y: -normal.y };
    }
    const step = { x: at.x + normal.x * SEAM_STEP, y: at.y + normal.y * SEAM_STEP };
    if (parts.some((other) => other !== part && inside(other, step))) {
      continue;
    }
    const exit = gap > 1e-9 ? { x: (at.x - center.x) / gap, y: (at.y - center.y) / gap } : normal;
    return { depth: gap + radius, normal: exit };
  }
  return partContact(container, center, radius);
}

/** Whether segments ab and cd cross. */
function crosses(a: Vec, b: Vec, c: Vec, d: Vec): boolean {
  const side = (p: Vec, q: Vec, r: Vec) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

function gap(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Whether segment ab passes within `inflate` of the union of convex parts. */
export function segmentNearParts(parts: Parts, a: Vec, b: Vec, inflate: number): boolean {
  return parts.some(
    (part) =>
      inside(part, a) ||
      part.some((corner, index) => {
        const next = part[(index + 1) % part.length]!;
        if (crosses(a, b, corner, next)) {
          return true;
        }
        return (
          Math.min(
            gap(corner, closestOnSegment(corner, a, b)),
            gap(a, closestOnSegment(a, corner, next)),
            gap(b, closestOnSegment(b, corner, next)),
          ) < inflate
        );
      }),
  );
}

/** The farthest point of the parts from their origin. */
export function partsReach(parts: Parts): number {
  return Math.max(0, ...parts.flatMap((part) => part.map((at) => Math.hypot(at.x, at.y))));
}

/** Convex hull of points, counter-clockwise in screen axes (y down), by monotone chain. */
function hull(points: Vec[]): Vec[] {
  const sorted = [...points].sort((p, q) => p.x - q.x || p.y - q.y);
  const cross = (o: Vec, a: Vec, b: Vec) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const chain = (list: Vec[]) => {
    const out: Vec[] = [];
    for (const point of list) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, point) <= 1e-12) {
        out.pop();
      }
      out.push(point);
    }
    out.pop();
    return out;
  };
  return [...chain(sorted), ...chain(sorted.reverse())];
}

/**
 * The obstacle grown by the body: every Minkowski sum of an obstacle part with a body part
 * mirrored through its origin. The body's origin overlaps the obstacle exactly when it lies in
 * their union, so a polygon body meets a polygon obstacle as a point meets this union.
 */
export function grownParts(obstacle: Parts, body: Parts): Parts {
  return obstacle.flatMap((part) =>
    body.map((piece) =>
      hull(part.flatMap((at) => piece.map((point) => ({ x: at.x - point.x, y: at.y - point.y })))),
    ),
  );
}

const GROWN = new WeakMap<Parts, WeakMap<Parts, Parts>>();
/** `grownParts` built once per obstacle and body outline. */
export function grown(obstacle: Parts, body: Parts): Parts {
  let byBody = GROWN.get(obstacle);
  if (!byBody) {
    byBody = new WeakMap();
    GROWN.set(obstacle, byBody);
  }
  let parts = byBody.get(body);
  if (!parts) {
    parts = grownParts(obstacle, body);
    byBody.set(body, parts);
  }
  return parts;
}

/**
 * A world circle against a drawn outline, its screen parts from `origin`, on the world plane:
 * the normal points from the outline toward the circle's centre.
 */
export function outlineContact(
  outline: Parts,
  origin: Vec,
  center: Vec,
  radius: number,
): Contact | null {
  const world = worldParts(outline);
  const offset = { x: center.x - origin.x, y: center.y - origin.y };
  if (Math.hypot(offset.x, offset.y) >= partsReach(world) + radius) {
    return null;
  }
  return unionContact(world, offset, radius);
}

/**
 * A drawn body, its screen parts from `position`, against a drawn obstacle from `origin`, on the
 * world plane: the contact pushes the body.
 */
export function outlinesContact(
  obstacle: Parts,
  origin: Vec,
  body: Parts,
  position: Vec,
): Contact | null {
  const shape = worldParts(obstacle);
  const own = worldParts(body);
  const offset = { x: position.x - origin.x, y: position.y - origin.y };
  if (Math.hypot(offset.x, offset.y) >= partsReach(shape) + partsReach(own)) {
    return null;
  }
  return unionContact(grown(shape, own), offset, 0);
}
