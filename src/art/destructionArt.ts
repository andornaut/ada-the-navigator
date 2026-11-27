// Enemy destruction rendered from Art's data (art/destruction.md): shards that drift, spin,
// shrink, cool toward their family's own tone and fade in held steps behind a brief flash;
// under reduced motion the idle frame tints, shrinks and fades instead.

import { ENEMY_HEADINGS } from "./enemyArt.ts";

export interface DestructionTiming {
  readonly durationMs: number;
  readonly flashWidth: number;
  readonly reduced: { readonly durationMs: number; readonly releaseMs: number };
  readonly releaseMs: number;
}

/** The enemy paint families, each with its own shard cool target. */
export type ShardFamily = "claim" | "coral" | "garnet" | "needle";

export interface DestructionData {
  readonly archetypes: Readonly<Record<string, DestructionTiming>>;
  readonly flash: {
    readonly height: number;
    readonly path: string;
    readonly phases: readonly {
      readonly alpha: number;
      readonly fromMs: number;
      readonly scale: number;
      readonly toMs: number;
    }[];
    readonly width: number;
  };
  readonly pickups: { readonly settleMs: number };
  readonly reduced: { readonly shrink: number; readonly tint: string };
  readonly shards: {
    readonly cool: {
      readonly amount: number;
      readonly families: Readonly<Record<ShardFamily, string>>;
    };
    readonly ease: number;
    /** Held alpha steps in ascending `from`: each holds from its `u` until the next. */
    readonly fade: { readonly steps: readonly { readonly alpha: number; readonly from: number }[] };
    readonly fleckFadeEnd: number;
    readonly shrink: number;
  };
}

export interface ShardData {
  readonly headings: readonly {
    readonly shards: readonly {
      readonly centroid: readonly [number, number];
      readonly drift: readonly [number, number];
      readonly nearness: number;
      readonly nearnessDrift: number;
      readonly polygons: readonly { readonly color: string; readonly points: readonly number[] }[];
      readonly shard: number;
    }[];
  }[];
  readonly shards: readonly { readonly kind: "fleck" | "hull" | "part"; readonly spin: number }[];
}

export interface ShardPolygon {
  readonly alpha: number;
  readonly color: number;
  /** Flat frame-px points [x0, y0, x1, y1, ...] in the archetype's frame. */
  readonly points: readonly number[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const FAMILIES: readonly ShardFamily[] = ["claim", "coral", "garnet", "needle"];

function shardLook(value: unknown): boolean {
  if (!record(value) || !record(value.cool) || !record(value.fade)) {
    return false;
  }
  const { families } = value.cool;
  const { steps } = value.fade;
  return (
    typeof value.cool.amount === "number" &&
    record(families) &&
    FAMILIES.every((family) => typeof families[family] === "string") &&
    Array.isArray(steps) &&
    steps.length > 0 &&
    steps.every(
      (step, index) =>
        record(step) &&
        typeof step.alpha === "number" &&
        typeof step.from === "number" &&
        (index === 0 ? step.from === 0 : step.from > (steps[index - 1] as { from: number }).from),
    )
  );
}

/** Art's destruction.json, version 1, or undefined to keep the placeholder. */
export function readDestruction(value: unknown): DestructionData | undefined {
  return record(value) &&
    value.version === 1 &&
    record(value.archetypes) &&
    shardLook(value.shards) &&
    record(value.flash) &&
    record(value.reduced)
    ? (value as unknown as DestructionData)
    : undefined;
}

/** A paint family's shard cool target key: coral for an unknown or absent family. */
export function shardFamily(family: string | undefined): ShardFamily {
  return FAMILIES.find((entry) => entry === family) ?? "coral";
}

/** A hull or part shard's alpha at `u`: the last step at or before it, gone at the end. */
export function shardAlpha(data: DestructionData, u: number): number {
  if (u >= 1) {
    return 0;
  }
  let alpha = 1;
  for (const step of data.shards.fade.steps) {
    if (u >= step.from) {
      alpha = step.alpha;
    }
  }
  return alpha;
}

/** An enemy archetype's shard file, version 1, with all sixteen enemy headings. */
export function readShards(value: unknown): ShardData | undefined {
  return record(value) &&
    value.version === 1 &&
    Array.isArray(value.headings) &&
    value.headings.length === ENEMY_HEADINGS &&
    Array.isArray(value.shards)
    ? (value as unknown as ShardData)
    : undefined;
}

export function hexColor(hex: string): number {
  return Number.parseInt(hex.replace("#", ""), 16);
}

/** Linear sRGB blend from `from` toward `to` by `amount`. */
export function mixColor(from: number, to: number, amount: number): number {
  const channel = (shift: number) => {
    const a = (from >> shift) & 255;
    const b = (to >> shift) & 255;
    return Math.round(a + (b - a) * amount) << shift;
  };
  return channel(16) | channel(8) | channel(0);
}

/**
 * The shards of heading `heading` at `timeMs` into a `durationMs` destruction, in draw
 * order (ascending nearness), cooling toward `family`'s own tone.
 */
export function shardPolygons(
  data: DestructionData,
  family: ShardFamily,
  shards: ShardData,
  durationMs: number,
  heading: number,
  timeMs: number,
): ShardPolygon[] {
  const u = Math.min(1, Math.max(0, timeMs / durationMs));
  const e = 1 - (1 - u) ** data.shards.ease;
  const shrink = 1 - (1 - data.shards.shrink) * u;
  const cool = hexColor(data.shards.cool.families[family]);
  const held = shardAlpha(data, u);
  const view = shards.headings[heading] ?? shards.headings[0];
  return (view?.shards ?? [])
    .map((entry) => ({ entry, order: entry.nearness + entry.nearnessDrift * e }))
    .sort((a, b) => a.order - b.order)
    .flatMap(({ entry }) => {
      const table = shards.shards[entry.shard];
      const kind = table?.kind ?? "hull";
      const angle = (table?.spin ?? 0) * e;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const [cx, cy] = entry.centroid;
      const alpha = kind === "fleck" ? Math.max(0, 1 - u / data.shards.fleckFadeEnd) : held;
      return entry.polygons.map((polygon) => {
        const points: number[] = [];
        for (let index = 0; index + 1 < polygon.points.length; index += 2) {
          const dx = (polygon.points[index]! - cx) * shrink;
          const dy = (polygon.points[index + 1]! - cy) * shrink;
          // A plan rotation seen through the 2:1 projection.
          points.push(
            cx + cos * dx - Math.sqrt(3) * sin * dy + entry.drift[0] * e,
            cy + (sin / Math.sqrt(3)) * dx + cos * dy + entry.drift[1] * e,
          );
        }
        return {
          alpha,
          color: mixColor(hexColor(polygon.color), cool, data.shards.cool.amount * u),
          points,
        };
      });
    });
}

/** The flash over the shards: width in frame px and alpha, or null once it has gone. */
export function flashAt(
  data: DestructionData,
  timing: DestructionTiming,
  timeMs: number,
): { alpha: number; width: number } | null {
  const phase = data.flash.phases.find((entry) => timeMs >= entry.fromMs && timeMs < entry.toMs);
  return phase ? { alpha: phase.alpha, width: timing.flashWidth * phase.scale } : null;
}

/** A wreck's destruction flash is independent of the weapon that destroyed it. */
export function wreckFlashAt(
  data: DestructionData,
  timing: DestructionTiming,
  wreck: { readonly age: number; readonly blasted?: boolean },
): { alpha: number; width: number } | null {
  return flashAt(data, timing, wreck.age * 1000);
}

/**
 * Reduced motion: the idle frame shrinks about its pivot to 80%, darkens by a multiply tint
 * toward #c1b9b8 and fades out linearly over the reduced duration; null once it has gone.
 */
export function reducedAt(
  data: DestructionData,
  timing: DestructionTiming,
  timeMs: number,
): { alpha: number; scale: number; tint: number } | null {
  const u = timeMs / timing.reduced.durationMs;
  if (u >= 1) {
    return null;
  }
  const v = Math.max(0, u);
  return {
    alpha: 1 - v,
    scale: 1 - (1 - data.reduced.shrink) * v,
    tint: mixColor(0xffffff, hexColor(data.reduced.tint), v),
  };
}
