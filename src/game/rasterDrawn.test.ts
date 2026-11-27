import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import { SvgRasters, type SvgRequest } from "../art/index.ts";

// The production frame hook, run against fake display objects without loading Phaser.
const source = ts.createSourceFile(
  "sceneAssets.ts",
  readFileSync(new URL("./sceneAssets.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const code = source.statements
  .filter((node) => ts.isFunctionDeclaration(node) && node.name?.text === "rasterDrawn")
  .map((node) => node.getText(source).replace(/^export /u, ""))
  .join("\n");

const request = (key: string): SvgRequest => ({
  key,
  path: `${key}.svg`,
  size: () => ({ scale: 1 }),
});

function fixture() {
  const rasters = new SvgRasters(2);
  const requests = ["ship", "rock", "far"].map(request);
  for (const entry of requests) {
    rasters.request(entry);
    rasters.loaded(entry.key);
  }
  const rasterAgain = vi.fn();
  const context = createContext({ rasterAgain });
  runInContext(ts.transpileModule(code, { compilerOptions: { target: 99 } }).outputText, context);
  const rasterDrawn = context.rasterDrawn as (scene: unknown) => void;
  const children = [
    { texture: { key: "ship" }, visible: true },
    { texture: { key: "rock" }, visible: false },
    { visible: true },
  ];
  const scene = { children: { list: children }, rasters };
  return { children, rasterAgain, rasterDrawn, rasters, requests, scene };
}

describe("rasterising again on first draw", () => {
  it("rasterises nothing until a resize leaves SVGs stale", () => {
    const f = fixture();
    f.rasterDrawn(f.scene);
    expect(f.rasterAgain).not.toHaveBeenCalled();
  });

  it("rasterises a stale SVG once something visible draws it, and not one hidden or unused", () => {
    const f = fixture();
    f.rasters.resize(4);
    f.rasterDrawn(f.scene);
    expect(f.rasterAgain).toHaveBeenCalledExactlyOnceWith(f.scene, [f.requests[0]]);
    // The rock shows a frame later and is rasterised then; the far one is never drawn.
    f.children[1]!.visible = true;
    f.rasterDrawn(f.scene);
    expect(f.rasterAgain).toHaveBeenLastCalledWith(f.scene, [f.requests[1]]);
    expect(f.rasters.pending).toBe(true);
  });
});
