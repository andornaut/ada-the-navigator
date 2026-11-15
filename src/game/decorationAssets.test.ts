import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import paints from "../../public/art/ship-paint.json";
import { ECONOMY } from "../data/economy.ts";
import { decorationRasterSize } from "./rareDecorations.ts";
import { ShipMaterialSources } from "./shipMaterials.ts";
const source = ts.createSourceFile(
  "sceneAssets.ts",
  readFileSync(new URL("./sceneAssets.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const code = source.statements
  .filter(
    (node) =>
      (ts.isFunctionDeclaration(node) &&
        ["loadSvg", "materialShipHeading"].includes(node.name?.text ?? "")) ||
      (ts.isVariableStatement(node) &&
        node.declarationList.declarations.some(
          (declaration) => declaration.name.getText(source) === "materialCaches",
        )),
  )
  .map((node) => node.getText(source).replace(/^export /u, ""))
  .join("\n");
function fixture() {
  const svg = vi.fn();
  const queueSvg = vi.fn();
  const context = createContext({ ECONOMY, decorationRasterSize, queueSvg, vectorRaster: vi.fn() });
  runInContext(ts.transpile(code), context);
  const load = context.loadSvg as (scene: unknown, asset: unknown) => void;
  const materialCaches = runInContext("materialCaches", context) as WeakMap<
    object,
    { source: ShipMaterialSources }
  >;
  return { load, materialCaches, queueSvg, scene: { load: { svg } }, svg };
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
  it("uses cached semantic geometry for ship headings and retains legacy URLs without a matching source", () => {
    const f = fixture();
    const asset = { directionIndex: 0, id: "ship-0", path: "/ship-0.svg" };
    f.load(f.scene, asset);
    expect(f.queueSvg.mock.calls[0]![1]).toMatchObject({ path: asset.path });
    const refs = [{ alpha: 1, path: 0, slot: "top" }] as const;
    const source = new ShipMaterialSources(
      {
        headings: new Map([[0, { distinct: refs, frontSkirt: refs }]]),
        paths: ["M0 0L1 0L0 1Z"],
        poses: new Map(),
      },
      new Map(paints.schemes.map((paint) => [paint.id, paint])),
    );
    f.materialCaches.set(f.scene, { source });
    f.load(f.scene, asset);
    expect(f.queueSvg.mock.calls[1]![1]).toMatchObject({
      path: source.ship(ECONOMY.defaultPaint, 0)!.url,
    });
    expect(source.ship(ECONOMY.defaultPaint, 0)!.url).toMatch(/^data:image\/svg\+xml;base64,/u);
    f.load(f.scene, { ...asset, directionIndex: 1, id: "ship-1", path: "/ship-1.svg" });
    expect(f.queueSvg.mock.calls[2]![1]).toMatchObject({ path: "/ship-1.svg" });
  });
});
