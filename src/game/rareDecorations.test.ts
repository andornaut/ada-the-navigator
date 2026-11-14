import { describe, expect, it } from "vitest";

import { SCREEN } from "../data/screen.ts";
import { publicJson } from "../testing/publicArt.ts";
import { unit } from "./asteroidArt.ts";
import { chunkItems, layerOrigin, type Xy } from "./backdropField.ts";
import { readGalaxyBackdrop } from "./backdropLayers.ts";
import {
  decorationBodyPolygons,
  type DecorationLayer,
  decorationRasterSize,
  type DecorationView,
  decorationVisible,
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
const square = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
] as const;
const body = { id: "formation", polygons: [{ holes: [], outer: square }] };
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

  it("decodes weighted sizes and normalized polygon unions without changing legacy recipes", () => {
    const data = {
      ...recipe,
      sizes: [
        { scale: 1, weight: 6 },
        { scale: 2, weight: 3 },
        { scale: 3, weight: 1 },
      ],
      sprites: [{ ...recipe.sprites[0]!, bodies: [body] }],
    };
    expect(readDecorations(data)).toEqual(data);
    for (const change of [
      { sizes: [] },
      { sizes: [{ scale: 1, weight: 0 }] },
      { sizes: [{ scale: Infinity, weight: 1 }] },
      { sprites: [{ ...data.sprites[0], bodies: [body, body] }] },
      { sprites: [{ ...data.sprites[0], bodies: [{ id: "x", polygons: [] }] }] },
      {
        sprites: [
          {
            ...data.sprites[0],
            bodies: [
              {
                id: "x",
                polygons: [
                  {
                    holes: [],
                    outer: [
                      [0, 0],
                      [1, 0],
                      [2, 1],
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]) {
      expect(readDecorations({ ...data, ...change })).toBeUndefined();
    }
  });
});

describe("opaque decoration footprints", () => {
  const view: DecorationView = {
    asset: "ring",
    bodies: [
      {
        id: "ring",
        polygons: [
          {
            holes: [
              [
                [0.1, 0.1],
                [0.9, 0.1],
                [0.9, 0.9],
                [0.1, 0.9],
              ],
            ],
            outer: square,
          },
        ],
      },
    ],
    height: 1200,
    id: "cell",
    rotation: 0,
    width: 2000,
    x: SCREEN.width / 2,
    y: SCREEN.height / 2,
  };
  it("does not count an empty hole as a visible encounter, but retains opaque crossing edges", () => {
    expect(decorationVisible(view)).toBe(false);
    expect(decorationVisible({ ...view, x: 1000 })).toBe(true);
    expect(decorationVisible({ ...view, x: 10000 })).toBe(false);
  });
  it("combines overlapping polygons by union rather than XOR", () => {
    expect(
      decorationVisible({
        ...view,
        bodies: [{ id: "solid", polygons: [body.polygons[0]!, body.polygons[0]!] }],
      }),
    ).toBe(true);
  });
  it("projects body geometry with the same center, scale and rotation as the shared quad", () => {
    const transformed = decorationBodyPolygons({
      ...view,
      bodies: [body],
      height: 100,
      rotation: 90,
      width: 200,
    });
    expect(transformed[0]!.polygons[0]!.outer[0]![0]).toBeCloseTo(SCREEN.width / 2 + 50);
    expect(transformed[0]!.polygons[0]!.outer[0]![1]).toBeCloseTo(SCREEN.height / 2 - 100);
    expect(transformed[0]!.polygons[0]!.outer[2]![0]).toBeCloseTo(SCREEN.width / 2 - 50);
  });
});
describe("seeded decoration culling", () => {
  it("draws weighted sizes independently of the design variant", () => {
    const layer: DecorationLayer = {
      ...recipe,
      chance: 1,
      chunk: [1000, 1000],
      parallax: 1,
      rotation: [0, 0],
      scale: [1, 1],
      sizes: [
        { scale: 1, weight: 6 },
        { scale: 2, weight: 3 },
        { scale: 3, weight: 1 },
      ],
      sprites: [
        { asset: "a", height: 80, width: 100 },
        { asset: "b", height: 80, width: 100 },
      ],
    };
    const seed = 1729;
    const counts = new Map<number, number>();
    const designs = new Map<string, Set<number>>();
    for (const item of chunkItems(seed, layer.salt, layer, [-10000, -10000, 10000, 10000])) {
      const camera: Xy = [item.x / 2 + item.y, item.y - item.x / 2];
      const found = viewDecorations({ decorations: layer, seed }, camera).find(
        (v) => v.id === item.id,
      )!;
      const size = found.width / 100;
      counts.set(size, (counts.get(size) ?? 0) + 1);
      const seen = designs.get(found.asset) ?? new Set<number>();
      seen.add(size);
      designs.set(found.asset, seen);
    }
    expect([...counts.keys()].sort()).toEqual([1, 2, 3]);
    expect(counts.get(1)).toBeGreaterThan(counts.get(2)!);
    expect(counts.get(2)).toBeGreaterThan(counts.get(3)!);
    for (const sizes of designs.values()) {
      expect([...sizes].sort()).toEqual([1, 2, 3]);
    }
  });

  it("includes the largest weighted size when finding edge chunks", () => {
    const enlarged = {
      ...recipe,
      chance: 1,
      sprites: recipe.sprites.map((sprite) => ({
        ...sprite,
        height: sprite.height * 3,
        width: sprite.width * 3,
      })),
    };
    const weighted = { ...recipe, chance: 1, sizes: [{ scale: 3, weight: 1 }] };
    for (let x = -25000; x <= 25000; x += 2500) {
      const camera: Xy = [x, -x / 3];
      const actual = viewDecorations({ decorations: weighted, seed: 1729 }, camera);
      const expected = viewDecorations({ decorations: enlarged, seed: 1729 }, camera);
      expect(actual.map((item) => item.id)).toEqual(expected.map((item) => item.id));
      for (const [index, item] of actual.entries()) {
        expect(item.width).toBeCloseTo(expected[index]!.width, 9);
        expect(item.height).toBeCloseTo(expected[index]!.height, 9);
      }
    }
  });

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
