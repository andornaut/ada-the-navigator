import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { uiIconUrl } from "../data/uiIconUrl.ts";
import { type ShopRow, shopRows } from "../model/shop.ts";
import { newEconomy } from "../model/upgrades.ts";
import { SHIPPED_SHIP_SOURCES } from "../testing/shippedShipSources.ts";
import { itemGlyph, shopItemDetail, stationRow } from "./shopView.ts";

const publicFile = (path: string) => new URL(`../../public${path}`, import.meta.url);

describe("shop rows on the station view", () => {
  it("maps items to Art's shop glyphs", () => {
    for (const weapon of [
      "rapidMissile",
      "multiLaser",
      "heavyMissile",
      "scattershot",
      "phaser",
    ] as const) {
      const path = uiIconUrl(`weapon-${weapon}`);
      expect(itemGlyph(ECONOMY, { kind: "weapon", weapon })).toEqual({ kind: "mask", path });
      expect(readFileSync(publicFile(path), "utf8")).toContain('viewBox="0 0 20 20"');
    }
    for (const [weapon, ammo] of [
      ["rapidMissile", "missile"],
      ["heavyMissile", "missile"],
      ["multiLaser", "energy"],
      ["phaser", "energy"],
      ["scattershot", "shell"],
    ] as const) {
      const path = uiIconUrl(`ammo-${ammo}`);
      expect(itemGlyph(ECONOMY, { kind: "ammo", weapon })).toEqual({ kind: "mask", path });
      expect(readFileSync(publicFile(path), "utf8")).toContain('viewBox="0 0 20 20"');
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
      expect(itemGlyph(ECONOMY, { kind: "track", track })).toEqual({ key, kind: "stateVector" });
    }
  });

  it("ships equipment glyphs in both SVG states without legacy sprite pairs", () => {
    for (const key of [
      "icon-shop-engine-tuning",
      "icon-shop-shield",
      "icon-shop-ship-paint",
      "icon-shop-tractor-beam",
    ]) {
      for (const suffix of ["", "-disabled"]) {
        expect(readFileSync(publicFile(uiIconUrl(`${key}${suffix}`)), "utf8")).toContain(
          'width="20" height="20"',
        );
      }
      for (const extension of ["png", "json"]) {
        expect(existsSync(publicFile(`/art/ui/sprites/${key}.${extension}`))).toBe(false);
      }
    }
  });

  it("draws each paint scheme's swatch from its idle frame 48", () => {
    const source = SHIPPED_SHIP_SOURCES!;
    const swatch = (scheme: string) =>
      scheme === ECONOMY.defaultPaint
        ? source.standaloneClassic(48)?.url
        : source.ship(scheme, 48)?.url;
    for (const scheme of ECONOMY.paintOrder) {
      const item = { kind: "paint", scheme } as const;
      expect(itemGlyph(ECONOMY, item, swatch)).toEqual({
        kind: "swatch",
        path: swatch(scheme),
      });
      expect(swatch(scheme)).toMatch(/^data:image\/svg\+xml;base64,/u);
    }
    expect(itemGlyph(ECONOMY, { kind: "paint", scheme: ECONOMY.defaultPaint })).toEqual({
      kind: "swatch",
      path: "",
    });
  });

  it("matches Art's paint schemes, ids and colours", () => {
    const art = JSON.parse(readFileSync(publicFile("/art/ship-paint.json"), "utf8")) as {
      schemes: readonly { id: string; name: string; top: string }[];
    };
    expect(art.schemes.map(({ id }) => id)).toEqual(ECONOMY.paintOrder);
    for (const scheme of art.schemes) {
      expect(ECONOMY.paints[scheme.id]?.top).toBe(scheme.top);
      expect(CONTENT.labels[ECONOMY.paints[scheme.id]!.label]).toBe(scheme.name);
    }
  });

  it("uses the offered tier for upgrades and keeps ammo pack counts", () => {
    const labels = CONTENT.labels;
    const shield = {
      inUse: false,
      item: { kind: "track", track: "shield" },
      level: { current: 2, max: 3 },
      owned: false,
      price: 900,
    } as const;
    expect(shopItemDetail(ECONOMY, labels, shield)).toEqual({
      description: "Absorbs damage and recharges after a quiet stretch.",
      level: 3,
      name: "Shield",
    });
    expect(stationRow(ECONOMY, labels, 900, shield).level).toBe("Level 2 of 3");

    const ammo = {
      ...shield,
      item: { kind: "ammo", weapon: "heavyMissile" },
      level: null,
    } as const;
    expect(shopItemDetail(ECONOMY, labels, ammo)).toMatchObject({ description: "×75" });
  });

  it("puts paint rows in their own group with levels and prices for the rest", () => {
    const economy = { ...newEconomy(ECONOMY), stardust: 130 };
    const rows = shopRows(ECONOMY, economy, 1, "ship").map((row) =>
      stationRow(ECONOMY, CONTENT.labels, economy.stardust, row),
    );
    expect(rows[0]).toMatchObject({
      glyph: { key: "icon-shop-shield", kind: "stateVector" },
      group: "items",
      level: "Level 1 of 3",
      name: "Shield",
      price: 450,
      state: "unaffordable",
    });
    expect(rows[2]).toMatchObject({ name: "Tractor beam", price: 120, state: "forSale" });
    expect(rows.slice(3).map((row) => [row.group, row.name, row.state])).toEqual([
      ["paint", "Classic", "inUse"],
      ["paint", "Cobalt", "unaffordable"],
      ["paint", "Obsidian", "unaffordable"],
      ["paint", "Crimson", "unaffordable"],
      ["paint", "Iris", "unaffordable"],
      ["paint", "Amber", "unaffordable"],
    ]);
  });
});

it("retains selected unsupported ammunition with caller-supplied requirement text", () => {
  const economy = newEconomy(ECONOMY);
  const row = {
    inUse: false,
    item: { kind: "ammo" as const, weapon: "rapidMissile" as const },
    level: null,
    owned: false,
    price: null,
    requiresWeapon: "rapidMissile" as const,
  };
  const view = stationRow(
    ECONOMY,
    CONTENT.labels,
    economy.stardust,
    row,
    (weapon) => `Caller requirement: ${weapon}`,
  );
  expect(view).toMatchObject({
    group: "ammo",
    price: null,
    reason: "Caller requirement: rapidMissile",
    requiresWeapon: "rapidMissile",
    state: "unaffordable",
  });
  const supported: ShopRow = { ...row };
  delete supported.requiresWeapon;
  expect(stationRow(ECONOMY, CONTENT.labels, economy.stardust, supported).reason).toBeUndefined();
});
