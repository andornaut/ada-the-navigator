/** Drawn bounds of the shipped 20px HUD and item notice icons. */
export const HUD_ICON_BEARINGS = {
  carrying: { bottom: 3, left: 2, right: 2, top: 3 },
  rapidMissile: { bottom: 3, left: 1, right: 2, top: 3 },
  towing: { bottom: 1, left: 4, right: 5, top: 1 },
} as const;

export type StatusAboardKind = "carrying" | "towing";
