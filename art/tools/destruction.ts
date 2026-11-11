import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { format, resolveConfig } from "prettier";

import {
  type Craft,
  coral,
  coralRear,
  coralSide,
  crafts,
  drawOrder,
  faces,
  type Part,
  type Plan,
} from "./crafts.ts";
import { ENEMY_HEADINGS, json, projectAt, rotate, round, vector } from "./projection.ts";

type Kind = "hull" | "part" | "fleck";
type Group = { kind: Kind; parts: Part[]; from?: number; to?: number };

const output = fileURLToPath(new URL("../../public/art/enemies/", import.meta.url));

// Fixed per-shard draws: direction jitter (rad), drift in hull half-spans, signed spin (rad)
// and lift (model units). Shard i of every archetype uses row i: wedges in cut order, then
// loose parts in model order, then the four flecks.
const SEEDS: readonly (readonly [number, number, number, number])[] = [
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
const FLECKS = [2.0347, 0.9478, 4.0899, 0.4551];
const FLECK_DISTANCE = 1.5;

// Approved timings: fighter 450 ms (frame 96) and retaliator 600 ms (frame 192); swarm and
// interceptor interpolate linearly by frame size, rounded to 10 ms.
const byFrame = (frame: number, at96: number, at192: number) =>
  Math.round((at96 + ((at192 - at96) * (frame - 96)) / 96) / 10) * 10;
// Pickup spread radius in world units: 19.2 at frame 96 and 33.6 at frame 192.
const spread = (frame: number, at96: number, at192: number) =>
  round(at96 + ((at192 - at96) * (frame - 96)) / 96);

const REDUCED_COOL = 0.6;
const FLASH_SIZE = 80;

// Multiply tint that cools the coral hull top toward the rear shade like the shard lerp.
function reducedTint(): string {
  const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const target = channels(coralRear);
  return `#${channels(coral)
    .map((c, i) => Math.round((255 * (c + (target[i]! - c) * REDUCED_COOL)) / c))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}
const FLASH_CORE = 0.28 / 0.55;

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

const halfSpan = (craft: Craft) => Math.max(...craft.parts[0]!.plan.map(([x]) => Math.abs(x)));
const px = (value: number) => Math.round(value * 100) / 100 + 0;

function shards(craft: Craft): string {
  const centre = craft.frame / 2;
  const half = halfSpan(craft);
  const hullTop = craft.parts[0]!.z1;
  const all = groups(craft);
  if (all.length > SEEDS.length) {
    throw new Error(`${craft.name} needs ${all.length} seed rows`);
  }
  const motion = all.map((group, i) => {
    const [jitter, distance, , lift] = SEEDS[i]!;
    // Decals are paint: they never move a shard's centroid.
    const solid = group.parts.filter(({ decal }) => !decal);
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

// Four-point star: astroid outline, squashed to 0.8 height, pale outer and white core.
function flash(): string {
  const star = (radius: number) =>
    Array.from({ length: 32 }, (_, i) => {
      const theta = (2 * Math.PI * i) / 32;
      const [c, s] = [Math.cos(theta), Math.sin(theta)];
      const r = radius / (Math.sqrt(Math.abs(c)) + Math.sqrt(Math.abs(s))) ** 2;
      return `${(FLASH_SIZE / 2 + r * c).toFixed(2)},${(FLASH_SIZE * 0.4 + r * s * 0.8).toFixed(2)}`;
    }).join(" ");
  const height = FLASH_SIZE * 0.8;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${FLASH_SIZE}" height="${height}" viewBox="0 0 ${FLASH_SIZE} ${height}">`,
    "  <title>Destruction flash</title>",
    `  <polygon fill="#ffe2c8" points="${star(FLASH_SIZE / 2)}"/>`,
    `  <polygon fill="#ffffff" points="${star((FLASH_SIZE / 2) * FLASH_CORE)}"/>`,
    "</svg>",
    "",
  ].join("\n");
}

function spec(): string {
  const archetypes = Object.fromEntries(
    crafts.map((craft) => {
      const reduced = byFrame(craft.frame, 360, 450);
      return [
        craft.name,
        {
          durationMs: byFrame(craft.frame, 450, 600),
          releaseMs: byFrame(craft.frame, 150, 190),
          flashWidth: round(halfSpan(craft) * 1.98),
          spread: spread(craft.frame, 19.2, 33.6),
          reduced: {
            durationMs: reduced,
            releaseMs: Math.round((reduced * 2) / 3 / 10) * 10,
            spread: spread(craft.frame, 7.68, 13.44),
          },
        },
      ];
    }),
  );
  return json({
    version: 1,
    shards: {
      ease: 2.4,
      shrink: 0.65,
      cool: { color: "#7f4b3d", amount: 0.55 },
      fade: { from: 0.3, exponent: 1.3 },
      fleckFadeEnd: 0.6,
    },
    flash: {
      path: "/art/enemies/destruction-flash.svg",
      width: FLASH_SIZE,
      height: FLASH_SIZE * 0.8,
      phases: [
        { fromMs: 0, toMs: 20, scale: 1, alpha: round(235 / 255) },
        { fromMs: 20, toMs: 80, scale: 0.55, alpha: round(150 / 255) },
      ],
    },
    pickups: { settleMs: 110, radius: [0.6, 1], angleJitter: 0.3, squash: 0.8 },
    reduced: { shrink: 0.8, cool: REDUCED_COOL, tint: reducedTint() },
    archetypes,
  });
}

// Long point lists wrap the way Prettier fills them, so the files stay Prettier-clean.
async function writeJson(path: string, text: string): Promise<void> {
  const options = await resolveConfig(path);
  writeFileSync(path, await format(text, { ...options, filepath: path }));
}

for (const craft of crafts) {
  await writeJson(`${output}${craft.name}-shards.json`, shards(craft));
}
await writeJson(`${output}destruction.json`, spec());
writeFileSync(`${output}destruction-flash.svg`, flash());
