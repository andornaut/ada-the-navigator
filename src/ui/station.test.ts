import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { jobAction, rowAction, STATION_STYLE, stationBack, weaponItemGlyph } from "./station.ts";
import { buttonProperty } from "./uiSkin.ts";

describe("station card back steps", () => {
  it("returns from the shop and the job board to the station card and undocks only from it", () => {
    expect(stationBack("shop", false)).toBe("card");
    expect(stationBack("jobs", false)).toBe("card");
    expect(stationBack("card", false)).toBe("undock");
  });

  it("cancels an open confirm back to the card under it", () => {
    expect(stationBack("shop", true)).toBe("shop");
    expect(stationBack("jobs", true)).toBe("jobs");
  });
});

describe("job row taps", () => {
  it("accept offers, keep refused offers tappable so they refuse, and drop the held job", () => {
    expect(jobAction("offer")).toBe("accept");
    expect(jobAction("busy")).toBe("accept");
    expect(jobAction("held")).toBe("drop");
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
  it("draws every weapon's two-frame shop sheet", () => {
    for (const weapon of [
      "laser",
      "rapidMissile",
      "multiLaser",
      "heavyMissile",
      "scattershot",
      "phaser",
    ] as const) {
      expect(weaponItemGlyph(weapon)).toEqual({
        key: `icon-shop-weapon-${weapon}`,
        kind: "sprite",
      });
    }
    expect(STATION_STYLE).not.toContain("ada-glyph-weapon");
  });

  it("places an upgrade composite's weapon sheet at (0, 4) under its badge", () => {
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

  it("draws every tile row's second line and Owned in row supporting, and busy rows in row disabled", () => {
    const rule = (selector: string) => {
      const from = STATION_STYLE.indexOf(`${selector}{`);
      expect(from, selector).toBeGreaterThanOrEqual(0);
      return STATION_STYLE.slice(from, STATION_STYLE.indexOf("}", from));
    };
    expect(rule(".ada-controls .ada-shop-level")).toContain("color:#c0bbd0");
    expect(rule(".ada-controls [data-state=unaffordable] .ada-shop-level")).toContain(
      "color:#a6a2b8",
    );
    expect(rule(".ada-controls .ada-owned")).toContain("color:#c0bbd0");
    expect(rule(".ada-controls .ada-shop-row[data-state=unaffordable]")).toContain("color:#a6a2b8");
  });

  it("gives job rows their type's sheet and a compact action that takes no press of its own", () => {
    for (const type of ["survey", "delivery", "rescue", "hunt", "activity"]) {
      expect(
        existsSync(new URL(`../../public/art/ui/sprites/icon-job-${type}.png`, import.meta.url)),
      ).toBe(true);
    }
    expect(STATION_STYLE).toContain(".ada-controls .ada-job-action.ada-compact{");
    expect(STATION_STYLE).toContain("pointer-events:none");
    expect(STATION_STYLE).toContain("var(--ui-button-primary-disabled)");
    // No row keeps a placeholder flat mark: the activity row takes its sheet too.
    expect(STATION_STYLE).not.toMatch(/ada-job-glyph\[data-type=/u);
  });
});
