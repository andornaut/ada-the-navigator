import { describe, expect, it } from "vitest";

import { rowAction, STATION_STYLE, stationBack, weaponItemGlyph } from "./station.ts";
import { buttonProperty } from "./ui-skin.ts";

describe("station card back steps", () => {
  it("returns from the shop to the station card and undocks only from the card", () => {
    expect(stationBack("shop", false)).toBe("card");
    expect(stationBack("card", false)).toBe("undock");
  });

  it("cancels an open confirm back to the shop", () => {
    expect(stationBack("shop", true)).toBe("shop");
  });
});

describe("shop row taps", () => {
  it("keeps unaffordable rows tappable so they refuse", () => {
    expect(rowAction("unaffordable")).toBe("request");
    expect(rowAction("forSale")).toBe("request");
  });

  it("applies an owned paint at once and ignores owned and in-use rows", () => {
    expect(rowAction("selectable")).toBe("select");
    expect(rowAction("owned")).toBe("none");
    expect(rowAction("inUse")).toBe("none");
  });
});

describe("weapon shop glyphs", () => {
  it("draws a weapon's two-frame shop sheet, or its HUD glyph as a mask without one", () => {
    expect(weaponItemGlyph("basic")).toEqual({ key: "icon-shop-weapon-basic", kind: "sprite" });
    expect(weaponItemGlyph("heavyMissile")).toEqual({
      key: "icon-shop-weapon-heavyMissile",
      kind: "sprite",
    });
    expect(weaponItemGlyph("scattershot")).toEqual({ kind: "weapon", weapon: "scattershot" });
  });

  it("places an upgrade composite's weapon glyph, sheet or mask, at (0, 4) under its badge", () => {
    expect(STATION_STYLE).toContain(".ada-controls .ada-glyph-upgrade > .ada-glyph{");
    expect(STATION_STYLE).not.toContain(".ada-glyph-upgrade .ada-glyph-weapon{");
  });
});

describe("shop style", () => {
  it("draws rows with the ui-button-tile frames", () => {
    for (const tag of ["normal", "pressed", "disabled"] as const) {
      expect(STATION_STYLE).toContain(`var(${buttonProperty("ui-button-tile", tag)})`);
    }
  });
});
