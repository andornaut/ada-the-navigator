import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { weaponButtonState, weaponGlyphPath } from "./weapons.ts";

describe("HUD weapon buttons", () => {
  it("shows the selected weapon as selected even while weapon changes are locked", () => {
    expect(weaponButtonState({ id: "basic", locked: false, selected: true })).toBe("selected");
    expect(weaponButtonState({ id: "basic", locked: true, selected: true })).toBe("selected");
  });

  it("locks every other weapon in combat and through the 5 seconds after", () => {
    expect(weaponButtonState({ id: "missiles", locked: true, selected: false })).toBe("locked");
    expect(weaponButtonState({ id: "missiles", locked: false, selected: false })).toBe("idle");
  });

  it("draws Art's single-colour 24px glyphs", () => {
    expect(weaponGlyphPath("tripleLaser")).toBe("/art/ui/icons/weapon-tripleLaser-24.svg");
    for (const weapon of ["basic", "missiles", "tripleLaser", "scattershot"] as const) {
      const file = new URL(`../../public${weaponGlyphPath(weapon)}`, import.meta.url);
      expect(existsSync(file)).toBe(true);
    }
  });
});
