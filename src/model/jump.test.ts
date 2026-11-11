import { describe, expect, it } from "vitest";

import { ECONOMY } from "../data/economy.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { OVERNIGHT_SLEEP } from "../data/storybook.ts";
import { stepFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";
import { stationsNear } from "./stations.ts";
import { playOpening } from "./test-launch.ts";
import type { FlightInput, FlightState, GameState } from "./types.ts";
import { noLevels } from "./upgrades.ts";

const idle: FlightInput = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

const anyStation = () => stationsNear(ECONOMY, 1, 40000, { x: 0, y: 0 })[0]!;

function launched(): GameModel {
  const model = new GameModel(PROTOTYPE);
  model.startSector(1);
  playOpening(model);
  model.state.flight!.objects = [];
  return model;
}
function incoming(flight: FlightState): void {
  flight.shots.push({
    ...flight.player,
    enemy: true,
    hitIds: [],
    id: `hit:${flight.nextId++}`,
    life: 1,
    piercing: false,
    velocity: { x: 0, y: 0 },
  });
}
function deplete(model: GameModel): void {
  const flight = model.state.flight!;
  flight.objects = [];
  flight.shield = PROTOTYPE.tuning.enemyDamage;
  incoming(flight);
  model.step(0.01, idle);
}
function pickup(flight: FlightState, weapon: "rapidMissile" | "multiLaser" | "scattershot") {
  flight.objects.push({
    ...flight.player,
    hp: 1,
    id: `p:${flight.nextId++}`,
    kind: "pickup",
    radius: 10,
    weapon,
  });
}

describe("weapon lock", () => {
  it("refuses weapon changes in combat with the weaponLocked notice and disabled icons", () => {
    const model = launched();
    const flight = model.state.flight!;
    flight.ownedWeapons = ["rapidMissile", "multiLaser"];
    flight.dangerFor = 1;
    expect(model.weapons()).toEqual([
      { id: "basic", locked: false, selected: true },
      { id: "rapidMissile", locked: true, selected: false },
      { id: "multiLaser", locked: true, selected: false },
    ]);
    expect(model.selectWeapon("rapidMissile")).toBe(false);
    expect(flight.weapon).toBe("basic");
    expect(model.state.notice).toBe("Weapons can't be changed in combat.");
  });

  it("keeps the lock and its icon treatment for 5 seconds after combat ends", () => {
    const model = launched();
    const flight = model.state.flight!;
    flight.ownedWeapons = ["rapidMissile"];
    flight.dangerFor = 0.5;
    stepFlight(PROTOTYPE, 0.6, idle, flight);
    flight.objects = [];
    // Combat ended about 0.1 s ago.
    expect(flight.dangerFor).toBe(0);
    expect(flight.weaponLockFor).toBeGreaterThan(ECONOMY.weaponLockSeconds - 0.15);
    stepFlight(PROTOTYPE, ECONOMY.weaponLockSeconds - 0.25, idle, flight);
    expect(model.weapons()[1]).toEqual({ id: "rapidMissile", locked: true, selected: false });
    expect(model.selectWeapon("rapidMissile")).toBe(false);
    stepFlight(PROTOTYPE, 0.3, idle, flight);
    expect(flight.weaponLockFor).toBe(0);
    expect(model.weapons()[1]).toEqual({ id: "rapidMissile", locked: false, selected: false });
    expect(model.selectWeapon("rapidMissile")).toBe(true);
  });

  it("auto-equips a found weapon only outside the lock", () => {
    const model = launched();
    const flight = model.state.flight!;
    flight.dangerFor = 1;
    pickup(flight, "rapidMissile");
    stepFlight(PROTOTYPE, 0.01, idle, flight);
    expect(flight.ownedWeapons).toEqual(["rapidMissile"]);
    expect(flight.weapon).toBe("basic");
    flight.dangerFor = 0;
    flight.weaponLockFor = 0;
    pickup(flight, "multiLaser");
    stepFlight(PROTOTYPE, 0.01, idle, flight);
    expect(flight.weapon).toBe("multiLaser");
  });
});

describe("quantum jump home", () => {
  // Depletes the shield with the flight's objects in place.
  function depleteHere(model: GameModel): void {
    const flight = model.state.flight!;
    flight.shield = PROTOTYPE.tuning.enemyDamage;
    incoming(flight);
    model.step(0.01, idle);
  }
  function seenHome(model: GameModel): void {
    // Seen, as after a real first launch: the opening never replays.
    model.state.progress[1].opened = true;
    model.state.prologueSeen = true;
  }

  it("costs only the flight: weapons, their levels and Stardust stay, with no fee", () => {
    const model = launched();
    const flight = model.state.flight!;
    flight.ownedWeapons = ["rapidMissile", "multiLaser"];
    flight.weapon = "rapidMissile";
    flight.levels.weapons.rapidMissile = 3;
    flight.levels.weapons.multiLaser = 2;
    flight.levels.weapons.basic = 2;
    model.state.economy.stardust = 30;
    seenHome(model);
    deplete(model);
    expect(model.state.mode).toBe("home");
    expect(model.state.flight).toBeNull();
    expect(model.state.economy).toMatchObject({
      ownedWeapons: ["rapidMissile", "multiLaser"],
      stardust: 30,
      weapon: "rapidMissile",
    });
    expect(model.state.economy.levels.weapons).toMatchObject({
      basic: 2,
      multiLaser: 2,
      rapidMissile: 3,
    });
    expect(model.state.notice).toBe(PROTOTYPE.labels.jumpHome);
    expect(PROTOTYPE.labels).not.toHaveProperty("jumpWeaponLost");
    expect(PROTOTYPE.labels).not.toHaveProperty("jumpRecharge");
    expect(ECONOMY).not.toHaveProperty("jumpFee");
    // The next flight still has the weapon at its level.
    model.startSector(1);
    playOpening(model);
    expect(model.state.flight).toMatchObject({ weapon: "rapidMissile" });
    expect(model.state.flight!.levels.weapons.rapidMissile).toBe(3);
  });

  it("loses the flight's layout, enemies, pickups and carried cargo, keeping quests open", () => {
    const model = launched();
    const flight = model.state.flight!;
    const seed = flight.seed;
    flight.objects = [
      { hp: 1, id: "lost:pickup", kind: "pickup", radius: 10, weapon: "multiLaser", x: 900, y: 0 },
      {
        hp: 3,
        id: "lost:rock",
        kind: "rock",
        radius: 10,
        x: -900,
        y: 0,
      },
    ];
    flight.cargo = 3;
    const progress = model.state.progress[1];
    progress.stage = 2;
    progress.questItem = "toolkit";
    progress.known = ["growers", "workshop"];
    progress.deposited = 4;
    seenHome(model);
    depleteHere(model);
    // The carried quest item goes with the flight; the quest stays open at its stage.
    expect(progress).toMatchObject({
      deposited: 4,
      known: ["growers", "workshop"],
      questComplete: false,
      questItem: null,
      stage: 2,
    });
    expect(model.state.flight).toBeNull();
    model.startSector(1);
    playOpening(model);
    const next = model.state.flight!;
    expect(next.seed).not.toBe(seed);
    expect(next.cargo).toBe(0);
    expect(next.objects.some(({ id }) => id.startsWith("lost:"))).toBe(false);
  });

  it("lands at night, sleeps while Astra recharges, then wakes to morning and the room", () => {
    const model = launched();
    seenHome(model);
    deplete(model);
    expect(model.storyView).toMatchObject({
      canGoBack: false,
      page: { background: "adaRoomNight", id: "jumpHome", text: PROTOTYPE.labels.jumpHome },
    });
    model.storyNext();
    expect(model.storyView?.page).toMatchObject({
      background: "adaRoomSleep",
      id: "sleep",
      sleep: true,
    });
    model.storyTick(OVERNIGHT_SLEEP.seconds - 0.1);
    expect(model.storyView?.page.id).toBe("sleep");
    model.storyTick(0.1);
    expect(model.storyView?.page).toMatchObject({
      background: "adaRoomMorning",
      id: "morning",
      text: "Astra recharges overnight. In the morning, the rock is warm again.",
    });
    model.storyNext();
    expect(model.storyView?.page).toMatchObject({
      action: PROTOTYPE.labels.pickUpRock,
      background: "adaRoom",
      text: PROTOTYPE.premise.emptyHome,
    });
  });

  it("lets a tap skip the sleep only after its moment, and shows no Skip there", () => {
    const model = launched();
    seenHome(model);
    deplete(model);
    model.storyNext();
    expect(OVERNIGHT_SLEEP.seconds).toBeGreaterThanOrEqual(2);
    expect(OVERNIGHT_SLEEP.seconds).toBeLessThanOrEqual(3);
    model.storyNext();
    model.storySkip();
    expect(model.storyView?.page.id).toBe("sleep");
    model.storyTick(OVERNIGHT_SLEEP.skipAfterSeconds - 0.05);
    model.storyNext();
    expect(model.storyView?.page.id).toBe("sleep");
    model.storyTick(0.05);
    model.storyNext();
    expect(model.storyView?.page.id).toBe("morning");
    // Time only plays the sleep scene on; it never moves other pages.
    model.storyTick(10);
    expect(model.storyView?.page.id).toBe("morning");
  });

  it("restarts the sleep's timing when the sleep scene is shown again", () => {
    const model = launched();
    seenHome(model);
    deplete(model);
    model.storyNext();
    model.storyTick(OVERNIGHT_SLEEP.skipAfterSeconds);
    model.storyPrevious();
    expect(model.storyView?.page.id).toBe("jumpHome");
    model.storyNext();
    model.storyNext();
    expect(model.storyView?.page.id).toBe("sleep");
  });

  it("plays a genuinely waiting home scene after the morning", () => {
    const model = launched();
    seenHome(model);
    model.state.progress[1].questComplete = true;
    deplete(model);
    model.storySkip();
    expect(model.storyView?.page.id).toBe("morning");
    model.storyNext();
    expect(model.storyView?.page.background).toBe("gardenLot");
  });

  it("has no night or sleep after a voluntary Return home", () => {
    const model = launched();
    seenHome(model);
    model.returnHome();
    expect(model.storyView?.page).toMatchObject({
      action: PROTOTYPE.labels.pickUpRock,
      background: "adaRoom",
      text: PROTOTYPE.premise.emptyHome,
    });
    expect(model.state.notice).not.toBe(PROTOTYPE.labels.jumpHome);
  });
});

describe("shop through the model", () => {
  function docked(): GameModel {
    const model = launched();
    const site = anyStation();
    model.state.docked = site.id;
    return model;
  }

  it("adds a bought weapon to the flight's roster and keeps it on later flights", () => {
    const model = docked();
    model.state.economy.stardust = 400;
    expect(model.requestPurchase({ kind: "weapon", weapon: "rapidMissile" })).toEqual({
      kind: "confirm",
      left: 250,
      price: 150,
    });
    expect(model.buy({ kind: "weapon", weapon: "rapidMissile" })).toEqual({
      kind: "bought",
      price: 150,
    });
    expect(model.weapons().map((choice) => choice.id)).toEqual(["basic", "rapidMissile"]);
    model.undock();
    model.returnHome();
    model.startSector(1);
    playOpening(model);
    expect(model.weapons().map((choice) => choice.id)).toEqual(["basic", "rapidMissile"]);
    expect(model.state.economy.stardust).toBe(250);
  });

  it("raises the shield capacity and current charge when a shield level is bought", () => {
    const model = docked();
    model.state.economy.stardust = 150;
    model.state.flight!.shield = 50;
    model.buy({ kind: "track", track: "shield" });
    expect(model.shieldMax).toBeCloseTo(150, 9);
    expect(model.state.flight!.shield).toBeCloseTo(100, 9);
    expect(model.state.flight!.levels.shield).toBe(2);
  });

  it("applies an owned paint scheme at once and saves it with purchases", () => {
    const model = docked();
    model.state.economy.stardust = 50;
    model.buy({ kind: "paint", scheme: "iris" });
    expect(model.selectPaint("classic")).toBe(true);
    expect(model.selectPaint("seafoam")).toBe(false);
    expect(restoreSave(model.save())?.economy).toMatchObject({
      paint: "classic",
      paints: ["classic", "iris"],
      stardust: 0,
    });
  });
});

describe("economy save", () => {
  it("round-trips Stardust, purchases, levels, stations and the weapon lock", () => {
    const model = launched();
    const economy = model.state.economy;
    economy.stardust = 321;
    economy.paints.push("cobalt");
    economy.paint = "cobalt";
    const flight = model.state.flight!;
    flight.ownedWeapons = ["scattershot"];
    flight.levels = { ...noLevels(), engine: 2, tractor: 1 };
    flight.levels.weapons.scattershot = 3;
    flight.weaponLockFor = 2.5;
    const site = anyStation();
    model.state.progress[1].stations = [site.id];
    const restored = new GameModel(PROTOTYPE, model.save());
    expect(restored.state).toEqual(model.state);
    expect(restored.state.economy).toMatchObject({
      ownedWeapons: ["scattershot"],
      paint: "cobalt",
      stardust: 321,
    });
    expect(restored.state.economy.levels.weapons.scattershot).toBe(3);
  });

  it("migrates older saves to an empty economy and drops the ammunition count", () => {
    const model = launched();
    model.state.flight!.ownedWeapons = ["multiLaser"];
    model.state.flight!.weapon = "multiLaser";
    const legacy = JSON.parse(model.save()) as Record<string, unknown> & {
      flight: Record<string, unknown>;
      progress: Record<string, Record<string, unknown>>;
    };
    delete legacy.economy;
    delete legacy.docked;
    for (const progress of Object.values(legacy.progress)) {
      delete progress.stations;
    }
    delete legacy.flight.levels;
    delete legacy.flight.weaponLockFor;
    delete legacy.flight.dockId;
    legacy.flight.ammo = 7;
    const restored = restoreSave(legacy)!;
    expect(restored).not.toBeNull();
    expect(restored.economy).toEqual({
      levels: noLevels(),
      ownedWeapons: ["multiLaser"],
      paint: "classic",
      paints: ["classic"],
      stardust: 0,
      weapon: "multiLaser",
    });
    expect(restored.docked).toBeNull();
    expect(restored.progress[1].stations).toEqual([]);
    expect(restored.flight).toMatchObject({ dockId: null, levels: noLevels(), weaponLockFor: 0 });
    expect("ammo" in restored.flight!).toBe(false);
    const home = JSON.parse(new GameModel(PROTOTYPE).save()) as Record<string, unknown>;
    delete home.economy;
    expect(restoreSave(home)?.economy.stardust).toBe(0);
  });

  it("migrates Missiles and Triple Laser and their bought levels to the five-weapon roster", () => {
    const model = launched();
    const flight = model.state.flight!;
    flight.objects.push({ hp: 1, id: "found", kind: "pickup", radius: 10, x: 400, y: 400 });
    const save = JSON.parse(model.save()) as Record<string, unknown>;
    // The old roster's levels counted purchases from 0 to 3; the tractor had two.
    const legacyLevels = (missiles: number, tripleLaser: number) => ({
      engine: 3,
      shield: 1,
      shieldRecharge: 2,
      tractor: 2,
      weapons: { basic: 0, missiles, scattershot: 1, tripleLaser },
    });
    const legacy = {
      ...save,
      economy: {
        ...(save.economy as object),
        levels: legacyLevels(1, 3),
        ownedWeapons: ["missiles", "tripleLaser"],
        weapon: "tripleLaser",
      },
      flight: {
        ...(save.flight as Record<string, unknown>),
        grantedWeapons: ["scattershot"],
        levels: legacyLevels(2, 0),
        objects: (save.flight as { objects: object[] }).objects.map((object) =>
          "id" in object && object.id === "found" ? { ...object, weapon: "missiles" } : object,
        ),
        ownedWeapons: ["missiles", "scattershot"],
        weapon: "missiles",
      },
    };
    const restored = restoreSave(JSON.stringify(legacy))!;
    expect(restored).not.toBeNull();
    expect(restored.economy).toMatchObject({
      levels: {
        engine: 3,
        shield: 2,
        shieldRecharge: 2,
        tractor: 3,
        weapons: {
          basic: 1,
          heavyMissile: 1,
          multiLaser: 3,
          phaser: 1,
          rapidMissile: 2,
          scattershot: 2,
        },
      },
      ownedWeapons: ["rapidMissile", "multiLaser"],
      weapon: "multiLaser",
    });
    expect(restored.flight).toMatchObject({
      grantedWeapons: ["scattershot"],
      ownedWeapons: ["rapidMissile", "scattershot"],
      weapon: "rapidMissile",
    });
    expect(restored.flight!.levels.weapons).toMatchObject({ multiLaser: 1, rapidMissile: 2 });
    expect(restored.flight!.objects.find((object) => object.id === "found")?.weapon).toBe(
      "rapidMissile",
    );
    // A migrated save restores unchanged after it is saved again.
    const again = new GameModel(PROTOTYPE, JSON.stringify(restored));
    expect(again.state.economy).toEqual(restored.economy);
  });

  it.each([
    ["negative Stardust", (save: GameState) => (save.economy.stardust = -1)],
    ["fractional Stardust", (save: GameState) => (save.economy.stardust = 1.5)],
    ["a level past the last", (save: GameState) => (save.economy.levels.tractor = 4)],
    ["a level below the base", (save: GameState) => (save.economy.levels.shield = 0)],
    ["an unknown paint", (save: GameState) => save.economy.paints.push("gold")],
    ["a paint not owned", (save: GameState) => (save.economy.paint = "iris")],
    ["an unowned weapon", (save: GameState) => (save.economy.weapon = "rapidMissile")],
    ["an unknown station", (save: GameState) => save.progress[1].stations.push("station:bad")],
    ["a negative lock", (save: GameState) => (save.flight!.weaponLockFor = -1)],
    [
      "docking at home",
      (save: GameState) => Object.assign(save, { docked: "x", flight: null, mode: "home" }),
    ],
  ])("rejects %s", (_, corrupt) => {
    const model = launched();
    const save = JSON.parse(model.save()) as GameState;
    corrupt(save);
    expect(restoreSave(save)).toBeNull();
  });
});
