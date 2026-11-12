import { GALAXY_ID } from "../data/galaxies.ts";
import type { SectorId } from "../data/types.ts";
import type { Vec } from "../model/types.ts";
import { loopFrame } from "./world-art.ts";

// The station jobs' art in flight (art/jobs.md), from public/art/jobs.json and the core manifest's
// landmark-* and hunt-glint entries: the three landmark kinds, a hunt's search area rim and its
// lost item's glint with its ping.

export interface JobFrame {
  readonly displayHeight?: number;
  readonly displayWidth?: number;
  readonly frames?: Readonly<Record<string, number>>;
  readonly id: string;
  readonly loop?: readonly { readonly frame: number; readonly ms: number }[];
  readonly pivot: Vec;
}

/** One layer of a landmark: its frame, the jobs.json tint it takes, and its keyline kind. */
export interface LandmarkLayer<T extends JobFrame = JobFrame> {
  readonly frame: T;
  readonly keyline?: string;
  readonly tint?: "nebulaCore" | "nebulaOuter";
}

export interface JobArt<T extends JobFrame = JobFrame> {
  readonly beacon?: {
    readonly frameMs: number;
    readonly frames: readonly [T, T];
    readonly keyline?: string;
    /** The frame reduced motion holds, 0 or 1. */
    readonly reducedFrame: 0 | 1;
  };
  readonly glint?: {
    readonly asset: T;
    readonly keyline?: string;
    readonly loop: readonly { readonly frame: number; readonly ms: number }[];
    readonly loopMs: number;
    readonly ping: {
      readonly alpha: readonly [number, number];
      readonly aspect: number;
      readonly from: number;
      readonly lightInk: number;
      readonly ms: number;
      readonly to: number;
      readonly width: number;
    };
    /** The frame reduced motion holds. */
    readonly rest: number;
  };
  readonly mapArea?: MapArea;
  readonly nebula?: readonly LandmarkLayer<T>[];
  readonly searchArea?: {
    readonly alpha: number;
    readonly dash: readonly [number, number];
    readonly lightInk: { readonly alpha: number; readonly width: number };
    readonly width: number;
  };
  /** Each galaxy's nebula tints, by stable galaxy id, with `base` for the rest. */
  readonly tints: Readonly<
    Record<string, { readonly nebulaCore: number; readonly nebulaOuter: number }>
  >;
  readonly wreck?: readonly LandmarkLayer<T>[];
}

/** The Map's search area (art/map.md "Search area"). */
export interface MapArea {
  readonly colour: string;
  readonly dash: readonly [number, number];
  readonly ink: number;
  readonly minRadius: number;
  readonly width: number;
}

type Fields = Record<string, unknown>;

const fields = (value: unknown): Fields | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : undefined;
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;
const hex = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
const dashPair = (value: unknown): value is [number, number] =>
  Array.isArray(value) && value.length === 2 && value.every(positive);

function frameOf<T extends JobFrame>(assets: readonly T[], id: unknown): T | undefined {
  const asset = assets.find((entry) => entry.id === id);
  return asset && positive(asset.displayWidth) && positive(asset.displayHeight) ? asset : undefined;
}

function readLayers<T extends JobFrame>(
  assets: readonly T[],
  value: unknown,
): LandmarkLayer<T>[] | undefined {
  const layers = fields(value)?.layers;
  if (!Array.isArray(layers) || layers.length === 0) {
    return undefined;
  }
  const read = layers.map((entry) => {
    const layer = fields(entry);
    const frame = frameOf(assets, layer?.id);
    const tint = layer?.tint;
    if (!frame || (tint !== undefined && tint !== "nebulaCore" && tint !== "nebulaOuter")) {
      return undefined;
    }
    return {
      frame,
      ...(typeof layer!.keyline === "string" ? { keyline: layer!.keyline } : {}),
      ...(tint ? { tint } : {}),
    } as LandmarkLayer<T>;
  });
  return read.every((layer) => layer !== undefined) ? read : undefined;
}

function readBeacon<T extends JobFrame>(assets: readonly T[], value: unknown): JobArt<T>["beacon"] {
  const beacon = fields(value);
  const ids = beacon?.frames;
  if (!Array.isArray(ids) || ids.length !== 2 || !positive(beacon!.frameMs)) {
    return undefined;
  }
  const a = frameOf(assets, ids[0]);
  const b = frameOf(assets, ids[1]);
  const held = ids.indexOf(beacon!.reducedMotion);
  if (!a || !b || (held !== 0 && held !== 1)) {
    return undefined;
  }
  return {
    frameMs: beacon!.frameMs,
    frames: [a, b],
    reducedFrame: held,
    ...(typeof beacon!.keyline === "string" ? { keyline: beacon!.keyline } : {}),
  };
}

function readGlint<T extends JobFrame>(assets: readonly T[], value: unknown): JobArt<T>["glint"] {
  const glint = fields(value);
  const ping = fields(glint?.ping);
  const asset = frameOf(assets, glint?.id);
  const loop = asset?.loop ?? [];
  const loopMs = loop.reduce((sum, step) => sum + step.ms, 0);
  const rest = asset?.frames?.[String(glint?.reducedMotion)];
  const alpha = ping?.alpha;
  if (
    !asset ||
    !(loopMs > 0) ||
    !finite(rest) ||
    !ping ||
    !positive(ping.from) ||
    !positive(ping.to) ||
    !positive(ping.ms) ||
    !positive(ping.width) ||
    !positive(ping.lightInk) ||
    !positive(ping.aspect) ||
    !Array.isArray(alpha) ||
    alpha.length !== 2 ||
    !alpha.every(finite)
  ) {
    return undefined;
  }
  return {
    asset,
    loop,
    loopMs,
    ping: {
      alpha: [alpha[0] as number, alpha[1] as number],
      aspect: ping.aspect,
      from: ping.from,
      lightInk: ping.lightInk,
      ms: ping.ms,
      to: ping.to,
      width: ping.width,
    },
    rest,
    ...(typeof glint!.keyline === "string" ? { keyline: glint!.keyline } : {}),
  };
}

/** The Map's search area tokens from jobs.json, or undefined if malformed. */
export function readMapArea(value: unknown): MapArea | undefined {
  const area = fields(fields(value)?.mapArea);
  return area &&
    hex(area.colour) &&
    positive(area.width) &&
    positive(area.ink) &&
    dashPair(area.dash) &&
    positive(area.minRadius)
    ? {
        colour: area.colour,
        dash: [area.dash[0], area.dash[1]],
        ink: area.ink,
        minRadius: area.minRadius,
        width: area.width,
      }
    : undefined;
}

/**
 * jobs.json, version 1, with the frames the loaded assets hold. A malformed part has no art and
 * keeps its placeholder; a malformed file has none at all.
 */
export function readJobArt<T extends JobFrame>(
  assets: readonly T[],
  value: unknown,
): JobArt<T> | undefined {
  const file = fields(value);
  const landmarks = fields(file?.landmarks);
  const tintTable = fields(file?.tints);
  if (file?.version !== 1 || !landmarks || !tintTable) {
    return undefined;
  }
  const tints: Record<string, { nebulaCore: number; nebulaOuter: number }> = {};
  for (const [galaxy, entry] of Object.entries(tintTable)) {
    const tint = fields(entry);
    if (hex(tint?.nebulaCore) && hex(tint?.nebulaOuter)) {
      tints[galaxy] = {
        nebulaCore: Number.parseInt(tint.nebulaCore.slice(1), 16),
        nebulaOuter: Number.parseInt(tint.nebulaOuter.slice(1), 16),
      };
    }
  }
  if (!tints.base) {
    return undefined;
  }
  const area = fields(file.searchArea);
  const ink = fields(area?.lightInk);
  const searchArea =
    area &&
    positive(area.width) &&
    finite(area.alpha) &&
    dashPair(area.dash) &&
    positive(ink?.width) &&
    finite(ink.alpha)
      ? {
          alpha: area.alpha,
          dash: [area.dash[0], area.dash[1]] as const,
          lightInk: { alpha: ink.alpha, width: ink.width },
          width: area.width,
        }
      : undefined;
  const nebula = readLayers(assets, landmarks.nebula);
  const wreck = readLayers(assets, landmarks.wreck);
  const beacon = readBeacon(assets, landmarks.beacon);
  const glint = readGlint(assets, file.glint);
  const mapArea = readMapArea(file);
  return {
    tints,
    ...(nebula ? { nebula } : {}),
    ...(wreck ? { wreck } : {}),
    ...(beacon ? { beacon } : {}),
    ...(glint ? { glint } : {}),
    ...(searchArea ? { searchArea } : {}),
    ...(mapArea ? { mapArea } : {}),
  };
}

/** A galaxy's nebula tint, or the base one. */
export function nebulaTint(
  art: Pick<JobArt, "tints">,
  sector: SectorId,
  tint: "nebulaCore" | "nebulaOuter",
): number {
  return (art.tints[GALAXY_ID[sector]] ?? art.tints.base!)[tint];
}

/** The beacon's frame at timeMs: A then B, each frameMs; reduced motion holds its frame. */
export function beaconLandmarkFrame(
  beacon: NonNullable<JobArt["beacon"]>,
  reducedMotion: boolean,
  timeMs: number,
): 0 | 1 {
  return reducedMotion
    ? beacon.reducedFrame
    : Math.floor(timeMs / beacon.frameMs) % 2 === 0
      ? 0
      : 1;
}

/** The glint's sheet frame at timeMs, from its loop; reduced motion holds rest. */
export function glintFrame(
  glint: NonNullable<JobArt["glint"]>,
  reducedMotion: boolean,
  timeMs: number,
): number {
  return reducedMotion ? glint.rest : loopFrame(glint, 0, timeMs);
}

/**
 * The glint's ping at timeMs: a ring growing across from `from` to `to` px over `ms`, `aspect`
 * as tall as wide, its alpha easing linearly between the pair; none under reduced motion.
 */
export function glintPing(
  glint: NonNullable<JobArt["glint"]>,
  reducedMotion: boolean,
  timeMs: number,
): { alpha: number; height: number; width: number } | null {
  if (reducedMotion) {
    return null;
  }
  const { alpha, aspect, from, ms, to } = glint.ping;
  const t = (((timeMs % ms) + ms) % ms) / ms;
  const width = from + (to - from) * t;
  return { alpha: alpha[0] + (alpha[1] - alpha[0]) * t, height: width * aspect, width };
}

/**
 * A closed path cut into dashes `on` long and `off` apart along its length, as the runs of points
 * each dash covers (Phaser's Graphics draws no dashes of its own).
 */
export function dashes(points: readonly Vec[], [on, off]: readonly [number, number]): Vec[][] {
  const runs: Vec[][] = [];
  const period = on + off;
  let travelled = 0;
  let run: Vec[] | null = null;
  for (let index = 0; index < points.length; index++) {
    const a = points[index]!;
    const b = points[(index + 1) % points.length]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    let at = 0;
    while (at < length) {
      const phase = travelled % period;
      const drawing = phase < on;
      const step = Math.min(length - at, drawing ? on - phase : period - phase);
      const from = { x: a.x + ((b.x - a.x) * at) / length, y: a.y + ((b.y - a.y) * at) / length };
      const to = {
        x: a.x + ((b.x - a.x) * (at + step)) / length,
        y: a.y + ((b.y - a.y) * (at + step)) / length,
      };
      if (drawing) {
        if (!run) {
          run = [from];
          runs.push(run);
        }
        run.push(to);
      } else {
        run = null;
      }
      at += step;
      travelled += step;
    }
  }
  return runs;
}
