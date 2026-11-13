import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import { GameModel } from "../model/game.ts";
import { readStory } from "../testing/launch.ts";

// Execute the production navigation closures against the real model without loading Phaser's DOM.
const source = ts.createSourceFile(
  "sceneUi.ts",
  readFileSync(new URL("./sceneUi.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
function callback(name: "onJump" | "closeGalaxyMap" | "leaveFlight"): string {
  let found: ts.Expression | undefined;
  const visit = (node: ts.Node): void => {
    if (
      (ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node)) &&
      node.name.getText(source) === name &&
      node.initializer &&
      ts.isArrowFunction(node.initializer)
    ) {
      found = node.initializer;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!found) {
    throw new Error(`Missing production navigation callback ${name}`);
  }
  return ts.transpileModule(`(${found.getText(source)})`, {
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
