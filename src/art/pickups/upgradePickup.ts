import type { Vec } from "../../model/types.ts";

/** The core manifest's upgrade chevron strip (art/friendly-redesign.md "Pickup animations"). */
export const UPGRADE_CHEVRON = "upgrade-chevron";

/** The upgrade pickup's strip: its display size, pivot and the climb through its frames. */
export interface UpgradePickupArt {
  readonly size: { readonly height: number; readonly width: number };
  readonly pivot: Vec;
  /** The still frame, shown under reduced motion and by a climb step that lights none. */
  readonly rest: number;
  /** Steps in order from the still frame, each showing its strip frame. */
  readonly climb: readonly { readonly frame: number; readonly ms: number }[];
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * The chevron row's display size, pivot and climb from the core manifest's assets, or undefined.
 * A step's `lit` names the frame it shows; a step without one shows `rest`.
 */
export function readUpgradePickup(assets: readonly unknown[]): UpgradePickupArt | undefined {
  const entry = assets.find((asset) => record(asset) && asset.id === UPGRADE_CHEVRON);
  if (
    !record(entry) ||
    !record(entry.frames) ||
    !Array.isArray(entry.climb) ||
    !record(entry.pivot) ||
    !finite(entry.pivot.x) ||
    !finite(entry.pivot.y) ||
    !finite(entry.displayWidth) ||
    !finite(entry.displayHeight) ||
    entry.displayWidth <= 0 ||
    entry.displayHeight <= 0
  ) {
    return undefined;
  }
  const frames = entry.frames;
  const frame = (name: unknown): number | null =>
    typeof name === "string" && Number.isInteger(frames[name]) ? (frames[name] as number) : null;
  const rest = frame("rest");
  const climb = (entry.climb as unknown[]).map((key) => {
    if (!record(key) || !finite(key.ms) || key.ms <= 0) {
      return null;
    }
    const shown = key.lit === undefined ? rest : frame(key.lit);
    return shown === null ? null : { frame: shown, ms: key.ms };
  });
  if (rest === null || !climb.length || climb.includes(null)) {
    return undefined;
  }
  return {
    climb: climb as UpgradePickupArt["climb"],
    pivot: { x: entry.pivot.x, y: entry.pivot.y },
    rest,
    size: { height: entry.displayHeight, width: entry.displayWidth },
  };
}

/**
 * The strip frame `ms` after the pickup appeared, looping the climb from its still frame.
 * Reduced motion holds the still frame.
 */
export function upgradeFrame(art: UpgradePickupArt, reducedMotion: boolean, ms: number): number {
  if (reducedMotion) {
    return art.rest;
  }
  const period = art.climb.reduce((sum, key) => sum + key.ms, 0);
  let at = ((ms % period) + period) % period;
  for (const key of art.climb) {
    if (at < key.ms) {
      return key.frame;
    }
    at -= key.ms;
  }
  return art.rest;
}
