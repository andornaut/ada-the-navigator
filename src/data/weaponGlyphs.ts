import type { Weapon } from "./types.ts";
import { uiIconUrl } from "./uiIconUrl.ts";

/** The single-colour 20px weapon glyph, drawn as a mask over the button's text colour. */
export function weaponGlyphPath(weapon: Weapon): string {
  return uiIconUrl(`weapon-${weapon}`);
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
  return uiIconUrl(`ammo-${AMMO_KIND[weapon]}`);
}
