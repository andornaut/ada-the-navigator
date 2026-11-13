import { createHash } from "node:crypto";

import type { Point } from "./projection.ts";
import { type Fragment, outside, type Plane, type Surface } from "./ship-surface.ts";

type Xy = readonly [number, number];
const EPSILON = 1e-6;
const pointKey = ([x, y]: Xy) => `${x.toFixed(9)},${y.toFixed(9)}`;
const area = (points: readonly Xy[]) =>
  points.reduce((sum, a, i) => {
    const b = points[(i + 1) % points.length]!;
    return sum + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
const cache = new Map<string, { index: number; loops: Xy[][]; filledVoidArea: number }[]>();

function bounds(points: readonly Xy[]) {
  return [
    Math.min(...points.map((p) => p[0])),
    Math.min(...points.map((p) => p[1])),
    Math.max(...points.map((p) => p[0])),
    Math.max(...points.map((p) => p[1])),
  ] as const;
}

function simpleLoops(points: readonly Xy[]): Xy[][] {
  const seen = new Map<string, number>();
  for (let i = 0; i < points.length; i++) {
    const key = pointKey(points[i]!),
      start = seen.get(key);
    if (start !== undefined) {
      const pieces = [
        ...simpleLoops(points.slice(start, i)),
        ...simpleLoops([...points.slice(0, start), ...points.slice(i)]),
      ];
      const restored = pieces.reduce((sum, loop) => sum + area(loop), 0);
      if (Math.abs(restored - area(points)) > EPSILON)
        throw new Error("Ship contour split changed its covered area");
      return pieces;
    }
    seen.set(key, i);
  }
  return points.length >= 3 ? [points.slice()] : [];
}

/** Union a disjoint visible partition, cancelling shared edges including T junctions. */
function contours(polygons: readonly (readonly Xy[])[]): Xy[][] {
  type Edge = { a: Xy; b: Xy; low: number; high: number; direction: number };
  const lines: { direction: Xy; origin: Xy; edges: Edge[] }[] = [];
  const buckets = new Map<string, number[]>();
  const cell = 1e-5;
  for (const polygon of polygons) {
    const points = area(polygon) < 0 ? polygon.toReversed() : polygon;
    for (const [i, a] of points.entries()) {
      const b = points[(i + 1) % points.length]!;
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < EPSILON) continue;
      let dx = (b[0] - a[0]) / length,
        dy = (b[1] - a[1]) / length;
      if (Math.abs(dx) < 1e-10) {
        dx = 0;
        dy = 1;
      } else if (dx < 0) {
        dx = -dx;
        dy = -dy;
      }
      const direction: Xy = [dx, dy],
        distance = dx * a[1] - dy * a[0];
      const gx = Math.floor(dx / cell),
        gy = Math.floor(dy / cell),
        gd = Math.floor(distance / cell);
      let line: (typeof lines)[number] | undefined;
      search: for (let x = -1; x <= 1; x++)
        for (let y = -1; y <= 1; y++)
          for (let d = -1; d <= 1; d++)
            for (const id of buckets.get(`${gx + x},${gy + y},${gd + d}`) ?? []) {
              const candidate = lines[id]!,
                n = candidate.direction,
                o = candidate.origin;
              if (
                Math.abs(n[0] * (a[1] - o[1]) - n[1] * (a[0] - o[0])) <= EPSILON &&
                Math.abs(n[0] * (b[1] - o[1]) - n[1] * (b[0] - o[0])) <= EPSILON
              ) {
                line = candidate;
                break search;
              }
            }
      if (!line) {
        line = { direction, origin: a, edges: [] };
        const id = lines.length;
        lines.push(line);
        const key = `${gx},${gy},${gd}`,
          bucket = buckets.get(key) ?? [];
        bucket.push(id);
        buckets.set(key, bucket);
      }
      const ta = line.direction[0] * a[0] + line.direction[1] * a[1];
      const tb = line.direction[0] * b[0] + line.direction[1] * b[1];
      line.edges.push({
        a,
        b,
        low: Math.min(ta, tb),
        high: Math.max(ta, tb),
        direction: tb > ta ? 1 : -1,
      });
    }
  }
  const edges: { a: Xy; b: Xy }[] = [];
  for (const line of lines) {
    const ends = line.edges
      .flatMap((e) => [e.a, e.b])
      .map((point) => ({ point, t: line.direction[0] * point[0] + line.direction[1] * point[1] }))
      .toSorted((a, b) => a.t - b.t);
    const unique: typeof ends = [];
    for (const end of ends)
      if (!unique.length || end.t - unique.at(-1)!.t > EPSILON) unique.push(end);
    for (let i = 0; i + 1 < unique.length; i++) {
      const a = unique[i]!;
      const b = unique[i + 1]!;
      const t = (a.t + b.t) / 2;
      const coverage = line.edges.reduce(
        (sum, e) => sum + (t > e.low && t < e.high ? e.direction : 0),
        0,
      );
      if (coverage !== 0)
        edges.push(coverage > 0 ? { a: a.point, b: b.point } : { a: b.point, b: a.point });
    }
  }
  const vertices: Xy[] = [];
  const vertexBuckets = new Map<string, number[]>();
  const canonical = (p: Xy): number => {
    const x = Math.floor(p[0] / EPSILON),
      y = Math.floor(p[1] / EPSILON);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const id of vertexBuckets.get(`${x + dx},${y + dy}`) ?? []) {
          const q = vertices[id]!;
          if (Math.hypot(p[0] - q[0], p[1] - q[1]) <= EPSILON) return id;
        }
    const id = vertices.length;
    vertices.push(p);
    const key = `${x},${y}`,
      bucket = vertexBuckets.get(key) ?? [];
    bucket.push(id);
    vertexBuckets.set(key, bucket);
    return id;
  };
  const joined = edges
    .map((edge) => ({ a: canonical(edge.a), b: canonical(edge.b) }))
    .filter((edge) => edge.a !== edge.b);
  const outgoing = new Map<number, number[]>();
  joined.forEach((edge, i) => {
    const list = outgoing.get(edge.a) ?? [];
    list.push(i);
    outgoing.set(edge.a, list);
  });
  const used = new Set<number>();
  const result: Xy[][] = [];
  for (let start = 0; start < joined.length; start++) {
    if (used.has(start)) continue;
    const points: Xy[] = [];
    let at = start;
    while (!used.has(at)) {
      const edge = joined[at]!;
      used.add(at);
      points.push(vertices[edge.a]!);
      const key = edge.b;
      if (key === joined[start]!.a) break;
      const next = outgoing.get(key)?.find((i) => !used.has(i));
      if (next === undefined)
        throw new Error(`Open ship material contour at ${JSON.stringify(vertices[key])}`);
      at = next;
    }
    if (points.length >= 3 && Math.abs(area(points)) > EPSILON) result.push(...simpleLoops(points));
  }
  return result;
}

/** Resolve true opaque coverage before unioning paint, leaving no internal antialias edges. */
export function paintRegions(
  fragments: readonly Fragment[],
): { color: string; loops: Xy[][]; filledVoidArea: number }[] {
  const classes = new Map<string, number>();
  const pattern = fragments.map(({ color }) => {
    if (!classes.has(color)) classes.set(color, classes.size);
    return classes.get(color)!;
  });
  const key = createHash("sha256")
    .update(JSON.stringify([fragments.map((f) => f.outline), pattern]))
    .digest("hex");
  let paths = cache.get(key);
  if (!paths) {
    const shapes = fragments.map(({ color, outline }) => {
      const points = area(outline) < 0 ? outline.toReversed() : outline;
      const boundaries: Plane[] = points.map((a, i) => {
        const b = points[(i + 1) % points.length]!;
        const dx = b[0] - a[0],
          dy = b[1] - a[1],
          length = Math.hypot(dx, dy);
        const normal: Point = [dy / length, -dx / length, 0];
        return { normal, distance: normal[0] * a[0] + normal[1] * a[1] };
      });
      return {
        color,
        boundaries,
        box: bounds(points),
        points: points.map(([x, y]): Point => [x, y, 0]),
      };
    });
    const grouped = new Map<number, Xy[][]>();
    const indices = new Map<number, number>();
    for (let i = shapes.length - 1; i >= 0; i--) {
      const shape = shapes[i]!;
      let visible: Surface[] = [{ color: shape.color, points: shape.points }];
      for (let j = i + 1; j < shapes.length && visible.length; j++) {
        const front = shapes[j]!;
        if (
          Math.min(shape.box[2], front.box[2]) - Math.max(shape.box[0], front.box[0]) <= EPSILON ||
          Math.min(shape.box[3], front.box[3]) - Math.max(shape.box[1], front.box[1]) <= EPSILON
        )
          continue;
        visible = visible.flatMap((piece) => outside(front.boundaries, piece));
      }
      const id = pattern[i]!;
      const polygons = grouped.get(id) ?? [];
      polygons.push(
        ...visible
          .map(({ points }) => points.map(([x, y]): Xy => [x, y]))
          .filter((p) => Math.abs(area(p)) > EPSILON),
      );
      grouped.set(id, polygons);
      indices.set(id, i);
    }
    const filled = new Map<number, number>();
    // Only holes in the union of every opaque material are actual background voids.
    // A hole already occupied by another colour is part of that material's shape.
    const voids = contours([...grouped.values()].flat()).filter((loop) => area(loop) < -EPSILON);
    const contains = (polygon: readonly Xy[], point: Xy) => {
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i]!,
          b = polygon[j]!;
        if (
          a[1] > point[1] !== b[1] > point[1] &&
          point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
        )
          inside = !inside;
      }
      return inside;
    };
    for (const hole of voids) {
      const adjacent = new Map<number, number>();
      for (let i = 0; i < hole.length; i++) {
        const a = hole[i]!,
          b = hole[(i + 1) % hole.length]!,
          dx = b[0] - a[0],
          dy = b[1] - a[1],
          length = Math.hypot(dx, dy);
        if (length < EPSILON) continue;
        const point: Xy = [
          (a[0] + b[0]) / 2 - (dy / length) * EPSILON * 16,
          (a[1] + b[1]) / 2 + (dx / length) * EPSILON * 16,
        ];
        for (const [id, polygons] of grouped)
          if (polygons.some((p) => contains(p, point))) {
            adjacent.set(id, (adjacent.get(id) ?? 0) + length);
            break;
          }
      }
      const owner = [...adjacent].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (owner === undefined) throw new Error("Opaque ship void has no adjacent material");
      grouped.get(owner)!.push(hole.toReversed());
      filled.set(owner, (filled.get(owner) ?? 0) + Math.abs(area(hole)));
    }
    paths = [...grouped].map(([id, polygons]) => ({
      index: indices.get(id)!,
      loops: contours(polygons),
      filledVoidArea: filled.get(id) ?? 0,
    }));
    cache.set(key, paths);
  }
  return paths.map(({ index, loops, filledVoidArea }) => ({
    color: fragments[index]!.color,
    loops,
    filledVoidArea,
  }));
}

export function svgPaths(fragments: readonly Fragment[]): { color: string; path: string }[] {
  return paintRegions(fragments).map(({ color, loops }) => ({
    color,
    path: loops
      .map(
        (points) =>
          points
            .map(([x, y], i) => `${i ? "L" : "M"}${Number(x.toFixed(4))},${Number(y.toFixed(4))}`)
            .join("") + "Z",
      )
      .join(""),
  }));
}
