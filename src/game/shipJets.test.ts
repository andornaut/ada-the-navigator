import { describe, expect, it } from "vitest";

import { SHIP_HEADINGS as ART_SHIP_HEADINGS } from "../../art/tools/projection.ts";
import { JET_LEVELS, JET_PROFILE, JET_SHAPE } from "../../art/tools/ship-jet-layers.ts";
import { forwardJetMouths, FRAME } from "../../art/tools/ship-model.ts";
import { jetLength as artJetLength, plumePolygon } from "../../art/tools/ship-plume.ts";
import manifest from "../../public/art/manifest.json";
import art from "../../public/art/ship-jets.json";
import { SHIP_HEADINGS } from "../model/nose.ts";
import { hasShipHeadings } from "./shipArt.ts";
import {
  engineJets,
  type JetDisplay,
  jetLength,
  jetPlumes,
  jetTriangles,
  layerAlpha,
  layerColor,
  levelLayers,
  readEngineJets,
  readLevelLayers,
  readShipJets,
  type ShipJets,
} from "./shipJets.ts";

const ada = readEngineJets(art)!;
// Engine level 1, the base style the shape tests check.
const jets = engineJets(ada, 1);
const [outer, core] = jets.layers;
// Identity mapping keeps plume coordinates in heading-frame pixels.
const framePixels: JetDisplay = { displayHeight: 96, displayWidth: 96, pivot: { x: 0, y: 0 } };
const shipDisplay: JetDisplay = { displayHeight: 42, displayWidth: 42, pivot: { x: 0.5, y: 0.5 } };
const single: ShipJets = {
  ...jets,
  headings: Array.from({ length: SHIP_HEADINGS }, () => [
    { anchor: { x: 50, y: 60 }, axis: { x: 0, y: 1 }, half: { x: 1, y: 0 } },
  ]),
};
const flat = (points: readonly { x: number; y: number }[]) => points.flatMap(({ x, y }) => [x, y]);
const color = (value: string) => Number.parseInt(value.slice(1), 16);
const withHeading = (heading: unknown) => ({
  ...art,
  headings: [heading, ...art.headings.slice(1)],
});
// Ada's file with level 1's outer layer changed by `change`.
const withOuter = (change: Record<string, unknown>) => ({
  ...art,
  engineLevels: [
    {
      ...art.engineLevels[0]!,
      layers: [
        { ...art.engineLevels[0]!.layers[0]!, ...change },
        ...art.engineLevels[0]!.layers.slice(1),
      ],
    },
    ...art.engineLevels.slice(1),
  ],
});
const shoelace = (points: readonly { x: number; y: number }[]) =>
  Math.abs(
    points.reduce((sum, a, i) => {
      const b = points[(i + 1) % points.length]!;
      return sum + a.x * b.y - b.x * a.y;
    }, 0),
  ) / 2;

describe("ship jet metadata", () => {
  it("reads 64 headings of two mouths, the outer and core layers and the teardrop profile", () => {
    expect(jets.frame).toBe(96);
    expect(jets.headings).toHaveLength(64);
    expect(jets.headings.every((mouths) => mouths.length === 2)).toBe(true);
    expect(jets.layers.map(({ name }) => name)).toEqual(["outer", "core"]);
    expect(jets.profile).toEqual(JET_PROFILE);
    const [x, y] = art.headings[0]!.mouths[0]!.anchor;
    expect(jets.headings[0]![0]!.anchor).toEqual({ x, y });
  });

  it("rejects a reduced player heading set rather than treating it as a supported package", () => {
    const sixteen = art.headings
      .filter((heading) => heading.index % 2 === 0)
      .map((heading) => ({ ...heading, index: heading.index / 2 }));
    expect(readEngineJets({ ...art, headings: sixteen })).toBeUndefined();
    expect(readEngineJets({ ...art, headings: [] })).toBeUndefined();
  });

  it("covers every ship heading the manifest's frames provide", () => {
    expect(jets.headings).toHaveLength(SHIP_HEADINGS);
    expect(hasShipHeadings(manifest.assets)).toBe(true);
  });

  it("places headings by their declared index", () => {
    const reversed = readEngineJets({ ...art, headings: [...art.headings].reverse() })!;
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
    ["a malformed colour", withOuter({ colors: ["blue", "#ffffff"] })],
    ["an empty alpha ramp", withOuter({ alpha: { from: 1, max: 1, to: 1 } })],
    ["a missing length curve", { ...art, length: undefined }],
    ["no engine levels", { ...art, engineLevels: undefined }],
    ["no profile", { ...art, profile: undefined }],
    ["a profile without its tip", { ...art, profile: art.profile.slice(0, -1) }],
    ["a profile not from the root", { ...art, profile: art.profile.slice(1) }],
    ["a profile out of order", { ...art, profile: [...art.profile].reverse() }],
    ["a negative profile width", { ...art, profile: [[0, -1], ...art.profile.slice(1)] }],
    ["a malformed profile sample", { ...art, profile: [[0], ...art.profile.slice(1)] }],
    ["no data", undefined],
  ])("rejects %s", (_, value) => {
    expect(readEngineJets(value)).toBeUndefined();
  });

  it("reads a craft's file by its one set of layers, which Ada's file has none of", () => {
    const craft = { ...art, engineLevels: undefined, layers: art.engineLevels[1]!.layers };
    expect(readShipJets(craft)?.layers).toEqual(engineJets(ada, 2).layers);
    expect(readShipJets(art)).toBeUndefined();
    expect("layers" in art).toBe(false);
  });
});

describe("authored jet occlusion", () => {
  const polygon = [
    [12, 30],
    [20, 30],
    [20, 40],
  ];
  const masked = (occluders: unknown) =>
    withHeading({
      ...art.headings[0],
      mouths: art.headings[0]!.mouths.map(({ anchor, axis, half }, index) => ({
        anchor,
        axis,
        half,
        ...(index === 0 ? { occluders } : {}),
      })),
    });

  it("reads every forward mouth's occluders and omits them unless a consumer asks", () => {
    expect(jets.headings.every((mouths) => mouths.every((m) => m.occluders?.length))).toBe(true);
    expect(readEngineJets(masked(undefined))!.headings[0]![0]).not.toHaveProperty("occluders");
    expect(jetTriangles(jets, framePixels, 0, 0.8)[0]).not.toHaveProperty("occluders");
  });

  it("preserves per-mouth nearer surfaces through engine selection and display projection", () => {
    const read = readEngineJets(masked([polygon]))!;
    const selected = engineJets(read, 2);
    const plumes = jetPlumes(selected, { ...shipDisplay, includeOccluders: true }, 0, 0.8);
    const expected = polygon.map(([x, y]) => ({
      x: ((x! - 48) * 42) / 96,
      y: ((y! - 48) * 42) / 96,
    }));
    // Mouth 0: outer and core share its occluders; mouth 1 has none.
    expect(plumes[0]!.occluders).toEqual([expected]);
    expect(plumes[1]!.occluders).toBe(plumes[0]!.occluders);
    expect(plumes[2]).not.toHaveProperty("occluders");
    const craft = {
      ...masked([polygon]),
      engineLevels: undefined,
      layers: art.engineLevels[0]!.layers,
    };
    expect(readShipJets(craft)?.headings[0]![0]!.occluders).toEqual([
      polygon.map(([x, y]) => ({ x, y })),
    ]);
  });

  it.each([
    null,
    {},
    [null],
    [
      [
        [1, 2],
        [3, 4],
      ],
    ],
    [
      [
        [1, 2],
        [3, 4],
        [NaN, 5],
      ],
    ],
  ])("rejects malformed optional occluders %j rather than revealing the whole plume", (value) =>
    expect(readEngineJets(masked(value))).toBeUndefined(),
  );
});

describe("jet interpolation", () => {
  it.each([
    [0.25, 7.5, 0x73a9d9, 0xa9d3f4],
    [0.5, 12, 0x8ac0e6, 0xc6e2f8],
    [0.75, 19.5, 0xa2d6f2, 0xe2f0fb],
    [1, 30, 0xb9ecff, 0xffffff],
  ])("at f = %s has length %s, outer %s and core %s, both opaque", (f, length, out, inner) => {
    expect(jetLength(jets, f)).toBeCloseTo(length);
    expect(layerColor(outer!, f)).toBe(out);
    expect(layerColor(core!, f)).toBe(inner);
    expect(layerAlpha(outer!, f)).toBe(1);
    expect(layerAlpha(core!, f)).toBe(1);
  });

  it("reaches the outer tip at the jet length and the core tip at half of it", () => {
    const [outerPlume, corePlume] = jetPlumes(single, framePixels, 0, 1);
    expect(Math.max(...outerPlume!.points.map(({ y }) => y)) - 60).toBeCloseTo(30);
    expect(Math.max(...corePlume!.points.map(({ y }) => y)) - 60).toBeCloseTo(15);
  });
});

describe("jets by Engine level", () => {
  it.each(JET_LEVELS)(
    "draws engine $level in the canonical palette with unchanged layer geometry",
    ({ core: coreColors, level, outer: outerColors }) => {
      const { layers } = engineJets(ada, level);
      expect(layers.map(({ colors }) => colors)).toEqual([
        outerColors.map(color),
        coreColors.map(color),
      ]);
      expect(layers.map(({ length, width }) => [length, width])).toEqual([
        [JET_SHAPE.outer.length, JET_SHAPE.outer.width],
        [JET_SHAPE.core.length, JET_SHAPE.core.width],
      ]);
    },
  );

  it("reads only the level list, clamping outside 1 to 3, with the geometry unchanged", () => {
    expect(ada.engineLevels).toHaveLength(3);
    expect(engineJets(ada, 0).layers).toBe(ada.engineLevels[0]);
    expect(engineJets(ada, 5).layers).toBe(ada.engineLevels[2]);
    expect(levelLayers(ada.engineLevels, 2.4)).toBe(ada.engineLevels[1]);
    const { frame, headings, length, profile } = engineJets(ada, 3);
    expect({ frame, headings, length, profile }).toEqual({
      frame: ada.frame,
      headings: ada.headings,
      length: ada.length,
      profile: ada.profile,
    });
  });

  it.each([
    ["a missing level", art.engineLevels.slice(1)],
    ["a duplicate level", [art.engineLevels[0], art.engineLevels[0], art.engineLevels[2]]],
    ["a malformed layer", [{ layers: [{ color: "blue", length: 1, width: 1 }], level: 1 }]],
    ["no levels", []],
  ])("rejects %s", (_, value) => {
    expect(readLevelLayers(value)).toBeUndefined();
    expect(readEngineJets({ ...art, engineLevels: value })).toBeUndefined();
  });
});

describe("teardrop plumes", () => {
  it("draws nothing at f = 0", () => {
    expect(jetPlumes(jets, shipDisplay, 0, 0)).toEqual([]);
    expect(jetTriangles(jets, shipDisplay, 0, 0)).toEqual([]);
  });

  it("orders outer then core per mouth, in their interpolated colours", () => {
    const plumes = jetPlumes(jets, framePixels, 3, 1);
    const one = [
      [color(JET_LEVELS[0].outer[1]), 1],
      [color(JET_LEVELS[0].core[1]), 1],
    ];
    expect(plumes.map(({ alpha, color }) => [color, alpha])).toEqual([...one, ...one]);
  });

  it("matches Art's plume outline for every heading, mouth and layer", () => {
    for (const f of [0.3, 1]) {
      const length = artJetLength(art.length, f);
      jets.headings.forEach((mouths, heading) => {
        const plumes = jetPlumes(jets, framePixels, heading, f);
        expect(plumes).toHaveLength(4);
        mouths.forEach((_, index) => {
          const { anchor, axis, half } = art.headings[heading]!.mouths[index]!;
          for (const [layer, shape] of [JET_SHAPE.outer, JET_SHAPE.core].entries()) {
            const expected = plumePolygon(
              JET_PROFILE,
              {
                anchor: anchor as [number, number],
                axis: axis as [number, number],
                half: half as [number, number],
              },
              shape,
              length,
            );
            const actual = plumes[index * 2 + layer]!.points;
            expect(actual).toHaveLength(expected.length);
            flat(actual).forEach((value, at) => expect(value).toBeCloseTo(expected.flat()[at]!, 9));
          }
        });
      });
    }
  });

  it("fills exactly the concave outline with its triangles", () => {
    for (const plume of jetPlumes(jets, framePixels, 17, 1)) {
      const area = plume.triangles.reduce((sum, triangle) => sum + shoelace(triangle), 0);
      expect(area).toBeCloseTo(shoelace(plume.points), 9);
      const corners = new Set(plume.points.map(({ x, y }) => `${x},${y}`));
      for (const triangle of plume.triangles) {
        for (const { x, y } of triangle) {
          expect(corners.has(`${x},${y}`)).toBe(true);
        }
      }
    }
  });

  it("spans the profile across the half vector times the layer width", () => {
    const [outerPlume] = jetPlumes(single, framePixels, 0, 0.5);
    // Length 12; outer half width 5.8: root at 0.8 of it, full at 0.1 to 0.22, tip at 12.
    expect(flat(outerPlume!.points.slice(0, 3))).toEqual(
      [50 + 5.8 * 0.8, 60, 50 + 5.8, 61.2, 50 + 5.8, 62.64].map((value) =>
        expect.closeTo(value, 9),
      ),
    );
    expect(outerPlume!.points[5]).toEqual({ x: 50, y: 72 });
    expect(outerPlume!.points.at(-1)!.x).toBeCloseTo(50 - 5.8 * 0.8);
  });

  it("maps frame pixels into the 42px display relative to the sprite origin", () => {
    const [outerPlume] = jetPlumes(single, shipDisplay, 0, 0.5);
    const scale = 42 / 96;
    expect(outerPlume!.points[0]!.x).toBeCloseTo((50 + 5.8 * 0.8 - 48) * scale);
    expect(outerPlume!.points[5]!.y).toBeCloseTo((72 - 48) * scale);
  });

  it("draws one triangle per layer for a craft file without a profile", () => {
    const { frame, headings, layers, length } = single;
    const triangle: ShipJets = { frame, headings, layers, length };
    const [outerTriangle, coreTriangle] = jetTriangles(triangle, framePixels, 0, 0.5);
    expect(jetTriangles(triangle, framePixels, 0, 0.5)).toHaveLength(2);
    flat(outerTriangle!.points).forEach((value, at) =>
      expect(value).toBeCloseTo([55.8, 60, 50, 72, 44.2, 60][at]!),
    );
    flat(coreTriangle!.points).forEach((value, at) =>
      expect(value).toBeCloseTo([51.6, 60, 50, 66, 48.4, 60][at]!),
    );
  });

  it("matches the current canonical producer mouth geometry at every heading", () => {
    expect(jets.frame).toBe(FRAME);
    expect(jets.headings).toHaveLength(ART_SHIP_HEADINGS);
    const reach = { halfWidth: JET_SHAPE.outer.width, length: 30 };
    jets.headings.forEach((mouths, heading) => {
      expect(mouths).toHaveLength(2);
      forwardJetMouths(FRAME / 2, { yaw: heading }, reach).forEach((mouth, index) => {
        const [x, y] = mouth.anchor;
        const [ax, ay] = mouth.axis;
        const [hx, hy] = mouth.half;
        expect(mouths[index]!.anchor).toEqual({ x, y });
        expect(mouths[index]!.axis).toEqual({ x: ax, y: ay });
        expect(mouths[index]!.half).toEqual({ x: hx, y: hy });
      });
    });
  });
});
