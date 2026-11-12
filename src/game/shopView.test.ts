import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { shopRows } from "../model/shop.ts";
import { newEconomy } from "../model/upgrades.ts";
import { itemGlyph, paintSwatchPath, stationRow } from "./shopView.ts";

const publicFile = (path: string) => new URL(`../../public${path}`, import.meta.url);

describe("shop rows on the station view", () => {
  it("maps items to Art's shop glyphs", () => {
    // Laser is never for sale; its sheet draws in its upgrade composite.
    for (const weapon of [
      "rapidMissile",
      "multiLaser",
      "heavyMissile",
      "scattershot",
      "phaser",
    ] as const) {
      const key = `icon-shop-weapon-${weapon}`;
      expect(itemGlyph(ECONOMY, { kind: "weapon", weapon })).toEqual({ key, kind: "sprite" });
      expect(existsSync(publicFile(`/art/ui/sprites/${key}.png`))).toBe(true);
      // Two frames: normal, then disabled for an unaffordable row.
      const sheet = JSON.parse(readFileSync(publicFile(`/art/ui/sprites/${key}.json`), "utf8"));
      expect(sheet.meta.frameTags.map(({ name }: { name: string }) => name)).toEqual([
        "normal",
        "disabled",
      ]);
    }
    expect(itemGlyph(ECONOMY, { kind: "weaponUpgrade", weapon: "laser" })).toEqual({
      kind: "upgrade",
      weapon: "laser",
    });
    for (const [track, key] of [
      ["shield", "icon-shop-shield"],
      ["engine", "icon-shop-engine-tuning"],
      ["tractor", "icon-shop-tractor-beam"],
    ] as const) {
      expect(itemGlyph(ECONOMY, { kind: "track", track })).toEqual({ key, kind: "sprite" });
      expect(existsSync(publicFile(`/art/ui/sprites/${key}.png`))).toBe(true);
    }
  });

  it("draws each paint scheme's swatch from its idle frame 24", () => {
    expect(paintSwatchPath("classic", "classic")).toBe("/art/ship-24.svg");
    expect(paintSwatchPath("iris", "classic")).toBe("/art/paint/iris/ship-24.svg");
    for (const scheme of Object.keys(ECONOMY.paints)) {
      expect(existsSync(publicFile(paintSwatchPath(scheme, ECONOMY.defaultPaint)))).toBe(true);
    }
  });

  it("matches Art's paint schemes, ids and prices", () => {
    const art = JSON.parse(readFileSync(publicFile("/art/ship-paint.json"), "utf8")) as {
      schemes: readonly { id: string; name: string; price: number; top: string }[];
    };
    expect(art.schemes.map(({ id }) => id)).toEqual(ECONOMY.paintOrder);
    for (const scheme of art.schemes) {
      expect(ECONOMY.paints[scheme.id]?.price).toBe(scheme.price);
      expect(ECONOMY.paints[scheme.id]?.top).toBe(scheme.top);
      expect(CONTENT.labels[ECONOMY.paints[scheme.id]!.label]).toBe(scheme.name);
    }
  });

  it("puts paint rows in their own group with levels and prices for the rest", () => {
    const economy = { ...newEconomy(ECONOMY), stardust: 130 };
    const rows = shopRows(ECONOMY, economy, 1, "ship").map((row) =>
      stationRow(ECONOMY, CONTENT.labels, economy.stardust, row),
    );
    expect(rows[0]).toMatchObject({
      glyph: { key: "icon-shop-shield", kind: "sprite" },
      group: "items",
      level: "Level 1 of 3",
      name: "Shield",
      price: 450,
      state: "unaffordable",
    });
    expect(rows[2]).toMatchObject({ name: "Tractor beam", price: 120, state: "forSale" });
    expect(rows.slice(3).map((row) => [row.group, row.name, row.state])).toEqual([
      ["paint", "Classic", "inUse"],
      ["paint", "Cobalt", "forSale"],
      ["paint", "Seafoam", "forSale"],
      ["paint", "Graphite", "forSale"],
      ["paint", "Iris", "forSale"],
    ]);
  });
});
