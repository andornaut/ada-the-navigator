// Cartwheel's eight ore-field families, each with a realization for 6 to 10 crystal rocks.
// The loose cluster keeps its seeded positions; each other family reuses its rock order, shapes
// and start frames, with authored positions that preserve the footprint gap and field radius.
// Writes
// public/art/cartwheel/ore-field.json and links it from Cartwheel's manifest as `oreField`.
// Usage: node art/tools/ore-field.ts (after node art/tools/asteroids.ts)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { format, resolveConfig } from "prettier";

import { linkData } from "./manifest.ts";
import { json } from "./projection.ts";
import { Random, roundHalfEven } from "./random.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const dir = `${art}cartwheel/`;
mkdirSync(dir, { recursive: true });

// Gameplay values: 6 to 10 rocks about 900 world units across, two of every three medium.
const COUNT = [6, 10] as const;
const RADIUS = 450;
const MEDIUM_SHARE = 2 / 3;
// Art values: footprint clearance, placement tries per rock, the approved seed, and the disc
// fraction a rock centre never falls inside (so the centre stays open).
const GAP = 55;
const TRIES = 4000;
const FIRST_SEED = 23;
const INNER = 0.02;

type Size = "medium" | "large";
interface Rock {
  id: string;
  size: Size;
  footprintRadius: number;
  frames: unknown[];
}

const catalog = JSON.parse(readFileSync(`${art}resource-rocks.json`, "utf8")) as {
  rocks: Rock[];
};
const bySize = (size: Size) => catalog.rocks.filter((rock) => rock.size === size);
const [MEDIUM, LARGE] = [bySize("medium"), bySize("large")];

const r2 = (v: number) => Math.round(v * 100) / 100 + 0;

interface Placed {
  id: string;
  x: number;
  y: number;
  frame: number;
  footprintRadius: number;
}

// The loose cluster's seeded draw order: count, kinds, then each rock's tries and start frame.
function cluster(seed: number): Placed[] {
  const rnd = new Random(seed);
  const count = COUNT[0] + rnd.below(COUNT[1] - COUNT[0] + 1);
  const large = roundHalfEven(count * (1 - MEDIUM_SHARE));
  const kinds = Array.from({ length: count }, (_, i) => rnd.choice(i < large ? LARGE : MEDIUM));
  const placed: Placed[] = [];
  for (const rock of kinds) {
    const fp = rock.footprintRadius;
    let spot: Placed | undefined;
    for (let t = 0; t < TRIES && !spot; t++) {
      const a = rnd.uniform(0, 2 * Math.PI);
      const d = (RADIUS - fp) * Math.sqrt(rnd.uniform(INNER, 1));
      const [x, y] = [d * Math.cos(a), d * Math.sin(a)];
      if (placed.every((p) => Math.hypot(x - p.x, y - p.y) >= fp + p.footprintRadius + GAP)) {
        // Every rock draws a start frame; still rocks show their only frame.
        const frame = rnd.below(24) % rock.frames.length;
        spot = { footprintRadius: fp, frame, id: rock.id, x, y };
      }
    }
    if (!spot) throw new Error(`seed ${seed}: no room for ${rock.id}`);
    placed.push(spot);
  }
  return placed;
}

function countOf(seed: number): number {
  return COUNT[0] + new Random(seed).below(COUNT[1] - COUNT[0] + 1);
}

const layouts = [];
for (let count = COUNT[0]; count <= COUNT[1]; count++) {
  let seed = FIRST_SEED;
  while (countOf(seed) !== count) seed++;
  const rocks = cluster(seed);
  // Rounded positions keep every clearance (checked on the published values).
  const out = rocks.map((rock) => ({ ...rock, x: r2(rock.x), y: r2(rock.y) }));
  for (const [i, a] of out.entries()) {
    if (Math.hypot(a.x, a.y) + a.footprintRadius > RADIUS) {
      throw new Error(`seed ${seed}: ${a.id} leaves the field`);
    }
    for (const b of out.slice(i + 1)) {
      if (Math.hypot(a.x - b.x, a.y - b.y) < a.footprintRadius + b.footprintRadius + GAP) {
        throw new Error(`seed ${seed}: ${a.id} and ${b.id} closer than the gap`);
      }
    }
  }
  const reach = Math.max(...out.map((r) => Math.hypot(r.x, r.y) + r.footprintRadius));
  layouts.push({
    count,
    large: out.filter(({ id }) => LARGE.some((rock) => rock.id === id)).length,
    seed,
    reach: r2(reach),
    rocks: out.map(({ frame, id, x, y }) => ({ id, position: [x, y], frame })),
  });
}

type Position = readonly [number, number];
type Layout = (typeof layouts)[number];
const FAMILIES = [
  "loose-cluster",
  "crescent",
  "two-pockets",
  "broken-ring",
  "scattered-trail",
  "three-pockets",
  "forked-trail",
  "open-spiral",
] as const;
type Family = (typeof FAMILIES)[number];
const polar = (radius: number, degrees: number): Position => [
  radius * Math.cos((degrees * Math.PI) / 180),
  radius * Math.sin((degrees * Math.PI) / 180),
];

function anchors(family: Family, count: number): Position[] {
  if (family === "crescent" || family === "broken-ring") {
    const radius = family === "crescent" ? 365 : 340;
    const start = family === "crescent" ? -124 : -150;
    const span = family === "crescent" ? 248 : 300;
    return Array.from({ length: count }, (_, i) => polar(radius, start + (span * i) / (count - 1)));
  }
  if (family === "two-pockets" || family === "three-pockets") {
    const pockets = family === "two-pockets" ? 2 : 3;
    const points: Position[] = [];
    for (let pocket = 0; pocket < pockets; pocket++) {
      const amount = Math.floor(count / pockets) + (pocket < count % pockets ? 1 : 0);
      const centre: Position =
        pockets === 2 ? [pocket === 0 ? -215 : 215, 0] : polar(235, 90 + pocket * 120);
      for (let i = 0; i < amount; i++) {
        const offset = polar(pockets === 2 ? 130 : 110, (360 * i) / amount + pocket * 24);
        points.push([centre[0] + offset[0], centre[1] + offset[1]]);
      }
    }
    return points;
  }
  if (family === "scattered-trail") {
    return Array.from({ length: count }, (_, i) => [
      -350 + (700 * i) / (count - 1),
      (i % 2 === 0 ? -120 : 120) + 25 * Math.sin((i * Math.PI) / (count - 1)),
    ]);
  }
  if (family === "forked-trail") {
    const points: Position[] = [[0, 0]];
    for (let arm = 0; arm < 3; arm++) {
      const amount = Math.floor((count - 1) / 3) + (arm < (count - 1) % 3 ? 1 : 0);
      const radii = amount === 3 ? [130, 255, 380] : amount === 2 ? [170, 380] : [380];
      for (const [i, radius] of radii.entries()) {
        points.push(polar(radius, -90 + arm * 120 + (amount === 3 && i === 1 ? 25 : 0)));
      }
    }
    return points;
  }
  if (family === "open-spiral") {
    return Array.from({ length: count }, (_, i) =>
      polar(150 + (215 * i) / (count - 1), -170 + (440 * i) / (count - 1)),
    );
  }
  throw new Error(`No authored anchors for ${family}`);
}

const footprint = new Map(catalog.rocks.map((rock) => [rock.id, rock.footprintRadius]));

// Pick spacious anchors for the large rocks without changing their published order or frames.
// Every candidate uses the exact footprint radii, including the smaller rocks that fill it.
function realize(family: Family, layout: Layout): Layout {
  const points = anchors(family, layout.count).map(([x, y]) => [r2(x), r2(y)] as const);
  const candidates: { margin: number; rocks: Layout["rocks"] }[] = [];
  function candidate(indices: number[]): void {
    const selected = new Set(indices);
    const order = [...indices, ...points.map((_, i) => i).filter((i) => !selected.has(i))];
    const rocks = layout.rocks.map((rock, i) => ({ ...rock, position: [...points[order[i]!]!] }));
    let margin = Infinity;
    for (const [i, rock] of rocks.entries()) {
      const [x, y] = rock.position;
      const fp = footprint.get(rock.id)!;
      margin = Math.min(margin, RADIUS - Math.hypot(x!, y!) - fp);
      for (const other of rocks.slice(i + 1)) {
        margin = Math.min(
          margin,
          Math.hypot(x! - other.position[0]!, y! - other.position[1]!) -
            fp -
            footprint.get(other.id)! -
            GAP,
        );
      }
    }
    if (margin >= 0) candidates.push({ margin, rocks });
  }
  function choose(indices: number[], next: number): void {
    if (indices.length === layout.large) return candidate(indices);
    for (let i = next; i <= points.length - (layout.large - indices.length); i++)
      choose([...indices, i], i + 1);
  }
  choose([], 0);
  const best = candidates.sort((a, b) => b.margin - a.margin)[0];
  if (!best) throw new Error(`${family} ${layout.count}: authored anchors have no clear placement`);
  const rocks = best.rocks;
  const reach = r2(
    Math.max(
      ...rocks.map(
        (rock) => Math.hypot(rock.position[0]!, rock.position[1]!) + footprint.get(rock.id)!,
      ),
    ),
  );
  return { ...layout, reach, rocks };
}

const variants = FAMILIES.map((id) => ({
  id,
  layouts: id === "loose-cluster" ? layouts : layouts.map((layout) => realize(id, layout)),
}));

const path = `${dir}ore-field.json`;
writeFileSync(
  path,
  await format(
    json({
      version: 2,
      rocks: "/art/resource-rocks.json",
      radius: RADIUS,
      gap: GAP,
      count: COUNT,
      variants,
    }),
    { ...(await resolveConfig(path)), filepath: path },
  ),
);

linkData("cartwheel", { oreField: "/art/cartwheel/ore-field.json" });
