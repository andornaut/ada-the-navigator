import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import { CHEAT_COPY } from "../data/cheatCopy.ts";
import { CONTENT } from "../data/content.ts";
import { ECONOMY, worldAmmoPack } from "../data/economy.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import { STATUS_PILL_LAYOUT } from "../data/layout.ts";
import { grantAllWeapons } from "../model/cheats.ts";
import { GameModel } from "../model/game.ts";
import { gainSnapshot, type ItemGain, itemGains } from "../model/itemGains.ts";
import { UPGRADE_WEAPONS } from "../model/weapons.ts";
import { readStory, relaunch } from "../testing/launch.ts";
import { cheatGroups, type CheatSessionOptions, createCheatSession } from "../ui/cheatActions.ts";
import type { PauseState } from "../ui/pauseCard.ts";
import { ShieldOreSpendCounter, type StatusView } from "../ui/statusPill.ts";

// Execute production UI wiring against the real model without loading Phaser's DOM.
const source = ts.createSourceFile(
  "sceneUi.ts",
  readFileSync(new URL("./sceneUi.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
function callback(name: string): string {
  let found: ts.Expression | ts.FunctionDeclaration | undefined;
  const visit = (node: ts.Node): void => {
    if (
      (ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node)) &&
      node.name.getText(source) === name &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isObjectLiteralExpression(node.initializer))
    ) {
      found = node.initializer;
    }
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
      found = node;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!found) {
    throw new Error(`Missing production navigation callback ${name}`);
  }
  return ts.transpileModule(`(${found.getText(source).replace(/^export /u, "")})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2023 },
  }).outputText;
}
function controlArgument(name: string): string {
  let argument: ts.Expression | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === `scene.controls.${name}`) {
      argument = node.arguments[0];
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!argument) {
    throw new Error(`Missing production control argument ${name}`);
  }
  return ts.transpileModule(`(${argument.getText(source)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2023 },
  }).outputText;
}
function pauseView(model: GameModel, screen: string = model.screen): PauseState {
  return runInContext(
    controlArgument("setPause"),
    createContext({
      mapField: () => null,
      pauseModel: model,
      scene: { model },
      screen,
      shipView: () => ({ name: "current ship" }),
      state: model.state,
    }),
  ) as PauseState;
}

function flight() {
  const model = new GameModel(CONTENT);
  model.state.unlocked = [1, 3];
  model.state.prologueSeen = true;
  model.startGalaxy(1);
  model.state.flight!.objects = [];
  model.state.flight!.dangerFor = 0;
  model.state.dialogue = null;
  return model;
}
function navigation(model: GameModel) {
  let localMapOpen = true;
  const controls = {
    closePause: vi.fn(() => {
      localMapOpen = false;
    }),
    focusGalaxies: vi.fn(),
  };
  const scene = { controls, galaxies: { jump: vi.fn() }, jumping: false, model, quantum: {} };
  const jumpThen = vi.fn((action: () => void) => action());
  const context = createContext({ apply: (action: () => void) => action(), jumpThen, scene });
  context.closeGalaxyMap = runInContext(callback("closeGalaxyMap"), context);
  context.leaveFlight = runInContext(callback("leaveFlight"), context);
  const onJump = runInContext(callback("onJump"), context) as () => void;
  return { controls, jumpThen, localMapOpen: () => localMapOpen, onJump, scene };
}

describe("universal pause caller", () => {
  it("keeps Pause absent on the title and loading screens, with no Settings shortcut", () => {
    const model = new GameModel(CONTENT);
    expect(pauseView(model).place).toBeNull();
    expect(pauseView(model, "loading").place).toBeNull();
    expect(runInContext(controlArgument("setSettingsButton"), createContext({}))).toBe(false);
  });

  it("keeps Pause and the ship available during flight dialogue and docking", () => {
    const model = flight();
    for (const blocked of ["dialogue", "docked"] as const) {
      model.state.dialogue =
        blocked === "dialogue"
          ? {
              choices: [{ id: "continue", label: "Continue" }],
              context: "test",
              text: "Conversation",
              title: "Ada",
            }
          : null;
      model.state.docked = blocked === "docked" ? "station" : null;
      const view = pauseView(model);
      expect(view.place).toBe("flight");
      expect(view.ship).not.toBeNull();
    }
  });

  it("uses only explicit canonical Map permission, failing closed when absent", () => {
    const model = flight();
    Object.defineProperty(model, "pauseMapAvailable", { configurable: true, value: undefined });
    expect(pauseView(model).canMap).toBe(false);
    Object.defineProperty(model, "pauseMapAvailable", { configurable: true, value: true });
    expect(pauseView(model).canMap).toBe(true);
    Object.defineProperty(model, "pauseMapAvailable", { configurable: true, value: false });
    expect(pauseView(model).canMap).toBe(false);
  });

  it("offers Pause on each Earth story page without advancing or answering its choice", () => {
    const model = new GameModel(CONTENT);
    model.start();
    const pages: string[] = [];
    let choice = false;
    for (let turn = 0; turn < 60 && model.screen === "story"; turn++) {
      const before = structuredClone(model.storyView);
      expect(pauseView(model).place).toBe("room");
      expect(model.storyView).toEqual(before);
      pages.push(model.storyView!.page.id);
      if (model.storyView!.choices.length) {
        choice = true;
        model.storyNext();
        expect(model.storyView).toEqual(before);
        break;
      }
      model.storyNext();
    }
    expect(pages.length).toBeGreaterThan(1);
    expect(choice).toBe(true);
  });

  it("keeps a mandatory flight interaction intact across the actual Back to title caller", () => {
    const model = flight();
    model.state.dialogue = {
      choices: [{ id: "continue", label: "Continue" }],
      context: "test",
      text: "Conversation",
      title: "Ada",
    };
    const dialogue = structuredClone(model.state.dialogue);
    const context = createContext({
      apply: (action: () => void) => action(),
      scene: { jumping: false, model },
    });
    const leave = runInContext(callback("onBackToTitle"), context) as () => void;
    expect(pauseView(model).place).toBe("flight");
    leave();
    expect(model.screen).toBe("start");
    expect(pauseView(model).place).toBeNull();
    model.continueGame();
    expect(model.state.dialogue).toEqual(dialogue);
    expect(pauseView(model).place).toBe("flight");
  });
});

describe("galaxy map UI navigation", () => {
  it.each(["current", "other", "locked"])(
    "Stay here returns to the local map after viewing %s",
    (viewed) => {
      const model = flight();
      const before = structuredClone(model.state);
      const originalFlight = model.state.flight;
      model.openGalaxyMap();
      if (viewed === "other") {
        model.viewGalaxy(ROUTE_POSITION[3]);
      }
      if (viewed === "locked") {
        model.viewGalaxy(ROUTE_POSITION[2]);
      }
      model.viewGalaxy(ROUTE_POSITION[1]);
      const ui = navigation(model);
      ui.onJump();
      expect(model.galaxyMapOpen).toBe(false);
      expect(model.state.flight).toBe(originalFlight);
      expect(model.state).toEqual(before);
      expect(ui.localMapOpen()).toBe(true);
      expect(ui.controls.focusGalaxies).toHaveBeenCalledOnce();
      expect(ui.controls.closePause).not.toHaveBeenCalled();
      expect(ui.jumpThen).not.toHaveBeenCalled();
      expect(ui.scene.galaxies.jump).not.toHaveBeenCalled();
    },
  );

  it("Jump to another galaxy still leaves the local map and starts that flight", () => {
    const model = flight();
    const originalFlight = model.state.flight;
    model.openGalaxyMap();
    model.viewGalaxy(ROUTE_POSITION[3]);
    const ui = navigation(model);
    ui.onJump();
    expect(model.state.selectedGalaxy).toBe(3);
    expect(model.state.flight).not.toBe(originalFlight);
    expect(ui.localMapOpen()).toBe(false);
    expect(ui.jumpThen).toHaveBeenCalledOnce();
    expect(ui.scene.galaxies.jump).toHaveBeenCalledOnce();
  });

  it("a locked marker refuses Jump without closing either map", () => {
    const model = flight();
    const originalFlight = model.state.flight;
    model.openGalaxyMap();
    model.viewGalaxy(ROUTE_POSITION[2]);
    const ui = navigation(model);
    ui.onJump();
    expect(model.galaxyMapOpen).toBe(true);
    expect(model.state.flight).toBe(originalFlight);
    expect(ui.localMapOpen()).toBe(true);
    expect(ui.jumpThen).not.toHaveBeenCalled();
    expect(ui.scene.galaxies.jump).not.toHaveBeenCalled();
  });

  it("boarding still starts the selected flight rather than returning to a local map", () => {
    const model = flight();
    model.returnHome();
    readStory(model);
    expect(model.screen).toBe("selector");
    expect(model.galaxyMapShownInFlight).toBe(false);
    const ui = navigation(model);
    ui.onJump();
    expect(model.state.mode).toBe("space");
    expect(model.state.selectedGalaxy).toBe(3);
    expect(model.galaxyMapOpen).toBe(false);
    expect(ui.controls.focusGalaxies).not.toHaveBeenCalled();
    expect(ui.jumpThen).toHaveBeenCalledOnce();
  });
});

describe("shield ore spend caller", () => {
  const batch = STATUS_PILL_LAYOUT.ore.oreSpendBatch;
  function caller(total: number) {
    const model = flight();
    model.state.flight!.shieldOreSpent = total;
    model.state.flight!.cargo = 2 * batch;
    const counter = new ShieldOreSpendCounter();
    const ticks: number[] = [];
    const order: string[] = [];
    const controls = {
      resetShieldOreSpent: vi.fn((spent?: number) => {
        order.push("reset");
        counter.reset(spent);
      }),
      setStatus: vi.fn((view: StatusView) => {
        order.push("status");
        const debit = counter.update(view.shieldOreSpent);
        if (debit) {
          ticks.push(debit);
        }
      }),
    };
    const scene = { controls, lightGalaxies: new Map(), model };
    const context = createContext({
      CONTENT,
      aboardLabel: () => "",
      fill: () => "",
      lightGalaxy: () => false,
      shieldOreFlights: new WeakMap(),
      stardustCount: String,
    });
    const update = runInContext(callback("renderStatus"), context) as (scene: object) => void;
    return { counter, order, scene, ticks, update: () => update(scene) };
  }

  it("baselines before status and emits only actual cumulative spend, never cargo loss", () => {
    const ui = caller(batch - 1);
    ui.update();
    expect(ui.order).toEqual(["reset", "status"]);
    expect(ui.ticks).toEqual([]);
    ui.scene.model.state.flight!.shieldOreSpent = batch;
    ui.update();
    expect(ui.ticks).toEqual([]);
    ui.scene.model.state.flight!.shieldOreSpent = 2 * batch - 1;
    ui.update();
    expect(ui.ticks).toEqual([batch]);
    ui.scene.model.state.flight!.cargo = 0;
    ui.update();
    expect(ui.ticks).toEqual([batch]);
  });

  it("does not emit retroactive ticks when another flight or a saved flight is loaded", () => {
    const ui = caller(2 * batch);
    ui.update();
    ui.scene.model = relaunch(CONTENT, ui.scene.model.save());
    ui.update();
    expect(ui.ticks).toEqual([]);
    expect(ui.scene.controls.resetShieldOreSpent).toHaveBeenCalledTimes(2);
    ui.scene.model.state.flight!.shieldOreSpent = 3 * batch - 1;
    ui.update();
    expect(ui.ticks).toEqual([]);
    ui.scene.model.state.flight!.shieldOreSpent = 3 * batch;
    ui.update();
    expect(ui.ticks).toEqual([batch]);
  });

  it("resets on leaving the flight and before resuming its retained cumulative total", () => {
    const ui = caller(2 * batch);
    ui.update();
    ui.scene.model.backToTitle();
    ui.update();
    expect(ui.scene.controls.resetShieldOreSpent).toHaveBeenLastCalledWith(0);
    ui.scene.model.continueGame();
    ui.update();
    expect(ui.scene.controls.resetShieldOreSpent).toHaveBeenLastCalledWith(2 * batch);
    expect(ui.ticks).toEqual([]);
    expect(ui.order).toEqual(["reset", "status", "reset", "status", "reset", "status"]);
  });
});

describe("ammo pickup scene drain", () => {
  it("drains applied pickup amounts once without also emitting a snapshot ammo notice", () => {
    const model = flight();
    const active = model.state.flight!;
    active.ownedWeapons = ["multiLaser"];
    active.weapon = "multiLaser";
    active.weaponSwitchFor = 0;
    active.ammo.multiLaser = 5;
    active.objects = [
      { ...active.player, ammoPack: true, hp: 1, id: "drop:1", kind: "pickup", radius: 10 },
    ];
    const setGains = vi.fn<(gains: readonly ItemGain[] | null) => void>();
    const scene = { controls: { setGains }, model };
    const context = createContext({ gainSnapshot, itemGains });
    const update = runInContext(callback("noticeGains"), context) as (scene: object) => void;
    update(scene);
    model.step(0.01, { aim: { x: 1, y: 0 }, move: { x: 0, y: 0 }, use: false });
    update(scene);
    expect(setGains).toHaveBeenCalledExactlyOnceWith([
      { added: worldAmmoPack(ECONOMY, "multiLaser"), kind: "ammo", weapon: "multiLaser" },
    ]);
    update(scene);
    expect(setGains).toHaveBeenCalledTimes(1);
    expect(model.drainPickupFeedback()).toEqual([]);
  });
});

describe("scene cheat action wiring", () => {
  it("groups the actual grant as Run-only and executes without the scene save callback", async () => {
    const model = flight();
    const economy = structuredClone(model.state.economy);
    const achievements = structuredClone(model.state.achievements);
    const apply = vi.fn<(effect: () => void) => void>((effect) => effect());
    const context = createContext({ CHEAT_COPY, apply, grantAllWeapons, scene: { model } });
    const options = runInContext(callback("cheats"), context) as Omit<CheatSessionOptions, "host">;
    const session = createCheatSession({
      ...options,
      host: {
        matchMedia: () => ({ matches: false }),
        navigator: { maxTouchPoints: 0, userAgent: "fixture" },
      },
    });
    expect(cheatGroups(options.actions)).toEqual(["run"]);
    expect(session.available()).toBe(true);
    expect(await session.execute("grant-all-weapons")).toBe(true);
    expect(model.state.flight!.ownedWeapons).toEqual(UPGRADE_WEAPONS);
    expect(model.state.economy).toEqual(economy);
    expect(model.state.achievements).toEqual(achievements);
    expect(apply).not.toHaveBeenCalled();
    expect(session.available()).toBe(true);
    session.dispose();
  });
});

describe("canonical save caller", () => {
  it("passes the full effective snapshot and reflects asynchronous save status", async () => {
    const model = flight();
    const held = new GameModel(CONTENT, model.save());
    expect(held.state.mode).toBe("home");
    const save = vi
      .fn()
      .mockResolvedValueOnce({ reason: "quota", status: "unavailable" })
      .mockResolvedValueOnce({ status: "saved" });
    const scene = { model: held, savingUnavailable: false, shell: { setSavingAvailable: vi.fn() } };
    const context = createContext({ saves: { save } });
    const flush = runInContext(callback("flushScene"), context) as (
      value: typeof scene,
    ) => Promise<void>;
    await flush(scene);
    expect(save.mock.calls[0]![0].mode).toBe("space");
    expect(save.mock.calls[0]![0].flight).toEqual(model.state.flight);
    expect(scene.savingUnavailable).toBe(true);
    expect(scene.shell.setSavingAvailable).toHaveBeenLastCalledWith(false);
    await flush(scene);
    expect(scene.savingUnavailable).toBe(false);
    expect(scene.shell.setSavingAvailable).toHaveBeenLastCalledWith(true);
  });

  it.each([true, false])(
    "blocks all model action dispatch for a newer-save placeholder=%s",
    (newer) => {
      const action = vi.fn();
      const scene = { controls: { reset: vi.fn() }, emergencyReturn: { active: false } };
      const context = createContext({
        flushScene: vi.fn(),
        newer,
        observeFeedback: vi.fn(),
        refreshScene: vi.fn(),
        scene,
      });
      const apply = runInContext(callback("apply"), context) as (operation: () => void) => void;
      apply(action);
      expect(action).toHaveBeenCalledTimes(newer ? 0 : 1);
      expect(scene.controls.reset).toHaveBeenCalledTimes(newer ? 0 : 1);
    },
  );
});

describe("aboard resource details", () => {
  it("reads the actual carried item and the canonical quest live at each tap", () => {
    const model = {
      aboard: { kind: "carrying", name: "Food" },
      carrying: false,
      map: {
        quests: [
          { description: "Canonical story description", kind: "story", text: "Story step" },
          { description: "Canonical job description", kind: "job", text: "Job step" },
        ],
      },
      towing: false,
    };
    const read = runInContext(
      callback("aboardResource"),
      createContext({ scene: { model } }),
    ) as () => unknown;
    expect(read()).toEqual({
      kind: "carrying",
      text: "Canonical story description",
      title: "Food",
    });
    model.carrying = true;
    model.aboard.name = "Supplies";
    expect(read()).toEqual({
      kind: "carrying",
      text: "Canonical job description",
      title: "Supplies",
    });
    model.carrying = false;
    model.towing = true;
    model.aboard = { kind: "towing", name: "Survey craft" };
    expect(read()).toEqual({
      kind: "towing",
      text: "Canonical job description",
      title: "Survey craft",
    });
  });

  it("never substitutes another quest or stale item when the carried quest is absent", () => {
    const model: {
      aboard: { kind: string; name: string } | null;
      carrying: boolean;
      map: unknown;
      towing: boolean;
    } = {
      aboard: { kind: "carrying", name: "Supplies" },
      carrying: true,
      map: { quests: [{ kind: "story", text: "Unrelated story" }] },
      towing: false,
    };
    const read = runInContext(
      callback("aboardResource"),
      createContext({ scene: { model } }),
    ) as () => unknown;
    expect(read()).toBeNull();
    model.map = { quests: [{ kind: "job", text: "Canonical job step" }] };
    expect(read()).toEqual({ kind: "carrying", text: "Canonical job step", title: "Supplies" });
    model.aboard = null;
    expect(read()).toBeNull();
  });
});

describe("aboard quest routing identity", () => {
  it("passes the canonical live identity without inferring it from the displayed item", () => {
    const model = {
      aboard: { kind: "carrying", name: "Identical cargo" },
      aboardQuestId: "job:1:actual",
      carrying: true,
      map: { quests: [{ kind: "job", text: "Canonical description" }] },
      towing: false,
    };
    const read = runInContext(
      callback("aboardResource"),
      createContext({ scene: { model } }),
    ) as () => { questId?: string };
    expect(read().questId).toBe("job:1:actual");
    model.aboardQuestId = "job:2:another";
    expect(read().questId).toBe("job:2:another");
    model.aboardQuestId = "";
    expect(read()).not.toHaveProperty("questId");
  });
});
