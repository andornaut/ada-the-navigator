import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import type { Weapon } from "../data/types.ts";
import { playOpening } from "../testing/launch.ts";
import { dropRandom, rollAmmoDrop } from "./drops.ts";
import { GameModel } from "./game.ts";
import { gainSnapshot, type ItemGain, itemGains } from "./itemGains.ts";
import type { EconomyState } from "./types.ts";
import { applyUpgrade, chooseAmmoPack, chooseUpgrade, type UpgradeGift } from "./upgradeDrops.ts";
import { newEconomy } from "./upgrades.ts";
import { UPGRADE_WEAPONS } from "./weapons.ts";

const ALL_WEAPONS: readonly Weapon[] = ["laser", ...UPGRADE_WEAPONS];
/** The gift a draw gives, as `kind:item`. */
const label = (gift: UpgradeGift): string => {
  switch (gift.kind) {
    case "track":
      return `track:${gift.track}`;
    case "paint":
      return "paint";
    default:
      return `weapons:${gift.weapon}`;
  }
};
/** Each gift's share over `draws` seeded draws for the economy as it is. */
function shares(economy: EconomyState, draws = 60000): Map<string, number> {
  const counts = new Map<string, number>();
  for (let index = 0; index < draws; index++) {
    const key = label(chooseUpgrade(ECONOMY, economy, dropRandom(7, `upgrade:${index}`)));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Map([...counts].map(([key, count]) => [key, count / draws]));
}
/** Every weapon owned and at its last level, and every track maxed. */
function maxed(): EconomyState {
  const economy = newEconomy(ECONOMY);
  economy.ownedWeapons = [...UPGRADE_WEAPONS];
  for (const weapon of ALL_WEAPONS) {
    economy.levels.weapons[weapon] = 3;
  }
  economy.levels.shield = 3;
  economy.levels.engine = 3;
  economy.levels.tractor = 3;
  return economy;
}

describe("upgrade drop selection", () => {
  it("weighs Weapons, Shield, Engine tuning and Tractor beam equally and Paint at 1/20", () => {
    const share = shares(newEconomy(ECONOMY));
    const category = (prefix: string) =>
      [...share]
        .filter(([key]) => key.startsWith(prefix))
        .reduce((sum, [, value]) => sum + value, 0);
    const total = 4 + 1 / 20;
    for (const prefix of ["weapons:", "track:shield", "track:engine", "track:tractor"]) {
      expect(Math.abs(category(prefix) - 1 / total)).toBeLessThan(0.01);
    }
    expect(Math.abs(category("paint") - 1 / 20 / total)).toBeLessThan(0.003);
  });

  it("gives each weapon's next step at 64, 32, 16, 8, 4 and 2 in weapon order", () => {
    const share = shares(newEconomy(ECONOMY));
    const weapons = ALL_WEAPONS.map((weapon) => share.get(`weapons:${weapon}`) ?? 0);
    const sum = weapons.reduce((total, value) => total + value, 0);
    const expected = [64, 32, 16, 8, 4, 2].map((weight) => weight / 126);
    weapons.forEach((value, index) => {
      expect(Math.abs(value / sum - expected[index]!)).toBeLessThan(0.015);
    });
    // An unowned weapon comes itself with its packs; Laser, always owned, its next level.
    const gifts = Array.from({ length: 400 }, (_, index) =>
      chooseUpgrade(ECONOMY, newEconomy(ECONOMY), dropRandom(3, `w:${index}`)),
    );
    expect(gifts.find((gift) => gift.kind === "weaponLevel")).toMatchObject({
      level: 2,
      weapon: "laser",
    });
    expect(gifts.some((gift) => gift.kind === "weapon" && gift.weapon === "multiLaser")).toBe(true);
  });

  it("drops what has nothing left from the pool and keeps the others' relative weights", () => {
    const economy = newEconomy(ECONOMY);
    economy.levels.shield = 3;
    economy.levels.engine = 3;
    economy.levels.weapons.laser = 3;
    economy.ownedWeapons = ["multiLaser"];
    economy.levels.weapons.multiLaser = 3;
    const share = shares(economy);
    expect(share.has("track:shield")).toBe(false);
    expect(share.has("track:engine")).toBe(false);
    expect(share.has("weapons:laser")).toBe(false);
    expect(share.has("weapons:multiLaser")).toBe(false);
    // Weapons and Tractor beam at 1 each and Paint at 1/20.
    const total = 2 + 1 / 20;
    expect(Math.abs((share.get("track:tractor") ?? 0) - 1 / total)).toBeLessThan(0.01);
    expect(Math.abs((share.get("paint") ?? 0) - 1 / 20 / total)).toBeLessThan(0.003);
    // Rapid Missile 16, Heavy Missile 8, Scattershot 4 and Phaser 2 of the Weapons share.
    const rapid = share.get("weapons:rapidMissile") ?? 0;
    expect(Math.abs(rapid / (1 / total) - 16 / 30)).toBeLessThan(0.02);
    expect(Math.abs((share.get("weapons:phaser") ?? 0) / (1 / total) - 2 / 30)).toBeLessThan(0.01);
  });

  it("gives only a usable step: never an owned weapon itself, a maxed level or an owned paint", () => {
    const economy = newEconomy(ECONOMY);
    economy.ownedWeapons = ["rapidMissile"];
    economy.levels.weapons.rapidMissile = 3;
    economy.levels.tractor = 3;
    economy.paints.push("cobalt");
    for (let index = 0; index < 4000; index++) {
      const gift = chooseUpgrade(ECONOMY, economy, dropRandom(9, `u:${index}`));
      expect(gift).not.toMatchObject({ kind: "weapon", weapon: "rapidMissile" });
      expect(gift).not.toMatchObject({ kind: "weaponLevel", weapon: "rapidMissile" });
      expect(gift).not.toMatchObject({ kind: "track", track: "tractor" });
      expect(gift).not.toMatchObject({ kind: "paint", scheme: "cobalt" });
      expect(gift).not.toMatchObject({ kind: "paint", scheme: "classic" });
    }
  });

  it("gives an unowned paint scheme once only Paint is left, owned but not put in use", () => {
    const economy = maxed();
    for (let index = 0; index < 200; index++) {
      const gift = chooseUpgrade(ECONOMY, economy, dropRandom(2, `p:${index}`));
      expect(gift.kind).toBe("paint");
    }
    const gift = chooseUpgrade(ECONOMY, economy, dropRandom(2, "p:0"));
    applyUpgrade(ECONOMY, gift, economy);
    expect(economy.paints).toHaveLength(2);
    expect(economy.paint).toBe(ECONOMY.defaultPaint);
  });

  it("falls back to one ammunition pack for an owned weapon by the ammo pack weights", () => {
    const economy = maxed();
    economy.paints = [...ECONOMY.paintOrder];
    const counts = new Map<string, number>();
    const draws = 31000;
    for (let index = 0; index < draws; index++) {
      const gift = chooseUpgrade(ECONOMY, economy, dropRandom(4, `a:${index}`));
      expect(gift.kind).toBe("ammo");
      const weapon = gift.kind === "ammo" ? gift.weapon : "";
      counts.set(weapon, (counts.get(weapon) ?? 0) + 1);
    }
    // Multi-Laser 16, Rapid Missile 8, Heavy Missile 4, Scattershot 2 and Phaser 1, of 31.
    for (const [weapon, weight] of [
      ["multiLaser", 16],
      ["rapidMissile", 8],
      ["heavyMissile", 4],
      ["scattershot", 2],
      ["phaser", 1],
    ] as const) {
      expect((counts.get(weapon) ?? 0) / draws).toBeCloseTo(weight / 31, 2);
    }
    const before = economy.ammo.phaser;
    applyUpgrade(ECONOMY, { kind: "ammo", weapon: "phaser" }, economy);
    expect(economy.ammo.phaser).toBe(before + ECONOMY.ammo.pack.phaser);
  });

  it("gives the same gift for the same seed", () => {
    const economy = newEconomy(ECONOMY);
    expect(chooseUpgrade(ECONOMY, economy, dropRandom(5, "upgrade:drop:3"))).toEqual(
      chooseUpgrade(ECONOMY, economy, dropRandom(5, "upgrade:drop:3")),
    );
  });

  it("applies one level, a weapon with three packs, a paint scheme or one pack", () => {
    const economy = newEconomy(ECONOMY);
    applyUpgrade(ECONOMY, { kind: "weapon", weapon: "heavyMissile" }, economy);
    expect(economy.ownedWeapons).toEqual(["heavyMissile"]);
    expect(economy.ammo.heavyMissile).toBe(3 * ECONOMY.ammo.pack.heavyMissile);
    applyUpgrade(ECONOMY, { kind: "track", level: 2, track: "shield" }, economy);
    expect(economy.levels.shield).toBe(2);
    applyUpgrade(ECONOMY, { kind: "weaponLevel", level: 2, weapon: "laser" }, economy);
    expect(economy.levels.weapons.laser).toBe(2);
    applyUpgrade(ECONOMY, { kind: "paint", scheme: "cobalt" }, economy);
    expect(economy.paints).toContain("cobalt");
    applyUpgrade(ECONOMY, { kind: "ammo", weapon: "heavyMissile" }, economy);
    expect(economy.ammo.heavyMissile).toBe(4 * ECONOMY.ammo.pack.heavyMissile);
  });
});

describe("ammo pack drops", () => {
  const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

  it("drops from a destroyed small craft at 5% once Ada owns a weapon other than Laser", () => {
    const rolls = (owned: readonly Weapon[], archetype: "fighter" | "frigate") =>
      Array.from({ length: 20000 }, (_, index) =>
        rollAmmoDrop(ECONOMY, owned, archetype, dropRandom(9, `ammo:${index}`)),
      ).filter(Boolean).length / 20000;
    expect(ECONOMY.ammo.dropChance).toBe(0.05);
    expect(rolls(["scattershot"], "fighter")).toBeCloseTo(0.05, 2);
    expect(rolls([], "fighter")).toBe(0);
    expect(rolls(["laser"], "fighter")).toBe(0);
    expect(rolls(["scattershot"], "frigate")).toBe(0);
  });

  it("holds a pack for an owned weapon other than Laser, by the weights among those owned", () => {
    const pick = (owned: readonly Weapon[], index: number) =>
      chooseAmmoPack(ECONOMY, owned, dropRandom(3, `p:${index}`));
    expect(pick([], 0)).toBeNull();
    expect(pick(["laser"], 0)).toBeNull();
    // Rapid Missile 8 to Phaser 1 when only those two are owned.
    const draws = 9000;
    const rapid = Array.from({ length: draws }, (_, index) =>
      pick(["phaser", "rapidMissile"], index),
    ).filter((weapon) => weapon === "rapidMissile").length;
    expect(rapid / draws).toBeCloseTo(8 / 9, 2);
  });

  it("gives its pack as Ada collects it, an item notice's ammo gain", () => {
    const model = new GameModel(CONTENT);
    model.startGalaxy(1);
    playOpening(model);
    const flight = model.state.flight!;
    model.state.economy.ownedWeapons = ["scattershot"];
    flight.ownedWeapons = ["scattershot"];
    flight.ammo.scattershot = 5;
    model.state.economy.ammo.scattershot = 5;
    flight.objects = [
      { ...flight.player, ammoPack: true, hp: 1, id: "drop:1", kind: "pickup", radius: 10 },
    ];
    const before = gainSnapshot(model.state.economy.paints, model.ship);
    model.step(0.01, idle);
    const gains = itemGains(false, before, gainSnapshot(model.state.economy.paints, model.ship));
    expect(model.state.flight!.objects).toHaveLength(0);
    expect(model.state.flight!.ammo.scattershot).toBe(5 + ECONOMY.ammo.pack.scattershot);
    expect(model.state.economy.ammo.scattershot).toBe(5 + ECONOMY.ammo.pack.scattershot);
    expect(gains).toEqual([{ kind: "ammo", weapon: "scattershot" }]);
  });
});

describe("collecting an upgrade pickup", () => {
  const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
  /** A flight with only `gift` left to give, and an upgrade pickup on Ada. */
  function onlyLeft(gift: "shield" | "rapidMissile"): {
    gains: readonly ItemGain[];
    model: GameModel;
  } {
    const model = new GameModel(CONTENT);
    model.startGalaxy(1);
    playOpening(model);
    const flight = model.state.flight!;
    const full = maxed();
    if (gift === "shield") {
      full.levels.shield = 1;
    } else {
      full.ownedWeapons = full.ownedWeapons.filter((weapon) => weapon !== "rapidMissile");
      full.levels.weapons.rapidMissile = 1;
    }
    flight.ownedWeapons = [...full.ownedWeapons];
    flight.levels = structuredClone(full.levels);
    flight.weaponSwitchFor = 0;
    model.state.economy.paints = [...ECONOMY.paintOrder];
    flight.objects = [
      { ...flight.player, hp: 1, id: "drop:1", kind: "pickup", radius: 10, upgrade: true },
    ];
    const before = gainSnapshot(model.state.economy.paints, model.ship);
    model.step(0.01, idle);
    const gains = itemGains(false, before, gainSnapshot(model.state.economy.paints, model.ship));
    return { gains, model };
  }

  it("gives the one level left to both the economy and the flight, an item notice's gain", () => {
    const { gains, model } = onlyLeft("shield");
    expect(model.state.flight!.objects).toHaveLength(0);
    expect(model.state.economy.levels.shield).toBe(2);
    expect(model.state.flight!.levels.shield).toBe(2);
    expect(gains).toEqual([{ kind: "level", level: 2, track: "shield" }]);
  });

  it("gives a new weapon as a find: owned, with its packs, and equipped", () => {
    const { gains, model } = onlyLeft("rapidMissile");
    const flight = model.state.flight!;
    expect(model.state.economy.ownedWeapons).toContain("rapidMissile");
    expect(flight.weapon).toBe("rapidMissile");
    expect(flight.ammo.rapidMissile).toBeGreaterThanOrEqual(3 * ECONOMY.ammo.pack.rapidMissile);
    expect(gains).toEqual([{ kind: "weapon", weapon: "rapidMissile" }]);
  });
});
