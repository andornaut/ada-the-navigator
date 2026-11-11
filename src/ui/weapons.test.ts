import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import { PICKUP_GLYPH, pickupGlyphKey, weaponGlyphPath } from "../data/weapon-glyphs.ts";
import { HUD_BUTTON } from "./layout/playView.ts";
import { HUD_DISC_STATES, WEAPON_STYLE, weaponButtonState } from "./weapons.ts";

describe("HUD weapon buttons", () => {
  it("shows the selected weapon as selected even while weapon changes are locked", () => {
    expect(weaponButtonState({ id: "basic", locked: false, selected: true })).toBe("selected");
    expect(weaponButtonState({ id: "basic", locked: true, selected: true })).toBe("selected");
  });

  it("locks every other weapon in combat and through the 5 seconds after", () => {
    expect(weaponButtonState({ id: "rapidMissile", locked: true, selected: false })).toBe("locked");
    expect(weaponButtonState({ id: "rapidMissile", locked: false, selected: false })).toBe("idle");
  });

  it("colours each state as Art's Chibi skill buttons, with no cream ring or amber", () => {
    expect(HUD_DISC_STATES).toEqual({
      idle: { edge: 1, face: "#262b44", glyph: "#b8b3c9" },
      locked: { edge: 1, face: "#262b44", glyph: "#6f7891" },
      selected: { edge: 4, face: "#bfa06f", glyph: "#181425" },
    });
    // The 33 disc less the 4 annulus on each side leaves the 25 gold face.
    expect(HUD_BUTTON.disc - 2 * HUD_DISC_STATES.selected.edge).toBe(25);
    // The cream is only the shared focus ring's band.
    expect(WEAPON_STYLE).not.toMatch(/#f0bd68|pixelated/u);
    expect(WEAPON_STYLE.match(/#ead4aa/gu)).toHaveLength(1);
  });

  it.each([
    "basic",
    "rapidMissile",
    "multiLaser",
    "heavyMissile",
    "scattershot",
    "phaser",
  ] as const)("draws %s's own single-colour 20px glyph as a mask on its disc", (weapon) => {
    expect(weaponGlyphPath(weapon)).toBe(`/art/ui/icons/weapon-${weapon}.svg`);
    const file = new URL(`../../public${weaponGlyphPath(weapon)}`, import.meta.url);
    expect(existsSync(file)).toBe(true);
  });

  it("draws each pickup weapon's HUD glyph at 14px inside its pickup square", () => {
    expect(PICKUP_GLYPH.size).toBe(14);
    expect(PICKUP_GLYPH.weapons).toEqual([
      "scattershot",
      "rapidMissile",
      "multiLaser",
      "heavyMissile",
      "phaser",
    ]);
    expect(new Set(PICKUP_GLYPH.weapons.map(pickupGlyphKey)).size).toBe(5);
    // The glyph fits inside the square, 20 across at pickupRadius 10.
    expect(PICKUP_GLYPH.size).toBeLessThan(2 * PROTOTYPE.tuning.flight.pickupRadius);
  });
});
