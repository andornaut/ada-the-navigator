import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import type { Weapon } from "../data/types.ts";
import { weaponGlyphPath } from "../data/weaponGlyphs.ts";
import { conversationBoxRect } from "./layout/conversationBox.ts";
import { units } from "./layout/css.ts";
import {
  HUD_AMMO_COUNT,
  HUD_BUTTON,
  HUD_BUTTON_INSET,
  HUD_WEAPON_LEVEL,
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
  hudDiscStyle,
  LEVEL_PIPS,
  WEAPON_FILLS,
  WEAPON_STYLE,
  weaponButtonLabel,
  weaponButtonState,
} from "./weapons.ts";

describe("HUD weapon levels", () => {
  const rule = (selector: string) =>
    WEAPON_STYLE.split("}").find((part) => part.includes(`${selector}{`));

  it("pips a level in lavender at 1, then its upgrade tier's orange and purple", () => {
    expect(LEVEL_PIPS).toEqual({ 1: "#b8b3c9", 2: "#ff8f1f", 3: "#a66bff" });
    for (const level of [1, 2, 3] as const) {
      expect(rule(`.ada-weapon[data-level="${level}"] .ada-pips > span`)).toContain(
        `background:${LEVEL_PIPS[level]}`,
      );
    }
    expect(HUD_WEAPON_LEVEL).toEqual({
      below: 14.5,
      halo: { blur: 2, spread: 1 },
      outline: 1,
      pip: { outline: 1, pitch: 7, size: 4 },
    });
    expect(rule(".ada-controls .ada-pips > span")).toContain(
      `width:${units(HUD_WEAPON_LEVEL.pip.size)}`,
    );
    expect(rule(".ada-controls .ada-pips")).toContain(
      `gap:${units(HUD_WEAPON_LEVEL.pip.pitch - HUD_WEAPON_LEVEL.pip.size)}`,
    );
  });

  it("keeps tier colour inside the shared weapon annulus without exterior halo or outline", () => {
    for (const level of [2, 3] as const) {
      const tier = rule(`.ada-weapon[data-level="${level}"] .ada-disc`);
      expect(tier).toContain(`--weapon-ring:${LEVEL_PIPS[level]}`);
    }
    expect(WEAPON_STYLE).not.toMatch(/--level-(?:edge|halo|outline):/u);
    expect(rule('.ada-weapon[data-level="1"] .ada-disc')).toBeUndefined();
  });
});

describe("HUD weapon buttons", () => {
  it("shows the selected weapon as selected, an empty one as empty and the rest idle", () => {
    const state = (ammo: number | null, id: Weapon, selected: boolean) =>
      weaponButtonState({ ammo, id, level: 1, selected });
    expect(state(null, "laser", true)).toBe("selected");
    expect(state(0, "rapidMissile", true)).toBe("selected");
    expect(state(12, "rapidMissile", false)).toBe("idle");
    expect(state(null, "laser", false)).toBe("idle");
    expect(state(0, "phaser", false)).toBe("empty");
  });

  it("labels a weapon button with its exact count, en-US grouped, and Laser with its name", () => {
    const labels = {
      ammo: CONTENT.labels.weaponAmmoLabel!,
      group: "",
      names: {
        heavyMissile: "Heavy Missile",
        laser: "Laser",
        multiLaser: "Multi-Laser",
        phaser: "Phaser",
        rapidMissile: "Rapid Missile",
        scattershot: "Scattershot",
      },
    };
    expect(CONTENT.labels.weaponAmmoLabel).toBe("{weapon}, {count} left");
    const label = (id: Weapon, ammo: number | null) =>
      weaponButtonLabel(labels, { ammo, id, level: 1, selected: false });
    expect(label("laser", null)).toBe("Laser");
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

  it("keeps a solid dark selected face and a distinct cream ring", () => {
    expect(HUD_DISC_STATES).toEqual({
      empty: { edge: 1, face: "#262b44", glyph: "#75748c" },
      idle: { edge: 1, face: "#262b44", glyph: "#b8b3c9" },
      selected: { edge: 4, face: "#262b44", glyph: "#ead4aa" },
    });
    // The face inside the unchanged 4 annulus remains 25 across.
    expect(HUD_BUTTON.disc - 2 * HUD_DISC_STATES.selected.edge).toBe(25);
    // Active counts and refill labels use cream; inactive counts use grey.
    expect(WEAPON_STYLE).not.toMatch(/#f0bd68|pixelated/u);
    for (const selector of [
      ".ada-controls .ada-weapon[data-state=selected] .ada-ammo",
      ".ada-controls .ada-ammo-gain",
    ]) {
      const rule = WEAPON_STYLE.split("}").find((part) => part.includes(`${selector}{`));
      expect(rule).toContain(`color:${AMMO_COUNT_TEXT.normal}`);
    }
  });

  it("adds a weapon-only cream ring without changing shared HUD disc styling", () => {
    const rule = (selector: string) =>
      WEAPON_STYLE.split("}")
        .filter((part) => part.includes(`${selector}{`))
        .at(-1);
    expect(rule(".ada-controls .ada-weapon .ada-disc")).toContain(
      "background:var(--weapon-face, #262b44)",
    );
    const ring = rule(".ada-controls .ada-weapon .ada-disc::after");
    expect(ring).toContain("position:absolute");
    expect(ring).toContain(`inset:${units(HUD_BUTTON.edge)}`);
    expect(ring).toContain(
      `border:${units(HUD_BUTTON.annulus - 2 * HUD_BUTTON.edge)} solid var(--weapon-ring, #75748c)`,
    );
    expect(ring).toContain(
      `box-shadow:0 0 0 ${units(HUD_BUTTON.edge)} #181425,\n    inset 0 0 0 ${units(HUD_BUTTON.edge)} #181425`,
    );
    expect(rule(".ada-controls .ada-weapon .ada-disc")).toContain("box-shadow:none");
    expect(rule(".ada-controls .ada-weapon[data-state=selected] .ada-disc::after")).toContain(
      "border-color:#ead4aa",
    );
    expect(ring).toContain("background:transparent");
    expect(ring).toContain("pointer-events:none");
    expect(ring).not.toMatch(/width:|height:|transform:/u);
    const shared = hudDiscStyle(".shared-button", ".disc");
    expect(shared).toContain("background:#262b44");
    expect(shared).toContain("color:#b8b3c9");
    expect(shared).not.toMatch(/ada-weapon|::after|opacity:0\./u);
    expect(
      rule(".ada-controls .ada-weapon-selector[data-field=light] .ada-weapon"),
    ).toBeUndefined();
  });

  it("keeps muted inactive glyph colours opaque for contrast on solid faces", () => {
    for (const [state, opacity] of [
      ["selected", 1],
      ["idle", 1],
      ["empty", 1],
    ] as const) {
      const selector = `.ada-controls .ada-weapon[data-state=${state}] .ada-disc::before`;
      const rule = WEAPON_STYLE.split("}").find((part) => part.includes(`${selector}{`));
      expect(rule).toContain(`opacity:${opacity}`);
    }
    expect(WEAPON_STYLE).toContain(
      ".ada-controls .ada-weapon[data-ui-refusal-red] .ada-disc::before{\n  opacity:1",
    );
    const pill = WEAPON_STYLE.split("}").find((part) => part.includes(".ada-controls .ada-ammo{"));
    const pips = WEAPON_STYLE.split("}").find((part) =>
      part.includes(".ada-controls .ada-pips > span{"),
    );
    expect(pill).not.toContain("opacity:");
    expect(pips).not.toContain("opacity:");
  });

  it("draws each count in a navy pill below the disc, clear of the name tab", () => {
    expect(HUD_AMMO_COUNT).toEqual({ clearance: 5, height: 14, padding: 4, radius: 4, top: 42 });
    expect(AMMO_COUNT_TEXT).toEqual({ inactive: "#b8b8b8", normal: "#ead4aa" });
    const counts = WEAPON_STYLE.split("}").find((part) =>
      part.includes(".ada-controls .ada-ammo{"),
    );
    expect(counts).toContain(`color:${AMMO_COUNT_TEXT.inactive}`);
    expect(WEAPON_STYLE).not.toContain(".ada-controls .ada-weapon[data-state=empty] .ada-ammo{");
    expect(WEAPON_STYLE).toContain(
      `.ada-controls .ada-weapon[data-state=selected] .ada-disc{\n  background:${HUD_DISC_STATES.selected.face}`,
    );
    // The pill overlaps the disc's lower edge, 7.5 + 33 = 40.5 below the target's top.
    expect(HUD_AMMO_COUNT.top - (HUD_BUTTON_INSET.disc + HUD_BUTTON.disc)).toBe(1.5);
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

  it("derives the dot row from the lower ring stroke with clearance above ammo", () => {
    expect(HUD_WEAPON_LEVEL.below).toBe((HUD_BUTTON.disc - HUD_BUTTON.annulus) / 2);
    const bottom =
      HUD_BUTTON.target / 2 +
      HUD_WEAPON_LEVEL.below +
      HUD_WEAPON_LEVEL.pip.size / 2 +
      HUD_WEAPON_LEVEL.pip.outline;
    expect(HUD_AMMO_COUNT.top - bottom).toBe(0.5);
  });

  it.each(Object.entries(WEAPON_FILLS))(
    "keeps state glyphs and ring bands legible on %s's solid %s face",
    (_weapon, face) => {
      const luminance = (hex: string) => {
        const rgb = [1, 3, 5]
          .map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255)
          .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
        return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
      };
      const contrast = (colour: string) =>
        (Math.max(luminance(colour), luminance(face)) + 0.05) /
        (Math.min(luminance(colour), luminance(face)) + 0.05);
      for (const colour of [
        HUD_DISC_STATES.idle.glyph,
        HUD_DISC_STATES.empty.glyph,
        HUD_DISC_STATES.selected.glyph,
        LEVEL_PIPS[2],
        LEVEL_PIPS[3],
      ]) {
        expect(contrast(colour)).toBeGreaterThanOrEqual(3);
      }
      expect(WEAPON_STYLE).toContain(`--weapon-face:${face}`);
    },
  );

  it("backs finite ammo with the canonical navy pill and an inset ink rim", () => {
    const ammo = WEAPON_STYLE.split("}").find((part) => part.includes(".ada-controls .ada-ammo{"));
    expect(ammo).toContain(`background:${HUD_DISC_STATES.idle.face}`);
    expect(ammo).toContain(`box-shadow:inset 0 0 0 ${units(HUD_BUTTON.edge)} #181425`);
    expect(ammo).toContain(`height:${units(HUD_AMMO_COUNT.height)}`);
    expect(ammo).toContain(`padding:0 ${units(HUD_AMMO_COUNT.padding)}`);
    expect(ammo).toContain(`border-radius:${units(HUD_AMMO_COUNT.radius)}`);
    const shared = hudDiscStyle(".shared-button", ".disc");
    expect(shared).toContain(":focus-visible .disc{");
    expect(shared).toContain("outline:");
    expect(shared).toContain("outline-offset:");
  });

  it.each([
    "laser",
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
});
