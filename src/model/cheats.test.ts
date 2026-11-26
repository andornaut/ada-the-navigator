import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { playOpening, readStory, relaunch, supportEntropy } from "../testing/launch.ts";
import { CHEAT_AMOUNT, CHEAT_IDS } from "./cheats.ts";
import { GameModel } from "./game.ts";
import { UPGRADE_WEAPONS } from "./weapons.ts";

function home(): GameModel {
  return new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
}

function launched(): GameModel {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.startGalaxy(1);
  playOpening(model);
  model.state.flight!.objects = [];
  return model;
}

describe("cheats", () => {
  it("unlocks every weapon and fills every ammo pool, keeping levels, selection and Stardust", () => {
    const model = home();
    const economy = model.state.economy;
    economy.ownedWeapons = ["multiLaser"];
    economy.ammo.multiLaser = 5;
    const before = structuredClone(economy);
    expect(model.cheatAvailable("unlockAllWeapons")).toBe(true);
    expect(model.cheat("unlockAllWeapons")).toBe(true);
    expect([...economy.ownedWeapons].sort()).toEqual([...UPGRADE_WEAPONS].sort());
    const ammo = {
      heavyMissile: ECONOMY.ammo.capacity,
      multiLaser: ECONOMY.ammo.capacity,
      phaser: ECONOMY.ammo.capacity,
      rapidMissile: ECONOMY.ammo.capacity,
      scattershot: ECONOMY.ammo.capacity,
    };
    expect(economy.ammo).toEqual(ammo);
    expect(economy).toMatchObject({
      levels: before.levels,
      stardust: before.stardust,
      weapon: before.weapon,
    });
    expect(model.cheatAvailable("unlockAllWeapons")).toBe(false);
    expect(model.cheat("unlockAllWeapons")).toBe(false);
    expect(economy.ammo).toEqual(ammo);
    economy.ownedWeapons.pop();
    expect(model.cheatAvailable("unlockAllWeapons")).toBe(true);
    expect(model.cheat("unlockAllWeapons")).toBe(true);
    expect([...economy.ownedWeapons].sort()).toEqual([...UPGRADE_WEAPONS].sort());
    expect(economy.ammo).toEqual(ammo);
  });

  it("applies to the current flight's loadout in flight", () => {
    const model = launched();
    const flight = model.state.flight!;
    const weapon = flight.weapon;
    expect(model.cheat("unlockAllWeapons")).toBe(true);
    expect([...flight.ownedWeapons!].sort()).toEqual([...UPGRADE_WEAPONS].sort());
    expect(flight.weapon).toBe(weapon);
    expect(UPGRADE_WEAPONS.every((id) => flight.ammo[id] > 0)).toBe(true);
    expect(model.cheat("maxWeaponLevels")).toBe(true);
    expect(Object.values(flight.levels.weapons).every((level) => level === 3)).toBe(true);
    expect(model.cheat("unlockAllEquipment")).toBe(true);
    expect(flight.levels).toMatchObject({ engine: 3, shield: 3, tractor: 3 });
  });

  it("re-enables the cheat as soon as shots spend ammo and keeps the refill on Continue", () => {
    const model = launched();
    const flight = model.state.flight!;
    const cap = ECONOMY.ammo.capacity;

    expect(model.cheat("unlockAllWeapons")).toBe(true);
    expect(model.cheatAvailable("unlockAllWeapons")).toBe(false);
    expect(model.selectWeapon("multiLaser")).toBe(true);
    model.step(0.01, { aim: { x: 1, y: 0 }, move: { x: 0, y: 0 }, use: false });
    expect(flight.shots).toHaveLength(3);
    expect(flight.ammo.multiLaser).toBe(cap - 1);
    expect(model.cheatAvailable("unlockAllWeapons")).toBe(true);
    expect(model.cheat("unlockAllWeapons")).toBe(true);
    expect(flight.weapon).toBe("multiLaser");
    expect(Object.values(flight.ammo)).toEqual(UPGRADE_WEAPONS.map(() => cap));
    expect(model.cheatAvailable("unlockAllWeapons")).toBe(false);
    expect(model.cheat("unlockAllWeapons")).toBe(false);

    const resumed = relaunch(CONTENT, model.save());
    expect(resumed.state.flight?.ammo).toEqual(flight.ammo);
    expect(resumed.state.flight?.weapon).toBe("multiLaser");
    expect(resumed.cheatAvailable("unlockAllWeapons")).toBe(false);
  });

  it("raises equipment to level 3 and owns every paint, keeping the selected paint", () => {
    const model = home();
    const economy = model.state.economy;
    const paint = economy.paint;
    expect(model.cheatAvailable("unlockAllEquipment")).toBe(true);
    model.cheat("unlockAllEquipment");
    expect(economy.levels).toMatchObject({ engine: 3, shield: 3, tractor: 3 });
    expect([...economy.paints].sort()).toEqual([...ECONOMY.paintOrder].sort());
    expect(economy.paint).toBe(paint);
    expect(model.cheatAvailable("unlockAllEquipment")).toBe(false);
    // A level short, or one paint missing, enables it again.
    economy.levels.tractor = 2;
    expect(model.cheatAvailable("unlockAllEquipment")).toBe(true);
    economy.levels.tractor = 3;
    economy.paints.pop();
    expect(model.cheatAvailable("unlockAllEquipment")).toBe(true);
  });

  it("maxes Laser and the owned weapons only", () => {
    const model = home();
    const economy = model.state.economy;
    economy.ownedWeapons = ["scattershot"];
    model.cheat("maxWeaponLevels");
    expect(economy.levels.weapons).toMatchObject({ laser: 3, multiLaser: 1, scattershot: 3 });
    expect(model.cheatAvailable("maxWeaponLevels")).toBe(false);
    economy.ownedWeapons.push("phaser");
    expect(model.cheatAvailable("maxWeaponLevels")).toBe(true);
  });

  it("unlocks every galaxy without clearing anything, then flies the route at the next boarding", () => {
    const model = launched();
    const progress = structuredClone(model.state.progress);
    expect(model.cheatAvailable("unlockAllGalaxies")).toBe(true);
    model.cheat("unlockAllGalaxies");
    expect([...model.state.unlocked].sort()).toEqual([...GALAXY_NUMBERS].sort());
    expect(model.state.progress).toEqual(progress);
    expect(model.cheatAvailable("unlockAllGalaxies")).toBe(false);
    model.returnHome();
    readStory(model);
    expect(model.routeFlight).toMatchObject({ from: 1, to: 6 });
  });

  it("adds 1,000 ore and 1,000 Stardust on every press, in flight or not", () => {
    const model = home();
    for (const press of [1, 2]) {
      expect(model.cheat("addOre")).toBe(true);
      expect(model.cheat("addStardust")).toBe(true);
      expect(model.state.economy.cargo).toBe(press * CHEAT_AMOUNT);
      expect(model.state.economy.stardust).toBe(press * CHEAT_AMOUNT);
    }
    const flying = launched();
    const cargo = flying.state.flight!.cargo;
    flying.cheat("addOre");
    expect(flying.state.flight!.cargo).toBe(cargo + CHEAT_AMOUNT);
    expect(flying.cheatAvailable("addOre")).toBe(true);
    expect(flying.cheatAvailable("addStardust")).toBe(true);
  });

  it("earns achievements and counts statistics after cheats, marking no story progress", () => {
    const model = launched();
    model.state.economy.paints = [...ECONOMY.paintOrder.slice(0, 1)];
    const { activities, jobs } = model.state.achievements;
    const progress = structuredClone(model.state.progress);
    for (const id of CHEAT_IDS) {
      model.cheat(id);
    }
    model.recordAchievement({ kind: "jobCompleted" });
    model.recordAchievement({ kind: "activityCompleted" });
    model.step(0.01, { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false });
    expect(model.state.achievements.jobs).toBe(jobs + 1);
    expect(model.state.achievements.activities).toBe(activities + 1);
    // Every paint the equipment cheat grants counts toward the paints achievement.
    expect(model.state.achievements.unlocked).toContain("fullPalette");
    expect(model.state.progress).toEqual(progress);
  });
});
