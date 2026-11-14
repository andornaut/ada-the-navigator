import { describe, expect, it } from "vitest";

import rearArt from "../../public/art/ship-jets.json";
import paint from "../../public/art/ship-paint.json";
import retroArt from "../../public/art/ship-retro-jets.json";
import { LIGHT_FIELD } from "./lightField.ts";
import {
  engineJets,
  jetTriangles,
  layerColor,
  readEngineJets,
  type ShipJets,
  travelJets,
} from "./shipJets.ts";
const main = readEngineJets(rearArt)!;
const retro = readEngineJets(retroArt)!;
const display = { displayHeight: 96, displayWidth: 96, pivot: { x: 0, y: 0 } };
describe("retro material selection", () => {
  it.each(paint.schemes.map(({ id }) => id))(
    "uses the exact main material for %s at every engine and field",
    () => {
      for (const field of [undefined, LIGHT_FIELD.jets.shipLevels]) {
        for (const level of [1, 2, 3]) {
          const forward = travelJets(main, retro, field, level, "forward")!;
          const reverse = travelJets(main, retro, field, level, "reverse")!;
          expect(reverse.layers).toBe(forward.layers);
          expect(reverse.layers).toBe((field ?? main.engineLevels)[level - 1]);
          expect(reverse.headings).toBe(retro.headings);
          expect(forward.headings).toBe(main.headings);
          for (const speed of [0.2, 0.65, 1]) {
            expect(reverse.layers.map((layer) => layerColor(layer, speed))).toEqual(
              forward.layers.map((layer) => layerColor(layer, speed)),
            );
          }
        }
      }
    },
  );
  it("never substitutes a fixed retro palette when the main or reverse recipe is missing", () => {
    expect(travelJets(undefined, retro, undefined, 1, "reverse")).toBeUndefined();
    expect(travelJets(main, undefined, undefined, 1, "reverse")).toBeUndefined();
    expect(travelJets(main, undefined, undefined, 1, "forward")?.layers).toBe(main.engineLevels[0]);
    expect(travelJets(main, retro, undefined, 1, undefined)?.headings).toBe(main.headings);
  });
});
describe("approved calibrated rear clipping", () => {
  it("keeps both outer corners and clips every layer, including halo, for all headings, fields and speeds", () => {
    let haloCount = 0;
    for (const field of [undefined, LIGHT_FIELD.jets.shipLevels]) {
      for (const level of [1, 2, 3]) {
        const jets = travelJets(main, retro, field, level, "reverse")!;
        const outer = jets.layers.find((layer) => layer.name === "outer")!;
        for (let heading = 0; heading < jets.headings.length; heading++) {
          const mouths = jets.headings[heading]!;
          expect(mouths).toHaveLength(2);
          for (const speed of [0.2, 0.65, 1]) {
            for (const mouth of mouths) {
              expect(mouth.outerCorner).toBeDefined();
              expect(mouth.rearClip).toBeDefined();
              const single = { ...jets, headings: [[mouth]] };
              const triangles = jetTriangles(single, display, 0, speed);
              expect(triangles.length).toBeGreaterThan(0);
              const clip = mouth.rearClip!;
              for (const triangle of triangles) {
                for (const point of triangle.points) {
                  expect(
                    clip.normal.x * point.x + clip.normal.y * point.y - clip.constant,
                  ).toBeLessThanOrEqual(1e-8);
                }
              }
              const color = layerColor(outer, speed);
              const outerPoints = triangles
                .filter((triangle) => triangle.color === color)
                .flatMap((triangle) => triangle.points);
              expect(
                outerPoints.some(
                  (point) =>
                    Math.hypot(point.x - mouth.outerCorner!.x, point.y - mouth.outerCorner!.y) <
                    1e-8,
                ),
              ).toBe(true);
              if (!field && speed > 0.6) {
                const halo = jets.layers.find((layer) => layer.name === "halo")!;
                expect(
                  triangles.some((triangle) => triangle.color === layerColor(halo, speed)),
                ).toBe(true);
                haloCount++;
              }
              expect(jetTriangles(single, display, 0, 0)).toEqual([]);
            }
          }
        }
      }
    }
    expect(haloCount).toBeGreaterThan(0);
  });
  it("derives the attachment from the selected outer role, not a fixed width or layer index", () => {
    const fixture: ShipJets = {
      frame: 96,
      headings: [
        [
          {
            anchor: { x: 999, y: 999 },
            axis: { x: 0, y: -1 },
            half: { x: 2, y: 0 },
            outerCorner: { x: 48, y: 48 },
            rearClip: { constant: 48, normal: { x: 0, y: 1 } },
          },
        ],
      ],
      layers: [
        { colors: [1, 1], length: 0.5, name: "core", width: 0.2 },
        { colors: [2, 2], length: 1, name: "outer", width: 3 },
      ],
      length: { base: 6, exponent: 2, scale: 0 },
    };
    const outer = jetTriangles(fixture, display, 0, 1).filter((triangle) => triangle.color === 2);
    expect(outer[0]!.points).toEqual([
      { x: 48, y: 48 },
      { x: 42, y: 42 },
      { x: 36, y: 48 },
    ]);
    const scaled = jetTriangles(
      fixture,
      { displayHeight: 48, displayWidth: 192, pivot: { x: 0.5, y: 0.5 } },
      0,
      1,
    ).filter((triangle) => triangle.color === 2);
    expect(scaled[0]!.points).toEqual([
      { x: 0, y: 0 },
      { x: -12, y: -3 },
      { x: -24, y: 0 },
    ]);
    expect(
      jetTriangles(
        { ...fixture, layers: fixture.layers.filter((layer) => layer.name !== "outer") },
        display,
        0,
        1,
      ),
    ).toEqual([]);
  });
  it("rejects malformed or unpaired attachment metadata without affecting legacy jet data", () => {
    const entry = { ...rearArt.headings[0]!.mouths[0]! };
    const file = (mouth: unknown) => ({ ...rearArt, headings: [{ index: 0, mouths: [mouth] }] });
    expect(readEngineJets(file(entry))).toBeDefined();
    for (const extra of [
      { outerCorner: [0, 0] },
      { rearClip: { constant: 0, normal: [1, 0] } },
      { outerCorner: [0, 0], rearClip: { constant: 0, normal: [0, 0] } },
      { outerCorner: [0, 0], rearClip: { constant: NaN, normal: [1, 0] } },
    ]) {
      expect(readEngineJets(file({ ...entry, ...extra }))).toBeUndefined();
    }
    expect(
      readEngineJets({
        ...rearArt,
        engineLevels: [{ layers: [{ color: "#ffffff", length: 1, name: 3, width: 1 }], level: 1 }],
      }),
    ).toBeUndefined();
    expect(engineJets(main, 1).layers.map((layer) => layer.name)).toEqual([
      "halo",
      "outer",
      "core",
    ]);
  });
});
