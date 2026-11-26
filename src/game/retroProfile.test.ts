import { describe, expect, it } from "vitest";

import {
  JET_LEVELS,
  JET_PROFILE,
  jetLayers,
  LIGHT_FIELD_JET_LEVELS,
  RETRO_JET,
} from "../../art/tools/ship-jet-layers.ts";
import { jetLength as artJetLength, plumePolygon } from "../../art/tools/ship-plume.ts";
import mainArt from "../../public/art/ship-jets.json";
import reverseArt from "../../public/art/ship-retro-jets.json";
import { LIGHT_FIELD } from "./lightField.ts";
import { jetPlumes, layerColor, readEngineJets, type ShipJets, travelJets } from "./shipJets.ts";

const main = readEngineJets(mainArt)!;
const reverse = readEngineJets(reverseArt)!;
const framePixels = { displayHeight: 96, displayWidth: 96, pivot: { x: 0, y: 0 } };
// Shape checks map frame pixels 1:1 (96 px), past the halo's maxDisplay, so they lift the gate.
const ungated = (source: ShipJets): ShipJets => ({
  ...source,
  layers: source.layers.map((layer) => ({ ...layer, maxDisplay: Infinity })),
});
const color = (value: string) => Number.parseInt(value.slice(1), 16);

describe("reverse plume profile", () => {
  it("draws Art's full teardrop at the reverse widths, with no clip, at every heading", () => {
    const shapes = jetLayers(JET_LEVELS[0], RETRO_JET.width);
    for (const f of [0.2, 1]) {
      const jets = ungated(travelJets(main, reverse, undefined, 1, "reverse")!);
      const length = artJetLength(reverseArt.length, f);
      reverseArt.headings.forEach(({ index, mouths }) => {
        const plumes = jetPlumes(jets, framePixels, index, f);
        expect(plumes).toHaveLength(mouths.length * shapes.length);
        mouths.forEach(({ anchor, axis, half }, mouth) => {
          shapes.forEach((shape, layer) => {
            const expected = plumePolygon(
              JET_PROFILE,
              {
                anchor: anchor as [number, number],
                axis: axis as [number, number],
                half: half as [number, number],
              },
              shape,
              length,
            ).flat();
            const { points } = plumes[mouth * shapes.length + layer]!;
            const actual = points.flatMap(({ x, y }) => [x, y]);
            expect(actual).toHaveLength(expected.length);
            actual.forEach((value, at) => expect(value).toBeCloseTo(expected[at]!, 9));
          });
        });
      });
    }
  });

  it("keeps the reverse widths and takes light field colours by layer name", () => {
    for (const level of [1, 2, 3]) {
      const dark = travelJets(main, reverse, undefined, level, "reverse")!;
      const light = travelJets(main, reverse, LIGHT_FIELD.jets.shipLevels, level, "reverse")!;
      const field = LIGHT_FIELD.jets.shipLevels[level - 1]!;
      expect(light.layers.map(({ length, name, width }) => ({ length, name, width }))).toEqual(
        dark.layers.map(({ length, name, width }) => ({ length, name, width })),
      );
      expect(light.layers.map(({ width }) => width)).not.toEqual(field.map(({ width }) => width));
      light.layers.forEach((layer) =>
        expect(layer.colors).toEqual(field.find(({ name }) => name === layer.name)!.colors),
      );
    }
    const light = travelJets(main, reverse, LIGHT_FIELD.jets.shipLevels, 1, "reverse")!;
    const outer = light.layers.find(({ name }) => name === "outer")!;
    expect(layerColor(outer, 1)).toBe(color(LIGHT_FIELD_JET_LEVELS[0].outer[1]));
  });

  it("disables the plume when a field level lacks one of the geometry's layers", () => {
    const partial = LIGHT_FIELD.jets.shipLevels.map((layers) =>
      layers.filter(({ name }) => name !== "core"),
    );
    expect(travelJets(main, reverse, partial, 1, "reverse")).toBeUndefined();
    expect(travelJets(main, undefined, undefined, 1, "reverse")).toBeUndefined();
    expect(travelJets(undefined, reverse, undefined, 1, "forward")).toBeUndefined();
  });
});
