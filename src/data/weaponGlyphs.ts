import type { Weapon } from "./types.ts";

/** The single-colour 20px weapon glyph, drawn as a mask over the button's text colour. */
export function weaponGlyphPath(weapon: Weapon): string {
  return `/art/ui/icons/weapon-${weapon}.svg`;
}

/** Each upgrade weapon's ammunition kind (art/weapon-icons.md "Ammunition icons"). */
const AMMO_KIND = {
  heavyMissile: "missile",
  multiLaser: "energy",
  phaser: "energy",
  rapidMissile: "missile",
  scattershot: "shell",
} as const satisfies Record<Exclude<Weapon, "laser">, string>;

/** The 20px mask for a weapon's ammunition kind. */
export function ammoGlyphPath(weapon: Exclude<Weapon, "laser">): string {
  return `/art/ui/icons/ammo-${AMMO_KIND[weapon]}.svg`;
}
