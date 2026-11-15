import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { PHANTOM_FLAGSHIP } from "../data/phantom.ts";
import { SCREEN } from "../data/screen.ts";
import { GAME_AREA } from "../model/edgeMarkers.ts";
import { createEnemy } from "../model/enemyAi.ts";
import { enemyEquipmentDefinition } from "../model/enemyEquipment.ts";
import { GameModel } from "../model/game.ts";
import { hullOffset } from "../model/shipPhysics.ts";
import type { SpaceObject } from "../model/types.ts";
import {
  acknowledgePrimitiveGlint,
  acknowledgePrimitiveTarget,
  primitiveTargetInView,
} from "./sceneTargetMarkers.ts";
import { isDiscoveryCache } from "./worldArt.ts";

function production(file: string, names: readonly string[], globals: object) {
  const source = ts.createSourceFile(
    file,
    readFileSync(new URL(file, import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const code = source.statements
    .filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text ?? ""))
    .map((node) => node.getText(source).replace(/^export /u, ""))
    .join("\n");
  const context = createContext(globals);
  runInContext(
    ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2023 } }).outputText,
    context,
  );
  return context;
}
function fixture() {
  const model = new GameModel(CONTENT);
  model.state.prologueSeen = true;
  model.startGalaxy(1);
  model.state.dialogue = null;
  model.state.docked = null;
  const target: SpaceObject = { hp: 1, id: "target", kind: "destination", radius: 20, x: 0, y: 0 };
  model.state.flight!.objects = [target];
  const displayed = vi.spyOn(model, "markerTargetDisplayed").mockImplementation(() => {});
  const glint = vi.spyOn(model, "markerGlintDisplayed").mockImplementation(() => {});
  const ink = {
    alpha: 1,
    fillCircle: vi.fn(),
    fillEllipse: vi.fn(),
    fillPoints: vi.fn(),
    fillStyle: vi.fn(),
    fillTriangle: vi.fn(),
    lineBetween: vi.fn(),
    lineStyle: vi.fn(),
    strokeCircle: vi.fn(),
    strokeEllipse: vi.fn(),
    strokePoints: vi.fn(),
    strokeRect: vi.fn(),
    strokeTriangle: vi.fn(),
    visible: true,
  };
  const scene = {
    galaxyStations: new Map(),
    ink,
    landmarkSprites: new Map(),
    light: false,
    litCaches: new Set<string>(),
    model,
    outpostArt: new Map(),
    overlay: ink,
    palette: { active: 1, environment: 1, environmentDetail: 1, obstacle: 1, pointOfInterest: 1 },
    project: (point: { x: number; y: number }) => point,
    reducedMotion: false,
    settingsOpen: false,
    time: { now: 0 },
    warpCover: false,
  };
  const globals = {
    CONTENT,
    ECONOMY,
    PHANTOM_FLAGSHIP,
    PhaserMath: {
      Vector2: class {
        readonly x: number;
        readonly y: number;
        constructor(x: number, y: number) {
          this.x = x;
          this.y = y;
        }
      },
    },
    SCREEN,
    acknowledgePrimitiveGlint,
    acknowledgePrimitiveTarget,
    destinationDrawn: () => true,
    enemyEquipmentDefinition,
    familyArt: () => undefined,
    hullOffset,
    isDiscoveryCache,
    loadEnemyParts: vi.fn(),
    scenerySilhouette: () => undefined,
    stardustShown: (release?: { at: number }) => !release,
  };
  return { displayed, glint, globals, ink, model, scene, target };
}

describe("emitted primitive marker geometry", () => {
  it("clips the actual ellipse rather than identifying its bounding-box corner", () => {
    expect(
      primitiveTargetInView({
        center: { x: -9, y: -9 },
        filled: true,
        height: 20,
        kind: "ellipse",
        width: 20,
      }),
    ).toBe(false);
    expect(
      primitiveTargetInView({
        center: { x: -9, y: 50 },
        filled: true,
        height: 20,
        kind: "ellipse",
        width: 20,
      }),
    ).toBe(true);
    expect(
      primitiveTargetInView({
        center: { x: 360, y: 180 },
        filled: false,
        height: 2000,
        kind: "ellipse",
        width: 2000,
      }),
    ).toBe(false);
  });
  it("clips actual segments and filled polygons, including a viewport-enclosing hull", () => {
    expect(
      primitiveTargetInView({
        closed: false,
        filled: false,
        kind: "path",
        points: [
          { x: -10, y: -1 },
          { x: 800, y: -1 },
        ],
      }),
    ).toBe(false);
    expect(
      primitiveTargetInView({
        closed: false,
        filled: false,
        kind: "path",
        points: [
          { x: -10, y: 20 },
          { x: 800, y: 20 },
        ],
      }),
    ).toBe(true);
    expect(
      primitiveTargetInView({
        closed: true,
        filled: true,
        kind: "path",
        points: [
          { x: -10, y: -10 },
          { x: 800, y: -10 },
          { x: 800, y: 400 },
          { x: -10, y: 400 },
        ],
      }),
    ).toBe(true);
  });
  it("does not identify a station from its visible safety halo when the emitted hull is outside", () => {
    const f = fixture();
    const code = production(
      "./sceneObjects.ts",
      ["drawStation", "drawStationPlaceholder"],
      f.globals,
    );
    code.drawStation(f.scene, f.target, { x: -100, y: 100 }, 20);
    expect(f.ink.strokeEllipse).toHaveBeenCalled();
    expect(f.displayed).not.toHaveBeenCalled();
    code.drawStation(f.scene, f.target, { x: -20, y: 100 }, 20);
    expect(f.displayed).toHaveBeenCalledWith("target", f.scene.litCaches);
  });
  it("acknowledges only after the destination placeholder has actually drawn", () => {
    const f = fixture();
    const code = production("./sceneObjects.ts", ["drawDestination"], f.globals);
    code.drawDestination(f.scene, f.target, { x: 10, y: 10 }, 20);
    expect(f.ink.fillEllipse.mock.invocationCallOrder[0]).toBeLessThan(
      f.displayed.mock.invocationCallOrder[0]!,
    );
  });
  it("does not acknowledge an explicitly undrawn destination", () => {
    const f = fixture();
    const code = production("./sceneObjects.ts", ["drawDestination"], {
      ...f.globals,
      destinationDrawn: () => false,
    });
    code.drawDestination(f.scene, f.target, { x: 10, y: 10 }, 20);
    expect(f.ink.fillEllipse).not.toHaveBeenCalled();
    expect(f.displayed).not.toHaveBeenCalled();
  });
  it("acknowledges only a visible emitted discovery gem, preserving release and eligibility guards", () => {
    const f = fixture();
    const code = production("./sceneObjects.ts", ["drawStardust"], f.globals);
    const cache = { ...f.target, amount: 3, kind: "pickup", role: "discovery" };
    code.drawStardust(f.scene, { ...cache, release: { at: 1 } }, { x: 10, y: 10 }, 10);
    expect(f.displayed).not.toHaveBeenCalled();
    code.drawStardust(f.scene, cache, { x: 10, y: 10 }, 10);
    expect(f.displayed).toHaveBeenCalledWith("target", f.scene.litCaches);
    f.displayed.mockClear();
    code.drawStardust(f.scene, { ...cache, role: "loot" }, { x: 10, y: 10 }, 10);
    expect(f.displayed).not.toHaveBeenCalled();
  });
  it("does not acknowledge a missing-parts Phantom flagship that draws nothing", () => {
    const f = fixture();
    const code = production("./scenePhantom.ts", ["drawPhantomFlagship"], f.globals);
    expect(
      code.drawPhantomFlagship(f.scene, { ...f.target, enemy: {}, id: PHANTOM_FLAGSHIP }),
    ).toBe(false);
    expect(f.displayed).not.toHaveBeenCalled();
  });
  it("does not identify a culled object through its projected center or culling envelope", () => {
    const f = fixture();
    const code = production("./sceneObjects.ts", ["drawObject", "drawDestination"], f.globals);
    code.drawObject(f.scene, { ...f.target, x: 1000, y: 1000 });
    expect(f.ink.fillEllipse).not.toHaveBeenCalled();
    expect(f.displayed).not.toHaveBeenCalled();
  });
  it("acknowledges the actual no-art enemy hull polygon without changing its drawing", () => {
    const f = fixture();
    const definition = enemyDefinition(1, "fighter", "target");
    const object = {
      ...f.target,
      enemy: createEnemy(
        definition,
        { archetype: "fighter", id: "target", packId: null, phase: 0 },
        { x: 10, y: 10 },
      ),
      x: 10,
      y: 10,
    };
    const code = production("./sceneEnemies.ts", ["drawEnemy"], f.globals);
    code.drawEnemy(f.scene, { x: 10, y: 10 }, object);
    expect(f.ink.fillPoints).toHaveBeenCalled();
    expect(f.ink.fillPoints.mock.invocationCallOrder[0]).toBeLessThan(
      f.displayed.mock.invocationCallOrder[0]!,
    );
  });
  it("routes the actual no-state enemy triangle through the same acknowledgment", () => {
    const f = fixture();
    const code = production("./sceneEnemies.ts", ["drawEnemy"], f.globals);
    code.drawEnemy(f.scene, { x: -10, y: 100 }, f.target);
    expect(f.ink.strokeTriangle).toHaveBeenCalled();
    expect(f.displayed).toHaveBeenCalledWith("target", f.scene.litCaches);
  });
  it.each(["nebula", "wreck", "beacon"])(
    "acknowledges emitted %s landmark geometry without replacing Scan lesson handling",
    (kind) => {
      const f = fixture();
      Object.defineProperty(f.model, "jobScenery", {
        value: { landmarks: [{ id: "target", kind, x: 10, y: 10 }] },
      });
      const lesson = vi.spyOn(f.model, "landmarkDisplayed").mockImplementation(() => {});
      const code = production("./sceneWorld.ts", ["drawJobs"], f.globals);
      code.drawJobs(f.scene);
      expect(f.displayed).toHaveBeenCalledWith("target", f.scene.litCaches);
      expect(lesson).toHaveBeenCalledWith("target");
    },
  );
  it("acknowledges the actual hunt cross through the canonical glint facade", () => {
    const f = fixture();
    Object.defineProperty(f.model, "jobScenery", {
      value: { glint: { x: -2, y: 100 }, landmarks: [] },
    });
    const code = production("./sceneWorld.ts", ["drawJobs"], f.globals);
    code.drawJobs(f.scene);
    expect(f.glint).toHaveBeenCalled();
  });
  it.each(["hidden", "transparent", "masked", "covered"])(
    "suppresses %s primitive acknowledgments",
    (kind) => {
      const f = fixture();
      if (kind === "hidden") {
        f.ink.visible = false;
      }
      if (kind === "transparent") {
        f.ink.alpha = 0;
      }
      if (kind === "masked") {
        Object.assign(f.ink, { mask: {} });
      }
      if (kind === "covered") {
        f.scene.settingsOpen = true;
      }
      acknowledgePrimitiveTarget(
        f.scene,
        f.ink,
        { center: { x: 10, y: 10 }, filled: true, height: 20, kind: "ellipse", width: 20 },
        "target",
      );
      expect(f.displayed).not.toHaveBeenCalled();
    },
  );
  it("changes one real registry entry to identified without granting chart or story progress", () => {
    const f = fixture();
    f.displayed.mockRestore();
    f.model.state.flight!.objects[0]!.x = 2000;
    const progress = structuredClone(f.model.state.progress[1]);
    acknowledgePrimitiveTarget(
      f.scene,
      f.ink,
      { center: { x: 10, y: 10 }, filled: true, height: 20, kind: "ellipse", width: 20 },
      "target",
    );
    expect(f.model.targetMarkers(GAME_AREA).find(({ id }) => id === "target")).toMatchObject({
      identified: true,
    });
    expect(f.model.state.progress[1].known).toEqual(progress.known);
    expect(f.model.state.progress[1].charted).toEqual(progress.charted);
    expect(f.model.state.progress[1].stage).toBe(progress.stage);
  });
});
