import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import { PICKUP_GLYPH, pickupGlyphKey, weaponGlyphPath } from "../data/weapon-glyphs.ts";
import { HUD_BUTTON } from "./layout/playView.ts";
import { ammoCount, HUD_DISC_STATES, WEAPON_STYLE, weaponButtonState } from "./weapons.ts";

describe("HUD weapon buttons", () => {
  it("shows the selected weapon as selected, an empty one as empty and the rest idle", () => {
    expect(weaponButtonState({ ammo: null, id: "basic", selected: true })).toBe("selected");
    expect(weaponButtonState({ ammo: 0, id: "rapidMissile", selected: true })).toBe("selected");
    expect(weaponButtonState({ ammo: 12, id: "rapidMissile", selected: false })).toBe("idle");
    expect(weaponButtonState({ ammo: null, id: "basic", selected: false })).toBe("idle");
    expect(weaponButtonState({ ammo: 0, id: "phaser", selected: false })).toBe("empty");
  });

  it.each([
    [0, "0"],
    [7, "7"],
    [9999, "9999"],
    [10000, "10k"],
    [10999, "10k"],
    [999999, "999k"],
    [1000000, "1m"],
    [42_500_000, "42m"],
    [999_999_999, "999m"],
    [5_000_000_000, "999m"],
  ])("counts %i shots as %s, in at most four characters", (shots, text) => {
    expect(ammoCount(shots)).toBe(text);
    expect(text.length).toBeLessThanOrEqual(4);
  });

  it("colours each state as Art's Chibi skill buttons, with no cream ring or amber", () => {
    expect(HUD_DISC_STATES).toEqual({
      idle: { edge: 1, face: "#262b44", glyph: "#b8b3c9" },
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
