import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { grantAllWeapons } from "./cheats.ts";
import { createFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";
import { buy, requestPurchase } from "./shop.ts";
import { applyUpgrade } from "./upgradeDrops.ts";
import { newEconomy } from "./upgrades.ts";
import {
  addPacks,
  addWorldAmmo,
  clampAmmo,
  collectWeapon,
  noAmmo,
  UPGRADE_WEAPONS,
} from "./weapons.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
function pickup(upgrade: boolean, ammo: number) {
  const model = new GameModel(CONTENT);
  model.startGalaxy(1);
  const flight = model.state.flight!;
  flight.ownedWeapons = ["multiLaser"];
  flight.weapon = "multiLaser";
  flight.ammo.multiLaser = ammo;
  if (upgrade) {
    for (const track of ["shield", "engine", "tractor"] as const) {
      flight.levels[track] = 3;
    }
    for (const weapon of ["laser", ...UPGRADE_WEAPONS] as const) {
      flight.levels.weapons[weapon] = 3;
    }
  }
  flight.objects = [
    {
      ...flight.player,
      hp: 1,
      id: "capped-pack",
      kind: "pickup",
      radius: 10,
      ...(upgrade ? { upgrade: true } : { ammoPack: true }),
    },
  ];
  flight.shots = [];
  return model;
}

describe("finite ammunition capacity", () => {
  it("defines the approved capacity once and reads alternate catalog capacities", () => {
    expect(ECONOMY.ammo.capacity).toBe(9999);
    const catalog = { ...ECONOMY, ammo: { ...ECONOMY.ammo, capacity: 5 } };
    const ammo = noAmmo();
    expect(addPacks(catalog, "multiLaser", 3, ammo)).toBe(5);
    expect(addWorldAmmo(catalog, "multiLaser", ammo)).toBe(0);
    expect(ammo.multiLaser).toBe(5);
  });

  it.each(UPGRADE_WEAPONS)(
    "clamps full and world %s packs and returns only actual additions",
    (weapon) => {
      for (const before of [9998, 9999, 10020]) {
        const world = noAmmo();
        world[weapon] = before;
        expect(addWorldAmmo(ECONOMY, weapon, world)).toBe(before === 9998 ? 1 : 0);
        expect(world[weapon]).toBe(9999);
        const full = noAmmo();
        full[weapon] = before;
        expect(addPacks(ECONOMY, weapon, 3, full)).toBe(before === 9998 ? 1 : 0);
        expect(full[weapon]).toBe(9999);
        expect(addPacks(ECONOMY, weapon, 1, full)).toBe(0);
      }
    },
  );

  it.each(UPGRADE_WEAPONS)("caps %s acquisition, duplicate grants and upgrade gifts", (weapon) => {
    const economy = newEconomy(ECONOMY);
    economy.ammo[weapon] = 9998;
    expect(applyUpgrade(ECONOMY, { kind: "weapon", weapon }, economy)).toBe(1);
    expect(economy.ammo[weapon]).toBe(9999);
    expect(applyUpgrade(ECONOMY, { kind: "ammo", weapon }, economy)).toBe(0);
    const flight = createFlight(CONTENT, 1, 7, { known: [] });
    flight.ammo[weapon] = 9998;
    expect(collectWeapon(weapon, flight)).toBe(true);
    expect(flight.ammo[weapon]).toBe(9999);
    flight.ammo[weapon] = 9998;
    expect(collectWeapon(weapon, flight)).toBe(false);
    expect(flight.ammo[weapon]).toBe(9999);
    flight.grantedWeapons = [weapon];
    flight.ammo[weapon] = 9998;
    expect(collectWeapon(weapon, flight)).toBe(true);
    expect(flight.ammo[weapon]).toBe(9999);
  });

  it("charges the existing price for remaining capacity and refuses full-cap purchases without spending", () => {
    const economy = newEconomy(ECONOMY);
    economy.ownedWeapons = ["multiLaser"];
    economy.stardust = 100;
    economy.ammo.multiLaser = 9998;
    const item = { kind: "ammo", weapon: "multiLaser" } as const;
    expect(requestPurchase(ECONOMY, economy, item)).toEqual({
      kind: "confirm",
      left: 90,
      price: 10,
    });
    expect(buy(ECONOMY, item, economy)).toEqual({ kind: "bought", price: 10 });
    expect(economy.ammo.multiLaser).toBe(9999);
    expect(requestPurchase(ECONOMY, economy, item)).toEqual({
      kind: "refused",
      reason: "notForSale",
    });
    const full = structuredClone(economy);
    expect(buy(ECONOMY, item, economy)).toEqual({ kind: "refused", reason: "notForSale" });
    expect(economy).toEqual(full);
    economy.ammo.multiLaser--;
    expect(buy(ECONOMY, item, economy).kind).toBe("bought");
    expect(economy.stardust).toBe(80);
  });

  it("rechecks capacity when Buy is confirmed and caps a new shop weapon's grant", () => {
    const economy = newEconomy(ECONOMY);
    economy.ownedWeapons = ["multiLaser"];
    economy.stardust = 2000;
    const item = { kind: "ammo", weapon: "multiLaser" } as const;
    expect(requestPurchase(ECONOMY, economy, item).kind).toBe("confirm");
    economy.ammo.multiLaser = 9999;
    expect(buy(ECONOMY, item, economy).kind).toBe("refused");
    expect(economy.stardust).toBe(2000);
    economy.ammo.phaser = 9998;
    expect(buy(ECONOMY, { kind: "weapon", weapon: "phaser" }, economy).kind).toBe("bought");
    expect(economy.ammo.phaser).toBe(9999);
  });

  it.each([false, true])(
    "reports only clipped pickup gains and none at full (upgrade: %s)",
    (upgrade) => {
      const partial = pickup(upgrade, 9998);
      partial.step(0.01, idle);
      expect(partial.state.flight!.ammo.multiLaser).toBe(9999);
      expect(partial.drainPickupFeedback()).toEqual([
        { added: 1, kind: "ammo", weapon: "multiLaser" },
      ]);
      const full = pickup(upgrade, 9999);
      full.step(0.01, idle);
      expect(full.state.flight!.ammo.multiLaser).toBe(9999);
      expect(full.drainPickupFeedback()).toEqual([]);
    },
  );

  it("reports a one-shot refill even when firing leaves the frame's net ammo change at zero", () => {
    const model = pickup(false, 9999);
    model.step(0.01, { ...idle, aim: { x: 1, y: 0 } });
    expect(model.state.flight!.shots.length).toBeGreaterThan(0);
    expect(model.state.flight!.ammo.multiLaser).toBe(9999);
    expect(model.drainPickupFeedback()).toEqual([{ added: 1, kind: "ammo", weapon: "multiLaser" }]);
  });

  it("normalizes copied loadouts and both saved stores without mutating the source", () => {
    const model = new GameModel(CONTENT);
    model.startGalaxy(1);
    const normal = model.save();
    expect(JSON.stringify(restoreSave(normal))).toBe(normal);
    const saved = JSON.parse(normal);
    for (const weapon of UPGRADE_WEAPONS) {
      saved.economy.ammo[weapon] = 10001;
      saved.flight.ammo[weapon] = 20000;
    }
    const original = JSON.stringify(saved);
    const restored = restoreSave(saved)!;
    expect(restored).not.toBeNull();
    for (const weapon of UPGRADE_WEAPONS) {
      expect(restored.economy.ammo[weapon]).toBe(9999);
      expect(restored.flight!.ammo[weapon]).toBe(9999);
    }
    expect(JSON.stringify(saved)).toBe(original);
    expect(restoreSave(JSON.stringify(restored))).toEqual(restored);
    const loadout = { ...newEconomy(ECONOMY), ammo: saved.flight.ammo };
    const flight = createFlight(CONTENT, 1, 7, { known: [] }, loadout);
    expect(Object.values(flight.ammo)).toEqual([9999, 9999, 9999, 9999, 9999]);
    expect(JSON.stringify(saved)).toBe(original);
    expect(clampAmmo(ECONOMY, loadout.ammo)).not.toBe(loadout.ammo);
  });

  it("keeps invalid negative or fractional saves rejected and run-only cheats capped", () => {
    const model = new GameModel(CONTENT);
    model.startGalaxy(1);
    for (const value of [-1, 0.5]) {
      const saved = JSON.parse(model.save());
      saved.economy.ammo.multiLaser = value;
      expect(restoreSave(saved)).toBeNull();
    }
    expect(grantAllWeapons(model.state)).toBe(true);
    expect(Object.values(model.state.flight!.ammo).every((amount) => amount <= 9999)).toBe(true);
  });
});
