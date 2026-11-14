import { describe, expect, it } from "vitest";

import { SCREEN } from "../data/screen.ts";
import { publicJson } from "../testing/publicArt.ts";
import { unit } from "./asteroidArt.ts";
import { chunkItems, layerOrigin, type Xy } from "./backdropField.ts";
import { readGalaxyBackdrop } from "./backdropLayers.ts";
import {
  type DecorationLayer,
  decorationRasterSize,
  readDecorations,
  viewDecorations,
} from "./rareDecorations.ts";
const recipe: DecorationLayer = {
  chance: 0.35,
  chunk: [4200, 3000],
  parallax: 0.08,
  rotation: [-18, 18],
  salt: "rare-decoration",
  scale: [0.9, 1.08],
  sprites: [1, 2, 3].map((n) => ({ asset: `decoration-${n}`, height: 1650, width: 2200 })),
};
describe("optional rare decoration data", () => {
  it("accepts the agreed recipe without requiring it in existing galaxy data", () => {
    expect(readDecorations(recipe)).toEqual(recipe);
    const data = publicJson("/art/sunflower/backdrop.json") as Record<string, unknown>;
    const legacy = { ...data };
    delete legacy.decorations;
    const before = readGalaxyBackdrop(legacy)!;
    expect(before).toBeDefined();
    expect(before.decorations).toBeUndefined();
    expect(readGalaxyBackdrop({ ...legacy, decorations: { chance: 1 } })).toEqual(before);
    expect(readGalaxyBackdrop({ ...legacy, decorations: recipe })?.decorations).toEqual(recipe);
  });
  it.each([
    undefined,
    null,
    {},
    { ...recipe, chance: NaN },
    { ...recipe, chunk: [0, 3000] },
    { ...recipe, scale: [1, 0.5] },
    { ...recipe, rotation: [18, -18] },
    { ...recipe, sprites: [] },
    { ...recipe, sprites: [{ asset: "x", height: 2, width: Infinity }] },
  ])("drops malformed optional data %j", (value) => {
    expect(readDecorations(value)).toBeUndefined();
  });
  it("caps intrinsic raster dimensions independently of display size or DPR", () => {
    expect(decorationRasterSize(1024, 768)).toEqual({ height: 768, width: 1024 });
    expect(decorationRasterSize(4096, 3072)).toEqual({ height: 768, width: 1024 });
    expect(decorationRasterSize(768, 2048)).toEqual({ height: 1024, width: 384 });
    expect(decorationRasterSize(0, 768)).toBeUndefined();
    expect(decorationRasterSize(Infinity, 768)).toBeUndefined();
    expect(18 * 1024 * 768 * 4).toBe(54 * 1024 ** 2);
  });
});
describe("seeded decoration culling", () => {
  it("matches independent transformed-corner bounds across negative chunks, edges and all variants", () => {
    const layer = { ...recipe, chance: 1 };
    const seed = 1729;
    const all = chunkItems(seed, layer.salt, layer, [-21000, -15000, 21000, 15000]);
    const variants = new Set<string>();
    let visible = 0;
    let empty = 0;
    for (let a = -12; a <= 12; a++) {
      const camera: Xy = [a * 1371, a * -2479];
      const origin = layerOrigin(camera, layer.parallax);
      const expected = all
        .filter((item) => {
          const scale = 0.9 + 0.18 * unit(seed, item.id, "rare-decoration-scale");
          const rotation =
            ((-18 + 36 * unit(seed, item.id, "rare-decoration-rotation")) * Math.PI) / 180;
          const corners = [-1, 1].flatMap((sx) =>
            [-1, 1].map((sy) => {
              const dx = sx * 1100 * scale,
                dy = sy * 825 * scale;
              return [
                item.x -
                  origin[0] +
                  SCREEN.width / 2 +
                  dx * Math.cos(rotation) -
                  dy * Math.sin(rotation),
                item.y -
                  origin[1] +
                  SCREEN.height / 2 +
                  dx * Math.sin(rotation) +
                  dy * Math.cos(rotation),
              ];
            }),
          );
          return (
            Math.max(...corners.map((p) => p[0]!)) >= 0 &&
            Math.min(...corners.map((p) => p[0]!)) <= SCREEN.width &&
            Math.max(...corners.map((p) => p[1]!)) >= 0 &&
            Math.min(...corners.map((p) => p[1]!)) <= SCREEN.height
          );
        })
        .map((item) => item.id);
      const actual = viewDecorations({ decorations: layer, seed }, camera);
      expect(actual.map((item) => item.id)).toEqual(expected);
      actual.forEach((item) => variants.add(item.asset));
      visible += actual.length;
      if (!actual.length) {
        empty++;
      }
      expect(actual.length).toBeLessThanOrEqual(6);
    }
    expect(visible).toBeGreaterThan(0);
    expect(empty).toBeGreaterThan(0);
    expect(variants.size).toBeGreaterThan(1);
  });
  it("retains appearance and parallax position while the same chunk crosses cameras", () => {
    const backdrop = { decorations: { ...recipe, chance: 1 }, seed: 1729 };
    let checked = 0;
    for (let x = -20000; x < 20000; x += 1000) {
      const a = viewDecorations(backdrop, [x, 0]);
      const b = viewDecorations(backdrop, [x + 1, 0]);
      for (const item of a) {
        const next = b.find((other) => other.id === item.id);
        if (!next) {
          continue;
        }
        expect({ ...next, x: item.x, y: item.y }).toEqual(item);
        expect(next.x - item.x).toBeCloseTo(-recipe.parallax);
        expect(next.y - item.y).toBeCloseTo(-recipe.parallax / 2);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
  it("does no work for missing, zero-chance or pathological unbounded recipes", () => {
    expect(viewDecorations({ seed: 1 }, [0, 0])).toEqual([]);
    expect(viewDecorations({ decorations: { ...recipe, chance: 0 }, seed: 1 }, [0, 0])).toEqual([]);
    expect(
      viewDecorations({ decorations: { ...recipe, chunk: [1e-20, 1e-20] }, seed: 1 }, [0, 0]),
    ).toEqual([]);
    expect(viewDecorations({ decorations: recipe, seed: 1 }, [Infinity, 0])).toEqual([]);
  });
});
