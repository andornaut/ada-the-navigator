import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY, type UpgradeWeapon } from "../data/economy.ts";
import { OVERNIGHT_SLEEP } from "../data/storybook.ts";
import { playOpening, relaunch } from "../testing/launch.ts";
import { stepFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";
import { stationsNear } from "./stations.ts";
import type { FlightInput, FlightState, GameState } from "./types.ts";
import { noLevels } from "./upgrades.ts";
import { collectWeapon, grantedAmmo } from "./weapons.ts";

const idle: FlightInput = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

const anyStation = () => stationsNear(ECONOMY, 1, 40000, { x: 0, y: 0 })[0]!;

function launched(): GameModel {
  const model = new GameModel(CONTENT);
  model.startGalaxy(1);
  playOpening(model);
  model.state.flight!.objects = [];
  return model;
}
function incoming(flight: FlightState): void {
  flight.shots.push({
    ...flight.player,
    damage: 1,
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
  flight.shield = CONTENT.tuning.hazardDamage;
  incoming(flight);
  model.step(0.01, idle);
}
/** Ada finds a weapon, as an upgrade pickup that gives it does. */
function pickup(flight: FlightState, weapon: UpgradeWeapon) {
  collectWeapon(weapon, flight);
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
      { ammo: null, id: "laser", level: 1, selected: true },
      { ammo: 3 * ECONOMY.ammo.pack.multiLaser, id: "multiLaser", level: 1, selected: false },
      { ammo: 3 * ECONOMY.ammo.pack.rapidMissile, id: "rapidMissile", level: 1, selected: false },
    ]);
    expect(model.selectWeapon("rapidMissile")).toBe(true);
    expect(flight.weapon).toBe("rapidMissile");
    expect(flight.weaponSwitchFor).toBe(ECONOMY.weaponSwitchSeconds);
    expect(model.selectWeapon("multiLaser")).toBe(false);
    expect(flight.weapon).toBe("rapidMissile");
    expect(model.state.notice).toBeFalsy();
    // Choosing the equipped weapon is never refused and does not restart the wait.
    stepFlight(CONTENT, 0.4, idle, flight);
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
      stepFlight(CONTENT, ECONOMY.weaponSwitchSeconds - 0.05, idle, flight);
      expect(model.selectWeapon("laser")).toBe(false);
      stepFlight(CONTENT, 0.06, idle, flight);
      expect(flight.weaponSwitchFor).toBe(0);
      expect(model.selectWeapon("laser")).toBe(true);
      expect(flight.weapon).toBe("laser");
    }
  });

  it("auto-equips a found weapon at any time, unless the switch wait runs", () => {
    const model = launched();
    const flight = model.state.flight!;
    flight.dangerFor = 1;
    pickup(flight, "rapidMissile");
    stepFlight(CONTENT, 0.01, idle, flight);
    expect(flight.ownedWeapons).toEqual(["rapidMissile"]);
    expect(flight.weapon).toBe("rapidMissile");
    // Equipping is a switch, so a second find during the wait joins the roster unequipped.
    pickup(flight, "multiLaser");
    stepFlight(CONTENT, 0.01, idle, flight);
    expect(flight.ownedWeapons).toEqual(["rapidMissile", "multiLaser"]);
    expect(flight.weapon).toBe("rapidMissile");
    flight.weaponSwitchFor = 0;
    pickup(flight, "scattershot");
    stepFlight(CONTENT, 0.01, idle, flight);
    expect(flight.weapon).toBe("scattershot");
  });
});

describe("picked-up weapons", () => {
  it("equip in combat through the game step unless the switch wait runs, then join unequipped", () => {
    const model = launched();
    const flight = model.state.flight!;
    // Fire in flight inside the battle square keeps Ada in danger for the whole check.
    flight.player = { x: 5000, y: 5000 };
    incoming(flight);
    flight.shots.at(-1)!.y += 300;
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
    flight.shield = CONTENT.tuning.hazardDamage;
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
    flight.levels.weapons.laser = 2;
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
      laser: 2,
      multiLaser: 2,
      rapidMissile: 3,
    });
    expect(model.storyView?.page.text).toBe(CONTENT.labels.jumpHome);
    expect(CONTENT.labels).not.toHaveProperty("jumpWeaponLost");
    expect(CONTENT.labels).not.toHaveProperty("jumpRecharge");
    expect(ECONOMY).not.toHaveProperty("jumpFee");
    // The next flight still has the weapon at its level.
    model.startGalaxy(1);
    playOpening(model);
    expect(model.state.flight).toMatchObject({ weapon: "rapidMissile" });
    expect(model.state.flight!.levels.weapons.rapidMissile).toBe(3);
  });

  it("loses the flight's layout, enemies, pickups and half its ore, keeping quests and the story's item", () => {
    const model = launched();
    const flight = model.state.flight!;
    const seed = flight.seed;
    flight.objects = [
      { hp: 1, id: "lost:pickup", kind: "pickup", radius: 10, upgrade: true, x: 900, y: 0 },
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
    // The carried story item stays with the story, and the quest stays open at its stage.
    expect(progress).toMatchObject({
      deposited: 4,
      known: ["growers", "workshop"],
      questComplete: false,
      questItem: "toolkit",
      stage: 2,
    });
    expect(model.state.flight).toBeNull();
    model.startGalaxy(1);
    playOpening(model);
    const next = model.state.flight!;
    expect(next.seed).not.toBe(seed);
    // Of 3 ore, the jump keeps ceil(3 / 2).
    expect(next.cargo).toBe(2);
    expect(next.objects.some(({ id }) => id.startsWith("lost:"))).toBe(false);
  });

  it.each(["shield failure", "Earth", "Jump", "Restart"] as const)(
    "drops an in-flight notice with its flight at %s, so the next flight starts with none",
    (ending) => {
      const model = launched();
      seenHome(model);
      model.state.unlocked = [1, 3];
      model.state.progress[3].opened = true;
      model.state.dialogue = null;
      const outOfAmmo = CONTENT.labels.outOfAmmo ?? "";
      model.state.notice = outOfAmmo;
      if (ending === "shield failure") {
        deplete(model);
      } else if (ending === "Earth") {
        model.returnHome();
      } else if (ending === "Jump") {
        expect(model.openGalaxyMap()).toBe(true);
        model.stepGalaxy(1);
        expect(model.jump()).toBe(true);
      } else {
        model.backToTitle();
        // Back to title keeps the flight, and with it its notice, for Continue.
        expect(JSON.parse(model.save())).toMatchObject({ notice: outOfAmmo });
        model.restart();
        model.start();
      }
      if (ending !== "Jump") {
        expect(model.state.mode).toBe("home");
        expect(model.state.notice).toBe("");
        model.startGalaxy(1);
      }
      expect(model.state.mode).toBe("space");
      expect(model.state.notice).toBe("");
    },
  );

  it("says the jump-home line on its page only, never at the next boarding or flight", () => {
    const model = launched();
    model.state.flight!.cargo = 2;
    seenHome(model);
    deplete(model);
    const jumpLine = CONTENT.labels.jumpHome ?? "";
    const oreLine = CONTENT.labels.jumpHomeOreLost ?? "";
    const line = `${jumpLine}\n${oreLine}`;
    expect(model.storyView?.page).toMatchObject({ id: "jumpHome", text: line });
    expect(model.state.notice).toBe("");
    // Through the night to Ada's room, then the rock, boarding and the galaxy map's Jump.
    const shown: string[] = [];
    for (let turn = 0; turn < 40 && model.screen === "story"; turn++) {
      shown.push(model.storyView!.page.text);
      if (model.storyView!.page.sleep) {
        model.storyTick(OVERNIGHT_SLEEP.seconds, OVERNIGHT_SLEEP.seconds);
      } else {
        model.storyNext();
      }
    }
    expect(model.screen).toBe("selector");
    expect(shown.filter((text) => text.includes(jumpLine))).toEqual([line]);
    expect(shown.filter((text) => text.includes(oreLine))).toEqual([line]);
    model.jump();
    expect(model.state.mode).toBe("space");
    expect(model.state.notice).not.toContain(jumpLine);
    model.step(0.01, idle);
    expect(model.state.notice).not.toContain(jumpLine);
  });

  it("lands aboard in the emergency red, sleeps while Astra recharges, then wakes to morning", () => {
    const model = launched();
    seenHome(model);
    deplete(model);
    expect(model.storyView).toMatchObject({
      canGoBack: false,
      page: { background: "aboardEmergency", id: "jumpHome", text: CONTENT.labels.jumpHome },
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
        "Astra recharges overnight. In the morning, the rock is warm again, and Gadget and Kiwi " +
        "are curled at her feet.",
    });
    model.storyNext();
    expect(model.storyView?.page).toMatchObject({
      action: CONTENT.labels.pickUpRock,
      background: "adaRoom",
      text: CONTENT.premise.emptyHome,
    });
  });

  it("continues a depletion return through the room and boarding to galaxy selection", () => {
    const model = launched();
    seenHome(model);
    deplete(model);
    expect(model.storyView).toMatchObject({ canGoBack: false, canSkip: true });
    model.storyNext();
    expect(model.storyView).toMatchObject({ canSkip: false, page: { sleep: true } });
    model.storyTick(OVERNIGHT_SLEEP.seconds, OVERNIGHT_SLEEP.seconds);
    expect(model.storyView).toMatchObject({ canSkip: true, page: { id: "morning" } });
    model.storyNext();
    expect(model.storyView).toMatchObject({ canGoBack: true, canSkip: true, page: { id: "room" } });
    model.storyPrevious();
    expect(model.storyView?.page.id).toBe("morning");
    model.storySkip();
    expect(model.screen).toBe("selector");
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

  it("does not replay an interlude after returning to its previous navigable page", () => {
    const model = launched();
    seenHome(model);
    deplete(model);
    model.storyNext();
    model.storyTick(OVERNIGHT_SLEEP.seconds, OVERNIGHT_SLEEP.skipAfterSeconds);
    model.storyPrevious();
    expect(model.storyView?.page.id).toBe("jumpHome");
    model.storyNext();
    expect(model.storyView?.page.id).toBe("morning");
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
    // Skip stops at the waiting scene's explicit choice before it can resolve.
    model.storySkip();
    expect(model.storyView?.choices.length).toBeGreaterThan(0);
    expect(model.state.progress[1].resolved).toBe(false);
    model.storyChoose(0);
    model.storySkip();
    expect(model.state.progress[1].resolved).toBe(true);
  });

  it("has no night or sleep after a voluntary Return to Earth", () => {
    const model = launched();
    seenHome(model);
    model.returnHome();
    expect(model.storyView?.page).toMatchObject({
      action: CONTENT.labels.pickUpRock,
      background: "adaRoom",
      text: CONTENT.premise.emptyHome,
    });
    expect(model.roomPage).toBe(true);
    expect(model.state.notice).not.toBe(CONTENT.labels.jumpHome);
  });

  it("goes Back to title from flight even in danger, keeping the flight with no sleep scene", () => {
    const model = launched();
    seenHome(model);
    model.state.economy.stardust = 123;
    model.state.progress[1].known = ["growers"];
    model.state.flight!.dangerFor = 5;
    expect(model.inDanger).toBe(true);
    model.returnHome();
    expect(model.state.mode).toBe("space");
    const flight = model.state.flight!;
    model.backToTitle();
    expect(model.screen).toBe("start");
    expect(model.storyView).toBeNull();
    expect(model.state.notice).not.toBe(CONTENT.labels.jumpHome);
    // The save keeps the flight, as closing the app does.
    const saved = JSON.parse(model.save()) as { flight: { seed: number }; mode: string };
    expect(saved).toMatchObject({ flight: { seed: flight.seed }, mode: "space" });
    const reloaded = new GameModel(CONTENT, model.save());
    expect(reloaded.screen).toBe("start");
    expect(reloaded.state.economy.stardust).toBe(123);
    expect(reloaded.state.progress[1].known).toEqual(["growers"]);
  });

  it("resumes the same flight on Continue after Back to title, even with a home scene waiting", () => {
    const model = launched();
    seenHome(model);
    const flight = model.state.flight!;
    model.backToTitle();
    model.continueGame();
    expect(model.state.mode).toBe("space");
    expect(model.state.flight).toBe(flight);
    expect(model.storyView).toBeNull();
    const waiting = launched();
    seenHome(waiting);
    waiting.state.progress[1].questComplete = true;
    waiting.backToTitle();
    waiting.continueGame();
    expect(waiting.state.mode).toBe("space");
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
    expect(model.requestPurchase({ kind: "weapon", weapon: "multiLaser" })).toEqual({
      kind: "confirm",
      left: 0,
      price: 400,
    });
    expect(model.buy({ kind: "weapon", weapon: "multiLaser" })).toEqual({
      kind: "bought",
      price: 400,
    });
    expect(model.weapons().map((choice) => choice.id)).toEqual(["laser", "multiLaser"]);
    model.undock();
    model.returnHome();
    model.startGalaxy(1);
    playOpening(model);
    expect(model.weapons().map((choice) => choice.id)).toEqual(["laser", "multiLaser"]);
    expect(model.state.economy.stardust).toBe(0);
  });

  it("raises the shield capacity and current charge when a shield level is bought", () => {
    const model = docked();
    model.state.economy.stardust = 450;
    model.state.flight!.shield = 5;
    model.buy({ kind: "track", track: "shield" });
    expect(model.shieldMax).toBe(15);
    expect(model.state.flight!.shield).toBe(10);
    expect(model.state.flight!.levels.shield).toBe(2);
  });

  it("applies an owned paint scheme at once and saves it with purchases", () => {
    const model = docked();
    model.state.economy.stardust = 1500;
    expect(model.buy({ kind: "paint", scheme: "iris" })).toEqual({ kind: "bought", price: 1500 });
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
    const restored = relaunch(CONTENT, model.save());
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
