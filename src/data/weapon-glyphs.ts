import type { Weapon } from "./types.ts";

/** The single-colour 20px weapon glyph, drawn as a mask over the button's text colour. */
export function weaponGlyphPath(weapon: Weapon): string {
  return `/art/ui/icons/weapon-${weapon}.svg`;
}

/**
 * The weapon's two-frame shop sheet (normal, then disabled), drawn from its HUD glyph's pixel
 * grid (art/shop-icons.md); every weapon has one.
 */
export function weaponShopSheet(weapon: Weapon): string {
  return `icon-shop-weapon-${weapon}`;
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
