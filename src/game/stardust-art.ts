import type { Vec } from "../model/types.ts";
import { loopFrame, loopPhase } from "./world-art.ts";

// Art's Stardust pickup (art/stardust.md): a 9x9 gem whose glint loops from a per-pickup phase.

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
