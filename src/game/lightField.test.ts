import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { GALAXY_ID, GALAXY_NUMBERS } from "../data/galaxies.ts";
import {
  alphaTopRow,
  blastEdges,
  foregroundEdge,
  inkEdges,
  KEYLINE_ALPHA,
  keylineOffsets,
  keylineWidth,
  LIGHT_FIELD,
  lightGalaxy,
  readForegroundEdges,
  readLightField,
  readLightGalaxies,
  thresholdSilhouette,
} from "./lightField.ts";
import { layerColor } from "./shipJets.ts";
import {
  AMBER_BEAM_GLOW,
  beam,
  beamKeys,
  blast,
  EFFECT_COLOURS,
  type EffectShape,
  glowingBeam,
} from "./weaponEffects.ts";

const galaxies: unknown = JSON.parse(
  readFileSync(new URL("../../public/art/galaxies.json", import.meta.url), "utf8"),
);
const INK = 0x181425;

describe("light-field rule", () => {
  it("reads Art's lightField: ink keylines, edges, strokes and dark jets", () => {
    expect(LIGHT_FIELD).toMatchObject({
      effects: ["missile", "blastRing", "blastFlash", "hitSpark", "destructionShards"],
      holodiskBeacon: "base",
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
    expect(LIGHT_FIELD.phaser).toEqual({
      bloom: { alpha: 0.6, radius: 5 },
      colour: INK,
      edgeAlpha: 0.9,
      glow: { alpha: 0.9, width: [6.5, 4] },
    });
  });

  it("keylines destinations 2 px wide and every other keylined kind 1 px", () => {
    expect(LIGHT_FIELD.destinationKeyline).toEqual({
      kinds: ["station", "outpost", "storyPlace"],
      width: 2,
    });
    expect(
      ["station", "outpost", "storyPlace"].map((kind) => keylineWidth(LIGHT_FIELD, kind)),
    ).toEqual([2, 2, 2]);
    expect(keylineWidth(LIGHT_FIELD, "ship")).toBe(1);
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
    // The base field the previews capture locked galaxies on lists no galaxy, so none is light.
    expect(lightGalaxy(readLightGalaxies({ galaxies: {} }), 1)).toBe(false);
  });

  it("selects an explicit white edge without classifying Phantom as a light field", () => {
    const data = {
      galaxies: {
        andromeda: { tint: { light: true } },
        phantom: { foregroundEdge: "#FFFFFF" },
      },
      version: 1,
    };
    const light = readLightGalaxies(data);
    const edges = readForegroundEdges(data);
    expect(lightGalaxy(light, 6)).toBe(false);
    expect(foregroundEdge(light, edges, 6)).toBe(0xffffff);
    expect(foregroundEdge(light, edges, 5)).toBe(INK);
    expect(foregroundEdge(light, edges, undefined)).toBeUndefined();
    expect(foregroundEdge(light, edges, null)).toBeUndefined();
    expect(foregroundEdge(light, edges, 2)).toBeUndefined();
  });

  it("keeps legacy treatment for absent or malformed optional edge colors", () => {
    const data = {
      galaxies: {
        phantom: { foregroundEdge: "#fff" },
        sunflower: { foregroundEdge: "invalid", tint: { light: true } },
        unknown: { foregroundEdge: "#FFFFFF" },
      },
      version: 1,
    };
    const edges = readForegroundEdges(data);
    expect(edges.size).toBe(0);
    expect(foregroundEdge(readLightGalaxies(data), edges, 1)).toBe(INK);
    expect(foregroundEdge(readLightGalaxies(data), edges, 6)).toBeUndefined();
    expect(readForegroundEdges(null).size).toBe(0);
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
    expect(readLightField(null)).toBeUndefined();
    expect(readLightGalaxies(null).size).toBe(0);
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
    thresholdSilhouette(INK, KEYLINE_ALPHA, pixels);
    expect([...pixels]).toEqual([
      0x18, 0x14, 0x25, 0, 0x18, 0x14, 0x25, 0, 0x18, 0x14, 0x25, 255, 0x18, 0x14, 0x25, 255,
    ]);
  });

  it("edges a blast's ring stroke and its flash's outline in ink, never the tint fill", () => {
    const at = { x: 0, y: 0 };
    const shapes = blast(at, 60, false, 10);
    const tint = shapes[0]!;
    const ring = shapes.find((shape) => shape.kind === "ellipse" && shape.part === "ring")!;
    const flash = shapes.filter((shape) => shape.kind === "ellipse" && shape.part === "flash");
    expect(tint).toMatchObject({ kind: "ellipse" });
    expect(tint).not.toHaveProperty("stroke");
    expect(flash).toHaveLength(4);
    const outer = flash[0]!;
    expect(blastEdges(INK, 1, shapes)).toEqual([
      { ...ring, colour: INK, stroke: (ring as { stroke: number }).stroke + 2 },
      {
        ...outer,
        colour: INK,
        halfHeight: (outer as { halfHeight: number }).halfHeight + 0.5,
        halfWidth: (outer as { halfWidth: number }).halfWidth + 0.5,
        stroke: 1,
      },
    ]);
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

  it("turns the Phaser's amber glow and outer bloom to ink, leaving body and core", () => {
    const from = { x: 0, y: 0 };
    const to = { x: 100, y: 0 };
    const t = 40;
    const { a, w } = beamKeys(t);
    const dark = beam(from, to, true, false, t);
    const light = glowingBeam(LIGHT_FIELD.phaser, from, to, true, false, t);
    expect(dark).toEqual(glowingBeam(AMBER_BEAM_GLOW, from, to, true, false, t));
    expect(light).toHaveLength(dark.length);
    // The glow layer: a start cap, a taper and an end cap.
    const glow = light.slice(0, 3);
    expect(glow.every((shape) => shape.colour === INK)).toBe(true);
    expect(glow[1]).toMatchObject({
      head: { alpha: 0.9 * a, width: 6 * w },
      kind: "taper",
      tail: { alpha: 0.9 * a, width: 9.75 * w },
    });
    const bloom = light.at(-3);
    expect(bloom).toEqual({ alpha: 0.6 * a, at: from, colour: INK, kind: "disc", radius: 5 * w });
    expect(light.slice(3, -3)).toEqual(dark.slice(3, -3));
    expect(light.slice(-2)).toEqual(dark.slice(-2));
    expect(dark[0]!.colour).toBe(EFFECT_COLOURS.amber);
  });

  it("draws the reduced-motion beam's 12 px edge in ink at 0.9", () => {
    const from = { x: 0, y: 0 };
    const to = { x: 100, y: 0 };
    const [edge, ...rest] = glowingBeam(LIGHT_FIELD.phaser, from, to, true, true, 0);
    expect(edge).toMatchObject({
      colour: INK,
      head: { alpha: 0.9, width: 12 },
      kind: "taper",
      tail: { alpha: 0.9, width: 12 },
    });
    expect(rest).toEqual(beam(from, to, true, true, 0).slice(1));
  });
});
