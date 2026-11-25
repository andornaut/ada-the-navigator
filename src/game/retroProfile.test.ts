import { describe, expect, it } from "vitest";

import { JET_PROFILE, jetLayers, RETRO_JET } from "../../art/tools/ship-jet-layers.ts";
import { jetLength as artJetLength, plumePolygon } from "../../art/tools/ship-plume.ts";
import mainArt from "../../public/art/ship-jets.json";
import reverseArt from "../../public/art/ship-retro-jets.json";
import { LIGHT_FIELD } from "./lightField.ts";
import { jetPlumes, layerColor, readEngineJets, travelJets } from "./shipJets.ts";

const main = readEngineJets(mainArt)!;
const reverse = readEngineJets(reverseArt)!;
const framePixels = { displayHeight: 96, displayWidth: 96, pivot: { x: 0, y: 0 } };
const color = (value: string) => Number.parseInt(value.slice(1), 16);

describe("reverse plume profile", () => {
  it("draws Art's full teardrop at the reverse widths, with no clip, at every heading", () => {
    const shapes = jetLayers({ core: ["#000000", "#000000"], outer: ["#000000", "#000000"] }, 0.85);
    for (const f of [0.2, 1]) {
      const jets = travelJets(main, reverse, undefined, 1, "reverse")!;
      const length = artJetLength(reverseArt.length, f);
      reverseArt.headings.forEach(({ index, mouths }) => {
        const plumes = jetPlumes(jets, framePixels, index, f);
        expect(plumes).toHaveLength(4);
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
            const actual = plumes[mouth * 2 + layer]!.points.flatMap(({ x, y }) => [x, y]);
            expect(actual).toHaveLength(expected.length);
            actual.forEach((value, at) => expect(value).toBeCloseTo(expected[at]!, 9));
          });
        });
      });
    }
    expect(RETRO_JET.width).toBe(0.85);
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
    const outer = travelJets(main, reverse, LIGHT_FIELD.jets.shipLevels, 1, "reverse")!.layers[0]!;
    expect(layerColor(outer, 1)).toBe(color("#1767b3"));
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
