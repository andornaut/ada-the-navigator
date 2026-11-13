import type { Point } from "./projection.ts";

export interface Surface {
  readonly color: string;
  readonly kind?: string;
  readonly twoSided?: boolean;
  readonly points: readonly Point[];
}

export interface Fragment {
  readonly color: string;
  readonly outline: readonly (readonly [number, number])[];
}

export interface Plane {
  readonly normal: Point;
  readonly distance: number;
}

const EPSILON = 1e-7;
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function plane(points: readonly Point[]): Plane | null {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const [i, a] of points.entries()) {
    const b = points[(i + 1) % points.length]!;
    x += (a[1] - b[1]) * (a[2] + b[2]);
    y += (a[2] - b[2]) * (a[0] + b[0]);
    z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const length = Math.hypot(x, y, z);
  if (length < EPSILON) return null;
  const normal: Point = [x / length, y / length, z / length];
  return { distance: dot(normal, points[0]!), normal };
}

/** Split a polygon at a plane without changing its winding. */
export function split(boundary: Plane, points: readonly Point[]) {
  const front: Point[] = [];
  const back: Point[] = [];
  for (const [i, a] of points.entries()) {
    const b = points[(i + 1) % points.length]!;
    const da = dot(boundary.normal, a) - boundary.distance;
    const db = dot(boundary.normal, b) - boundary.distance;
    if (da >= -EPSILON) front.push(a);
    if (da <= EPSILON) back.push(a);
    if ((da > EPSILON && db < -EPSILON) || (da < -EPSILON && db > EPSILON)) {
      const t = da / (da - db);
      const p: Point = [
        a[0] + t * (b[0] - a[0]),
        a[1] + t * (b[1] - a[1]),
        a[2] + t * (b[2] - a[2]),
      ];
      front.push(p);
      back.push(p);
    }
  }
  return { back, front };
}

/** Ear clipping retains the actual outline of concave hull facets in either winding. */
export function triangles(points: readonly (readonly [number, number])[]): number[][] {
  const cross = (a: number, b: number, c: number) =>
    (points[b]![0] - points[a]![0]) * (points[c]![1] - points[a]![1]) -
    (points[b]![1] - points[a]![1]) * (points[c]![0] - points[a]![0]);
  const ids = points
    .map((_, i) => i)
    .filter((i) => {
      const a = points[i]!;
      const b = points[(i + points.length - 1) % points.length]!;
      return Math.hypot(a[0] - b[0], a[1] - b[1]) > EPSILON;
    });
  const area = ids.reduce((sum, i, k) => {
    const a = points[i]!;
    const b = points[ids[(k + 1) % ids.length]!]!;
    return sum + a[0] * b[1] - b[0] * a[1];
  }, 0);
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const orientationTolerance =
    Number.EPSILON *
    Math.max(1, (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))) *
    64;
  const sign = area >= 0 ? 1 : -1;
  const result: number[][] = [];
  while (ids.length > 3) {
    let found = false;
    for (let k = 0; k < ids.length; k++) {
      const a = ids[(k + ids.length - 1) % ids.length]!;
      const b = ids[k]!;
      const c = ids[(k + 1) % ids.length]!;
      if (cross(a, b, c) * sign <= orientationTolerance) continue;
      if (
        ids.some(
          (i) =>
            i !== a &&
            i !== b &&
            i !== c &&
            cross(a, b, i) * sign >= -orientationTolerance &&
            cross(b, c, i) * sign >= -orientationTolerance &&
            cross(c, a, i) * sign >= -orientationTolerance,
        )
      )
        continue;
      result.push([a, b, c]);
      ids.splice(k, 1);
      found = true;
      break;
    }
    if (!found) {
      const k = ids.findIndex(
        (b, i) =>
          Math.abs(cross(ids[(i + ids.length - 1) % ids.length]!, b, ids[(i + 1) % ids.length]!)) <
          orientationTolerance,
      );
      if (k < 0) throw new Error("Ship surface has a non-simple polygon");
      ids.splice(k, 1);
    }
  }
  if (ids.length === 3) result.push(ids);
  return result;
}

export function planarTriangles(surface: Surface): Surface[] {
  const boundary = plane(surface.points);
  if (!boundary) return [];
  const axis = boundary.normal.map(Math.abs).indexOf(Math.max(...boundary.normal.map(Math.abs)));
  const projected = surface.points.map((p): [number, number] =>
    axis === 0 ? [p[1], p[2]] : axis === 1 ? [p[0], p[2]] : [p[0], p[1]],
  );
  return triangles(projected).map((ids) => ({
    ...surface,
    points: ids.map((i) => surface.points[i]!),
  }));
}

/** Merge aperture ears into convex pieces before subtraction, avoiding interior seams. */
export function convexParts(points: readonly (readonly [number, number])[]): number[][] {
  const parts = triangles(points);
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < parts.length; i++)
      for (let j = i + 1; j < parts.length; j++) {
        const a = parts[i]!;
        const b = parts[j]!;
        for (let u = 0; u < a.length; u++)
          for (let v = 0; v < b.length; v++) {
            if (a[u] !== b[(v + 1) % b.length] || a[(u + 1) % a.length] !== b[v]) continue;
            const joined = [
              ...a.slice(u + 1),
              ...a.slice(0, u + 1),
              ...b.slice(v + 2),
              ...b.slice(0, v),
            ];
            const signs = joined.map((id, k) => {
              const p = points[id]!;
              const q = points[joined[(k + 1) % joined.length]!]!;
              const r = points[joined[(k + 2) % joined.length]!]!;
              return (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]);
            });
            if (signs.some((s) => s > EPSILON) && signs.some((s) => s < -EPSILON)) continue;
            parts[i] = joined;
            parts.splice(j, 1);
            changed = true;
            break outer;
          }
      }
  }
  return parts;
}

/** Keep only the parts outside a convex volume, for the roof opening and inset collar. */
export function outside(boundaries: readonly Plane[], surface: Surface): Surface[] {
  let inside = surface.points;
  const result: Surface[] = [];
  for (const boundary of boundaries) {
    const distances = inside.map((p) => dot(boundary.normal, p) - boundary.distance);
    if (distances.every((d) => d <= EPSILON)) continue;
    if (distances.every((d) => d >= -EPSILON)) {
      result.push({ ...surface, points: inside });
      return result;
    }
    const parts = split(boundary, inside);
    if (parts.front.length >= 3 && plane(parts.front))
      result.push({ ...surface, points: parts.front });
    inside = parts.back;
    if (inside.length < 3) break;
  }
  return result;
}

export interface Tree {
  readonly boundary: Plane;
  readonly coplanar: readonly Surface[];
  readonly front: Tree | null;
  readonly back: Tree | null;
}

/** Surface planes resolve exact overlap without rasterizing the geometry. */
export function partition(surfaces: readonly Surface[], level = 0): Tree | null {
  if (!surfaces.length) return null;
  let boundary: Plane | null = null;
  boundary ??= surfaces.map(({ points }) => plane(points)).find((p) => p !== null) ?? null;
  if (!boundary) return null;
  const coplanar: Surface[] = [];
  const front: Surface[] = [];
  const back: Surface[] = [];
  for (const surface of surfaces) {
    const distances = surface.points.map((p) => dot(boundary.normal, p) - boundary.distance);
    const positive = distances.some((d) => d > EPSILON);
    const negative = distances.some((d) => d < -EPSILON);
    if (!positive && !negative) coplanar.push(surface);
    else if (!negative) front.push(surface);
    else if (!positive) back.push(surface);
    else {
      const parts = split(boundary, surface.points);
      if (parts.front.length >= 3 && plane(parts.front))
        front.push({ ...surface, points: parts.front });
      if (parts.back.length >= 3 && plane(parts.back))
        back.push({ ...surface, points: parts.back });
    }
  }
  return {
    back: partition(back, level + 1),
    boundary,
    coplanar,
    front: partition(front, level + 1),
  };
}

/** Orthographic back-to-front order is independent of paint and projection scale. */
export function ordered(viewer: Point, tree: Tree | null): Surface[] {
  if (!tree) return [];
  const front = dot(tree.boundary.normal, viewer) >= 0;
  return [
    ...ordered(viewer, front ? tree.back : tree.front),
    ...tree.coplanar,
    ...ordered(viewer, front ? tree.front : tree.back),
  ];
}
