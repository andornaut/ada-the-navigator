import { describe, expect, it } from "vitest";

import mainArt from "../../public/art/ship-jets.json";
import reverseArt from "../../public/art/ship-retro-jets.json";
import { drawShipJets } from "../ui/shipJetCanvas.ts";
import { LIGHT_FIELD } from "./lightField.ts";
import {
  jetTriangles,
  layerColor,
  readEngineJets,
  SMALL_JET_CORE_MAX_DISPLAY,
  travelJets,
} from "./shipJets.ts";
import { staticShipJets } from "./staticShipJets.ts";

const main = readEngineJets(mainArt)!;
const reverse = readEngineJets(reverseArt)!;
const display = (size: number) => ({
  displayHeight: size,
  displayWidth: size,
  pivot: { x: 0.5, y: 0.5 },
});

describe("small player jet cores", () => {
  it.each(["forward", "reverse"] as const)(
    "omits the derived core and keeps the canonical medium start color for small %s profiles",
    (direction) => {
      expect(SMALL_JET_CORE_MAX_DISPLAY).toBe(42);
      for (const level of [1, 2, 3]) {
        const jets = travelJets(main, reverse, LIGHT_FIELD.jets.shipLevels, level, direction)!;
        const original = structuredClone(jets);
        const core = jets.layers.find((layer) => layer.name === "core")!;
        const outer = main.engineLevels[level - 1]!.find((layer) => layer.name === "outer")!;
        for (const fraction of [0.8, 0.97, 1]) {
          const large = jetTriangles(jets, display(84), 56, fraction);
          const coreColor = layerColor(core, fraction);
          expect(large.some((triangle) => triangle.color === coreColor)).toBe(true);
          expect(
            jetTriangles(jets, display(43), 56, fraction).some(
              (triangle) => triangle.color === coreColor,
            ),
          ).toBe(true);
          for (const size of [24, 42]) {
            const small = jetTriangles(jets, display(size), 56, fraction);
            const retained = large.filter((triangle) => triangle.color !== coreColor);
            expect(small).toHaveLength(retained.length);
            expect(small.some((triangle) => triangle.color === outer.colors[0])).toBe(true);
            small.forEach((triangle, index) => {
              const expected = retained[index]!;
              expect(triangle.color).toBe(
                expected.color === layerColor(outer, fraction) ? outer.colors[0] : expected.color,
              );
              expect(triangle.alpha).toBe(expected.alpha);
              triangle.points.forEach((point, corner) => {
                expect(point.x).toBeCloseTo((expected.points[corner]!.x * size) / 84, 12);
                expect(point.y).toBeCloseTo((expected.points[corner]!.y * size) / 84, 12);
              });
            });
          }
        }
        expect(jetTriangles(jets, display(42), 56, 0)).toEqual([]);
        expect(jets).toEqual(original);
      }
    },
  );

  it("keeps descriptor-absent craft cores at small sizes", () => {
    const legacyMain = {
      ...main,
      headings: main.headings.map((mouths) =>
        mouths.map((mouth) => {
          const copy = { ...mouth };
          delete copy.normalAperture;
          return copy;
        }),
      ),
    };
    const legacyReverse = { ...reverse };
    delete legacyReverse.reverseStyle;
    for (const direction of ["forward", "reverse"] as const) {
      for (const field of [undefined, LIGHT_FIELD.jets.shipLevels]) {
        const jets = travelJets(legacyMain, legacyReverse, field, 1, direction)!;
        const coreColor = layerColor(
          jets.layers.find((layer) => layer.name === "core")!,
          1,
        );
        expect(
          jetTriangles(jets, display(24), 56, 1).some((triangle) => triangle.color === coreColor),
        ).toBe(true);
        expect(
          jetTriangles(jets, display(24), 56, 1).some(
            (triangle) =>
              triangle.color ===
              layerColor(
                jets.layers.find((layer) => layer.name === "outer")!,
                1,
              ),
          ),
        ).toBe(true);
      }
    }
  });

  it("uses the same draw-only rule through static cues and Canvas", () => {
    const jets = staticShipJets(main, LIGHT_FIELD.jets.shipLevels, 1)!;
    const fills: string[] = [];
    const context = {
      beginPath() {},
      closePath() {},
      fill() {
        fills.push(context.fillStyle);
      },
      fillStyle: "",
      globalAlpha: 1,
      lineTo() {},
      moveTo() {},
      restore() {},
      save() {},
    };
    for (const size of [24, 42, 84]) {
      fills.length = 0;
      drawShipJets(context as unknown as CanvasRenderingContext2D, jets, display(size), 56, {
        x: 0,
        y: 0,
      });
      const core = layerColor(
        jets.layers.find((layer) => layer.name === "core")!,
        1,
      );
      expect(fills.includes(`#${core.toString(16).padStart(6, "0")}`)).toBe(size > 42);
      const outer = jets.layers.find((layer) => layer.name === "outer")!;
      const medium = size <= 42 ? outer.colors[0] : layerColor(outer, 1);
      expect(fills).toContain(`#${medium.toString(16).padStart(6, "0")}`);
      expect(fills.length).toBeGreaterThan(0);
    }
  });
});
