import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY, worldAmmoPack } from "../data/economy.ts";
import { playOpening } from "../testing/launch.ts";
import { rollAmmoDrop, rollRockAmmoDrop } from "./drops.ts";
import { createFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";
import { buy } from "./shop.ts";
import { applyUpgrade } from "./upgradeDrops.ts";
import { newEconomy } from "./upgrades.ts";
import {
  addPacks,
  addWorldAmmo,
  collectWeapon,
  grantedAmmo,
  noAmmo,
  UPGRADE_WEAPONS,
} from "./weapons.ts";

const PACKS = [
  ["multiLaser", 300, 75, 900],
  ["rapidMissile", 260, 65, 780],
  ["heavyMissile", 40, 10, 120],
  ["scattershot", 60, 15, 180],
  ["phaser", 40, 10, 120],
] as const;
const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

function launched() {
  const model = new GameModel(CONTENT);
  model.startGalaxy(1);
  playOpening(model);
  model.state.flight!.objects = [];
  model.state.flight!.shots = [];
  return model;
}

describe("world ammunition quantities", () => {
  it.each(PACKS)("derives %s world ammo from its canonical shop pack", (weapon, shop, world) => {
    expect(ECONOMY.ammo.pack[weapon]).toBe(shop);
    expect(worldAmmoPack(ECONOMY, weapon)).toBe(world);
    const ammo = noAmmo();
    ammo[weapon] = 7;
    expect(addWorldAmmo(ECONOMY, weapon, ammo)).toBe(world);
    expect(ammo[weapon]).toBe(7 + world);
    expect(addPacks(ECONOMY, weapon, 1, ammo)).toBe(shop);
    expect(ammo[weapon]).toBe(7 + world + shop);
  });

  it.each([
    [0, 1],
    [1, 1],
    [2, 1],
    [6, 2],
    [10, 3],
    [7, 2],
    [9, 2],
    [14, 4],
  ])("rounds a quarter of shop pack %i to %i with a one-shot minimum", (shop, world) => {
    const catalog = {
      ...ECONOMY,
      ammo: { ...ECONOMY.ammo, pack: { ...ECONOMY.ammo.pack, heavyMissile: shop } },
    };
    expect(worldAmmoPack(catalog, "heavyMissile")).toBe(world);
  });

  it("reads the configured world fraction without a second world-ammo table", () => {
    expect(ECONOMY.ammo.worldPackFraction).toBe(0.25);
    const catalog = { ...ECONOMY, ammo: { ...ECONOMY.ammo, worldPackFraction: 0.5 } };
    expect(worldAmmoPack(catalog, "phaser")).toBe(20);
  });

  it("returns the immediate grant rather than the net frame delta while firing", () => {
    const economy = newEconomy(ECONOMY);
    economy.ammo.multiLaser = 10;
    const beforeFrame = economy.ammo.multiLaser;
    economy.ammo.multiLaser--;
    const added = applyUpgrade(ECONOMY, { kind: "ammo", weapon: "multiLaser" }, economy);
    economy.ammo.multiLaser--;
    expect(added).toBe(75);
    expect(economy.ammo.multiLaser - beforeFrame).toBe(73);
    expect(applyUpgrade(ECONOMY, { kind: "track", level: 2, track: "shield" }, economy)).toBe(0);
  });

  it.each(PACKS)(
    "collects an ordinary world ammo item for %s and saves its exact amount",
    (weapon, _shop, world) => {
      const model = launched();
      const flight = model.state.flight!;
      flight.ownedWeapons = [weapon];
      flight.ammo[weapon] = 5;
      flight.objects = [
        { ...flight.player, ammoPack: true, hp: 1, id: "world-ammo", kind: "pickup", radius: 10 },
      ];
      model.step(0.01, idle);
      expect(flight.ammo[weapon]).toBe(5 + world);
      expect(model.state.economy.ammo[weapon]).toBe(5 + world);
      expect(restoreSave(model.save())!.flight!.ammo[weapon]).toBe(5 + world);
    },
  );

  it("uses the same world quantities when a collected upgrade falls back to ammo", () => {
    const model = launched();
    const flight = model.state.flight!;
    flight.ownedWeapons = [...UPGRADE_WEAPONS];
    flight.levels.engine = flight.levels.shield = flight.levels.tractor = 3;
    for (const weapon of ["laser", ...UPGRADE_WEAPONS] as const) {
      flight.levels.weapons[weapon] = 3;
    }
    flight.ammo = { heavyMissile: 5, multiLaser: 5, phaser: 5, rapidMissile: 5, scattershot: 5 };
    flight.objects = [
      { ...flight.player, hp: 1, id: "fallback", kind: "pickup", radius: 10, upgrade: true },
    ];
    model.step(0.01, idle);
    const changed = PACKS.filter(([weapon]) => flight.ammo[weapon] > 5);
    expect(changed).toHaveLength(1);
    const [weapon, , world] = changed[0]!;
    expect(flight.ammo[weapon] - 5).toBe(world);
    expect(model.state.economy.ammo).toEqual(flight.ammo);
  });

  it.each(PACKS)(
    "preserves %s shop purchases and full weapon-acquisition grants",
    (weapon, shop, _world, grant) => {
      const economy = newEconomy(ECONOMY);
      economy.stardust = 10000;
      expect(buy(ECONOMY, { kind: "weapon", weapon }, economy).kind).toBe("bought");
      expect(economy.ammo[weapon]).toBe(grant);
      expect(buy(ECONOMY, { kind: "ammo", weapon }, economy)).toEqual({
        kind: "bought",
        price: 10,
      });
      expect(economy.ammo[weapon]).toBe(grant + shop);
      const gift = newEconomy(ECONOMY);
      expect(applyUpgrade(ECONOMY, { kind: "weapon", weapon }, gift)).toBe(grant);
      expect(gift.ammo[weapon]).toBe(grant);
      const flight = createFlight(CONTENT, 1, 7, { known: [] });
      expect(collectWeapon(weapon, flight)).toBe(true);
      expect(flight.ammo[weapon]).toBe(grant);
      expect(collectWeapon(weapon, flight)).toBe(false);
      expect(flight.ammo[weapon]).toBe(grant + shop);
      expect(grantedAmmo([weapon])[weapon]).toBe(grant);
      expect(ECONOMY.ammo.grantPacks).toBe(3);
      expect(ECONOMY.ammo.duplicatePacks).toBe(1);
    },
  );
});

describe("world ammunition odds", () => {
  it("uses the approved 30 percent small-craft and 4 percent rock odds with strict boundaries", () => {
    expect(ECONOMY.ammo.dropChance).toBe(0.3);
    expect(ECONOMY.ammo.rockDropChance).toBe(0.04);
    expect(rollAmmoDrop(ECONOMY, ["phaser"], "fighter", () => 0.299999)).toBe(true);
    expect(rollAmmoDrop(ECONOMY, ["phaser"], "fighter", () => 0.3)).toBe(false);
    expect(rollRockAmmoDrop(ECONOMY, ["phaser"], () => 0.039999)).toBe(true);
    expect(rollRockAmmoDrop(ECONOMY, ["phaser"], () => 0.04)).toBe(false);
  });

  it("preserves real ownership eligibility, heavy exclusions, weapon weights and upgrade odds", () => {
    for (const owned of [[], ["laser"]] as const) {
      expect(rollAmmoDrop(ECONOMY, owned, "fighter", () => 0)).toBe(false);
      expect(rollRockAmmoDrop(ECONOMY, owned, () => 0)).toBe(false);
    }
    for (const archetype of ["frigate", "platform", "capital"] as const) {
      expect(rollAmmoDrop(ECONOMY, ["phaser"], archetype, () => 0)).toBe(false);
    }
    expect(ECONOMY.ammo.dropWeights).toEqual({
      heavyMissile: 9,
      multiLaser: 16,
      phaser: 5,
      rapidMissile: 12,
      scattershot: 7,
    });
    expect(ECONOMY.upgradeDropChance).toEqual({ heavy: 0.1, small: 0.0025 });
  });
});
