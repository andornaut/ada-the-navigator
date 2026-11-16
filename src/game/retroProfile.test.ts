import { describe, expect, it } from "vitest";

import mainArt from "../../public/art/ship-jets.json";
import reverseArt from "../../public/art/ship-retro-jets.json";
import { centeredReverseLayers } from "./jetGeometry.ts";
import { LIGHT_FIELD } from "./lightField.ts";
import {
  engineJets,
  jetLength,
  jetTriangles,
  layerColor,
  levelLayers,
  readEngineJets,
  travelJets,
} from "./shipJets.ts";

const main = readEngineJets(mainArt)!;
const legacyInput = structuredClone(reverseArt);
Reflect.deleteProperty(legacyInput, "reverseStyle");
const legacy = readEngineJets(legacyInput)!;
const display = { displayHeight: 96, displayWidth: 96, pivot: { x: 0, y: 0 } };
function profile() {
  const raw = structuredClone(reverseArt);
  raw.length = { base: 14.85, exponent: 1, scale: 23.1 };
  for (const heading of raw.headings) {
    for (const mouth of heading.mouths) {
      Reflect.deleteProperty(mouth, "coreOutboard");
    }
  }
  const widths = [2.4, 1.85625, 0.928125];
  const lengths = [1.1, 1, 0.55];
  for (const level of raw.engineLevels) {
    level.layers.forEach((layer, i) => {
      layer.width = widths[i]!;
      layer.length = lengths[i]!;
    });
  }
  return { ...raw, reverseStyle: "centered-main" };
}

describe("explicit centered reverse material", () => {
  it("parses only the explicit descriptor with compatible centered clipped roots", () => {
    expect(readEngineJets(profile())?.reverseStyle).toBe("centered-main");
    for (const reverseStyle of [null, {}, true, "normal", ""]) {
      expect(readEngineJets({ ...profile(), reverseStyle })).toBeUndefined();
    }
    const mixed = profile();
    Reflect.set(mixed.headings[0]!.mouths[0]!, "coreOutboard", true);
    expect(readEngineJets(mixed)).toBeUndefined();
    const normal = profile();
    Reflect.set(normal.headings[0]!.mouths[0]!, "normalAperture", { coreWidth: 0.4 });
    expect(readEngineJets(normal)).toBeUndefined();
    const missing = profile();
    Reflect.deleteProperty(missing.headings[0]!.mouths[0]!, "rearClip");
    expect(readEngineJets(missing)).toBeUndefined();
    const malformed = profile();
    malformed.engineLevels[0]!.layers[1]!.width = 0;
    expect(readEngineJets(malformed)).toBeUndefined();
  });

  it("retains all 64 mouth records except the explicitly removed outboard flag", () => {
    const raw = profile();
    const expected = structuredClone(reverseArt.headings);
    for (const heading of expected) {
      for (const mouth of heading.mouths) {
        Reflect.deleteProperty(mouth, "coreOutboard");
      }
    }
    expect(raw.headings).toEqual(expected);
    expect(readEngineJets(raw)!.headings).toHaveLength(64);
  });

  it.each([false, true])(
    "selects canonical main colours and applies authored opaque shapes once (light=%s)",
    (light) => {
      const reverse = readEngineJets(profile())!;
      for (const level of [1, 2, 3]) {
        const selected = levelLayers(main.engineLevels, level);
        const forward = levelLayers(main.engineLevels, level);
        const jets = travelJets(
          main,
          reverse,
          light ? LIGHT_FIELD.jets.shipLevels : undefined,
          level,
          "reverse",
        )!;
        expect(jets.layers.map((layer) => layer.width)).toEqual([2.4, 1.85625, 0.928125]);
        expect(jets.layers.map((layer) => layer.length)).toEqual([1.1, 1, 0.55]);
        expect(jets.layers.every((layer) => layer.alpha === undefined)).toBe(true);
        for (const f of [0.25, 0.5, 1]) {
          expect(jetLength(jets, f)).toBeCloseTo(33 * (0.45 + 0.7 * f), 12);
          const mouth = jets.headings[52]![0]!;
          const unclippedMouth = { ...mouth };
          Reflect.deleteProperty(unclippedMouth, "rearClip");
          const unclipped = { ...jets, headings: [[unclippedMouth]] };
          jetTriangles(unclipped, display, 0, f).forEach((triangle, i) => {
            const layer = jets.layers[i]!;
            const anchor = {
              x: mouth.outerCorner!.x - mouth.half.x * jets.layers[0]!.width,
              y: mouth.outerCorner!.y - mouth.half.y * jets.layers[0]!.width,
            };
            expect(triangle.points[1].x).toBeCloseTo(
              anchor.x + mouth.axis.x * jetLength(jets, f) * layer.length,
              12,
            );
            expect(triangle.points[1].y).toBeCloseTo(
              anchor.y + mouth.axis.y * jetLength(jets, f) * layer.length,
              12,
            );
          });
          const triangles = jetTriangles(jets, display, 52, f);
          expect(triangles.length).toBeGreaterThanOrEqual(6);
          expect(triangles.every((triangle) => triangle.alpha === 1)).toBe(true);
          const palette = [
            forward.find((layer) => layer.normalColor !== undefined)!.normalColor!,
            layerColor(
              selected.find((layer) => layer.name === "outer")!,
              f,
            ),
            layerColor(
              selected.find((layer) => layer.name === "core")!,
              f,
            ),
          ];
          expect(new Set(triangles.map((triangle) => triangle.color))).toEqual(new Set(palette));
          for (const heading of jets.headings) {
            for (const mouth of heading) {
              const clip = mouth.rearClip!;
              // All clipped output stays on the authored retained side.
              for (const triangle of jetTriangles(
                { ...jets, headings: [[mouth]] },
                display,
                0,
                f,
              )) {
                for (const point of triangle.points) {
                  expect(
                    point.x * clip.normal.x + point.y * clip.normal.y - clip.constant,
                  ).toBeLessThanOrEqual(1e-10);
                }
              }
            }
          }
        }
        expect(jetTriangles(jets, display, 52, 0)).toEqual([]);
      }
    },
  );

  it("leaves descriptor-absent reverse and all forward selection byte-identical", () => {
    expect(legacy).not.toHaveProperty("reverseStyle");
    for (const level of [1, 2, 3]) {
      for (const field of [undefined, LIGHT_FIELD.jets.shipLevels]) {
        const expected = {
          ...engineJets(legacy, level),
          layers: levelLayers(field ?? main.engineLevels, level),
        };
        const actual = travelJets(main, legacy, field, level, "reverse")!;
        expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
        for (const heading of [0, 8, 16, 24, 32, 40, 48, 52, 56, 63]) {
          for (const f of [0, 0.25, 0.5, 1]) {
            expect(JSON.stringify(jetTriangles(actual, display, heading, f))).toBe(
              JSON.stringify(jetTriangles(expected, display, heading, f)),
            );
          }
        }
        const reverse = readEngineJets(profile())!;
        expect(travelJets(main, reverse, field, level, "forward")).toEqual(
          travelJets(main, legacy, field, level, "forward"),
        );
        expect(travelJets(main, undefined, field, level, "reverse")).toBeUndefined();
      }
    }
  });

  it("keeps explicit normal material field-independent and legacy forward material field-selected", () => {
    const oldMain = {
      ...main,
      headings: main.headings.map((mouths) =>
        mouths.map((mouth) => {
          const copy = { ...mouth };
          delete copy.normalAperture;
          return copy;
        }),
      ),
    };
    for (const level of [1, 2, 3]) {
      const dark = travelJets(main, legacy, undefined, level, "forward")!;
      const light = travelJets(main, legacy, LIGHT_FIELD.jets.shipLevels, level, "forward")!;
      expect(light).toEqual(dark);
      expect(light.layers).toEqual(levelLayers(main.engineLevels, level));
      for (const heading of [32, 40]) {
        for (const fraction of [0, 0.8, 0.97, 1]) {
          expect(jetTriangles(light, display, heading, fraction)).toEqual(
            jetTriangles(dark, display, heading, fraction),
          );
        }
      }
      expect(
        travelJets(oldMain, legacy, LIGHT_FIELD.jets.shipLevels, level, "forward")!.layers,
      ).toEqual(levelLayers(LIGHT_FIELD.jets.shipLevels, level));
    }
  });

  it("fails closed without required canonical material and supports pure string colour consumers", () => {
    const shapes = readEngineJets(profile())!.engineLevels[0]!;
    expect(centeredReverseLayers([], shapes, shapes)).toBeUndefined();
    expect(
      centeredReverseLayers([{ ...shapes[0]!, normalColor: 0 }], shapes, shapes)![0]!.colors,
    ).toEqual([0, 0]);
    const result = centeredReverseLayers(
      [{ ...shapes[0]!, colors: ["unused", "unused"], normalColor: "canonical-dark" }],
      [
        { ...shapes[1]!, colors: ["medium0", "medium1"] },
        { ...shapes[2]!, colors: ["core0", "core1"] },
      ],
      shapes,
    )!;
    expect(result.map((layer) => layer.colors)).toEqual([
      ["canonical-dark", "canonical-dark"],
      ["medium0", "medium1"],
      ["core0", "core1"],
    ]);
  });
});
