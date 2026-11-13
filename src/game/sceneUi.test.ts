import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY, worldAmmoPack } from "../data/economy.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import { STATUS_PILL_LAYOUT } from "../data/layout.ts";
import { GameModel } from "../model/game.ts";
import { gainSnapshot, type ItemGain, itemGains } from "../model/itemGains.ts";
import { readStory, relaunch } from "../testing/launch.ts";
import { ShieldOreSpendCounter, type StatusView } from "../ui/statusPill.ts";

// Execute the production navigation closures against the real model without loading Phaser's DOM.
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
      ts.isArrowFunction(node.initializer)
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
