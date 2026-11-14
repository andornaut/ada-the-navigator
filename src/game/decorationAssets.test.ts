import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import { decorationRasterSize } from "./rareDecorations.ts";
const source = ts.createSourceFile(
  "sceneAssets.ts",
  readFileSync(new URL("./sceneAssets.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const code = source.statements
  .filter((node) => ts.isFunctionDeclaration(node) && node.name?.text === "loadSvg")
  .map((node) => node.getText(source).replace(/^export /u, ""))
  .join("\n");
function fixture() {
  const svg = vi.fn();
  const queueSvg = vi.fn();
  const context = createContext({ decorationRasterSize, queueSvg, vectorRaster: vi.fn() });
  runInContext(ts.transpile(code), context);
  const load = context.loadSvg as (scene: unknown, asset: unknown) => void;
  return { load, queueSvg, scene: { load: { svg } }, svg };
}
describe("production decoration SVG loader", () => {
  it("queues only fixed capped rasters and never registers them for zoom rerasterization", () => {
    const f = fixture();
    for (let i = 0; i < 18; i++) {
      f.load(f.scene, {
        displayHeight: 1650,
        displayWidth: 2200,
        height: 768,
        id: `d${i}`,
        kind: "backdrop-decoration",
        path: `/d${i}.svg`,
        width: 1024,
      });
    }
    expect(f.svg).toHaveBeenCalledTimes(18);
    for (let i = 0; i < 18; i++) {
      expect(f.svg).toHaveBeenNthCalledWith(i + 1, `d${i}`, `/d${i}.svg`, {
        height: 768,
        width: 1024,
      });
    }
    expect(f.queueSvg).not.toHaveBeenCalled();
  });
  it("skips invalid decoration metadata while ordinary SVGs retain their existing raster registry", () => {
    const f = fixture();
    f.load(f.scene, {
      height: 2,
      id: "bad",
      kind: "backdrop-decoration",
      path: "/bad.svg",
      width: 0,
    });
    expect(f.svg).not.toHaveBeenCalled();
    expect(f.queueSvg).not.toHaveBeenCalled();
    f.load(f.scene, { height: 100, id: "ship", path: "/ship.svg", width: 100 });
    expect(f.queueSvg).toHaveBeenCalledOnce();
    expect(f.queueSvg.mock.calls[0]![1]).toMatchObject({ key: "ship", path: "/ship.svg" });
  });
});
