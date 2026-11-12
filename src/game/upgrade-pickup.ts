import type { Vec } from "../model/types.ts";

/** The core manifest's upgrade chevron mask (art/weapons.md "Pickups"). */
export const UPGRADE_CHEVRON = "upgrade-chevron";

/** The upgrade pickup's two chevrons and the climb that lights them in turn. */
export interface UpgradePickupArt {
  readonly chevrons: readonly { readonly name: string; readonly offset: Vec }[];
  /** Keys in order from the still frame, each lighting the named chevron or none. */
  readonly climb: readonly { readonly lit: string | null; readonly ms: number }[];
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** The chevron entry's offsets and climb from the core manifest's assets, or undefined. */
export function readUpgradePickup(assets: readonly unknown[]): UpgradePickupArt | undefined {
  const entry = assets.find((asset) => record(asset) && asset.id === UPGRADE_CHEVRON);
  if (!record(entry) || !Array.isArray(entry.chevrons) || !Array.isArray(entry.climb)) {
    return undefined;
  }
  const chevrons = (entry.chevrons as unknown[]).map((chevron) =>
    record(chevron) &&
    typeof chevron.name === "string" &&
    Array.isArray(chevron.offset) &&
    chevron.offset.length === 2 &&
    chevron.offset.every(finite)
      ? {
          name: chevron.name,
          offset: { x: chevron.offset[0] as number, y: chevron.offset[1] as number },
        }
      : null,
  );
  const names = new Set(chevrons.map((chevron) => chevron?.name));
  const climb = (entry.climb as unknown[]).map((key) =>
    record(key) &&
    finite(key.ms) &&
    key.ms > 0 &&
    (key.lit === undefined || (typeof key.lit === "string" && names.has(key.lit)))
      ? { lit: (key.lit as string | undefined) ?? null, ms: key.ms }
      : null,
  );
  if (!chevrons.length || chevrons.includes(null) || !climb.length || climb.includes(null)) {
    return undefined;
  }
  return {
    chevrons: chevrons as UpgradePickupArt["chevrons"],
    climb: climb as UpgradePickupArt["climb"],
  };
}

/**
 * The chevron lit `ms` after the pickup appeared, looping the climb from its still frame; null
 * while none is. Reduced motion holds the still frame.
 */
export function litChevron(
  art: UpgradePickupArt,
  reducedMotion: boolean,
  ms: number,
): string | null {
  if (reducedMotion) {
    return null;
  }
  const period = art.climb.reduce((sum, key) => sum + key.ms, 0);
  let at = ((ms % period) + period) % period;
  for (const key of art.climb) {
    if (at < key.ms) {
      return key.lit;
    }
    at -= key.ms;
  }
  return null;
}
