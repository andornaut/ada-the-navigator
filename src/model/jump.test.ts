import { describe, expect, it } from "vitest";

import { ECONOMY, type UpgradeWeapon } from "../data/economy.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { OVERNIGHT_SLEEP } from "../data/storybook.ts";
import { stepFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";
import { stationsNear } from "./stations.ts";
import { playOpening, relaunch } from "./test-launch.ts";
import type { FlightInput, FlightState, GameState } from "./types.ts";
import { noLevels } from "./upgrades.ts";
import { grantedAmmo, noAmmo } from "./weapons.ts";

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
function pickup(flight: FlightState, weapon: UpgradeWeapon) {
  flight.objects.push({
    ...flight.player,
    hp: 1,
    id: `p:${flight.nextId++}`,
    kind: "pickup",
    radius: 10,
    weapon,
  });
}

/** Ada owns weapons, each with a new weapon's packs. */
function own(flight: FlightState, weapons: UpgradeWeapon[]): void {
  flight.ownedWeapons = weapons;
  flight.ammo = grantedAmmo(weapons);
}

describe("weapon switching", () => {
  it("switches in combat, then refuses the next switch for the wait without a notice", () => {
    const model = launched();
    const flight = model.state.flight!;
    own(flight, ["rapidMissile", "multiLaser"]);
    flight.dangerFor = 1;
    expect(model.weapons()).toEqual([
      { ammo: null, id: "basic", selected: true },
      { ammo: 600, id: "rapidMissile", selected: false },
      { ammo: 600, id: "multiLaser", selected: false },
    ]);
    expect(model.selectWeapon("rapidMissile")).toBe(true);
    expect(flight.weapon).toBe("rapidMissile");
    expect(flight.weaponSwitchFor).toBe(ECONOMY.weaponSwitchSeconds);
    expect(model.selectWeapon("multiLaser")).toBe(false);
    expect(flight.weapon).toBe("rapidMissile");
    expect(model.state.notice).toBeFalsy();
    // Choosing the equipped weapon is never refused and does not restart the wait.
    stepFlight(PROTOTYPE, 0.4, idle, flight);
    expect(model.selectWeapon("rapidMissile")).toBe(true);
    expect(flight.weaponSwitchFor).toBeCloseTo(ECONOMY.weaponSwitchSeconds - 0.4);
  });

  it("waits 1 second after a switch, in or out of danger", () => {
    expect(ECONOMY.weaponSwitchSeconds).toBe(1);
    for (const dangerFor of [0, 1]) {
      const model = launched();
      const flight = model.state.flight!;
      own(flight, ["rapidMissile"]);
      expect(model.selectWeapon("rapidMissile")).toBe(true);
      flight.objects = [];
      flight.dangerFor = dangerFor;
      stepFlight(PROTOTYPE, ECONOMY.weaponSwitchSeconds - 0.05, idle, flight);
      expect(model.selectWeapon("basic")).toBe(false);
      stepFlight(PROTOTYPE, 0.06, idle, flight);
      expect(flight.weaponSwitchFor).toBe(0);
      expect(model.selectWeapon("basic")).toBe(true);
      expect(flight.weapon).toBe("basic");
    }
  });

  it("auto-equips a found weapon at any time, unless the switch wait runs", () => {
    const model = launched();
    const flight = model.state.flight!;
    flight.dangerFor = 1;
    pickup(flight, "rapidMissile");
    stepFlight(PROTOTYPE, 0.01, idle, flight);
    expect(flight.ownedWeapons).toEqual(["rapidMissile"]);
    expect(flight.weapon).toBe("rapidMissile");
    // Equipping is a switch, so a second find during the wait joins the roster unequipped.
    pickup(flight, "multiLaser");
    stepFlight(PROTOTYPE, 0.01, idle, flight);
    expect(flight.ownedWeapons).toEqual(["rapidMissile", "multiLaser"]);
    expect(flight.weapon).toBe("rapidMissile");
    flight.weaponSwitchFor = 0;
    pickup(flight, "scattershot");
    stepFlight(PROTOTYPE, 0.01, idle, flight);
    expect(flight.weapon).toBe("scattershot");
  });
});

describe("picked-up weapons", () => {
  it("equip in combat through the game step unless the switch wait runs, then join unequipped", () => {
    const model = launched();
    const flight = model.state.flight!;
    // Incoming fire keeps Ada in danger for the whole check.
    flight.player = { x: 5000, y: 5000 };
    incoming(flight);
    model.step(0.01, idle);
    expect(flight.dangerFor).toBeGreaterThan(0);
    pickup(flight, "phaser");
    model.step(0.01, idle);
    expect(flight.dangerFor).toBeGreaterThan(0);
    expect(flight.weapon).toBe("phaser");
    expect(flight.weaponSwitchFor).toBeGreaterThan(0);
    pickup(flight, "heavyMissile");
    model.step(0.01, idle);
    expect(flight.ownedWeapons).toEqual(["phaser", "heavyMissile"]);
    expect(flight.weapon).toBe("phaser");
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
    own(flight, ["rapidMissile", "multiLaser"]);
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
    model.storyTick(OVERNIGHT_SLEEP.seconds, OVERNIGHT_SLEEP.seconds - 0.1);
    expect(model.storyView?.page.id).toBe("sleep");
    model.storyTick(OVERNIGHT_SLEEP.seconds, 0.1);
    expect(model.storyView?.page).toMatchObject({
      background: "adaRoomMorningCats",
      id: "morning",
      text:
        "Astra recharges overnight. In the morning, the rock is warm again, and Archie and Kiwi " +
        "are curled at her feet.",
    });
    model.storyNext();
    expect(model.storyView?.page).toMatchObject({
      action: PROTOTYPE.labels.pickUpRock,
      background: "adaRoom",
      text: PROTOTYPE.premise.emptyHome,
    });
  });

  it("starts a story run at the flight's end that the visit continues to Ada's room", () => {
    const model = launched();
    seenHome(model);
    deplete(model);
    expect(model.storyView?.canGoBack).toBe(false);
    model.storyNext();
    model.storyTick(OVERNIGHT_SLEEP.seconds, OVERNIGHT_SLEEP.seconds);
    model.storyNext();
    // The visit's room page follows morning in the same run, so Previous returns to morning.
    expect(model.storyView).toMatchObject({
      canGoBack: true,
      canSkip: false,
      page: { id: "room" },
    });
    model.storyPrevious();
    expect(model.storyView?.page.id).toBe("morning");
    // Skip from the night passes the sleep and morning and stops on the room page.
    const skipped = launched();
    seenHome(skipped);
    deplete(skipped);
    skipped.storySkip();
    expect(skipped.storyView).toMatchObject({ canSkip: false, page: { id: "room" } });
    skipped.storyPrevious();
    expect(skipped.storyView?.page.id).toBe("jumpHome");
  });

  it("moves to morning after the sleep length it is given, as Art's reduced-motion 2.4 s", () => {
    const model = launched();
    seenHome(model);
    deplete(model);
    model.storyNext();
    model.storyTick(2.4, 2.35);
    expect(model.storyView?.page.id).toBe("sleep");
    model.storyTick(2.4, 0.1);
    expect(model.storyView?.page.id).toBe("morning");
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
    model.storyTick(OVERNIGHT_SLEEP.seconds, OVERNIGHT_SLEEP.skipAfterSeconds - 0.05);
    model.storyNext();
    expect(model.storyView?.page.id).toBe("sleep");
    model.storyTick(OVERNIGHT_SLEEP.seconds, 0.05);
    model.storyNext();
    expect(model.storyView?.page.id).toBe("morning");
    // Time only plays the sleep scene on; it never moves other pages.
    model.storyTick(OVERNIGHT_SLEEP.seconds, 10);
    expect(model.storyView?.page.id).toBe("morning");
  });

  it("restarts the sleep's timing when the sleep scene is shown again", () => {
    const model = launched();
    seenHome(model);
    deplete(model);
    model.storyNext();
    model.storyTick(OVERNIGHT_SLEEP.seconds, OVERNIGHT_SLEEP.skipAfterSeconds);
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
    model.storyNext();
    model.storyTick(OVERNIGHT_SLEEP.seconds, OVERNIGHT_SLEEP.seconds);
    expect(model.storyView?.page.id).toBe("morning");
    model.storyNext();
    expect(model.storyView?.page.background).toBe("gardenLot");
    // The waiting scene continues the jump's story run, so Skip passes it to Ada's room.
    model.storySkip();
    expect(model.storyView?.page.id).toBe("room");
    expect(model.state.progress[1].resolved).toBe(true);
  });

  it("has no night or sleep after a voluntary Return to Earth", () => {
    const model = launched();
    seenHome(model);
    model.returnHome();
    expect(model.storyView?.page).toMatchObject({
      action: PROTOTYPE.labels.pickUpRock,
      background: "adaRoom",
      text: PROTOTYPE.premise.emptyHome,
    });
    expect(model.roomPage).toBe(true);
    expect(model.state.notice).not.toBe(PROTOTYPE.labels.jumpHome);
  });

  it("goes Back to title from flight even in danger, saving progress with no sleep scene", () => {
    const model = launched();
    seenHome(model);
    model.state.economy.stardust = 123;
    model.state.progress[1].known = ["growers"];
    model.state.flight!.dangerFor = 5;
    expect(model.inDanger).toBe(true);
    model.returnHome();
    expect(model.state.mode).toBe("space");
    model.backToTitle();
    expect(model.state.mode).toBe("home");
    expect(model.state.flight).toBeNull();
    expect(model.screen).toBe("start");
    expect(model.storyView).toBeNull();
    expect(model.state.notice).not.toBe(PROTOTYPE.labels.jumpHome);
    const reloaded = relaunch(PROTOTYPE, model.save());
    expect(reloaded.screen).toBe("start");
    expect(reloaded.state.economy.stardust).toBe(123);
    expect(reloaded.state.progress[1].known).toEqual(["growers"]);
  });

  it("resumes on Continue after Back to title: the cockpit, or a waiting home scene first", () => {
    const model = launched();
    seenHome(model);
    model.backToTitle();
    model.continueGame();
    expect(model.screen).toBe("story");
    expect(model.storyView?.page.id).toMatch(/^boarding:/);
    const waiting = launched();
    seenHome(waiting);
    waiting.state.progress[1].questComplete = true;
    waiting.backToTitle();
    waiting.continueGame();
    expect(waiting.storyView?.page.background).toBe("gardenLot");
  });

  it("goes Back to title from Ada's room page only, never from another storybook page", () => {
    const model = launched();
    seenHome(model);
    model.returnHome();
    model.backToTitle();
    expect(model.screen).toBe("start");
    const resolving = launched();
    seenHome(resolving);
    resolving.state.progress[1].questComplete = true;
    resolving.returnHome();
    expect(resolving.roomPage).toBe(false);
    resolving.backToTitle();
    expect(resolving.screen).toBe("story");
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
  it("round-trips Stardust, purchases, levels, stations and the switch wait", () => {
    const model = launched();
    const economy = model.state.economy;
    economy.stardust = 321;
    economy.paints.push("cobalt");
    economy.paint = "cobalt";
    const flight = model.state.flight!;
    flight.ownedWeapons = ["scattershot"];
    flight.levels = { ...noLevels(), engine: 2, tractor: 1 };
    flight.levels.weapons.scattershot = 3;
    flight.weaponSwitchFor = 0.5;
    const site = anyStation();
    model.state.progress[1].stations = [site.id];
    const restored = relaunch(PROTOTYPE, model.save());
    // The restored game also counts the paint set above toward Full Palette.
    expect(restored.state).toEqual({
      ...model.state,
      achievements: { ...model.state.achievements, paints: [ECONOMY.defaultPaint, "cobalt"] },
    });
    expect(restored.state.economy).toMatchObject({
      ownedWeapons: ["scattershot"],
      paint: "cobalt",
      stardust: 321,
    });
    expect(restored.state.economy.levels.weapons.scattershot).toBe(3);
  });

  it("migrates older saves to an empty economy with three packs per owned weapon", () => {
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
    delete legacy.flight.weaponSwitchFor;
    delete legacy.flight.dockId;
    legacy.flight.ammo = 7;
    legacy.flight.weaponLockFor = 2.5;
    const restored = restoreSave(legacy)!;
    expect(restored).not.toBeNull();
    expect(restored.economy).toEqual({
      ammo: { ...noAmmo(), multiLaser: 600 },
      levels: noLevels(),
      ownedWeapons: ["multiLaser"],
      paint: "classic",
      paints: ["classic"],
      stardust: 0,
      weapon: "multiLaser",
    });
    expect(restored.docked).toBeNull();
    expect(restored.progress[1].stations).toEqual([]);
    expect(restored.flight).toMatchObject({ dockId: null, levels: noLevels(), weaponSwitchFor: 0 });
    // The single legacy ammunition count gives way to the economy's per-weapon counts.
    expect(restored.flight!.ammo).toEqual(restored.economy.ammo);
    expect("weaponLockFor" in restored.flight!).toBe(false);
    const home = JSON.parse(new GameModel(PROTOTYPE).save()) as Record<string, unknown>;
    delete home.economy;
    expect(restoreSave(home)?.economy.stardust).toBe(0);
    // An economy saved before ammunition gives each owned weapon three packs.
    const owner = launched();
    owner.state.economy.ownedWeapons = ["phaser", "scattershot"];
    owner.state.flight!.ownedWeapons = ["phaser", "scattershot"];
    const before = JSON.parse(owner.save()) as Record<
      "economy" | "flight",
      Record<string, unknown>
    >;
    delete before.economy.ammo;
    delete before.flight.ammo;
    const ammo = { ...noAmmo(), phaser: 165, scattershot: 390 };
    expect(restoreSave(before)?.economy.ammo).toEqual(ammo);
    expect(restoreSave(before)?.flight?.ammo).toEqual(ammo);
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
    const again = relaunch(PROTOTYPE, JSON.stringify(restored));
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
    ["a negative switch wait", (save: GameState) => (save.flight!.weaponSwitchFor = -1)],
    ["negative ammunition", (save: GameState) => (save.economy.ammo.phaser = -1)],
    ["fractional ammunition", (save: GameState) => (save.flight!.ammo.phaser = 0.5)],
    [
      "ammunition for an unknown weapon",
      (save: GameState) => Object.assign(save.economy.ammo, { laser: 3 }),
    ],
    [
      "a negative legacy lock",
      (save: GameState) => Object.assign(save.flight!, { weaponLockFor: -1 }),
    ],
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
