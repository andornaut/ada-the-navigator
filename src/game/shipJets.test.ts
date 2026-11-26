import { describe, expect, it } from "vitest";

import { SHIP_HEADINGS as ART_SHIP_HEADINGS } from "../../art/tools/projection.ts";
import { JET_LENGTH, JET_LEVELS, JET_PROFILE, JET_SHAPE } from "../../art/tools/ship-jet-layers.ts";
import { forwardJetMouthGeometry, FRAME } from "../../art/tools/ship-model.ts";
import { jetLength as artJetLength, plumePolygon } from "../../art/tools/ship-plume.ts";
import manifest from "../../public/art/manifest.json";
import art from "../../public/art/ship-jets.json";
import retroArt from "../../public/art/ship-retro-jets.json";
import { hasShipHeadings } from "../art/shipArt.ts";
import { SHIP_HEADINGS } from "../model/nose.ts";
import {
  engineJets,
  type JetDisplay,
  jetLayerPass,
  jetLength,
  jetPlumes,
  jetsInFront,
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
const [halo, outer, core] = jets.layers;
// Shape checks map frame pixels 1:1 (96 px), past the halo's maxDisplay, so they lift the gate.
const ungated = (source: ShipJets): ShipJets => ({
  ...source,
  layers: source.layers.map((layer) => ({ ...layer, maxDisplay: Infinity })),
});
// Layer shapes in draw order.
const SHAPES = [JET_SHAPE.halo, JET_SHAPE.outer, JET_SHAPE.core];
// Identity mapping keeps plume coordinates in heading-frame pixels.
const framePixels: JetDisplay = { displayHeight: 96, displayWidth: 96, pivot: { x: 0, y: 0 } };
const shipDisplay: JetDisplay = { displayHeight: 42, displayWidth: 42, pivot: { x: 0.5, y: 0.5 } };
const single: ShipJets = {
  ...ungated(jets),
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
  it("reads 64 headings of two mouths, the halo, outer and core layers and the teardrop profile", () => {
    expect(jets.frame).toBe(96);
    expect(jets.headings).toHaveLength(64);
    expect(jets.headings.every((mouths) => mouths.length === 2)).toBe(true);
    expect(jets.layers.map(({ name }) => name)).toEqual(["halo", "outer", "core"]);
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
    ["a non-boolean underHull", withOuter({ underHull: "yes" })],
    ["a zero maxDisplay", withOuter({ maxDisplay: 0 })],
    ["a negative maxDisplay", withOuter({ maxDisplay: -42 })],
    ["a non-numeric maxDisplay", withOuter({ maxDisplay: "42" })],
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

describe("under-hull halo", () => {
  const retro = readEngineJets(retroArt)!;
  const size = (side: number): JetDisplay => ({
    displayHeight: side,
    displayWidth: side,
    pivot: { x: 0.5, y: 0.5 },
  });

  it("keeps underHull and maxDisplay on every level's halo, forward and retro", () => {
    for (const file of [ada, retro]) {
      for (const layers of file.engineLevels) {
        const [first, ...rest] = layers;
        expect(first).toMatchObject({ maxDisplay: 42, name: "halo", underHull: true });
        for (const layer of rest) {
          expect(layer).not.toHaveProperty("underHull");
          expect(layer).not.toHaveProperty("maxDisplay");
        }
      }
    }
    const craft = { ...art, engineLevels: undefined, layers: art.engineLevels[0]!.layers };
    expect(readShipJets(craft)!.layers[0]).toMatchObject({ maxDisplay: 42, underHull: true });
    const drawnOver = { ...art.engineLevels[0]!.layers[0]!, underHull: false };
    expect(readLevelLayers([{ layers: [drawnOver], level: 1 }])![0]![0]!.underHull).toBe(false);
  });

  it("draws the halo at the 42 px flight size and not on larger frames", () => {
    for (const source of [jets, engineJets(retro, 3)]) {
      const at42 = jetPlumes(source, size(42), 17, 1);
      expect(at42.filter(({ underHull }) => underHull)).toHaveLength(2);
      expect(at42).toHaveLength(2 * source.layers.length);
      for (const side of [43, 112, 280]) {
        const plumes = jetPlumes(source, size(side), 17, 1);
        expect(plumes.some(({ underHull }) => underHull)).toBe(false);
        expect(plumes).toHaveLength(2 * (source.layers.length - 1));
      }
      // The larger of the two display sides decides.
      const tall = { ...size(42), displayHeight: 50 };
      expect(jetPlumes(source, tall, 17, 1).some(({ underHull }) => underHull)).toBe(false);
      expect(jetTriangles(source, size(42), 17, 1).some(({ underHull }) => underHull)).toBe(true);
      expect(jetTriangles(source, size(280), 17, 1).some(({ underHull }) => underHull)).toBe(false);
    }
  });

  it("splits the layers into the under-hull pass and the rest, geometry unchanged", () => {
    const under = jetLayerPass(true, jets);
    const rest = jetLayerPass(false, jets);
    expect(under.layers).toEqual([halo]);
    expect(rest.layers).toEqual([outer, core]);
    expect({ ...under, layers: [] }).toEqual({ ...jets, layers: [] });
    expect(jetPlumes(rest, size(42), 5, 1)).toEqual(
      jetPlumes(jets, size(42), 5, 1).filter(({ underHull }) => !underHull),
    );
  });

  it("keeps the non-halo layers' front or behind order at every heading", () => {
    for (const file of [ada, retro]) {
      const selected = engineJets(file, 1);
      const rest = jetLayerPass(false, selected);
      for (let heading = 0; heading < SHIP_HEADINGS; heading++) {
        expect(jetsInFront(rest, heading)).toBe(jetsInFront(selected, heading));
      }
    }
    expect(Array.from({ length: SHIP_HEADINGS }, (_, h) => jetsInFront(jets, h))).toEqual(
      Array.from({ length: SHIP_HEADINGS }, () => true),
    );
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
    expect(jets.headings.every((mouths) => mouths.every((m) => m.occluders !== undefined))).toBe(
      true,
    );
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
    // Mouth 0: its halo, outer and core share its occluders; mouth 1 has none.
    expect(plumes[0]!.occluders).toEqual([expected]);
    expect(plumes[1]!.occluders).toBe(plumes[0]!.occluders);
    expect(plumes[2]!.occluders).toBe(plumes[0]!.occluders);
    expect(plumes[3]).not.toHaveProperty("occluders");
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

  // Art's headings where one mouth has an empty occluders list: no hull surface is nearer than
  // that plume, so it still draws in front.
  it.each([30, 31, 49, 50])(
    "draws heading %i's plumes in front where a mouth has no nearer hull surface",
    (heading) => {
      const mouths = art.headings.find(({ index }) => index === heading)!.mouths;
      expect(mouths.some(({ occluders }) => occluders.length === 0)).toBe(true);
      expect(jetsInFront(jets, heading)).toBe(true);
    },
  );

  it("draws in front with an empty occluders list and behind when a mouth lacks the list", () => {
    const lists = (occluders: readonly unknown[]) =>
      readEngineJets(
        withHeading({
          ...art.headings[0],
          mouths: art.headings[0]!.mouths.map(({ anchor, axis, half }, index) => ({
            anchor,
            axis,
            half,
            occluders: occluders[index],
          })),
        }),
      );
    expect(jetsInFront(lists([[], [polygon]]), 0)).toBe(true);
    expect(jetsInFront(lists([[], []]), 0)).toBe(true);
    // Mouth 1 has no list.
    expect(jetsInFront(readEngineJets(masked([])), 0)).toBe(false);
  });
});

describe("jet interpolation", () => {
  it.each([
    [0.25, 7.5, 0x73a9d9, 0xa9d3f4],
    [0.5, 12, 0x8ac0e6, 0xc6e2f8],
    [0.75, 19.5, 0xa2d6f2, 0xe2f0fb],
    [1, 30, 0xb9ecff, 0xffffff],
  ])("at f = %s has length %s, outer %s and core %s, all opaque", (f, length, out, inner) => {
    expect(jetLength(jets, f)).toBeCloseTo(length);
    expect(layerColor(halo!, f)).toBe(color(JET_LEVELS[0].halo[0]));
    expect(layerColor(outer!, f)).toBe(out);
    expect(layerColor(core!, f)).toBe(inner);
    for (const layer of jets.layers) {
      expect(layerAlpha(layer, f)).toBe(1);
    }
  });

  it("reaches each layer's tip at its multiple of the jet length", () => {
    const length = JET_LENGTH.base + JET_LENGTH.scale;
    const plumes = jetPlumes(single, framePixels, 0, 1);
    expect(plumes).toHaveLength(SHAPES.length);
    plumes.forEach((plume, layer) =>
      expect(Math.max(...plume.points.map(({ y }) => y)) - 60).toBeCloseTo(
        length * SHAPES[layer]!.length,
      ),
    );
  });
});

describe("jets by Engine level", () => {
  it.each(JET_LEVELS)(
    "draws engine $level in the canonical palette with unchanged layer geometry",
    ({ core: coreColors, halo: haloColors, level, outer: outerColors }) => {
      const { layers } = engineJets(ada, level);
      expect(layers.map(({ colors }) => colors)).toEqual([
        haloColors.map(color),
        outerColors.map(color),
        coreColors.map(color),
      ]);
      expect(layers.map(({ length, width }) => [length, width])).toEqual(
        SHAPES.map(({ length, width }) => [length, width]),
      );
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

  it("orders halo, outer then core per mouth, in their interpolated colours", () => {
    const plumes = jetPlumes(ungated(jets), framePixels, 3, 1);
    const one = [
      [color(JET_LEVELS[0].halo[1]), 1],
      [color(JET_LEVELS[0].outer[1]), 1],
      [color(JET_LEVELS[0].core[1]), 1],
    ];
    expect(plumes.map(({ alpha, color }) => [color, alpha])).toEqual([...one, ...one]);
  });

  it("matches Art's plume outline for every heading, mouth and layer", () => {
    for (const f of [0.3, 1]) {
      const length = artJetLength(art.length, f);
      jets.headings.forEach((mouths, heading) => {
        const plumes = jetPlumes(ungated(jets), framePixels, heading, f);
        expect(plumes).toHaveLength(mouths.length * SHAPES.length);
        mouths.forEach((_, index) => {
          const { anchor, axis, half } = art.headings[heading]!.mouths[index]!;
          for (const [layer, shape] of SHAPES.entries()) {
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
            const actual = plumes[index * SHAPES.length + layer]!.points;
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
    const [, outerPlume] = jetPlumes(single, framePixels, 0, 0.5);
    // Jet length 12 at f = 0.5: the outer layer's samples from its root along one side.
    const length = 12 * JET_SHAPE.outer.length;
    const { width } = JET_SHAPE.outer;
    expect(flat(outerPlume!.points.slice(0, 3))).toEqual(
      JET_PROFILE.slice(0, 3)
        .flatMap(([along, across]) => [50 + width * across, 60 + length * along])
        .map((value) => expect.closeTo(value, 9)),
    );
    expect(outerPlume!.points[5]).toEqual({ x: 50, y: 60 + length });
    expect(outerPlume!.points.at(-1)!.x).toBeCloseTo(50 - width * JET_PROFILE[0][1]);
  });

  it("maps frame pixels into the 42px display relative to the sprite origin", () => {
    const [, outerPlume] = jetPlumes(single, shipDisplay, 0, 0.5);
    const scale = 42 / 96;
    const root = 50 + JET_SHAPE.outer.width * JET_PROFILE[0][1];
    expect(outerPlume!.points[0]!.x).toBeCloseTo((root - 48) * scale);
    expect(outerPlume!.points[5]!.y).toBeCloseTo((60 + 12 * JET_SHAPE.outer.length - 48) * scale);
  });

  it("draws one triangle per layer for a craft file without a profile", () => {
    const { frame, headings, layers, length } = single;
    const triangle: ShipJets = { frame, headings, layers, length };
    const triangles = jetTriangles(triangle, framePixels, 0, 0.5);
    expect(triangles).toHaveLength(SHAPES.length);
    // Each layer: one mouth side, the tip at its share of jet length 12, the other mouth side.
    triangles.forEach(({ points }, layer) => {
      const { length, width } = SHAPES[layer]!;
      flat(points).forEach((value, at) =>
        expect(value).toBeCloseTo([50 + width, 60, 50, 60 + 12 * length, 50 - width, 60][at]!),
      );
    });
  });

  it("matches the current canonical producer mouth geometry at every heading", () => {
    expect(jets.frame).toBe(FRAME);
    expect(jets.headings).toHaveLength(ART_SHIP_HEADINGS);
    jets.headings.forEach((mouths, heading) => {
      expect(mouths).toHaveLength(2);
      forwardJetMouthGeometry(FRAME / 2, { yaw: heading }).forEach((mouth, index) => {
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
