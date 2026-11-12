import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import art from "../../public/art/ship-jets.json";
import { SHIP_HEADINGS } from "../model/nose.ts";
import { hasShipHeadings } from "./ship-art.ts";
import {
  engineJetLayers,
  type JetDisplay,
  jetLength,
  jetTriangles,
  layerAlpha,
  layerColor,
  levelLayers,
  readLevelLayers,
  readShipJets,
  type ShipJets,
} from "./ship-jets.ts";

const jets = readShipJets(art)!;
const [halo, outer, core] = jets.layers;
// Identity mapping keeps triangle coordinates in heading-frame pixels.
const framePixels: JetDisplay = { displayHeight: 96, displayWidth: 96, pivot: { x: 0, y: 0 } };
const shipDisplay: JetDisplay = { displayHeight: 42, displayWidth: 42, pivot: { x: 0.5, y: 0.5 } };
const single: ShipJets = {
  ...jets,
  headings: Array.from({ length: SHIP_HEADINGS }, () => [
    { anchor: { x: 50, y: 60 }, axis: { x: 0, y: 1 }, half: { x: 2, y: 0 } },
  ]),
};
const flat = (points: readonly { x: number; y: number }[]) => points.flatMap(({ x, y }) => [x, y]);
const withHeading = (heading: unknown) => ({
  ...art,
  headings: [heading, ...art.headings.slice(1)],
});

describe("ship jet metadata", () => {
  it("reads 32 headings of two mouths and three layers from Art's file", () => {
    expect(jets.frame).toBe(96);
    expect(jets.headings).toHaveLength(32);
    expect(jets.headings.every((mouths) => mouths.length === 2)).toBe(true);
    expect(jets.layers).toHaveLength(3);
    expect(jets.headings[0]![0]!.anchor).toEqual({ x: 43.55, y: 30.579 });
  });

  it("takes the heading count from the file", () => {
    const sixteen = art.headings
      .filter((heading) => heading.index % 2 === 0)
      .map((heading) => ({ ...heading, index: heading.index / 2 }));
    expect(readShipJets({ ...art, headings: sixteen })?.headings).toHaveLength(16);
    expect(readShipJets({ ...art, headings: [] })).toBeUndefined();
  });

  it("covers every ship heading the manifest's frames provide", () => {
    expect(jets.headings).toHaveLength(SHIP_HEADINGS);
    expect(hasShipHeadings(manifest.assets)).toBe(true);
  });

  it("places headings by their declared index", () => {
    const reversed = readShipJets({ ...art, headings: [...art.headings].reverse() })!;
    expect(reversed.headings).toEqual(jets.headings);
  });

  it.each([
    ["an unknown version", { ...art, version: 2 }],
    ["a missing heading", { ...art, headings: art.headings.slice(1) }],
    ["a duplicate heading index", withHeading(art.headings[1])],
    [
      "a non-numeric vector",
      withHeading({ index: 0, mouths: [{ anchor: ["1", 2], axis: [0, 1], half: [1, 0] }] }),
    ],
    ["a heading without mouths", withHeading({ index: 0, mouths: [] })],
    ["a malformed colour", { ...art, layers: [{ ...art.layers[0], color: "blue" }] }],
    [
      "an empty alpha ramp",
      { ...art, layers: [{ ...art.layers[0], alpha: { from: 1, max: 1, to: 1 } }] },
    ],
    ["a missing length curve", { ...art, length: undefined }],
    ["no data", undefined],
  ])("rejects %s", (_, value) => {
    expect(readShipJets(value)).toBeUndefined();
  });
});

describe("jet style from Art's file", () => {
  it.each([
    [0.25, 7.5, 0x73a9d9, 0xa9d3f4, 0],
    [0.5, 12, 0x8ac0e6, 0xc6e2f8, 0],
    [0.75, 19.5, 0xa2d6f2, 0xe2f0fb, 0.1875],
    [1, 30, 0xb9ecff, 0xffffff, 0.5],
  ])(
    "at f = %s has length %s, outer %s, core %s and halo alpha %s",
    (f, length, outerColor, coreColor, haloAlpha) => {
      expect(jetLength(jets, f)).toBeCloseTo(length);
      expect(layerColor(outer!, f)).toBe(outerColor);
      expect(layerColor(core!, f)).toBe(coreColor);
      expect(layerColor(halo!, f)).toBe(0x70ace8);
      expect(layerAlpha(halo!, f)).toBeCloseTo(haloAlpha);
      expect(layerAlpha(outer!, f)).toBe(1);
    },
  );

  it("scales layer lengths from the outer jet length", () => {
    const [haloTriangle, outerTriangle, coreTriangle] = jetTriangles(single, framePixels, 0, 1);
    expect(haloTriangle!.points[1].y - 60).toBeCloseTo(30 * 1.1);
    expect(outerTriangle!.points[1].y - 60).toBeCloseTo(30);
    expect(coreTriangle!.points[1].y - 60).toBeCloseTo(30 * 0.55);
  });

  it("omits the halo at and below f = 0.6", () => {
    expect(layerAlpha(halo!, 0.6)).toBe(0);
    expect(jetTriangles(single, framePixels, 0, 0.6)).toHaveLength(2);
    expect(jetTriangles(single, framePixels, 0, 0.61)).toHaveLength(3);
  });
});

describe("jets by Engine level", () => {
  it.each([
    [1, 0x70ace8, 0xb9ecff, 0xffffff],
    [2, 0xff8f1f, 0xffd59a, 0xffffff],
    [3, 0xa66bff, 0xe6ccff, 0xffffff],
  ])("draws level %s in Art's colours, widths and lengths unchanged", (level, h, o, c) => {
    const layers = engineJetLayers(jets, level);
    expect(layers.map((layer) => layerColor(layer, 1))).toEqual([h, o, c]);
    expect(layers.map(({ length, width }) => [length, width])).toEqual(
      jets.layers.map(({ length, width }) => [length, width]),
    );
    expect(layers[0]!.alpha).toEqual(halo!.alpha);
  });

  it("repeats level 1 in the top-level layers and clamps outside 1 to 3", () => {
    expect(engineJetLayers(jets, 1)).toEqual(jets.layers);
    expect(engineJetLayers(jets, 0)).toEqual(engineJetLayers(jets, 1));
    expect(engineJetLayers(jets, 5)).toEqual(engineJetLayers(jets, 3));
    const { engineLevels: _, ...plain } = jets;
    expect(engineJetLayers(plain, 3)).toBe(jets.layers);
    expect(levelLayers(undefined, 2)).toBeUndefined();
  });

  it.each([
    ["a missing level", art.engineLevels.slice(1)],
    ["a duplicate level", [art.engineLevels[0], art.engineLevels[0], art.engineLevels[2]]],
    ["a malformed layer", [{ level: 1, layers: [{ color: "blue", length: 1, width: 1 }] }]],
    ["no levels", []],
  ])("rejects %s", (_, value) => {
    expect(readLevelLayers(value)).toBeUndefined();
    expect(readShipJets({ ...art, engineLevels: value })).toBeUndefined();
  });

  it("reads a craft without engine levels", () => {
    const { engineLevels: _, ...plain } = art;
    expect(readShipJets(plain)?.engineLevels).toBeUndefined();
  });
});

describe("jet triangles", () => {
  it("draws nothing at f = 0", () => {
    expect(jetTriangles(jets, shipDisplay, 0, 0)).toEqual([]);
  });

  it("orders halo, outer and core per mouth", () => {
    const triangles = jetTriangles(jets, framePixels, 3, 1);
    expect(triangles.map(({ alpha, color }) => [color, alpha])).toEqual([
      [0x70ace8, 0.5],
      [0xb9ecff, 1],
      [0xffffff, 1],
      [0x70ace8, 0.5],
      [0xb9ecff, 1],
      [0xffffff, 1],
    ]);
  });

  it("spans anchor plus or minus half times width to a tip along the rear axis", () => {
    const [outerTriangle, coreTriangle] = jetTriangles(single, framePixels, 0, 0.5);
    flat(outerTriangle!.points).forEach((value, at) =>
      expect(value).toBeCloseTo([53.2, 60, 50, 72, 46.8, 60][at]!),
    );
    flat(coreTriangle!.points).forEach((value, at) =>
      expect(value).toBeCloseTo([51.6, 60, 50, 66.6, 48.4, 60][at]!),
    );
  });

  it("maps frame pixels into the 42px display relative to the sprite origin", () => {
    const [outerTriangle] = jetTriangles(single, shipDisplay, 0, 0.5);
    const scale = 42 / 96;
    expect(outerTriangle!.points[0].x).toBeCloseTo((53.2 - 48) * scale);
    expect(outerTriangle!.points[1].y).toBeCloseTo((72 - 48) * scale);
  });

  it("anchors each mouth at local (±12.25, 17.39, 2.60) on the pyramid hull at every heading", () => {
    // Art's projection (art/tools/projection.ts): heading k turns local forward (negative y) to
    // world angle k * 360 / 32, then the view along (1, 1, 1) raises +z, pivot (48, 48).
    const mouth = (sign: -1 | 1, heading: number) => {
      const angle = (heading * Math.PI) / 16 + Math.PI / 2;
      const [x, y, z] = [sign * 12.25, 17.39, 2.6];
      const wx = x * Math.cos(angle) - y * Math.sin(angle);
      const wy = x * Math.sin(angle) + y * Math.cos(angle);
      return { x: 48 + ((wx - wy) * Math.sqrt(3)) / 2, y: 48 + (wx + wy) / 2 - z };
    };
    jets.headings.forEach((mouths, heading) => {
      ([-1, 1] as const).forEach((sign, index) => {
        const expected = mouth(sign, heading);
        expect(mouths[index]!.anchor.x).toBeCloseTo(expected.x, 2);
        expect(mouths[index]!.anchor.y).toBeCloseTo(expected.y, 2);
      });
    });
  });
});
