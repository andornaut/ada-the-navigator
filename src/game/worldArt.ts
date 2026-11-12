import { carriesStardust } from "../model/drops.ts";
import type { SpaceObject, Vec } from "../model/types.ts";

// Art's looping world sheets: the discovery cache (art/outposts.md) and the holodisk pickup and
// beacon (art/holodisk.md). Each names its frames and loops through `loop` steps.

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

export const CACHE_FRAMES = ["hidden", "litA", "litB"] as const;
export const HOLODISK_FRAMES = ["rest", "turn1", "edge", "turn2"] as const;
export const BEACON_FRAMES = ["base", "bright"] as const;

/** A discovery cache: a Stardust pickup placed as a discovery, not a drop. */
export function isDiscoveryCache(object: SpaceObject): boolean {
  return object.role === "discovery" && carriesStardust(object);
}

/**
 * A cache is hidden until Ada first comes within approachRadius, then loops litA and litB;
 * reduced motion holds litA once lit.
 */
export function cacheFrame(
  art: LoopArt,
  lit: boolean,
  reducedMotion: boolean,
  timeMs: number,
): number {
  if (!lit) {
    return art.frames.hidden!;
  }
  return reducedMotion ? art.frames.litA! : loopFrame(art, 0, timeMs);
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

/** The beacon pulses base and bright; reduced motion holds base. */
export function beaconFrame(art: LoopArt, reducedMotion: boolean, timeMs: number): number {
  return reducedMotion ? art.frames.base! : loopFrame(art, 0, timeMs);
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
