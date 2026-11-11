import type { Vec } from "../model/types.ts";

export const ASTEROID_SIZES = ["small", "medium", "large", "huge"] as const;
export type AsteroidSize = (typeof ASTEROID_SIZES)[number];

interface Size2 {
  readonly width: number;
  readonly height: number;
}

/** One drawn frame of an Art asteroid: its SVG and its silhouette as convex parts in frame px. */
export interface AsteroidArtFrame {
  readonly file: string;
  readonly collision: readonly (readonly Vec[])[];
}
/**
 * One asteroid in Art's `asteroids.json` version 1 (art/asteroids.md "Data"). Frame values are
 * frame px in the art's projection; `display` is `frame * displayScale`. Spinning rocks carry 24
 * frames, still ones one.
 */
export interface AsteroidArt {
  readonly id: string;
  readonly size: AsteroidSize;
  readonly frame: Size2;
  readonly display: Size2;
  /** Fraction of the frame at the rock's base centre: its world position and sort point. */
  readonly pivot: Vec;
  /** Frame px from the pivot to the farthest outline point over all frames. */
  readonly radius: number;
  /** Drift speed range in logical px per second for eligible rocks. */
  readonly drift: { readonly eligible: boolean; readonly speed: readonly [number, number] };
  /** Spin range in degrees per second, or false for one still frame. */
  readonly spin: { readonly degPerSecond: readonly [number, number] } | false;
  readonly frames: readonly AsteroidArtFrame[];
}
/** A greyscale backdrop rock, multiplied at runtime by the galaxy's `backdropLit`. */
export interface BackdropSprite {
  readonly id: string;
  readonly file: string;
  readonly frame: Size2;
  readonly display: Size2;
  readonly pivot: Vec;
}
export interface BackdropTint {
  readonly backdropLit: string;
  readonly backdropSide: string;
}
export interface AsteroidArtCatalog {
  readonly version: 1;
  readonly displayScale: number;
  /** The play stone ramp, lit to shadow. */
  readonly stone: readonly string[];
  readonly asteroids: readonly AsteroidArt[];
  readonly backdrop: {
    readonly sideScale: number;
    readonly rule: { readonly lift: number; readonly chromaScale: number };
    readonly sprites: readonly BackdropSprite[];
  };
  /** Backdrop colours for `base` and each galaxy id. */
  readonly tints: Readonly<Record<string, BackdropTint>>;
}

type Fields = Record<string, unknown>;
const fields = (value: unknown): Fields | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : undefined;
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;
const text = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const hex = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/iu.test(value);
const pair = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  finite(value[0]) &&
  finite(value[1]) &&
  value[0] >= 0 &&
  value[0] <= value[1];
const point = (value: unknown): Vec | undefined =>
  Array.isArray(value) && value.length === 2 && finite(value[0]) && finite(value[1])
    ? { x: value[0], y: value[1] }
    : undefined;
const size = (value: unknown): Size2 | undefined => {
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

function readParts(value: unknown): Vec[][] | undefined {
  if (!Array.isArray(value) || !value.length) {
    return undefined;
  }
  const parts: Vec[][] = [];
  for (const part of value as unknown[]) {
    const points = Array.isArray(part) ? part.map(point) : [];
    if (!points.length || points.some((at) => !at) || !convex(points as Vec[])) {
      return undefined;
    }
    parts.push(points as Vec[]);
  }
  return parts;
}

function readFrame(value: unknown): AsteroidArtFrame | undefined {
  const entry = fields(value);
  const collision = readParts(entry?.collision);
  return entry && text(entry.file) && entry.file.startsWith("/") && collision
    ? { collision, file: entry.file }
    : undefined;
}

function readAsteroid(value: unknown): AsteroidArt | undefined {
  const entry = fields(value);
  const frame = size(entry?.frame);
  const display = size(entry?.display);
  const pivot = point(entry?.pivot);
  const drift = fields(entry?.drift);
  const spin = entry?.spin === false ? false : fields(entry?.spin);
  const frames = Array.isArray(entry?.frames) ? entry.frames.map(readFrame) : [];
  if (
    !entry ||
    !text(entry.id) ||
    !ASTEROID_SIZES.includes(entry.size as AsteroidSize) ||
    !frame ||
    !display ||
    !pivot ||
    !positive(entry.radius) ||
    !drift ||
    typeof drift.eligible !== "boolean" ||
    !pair(drift.speed) ||
    spin === undefined ||
    (spin && !pair(spin.degPerSecond)) ||
    !frames.length ||
    frames.some((at) => !at) ||
    // A still rock has one frame; a spinning one turns through several.
    (spin === false) !== (frames.length === 1)
  ) {
    return undefined;
  }
  return {
    display,
    drift: { eligible: drift.eligible, speed: [drift.speed[0], drift.speed[1]] },
    frame,
    frames: frames as AsteroidArtFrame[],
    id: entry.id,
    pivot,
    radius: entry.radius,
    size: entry.size as AsteroidSize,
    spin: spin
      ? { degPerSecond: [(spin.degPerSecond as number[])[0]!, (spin.degPerSecond as number[])[1]!] }
      : false,
  };
}

function readBackdropSprite(value: unknown): BackdropSprite | undefined {
  const entry = fields(value);
  const frame = size(entry?.frame);
  const display = size(entry?.display);
  const pivot = point(entry?.pivot);
  return entry &&
    text(entry.id) &&
    text(entry.file) &&
    entry.file.startsWith("/") &&
    frame &&
    display &&
    pivot &&
    entry.tint === "backdropLit"
    ? { display, file: entry.file, frame, id: entry.id, pivot }
    : undefined;
}

function readTints(value: unknown): Record<string, BackdropTint> | undefined {
  const entries = fields(value);
  if (!entries || !fields(entries.base)) {
    return undefined;
  }
  const tints: Record<string, BackdropTint> = {};
  for (const [id, tint] of Object.entries(entries)) {
    const colors = fields(tint);
    if (!colors || !hex(colors.backdropLit) || !hex(colors.backdropSide)) {
      return undefined;
    }
    tints[id] = { backdropLit: colors.backdropLit, backdropSide: colors.backdropSide };
  }
  return tints;
}

/** Validate Art's asteroid catalog, version 1; any malformed part rejects the file. */
export function readAsteroidCatalog(value: unknown): AsteroidArtCatalog | undefined {
  const root = fields(value);
  const backdrop = fields(root?.backdrop);
  const rule = fields(backdrop?.rule);
  const tints = readTints(root?.tints);
  if (
    !root ||
    root.version !== 1 ||
    !positive(root.displayScale) ||
    !Array.isArray(root.stone) ||
    !root.stone.length ||
    !root.stone.every(hex) ||
    !Array.isArray(root.asteroids) ||
    !root.asteroids.length ||
    !backdrop ||
    !positive(backdrop.sideScale) ||
    !rule ||
    !finite(rule.lift) ||
    !positive(rule.chromaScale) ||
    !Array.isArray(backdrop.sprites) ||
    !backdrop.sprites.length ||
    !tints
  ) {
    return undefined;
  }
  const asteroids: AsteroidArt[] = [];
  const ids = new Set<string>();
  for (const value of root.asteroids as unknown[]) {
    const entry = readAsteroid(value);
    if (!entry || ids.has(entry.id)) {
      return undefined;
    }
    ids.add(entry.id);
    asteroids.push(entry);
  }
  const sprites: BackdropSprite[] = [];
  for (const value of backdrop.sprites as unknown[]) {
    const sprite = readBackdropSprite(value);
    if (!sprite) {
      return undefined;
    }
    sprites.push(sprite);
  }
  return {
    asteroids,
    backdrop: {
      rule: { chromaScale: rule.chromaScale, lift: rule.lift },
      sideScale: backdrop.sideScale,
      sprites,
    },
    displayScale: root.displayScale,
    stone: [...(root.stone as string[])],
    tints,
    version: 1,
  };
}

/**
 * The model's collision footprint of one asteroid variant, in a projected frame like Art's:
 * convex parts whose union is the rock's base on the world plane. Collision and placement read
 * these, so gameplay keeps its sizes while the view draws Art's taller rocks over them.
 */
export interface AsteroidFootprint {
  readonly id: string;
  readonly size: AsteroidSize;
  readonly frame: Size2;
  readonly display: Size2;
  /** Fraction of the frame at the object's world position. */
  readonly pivot: Vec;
  readonly collision: readonly (readonly Vec[])[];
  /** Bounding radius in frame pixels. */
  readonly radius: number;
  /** Drift speed range in world units per second for eligible variants. */
  readonly drift: { readonly eligible: boolean; readonly speed: readonly [number, number] };
  /** Outline tint for the drawing fallback when Art's sprites are unavailable. */
  readonly tint: string;
}
export interface AsteroidFootprints {
  readonly asteroids: readonly AsteroidFootprint[];
}

// The model's footprints: seeded irregular bases. World bounding radii per size, variant counts,
// drift eligibility and speeds are provisional playtest values.
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

/** Seeded irregular footprints in a projected frame: convex parts, lobed for large sizes. */
export function footprintAsteroids(seed: number): AsteroidFootprints {
  const next = placeholderRandom(seed);
  const asteroids: AsteroidFootprint[] = [];
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
  return { asteroids };
}

/** The model's footprints, one per Art variant of each size. */
export const ASTEROID_FOOTPRINTS: AsteroidFootprints = footprintAsteroids(0x5eed);
