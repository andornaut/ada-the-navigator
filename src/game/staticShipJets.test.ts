import { describe, expect, it } from "vitest";

import data from "../../public/art/ship-jets.json";
import { AUTHORED_JET_LENGTH } from "./jetGeometry.ts";
import { LIGHT_FIELD } from "./lightField.ts";
import { jetTriangles, readEngineJets } from "./shipJets.ts";
import { staticShipJets } from "./staticShipJets.ts";

const main = readEngineJets(data)!;

describe("static travel jet selection", () => {
  it("selects each canonical engine material by object identity without changing the flight curve", () => {
    for (const level of [1, 2, 3]) {
      const jets = staticShipJets(main, undefined, level)!;
      expect(jets.layers).toBe(main.engineLevels[level - 1]);
      expect(jets.headings).toBe(main.headings);
      const triangles = jetTriangles(
        jets,
        { displayHeight: 42, displayWidth: 42, pivot: { x: 0.5, y: 0.5 } },
        0,
        1,
      );
      expect(triangles.length).toBeGreaterThan(0);
      expect(triangles.every((triangle) => triangle.occluders === undefined)).toBe(true);
      expect(jets.length).toEqual({
        base: AUTHORED_JET_LENGTH,
        exponent: main.length.exponent,
        scale: 0,
      });
    }
    expect(main.length).toEqual({ base: 6, exponent: 2, scale: 24 });
  });

  it("uses the same selected light-field object and disables missing geometry without fixed-blue fallback", () => {
    for (const level of [1, 2, 3]) {
      expect(staticShipJets(main, LIGHT_FIELD.jets.shipLevels, level)?.layers).toBe(
        LIGHT_FIELD.jets.shipLevels[level - 1],
      );
    }
    expect(staticShipJets(undefined, LIGHT_FIELD.jets.shipLevels, 3)).toBeUndefined();
  });
});
