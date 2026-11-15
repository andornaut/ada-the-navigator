import { describe, expect, it } from "vitest";

import mainArt from "../../public/art/ship-jets.json";
import { LIGHT_FIELD } from "./lightField.ts";
import {
  coreOutboardOffset,
  jetShapeLayerAlpha,
  jetShapeLayerColor,
  jetTriangles,
  layerAlpha,
  layerColor,
  readEngineJets,
  readShipJets,
  type ShipJets,
  travelJets,
} from "./shipJets.ts";
const display = { displayHeight: 96, displayWidth: 96, pivot: { x: 0, y: 0 } };
const main = readEngineJets(mainArt)!;
const fixture: ShipJets = {
  frame: 96,
  headings: [
    [
      {
        anchor: { x: 900, y: 900 },
        axis: { x: 0, y: -1 },
        half: { x: 2, y: 0 },
        outerCorner: { x: 48, y: 48 },
      },
    ],
  ],
  layers: [
    { alpha: { from: 0.6, max: 0.5, to: 1 }, colors: [3, 3], length: 1.1, name: "halo", width: 4 },
    { colors: [2, 2], length: 1, name: "outer", width: 3 },
    { colors: [1, 1], length: 0.5, name: "core", width: 0.2 },
  ],
  length: { base: 6, exponent: 2, scale: 0 },
};
describe("one translated canonical flame group", () => {
  it("moves every complete triangle by one delta while preserving nesting, order and the centered core", () => {
    const triangles = jetTriangles(fixture, display, 0, 1);
    expect(triangles.map((t) => t.color)).toEqual([3, 2, 1]);
    expect(triangles).toHaveLength(3);
    expect(triangles[0]!.points[0]).toEqual({ x: 48, y: 48 });
    for (const triangle of triangles) {
      expect((triangle.points[0].x + triangle.points[2].x) / 2).toBe(40);
      expect(triangle.points[1].x).toBe(40);
    }
    expect(triangles[1]!.points[0].x).toBe(46);
    expect(triangles[2]!.points).toEqual([
      { x: 40.4, y: 48 },
      { x: 40, y: 45 },
      { x: 39.6, y: 48 },
    ]);
  });
  it("uses the widest actually visible layer at the halo threshold without shifting layers independently", () => {
    for (const fraction of [0.2, 0.6, 0.60001, 1]) {
      const triangles = jetTriangles(fixture, display, 0, fraction);
      const haloVisible = fraction > 0.6;
      expect(triangles.map((t) => t.color)).toEqual(haloVisible ? [3, 2, 1] : [2, 1]);
      expect(triangles[0]!.points[0]).toEqual({ x: 48, y: 48 });
      for (const triangle of triangles) {
        expect(triangle.points[1].x).toBe(haloVisible ? 40 : 42);
      }
    }
    expect(jetTriangles(fixture, display, 0, 0)).toEqual([]);
  });
  it("leaves legacy unanchored geometry unchanged and rejects no legitimate untrimmed forward area", () => {
    const mouth = fixture.headings[0]![0]!;
    const legacy = {
      ...fixture,
      headings: [[{ anchor: { x: 50, y: 60 }, axis: mouth.axis, half: mouth.half }]],
    };
    const triangles = jetTriangles(legacy, display, 0, 1);
    expect(triangles[0]!.points).toEqual([
      { x: 58, y: 60 },
      { x: 50, y: 53.4 },
      { x: 42, y: 60 },
    ]);
    expect(triangles).toHaveLength(3);
    expect(
      jetTriangles(
        {
          ...fixture,
          headings: [[{ ...mouth, rearClip: { constant: 46, normal: { x: 0, y: 1 } } }]],
        },
        display,
        0,
        1,
      ).every((t) => t.points.every((p) => p.y <= 46)),
    ).toBe(true);
  });
  it("keeps every forward heading uncut with one group translation", () => {
    for (const field of [undefined, LIGHT_FIELD.jets.shipLevels]) {
      for (const engine of [1, 2, 3]) {
        const jets = travelJets(main, undefined, field, engine, "forward")!;
        for (let heading = 0; heading < jets.headings.length; heading++) {
          for (const mouth of jets.headings[heading]!) {
            if (mouth.normalAperture) {
              expect(mouth.coreOutboard).toBeUndefined();
              expect(mouth.outerCorner).toBeUndefined();
              expect(mouth.rearClip).toBeUndefined();
              for (const fraction of [0.2, 0.6, 0.65, 1]) {
                const visible = jets.layers.filter(
                  (layer, index) => jetShapeLayerAlpha(mouth, layer, index, fraction) > 0,
                );
                const triangles = jetTriangles(
                  { ...jets, headings: [[mouth]] },
                  display,
                  0,
                  fraction,
                );
                expect(triangles).toHaveLength(visible.length);
                expect(triangles.map((t) => t.color)).toEqual(
                  visible.map((layer, index) =>
                    jetShapeLayerColor(mouth, layer, index, layerColor(layer, fraction)),
                  ),
                );
                triangles.forEach((triangle) => {
                  expect(triangle.points).toHaveLength(3);
                  expect((triangle.points[0].x + triangle.points[2].x) / 2).toBeCloseTo(
                    mouth.anchor.x,
                    10,
                  );
                  expect((triangle.points[0].y + triangle.points[2].y) / 2).toBeCloseTo(
                    mouth.anchor.y,
                    10,
                  );
                });
                expect(triangles[0]!.points[0].x).toBeCloseTo(mouth.anchor.x + mouth.half.x, 10);
                expect(triangles[0]!.points[0].y).toBeCloseTo(mouth.anchor.y + mouth.half.y, 10);
              }
              continue;
            }
            expect(mouth.coreOutboard).toBe(true);
            expect(mouth.outerCorner).toBeDefined();
            expect(mouth.rearClip).toBeUndefined();
            for (const fraction of [0.2, 0.6, 0.65, 1]) {
              const visible = jets.layers.filter((layer) => layerAlpha(layer, fraction) > 0);
              const widest = Math.max(...visible.map((layer) => layer.width));
              const triangles = jetTriangles(
                { ...jets, headings: [[mouth]] },
                display,
                0,
                fraction,
              );
              expect(triangles.map((t) => t.color)).toEqual(
                visible.map((layer) => layerColor(layer, fraction)),
              );
              expect(triangles).toHaveLength(visible.length);
              const x = mouth.outerCorner!.x - mouth.half.x * widest;
              const y = mouth.outerCorner!.y - mouth.half.y * widest;
              triangles.forEach((triangle, index) => {
                const offset =
                  mouth.coreOutboard && visible[index]!.name === "core"
                    ? coreOutboardOffset(jets.layers)!
                    : 0;
                expect((triangle.points[0].x + triangle.points[2].x) / 2).toBeCloseTo(
                  x + mouth.half.x * offset,
                  10,
                );
                expect((triangle.points[0].y + triangle.points[2].y) / 2).toBeCloseTo(
                  y + mouth.half.y * offset,
                  10,
                );
              });
              const index = visible.findIndex((layer) => layer.width === widest);
              expect(
                Math.hypot(
                  triangles[index]!.points[0].x - mouth.outerCorner!.x,
                  triangles[index]!.points[0].y - mouth.outerCorner!.y,
                ),
              ).toBeLessThan(1e-9);
            }
          }
        }
      }
    }
  });
});
describe("canonical outboard core arrangement", () => {
  const layers = [
    {
      alpha: { from: 0.6, max: 0.5, to: 1 },
      colors: [3, 3] as const,
      length: 1.1,
      name: "halo",
      width: 2.4,
    },
    { colors: [2, 2] as const, length: 1, name: "outer", width: 1.6 },
    { colors: [1, 1] as const, length: 0.55, name: "core", width: 0.8 },
  ];
  it("derives a contained offset from selected geometry and never mutates material", () => {
    const before = structuredClone(layers);
    const offset = coreOutboardOffset(layers)!;
    expect(offset).toBeCloseTo(layers[1]!.width * (1 - layers[2]!.length / layers[1]!.length));
    expect(offset + layers[2]!.width).toBeLessThanOrEqual(layers[1]!.width);
    expect(coreOutboardOffset([layers[0]!, layers[2]!])).toBeUndefined();
    expect(coreOutboardOffset([layers[1]!, { ...layers[2]!, width: 3 }])).toBeUndefined();
    expect(coreOutboardOffset([{ ...layers[1]!, length: Infinity }, layers[2]!])).toBeUndefined();
    expect(layers).toEqual(before);
  });
  it("mirrors the core in signed half-space while the complete group keeps a single attachment", () => {
    for (const sign of [-1, 1]) {
      const mouth = {
        ...fixture.headings[0]![0]!,
        coreOutboard: true as const,
        half: { x: 2 * sign, y: 0 },
      };
      const jets = { ...fixture, headings: [[mouth]], layers };
      const triangles = jetTriangles(jets, display, 0, 1);
      const offset = coreOutboardOffset(layers)!;
      const anchorX = 48 - mouth.half.x * layers[0]!.width;
      expect(triangles.map((t) => t.color)).toEqual([3, 2, 1]);
      expect(triangles[0]!.points[0]).toEqual(mouth.outerCorner);
      expect(triangles[0]!.points[1].x).toBeCloseTo(anchorX);
      expect(triangles[1]!.points[1].x).toBeCloseTo(anchorX);
      expect(triangles[2]!.points[1].x).toBeCloseTo(anchorX + mouth.half.x * offset);
      for (const point of triangles[2]!.points) {
        const u = (point.x - anchorX) / mouth.half.x;
        const v = (48 - point.y) / 6;
        expect(Math.abs(u)).toBeLessThanOrEqual(layers[1]!.width * (1 - v) + 1e-10);
      }
      const clipped = jetTriangles(
        { ...jets, headings: [[{ ...mouth, rearClip: { constant: 46, normal: { x: 0, y: 1 } } }]] },
        display,
        0,
        1,
      );
      expect(clipped.every((t) => t.points.every((point) => point.y <= 46 + 1e-10))).toBe(true);
    }
  });
  it("validates the opt-in metadata without changing absent centered legacy groups", () => {
    const raw = mainArt.headings[0]!.mouths[0]!;
    const legacy = { anchor: raw.anchor, axis: raw.axis, half: raw.half };
    const file = (mouth: unknown) => ({
      ...mainArt,
      headings: [{ index: 0, mouths: [mouth] }, ...mainArt.headings.slice(1)],
    });
    const generic = (mouth: unknown) => ({
      frame: mainArt.frame,
      headings: [{ index: 0, mouths: [mouth] }],
      layers: mainArt.engineLevels[0]!.layers,
      length: mainArt.length,
      version: 1,
    });
    expect(readEngineJets(file(legacy))?.headings).toHaveLength(64);
    expect(readShipJets(generic(legacy))).toBeDefined();
    expect(readEngineJets({ ...file(legacy), headings: generic(legacy).headings })).toBeUndefined();
    expect(readShipJets(generic({ ...legacy, coreOutboard: true }))).toBeUndefined();
    expect(readEngineJets(file({ ...legacy, coreOutboard: true }))).toBeUndefined();
    for (const value of [false, 1, "true"]) {
      expect(
        readEngineJets(file({ ...legacy, coreOutboard: value, outerCorner: [48, 48] })),
      ).toBeUndefined();
      expect(
        readShipJets(generic({ ...legacy, coreOutboard: value, outerCorner: [48, 48] })),
      ).toBeUndefined();
    }
    expect(
      readShipJets(generic({ ...legacy, coreOutboard: true, outerCorner: [48, 48] })),
    ).toBeDefined();
    expect(
      readEngineJets(file({ ...legacy, coreOutboard: true, outerCorner: [48, 48] })),
    ).toBeDefined();
  });
});
