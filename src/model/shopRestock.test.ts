import { describe, expect, it } from "vitest";

import { ECONOMY } from "../data/economy.ts";
import { newGameState } from "./game.ts";
import {
  buy,
  requestPurchase,
  restockStationShop,
  shopRowState,
  stationShopRows,
  type StationShopVisit,
  stationStocks,
} from "./shop.ts";
import {
  advanceStationRestock,
  newStationRestock,
  type StationRestockState,
} from "./stations/commerce/index.ts";

function shop() {
  const { economy } = newGameState();
  economy.stardust = 100_000;
  const visit: StationShopVisit = {
    galaxy: 1,
    state: newStationRestock(),
    stationId: "station:1,2",
    stock: {
      ammo: ["multiLaser"],
      equipment: [
        { kind: "track", track: "engine" },
        { kind: "track", track: "shield" },
      ],
      weapons: ["multiLaser", "laser"],
    },
  };
  return { economy, visit };
}

describe("shop stock purchases", () => {
  it("freezes the purchased weapon and the offered upgrade level after success", () => {
    const { economy, visit } = shop();
    const weapon = { kind: "weapon", weapon: "multiLaser" } as const;
    const upgrade = { kind: "weaponUpgrade", weapon: "multiLaser" } as const;
    const laser = { kind: "weaponUpgrade", weapon: "laser" } as const;

    expect(requestPurchase(ECONOMY, economy, weapon, visit).kind).toBe("confirm");
    expect(visit.state.stations).toEqual({});
    expect(buy(ECONOMY, weapon, economy, visit).kind).toBe("bought");
    expect(buy(ECONOMY, laser, economy, visit).kind).toBe("bought");
    const before = structuredClone(economy);
    expect(requestPurchase(ECONOMY, economy, upgrade, visit).kind).toBe("refused");
    expect(buy(ECONOMY, upgrade, economy, visit).kind).toBe("refused");
    expect(buy(ECONOMY, laser, economy, visit).kind).toBe("refused");
    expect(economy).toEqual(before);

    // A subsequent upgrade elsewhere cannot change this station's purchased level.
    economy.levels.weapons.laser++;
    const [weaponRow, laserRow] = stationShopRows(ECONOMY, economy, visit.stock, "weapons", visit);
    expect(weaponRow).toMatchObject({ item: weapon, level: null, owned: true, price: null });
    expect(shopRowState(economy.stardust, weaponRow!)).toBe("owned");
    expect(laserRow).toMatchObject({
      item: laser,
      level: { current: 2 },
      owned: true,
      price: null,
    });
  });

  it("rotates a persisted slot at 300 flight seconds only when docking, without duplicating stock", () => {
    const { economy, visit } = shop();
    const engine = { kind: "track", track: "engine" } as const;
    const tractor = { kind: "track", track: "tractor" } as const;
    const shield = { kind: "track", track: "shield" } as const;
    expect(buy(ECONOMY, engine, economy, visit).kind).toBe("bought");
    advanceStationRestock(visit.state, 125);

    const saved: StationRestockState = JSON.parse(JSON.stringify(visit.state));
    const continued = { ...visit, state: saved };
    const rows = () => stationShopRows(ECONOMY, economy, continued.stock, "equipment", continued);
    advanceStationRestock(saved, 174.75);
    restockStationShop(ECONOMY, economy, 1, continued.stock, continued);
    expect(rows().map(({ item }) => item)).toEqual([engine, shield]);
    expect(shopRowState(economy.stardust, rows()[0]!)).toBe("owned");

    advanceStationRestock(saved, 0.25);
    expect(rows().map(({ item }) => item)).toEqual([engine, shield]);
    restockStationShop(ECONOMY, economy, 1, continued.stock, continued);
    expect(rows().map(({ item }) => item)).toEqual([tractor, shield]);
    expect(rows()[0]?.price).toBe(ECONOMY.trackPrices.tractor[0]);
    expect(stationStocks(continued.stock, tractor, continued)).toBe(true);
    expect(requestPurchase(ECONOMY, economy, engine, continued).kind).toBe("refused");
    expect(buy(ECONOMY, tractor, economy, continued).kind).toBe("bought");
    expect(economy.levels.engine).toBe(2);
  });

  it("keeps an ammo purchase Owned until a distinct replacement becomes eligible", () => {
    const { economy, visit: initial } = shop();
    const visit: StationShopVisit = {
      ...initial,
      stock: { ...initial.stock, ammo: ["multiLaser", "rapidMissile"] },
    };
    const ammo = { kind: "ammo", weapon: "multiLaser" } as const;
    economy.ownedWeapons.push("multiLaser");
    expect(buy(ECONOMY, ammo, economy, visit).kind).toBe("bought");
    advanceStationRestock(visit.state, 300);
    const rows = () => stationShopRows(ECONOMY, economy, visit.stock, "ammo", visit);
    restockStationShop(ECONOMY, economy, 3, visit.stock, visit);
    expect(shopRowState(economy.stardust, rows()[0]!)).toBe("owned");
    expect(buy(ECONOMY, ammo, economy, visit).kind).toBe("refused");

    economy.ownedWeapons.push("heavyMissile");
    restockStationShop(ECONOMY, economy, 3, visit.stock, visit);
    expect(rows()[0]).toMatchObject({
      item: { kind: "ammo", weapon: "heavyMissile" },
      price: ECONOMY.ammo.packPrice,
    });
  });
  it("keeps a purchased paint owned after replacing its stock slot", () => {
    const { economy, visit: initial } = shop();
    const paint = { kind: "paint", scheme: "cobalt" } as const;
    const visit: StationShopVisit = {
      ...initial,
      stock: { ...initial.stock, equipment: [paint, ...initial.stock.equipment] },
    };
    expect(buy(ECONOMY, paint, economy, visit).kind).toBe("bought");
    const rows = () => stationShopRows(ECONOMY, economy, visit.stock, "equipment", visit);
    expect(rows()[0]).toMatchObject({ item: paint, owned: true, price: null });
    expect(shopRowState(economy.stardust, rows()[0]!)).toBe("owned");

    advanceStationRestock(visit.state, 300);
    restockStationShop(ECONOMY, economy, 1, visit.stock, visit);
    expect(rows().some(({ item }) => item.kind === "paint" && item.scheme === "cobalt")).toBe(
      false,
    );
    expect(economy.paints).toContain("cobalt");
    expect(economy.paint).toBe("cobalt");
  });
});
