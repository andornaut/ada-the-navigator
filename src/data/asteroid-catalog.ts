import ART_FILE from "../../public/art/asteroids.json" with { type: "json" };
import RESOURCE_FILE from "../../public/art/resource-rocks.json" with { type: "json" };
import type { Vec } from "../model/types.ts";

export const ASTEROID_SIZES = ["small", "medium", "large", "huge"] as const;
export type AsteroidSize = (typeof ASTEROID_SIZES)[number];

interface Size2 {
  readonly width: number;
  readonly height: number;
}

/**
 * One frame of an Art asteroid: its SVG, its drawn silhouette as convex parts in frame px (for
 * shot hits, drawing bounds and the drift cue), and its footprint, the rock's base on the world
 * plane, as convex parts in world units from the pivot (for ship contact and placement).
 */
export interface AsteroidArtFrame {
  readonly file: string;
  readonly collision: readonly (readonly Vec[])[];
  readonly footprint: readonly (readonly Vec[])[];
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
  /** World units from the pivot to the farthest footprint point over all frames. */
  readonly footprintRadius: number;
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
  const footprint = readParts(entry?.footprint);
  return entry && text(entry.file) && entry.file.startsWith("/") && collision && footprint
    ? { collision, file: entry.file, footprint }
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
    !positive(entry.footprintRadius) ||
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
    footprintRadius: entry.footprintRadius,
    frame,
    frames: frames as AsteroidArtFrame[],
    id: entry.id,
    pivot,
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

/** Art's resource rocks (`resource-rocks.json`, art/asteroids.md "Resource rocks"). */
export interface ResourceRockCatalog {
  readonly displayScale: number;
  readonly rocks: readonly AsteroidArt[];
}

/** The resource rocks in the asteroid schema, or undefined to keep their placeholders. */
export function readResourceRocks(value: unknown): ResourceRockCatalog | undefined {
  const root = fields(value);
  if (
    !root ||
    root.version !== 1 ||
    !positive(root.displayScale) ||
    !Array.isArray(root.rocks) ||
    !root.rocks.length
  ) {
    return undefined;
  }
  const rocks: AsteroidArt[] = [];
  for (const value of root.rocks as unknown[]) {
    const entry = readAsteroid(value);
    if (!entry || rocks.some((rock) => rock.id === entry.id)) {
      return undefined;
    }
    rocks.push(entry);
  }
  return { displayScale: root.displayScale, rocks };
}

function required(catalog: AsteroidArtCatalog | undefined): AsteroidArtCatalog {
  if (!catalog) {
    throw new Error("public/art/asteroids.json does not read as Art's version 1 catalog");
  }
  return catalog;
}

/** Art's rocks and backdrop: collision, placement and drawing all read it. */
export const ASTEROID_ART: AsteroidArtCatalog = required(readAsteroidCatalog(ART_FILE));

/** Art's resource rocks, or undefined when the file does not read; shots read their silhouettes. */
export const RESOURCE_ART: ResourceRockCatalog | undefined = readResourceRocks(RESOURCE_FILE);

/**
 * CLEANUP (added 2026-11-11): saves from before Art's footprints name the former seeded
 * placeholder variants; each maps to the Art rock it was drawn as. Remove once every saved
 * flight has been reopened on this version.
 */
export const LEGACY_ASTEROIDS: Readonly<Record<string, string>> = {
  "placeholder-huge-0": "asteroid-h1",
  "placeholder-huge-1": "asteroid-h2",
  "placeholder-huge-2": "asteroid-h3",
  "placeholder-large-0": "asteroid-l3",
  "placeholder-large-1": "asteroid-l2",
  "placeholder-large-2": "asteroid-l1",
  "placeholder-medium-0": "asteroid-m1",
  "placeholder-medium-1": "asteroid-m2",
  "placeholder-medium-2": "asteroid-m3",
  "placeholder-medium-3": "asteroid-m4",
  "placeholder-small-0": "asteroid-s2",
  "placeholder-small-1": "asteroid-s4",
  "placeholder-small-2": "asteroid-s1",
  "placeholder-small-3": "asteroid-s3",
};
