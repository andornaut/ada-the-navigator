import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { blinkRow, readBeaconArt } from "../art/index.ts";
import { beam, beamKeys, blast, EFFECT_COLOURS, type EffectShape } from "../art/weaponEffects.ts";
import { GALAXY_ID, GALAXY_NUMBERS } from "../data/galaxies.ts";
import { ART_MANIFEST } from "../testing/publicArt.ts";
import {
  alphaTopRow,
  blastEdges,
  foregroundEdge,
  inkEdges,
  joinsJets,
  KEYLINE_ALPHA,
  keylineOffsets,
  keylineWidth,
  LIGHT_FIELD,
  lightGalaxy,
  readLightField,
  readLightGalaxies,
  thresholdSilhouette,
} from "./lightField.ts";
import { layerColor } from "./shipJets.ts";

const galaxies: unknown = JSON.parse(
  readFileSync(new URL("../../public/art/galaxies.json", import.meta.url), "utf8"),
);
const INK = 0x181425;

describe("light-field rule", () => {
  it("reads Art's lightField: ink keylines, edges, strokes and dark jets", () => {
    expect(LIGHT_FIELD).toMatchObject({
      effects: ["missile", "blastRing", "blastFlash", "hitSpark", "destructionShards", "towClamp"],
      // The row a light field holds the beacon on: its A row, as reduced motion does.
      holodiskBeacon: blinkRow(readBeaconArt(ART_MANIFEST.assets)!, true, 0).id,
      hudOutline: 1,
      indicatorStroke: 4,
      ink: INK,
      keyline: 1,
      markerOutline: 1,
      shotEdge: 1,
    });
    expect(LIGHT_FIELD.keylined).toEqual(
      expect.arrayContaining([
        "ship",
        "fighter",
        "asteroid",
        "stardust",
        "upgradePickup",
        "ammoPickup",
      ]),
    );
    // Field materials consume the canonical per-engine data without a local palette copy.
    const source = (
      galaxies as {
        lightField: {
          jets: {
            shipLevels: {
              level: number;
              layers: { name?: string; color?: string; colors?: [string, string] }[];
            }[];
          };
        };
      }
    ).lightField.jets.shipLevels;
    const color = (value: string) => Number.parseInt(value.slice(1), 16);
    expect(
      LIGHT_FIELD.jets.shipLevels.map((layers) =>
        layers.flatMap((layer) => [layerColor(layer, 0), layerColor(layer, 1)]),
      ),
    ).toEqual(
      source.map(({ layers }) =>
        layers.flatMap((layer) =>
          layer.color ? [color(layer.color), color(layer.color)] : layer.colors!.map(color),
        ),
      ),
    );
    expect(LIGHT_FIELD.jets.enemy.map((layer) => layerColor(layer, 1))).toEqual([
      0x7f4b3d, 0xd68b72,
    ]);
    expect(LIGHT_FIELD.phaser).toEqual({ edge: 1 });
  });

  it("keylines destinations 2 px, Ada 0.5 px and other keylined kinds 1 px", () => {
    expect(LIGHT_FIELD.destinationKeyline).toEqual({
      kinds: ["station", "outpost", "storyPlace"],
      width: 2,
    });
    expect(
      ["station", "outpost", "storyPlace"].map((kind) => keylineWidth(LIGHT_FIELD, kind)),
    ).toEqual([2, 2, 2]);
    expect(keylineWidth(LIGHT_FIELD, "ship")).toBe(0.5);
    expect(keylineWidth({ ...LIGHT_FIELD, keyline: 2 }, "ship")).toBe(1);
    expect(keylineWidth(LIGHT_FIELD, "discoveryCache")).toBe(1);
    expect(keylineOffsets(2).every(({ x, y }) => Math.max(Math.abs(x), Math.abs(y)) === 2)).toBe(
      true,
    );
  });

  it("finds a frame's topmost row at alpha 0.5 or more", () => {
    const data = new Uint8ClampedArray(4 * 3 * 4);
    // Row 1 holds alpha 127, under 0.5; row 2 holds 128.
    data[4 * (1 * 3 + 2) + 3] = 127;
    data[4 * (2 * 3 + 0) + 3] = 128;
    expect(alphaTopRow(data, 3, 4, KEYLINE_ALPHA)).toBe(2);
    expect(alphaTopRow(new Uint8ClampedArray(4 * 3 * 4), 3, 4, KEYLINE_ALPHA)).toBe(4);
  });

  it("uses canonical per-galaxy light flags and never applies at home", () => {
    const light = readLightGalaxies(galaxies);
    const source = (galaxies as { galaxies: Record<string, { tint: { light: boolean } }> })
      .galaxies;
    const expected = GALAXY_NUMBERS.filter(
      (galaxy) => source[GALAXY_ID[galaxy]]!.tint.light === true,
    );
    expect([...light]).toEqual(expected);
    for (const galaxy of GALAXY_NUMBERS) {
      expect(lightGalaxy(light, galaxy)).toBe(expected.includes(galaxy));
    }
    const mixed = readLightGalaxies({
      galaxies: {
        cartwheel: { tint: { light: false } },
        phantom: { tint: { light: true } },
        sunflower: { tint: { light: true } },
      },
    });
    expect([...mixed]).toEqual([1, 6]);
    expect(lightGalaxy(mixed, 2)).toBe(false);
    expect([
      ...readLightGalaxies({ galaxies: { sunflower: { tint: { light: "true" } } } }),
    ]).toEqual([]);
    expect(lightGalaxy(light, null)).toBe(false);
    expect(lightGalaxy(light, undefined)).toBe(false);
    // A field that lists no galaxy has no light galaxy.
    expect(lightGalaxy(readLightGalaxies({ galaxies: {} }), 1)).toBe(false);
  });

  it("edges every galaxy in ink, Phantom's dark field too, and home in none", () => {
    for (const galaxy of GALAXY_NUMBERS) {
      expect([galaxy, foregroundEdge(galaxy)]).toEqual([galaxy, INK]);
    }
    expect(lightGalaxy(readLightGalaxies(galaxies), 6)).toBe(false);
    expect(foregroundEdge(undefined)).toBeUndefined();
    expect(foregroundEdge(null)).toBeUndefined();
  });

  it("reads no rule from malformed data", () => {
    const rule = (galaxies as { lightField: Record<string, unknown> }).lightField;
    expect(readLightField({ lightField: { ...rule, ink: "ink" } })).toBeUndefined();
    const jets = rule.jets as Record<string, unknown>;
    expect(
      readLightField({ lightField: { ...rule, jets: { ...jets, shipLevels: [] } } }),
    ).toBeUndefined();
    expect(readLightField({ lightField: { ...rule, keyline: 0 } })).toBeUndefined();
    expect(readLightField({ lightField: { ...rule, markerOutline: 0 } })).toBeUndefined();
    expect(
      readLightField({ lightField: { ...rule, destinationKeyline: { kinds: [], width: 0 } } }),
    ).toBeUndefined();
    expect(
      readLightField({ lightField: { ...rule, jetKeyline: { exempt: ["ship"] } } }),
    ).toBeUndefined();
    expect(readLightField(null)).toBeUndefined();
    expect(readLightGalaxies(null).size).toBe(0);
  });

  it("joins every keylined craft's jets to its keyline but Ada's", () => {
    expect(LIGHT_FIELD.jetKeyline).toEqual({ exempt: ["ship"], join: true });
    for (const kind of ["fighter", "frigate", "capital", "archie", "platform", "storyCraft"]) {
      expect(joinsJets(LIGHT_FIELD, kind), kind).toBe(true);
    }
    expect(joinsJets(LIGHT_FIELD, "ship")).toBe(false);
    expect(joinsJets(LIGHT_FIELD, "holodiskBeacon")).toBe(false);
    expect(joinsJets({ ...LIGHT_FIELD, jetKeyline: { exempt: [], join: false } }, "fighter")).toBe(
      false,
    );
  });

  it("grows a keyline by a square kernel: eight unit offsets", () => {
    const offsets = keylineOffsets(1);
    expect(offsets).toHaveLength(8);
    expect(new Set(offsets.map(({ x, y }) => `${x},${y}`)).size).toBe(8);
    expect(offsets.every(({ x, y }) => Math.max(Math.abs(x), Math.abs(y)) === 1)).toBe(true);
  });

  it("cuts the keyline source at alpha 0.5 into opaque ink, so the grown edge is crisp", () => {
    expect(KEYLINE_ALPHA).toBe(0.5);
    // Four pixels: clear, just under the cut, at the cut and opaque.
    const pixels = new Uint8ClampedArray([
      255, 255, 255, 0, 10, 200, 30, 127, 10, 200, 30, 128, 1, 2, 3, 255,
    ]);
    expect(thresholdSilhouette(INK, KEYLINE_ALPHA, { data: pixels, height: 1, width: 4 })).toEqual({
      height: 1,
      width: 3,
      x: 1,
      y: 0,
    });
    expect([...pixels]).toEqual([
      0x18, 0x14, 0x25, 0, 0x18, 0x14, 0x25, 0, 0x18, 0x14, 0x25, 255, 0x18, 0x14, 0x25, 255,
    ]);
  });

  it("keeps one transparent texel around a solid pixel and handles an empty mask", () => {
    const data = new Uint8ClampedArray(7 * 5 * 4);
    const image = { data, height: 5, width: 7 };
    expect(thresholdSilhouette(INK, KEYLINE_ALPHA, image)).toEqual({
      height: 1,
      width: 1,
      x: 0,
      y: 0,
    });
    data[(2 * 7 + 4) * 4 + 3] = 255;
    expect(thresholdSilhouette(INK, KEYLINE_ALPHA, image)).toEqual({
      height: 3,
      width: 3,
      x: 3,
      y: 1,
    });
  });

  it("edges a blast's ring stroke and its outer flash burst in ink, never the debris", () => {
    const at = { x: 0, y: 0 };
    const shapes = blast(at, 60, false, 10);
    const ring = shapes.find((shape) => shape.kind === "ellipse" && shape.part === "ring")!;
    const flash = shapes.filter((shape) => shape.kind === "polygon" && shape.part === "flash");
    expect(flash).toHaveLength(2);
    expect(shapes.some((shape) => shape.kind === "polygon" && shape.part === undefined)).toBe(true);
    expect(blastEdges(INK, 1, shapes)).toEqual(inkEdges(INK, 1, [ring, flash[0]!]));
    expect(blastEdges(INK, 1, shapes)[0]).toEqual({
      ...ring,
      colour: INK,
      stroke: (ring as { stroke: number }).stroke + 2,
    });
    // After the flash, and under reduced motion, only the ring takes an edge.
    expect(blastEdges(INK, 1, blast(at, 60, false, 150))).toHaveLength(1);
    expect(blastEdges(INK, 1, blast(at, 60, true, 10))).toEqual([
      expect.objectContaining({ colour: INK, part: "ring" }),
    ]);
  });

  it("edges each effect shape in ink at its own alpha: strokes 2 wider, fills grown by 1", () => {
    const at = { x: 10, y: 20 };
    const shapes: EffectShape[] = [
      { alpha: 0.5, at, colour: 0xf0bd68, kind: "disc", radius: 3 },
      { alpha: 0.4, at, colour: 0xf0bd68, halfHeight: 4, halfWidth: 8, kind: "ellipse" },
      { alpha: 0.9, at, colour: 0xf0bd68, halfHeight: 4, halfWidth: 8, kind: "ellipse", stroke: 2 },
      {
        alpha: 1,
        colour: 0xead4aa,
        from: at,
        kind: "line",
        round: true,
        to: { x: 16, y: 20 },
        width: 1.5,
      },
    ];
    expect(inkEdges(INK, 1, shapes)).toEqual([
      { alpha: 0.5, at, colour: INK, kind: "disc", radius: 4 },
      { alpha: 0.4, at, colour: INK, halfHeight: 5, halfWidth: 9, kind: "ellipse" },
      { alpha: 0.9, at, colour: INK, halfHeight: 4, halfWidth: 8, kind: "ellipse", stroke: 4 },
      { ...shapes[3], colour: INK, width: 3.5 },
    ]);
  });

  it("grows a polygon by stroking its edges 2 wide, and lengthens a taper by 1 at each end", () => {
    const triangle = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 0, y: 4 },
    ];
    const edges = inkEdges(INK, 1, [
      { alpha: 0.7, colour: 0xd68b72, kind: "polygon", points: triangle },
    ]);
    expect(edges[0]).toEqual({ alpha: 0.7, colour: INK, kind: "polygon", points: triangle });
    expect(edges.slice(1)).toEqual(
      triangle.map((from, index) => ({
        alpha: 0.7,
        colour: INK,
        from,
        kind: "line",
        round: true,
        to: triangle[(index + 1) % 3],
        width: 2,
      })),
    );
    const [taper] = inkEdges(INK, 1, [
      {
        colour: 0xf0bd68,
        head: { alpha: 1, at: { x: 10, y: 0 }, width: 2 },
        kind: "taper",
        tail: { alpha: 0, at: { x: 0, y: 0 }, width: 0.5 },
      },
    ]);
    expect(taper).toEqual({
      colour: INK,
      head: { alpha: 1, at: { x: 11, y: 0 }, width: 4 },
      kind: "taper",
      tail: { alpha: 0, at: { x: -1, y: 0 }, width: 2.5 },
    });
  });

  it("grows the Phaser's amber band and outer bloom disc by the field edge, at every motion", () => {
    const from = { x: 0, y: 0 };
    const to = { x: 100, y: 0 };
    const { w } = beamKeys(40);
    const full = beam(from, to, true, false, 40);
    // The amber band and the 5 w amber bloom disc take the edge; cream and white take none.
    expect(full.edged).toEqual([full.shapes[0], full.shapes[3]]);
    expect(full.edged.every((shape) => shape.colour === EFFECT_COLOURS.amber)).toBe(true);
    const [band, side] = inkEdges(INK, LIGHT_FIELD.phaser.edge, full.edged);
    expect(band).toMatchObject({ colour: INK, kind: "polygon" });
    expect(inkEdges(INK, LIGHT_FIELD.phaser.edge, full.edged).at(-1)).toEqual({
      ...full.shapes[3],
      colour: INK,
      radius: 5 * w + 1,
    });
    expect(side).toMatchObject({ colour: INK, kind: "line", width: 2 });
    // Reduced motion keeps the edge on its amber band and draws no bloom.
    const still = beam(from, to, true, true, 0);
    expect(still.edged).toEqual([still.shapes[0]]);
    expect(still.shapes.some((shape) => shape.kind === "disc")).toBe(false);
  });
});
