import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import { drawCompactHullHud, hasCompactHullHud, isDiscoveryCache } from "../art/index.ts";
import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { PHANTOM_FLAGSHIP } from "../data/phantom.ts";
import { SCREEN } from "../data/screen.ts";
import { createEnemy } from "../model/ai/index.ts";
import { GAME_AREA } from "../model/edgeMarkers.ts";
import { enemyEquipmentDefinition } from "../model/enemyEquipment.ts";
import { GameModel } from "../model/game.ts";
import { stardustPickupFrameSize, stardustPickupReach } from "../model/pickupBody.ts";
import { hullOffset } from "../model/shipPhysics.ts";
import { discoveryCacheGroup } from "../model/stardustPlacement.ts";
import type { SpaceObject, Vec } from "../model/types.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import {
  acknowledgeCachePrimitive,
  acknowledgeCacheSprite,
  acknowledgePrimitiveGlint,
  acknowledgePrimitiveTarget,
  primitiveTargetInView,
} from "./sceneTargetMarkers.ts";

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
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
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
    destinationPlaceholderTops: new Map(),
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
    LIGHT_FIELD: { ink: 0x181425 },
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
    acknowledgeCachePrimitive,
    acknowledgeCacheSprite,
    acknowledgePrimitiveGlint,
    acknowledgePrimitiveTarget,
    destinationDrawn: () => true,
    discoveryCacheGroup,
    drawCompactHullHud,
    enemyEquipmentDefinition,
    familyArt: () => undefined,
    hasCompactHullHud,
    hullOffset,
    isDiscoveryCache,
    loadEnemyParts: vi.fn(),
    scenerySilhouette: () => undefined,
    stardustShown: (release?: { at: number }) => !release,
  };
  return { displayed, glint, globals, ink, model, scene, target };
}

describe("emitted primitive marker geometry", () => {
  it("includes two-pixel stroke fringes without extending butt-ended segments or their AABBs", () => {
    const points = [
      { x: 10, y: -0.5 },
      { x: 30, y: -0.5 },
    ];
    expect(
      primitiveTargetInView({ closed: false, filled: false, kind: "path", points, strokeWidth: 2 }),
    ).toBe(true);
    expect(
      primitiveTargetInView({
        closed: false,
        filled: false,
        kind: "path",
        points: [
          { x: -10, y: -0.5 },
          { x: -0.5, y: -0.5 },
        ],
        strokeWidth: 2,
      }),
    ).toBe(false);
    expect(
      primitiveTargetInView({
        closed: false,
        filled: false,
        kind: "path",
        points: [
          { x: -10, y: 2 },
          { x: 2, y: -10 },
        ],
        strokeWidth: 2,
      }),
    ).toBe(false);
  });
  it("checks the curved ellipse fringe, including inner edges and corner rejection", () => {
    expect(
      primitiveTargetInView({
        center: { x: -10.5, y: 50 },
        filled: false,
        height: 10,
        kind: "ellipse",
        strokeWidth: 2,
        width: 20,
      }),
    ).toBe(true);
    expect(
      primitiveTargetInView({
        center: { x: -11.1, y: 50 },
        filled: false,
        height: 10,
        kind: "ellipse",
        strokeWidth: 2,
        width: 20,
      }),
    ).toBe(false);
    expect(
      primitiveTargetInView({
        center: { x: -8, y: -8 },
        filled: false,
        height: 20,
        kind: "ellipse",
        strokeWidth: 2,
        width: 20,
      }),
    ).toBe(false);
    expect(
      primitiveTargetInView({
        center: { x: -7.4, y: -7.4 },
        filled: false,
        height: 20,
        kind: "ellipse",
        strokeWidth: 2,
        width: 20,
      }),
    ).toBe(true);
    const diameter = 2 * (Math.hypot(360, 180) + 0.5);
    expect(
      primitiveTargetInView({
        center: { x: 360, y: 180 },
        filled: false,
        height: diameter,
        kind: "ellipse",
        strokeWidth: 2,
        width: diameter,
      }),
    ).toBe(true);
  });
  it("checks an unequal-axis ellipse's curved corner rather than a dilated ellipse or AABB", () => {
    const q = { x: 10 / Math.sqrt(2), y: 5 / Math.sqrt(2) };
    const normal = { x: 1 / Math.sqrt(5), y: 2 / Math.sqrt(5) };
    for (const [offset, expected] of [
      [0.5, true],
      [1.1, false],
    ] as const) {
      expect(
        primitiveTargetInView({
          center: { x: -q.x - offset * normal.x, y: -q.y - offset * normal.y },
          filled: false,
          height: 10,
          kind: "ellipse",
          strokeWidth: 2,
          width: 20,
        }),
      ).toBe(expected);
    }
    expect(
      primitiveTargetInView({
        center: { x: 360, y: 180 },
        filled: false,
        height: 1000,
        kind: "ellipse",
        strokeWidth: 2,
        width: 2000,
      }),
    ).toBe(false);
  });
  it("matches installed Phaser's actual WebGL segment quads at stroke-only viewport edges", () => {
    const path = join(
      dirname(createRequire(import.meta.url).resolve("phaser/package.json")),
      "src/renderer/webgl/renderNodes/DrawLine.js",
    );
    const source = ts.createSourceFile(
      path,
      readFileSync(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    let body: ts.FunctionExpression | undefined;
    const visit = (node: ts.Node): void => {
      if (
        ts.isPropertyAssignment(node) &&
        node.name.getText(source) === "run" &&
        ts.isFunctionExpression(node.initializer)
      ) {
        body = node.initializer;
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(body).toBeDefined();
    const run = runInContext(`(${body!.getText(source)})`, createContext({})) as (
      ...args: unknown[]
    ) => void;
    for (const [a, b] of [
      [
        { x: 10, y: -0.5 },
        { x: 30, y: -0.5 },
      ],
      [
        { x: -10, y: -0.5 },
        { x: -0.5, y: -0.5 },
      ],
      [
        { x: -10, y: 2 },
        { x: 2, y: -10 },
      ],
    ]) {
      const vertices: number[] = [];
      run.call(
        { onRunBegin() {}, onRunEnd() {} },
        null,
        null,
        a!.x,
        a!.y,
        b!.x,
        b!.y,
        1,
        1,
        vertices,
      );
      const quad: Vec[] = [];
      for (let i = 0; i < vertices.length; i += 2) {
        quad.push({ x: vertices[i]!, y: vertices[i + 1]! });
      }
      expect(
        primitiveTargetInView({
          closed: false,
          filled: false,
          kind: "path",
          points: [a!, b!],
          strokeWidth: 2,
        }),
      ).toBe(primitiveTargetInView({ closed: true, filled: true, kind: "path", points: quad }));
    }
  });
  it("identifies a destination when only its emitted two-pixel ellipse stroke crosses the viewport", () => {
    const f = fixture();
    const code = production("./sceneObjects.ts", ["drawDestination"], f.globals);
    code.drawDestination(f.scene, f.target, { x: -25.5, y: 100 }, 20);
    expect(f.displayed).toHaveBeenCalledWith("target", f.scene.litCaches);
    f.displayed.mockClear();
    code.drawDestination(f.scene, f.target, { x: -26.1, y: 100 }, 20);
    expect(f.displayed).not.toHaveBeenCalled();
  });
  it("identifies a station from its two-pixel hull stroke only, never its approach ring", () => {
    const f = fixture();
    const code = production(
      "./sceneObjects.ts",
      ["drawStation", "drawStationPlaceholder"],
      f.globals,
    );
    code.drawStation(f.scene, f.target, { x: -24.5, y: 100 }, 20);
    expect(f.displayed).toHaveBeenCalledWith("target", f.scene.litCaches);
    f.displayed.mockClear();
    code.drawStation(f.scene, f.target, { x: -25.1, y: 100 }, 20);
    expect(f.displayed).not.toHaveBeenCalled();
  });

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
  it("does not identify a station from its visible approach ring when the emitted hull is outside", () => {
    const f = fixture();
    const code = production(
      "./sceneObjects.ts",
      ["drawStation", "drawStationPlaceholder"],
      f.globals,
    );
    code.drawStation(f.scene, f.target, { x: -100, y: 100 }, 20);
    // The approach ring marks Talk range, where Use offers Dock.
    const ring = CONTENT.tuning.talkRange;
    expect(f.ink.strokeEllipse).toHaveBeenCalledWith(-100, 100, ring * 2, ring);
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
  it.each([1, ECONOMY.discoveryStardust])(
    "acknowledges generated cache lore only after a %i-unit member emits visible geometry",
    (amount) => {
      const f = fixture();
      const cache = vi.spyOn(f.model, "discoveryCacheDisplayed");
      const code = production("./sceneObjects.ts", ["drawStardust"], f.globals);
      const member = {
        ...f.target,
        amount,
        id: amount === 1 ? "chunk:0,1:2:stardust:1" : "chunk:0,1:2:stardust:0",
        kind: "pickup",
        radius: stardustPickupReach(ECONOMY.stardustPickupRadius, amount),
        role: "stardust",
      };
      const near = { x: 10, y: 10 };
      code.drawStardust(f.scene, member, { x: -100, y: -100 }, member.radius);
      code.drawStardust(f.scene, { ...member, id: "ordinary:stardust:0" }, near, member.radius);
      code.drawStardust({ ...f.scene, warpCover: true }, member, near, member.radius);
      expect(cache).not.toHaveBeenCalled();
      code.drawStardust(f.scene, member, near, member.radius);
      expect(cache).toHaveBeenCalledExactlyOnceWith("chunk:0,1:2");
      expect(f.ink.fillCircle.mock.invocationCallOrder.at(-1)).toBeLessThan(
        cache.mock.invocationCallOrder[0]!,
      );
      expect(f.displayed).not.toHaveBeenCalled();
    },
  );
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
  it("draws a five-unit Stardust pickup larger without changing its sprite identity", () => {
    const f = fixture();
    const sprite = {
      setDisplaySize: vi.fn().mockReturnThis(),
      setOrigin: vi.fn().mockReturnThis(),
      setPosition: vi.fn().mockReturnThis(),
    };
    const objectSprite = vi.fn(() => sprite);
    const keylineSprite = vi.fn();
    const point = { x: 10, y: 12 };
    const scene = {
      ...f.scene,
      stardustArt: { asset: { id: "stardust", pivot: { x: 0.5, y: 0.5 } }, loopMs: 100 },
    };
    const drawPullStreak = vi.fn();
    const code = production("./sceneObjects.ts", ["drawStardust"], {
      ...f.globals,
      drawPullStreak,
      keylineSprite,
      objectSprite,
      stardustDrawn: () => point,
      stardustFrame: () => 2,
      stardustPhase: () => 0,
      stardustPickupFrameSize,
    });

    code.drawStardust(scene, { ...f.target, amount: 1 }, point, 9);
    code.drawStardust(scene, { ...f.target, amount: 5 }, point, 9);

    expect(sprite.setDisplaySize.mock.calls).toEqual([
      [stardustPickupFrameSize(1).width, stardustPickupFrameSize(1).height],
      [stardustPickupFrameSize(5).width, stardustPickupFrameSize(5).height],
    ]);
    expect(stardustPickupFrameSize(5).width).toBeGreaterThan(stardustPickupFrameSize(1).width);
    expect(objectSprite).toHaveBeenCalledTimes(2);
    expect(drawPullStreak).toHaveBeenLastCalledWith(
      scene,
      scene.model.state.flight,
      { ...f.target, amount: 5 },
      point,
    );
    expect(objectSprite).toHaveBeenLastCalledWith(scene, "target", "stardust", 2);
    expect(sprite.setOrigin).toHaveBeenLastCalledWith(0.5, 0.5);
    expect(sprite.setPosition).toHaveBeenLastCalledWith(10, 12);
    expect(keylineSprite).toHaveBeenLastCalledWith(scene, "stardust", "target", sprite);
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
  it("draws one hull meter and no part meters for a visible engaged fallback platform", () => {
    const f = fixture();
    const definition = enemyEquipmentDefinition(1, { archetype: "platform", id: "target" });
    const enemy = createEnemy(
      definition,
      { archetype: "platform", id: "target", packId: null, phase: 0 },
      { x: 200, y: 100 },
    );
    enemy.engaged = true;
    enemy.hp = definition.hp / 2;
    const indicatorInk = { fillRect: vi.fn(), fillStyle: vi.fn() };
    const code = production("./sceneEnemies.ts", ["drawEnemy"], f.globals);
    code.drawEnemy(
      { ...f.scene, indicatorInk },
      { x: 200, y: 100 },
      {
        ...f.target,
        enemy,
        x: 200,
        y: 100,
      },
    );
    expect(indicatorInk.fillRect.mock.calls.map(([, , width]) => width)).toEqual([32, 15]);
    expect(f.ink.lineStyle.mock.calls.some(([width]) => width === 3)).toBe(false);
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
