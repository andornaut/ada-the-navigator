import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { HUD_BUTTON } from "./layout/playView.ts";
import { HUD_DISC_STATES, WEAPON_STYLE, weaponButtonState, weaponGlyphPath } from "./weapons.ts";

describe("HUD weapon buttons", () => {
  it("shows the selected weapon as selected even while weapon changes are locked", () => {
    expect(weaponButtonState({ id: "basic", locked: false, selected: true })).toBe("selected");
    expect(weaponButtonState({ id: "basic", locked: true, selected: true })).toBe("selected");
  });

  it("locks every other weapon in combat and through the 5 seconds after", () => {
    expect(weaponButtonState({ id: "missiles", locked: true, selected: false })).toBe("locked");
    expect(weaponButtonState({ id: "missiles", locked: false, selected: false })).toBe("idle");
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

  it("draws Art's single-colour 20px glyphs as masks on the discs", () => {
    expect(weaponGlyphPath("tripleLaser")).toBe("/art/ui/icons/weapon-tripleLaser.svg");
    for (const weapon of ["basic", "missiles", "tripleLaser", "scattershot"] as const) {
      const file = new URL(`../../public${weaponGlyphPath(weapon)}`, import.meta.url);
      expect(existsSync(file)).toBe(true);
    }
  });
});
