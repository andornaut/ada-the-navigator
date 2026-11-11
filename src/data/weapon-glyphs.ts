import type { Weapon } from "./types.ts";

/**
 * Art's glyph file per weapon. Heavy Missile, Rapid Missile, Multi-Laser and Phaser reuse the
 * existing missiles, triple-laser and basic glyphs as placeholders until Art supplies their own.
 */
const WEAPON_GLYPHS: Readonly<Record<Weapon, string>> = {
  basic: "basic",
  heavyMissile: "missiles",
  multiLaser: "tripleLaser",
  phaser: "basic",
  rapidMissile: "missiles",
  scattershot: "scattershot",
};

/** The single-colour 20px weapon glyph, drawn as a mask over the button's text colour. */
export function weaponGlyphPath(weapon: Weapon): string {
  return `/art/ui/icons/weapon-${WEAPON_GLYPHS[weapon]}.svg`;
}
