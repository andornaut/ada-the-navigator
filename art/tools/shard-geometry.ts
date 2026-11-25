import {
  type Craft,
  coralRear,
  coralSide,
  drawOrder,
  faces,
  type Part,
  type Plan,
} from "./crafts.ts";
import { ENEMY_HEADINGS, json, projectAt, rotate, round, vector } from "./projection.ts";

type Kind = "hull" | "part" | "fleck";
type Group = { kind: Kind; parts: Part[]; from?: number; to?: number };

// Fixed per-shard draws: direction jitter (rad), drift in hull half-spans, signed spin (rad)
// and lift (model units). Shard i of every archetype uses row i: wedges in cut order, then
// loose parts in model order, then the four flecks.
export const SEEDS: readonly (readonly [number, number, number, number])[] = [
  [0.0251, 0.5597, -1.5187, -1.0677],
  [-0.2898, 0.5755, -0.7816, 0.8207],
  [0.2288, 0.4871, -1.2676, 2.247],
  [-0.3067, 0.6257, -1.5786, -2.5808],
  [0.2509, 0.5369, -1.1866, 2.1382],
  [0.0422, 0.6546, -1.2234, 2.7502],
  [-0.0893, 0.6143, -1.2079, 2.5711],
  [-0.0025, 0.6095, 1.119, 5.311],
  [-0.0969, 0.5245, -1.3291, -0.8031],
  [0.0521, 0.6076, 1.3565, -0.4086],
  [0.3361, 0.4854, 0.8485, 0.0785],
  [0.3033, 0.5765, -1.3881, 2.1572],
  [0.2628, 0.5441, 1.2349, 2.2191],
  [-0.0307, 0.702, 1.1267, 2.9774],
];
// Fleck plan angles (rad) around the hull centre.
export const FLECKS = [2.0347, 0.9478, 4.0899, 0.4551];
export const FLECK_DISTANCE = 1.5;

// Keep the part of `poly` left of the directed line a -> b (Sutherland-Hodgman).
function clip(
  a: readonly [number, number],
  b: readonly [number, number],
  poly: Plan,
): [number, number][] {
  const side = (p: readonly [number, number]) =>
    (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  const out: [number, number][] = [];
  for (const [i, p] of poly.entries()) {
    const q = poly[(i + 1) % poly.length]!;
    const [sp, sq] = [side(p), side(q)];
    if (sp >= 0) {
      out.push([p[0], p[1]]);
    }
    if (sp >= 0 !== sq >= 0) {
      const t = sp / (sp - sq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

// Plan wedge between rays at `from` and `to` degrees from the hull origin.
function wedge(from: number, to: number, plan: Plan): [number, number][] {
  const ray = (degrees: number) =>
    [Math.cos((degrees * Math.PI) / 180), Math.sin((degrees * Math.PI) / 180)] as const;
  const first = clip([0, 0], ray(from), plan);
  return first.length > 0 ? clip(ray(to), [0, 0], first) : first;
}

const centroid = (points: Plan) =>
  [
    points.reduce((sum, [x]) => sum + x, 0) / points.length,
    points.reduce((sum, [, y]) => sum + y, 0) / points.length,
  ] as const;

function groups(craft: Craft): Group[] {
  const [hull, ...rest] = craft.parts as [Part, ...Part[]];
  const result: Group[] = [];
  for (const [i, from] of craft.cuts.entries()) {
    const to = craft.cuts[(i + 1) % craft.cuts.length]! + (i === craft.cuts.length - 1 ? 360 : 0);
    const plan = wedge(from, to, hull.plan);
    if (plan.length >= 3) {
      result.push({ kind: "hull", parts: [{ ...hull, plan }], from, to });
    }
  }
  const loose: Group[] = [];
  for (const part of rest) {
    if (part.decal) {
      for (const group of result) {
        const plan = wedge(group.from!, group.to!, part.plan);
        if (plan.length >= 3) {
          group.parts.push({ ...part, plan });
        }
      }
      continue;
    }
    if (part.loose) {
      loose.push({ kind: "part", parts: [part] });
      continue;
    }
    const [cx, cy] = centroid(part.plan);
    const angle = (Math.atan2(cy, cx) * 180) / Math.PI;
    const host = result.find(
      ({ from, to }) =>
        (from! <= angle && angle < to!) || (from! <= angle + 360 && angle + 360 < to!),
    );
    host?.parts.push(part);
  }
  result.push(...loose);
  const half = halfSpan(craft);
  for (const angle of FLECKS) {
    const [cx, cy] = [half * 0.3 * Math.cos(angle), half * 0.3 * Math.sin(angle)];
    const s = half * 0.09;
    const plan: Plan = [
      [cx, cy - s],
      [cx + s, cy + s * 0.8],
      [cx - s, cy + s * 0.6],
    ];
    result.push({
      kind: "fleck",
      parts: [{ plan, z0: 1, z1: 2.5, top: coralSide, side: coralRear }],
    });
  }
  return result;
}

export const halfSpan = (craft: Craft) =>
  Math.max(...craft.parts[0]!.plan.map(([x]) => Math.abs(x)));
const px = (value: number) => Math.round(value * 100) / 100 + 0;

export function shards(craft: Craft): string {
  const centre = craft.frame / 2;
  const half = halfSpan(craft);
  const hullTop = craft.parts[0]!.z1;
  const all = groups(craft);
  if (all.length > SEEDS.length) {
    throw new Error(`${craft.name} needs ${all.length} seed rows`);
  }
  const motion = all.map((group, i) => {
    const [jitter, distance, , lift] = SEEDS[i]!;
    // Paint and coplanar inlays have no volume and never move a shard's centroid.
    const solid = group.parts.filter(({ decal, z0, z1 }) => !decal && z1 > z0);
    const [cx, cy] = centroid(solid.flatMap(({ plan }) => plan));
    const angle = Math.atan2(cy, cx) + jitter;
    const length = half * distance * (group.kind === "fleck" ? FLECK_DISTANCE : 1);
    const z = (group.parts[0]!.z0 + group.parts[0]!.z1) / 2;
    const drift = [Math.cos(angle) * length, Math.sin(angle) * length] as const;
    return { centre: [cx, cy, z] as const, drift, lift };
  });
  const headings = Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => ({
    index: yaw,
    shards: all
      .map((group, shard) => {
        const { centre: c, drift, lift } = motion[shard]!;
        const [x, y] = projectAt(centre, centre, rotate(ENEMY_HEADINGS, yaw, c));
        const [dx, dy] = vector(ENEMY_HEADINGS, yaw, [drift[0], drift[1], 0]);
        const rest = rotate(ENEMY_HEADINGS, yaw, [c[0], c[1], 0]);
        const moved = rotate(ENEMY_HEADINGS, yaw, [drift[0], drift[1], 0]);
        return {
          shard,
          centroid: [px(x), px(y)],
          drift: [dx, round(dy - lift)],
          nearness: round(rest[0] + rest[1]),
          nearnessDrift: round(moved[0] + moved[1]),
          polygons: drawOrder(yaw, hullTop, group.parts)
            .flatMap((part) => faces(yaw, part))
            .map(({ color, points }) => ({
              color,
              points: points.flatMap((point) => projectAt(centre, centre, point).map(px)),
            })),
        };
      })
      .sort((a, b) => a.nearness - b.nearness),
  }));
  return json({
    version: 1,
    archetype: craft.name,
    frame: craft.frame,
    halfSpan: half,
    shards: all.map(({ kind }, i) => {
      const [jitter, distance, spin, lift] = SEEDS[i]!;
      return { kind, jitter, distance, spin, lift };
    }),
    headings,
  });
}
