import { describe, expect, it } from "vitest";

import {
  cycles,
  layerFindings,
  layerOf,
  LAYERS,
  runtimeCycleFindings,
  specifiers,
} from "../../tools/imports-check.ts";

const layer = (name: string) => LAYERS.findIndex((candidate) => candidate.name === name);

describe("specifiers", () => {
  it("lists relative imports, re-exports, dynamic imports and inline types", () => {
    expect(
      specifiers(
        [
          'import { a } from "./a.ts";',
          'import type { B } from "../b.ts";',
          'import { type C, type D } from "./c.ts";',
          'import { type E, e } from "./e.ts";',
          'export { f } from "./f.ts";',
          'export type * from "./g.ts";',
          'export { type K } from "./k.ts";',
          'const h = await import("./h.ts");',
          'type I = import("./i.ts").I;',
          'import style from "./j.css?inline";',
          'import { join } from "node:path";',
          'import Phaser from "phaser";',
        ].join("\n"),
      ),
    ).toEqual([
      { specifier: "./a.ts", typeOnly: false },
      { specifier: "../b.ts", typeOnly: true },
      { specifier: "./c.ts", typeOnly: false },
      { specifier: "./e.ts", typeOnly: false },
      { specifier: "./f.ts", typeOnly: false },
      { specifier: "./g.ts", typeOnly: true },
      { specifier: "./k.ts", typeOnly: false },
      { specifier: "./h.ts", typeOnly: false },
      { specifier: "./i.ts", typeOnly: true },
      { specifier: "./j.css", typeOnly: false },
    ]);
  });
});

describe("cycles", () => {
  it("reports each strongly connected component once and ignores unknown targets", () => {
    const graph = new Map([
      ["a", ["b", "outside"]],
      ["b", ["c"]],
      ["c", ["a", "d"]],
      ["d", ["e"]],
      ["e", ["d"]],
      ["f", ["f"]],
      ["g", ["a"]],
    ]);
    expect(cycles(graph)).toEqual([["d", "e"], ["a", "b", "c"], ["f"]]);
  });

  it("reports runtime cycles and lets type-only imports close a cycle within a layer", () => {
    const value = (target: string) => ({ target, typeOnly: false });
    const type = (target: string) => ({ target, typeOnly: true });
    const graph = new Map([
      ["src/model/a.ts", [value("src/model/b.ts")]],
      ["src/model/b.ts", [type("src/model/a.ts")]],
      ["src/model/c.ts", [value("src/model/d.ts")]],
      ["src/model/d.ts", [value("src/model/c.ts")]],
    ]);
    expect(runtimeCycleFindings(graph)).toEqual([
      "src/model/c.ts is in a runtime import cycle",
      "src/model/d.ts is in a runtime import cycle",
    ]);
  });

  it("counts an inline type import as runtime, so it closes a runtime cycle", () => {
    const edges = (source: string) =>
      specifiers(source).map(({ specifier, typeOnly }) => ({
        target: `src/model/${specifier.slice(2)}`,
        typeOnly,
      }));
    const graph = new Map([
      ["src/model/a.ts", edges('import { b } from "./b.ts";')],
      ["src/model/b.ts", edges('import { type A } from "./a.ts";')],
      ["src/model/c.ts", edges('import { d } from "./d.ts";')],
      ["src/model/d.ts", edges('import type { C } from "./c.ts";')],
    ]);
    expect(runtimeCycleFindings(graph)).toEqual([
      "src/model/a.ts is in a runtime import cycle",
      "src/model/b.ts is in a runtime import cycle",
    ]);
  });
});

describe("layers", () => {
  it("places each area in one layer, lowest first", () => {
    expect(layerOf("src/data/galaxies.ts")).toBe(layer("data"));
    expect(layerOf("src/art/index.ts")).toBe(layer("art"));
    expect(layerOf("src/art/shipJets.ts")).toBe(layer("art"));
    expect(layerOf("src/saving/index.ts")).toBe(layer("saving"));
    expect(layerOf("src/game/sceneHud.ts")).toBe(layer("scene"));
    expect(layerOf("src/ui/layout/tokens.ts")).toBe(layer("layout and input state"));
    expect(layerOf("src/ui/map/layout/mapScreen.ts")).toBe(layer("layout and input state"));
    expect(layerOf("src/ui/map/mapScreen.ts")).toBe(layer("ui"));
    expect(layerOf("src/ui/modal.ts")).toBe(layer("ui"));
    expect(layerOf("src/input/controls.ts")).toBe(layer("scene"));
    expect(layerOf("src/loading/bootstrap.ts")).toBe(layer("entry"));
    expect(layerOf("src/ui/modal.test.ts")).toBe(layer("support"));
    expect(layerOf("src/unknown.ts")).toBe(-1);
    expect(layer("data")).toBeLessThan(layer("model"));
    expect(layer("model")).toBeLessThan(layer("saving"));
    expect(layer("saving")).toBeLessThan(layer("art"));
    expect(layer("ui")).toBeLessThan(layer("scene"));
  });

  it("refuses imports from a higher layer, type-only ones included, and unplaced modules", () => {
    const graph = new Map([
      [
        "src/data/a.ts",
        [
          { target: "src/model/b.ts", typeOnly: true },
          { target: "src/buildLabel.ts", typeOnly: false },
        ],
      ],
      ["src/data/a.test.ts", [{ target: "src/main.ts", typeOnly: false }]],
      ["src/extra.ts", []],
    ]);
    expect(layerFindings(graph)).toEqual([
      "src/data/a.ts (data) imports src/model/b.ts (model)",
      "src/extra.ts is in no layer",
    ]);
  });
});
