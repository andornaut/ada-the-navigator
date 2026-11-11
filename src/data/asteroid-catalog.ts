import type { Vec } from "../model/types.ts";

export const ASTEROID_SIZES = ["small", "medium", "large", "huge"] as const;
export type AsteroidSize = (typeof ASTEROID_SIZES)[number];

/**
 * One asteroid variant in Art's `asteroids.json` version 1 contract. Frame values are
 * projected sprite pixels; `collision` lists convex parts so a concave outline is their union.
 */
export interface AsteroidEntry {
  readonly id: string;
  readonly size: AsteroidSize;
  readonly frame: { readonly width: number; readonly height: number };
  readonly display: { readonly width: number; readonly height: number };
  /** Fraction of the frame at the object's world position. */
  readonly pivot: Vec;
  readonly collision: readonly (readonly Vec[])[];
  /** Bounding radius in frame pixels. */
  readonly radius: number;
  /** Optional spin range in degrees per second. */
  readonly spin?: readonly [number, number];
  /** Drift speed range in world units per second for eligible variants. */
  readonly drift: { readonly eligible: boolean; readonly speed: readonly [number, number] };
  readonly tint: string;
}
export interface AsteroidCatalog {
  readonly version: 1;
  readonly asteroids: readonly AsteroidEntry[];
}

type Fields = Record<string, unknown>;
const fields = (value: unknown): Fields | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : undefined;
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;
const pair = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  finite(value[0]) &&
  finite(value[1]) &&
  value[0] <= value[1];
const point = (value: unknown): Vec | undefined =>
  Array.isArray(value) && value.length === 2 && finite(value[0]) && finite(value[1])
    ? { x: value[0], y: value[1] }
    : undefined;
const size = (value: unknown) => {
  const entry = fields(value);
  return entry && positive(entry.width) && positive(entry.height)
    ? { height: entry.height, width: entry.width }
    : undefined;
};

/** Twice the signed area; nonzero and one sign on every corner means a strictly convex part. */
function convex(part: readonly Vec[]): boolean {
  if (part.length < 3) {
    return false;
  }
  let sign = 0;
  for (let index = 0; index < part.length; index++) {
    const a = part[index]!;
    const b = part[(index + 1) % part.length]!;
    const c = part[(index + 2) % part.length]!;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-9) {
      continue;
    }
    if (sign && Math.sign(cross) !== sign) {
      return false;
    }
    sign = Math.sign(cross);
  }
  return sign !== 0;
}

function readEntry(value: unknown): AsteroidEntry | undefined {
  const entry = fields(value);
  const frame = size(entry?.frame);
  const display = size(entry?.display);
  const pivot = point(entry?.pivot);
  const drift = fields(entry?.drift);
  if (
    !entry ||
    typeof entry.id !== "string" ||
    !entry.id ||
    !ASTEROID_SIZES.includes(entry.size as AsteroidSize) ||
    !frame ||
    !display ||
    !pivot ||
    !positive(entry.radius) ||
    typeof entry.tint !== "string" ||
    !entry.tint ||
    !drift ||
    typeof drift.eligible !== "boolean" ||
    !pair(drift.speed) ||
    drift.speed[0] < 0 ||
    (entry.spin !== undefined && !pair(entry.spin)) ||
    !Array.isArray(entry.collision) ||
    !entry.collision.length
  ) {
    return undefined;
  }
  const collision: Vec[][] = [];
  for (const part of entry.collision as unknown[]) {
    const points = Array.isArray(part) ? part.map(point) : [];
    if (!points.length || points.some((at) => !at) || !convex(points as Vec[])) {
      return undefined;
    }
    collision.push(points as Vec[]);
  }
  return {
    collision,
    display,
    drift: { eligible: drift.eligible, speed: [drift.speed[0], drift.speed[1]] },
    frame,
    id: entry.id,
    pivot,
    radius: entry.radius,
    size: entry.size as AsteroidSize,
    ...(entry.spin ? { spin: [entry.spin[0], entry.spin[1]] as const } : {}),
    tint: entry.tint,
  };
}

/** Validate Art's asteroid catalog; any malformed entry rejects the file. */
export function readAsteroidCatalog(value: unknown): AsteroidCatalog | undefined {
  const root = fields(value);
  if (!root || root.version !== 1 || !Array.isArray(root.asteroids) || !root.asteroids.length) {
    return undefined;
  }
  const asteroids: AsteroidEntry[] = [];
  const ids = new Set<string>();
  for (const value of root.asteroids as unknown[]) {
    const entry = readEntry(value);
    if (!entry || ids.has(entry.id)) {
      return undefined;
    }
    ids.add(entry.id);
    asteroids.push(entry);
  }
  return { asteroids, version: 1 };
}

// Placeholder variants until Art delivers public/art/asteroids.json. World bounding radii per
// size, variant counts, drift eligibility and speeds are provisional playtest values.
const PLACEHOLDER_SIZES: Readonly<
  Record<
    AsteroidSize,
    { radius: [number, number]; variants: number; lobes: number; drift: [number, number] | null }
  >
> = {
  huge: { drift: null, lobes: 2, radius: [84, 104], variants: 3 },
  large: { drift: null, lobes: 1, radius: [52, 70], variants: 3 },
  medium: { drift: [6, 14], lobes: 0, radius: [24, 34], variants: 4 },
  small: { drift: [10, 24], lobes: 0, radius: [12, 18], variants: 4 },
};
const PLACEHOLDER_TINTS = ["slate", "rust", "moss", "lilac"] as const;

function placeholderRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state ^ (state >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0;
    state ^= state >>> 12;
    return (state >>> 0) / 0x100000000;
  };
}

/** Convex hull, counterclockwise, of an irregular ring of points. */
function hull(points: Vec[]): Vec[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Vec, a: Vec, b: Vec) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Vec[] = [];
  for (const at of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, at) <= 0) {
      lower.pop();
    }
    lower.push(at);
  }
  const upper: Vec[] = [];
  for (const at of sorted.reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, at) <= 0) {
      upper.pop();
    }
    upper.push(at);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function blob(next: () => number, center: Vec, radius: number): Vec[] {
  const count = 7 + Math.floor(next() * 5);
  const start = next() * Math.PI * 2;
  const points: Vec[] = [];
  for (let index = 0; index < count; index++) {
    const angle = start + ((index + (next() - 0.5) * 0.6) / count) * Math.PI * 2;
    const reach = radius * (0.62 + next() * 0.38);
    points.push({ x: center.x + Math.cos(angle) * reach, y: center.y + Math.sin(angle) * reach });
  }
  return hull(points);
}

const project = (at: Vec): Vec => ({ x: at.x - at.y, y: (at.x + at.y) / 2 });

/** Seeded irregular placeholders in Art's frame format: convex parts, lobed for large sizes. */
export function placeholderAsteroids(seed: number): AsteroidCatalog {
  const next = placeholderRandom(seed);
  const asteroids: AsteroidEntry[] = [];
  for (const size of ASTEROID_SIZES) {
    const plan = PLACEHOLDER_SIZES[size];
    for (let variant = 0; variant < plan.variants; variant++) {
      const target = plan.radius[0] + next() * (plan.radius[1] - plan.radius[0]);
      // Lobes overlap the core so the union stays one irregular, concave mass.
      const parts = [blob(next, { x: 0, y: 0 }, 0.72)];
      for (let lobe = 0; lobe < plan.lobes; lobe++) {
        const angle = next() * Math.PI * 2;
        const offset = 0.42 + next() * 0.12;
        parts.push(
          blob(
            next,
            { x: Math.cos(angle) * offset, y: Math.sin(angle) * offset },
            0.38 + next() * 0.12,
          ),
        );
      }
      const reach = Math.max(...parts.flat().map((at) => Math.hypot(at.x, at.y)));
      const world = parts.map((part) =>
        part.map((at) => ({ x: (at.x / reach) * target, y: (at.y / reach) * target })),
      );
      // Projection preserves convexity; frame pixels are the projected sprite at scale one.
      const screen = world.map((part) => part.map(project));
      const xs = screen.flat().map((at) => at.x);
      const ys = screen.flat().map((at) => at.y);
      const margin = 2;
      const left = Math.min(...xs) - margin;
      const top = Math.min(...ys) - margin;
      const width = Math.ceil(Math.max(...xs) - left + margin);
      const height = Math.ceil(Math.max(...ys) - top + margin);
      asteroids.push({
        collision: screen.map((part) => part.map((at) => ({ x: at.x - left, y: at.y - top }))),
        display: { height, width },
        drift: plan.drift
          ? { eligible: true, speed: plan.drift }
          : { eligible: false, speed: [0, 0] },
        frame: { height, width },
        id: `placeholder-${size}-${variant}`,
        pivot: { x: -left / width, y: -top / height },
        radius: Math.max(...screen.flat().map((at) => Math.hypot(at.x, at.y))),
        size,
        tint: PLACEHOLDER_TINTS[(asteroids.length + variant) % PLACEHOLDER_TINTS.length]!,
      });
    }
  }
  return { asteroids, version: 1 };
}

/** The runtime catalog: placeholders now, Art's file once delivered. */
export const ASTEROID_CATALOG: AsteroidCatalog = placeholderAsteroids(0x5eed);
