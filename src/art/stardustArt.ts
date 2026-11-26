import STARDUST from "../../public/art/stardust.json" with { type: "json" };
import type { Vec } from "../model/types.ts";
import { loopFrame, loopPhase } from "./worldArt.ts";

// Art's Stardust pickup (art/stardust.md): a 9x9 gem whose glint loops from a per-pickup phase,
// trailing two flat wedges while Ada's tractor beam pulls it.

export interface StardustAsset {
  readonly displayHeight?: number;
  readonly displayWidth?: number;
  readonly frames?: Readonly<Record<string, number>>;
  readonly id: string;
  readonly loop?: readonly { readonly frame: number; readonly ms: number }[];
  readonly pivot: Vec;
}

export interface StardustArt<T extends StardustAsset = StardustAsset> {
  readonly asset: T;
  readonly loop: readonly { readonly frame: number; readonly ms: number }[];
  readonly loopMs: number;
  readonly rest: number;
}

export function readStardustArt<T extends StardustAsset>(
  assets: readonly T[],
): StardustArt<T> | undefined {
  const asset = assets.find((entry) => entry.id === "stardust");
  const loop = asset?.loop ?? [];
  const loopMs = loop.reduce((sum, step) => sum + step.ms, 0);
  if (!asset || !(loopMs > 0) || !(asset.displayWidth! > 0)) {
    return undefined;
  }
  return { asset, loop, loopMs, rest: asset.frames?.rest ?? 0 };
}

/** A stable start phase per pickup, so a cluster twinkles out of step. */
export const stardustPhase = loopPhase;

/** The sheet frame at timeMs: the glint loop from the pickup's phase; rest only when reduced. */
export function stardustFrame(
  art: StardustArt,
  reducedMotion: boolean,
  phaseMs: number,
  timeMs: number,
): number {
  return reducedMotion ? art.rest : loopFrame(art, phaseMs, timeMs);
}

/** Whether a pickup draws yet: a released one appears from its release time. */
export function stardustShown(
  release: { readonly at: number } | undefined,
  seconds: number,
): boolean {
  return !release || seconds >= release.at;
}

/** A released pickup's share of the way from its wreck, settling over 110 ms. */
export function releaseSettle(settleMs: number, ageMs: number): number {
  return ageMs <= 0 ? 0 : 1 - Math.exp(-ageMs / settleMs);
}

/**
 * Where a pickup draws: a released one bursts out from its wreck and settles; under reduced
 * motion it appears in place, with no burst or spread motion.
 */
export function stardustDrawn(
  settleMs: number,
  reducedMotion: boolean,
  from: Vec | undefined,
  ageMs: number,
  point: Vec,
): Vec {
  if (!from || reducedMotion) {
    return point;
  }
  const settle = releaseSettle(settleMs, ageMs);
  return { x: from.x + (point.x - from.x) * settle, y: from.y + (point.y - from.y) * settle };
}

export interface PullStreak {
  /** Whether the streak draws under reduced motion. */
  readonly reducedMotion: boolean;
  /** Opaque wedges in draw order, each point [u, v] in logical px from the pickup's centre. */
  readonly wedges: readonly {
    readonly color: string;
    /** Whether the wedge takes the ink keyline on a light field. */
    readonly keyline: boolean;
    readonly points: readonly (readonly [number, number])[];
  }[];
}

type Fields = Record<string, unknown>;
const fields = (value: unknown): Fields | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : undefined;
const point = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((entry) => typeof entry === "number" && Number.isFinite(entry));

/** Art's pull streak (`stardust.json` `pullStreak`), or undefined to draw none. */
export function readPullStreak(value: unknown): PullStreak | undefined {
  const streak = fields(fields(value)?.pullStreak);
  const wedges = streak?.wedges;
  if (
    !streak ||
    typeof streak.reducedMotion !== "boolean" ||
    !Array.isArray(wedges) ||
    wedges.length === 0 ||
    !wedges.every((wedge) => {
      const entry = fields(wedge);
      return (
        typeof entry?.color === "string" &&
        (entry.keyline === undefined || typeof entry.keyline === "boolean") &&
        Array.isArray(entry.points) &&
        entry.points.length >= 3 &&
        entry.points.every(point)
      );
    })
  ) {
    return undefined;
  }
  return {
    reducedMotion: streak.reducedMotion,
    wedges: (wedges as Fields[]).map((wedge) => ({
      color: wedge.color as string,
      keyline: wedge.keyline === true,
      points: (wedge.points as [number, number][]).map(([u, v]) => [u, v] as const),
    })),
  };
}

export const PULL_STREAK = readPullStreak(STARDUST);

/**
 * The streak's wedges at screen point `at` for a pickup pulled along the screen direction
 * `toward` (toward Ada): `u` runs along it and `v` across it, so negative `u` trails behind.
 */
export function pullStreakWedges(
  streak: PullStreak,
  toward: Vec,
  at: Vec,
): { color: string; keyline: boolean; points: Vec[] }[] {
  const length = Math.hypot(toward.x, toward.y);
  if (!(length > 0)) {
    return [];
  }
  const along = { x: toward.x / length, y: toward.y / length };
  return streak.wedges.map(({ color, keyline, points }) => ({
    color,
    keyline,
    points: points.map(([u, v]) => ({
      x: at.x + along.x * u - along.y * v,
      y: at.y + along.y * u + along.x * v,
    })),
  }));
}
