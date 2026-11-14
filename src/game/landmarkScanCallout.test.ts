import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { expect, it, vi } from "vitest";

import { USE_CALLOUT_FADE_MS, useCalloutAlpha, useCalloutLift } from "../ui/touchChrome.ts";

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
