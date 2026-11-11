// Cartwheel's ore field: seeded clusters of crystal resource rocks. For each rock count Gameplay
// allows, picks the first seed from FIRST_SEED up that draws that count and places the cluster:
// large rocks first, then medium, each at a uniform point of the field disc whose footprint
// stays GAP world units clear of every placed footprint and inside the field radius. Writes
// public/art/cartwheel/ore-field.json and links it from the root manifest as `oreField`.
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

// One seeded cluster. The draw order (count, kinds, then per rock its tries and start frame)
// matches the approved mock-up, so seed 23 gives the approved field.
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

const path = `${dir}ore-field.json`;
writeFileSync(
  path,
  await format(
    json({
      version: 1,
      rocks: "/art/resource-rocks.json",
      radius: RADIUS,
      gap: GAP,
      count: COUNT,
      layouts,
    }),
    { ...(await resolveConfig(path)), filepath: path },
  ),
);

linkData({ oreField: "/art/cartwheel/ore-field.json" });
