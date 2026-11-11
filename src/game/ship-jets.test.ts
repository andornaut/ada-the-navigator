import { describe, expect, it } from "vitest";

import art from "../../public/art/ship-jets.json";
import {
  type JetDisplay,
  jetLength,
  jetTriangles,
  layerAlpha,
  layerColor,
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
  headings: Array.from({ length: 8 }, () => [
    { anchor: { x: 50, y: 60 }, axis: { x: 0, y: 1 }, half: { x: 2, y: 0 } },
  ]),
};
const flat = (points: readonly { x: number; y: number }[]) => points.flatMap(({ x, y }) => [x, y]);
const withHeading = (heading: unknown) => ({
  ...art,
  headings: [heading, ...art.headings.slice(1)],
});

describe("ship jet metadata", () => {
  it("reads eight headings of two mouths and three layers from Art's file", () => {
    expect(jets.frame).toBe(96);
    expect(jets.headings).toHaveLength(8);
    expect(jets.headings.every((mouths) => mouths.length === 2)).toBe(true);
    expect(jets.layers).toHaveLength(3);
    expect(jets.headings[0]![0]!.anchor).toEqual({ x: 47.302, y: 26.637 });
  });

  it("takes the heading count from the file", () => {
    const sixteen = art.headings.flatMap((heading) => [
      { ...heading, index: heading.index * 2 },
      { ...heading, index: heading.index * 2 + 1 },
    ]);
    expect(readShipJets({ ...art, headings: sixteen })?.headings).toHaveLength(16);
    expect(readShipJets({ ...art, headings: [] })).toBeUndefined();
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

  it("matches Art's jet mock-up for heading 3 at full speed", () => {
    // Mock-up polygons are drawn in a 128px canvas with a 16px pad around the 96px frame.
    const reference = [
      [89.55, 77.99, 128.62, 75.41, 86.87, 72.83],
      [89.1, 77.13, 124.95, 75.41, 87.31, 73.69],
      [88.66, 76.27, 108.42, 75.41, 87.76, 74.55],
      [89.55, 46.01, 128.62, 48.59, 86.87, 51.17],
      [89.1, 46.87, 124.95, 48.59, 87.31, 50.31],
      [88.66, 47.73, 108.42, 48.59, 87.76, 49.45],
    ];
    const triangles = jetTriangles(jets, framePixels, 3, 1);
    expect(triangles).toHaveLength(reference.length);
    triangles.forEach((triangle, index) => {
      const points = triangle.points.flatMap(({ x, y }) => [x + 16, y + 16]);
      points.forEach((value, at) => expect(value).toBeCloseTo(reference[index]![at]!, 1));
    });
  });
});
