import { readdirSync, readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import { CHEAT_COPY } from "../data/cheatCopy.ts";
import { CONTENT } from "../data/content.ts";
import { lineDuration } from "../data/conversations.ts";
import { ECONOMY, worldAmmoPack } from "../data/economy.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import { STATUS_PILL_LAYOUT } from "../data/layout.ts";
import { SCREEN } from "../data/screen.ts";
import { openRewoundCampaign } from "../model/campaignRewind.ts";
import { CHEAT_AMOUNT, type CheatId } from "../model/cheats.ts";
import { GameModel } from "../model/game.ts";
import { gainSnapshot, type ItemGain, itemGains } from "../model/itemGains.ts";
import type { GameSave } from "../model/types.ts";
import { UPGRADE_WEAPONS } from "../model/weapons.ts";
import { createAdaSaves, SAVE_KEYS } from "../saving/index.ts";
import { readStory, relaunch, supportEntropy } from "../testing/launch.ts";
import type { CheatAction } from "../ui/cheatActions.ts";
import { VIEW_HOST_ID } from "../ui/layout/css.ts";
import { NO_INSETS, safeGameArea } from "../ui/layout/playView.ts";
import { createCoveredPaint } from "../ui/modalScenePaint.ts";
import { navigationEntry } from "../ui/navigationEntry.ts";
import { BOX_OCCUPANT, boxOccupant } from "../ui/notice.ts";
import { galaxiesAvailable } from "../ui/pause.ts";
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
    if (
      ts.isBinaryExpression(node) &&
      node.left.getText(source) === name &&
      ts.isArrowFunction(node.right)
    ) {
      found = node.right;
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
function pauseView(model: GameModel, screen: string = model.screen, covered = false): PauseState {
  const context = createContext({
    covered,
    document: { hidden: false },
    mapField: () => null,
    navigationEntry,
    pauseModel: model,
    scene: { jumping: false, model },
    screen,
    shipView: () => ({ name: "current ship" }),
    start: screen === "start",
    state: model.state,
  });
  const refresh = source.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === "refreshScene",
  ) as ts.FunctionDeclaration;
  const entry = refresh
    .body!.statements.flatMap((node) =>
      ts.isVariableStatement(node) ? [...node.declarationList.declarations] : [],
    )
    .find((node) => node.name.getText(source) === "entry")!;
  runInContext(
    ts.transpileModule(`const entry = ${entry.initializer!.getText(source)};`, {
      compilerOptions: { target: ts.ScriptTarget.ES2023 },
    }).outputText,
    context,
  );
  return runInContext(controlArgument("setPause"), context) as PauseState;
}

function flight() {
  const model = new GameModel(CONTENT, supportEntropy);
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

describe("in-flight weapon selection", () => {
  it("keeps the active controls through consecutive swaps and honors the modal and readiness fences", () => {
    const model = flight();
    const current = model.state.flight!;
    current.ownedWeapons = ["rapidMissile", "multiLaser"];
    current.ammo.rapidMissile = 2;
    current.ammo.multiLaser = 3;
    current.fireCooldown = 0.12;
    const reset = vi.fn();
    const flushScene = vi.fn();
    const scene = {
      controls: { reset },
      emergencyReturn: { active: false },
      entryCurrent: () => true,
      model,
      settingsOpen: false,
    };
    const requiredReady = vi.fn(() => true);
    const context = createContext({
      flushScene,
      newer: false,
      observeFeedback: vi.fn(),
      refreshScene: vi.fn(),
      requiredReady,
      scene,
    });
    context.apply = runInContext(callback("apply"), context);
    const select = runInContext(callback("onWeaponSelect"), context) as (
      weapon: typeof current.weapon,
    ) => boolean;
    expect(select("rapidMissile")).toBe(false);
    expect(current.weapon).toBe("rapidMissile");
    expect(select("multiLaser")).toBe(false);
    expect(current.weapon).toBe("multiLaser");
    expect(current.fireCooldown).toBe(0.12);
    expect(reset).not.toHaveBeenCalled();
    expect(flushScene).toHaveBeenCalledTimes(2);

    scene.settingsOpen = true;
    select("laser");
    expect(current.weapon).toBe("multiLaser");
    scene.settingsOpen = false;
    requiredReady.mockReturnValue(false);
    select("laser");
    expect(current.weapon).toBe("multiLaser");
    expect(flushScene).toHaveBeenCalledTimes(2);
  });
});

describe("conversation exposure under covering cards", () => {
  function covered(kind: "dialogue" | "docked" | "settings", emergency: boolean) {
    const model = flight();
    model.state.dialogue =
      kind === "dialogue" ? { choices: [], context: "test", text: "Panel", title: "Astra" } : null;
    model.state.docked = kind === "docked" ? "station" : null;
    const line = { key: "penny:1:displayed-cache:0", text: "Conversation" };
    const acknowledge = vi.spyOn(model, "pennyNoticeDisplayed").mockImplementation(() => {});
    const marker = {
      category: "discovery" as const,
      id: "displayed-cache",
      identified: false,
      known: false,
      symbol: "wreck" as const,
      x: 1450,
      y: 0,
    };
    const markers = vi.spyOn(model, "targetMarkers").mockReturnValue([marker]);
    const place = vi.fn();
    const read = vi.fn((): typeof line | null => line);
    Object.defineProperty(model, "conversation", { get: read });
    const returning = { text: "Return" };
    const render = vi.fn();
    const scene = {
      boxOccupant: null as string | null,
      controls: { layout: () => ({ insets: NO_INSETS, view: SCREEN }) },
      conversationBox: { render },
      emergencyReturn: { line: emergency ? returning : null },
      jumping: false,
      light: false,
      litCaches: new Set<string>(),
      model,
      palette: { pointOfInterest: 0x65c9bf, threat: 0xffffff },
      reducedMotion: false,
      savingUnavailable: true,
      settingsOpen: kind === "settings",
    };
    const pennyLayers = new WeakMap([[scene, { place }]]);
    const hud = { height: 30, width: 100, x: 0, y: 0 };
    const footprints = vi.fn(() => [hud]);
    const document = { getElementById: () => null, hidden: false };
    const networkPlay = vi.fn(() => false);
    const context = createContext({
      BOX_OCCUPANT,
      VIEW_HOST_ID,
      boxOccupant,
      coarsePointer: () => false,
      coveredScenePaint: new WeakMap(),
      createCoveredPaint,
      document,
      markerFootprints: footprints,
      pennyLayers,
      safeGameArea,
      scanViews: new WeakMap(),
      showNetworkPlay: networkPlay,
      window: {},
    });
    const update = runInContext(callback("renderConversation"), context) as (
      value: typeof scene,
    ) => void;
    return {
      acknowledge,
      document,
      footprints,
      hud,
      line,
      marker,
      markers,
      model,
      networkPlay,
      place,
      read,
      render,
      returning,
      scene,
      update: () => update(scene),
    };
  }

  it.each(["dialogue", "docked"] as const)(
    "does not read or expose hidden chatter behind %s",
    (kind) => {
      const ui = covered(kind, false);
      ui.update();
      expect(ui.read).not.toHaveBeenCalled();
      expect(ui.acknowledge).not.toHaveBeenCalled();
      expect(ui.markers).not.toHaveBeenCalled();
      expect(ui.place.mock.lastCall?.at(-1)).toEqual([]);
      expect(ui.render).toHaveBeenLastCalledWith(null, true, false);
      expect(ui.scene.boxOccupant).toBe("save");
      ui.scene.settingsOpen = false;
      ui.model.state.dialogue = null;
      ui.model.state.docked = null;
      ui.update();
      expect(ui.read).toHaveBeenCalledOnce();
      expect(ui.render).toHaveBeenLastCalledWith(ui.line, true, false);
      expect(ui.acknowledge).not.toHaveBeenCalled();
      expect(ui.markers).toHaveBeenCalledExactlyOnceWith(
        safeGameArea(NO_INSETS, SCREEN),
        ui.scene.litCaches,
      );
      expect(ui.place.mock.lastCall?.at(-1)).toEqual([ui.marker]);
      expect(ui.scene.boxOccupant).toBe("line");
    },
  );

  it("counts network-play only when the flight's slot can be read", () => {
    const ui = covered("settings", false);
    ui.read.mockReturnValue(null);
    const reading = (visible: boolean) => {
      ui.update();
      expect(ui.networkPlay).toHaveBeenLastCalledWith(ui.scene, visible);
    };
    reading(false);
    ui.scene.settingsOpen = false;
    reading(true);
    ui.model.state.notice = "A flight notice";
    reading(false);
    ui.model.state.notice = "";
    ui.read.mockReturnValueOnce(ui.line);
    reading(false);
    ui.document.hidden = true;
    reading(false);
    ui.document.hidden = false;
    ui.scene.jumping = true;
    reading(false);
    ui.scene.jumping = false;
    reading(true);
  });

  it("measures the HUD footprints only for markers to place", () => {
    const ui = covered("docked", false);
    ui.update();
    expect(ui.place.mock.lastCall?.at(-1)).toEqual([]);
    expect(ui.place.mock.lastCall?.[2].blocked).toEqual([]);
    expect(ui.footprints).not.toHaveBeenCalled();
    ui.model.state.docked = null;
    ui.update();
    expect(ui.place.mock.lastCall?.at(-1)).toEqual([ui.marker]);
    expect(ui.footprints).toHaveBeenCalledOnce();
    expect(ui.place.mock.lastCall?.[2].blocked).toEqual([ui.hud]);
  });

  it("retains already painted chatter and markers under UI without advancing knowledge", () => {
    const ui = covered("settings", false);
    ui.scene.settingsOpen = false;
    ui.update();
    expect(ui.markers).toHaveBeenCalledOnce();
    expect(ui.read).toHaveBeenCalledOnce();
    ui.scene.settingsOpen = true;
    ui.update();
    expect(ui.markers).toHaveBeenCalledOnce();
    expect(ui.read).toHaveBeenCalledOnce();
    expect(ui.acknowledge).not.toHaveBeenCalled();
    expect(ui.render).toHaveBeenLastCalledWith(ui.line, true, false);
    expect(ui.place.mock.lastCall?.at(-1)).toEqual([ui.marker]);
    expect(ui.scene.boxOccupant).toBe("line");
  });

  it.each(["settings", "dialogue", "docked"] as const)(
    "preserves the emergency overlay above %s without reading ordinary chatter",
    (kind) => {
      const ui = covered(kind, true);
      ui.update();
      expect(ui.read).not.toHaveBeenCalled();
      expect(ui.render).toHaveBeenLastCalledWith(ui.returning, true, false);
      expect(ui.acknowledge).not.toHaveBeenCalled();
      expect(ui.markers).not.toHaveBeenCalled();
      expect(ui.place.mock.lastCall?.at(-1)).toEqual([]);
      expect(ui.scene.boxOccupant).toBe("line");
    },
  );
});

describe("network-play notice", () => {
  it.each([
    ["quota", CONTENT.labels.networkPlayQuota!],
    ["unsupported", CONTENT.labels.networkPlayUnsupported!],
  ] as const)("gives %s one line's visible reading time per launch", (reason, text) => {
    const networkPlays = new WeakMap<object, { reason: string; remaining?: number }>();
    const context = createContext({ CONTENT, lineDuration, networkPlays });
    const show = runInContext(callback("showNetworkPlay"), context) as (
      value: typeof scene,
      visible: boolean,
    ) => boolean;
    const pause = runInContext(callback("pauseNetworkPlayClock"), context) as (
      value: typeof scene,
    ) => void;
    const scene = {
      model: { state: { flight: null as object | null, mode: "home" } },
      shell: { setNetworkPlay: vi.fn() },
      time: { now: 1000 },
    };
    const duration = lineDuration(text) * 1000;
    expect(show(scene, true)).toBe(false);
    expect(scene.shell.setNetworkPlay).not.toHaveBeenCalled();
    networkPlays.set(scene, { reason });
    expect(show(scene, true)).toBe(false);
    expect(scene.shell.setNetworkPlay).toHaveBeenLastCalledWith(undefined);
    scene.model.state = { flight: {}, mode: "space" };
    expect(show(scene, false)).toBe(true);
    scene.time.now += 4 * duration;
    expect(show(scene, false)).toBe(true);
    expect(scene.shell.setNetworkPlay).toHaveBeenLastCalledWith(reason);

    expect(show(scene, true)).toBe(true);
    scene.time.now += 1000;
    expect(show(scene, true)).toBe(true);
    // The first frame under a cover can follow a long gap in scene updates.
    scene.time.now += 4 * duration;
    expect(show(scene, false)).toBe(true);
    scene.time.now += 4 * duration;
    expect(show(scene, true)).toBe(true);
    scene.time.now += 1000;
    expect(show(scene, true)).toBe(true);
    // Page visibility can change and return without a covered frame being sampled.
    pause(scene);
    scene.time.now += 4 * duration;
    expect(show(scene, true)).toBe(true);
    scene.time.now += duration - 2001;
    expect(show(scene, true)).toBe(true);
    scene.time.now += 2;
    expect(show(scene, true)).toBe(false);
    expect(scene.shell.setNetworkPlay).toHaveBeenLastCalledWith(undefined);

    scene.model.state = { flight: null, mode: "home" };
    show(scene, true);
    scene.model.state = { flight: {}, mode: "space" };
    expect(show(scene, true)).toBe(false);
  });

  it("holds Gameplay's copy for each reason", () => {
    expect(CONTENT.labels.networkPlayUnsupported).toBe(
      "Playing online. This browser can't download the game for offline play.",
    );
    expect(CONTENT.labels.networkPlayQuota).toBe(
      "Playing online. Storage is full, so the game can't download for offline play.",
    );
  });
});

describe("station service caller", () => {
  it("reads canonical docked service facts live and leaves off-dock null unchanged", () => {
    const services = {
      equipment: true,
      exchange: true as const,
      heldTask: false,
      jobs: false,
      projects: false,
      weaponsAmmo: false,
    };
    let actual: typeof services | null = services;
    const model = {
      get stationServices() {
        return actual;
      },
    };
    const read = runInContext(
      callback("services"),
      createContext({ scene: { model } }),
    ) as () => typeof actual;
    expect(read()).toBe(services);
    actual = null;
    expect(read()).toBeNull();
  });
});

describe("universal pause caller", () => {
  it("keeps Pause absent on the title and loading screens, with Settings nested in navigation", () => {
    const model = new GameModel(CONTENT, supportEntropy);
    expect(pauseView(model).place).toBeNull();
    expect(pauseView(model, "loading").place).toBeNull();
    expect(source.text).not.toMatch(/controls\.set(?:Settings|Achievements)Button/u);
    const exit = controlArgument("setExitButton");
    expect(runInContext(exit, createContext({ exitShown: () => true, start: true }))).toBe(true);
    expect(runInContext(exit, createContext({ exitShown: () => true, start: false }))).toBe(false);
    expect(runInContext(exit, createContext({ exitShown: () => false, start: true }))).toBe(false);
  });

  it("uses Menu during nonpausable flight dialogue and docking", () => {
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
      expect(view.place).toBeNull();
      expect(view.navigation).toBe("menu");
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

  it("leaves the local map unbuilt under a covering story page and builds it in flight", () => {
    const model = flight();
    expect(pauseView(model).map).not.toBeNull();
    expect(pauseView(model, model.screen, true).map).toBeNull();
  });

  it("offers Menu on each Earth story page without advancing or answering its choice", () => {
    const model = new GameModel(CONTENT, supportEntropy);
    model.start();
    const pages: string[] = [];
    let choice = false;
    for (let turn = 0; turn < 60 && model.screen === "story"; turn++) {
      const before = structuredClone(model.storyView);
      expect(pauseView(model).place).toBeNull();
      expect(pauseView(model).navigation).toBe("menu");
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

  it("offers Earth no Map and leaves the exact room through scene callbacks", () => {
    const model = new GameModel(CONTENT, supportEntropy);
    model.state.started = true;
    model.state.prologueSeen = true;
    model.state.progress[1].opened = true;
    model.continueGame();
    const before = structuredClone(model.storyView);
    const scene = { controls: { focusGalaxies: vi.fn() }, model };
    const context = createContext({
      apply: (action: () => void) => action(),
      galaxiesAvailable,
      scene,
    });
    const open = runInContext(callback("scene.openGalaxies"), context) as () => void;
    expect(pauseView(model).canMap).toBe(false);
    expect(pauseView(model).place).toBeNull();
    expect(pauseView(model).navigation).toBe("menu");
    open();
    expect(model.screen).toBe("story");
    expect(model.storyView).toEqual(before);
    expect(pauseView(model).canMap).toBe(false);
    expect(scene.controls.focusGalaxies).not.toHaveBeenCalled();
  });

  it("cannot consume a mandatory Earth choice through Map or Back to title", () => {
    const model = new GameModel(CONTENT, supportEntropy);
    model.start();
    for (let turn = 0; turn < 60 && !model.storyView?.choices.length; turn++) {
      model.storyNext();
    }
    expect(model.storyView!.choices.length).toBeGreaterThan(0);
    const snapshot = () => {
      const view = model.storyView!;
      const saved = model.saveDocument();
      return {
        canGoBack: view.canGoBack,
        canSkip: view.canSkip,
        choices: structuredClone(view.choices),
        cursor: structuredClone(saved.pendingStory!.cursor),
        page: structuredClone(view.page),
        slept: saved.pendingStory!.slept,
        state: structuredClone(model.state),
      };
    };
    const before = snapshot();
    const effects = vi.spyOn(
      model as unknown as { applyEffect: (scene: unknown) => void },
      "applyEffect",
    );
    const scene = { jumping: false, model };
    const context = createContext({
      apply: (action: () => void) => action(),
      galaxiesAvailable,
      scene,
    });
    const open = runInContext(callback("scene.openGalaxies"), context) as () => void;
    const leave = runInContext(callback("onBackToTitle"), context) as () => void;
    expect(pauseView(model).place).toBeNull();
    expect(pauseView(model).navigation).toBe("menu");
    expect(pauseView(model).canMap).toBe(false);
    open();
    expect(snapshot()).toEqual(before);
    leave();
    expect(model.screen).toBe("start");
    expect(model.canContinue).toBe(true);
    expect(model.state.started).toBe(false);
    model.continueGame();
    expect(snapshot()).toEqual(before);
    model.storyNext();
    expect(snapshot()).toEqual(before);
    expect(effects).not.toHaveBeenCalled();
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
    expect(pauseView(model).place).toBeNull();
    expect(pauseView(model).navigation).toBe("menu");
    leave();
    expect(model.screen).toBe("start");
    expect(pauseView(model).place).toBeNull();
    model.continueGame();
    expect(model.state.dialogue).toEqual(dialogue);
    expect(pauseView(model).place).toBeNull();
    expect(pauseView(model).navigation).toBe("menu");
  });
});

describe("held story Continue caller", () => {
  it("passes model permission to the shell without setting started", () => {
    const model = new GameModel(CONTENT, supportEntropy);
    Object.defineProperty(model, "canContinue", { value: true });
    Object.defineProperty(model, "noticeOpacity", { value: 0.5 });
    let call: ts.CallExpression | undefined;
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && node.expression.getText(source) === "scene.shell.render") {
        call = node;
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    if (!call) {
      throw new Error("Missing shell render caller");
    }
    const render = vi.fn();
    const code = ts.transpileModule(call.getText(source), {
      compilerOptions: { target: ts.ScriptTarget.ES2023 },
    }).outputText;
    runInContext(
      code,
      createContext({
        continuation: model,
        scene: { shell: { render } },
        screen: model.screen,
        state: model.state,
      }),
    );
    expect(render).toHaveBeenCalledWith(model.state, "start", true, 0.5);
    expect(model.state.started).toBe(false);
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

// A scene wired with the production apply, cheat and flush callbacks over a real store.
function cheatScene(model: GameModel) {
  const values = new Map<string, string>([["ada-the-navigator.sound", "off"]]);
  const port = {
    read: async (key: string) => values.get(key) ?? null,
    write: vi.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
  };
  const scene = {
    controls: { closePause: vi.fn(), closeSettings: vi.fn(), reset: vi.fn(), setGains: vi.fn() },
    emergencyReturn: { active: false },
    entropy: vi.fn(() => 173),
    entryCurrent: () => true,
    held: undefined as unknown,
    model,
    savingUnavailable: false,
    shell: { setSavingAvailable: vi.fn() },
    sys: { isActive: () => true },
  };
  const context = createContext({
    CHEAT_COPY,
    CONTENT,
    GameModel,
    newer: false,
    observeFeedback: vi.fn(),
    openCampaignRewinds: new WeakMap(),
    openRewoundCampaign,
    refreshScene: vi.fn(),
    requestUpdateCheck: vi.fn(),
    requiredLoading: { state: { attempt: 1 } },
    requiredReady: () => true,
    saves: createAdaSaves(port, undefined, {
      lock: async (operation) => operation(),
    }),
    scene,
    writingCampaignRewinds: new WeakSet(),
  });
  for (const name of [
    "flushScene",
    "campaignRewindAllowed",
    "commitCampaignRewind",
    "apply",
    "replaceModel",
  ]) {
    context[name] = runInContext(callback(name), context);
  }
  const cheat = runInContext(callback("cheat"), context) as (id: CheatId) => CheatAction;
  const settle = async () => {
    for (let turn = 0; turn < 10; turn++) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
    }
  };
  const stored = () => {
    const save = JSON.parse(values.get(SAVE_KEYS.save)!) as GameSave & { adaSaveStamp?: unknown };
    delete save.adaSaveStamp;
    return save;
  };
  return {
    apply: context.apply as (action: () => void) => void,
    cheat,
    context,
    flush: () => (context.flushScene as (value: typeof scene) => Promise<void>)(scene),
    port,
    scene,
    settle,
    stored,
    values,
  };
}

it("commits the stored campaign with its cheat grants and only then hands off", async () => {
  const f = cheatScene(flight());
  const emergency = f.scene.emergencyReturn;
  f.scene.model.state.economy.stardust = 95;
  await f.flush();
  f.cheat("addStardust").run();
  await f.settle();
  const source = await f.context.saves.readCampaign();
  expect(source.save.economy.stardust).toBe(95 + CHEAT_AMOUNT);
  const commit = () => f.context.commitCampaignRewind(f.scene, source, () => true);
  f.port.write.mockRejectedValueOnce(new Error("storage unavailable"));
  expect(await commit()).toBeNull();
  expect(f.scene.model.screen).toBe("space");
  expect(f.stored().pendingStory).toBeUndefined();
  emergency.active = true;
  expect(await commit()).toBeNull();
  emergency.active = false;
  const handoff = await commit();
  expect(handoff).not.toBeNull();
  expect(f.stored()).toMatchObject({
    economy: { stardust: 95 + CHEAT_AMOUNT },
    selectedGalaxy: 1,
    unlocked: [1],
  });
  expect(f.stored().pendingStory).toBeDefined();
  expect(f.scene.model.screen).toBe("space");
  // Closing the real navigation layer notifies onPauseChange, which attempts an autosave.
  const writes = f.port.write.mock.calls.length;
  f.scene.controls.closeSettings.mockImplementation(() => void f.flush());
  handoff(true);
  await f.settle();
  expect(f.port.write).toHaveBeenCalledTimes(writes);
  expect(f.stored().economy.stardust).toBe(95 + CHEAT_AMOUNT);
  expect(f.scene.model.screen).toBe("story");
  expect(f.scene.model.state.economy.stardust).toBe(95 + CHEAT_AMOUNT);
  expect(f.values.get("ada-the-navigator.sound")).toBe("off");
  // The retained geography needs only one draw, from the scene's source, on launch.
  f.scene.model.startGalaxy(1);
  expect(f.scene.entropy).toHaveBeenCalledExactlyOnceWith();
  expect(f.scene.model.state.flight?.encounterSeed).toBe(173);
});

it("checks for updates when Continue leaves Start and when play returns to it", async () => {
  const f = cheatScene(new GameModel(CONTENT, supportEntropy, flight().save()));
  const leave = runInContext(callback("onBackToTitle"), f.context) as () => void;
  const resume = runInContext(callback("continueGame"), f.context) as () => void;
  const check = f.context.requestUpdateCheck;
  await f.flush();
  leave();
  expect(check).not.toHaveBeenCalled();

  resume();
  expect(f.scene.model.screen).toBe("space");
  expect(check).toHaveBeenCalledOnce();

  f.apply(() => {});
  expect(check).toHaveBeenCalledOnce();
  leave();
  expect(f.scene.model.screen).toBe("start");
  expect(check).toHaveBeenCalledTimes(2);

  leave();
  await f.settle();
  expect(check).toHaveBeenCalledTimes(2);
});

it("checks for updates when starting a new game from Start", async () => {
  const f = cheatScene(new GameModel(CONTENT, supportEntropy));
  const start = runInContext(callback("start"), f.context) as () => void;
  expect(f.scene.model.screen).toBe("start");
  start();
  await f.settle();
  expect(f.scene.model.screen).not.toBe("start");
  expect(f.context.requestUpdateCheck).toHaveBeenCalledOnce();
});

describe("cheats on the real save", () => {
  it("saves a cheat grant with play and keeps it through Back to title, reload and Continue", async () => {
    const f = cheatScene(flight());
    await f.flush();
    const start = f.scene.model.state.economy.stardust;
    const cargo = f.scene.model.state.flight!.cargo;
    f.cheat("addStardust").run();
    f.cheat("unlockAllWeapons").run();
    f.cheat("addOre").run();
    await f.settle();
    const owned = [...UPGRADE_WEAPONS].sort();
    expect(f.stored().economy.stardust).toBe(start + CHEAT_AMOUNT);
    expect([...f.stored().economy.ownedWeapons].sort()).toEqual(owned);
    expect(f.stored().flight!.cargo).toBe(cargo + CHEAT_AMOUNT);
    // Play after a cheat keeps saving.
    f.apply(() => {
      f.scene.model.state.economy.stardust += 7;
    });
    await f.settle();
    expect(f.stored().economy.stardust).toBe(start + CHEAT_AMOUNT + 7);
    f.apply(() => f.scene.model.backToTitle());
    await f.settle();
    expect(f.scene.model.screen).toBe("start");
    for (const model of [f.scene.model, relaunch(CONTENT, f.stored())]) {
      model.continueGame();
      expect(model.state.mode).toBe("space");
      expect(model.state.economy.stardust).toBe(start + CHEAT_AMOUNT + 7);
      expect([...model.state.flight!.ownedWeapons!].sort()).toEqual(owned);
      expect(model.state.flight!.cargo).toBe(cargo + CHEAT_AMOUNT);
    }
  });

  it("earns and saves an achievement a cheat reaches", async () => {
    const model = flight();
    model.state.economy.paints = [...ECONOMY.paintOrder.slice(0, 1)];
    const f = cheatScene(model);
    await f.flush();
    f.cheat("unlockAllEquipment").run();
    f.apply(() => model.recordAchievement({ kind: "jobCompleted" }));
    await f.settle();
    expect(f.stored().achievements.unlocked).toContain("fullPalette");
    expect(f.stored().achievements.jobs).toBe(1);
  });

  it("applies start-screen cheats to the flight Continue resumes", async () => {
    const played = flight();
    const cargo = played.state.flight!.cargo;
    const f = cheatScene(new GameModel(CONTENT, supportEntropy, played.save()));
    await f.flush();
    expect(f.scene.model.screen).toBe("start");
    f.cheat("unlockAllGalaxies").run();
    f.cheat("unlockAllWeapons").run();
    f.cheat("addOre").run();
    await f.settle();
    expect(f.stored().unlocked).toHaveLength(6);
    expect(f.stored().flight!.cargo).toBe(cargo + CHEAT_AMOUNT);
    f.apply(() => f.scene.model.continueGame());
    await f.settle();
    const resumed = f.scene.model.state;
    expect(resumed.mode).toBe("space");
    expect(resumed.unlocked).toHaveLength(6);
    expect([...resumed.flight!.ownedWeapons!].sort()).toEqual([...UPGRADE_WEAPONS].sort());
    expect(resumed.flight!.cargo).toBe(cargo + CHEAT_AMOUNT);
    expect(f.stored().unlocked).toHaveLength(6);
  });

  it("applies start-screen cheats to the game Start begins", async () => {
    const f = cheatScene(new GameModel(CONTENT, supportEntropy));
    const start = runInContext(callback("start"), f.context) as () => void;
    f.cheat("addStardust").run();
    f.cheat("unlockAllWeapons").run();
    await f.settle();
    start();
    await f.settle();
    expect(f.scene.model.screen).not.toBe("start");
    expect(f.scene.model.state.economy.stardust).toBe(CHEAT_AMOUNT);
    expect(f.stored().economy.stardust).toBe(CHEAT_AMOUNT);
    expect([...f.stored().economy.ownedWeapons].sort()).toEqual([...UPGRADE_WEAPONS].sort());
  });

  it("returns to a new save on Restart after cheats", async () => {
    const f = cheatScene(new GameModel(CONTENT, supportEntropy, flight().save()));
    f.cheat("addStardust").run();
    f.cheat("unlockAllGalaxies").run();
    f.cheat("unlockAllWeapons").run();
    await f.settle();
    expect(f.stored().unlocked).toHaveLength(6);
    f.apply(() => f.scene.model.restart());
    await f.settle();
    // Restart keeps achievements; everything else is a new save.
    const fresh = JSON.parse(new GameModel(CONTENT, supportEntropy).save()) as GameSave;
    expect({ ...f.stored(), achievements: fresh.achievements }).toEqual(fresh);
    expect(f.scene.model.canContinue).toBe(false);
  });

  it("routes normal save writes through flushScene", () => {
    const writes = readdirSync(new URL("..", import.meta.url), { recursive: true })
      .map(String)
      .filter((path) => path.endsWith(".ts") && !path.endsWith(".test.ts"))
      .flatMap((path) =>
        [
          ...readFileSync(new URL(`../${path}`, import.meta.url), "utf8").matchAll(
            /saves\.save\(/gu,
          ),
        ].map(() => path),
      );
    expect(writes).toEqual(["game/sceneUi.ts"]);
    expect(callback("flushScene")).toContain("saves.save(");
  });
});

describe("canonical save caller", () => {
  it("passes the full effective snapshot and reflects asynchronous save status", async () => {
    const model = flight();
    const held = new GameModel(CONTENT, supportEntropy, model.save());
    expect(held.state.mode).toBe("home");
    const save = vi
      .fn()
      .mockResolvedValueOnce({ reason: "quota", status: "unavailable" })
      .mockResolvedValueOnce({ status: "saved" });
    const scene = {
      entryCurrent: () => true,
      model: held,
      savingUnavailable: false,
      shell: { setSavingAvailable: vi.fn() },
      sys: { isActive: () => true },
    };
    const context = createContext({
      openCampaignRewinds: new WeakMap(),
      requiredLoading: { state: { attempt: 1 } },
      requiredReady: () => true,
      saves: { save },
      writingCampaignRewinds: new WeakSet(),
    });
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

  it("suspends ordinary writes while the rewind confirmation owns the scene", async () => {
    const f = cheatScene(flight());
    const isOpen = vi.fn().mockReturnValue(true);
    f.context.openCampaignRewinds.set(f.scene, isOpen);
    await f.flush();
    expect(f.port.write).not.toHaveBeenCalled();
    isOpen.mockReturnValue(false);
    await f.flush();
    expect(f.port.write).toHaveBeenCalledOnce();
  });

  it.each([true, false])(
    "blocks all model action dispatch for a newer-save placeholder=%s",
    (newer) => {
      const action = vi.fn();
      const scene = {
        controls: { reset: vi.fn() },
        emergencyReturn: { active: false },
        entryCurrent: () => true,
        model: { screen: "space" },
      };
      const context = createContext({
        flushScene: vi.fn(),
        newer,
        observeFeedback: vi.fn(),
        refreshScene: vi.fn(),
        requiredReady: () => true,
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

describe("required entry save admission", () => {
  it("blocks unready save admission and ignores an admitted stale completion", async () => {
    let ready = false,
      current = true,
      finish!: (value: unknown) => void;
    const requiredLoading = { state: { attempt: 1 } };
    const save = vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const snapshot = { mode: "home", unlocked: [1] };
    const scene = {
      entryCurrent: () => current,
      model: { saveDocument: () => snapshot },
      savingUnavailable: false,
      shell: { setSavingAvailable: vi.fn() },
      sys: { isActive: () => true },
    };
    const flush = runInContext(
      callback("flushScene"),
      createContext({
        openCampaignRewinds: new WeakMap(),
        requiredLoading,
        requiredReady: () => ready,
        saves: { save },
        writingCampaignRewinds: new WeakSet(),
      }),
    ) as (value: typeof scene) => Promise<void>;
    await flush(scene);
    expect(save).not.toHaveBeenCalled();
    ready = true;
    const pending = flush(scene);
    expect(save).toHaveBeenCalledExactlyOnceWith(snapshot);
    current = false;
    requiredLoading.state.attempt++;
    finish({ status: "saved" });
    await pending;
    expect(scene.shell.setSavingAvailable).not.toHaveBeenCalled();
    expect(scene.savingUnavailable).toBe(false);
    await flush(scene);
    expect(save).toHaveBeenCalledOnce();
  });
  it("uses the same readiness and ownership admission for model-changing UI actions", () => {
    let ready = false,
      current = true;
    const action = vi.fn();
    const scene = {
      controls: { reset: vi.fn() },
      emergencyReturn: { active: false },
      entryCurrent: () => current,
      model: { screen: "space" },
    };
    const apply = runInContext(
      callback("apply"),
      createContext({
        flushScene: vi.fn(),
        newer: false,
        observeFeedback: vi.fn(),
        refreshScene: vi.fn(),
        requiredReady: () => ready,
        scene,
      }),
    ) as (action: () => void) => void;
    apply(action);
    ready = true;
    current = false;
    apply(action);
    expect(action).not.toHaveBeenCalled();
    current = true;
    apply(action);
    expect(action).toHaveBeenCalledOnce();
  });
});

it.each(["shutdown", "destroy", "cancel"])(
  "disposes the actual scene UI wiring once on %s and subsequent retirement",
  async (first) => {
    const { EventEmitter } = await import("node:events");
    const events = new EventEmitter(),
      document = new EventTarget(),
      window = new EventTarget();
    // Normalize DOM capture options for Node's EventTarget removal implementation.
    const remove = window.removeEventListener.bind(window);
    window.removeEventListener = (type, callback, options) =>
      remove(type, callback, typeof options === "boolean" ? { capture: options } : options);
    const partial = [vi.fn(), vi.fn()],
      disposePartial = vi.fn(() => partial.forEach((stop) => stop()));
    const scene = {
      controls: { overlay: { inert: true } },
      disposeEntryResources: undefined as (() => void) | undefined,
      emergencyReturn: { cancel: vi.fn() },
      events,
      feedbackSound: { dispose: vi.fn(), unlock: vi.fn() },
      registerEntryCleanup: vi.fn<(cleanup: () => void) => () => void>(() => () => {}),
    };
    const hide = vi.fn(),
      blockReturnInput = vi.fn(),
      unregisterReturn = vi.fn(),
      stopPartial = vi.fn(),
      flushScene = vi.fn();
    for (const type of ["visibilitychange"]) {
      document.addEventListener(type, hide);
    }
    window.addEventListener("pagehide", hide);
    window.addEventListener("pointerdown", scene.feedbackSound.unlock);
    window.addEventListener("keydown", scene.feedbackSound.unlock);
    for (const type of ["keydown", "pointerdown", "click"]) {
      window.addEventListener(type, blockReturnInput, true);
    }
    const build = source.statements.find(
      (node) => ts.isFunctionDeclaration(node) && node.name?.text === "buildScene",
    ) as ts.FunctionDeclaration;
    const statements = [...build.body!.statements],
      start = statements.findIndex(
        (node) =>
          ts.isVariableStatement(node) &&
          node.declarationList.declarations.some(
            (decl) => decl.name.getText(source) === "disposedUi",
          ),
      ),
      end = statements.findIndex(
        (node, index) =>
          index > start &&
          ts.isExpressionStatement(node) &&
          ts.isCallExpression(node.expression) &&
          node.expression.expression.getText(source) === "observeFeedback",
      );
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const code = ts.transpileModule(
      statements
        .slice(start, end)
        .map((node) => node.getText(source))
        .join("\n"),
      { compilerOptions: { target: ts.ScriptTarget.ES2023 } },
    ).outputText;
    runInContext(
      code,
      createContext({
        Scenes: { Events: { DESTROY: "destroy", SHUTDOWN: "shutdown" } },
        blockReturnInput,
        disposePartial,
        document,
        flushScene,
        hide,
        scene,
        stopPartial,
        unregisterReturn,
        window,
      }),
    );
    if (first === "cancel") {
      scene.registerEntryCleanup.mock.calls[0]![0]();
    } else {
      events.emit(first);
    }
    events.emit("shutdown");
    events.emit("destroy");
    scene.disposeEntryResources!();
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("pagehide"));
    window.dispatchEvent(new Event("keydown"));
    expect(disposePartial).toHaveBeenCalledOnce();
    partial.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
    expect(scene.feedbackSound.dispose).toHaveBeenCalledOnce();
    expect(hide).not.toHaveBeenCalled();
    expect(blockReturnInput).not.toHaveBeenCalled();
    expect(flushScene).toHaveBeenCalledOnce();
    expect(stopPartial).toHaveBeenCalledOnce();
    expect(unregisterReturn).toHaveBeenCalledOnce();
  },
);
