import { carriesStardust } from "../model/drops.ts";
import type { SpaceObject, Vec } from "../model/types.ts";

// Art's looping world sheets: the holodisk pickup (art/holodisk.md) and the ammo pack
// (art/weapons.md "Ammo pack") name their frames and loop through `loop` steps. The discovery
// cache and the holodisk beacon (art/friendly-redesign.md) are one row per frame: lit A and B
// alternate each `frameMs`, and the cache has a hidden row.

export interface LoopAsset {
  readonly displayHeight?: number;
  readonly displayWidth?: number;
  readonly frames?: Readonly<Record<string, number>>;
  readonly id: string;
  readonly loop?: readonly { readonly frame: number; readonly ms: number }[];
  readonly pivot: Vec;
}

export interface LoopArt<T extends LoopAsset = LoopAsset> {
  readonly asset: T;
  readonly frames: Readonly<Record<string, number>>;
  readonly loop: readonly { readonly frame: number; readonly ms: number }[];
  readonly loopMs: number;
}

/** The sheet with its named frames and a loop, or undefined to keep the placeholder. */
export function readLoopArt<T extends LoopAsset>(
  assets: readonly T[],
  id: string,
  names: readonly string[],
): LoopArt<T> | undefined {
  const asset = assets.find((entry) => entry.id === id);
  const loop = asset?.loop ?? [];
  const loopMs = loop.reduce((sum, step) => sum + step.ms, 0);
  const frames = asset?.frames ?? {};
  if (
    !asset ||
    !(loopMs > 0) ||
    !(asset.displayWidth! > 0) ||
    !names.every((name) => Number.isInteger(frames[name]))
  ) {
    return undefined;
  }
  return { asset, frames, loop, loopMs };
}

/** A stable start phase per object, so neighbours loop out of step. */
export function loopPhase(id: string, loopMs: number): number {
  let n = 2166136261;
  for (let index = 0; index < id.length; index++) {
    n = Math.imul(n ^ id.charCodeAt(index), 16777619);
  }
  return (n >>> 0) % Math.max(1, Math.round(loopMs));
}

/** The loop's sheet frame at timeMs from phaseMs. */
export function loopFrame(
  art: Pick<LoopArt, "loop" | "loopMs">,
  phaseMs: number,
  timeMs: number,
): number {
  let at = (((timeMs + phaseMs) % art.loopMs) + art.loopMs) % art.loopMs;
  for (const step of art.loop) {
    if (at < step.ms) {
      return step.frame;
    }
    at -= step.ms;
  }
  return art.loop[0]!.frame;
}

export const HOLODISK_FRAMES = ["rest", "turn1", "edge", "turn2"] as const;
export const AMMO_PACK_FRAMES = ["rest", "glint1", "glint2", "glint3"] as const;

/** A discovery cache: a Stardust pickup placed as a discovery, not a drop. */
export function isDiscoveryCache(object: SpaceObject): boolean {
  return object.role === "discovery" && carriesStardust(object);
}

/** A world object's blink rows: frame A, then B, each `frameMs`. */
export interface BlinkArt<T extends LoopAsset = LoopAsset> {
  readonly frameMs: number;
  readonly frames: readonly [T, T];
}

/** The discovery cache's lit blink and its hidden row. */
export interface CacheArt<T extends LoopAsset = LoopAsset> {
  readonly hidden: T;
  readonly lit: BlinkArt<T>;
}

type BlinkAsset = LoopAsset & { readonly frameMs?: number };

/** Both rows of a blink, or undefined to keep the placeholder. */
export function readBlinkRows<T extends BlinkAsset>(
  assets: readonly T[],
  idA: string,
  idB: string,
): BlinkArt<T> | undefined {
  const a = assets.find((asset) => asset.id === idA);
  const b = assets.find((asset) => asset.id === idB);
  if (!a || !b || !(a.frameMs! > 0) || !(a.displayWidth! > 0) || !(b.displayWidth! > 0)) {
    return undefined;
  }
  return { frameMs: a.frameMs!, frames: [a, b] };
}

/** The cache's hidden, lit A and lit B rows, or undefined to keep the placeholder. */
export function readCacheArt<T extends BlinkAsset>(assets: readonly T[]): CacheArt<T> | undefined {
  const lit = readBlinkRows(assets, "discovery-cache-lit-a", "discovery-cache-lit-b");
  const hidden = assets.find((asset) => asset.id === "discovery-cache-hidden");
  return lit && hidden && hidden.displayWidth! > 0 ? { hidden, lit } : undefined;
}

/** The holodisk waypoint beacon's blink, or undefined to keep the placeholder. */
export function readBeaconArt<T extends BlinkAsset>(assets: readonly T[]): BlinkArt<T> | undefined {
  return readBlinkRows(assets, "holodisk-beacon-a", "holodisk-beacon-b");
}

/** The blink's row at timeMs: A, then B; reduced motion holds A. */
export function blinkRow<T extends LoopAsset>(
  art: BlinkArt<T>,
  reducedMotion: boolean,
  timeMs: number,
): T {
  return art.frames[reducedMotion || Math.floor(timeMs / art.frameMs) % 2 === 0 ? 0 : 1];
}

/**
 * A cache is hidden until Ada first comes within approachRadius, then blinks lit A and B;
 * reduced motion holds lit A once lit.
 */
export function cacheRow<T extends LoopAsset>(
  art: CacheArt<T>,
  lit: boolean,
  reducedMotion: boolean,
  timeMs: number,
): T {
  return lit ? blinkRow(art.lit, reducedMotion, timeMs) : art.hidden;
}

/** Whether Ada is within approachRadius world units of the cache. */
export function cacheApproached(approachRadius: number, player: Vec, cache: Vec): boolean {
  return Math.hypot(cache.x - player.x, cache.y - player.y) <= approachRadius;
}

/** The holodisk's coin turn from its own phase; reduced motion holds rest. */
export function holodiskFrame(
  art: LoopArt,
  reducedMotion: boolean,
  phaseMs: number,
  timeMs: number,
): number {
  return reducedMotion ? art.frames.rest! : loopFrame(art, phaseMs, timeMs);
}

/**
 * The ammo pack's glint `ms` after the pack appeared, its loop starting from rest; reduced motion
 * holds rest.
 */
export function ammoPackFrame(art: LoopArt, reducedMotion: boolean, ms: number): number {
  return reducedMotion ? art.frames.rest! : loopFrame(art, 0, ms);
}

/**
 * The holodisk waypoint while its location is known and the holodisk is not yet recovered:
 * the model places the `holodisk` destination only then.
 */
export function holodiskWaypoint(
  recovered: boolean,
  objects: readonly SpaceObject[],
): SpaceObject | undefined {
  return recovered
    ? undefined
    : objects.find((object) => object.kind === "destination" && object.id === "holodisk");
}
