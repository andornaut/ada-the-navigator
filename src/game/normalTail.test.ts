import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import { drawShipTail } from "../ui/shipJetCanvas.ts";
import { ADA_LAYERS } from "./drawOrder.ts";
import { jetTriangles, normalJetTailRegions, type ShipJets } from "./shipJets.ts";

const region = [
  { x: 40, y: 40 },
  { x: 50, y: 40 },
  { x: 50, y: 50 },
];
const mouth = {
  anchor: { x: 48, y: 48 },
  axis: { x: 0, y: 1 },
  half: { x: 9, y: 0 },
  normalAperture: { coreWidth: 0.4 },
  occluders: [region],
};
const jets: ShipJets = {
  frame: 96,
  headings: [[mouth, mouth]],
  layers: [
    { colors: [1, 2], length: 1, name: "outer", width: 1.6 },
    { colors: [3, 4], length: 0.55, name: "core", width: 0.8 },
  ],
  length: { base: 6, exponent: 2, scale: 24 },
};
const legacyMouth = {
  anchor: mouth.anchor,
  axis: mouth.axis,
  half: mouth.half,
  occluders: mouth.occluders,
};
const display = { displayHeight: 96, displayWidth: 96, pivot: { x: 0.5, y: 0.5 } };

describe("normal painted-tail foreground", () => {
  it("projects and deduplicates exact tail regions without modifying any jet vertex", () => {
    const before = JSON.stringify(jetTriangles(jets, display, 0, 0.8));
    expect(normalJetTailRegions(jets, display, 0)).toEqual([
      [
        { x: -8, y: -8 },
        { x: 2, y: -8 },
        { x: 2, y: 2 },
      ],
    ]);
    expect(JSON.stringify(jetTriangles(jets, display, 0, 0.8))).toBe(before);
    const legacy = { ...jets, headings: [[legacyMouth]] };
    expect(normalJetTailRegions(legacy, display, 0)).toEqual([]);
    expect(
      normalJetTailRegions({ ...jets, headings: [[{ ...mouth, occluders: [] }]] }, display, 0),
    ).toEqual([]);
  });

  it("redraws the existing Canvas hull inside tail regions only, leaving legacy rendering alone", () => {
    const events: string[] = [];
    const context = {
      beginPath: vi.fn(),
      clip: vi.fn(() => events.push("tail-region")),
      closePath: vi.fn(),
      lineTo: vi.fn(),
      moveTo: vi.fn(),
      restore: vi.fn(),
      save: vi.fn(),
    };
    const draw = vi.fn(() => events.push("same-painted-hull"));
    drawShipTail(
      context as unknown as CanvasRenderingContext2D,
      jets,
      display,
      0,
      { x: 100, y: 100 },
      draw,
    );
    expect(events).toEqual(["tail-region", "same-painted-hull"]);
    expect(context.moveTo).toHaveBeenCalledWith(92, 92);
    expect(context.restore).toHaveBeenCalledTimes(1);
    draw.mockClear();
    context.clip.mockClear();
    drawShipTail(
      context as unknown as CanvasRenderingContext2D,
      { ...jets, headings: [[legacyMouth]] },
      display,
      0,
      { x: 100, y: 100 },
      draw,
    );
    expect(draw).not.toHaveBeenCalled();
    expect(context.clip).not.toHaveBeenCalled();
  });

  it("copies the selected painted hull above normal jets through exact tail selection", () => {
    const image = {
      destroy: vi.fn(),
      enableFilters: vi.fn(),
      filters: { internal: { addMask: vi.fn() } },
      setAlpha: vi.fn(),
      setDepth: vi.fn(),
      setDisplaySize: vi.fn(),
      setOrigin: vi.fn(),
      setPosition: vi.fn(),
      setRotation: vi.fn(),
      setTexture: vi.fn(),
      setVisible: vi.fn(),
    };
    image.setVisible.mockReturnValue(image);
    const shape = {
      beginPath: vi.fn(),
      clear: vi.fn(),
      closePath: vi.fn(),
      destroy: vi.fn(),
      fillPath: vi.fn(),
      fillStyle: vi.fn(),
      lineTo: vi.fn(),
      moveTo: vi.fn(),
      setPosition: vi.fn(),
    };
    const camera = {};
    const scene = {
      add: { image: vi.fn(() => image) },
      cameras: { main: camera },
      make: { graphics: vi.fn(() => shape) },
    };
    const ship = {
      alpha: 0.8,
      depth: 0.5,
      displayHeight: 42,
      displayWidth: 42,
      frame: { name: 0 },
      originX: 0.5,
      originY: 0.5,
      rotation: 0,
      texture: { key: "ship-cobalt-52" },
      x: 480,
      y: 270,
    };
    const source = ts.createSourceFile(
      "scene.ts",
      readFileSync(new URL("./scene.ts", import.meta.url), "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    let method: ts.MethodDeclaration | undefined;
    const visit = (node: ts.Node): void => {
      if (ts.isMethodDeclaration(node) && node.name.getText(source) === "drawNormalTail") {
        method = node;
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    if (!method) {
      throw new Error("Missing actual normal tail overlay hook");
    }
    const draw = runInContext(
      ts.transpileModule(
        `class Fixture { ${method.getText(source)} }; Fixture.prototype.drawNormalTail`,
        { compilerOptions: { target: ts.ScriptTarget.ES2023 } },
      ).outputText,
      createContext({ ADA_LAYERS }),
    ) as (this: object, regions: readonly (readonly { x: number; y: number }[])[]) => void;
    const owner = { ...scene, ship };
    draw.call(owner, normalJetTailRegions(jets, display, 0));
    expect(image.filters.internal.addMask).toHaveBeenCalledWith(shape, false, camera);
    expect(image.setTexture).toHaveBeenCalledWith("ship-cobalt-52", 0);
    expect(image.setDepth.mock.calls[0]![0]).toBeGreaterThan(ship.depth + 2e-6);
    expect(shape.moveTo).toHaveBeenCalledWith(-8, -8);
    image.setVisible.mockClear();
    draw.call(owner, []);
    expect(image.setVisible).not.toHaveBeenCalled();
    expect(scene.add.image).toHaveBeenCalledOnce();
  });
});
