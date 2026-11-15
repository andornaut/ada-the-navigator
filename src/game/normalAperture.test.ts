import { describe, expect, it } from "vitest";

import art from "../../public/art/ship-jets.json";
import { type JetShapeMouth, jetShapePolygons } from "./jetGeometry.ts";
import { LIGHT_FIELD } from "./lightField.ts";
import { engineJets, jetTriangles, readEngineJets } from "./shipJets.ts";

const coreWidth = 6.875 / 18.72;
const mouth: JetShapeMouth = {
  anchor: { x: 12.25, y: 17 },
  axis: { x: 0, y: 1 },
  half: { x: 18.72 / 2, y: 0 },
  normalAperture: { coreWidth },
};
const layers = [
  { alpha: { from: 0.6, max: 0.5, to: 1 }, length: 1.1, name: "halo", width: 2.4 },
  { length: 1, name: "outer", width: 1.6 },
  { length: 0.55, name: "core", width: 0.8 },
];
const metadata = (profile: unknown, extra: object = {}) => ({
  ...art,
  headings: art.headings.map((heading) => ({
    ...heading,
    mouths: heading.mouths.map(({ anchor, axis, half }) => ({
      anchor,
      axis,
      half,
      normalAperture: profile,
      ...extra,
    })),
  })),
});

describe("normal aperture metadata", () => {
  it("retains the explicit physical core fraction through engine selection", () => {
    const parsed = readEngineJets(metadata({ coreWidth }))!;
    expect(parsed).toBeDefined();
    expect(engineJets(parsed, 3).headings[0]![0]!.normalAperture).toEqual({ coreWidth });
  });

  it.each([
    null,
    {},
    { coreWidth: 0 },
    { coreWidth: 1 },
    { coreWidth: -1 },
    { coreWidth: Infinity },
    { coreWidth: NaN },
    { coreWidth: "0.3" },
  ])("rejects malformed profile %j", (profile) => {
    expect(readEngineJets(metadata(profile))).toBeUndefined();
  });

  it.each([
    { outerCorner: [1, 2] },
    { coreOutboard: true },
    { rearClip: { constant: 3, normal: [0, 1] } },
  ])("rejects incompatible legacy anchoring %j", (extra) => {
    expect(readEngineJets(metadata({ coreWidth }, extra))).toBeUndefined();
  });
});

describe("centered normal aperture geometry", () => {
  it("roots every triangle flush on the full opening with dark material on both core sides", () => {
    const polygons = jetShapePolygons(mouth, layers, 30, 1);
    expect(polygons).toHaveLength(3);
    for (const [index, polygon] of polygons.entries()) {
      const [right, tip, left] = polygon.points;
      const factor = [1, coreWidth * 2, coreWidth][index]!;
      expect(right!.x).toBeCloseTo(mouth.anchor.x + mouth.half.x * factor, 12);
      expect(right!.y).toBe(mouth.anchor.y);
      expect(left!.x).toBeCloseTo(mouth.anchor.x - mouth.half.x * factor, 12);
      expect(left!.y).toBe(mouth.anchor.y);
      expect(tip).toEqual({ x: mouth.anchor.x, y: mouth.anchor.y + 30 * layers[index]!.length });
    }
    const outer = polygons[1]!.points,
      core = polygons[2]!.points;
    expect(core[0]!.x).toBeLessThan(outer[0]!.x);
    expect(core[2]!.x).toBeGreaterThan(outer[2]!.x);
    expect(core[0]!.x - mouth.anchor.x).toBeCloseTo(6.875 / 2, 12);
  });

  it("keeps first-authored normalization when the halo is transparent", () => {
    const polygons = jetShapePolygons(mouth, layers, 30, 0.4);
    expect(polygons.map((polygon) => polygon.layerIndex)).toEqual([1, 2]);
    expect(polygons[0]!.points[0]!.x).toBeCloseTo(
      mouth.anchor.x + mouth.half.x * coreWidth * 2,
      12,
    );
  });

  it("preserves the physical core aperture when only the core is selected", () => {
    const [polygon] = jetShapePolygons(mouth, [layers[2]!], 30, 1);
    expect(polygon!.points[0]!.x - polygon!.points[2]!.x).toBeCloseTo(6.875, 12);
  });

  it("projects the base and tip along arbitrary authored tangent and axis vectors", () => {
    const rotated = { ...mouth, axis: { x: 0.8, y: 0.2 }, half: { x: 3, y: -5 } };
    const [polygon] = jetShapePolygons(rotated, layers, 10, 1);
    expect(polygon!.points).toEqual([
      { x: 15.25, y: 12 },
      { x: 21.05, y: 19.2 },
      { x: 9.25, y: 22 },
    ]);
  });

  it.each([false, true])("preserves selected engine material and length (light=%s)", (light) => {
    const parsed = readEngineJets(metadata({ coreWidth }))!;
    for (const level of [1, 2, 3]) {
      const selected = engineJets(parsed, level);
      const material = light ? LIGHT_FIELD.jets.shipLevels[level - 1]! : selected.layers;
      const geometry = { ...selected, headings: [[mouth]], layers: material };
      const triangles = jetTriangles(
        geometry,
        { displayHeight: 96, displayWidth: 96, pivot: { x: 0, y: 0 } },
        0,
        1,
      );
      expect(triangles).toHaveLength(material.length);
      expect(triangles[0]!.points[0]!.x - triangles[0]!.points[2]!.x).toBeCloseTo(18.72, 12);
      expect(triangles.at(-1)!.points[0]!.x - triangles.at(-1)!.points[2]!.x).toBeCloseTo(
        6.875,
        12,
      );
      for (const [index, triangle] of triangles.entries()) {
        expect(triangle.color).toBe(material[index]!.colors[1]);
        expect(triangle.alpha).toBe(material[index]!.alpha?.max ?? 1);
        expect(triangle.points[1]!.y).toBeCloseTo(17 + 30 * material[index]!.length, 12);
      }
    }
  });

  it.each(
    [
      [{ ...layers[0]!, length: 0.1 }, layers[1]!, layers[2]!],
      [layers[0]!, { ...layers[1]!, width: 9 }, layers[2]!],
      [layers[0]!, { ...layers[2]!, width: 0 }],
      [layers[0]!, { ...layers[2]!, length: NaN }],
    ].map((selected) => ({ selected })),
  )("rejects uncontained or invalid layer geometry %#", ({ selected }) => {
    expect(jetShapePolygons(mouth, selected, 30, 1)).toEqual([]);
  });

  it("remains hidden at zero thrust", () => {
    expect(jetShapePolygons(mouth, layers, 30, 0)).toEqual([]);
  });
});
