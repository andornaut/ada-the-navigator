import { describe, expect, it, vi } from "vitest";

import { ECONOMY, unlockedWeapons } from "../data/economy.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import { dockedStock } from "../testing/stationStock.ts";
import { newGameState } from "./game.ts";
import { shopRowState, stationShopRows, stationStock, stationStocks } from "./shop.ts";

describe("inventory-independent station stock", () => {
  it("selects bounded station-specific identities and eligible ammo without random draws", () => {
    const random = vi.spyOn(crypto, "getRandomValues");
    random.mockClear();
    try {
      for (const position of [1, 2, 3, 4, 5, 6] as const) {
        const stock = stationStock(ECONOMY, position, "station:1,2");
        for (const offers of [stock.equipment, stock.weapons, stock.ammo]) {
          expect(offers.length).toBeLessThanOrEqual(4);
        }
        expect(stock.equipment.length).toBeGreaterThanOrEqual(2);
        expect(stock.weapons.length).toBeGreaterThanOrEqual(2);
        expect(new Set(stock.weapons).size).toBe(stock.weapons.length);
        expect(stock.ammo.length).toBeGreaterThanOrEqual(
          Math.min(2, unlockedWeapons(position).length),
        );
        for (const weapon of [...stock.weapons.filter((id) => id !== "laser"), ...stock.ammo]) {
          expect(unlockedWeapons(position)).toContain(weapon);
        }
        expect(stationStock(ECONOMY, position, "station:1,2")).toEqual(stock);
      }
      expect(random).not.toHaveBeenCalled();
    } finally {
      random.mockRestore();
    }
  });
  it("keeps selected identities after ownership, ammo, balances and upgrade changes", () => {
    const economy = newGameState().economy;
    const stock = stationStock(ECONOMY, 1, "station:1,2");
    const rows = (["ammo", "weapons"] as const).flatMap((category) =>
      stationShopRows(ECONOMY, economy, stock, category),
    );
    economy.ownedWeapons = ["multiLaser"];
    economy.ammo.multiLaser = ECONOMY.ammo.capacity;
    economy.stardust = 100000;
    economy.levels.weapons.laser = 3;
    economy.levels.weapons.multiLaser = 3;
    const after = (["ammo", "weapons"] as const).flatMap((category) =>
      stationShopRows(ECONOMY, economy, stock, category),
    );
    expect(after.map(({ item }) => ("weapon" in item ? item.weapon : null))).toEqual(
      rows.map(({ item }) => ("weapon" in item ? item.weapon : null)),
    );
    expect(after.filter(({ item }) => item.kind === "weaponUpgrade")).toHaveLength(2);
    expect(after.find(({ item }) => item.kind === "ammo")!.requiresWeapon).toBeUndefined();
  });
  it("keeps unowned ammo visible and refuses purchase until weapon ownership", () => {
    const model = dockedStock(),
      economy = model.state.economy;
    const locked = model.shopRows("weapons").find(({ item }) => item.kind === "ammo")!;
    expect(locked.requiresWeapon).toBe("multiLaser");
    expect(shopRowState(economy.stardust, locked)).toBe("unaffordable");
    const before = structuredClone(economy);
    expect(model.buy(locked.item)).toEqual({ kind: "refused", reason: "notForSale" });
    expect(economy).toEqual(before);
    expect(model.buy({ kind: "weapon", weapon: "multiLaser" }).kind).toBe("bought");
    const row = model.shopRows("weapons").find(({ item }) => item.kind === "ammo")!;
    expect(row.item).toEqual(locked.item);
    expect(row.requiresWeapon).toBeUndefined();
    model.state.flight!.ammo.multiLaser = ECONOMY.ammo.capacity;
    const full = model.state.economy.stardust;
    expect(model.buy(row.item)).toEqual({ kind: "refused", reason: "notForSale" });
    expect(model.state.economy.stardust).toBe(full);
  });
  it("enforces selected stock and existing station-service boundaries at actual purchase entry", () => {
    const model = dockedStock(6);
    const selected = stationStock(ECONOMY, ROUTE_POSITION[6], model.state.docked!);
    const other = unlockedWeapons(ROUTE_POSITION[6]).find(
      (weapon) => !selected.weapons.includes(weapon),
    )!;
    expect(stationStocks(selected, { kind: "weapon", weapon: other })).toBe(false);
    expect(model.requestPurchase({ kind: "weapon", weapon: other })).toEqual({
      kind: "refused",
      reason: "notForSale",
    });
    expect(model.shopRows("ship")).toEqual([]);
    const equipment = dockedStock(1, "equipment").shopGroups()!;
    expect(new Set(equipment.map(({ category }) => category)).size).toBe(2);
    expect(equipment.some(({ category }) => category === "equipment")).toBe(true);
    expect(dockedStock(1, "jobs").shopGroups()).toBeUndefined();
  });
});
