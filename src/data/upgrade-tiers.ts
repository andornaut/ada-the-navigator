// The upgrade tier colours (art/controls.md "Weapon level", art/ship.md "Speed jets"): a level
// reached by an upgrade reads in one colour on the weapon disc's edge, Ada's jets and its item
// notice, orange at level 2 and purple at level 3. Level 1 has none.
export const UPGRADE_TIER_COLOURS = { 2: "#ff8f1f", 3: "#a66bff" } as const;

/** An upgrade level's tier colour, or null at level 1; past 3, level 3's. */
export function tierColour(level: number): string | null {
  if (level >= 3) {
    return UPGRADE_TIER_COLOURS[3];
  }
  return level >= 2 ? UPGRADE_TIER_COLOURS[2] : null;
}
