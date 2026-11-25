/** Approved intact assembled body spans relative to Ada's source-model lateral hull span. */
export const ENEMY_SIZE_RATIOS = {
  capital: 6,
  fighter: 1,
  flagship: 6,
  frigate: 5,
  hostileStation: 7,
  interceptor: 1,
  platform: 4,
  retaliator: 3,
  swarm: 0.8,
} as const;

/**
 * Approved spans of the hulls that differ from their class's, by body key: the Cargo Hauler
 * spans 2.5 Ada widths, while the Manta gunship and Mining Freighter keep the retaliator's 3.
 */
export const HULL_SIZE_RATIOS: Readonly<Record<string, number>> = {
  retaliatorCargoHauler: 2.5,
};

/** The approved span of `hull` (a body key such as `retaliatorCargoHauler`), else its class's. */
export function hullSizeRatio(archetype: keyof typeof ENEMY_SIZE_RATIOS, hull?: string): number {
  return (hull !== undefined && HULL_SIZE_RATIOS[hull]) || ENEMY_SIZE_RATIOS[archetype];
}
