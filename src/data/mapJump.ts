/** Stardust charged only after a successful local Map teleport. */
export const MAP_JUMP_COST = 50;

export function canAffordMapJump(stardust: number | null): boolean {
  return stardust !== null && stardust >= MAP_JUMP_COST;
}

/** Danger is also shown without a travel offer because it blocks Galaxies. */
export function travelState(
  inDanger: boolean,
  towing: boolean,
  carrying: boolean,
  place: { readonly travel: boolean } | null,
): {
  readonly offered: boolean;
  readonly reason: "carrying" | "danger" | "towing" | null;
} {
  const offered = Boolean(place?.travel);
  return {
    offered,
    reason: inDanger
      ? "danger"
      : offered && towing
        ? "towing"
        : offered && carrying
          ? "carrying"
          : null,
  };
}
