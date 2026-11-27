import { describe, expect, it } from "vitest";

import data from "../../public/art/ship-jets.json";
import { AUTHORED_JET_LENGTH, jetTriangles, readEngineJets, staticShipJets } from "../art/index.ts";
import { LIGHT_FIELD } from "./lightField.ts";

const main = readEngineJets(data)!;

describe("static travel jet selection", () => {
  it("selects each Engine level at the authored static length", () => {
    for (const level of [1, 2, 3]) {
      const jets = staticShipJets(main, undefined, level)!;
      expect(jets.layers).toEqual(main.engineLevels[level - 1]);
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

  it("recolours a light field's plumes from its field levels and keeps the plume shape", () => {
    for (const level of [1, 2, 3]) {
      const own = main.engineLevels[level - 1]!;
      const field = LIGHT_FIELD.jets.shipLevels[level - 1]!;
      const jets = staticShipJets(main, LIGHT_FIELD.jets.shipLevels, level)!;
      expect(jets.layers).toEqual(
        own.map((layer) => ({
          ...layer,
          colors: field.find(({ name }) => name === layer.name)!.colors,
        })),
      );
      expect(jets.profile).toBe(main.profile);
    }
    expect(staticShipJets(undefined, LIGHT_FIELD.jets.shipLevels, 3)).toBeUndefined();
  });
});
