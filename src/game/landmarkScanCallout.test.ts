import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { expect, it, vi } from "vitest";

import needleManifest from "../../public/art/needle/manifest.json";
import { selectEnemyFrame } from "../art/index.ts";
import { flightWorldContext } from "../model/flightTopology.ts";
import { worldDelta } from "../model/worldContacts.ts";
import { USE_CALLOUT_FADE_MS, useCalloutAlpha, useCalloutLift } from "../ui/touchChrome.ts";
import { craftArt, storyCraftSets } from "./cartwheelArt.ts";
import type { Asset } from "./sceneShared.ts";

function functions(file: string, names: readonly string[]): string {
  const source = ts.createSourceFile(
    file,
    readFileSync(new URL(file, import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  return source.statements
    .filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text ?? ""))
    .map(
      (node) =>
        ts.transpileModule(node.getText(source).replace("export ", ""), {
          compilerOptions: { target: ts.ScriptTarget.ESNext },
        }).outputText,
    )
    .join("\n");
}

it("positions Scan above the actual landmark sprite and removes it when no Scan target remains", () => {
  const id = "landmark:1:0";
  const landmark = { charted: false, id, kind: "wreck", x: 100, y: 100 };
  const callout = {
    setAlpha: vi.fn().mockReturnThis(),
    setFrame: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
  };
  const scene = {
    calloutState: { at: { x: 0, y: 0 }, edge: 0, id: "", showing: false },
    destinationPlaceholderTops: new Map(),
    drawnTops: new Map(),
    enemySprites: new Map(),
    landmarkSprites: new Map([
      [`${id}#0`, { displayHeight: 84, frame: {}, originY: 0.5, visible: true, y: 100 }],
    ]),
    model: {
      jobScenery: { landmarks: [landmark] },
      useTarget: { action: "scan", id } as { action: string; id: string } | undefined,
    },
    project: (point: unknown) => point,
    reducedMotion: true,
    time: { now: 100 },
    useCallout: callout,
  };
  const context = createContext({
    USE_CALLOUT_FADE_MS,
    frameTop: () => 0.25,
    useCalloutAlpha,
    useCalloutLift,
  });
  const render = runInContext(
    `${functions("./sceneHud.ts", ["drawUseCallout", "drawnTop", "calloutRemaining"])};drawUseCallout`,
    context,
  ) as (value: typeof scene, flight: { objects: unknown[] }) => void;
  render(scene, { objects: [] });
  expect(callout.setFrame).toHaveBeenLastCalledWith("scan");
  expect(callout.setPosition).toHaveBeenLastCalledWith(100, 100 - useCalloutLift(21));
  expect(callout.setVisible).toHaveBeenLastCalledWith(true);
  scene.model.useTarget = undefined;
  render(scene, { objects: [] });
  expect(callout.setVisible).toHaveBeenLastCalledWith(false);
});

it("draws Elder Loom's published Needle glider and clears its visible pixels with Talk", () => {
  const assets = needleManifest.assets as unknown as Asset[];
  const craft = craftArt(() => undefined, storyCraftSets(assets, []));
  expect(craft.get("glider")?.frames).toHaveLength(16);
  const id = "elderLoom";
  const destination = { id, kind: "destination", radius: 30, x: 100, y: 100 };
  const flight = { galaxy: 4, objects: [destination], player: { x: 140, y: 100 } };
  const callout = {
    setAlpha: vi.fn().mockReturnThis(),
    setFrame: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
  };
  const sprite = {
    displayHeight: 0,
    frame: {},
    originY: 0,
    setDepth: vi.fn().mockReturnThis(),
    setDisplaySize: vi.fn((_width: number, height: number) => {
      sprite.displayHeight = height;
      return sprite;
    }),
    setOrigin: vi.fn((_x: number, y: number) => {
      sprite.originY = y;
      return sprite;
    }),
    setPosition: vi.fn((_x: number, y: number) => {
      sprite.y = y;
      return sprite;
    }),
    visible: true,
    y: 0,
  };
  const scene = {
    calloutState: { at: { x: 0, y: 0 }, edge: 0, id: "", showing: false },
    craftArt: craft,
    destinationPlaceholderTops: new Map(),
    drawnTops: new Map(),
    enemySprites: new Map(),
    fieldLight: true,
    ink: { fillEllipse: vi.fn(), fillStyle: vi.fn(), lineStyle: vi.fn(), strokeEllipse: vi.fn() },
    landmarkSprites: new Map(),
    light: true,
    model: { state: { flight }, useTarget: { action: "talk", id } },
    outpostArt: new Map(),
    palette: { pointOfInterest: 0xd4d4d4 },
    passes: vi.fn(),
    project: (point: unknown) => point,
    reducedMotion: true,
    textures: { exists: vi.fn(() => true) },
    time: { now: 100 },
    useCallout: callout,
  };
  const objectSprite = vi.fn((_scene: unknown, key: string) => {
    scene.enemySprites.set(key, sprite);
    return sprite;
  });
  const keylineSprite = vi.fn();
  const context = createContext({
    LIGHT_FIELD: { ink: 0x181425 },
    USE_CALLOUT_FADE_MS,
    acknowledgePrimitiveTarget: vi.fn(),
    destinationDrawn: () => true,
    flightWorldContext,
    frameTop: () => 0.25,
    keylineSprite,
    objectSprite,
    playDepth: (y: number) => y,
    selectEnemyFrame,
    useCalloutAlpha,
    useCalloutLift,
    worldDelta,
  });
  const render = runInContext(
    `${functions("./sceneObjects.ts", ["drawDestination"])}
      ${functions("./sceneHud.ts", ["drawUseCallout", "drawnTop", "calloutRemaining"])}
      ({ drawDestination, drawUseCallout })`,
    context,
  );
  render.drawDestination(scene, destination, destination, destination.radius);
  expect(objectSprite).toHaveBeenCalledWith(scene, id, "craft-glider-0");
  expect(sprite.setDisplaySize).toHaveBeenCalledWith(49, 49);
  expect(sprite.setOrigin).toHaveBeenCalledWith(0.5, 0.5);
  expect(keylineSprite).toHaveBeenCalledWith(scene, "storyCraft", id, sprite);
  expect(scene.passes).toHaveBeenCalledWith(sprite);
  expect(scene.ink.fillEllipse).not.toHaveBeenCalled();

  render.drawUseCallout(scene, flight);
  expect(callout.setFrame).toHaveBeenLastCalledWith("talk");
  expect(callout.setPosition).toHaveBeenLastCalledWith(100, 100 - useCalloutLift(49 / 4));
  expect(callout.setVisible).toHaveBeenLastCalledWith(true);

  scene.textures.exists.mockReturnValue(false);
  render.drawDestination(scene, destination, destination, destination.radius);
  expect(scene.ink.fillEllipse).toHaveBeenCalledWith(100, 100, 75, 37.5);
  expect(scene.ink.fillEllipse).toHaveBeenCalledWith(100, 85, 37.5, 22.5);
  expect(scene.ink.lineStyle).toHaveBeenLastCalledWith(2, 0x181425);
  expect(scene.ink.fillStyle).toHaveBeenLastCalledWith(0xd4d4d4);
  expect(objectSprite).toHaveBeenCalledTimes(1);
  render.drawUseCallout(scene, flight);
  expect(callout.setPosition).toHaveBeenLastCalledWith(100, 100 - useCalloutLift(27.25));

  scene.fieldLight = false;
  render.drawDestination(scene, destination, destination, destination.radius);
  expect(scene.ink.lineStyle).toHaveBeenLastCalledWith(2, 0xd4d4d4);
  expect(scene.ink.fillStyle).toHaveBeenLastCalledWith(0x181425);

  scene.destinationPlaceholderTops.clear();
  scene.textures.exists.mockReturnValue(true);
  render.drawDestination(scene, destination, destination, destination.radius);
  render.drawUseCallout(scene, flight);
  expect(callout.setPosition).toHaveBeenLastCalledWith(100, 100 - useCalloutLift(49 / 4));
});

it("acknowledges only a visible, uncovered landmark and preserves its foreground keyline", () => {
  const ack = vi.fn();
  const sprites = new Map();
  const layer = vi.fn((_scene: unknown, key: string) =>
    sprites.set(key, {
      getBounds: () => ({ bottom: 50, left: -10, right: 30, top: 10 }),
      visible: true,
    }),
  );
  const scene = {
    jobArt: { wreck: [{ frame: { id: "landmark-wreck" }, keyline: "wreck" }] },
    landmarkSprites: sprites,
    model: {
      jobScenery: { landmarks: [{ id: "wreck", kind: "wreck", x: -5, y: 20 }] },
      landmarkDisplayed: ack,
      state: { flight: { galaxy: 1 } },
    },
    project: (point: unknown) => point,
    reducedMotion: true,
    settingsOpen: false,
    time: { now: 0 },
  };
  const context = createContext({ SCREEN: { height: 360, width: 720 }, drawLandmarkLayer: layer });
  const render = runInContext(
    `${functions("./sceneWorld.ts", ["drawJobs"])};drawJobs`,
    context,
  ) as (value: typeof scene) => void;
  render(scene);
  expect(ack).toHaveBeenCalledExactlyOnceWith("wreck");
  expect(layer.mock.calls[0]!.at(-1)).toEqual({ keyline: "wreck" });
  ack.mockClear();
  scene.settingsOpen = true;
  render(scene);
  expect(ack).not.toHaveBeenCalled();
});
