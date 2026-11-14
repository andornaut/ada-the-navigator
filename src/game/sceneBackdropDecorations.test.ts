import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import { BACKDROP_DEPTH } from "./drawOrder.ts";
const source = ts.createSourceFile(
  "sceneBackdrop.ts",
  readFileSync(new URL("./sceneBackdrop.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const names = ["drawDecorations", "backdropItem", "drawBackdropLayers"];
const code = source.statements
  .filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text ?? ""))
  .map((node) => node.getText(source).replace(/^export /u, ""))
  .join("\n");
function fixture() {
  const image = {
    destroy: vi.fn(),
    setAngle: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setDisplaySize: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setRenderNodeRole: vi.fn().mockReturnThis(),
    setVertexRoundMode: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
  };
  const scene = {
    add: { image: vi.fn(() => image) },
    backdropItems: new Map(),
    backdropRules: {},
    galaxyBackdrops: new Map(),
    model: { galaxyMapShownInFlight: false },
    starImages: [],
    textures: { exists: vi.fn((key: string) => key === "d"), remove: vi.fn() },
  };
  const item = { asset: "d", height: 1650, id: "0,0", rotation: -18, width: 2200, x: 1, y: 2 };
  const view = vi.fn(() => [item]);
  const context = createContext({
    BACKDROP_DEPTH,
    drawFarItems: vi.fn(),
    drawPlates: vi.fn(),
    drawSky: vi.fn(),
    drawStars: vi.fn(),
    drawStreaks: vi.fn(),
    viewDecorations: view,
  });
  runInContext(ts.transpile(code), context);
  return {
    draw: context.drawDecorations as (
      s: unknown,
      g: unknown,
      b: unknown,
      c: unknown,
      u: unknown,
    ) => void,
    image,
    item,
    layers: context.drawBackdropLayers as (s: unknown, f: unknown) => void,
    scene,
    view,
  };
}
describe("production rare decoration drawing", () => {
  it("reuses images and shared textures with recipe size, angle and background-only depth", () => {
    const f = fixture();
    const used = new Set();
    f.draw(f.scene, 1, {}, [0, 0], used);
    f.draw(f.scene, 1, {}, [0, 0], used);
    expect(f.scene.add.image).toHaveBeenCalledOnce();
    expect(f.image.setDisplaySize).toHaveBeenCalledWith(2200, 1650);
    expect(f.image.setAngle).toHaveBeenCalledWith(-18);
    expect(f.image.setRenderNodeRole).toHaveBeenCalledWith(
      "BatchHandler",
      "BatchHandlerQuadSingle",
    );
    expect(f.image.setDepth).toHaveBeenCalledWith(BACKDROP_DEPTH.decorations);
    expect(BACKDROP_DEPTH.decorations).toBeGreaterThan(BACKDROP_DEPTH.far);
    expect(BACKDROP_DEPTH.decorations).toBeLessThan(BACKDROP_DEPTH.planets);
    expect(f.scene.textures.remove).not.toHaveBeenCalled();
  });
  it("skips missing textures and the original in-flight galaxy-map exception", () => {
    const f = fixture();
    f.scene.model.galaxyMapShownInFlight = true;
    f.draw(f.scene, 1, {}, [0, 0], new Set());
    expect(f.view).not.toHaveBeenCalled();
    f.scene.model.galaxyMapShownInFlight = false;
    f.scene.textures.exists.mockReturnValue(false);
    f.draw(f.scene, 1, {}, [0, 0], new Set());
    expect(f.scene.add.image).not.toHaveBeenCalled();
  });
  it("releases stale instances on leaving space without deleting shared asset textures", () => {
    const f = fixture();
    f.draw(f.scene, 1, {}, [0, 0], new Set());
    f.layers(f.scene, null);
    expect(f.image.destroy).toHaveBeenCalledOnce();
    expect(f.scene.backdropItems.size).toBe(0);
    expect(f.scene.textures.remove).not.toHaveBeenCalled();
  });
  it("releases prior instances when the map opens", () => {
    const f = fixture();
    f.draw(f.scene, 1, {}, [0, 0], new Set());
    f.scene.model.galaxyMapShownInFlight = true;
    f.scene.galaxyBackdrops.set(1, {});
    f.layers(f.scene, { galaxy: 1, player: { x: 0, y: 0 } });
    expect(f.image.destroy).toHaveBeenCalledOnce();
    expect(f.scene.backdropItems.size).toBe(0);
  });
});
