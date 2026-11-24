import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY, worldAmmoPack } from "../data/economy.ts";
import { playOpening } from "../testing/launch.ts";
import { rollAmmoDrop, rollRockAmmoDrop } from "./drops.ts";
import { createFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";
import { buy, itemAbout, onSale, packCount, shopRow } from "./shop.ts";
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
  ["multiLaser", 300, 100, 900, 300],
  ["rapidMissile", 180, 60, 780, 260],
  ["heavyMissile", 75, 25, 120, 40],
  ["scattershot", 120, 40, 180, 60],
  ["phaser", 75, 25, 120, 40],
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
  it.each(PACKS)("adds the separate %s world and shop quantities", (weapon, shop, world) => {
    expect(ECONOMY.ammo.pack[weapon]).toBe(shop);
    expect(worldAmmoPack(ECONOMY, weapon)).toBe(world);
    const ammo = noAmmo();
    ammo[weapon] = 7;
    expect(addWorldAmmo(ECONOMY, weapon, ammo)).toBe(world);
    expect(ammo[weapon]).toBe(7 + world);
    expect(addPacks(ECONOMY, weapon, 1, ammo)).toBe(shop);
    expect(ammo[weapon]).toBe(7 + world + shop);
  });

  it("keeps world and shop quantities independent when either table changes", () => {
    const catalog = {
      ...ECONOMY,
      ammo: {
        ...ECONOMY.ammo,
        pack: { ...ECONOMY.ammo.pack, heavyMissile: 99 },
        worldPack: { ...ECONOMY.ammo.worldPack, phaser: 12 },
      },
    };
    expect(worldAmmoPack(catalog, "heavyMissile")).toBe(25);
    expect(worldAmmoPack(catalog, "phaser")).toBe(12);
    expect(addPacks(catalog, "heavyMissile", 1, noAmmo())).toBe(99);
    expect(addPacks(catalog, "phaser", 1, noAmmo())).toBe(75);
  });

  it("returns the immediate grant rather than the net frame delta while firing", () => {
    const economy = newEconomy(ECONOMY);
    economy.ammo.multiLaser = 10;
    const beforeFrame = economy.ammo.multiLaser;
    economy.ammo.multiLaser--;
    const added = applyUpgrade(ECONOMY, { kind: "ammo", weapon: "multiLaser" }, economy);
    economy.ammo.multiLaser--;
    expect(added).toBe(100);
    expect(economy.ammo.multiLaser - beforeFrame).toBe(98);
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
    "shows and sells %s shop packs for 25 Stardust while preserving acquisition and duplicate grants",
    (weapon, shop, _world, grant, duplicate) => {
      const economy = newEconomy(ECONOMY);
      economy.stardust = 10000;
      expect(buy(ECONOMY, { kind: "weapon", weapon }, economy).kind).toBe("bought");
      expect(economy.ammo[weapon]).toBe(grant);
      const item = { kind: "ammo", weapon } as const;
      expect(onSale(6, item)).toBe(true);
      expect(packCount(ECONOMY, CONTENT.labels, weapon)).toBe(`×${shop}`);
      expect(itemAbout(ECONOMY, CONTENT.labels, item)).toBe(`×${shop}`);
      expect(shopRow(ECONOMY, economy, item)).toMatchObject({ price: 25 });
      const before = economy.stardust;
      expect(buy(ECONOMY, item, economy)).toEqual({ kind: "bought", price: 25 });
      expect(economy.stardust).toBe(before - 25);
      expect(economy.ammo[weapon]).toBe(grant + shop);
      economy.stardust = 24;
      expect(buy(ECONOMY, item, economy).kind).toBe("refused");
      expect(economy.stardust).toBe(24);
      expect(economy.ammo[weapon]).toBe(grant + shop);
      const gift = newEconomy(ECONOMY);
      expect(applyUpgrade(ECONOMY, { kind: "weapon", weapon }, gift)).toBe(grant);
      expect(gift.ammo[weapon]).toBe(grant);
      const flight = createFlight(CONTENT, 1, 7, { known: [] });
      expect(collectWeapon(weapon, flight)).toBe(true);
      expect(flight.ammo[weapon]).toBe(grant);
      expect(collectWeapon(weapon, flight)).toBe(false);
      expect(flight.ammo[weapon]).toBe(grant + duplicate);
      expect(grantedAmmo([weapon])[weapon]).toBe(grant);
    },
  );
});

describe("world ammunition odds", () => {
  it.each(["fighter", "swarm", "interceptor", "retaliator"] as const)(
    "uses a strict 10 percent ammo boundary for the %s",
    (archetype) => {
      expect(ECONOMY.ammo.dropChance).toBe(0.1);
      expect(rollAmmoDrop(ECONOMY, ["phaser"], archetype, () => 0.1 - Number.EPSILON)).toBe(true);
      expect(rollAmmoDrop(ECONOMY, ["phaser"], archetype, () => 0.1)).toBe(false);
      expect(rollAmmoDrop(ECONOMY, ["phaser"], archetype, () => 0.1 + Number.EPSILON)).toBe(false);
    },
  );

  it.each([
    ["small", 0.005],
    ["medium", 0.01],
    ["large", 0.02],
    ["huge", 0.04],
  ] as const)("uses the strict %s asteroid boundary at %f", (size, chance) => {
    expect(ECONOMY.ammo.rockDropChance[size]).toBe(chance);
    expect(rollRockAmmoDrop(ECONOMY, ["phaser"], size, () => chance - Number.EPSILON)).toBe(true);
    expect(rollRockAmmoDrop(ECONOMY, ["phaser"], size, () => chance)).toBe(false);
    expect(rollRockAmmoDrop(ECONOMY, ["phaser"], size, () => chance + Number.EPSILON)).toBe(false);
  });

  it("preserves real ownership eligibility, heavy exclusions, weapon weights and upgrade odds", () => {
    for (const owned of [[], ["laser"]] as const) {
      expect(rollAmmoDrop(ECONOMY, owned, "fighter", () => 0)).toBe(false);
      expect(rollRockAmmoDrop(ECONOMY, owned, "huge", () => 0)).toBe(false);
    }
    for (const archetype of ["frigate", "platform", "capital", "hostileStation"] as const) {
      expect(
        rollAmmoDrop(ECONOMY, ["phaser"], archetype, () => {
          throw new Error(`Ineligible ${archetype} consumed an ammo roll`);
        }),
      ).toBe(false);
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
