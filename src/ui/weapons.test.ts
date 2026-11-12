import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import type { Weapon } from "../data/types.ts";
import { PICKUP_GLYPH, pickupGlyphKey, weaponGlyphPath } from "../data/weapon-glyphs.ts";
import { conversationBoxRect } from "./layout/conversationBox.ts";
import {
  HUD_AMMO_COUNT,
  HUD_BUTTON,
  HUD_BUTTON_INSET,
  hudButtonTarget,
  hudRect,
  type Insets,
  logicalView,
  NO_INSETS,
  safeInsets,
  type Size,
  viewScale,
} from "./layout/playView.ts";
import {
  AMMO_COUNT_TEXT,
  ammoCount,
  HUD_DISC_STATES,
  WEAPON_STYLE,
  weaponButtonLabel,
  weaponButtonState,
} from "./weapons.ts";

describe("HUD weapon buttons", () => {
  it("shows the selected weapon as selected, an empty one as empty and the rest idle", () => {
    expect(weaponButtonState({ ammo: null, id: "basic", selected: true })).toBe("selected");
    expect(weaponButtonState({ ammo: 0, id: "rapidMissile", selected: true })).toBe("selected");
    expect(weaponButtonState({ ammo: 12, id: "rapidMissile", selected: false })).toBe("idle");
    expect(weaponButtonState({ ammo: null, id: "basic", selected: false })).toBe("idle");
    expect(weaponButtonState({ ammo: 0, id: "phaser", selected: false })).toBe("empty");
  });

  it("labels a weapon button with its exact count, en-US grouped, and Basic with its name", () => {
    const labels = {
      ammo: PROTOTYPE.labels.weaponAmmoLabel!,
      group: "",
      names: {
        basic: "Basic",
        heavyMissile: "Heavy Missile",
        multiLaser: "Multi-Laser",
        phaser: "Phaser",
        rapidMissile: "Rapid Missile",
        scattershot: "Scattershot",
      },
    };
    expect(PROTOTYPE.labels.weaponAmmoLabel).toBe("{weapon}, {count} left");
    const label = (id: Weapon, ammo: number | null) =>
      weaponButtonLabel(labels, { ammo, id, selected: false });
    expect(label("basic", null)).toBe("Basic");
    expect(label("rapidMissile", 1200)).toBe("Rapid Missile, 1,200 left");
    expect(label("phaser", 0)).toBe("Phaser, 0 left");
    expect(label("multiLaser", 9999)).toBe("Multi-Laser, 9,999 left");
    // Exact past the pill's four characters ("2m").
    expect(label("scattershot", 2_500_000)).toBe("Scattershot, 2,500,000 left");
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
      empty: { edge: 1, face: "#262b44", glyph: "#75748c" },
      idle: { edge: 1, face: "#262b44", glyph: "#b8b3c9" },
      selected: { edge: 4, face: "#bfa06f", glyph: "#181425" },
    });
    // The 33 disc less the 4 annulus on each side leaves the 25 gold face.
    expect(HUD_BUTTON.disc - 2 * HUD_DISC_STATES.selected.edge).toBe(25);
    // The cream is the shared focus ring's band and the count pill's text.
    expect(WEAPON_STYLE).not.toMatch(/#f0bd68|pixelated/u);
    expect(WEAPON_STYLE.match(/#ead4aa/gu)).toHaveLength(2);
  });

  it("draws each count in an opaque ink pill on the disc's lower edge, clear of the name tab", () => {
    expect(HUD_AMMO_COUNT).toEqual({ clearance: 5, height: 14, padding: 4, radius: 4, top: 40 });
    expect(AMMO_COUNT_TEXT).toEqual({ empty: "#e4574e", normal: "#ead4aa" });
    // The pill overlaps the disc's lower edge, 7.5 + 33 = 40.5 below the target's top.
    expect(HUD_AMMO_COUNT.top).toBeLessThan(HUD_BUTTON_INSET.disc + HUD_BUTTON.disc);
    // In the view, the conversation box's top sits clearance (5) below the pill.
    const cases: readonly (readonly [Size, Insets])[] = [
      [{ height: 360, width: 720 }, NO_INSETS],
      [
        { height: 390, width: 844 },
        { bottom: 21, left: 47, right: 47, top: 0 },
      ],
      [{ height: 720, width: 1280 }, NO_INSETS],
      [
        { height: 390, width: 844 },
        { bottom: 0, left: 0, right: 0, top: 47 },
      ],
    ];
    for (const [css, cssInsets] of cases) {
      const view = logicalView(css);
      const insets = safeInsets(cssInsets, viewScale(css));
      const pillBottom =
        hudRect(insets, view).y + hudButtonTarget(0).y + HUD_AMMO_COUNT.top + HUD_AMMO_COUNT.height;
      expect(conversationBoxRect(insets, view).y - pillBottom).toBeCloseTo(
        HUD_AMMO_COUNT.clearance,
        9,
      );
    }
    expect(WEAPON_STYLE).toContain("background:#181425");
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
