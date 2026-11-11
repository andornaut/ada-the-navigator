import type { Weapon } from "./types.ts";

/** The single-colour 20px weapon glyph, drawn as a mask over the button's text colour. */
export function weaponGlyphPath(weapon: Weapon): string {
  return `/art/ui/icons/weapon-${weapon}.svg`;
}

// The weapons with a two-frame shop sheet (normal, then disabled) drawn from their HUD glyph's
// pixel grid (art/shop-icons.md); Scattershot's shop row draws its SVG as a mask instead.
const SHOP_SHEET_WEAPONS: ReadonlySet<Weapon> = new Set([
  "basic",
  "rapidMissile",
  "multiLaser",
  "heavyMissile",
  "phaser",
]);

/** The weapon's shop sheet key, or undefined for a weapon without one. */
export function weaponShopSheet(weapon: Weapon): string | undefined {
  return SHOP_SHEET_WEAPONS.has(weapon) ? `icon-shop-weapon-${weapon}` : undefined;
}

/**
 * A weapon pickup's glyph (art/weapons.md "Pickups"): the weapon's 20px HUD glyph drawn at 14px
 * in amber, centred on the pickup, for every weapon that drops as a pickup.
 */
export const PICKUP_GLYPH = {
  size: 14,
  weapons: ["scattershot", "rapidMissile", "multiLaser", "heavyMissile", "phaser"],
} as const satisfies { size: number; weapons: readonly Weapon[] };

/** The texture key of a weapon's pickup glyph. */
export function pickupGlyphKey(weapon: Weapon): string {
  return `pickup-glyph-${weapon}`;
}
