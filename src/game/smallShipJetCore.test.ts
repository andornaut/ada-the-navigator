import { describe, expect, it } from "vitest";

import mainArt from "../../public/art/ship-jets.json";
import reverseArt from "../../public/art/ship-retro-jets.json";
import { drawShipJets } from "../ui/shipJetCanvas.ts";
import { LIGHT_FIELD } from "./lightField.ts";
import { jetPlumes, layerColor, readEngineJets, travelJets } from "./shipJets.ts";
import { staticShipJets } from "./staticShipJets.ts";

const main = readEngineJets(mainArt)!;
const reverse = readEngineJets(reverseArt)!;
const display = (size: number) => ({
  displayHeight: size,
  displayWidth: size,
  pivot: { x: 0.5, y: 0.5 },
});
const hex = (value: number) => `#${value.toString(16).padStart(6, "0")}`;

describe("player jet cores at every display size", () => {
  it.each(["forward", "reverse"] as const)(
    "draws the %s outer and core at every size, scaled and unrecoloured",
    (direction) => {
      for (const field of [undefined, LIGHT_FIELD.jets.shipLevels]) {
        for (const level of [1, 2, 3]) {
          const jets = travelJets(main, reverse, field, level, direction)!;
          // The halo draws only up to its maxDisplay; the outer and core draw at every size.
          const plumeLayers = jets.layers.filter(({ underHull }) => !underHull);
          for (const fraction of [0.3, 1]) {
            const large = jetPlumes(jets, display(84), 56, fraction);
            expect(large.map(({ color }) => color)).toEqual(
              [0, 1].flatMap(() => plumeLayers.map((layer) => layerColor(layer, fraction))),
            );
            for (const size of [16, 24, 42]) {
              const all = jetPlumes(jets, display(size), 56, fraction);
              expect(all.filter(({ underHull }) => underHull)).toHaveLength(2);
              const small = all.filter(({ underHull }) => !underHull);
              expect(small.map(({ color }) => color)).toEqual(large.map(({ color }) => color));
              small.forEach((plume, index) => {
                plume.points.forEach((point, corner) => {
                  expect(point.x).toBeCloseTo((large[index]!.points[corner]!.x * size) / 84, 12);
                  expect(point.y).toBeCloseTo((large[index]!.points[corner]!.y * size) / 84, 12);
                });
              });
            }
          }
        }
      }
    },
  );

  it("fills the core through static cues and Canvas at the map's small size", () => {
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
      // One path per plume at each of the two mouths: the halo up to its maxDisplay, then the
      // outer and core.
      const drawn = jets.layers.filter(
        ({ maxDisplay }) => maxDisplay === undefined || size <= maxDisplay,
      );
      expect(drawn.length).toBe(size <= 42 ? 3 : 2);
      expect(fills).toEqual([0, 1].flatMap(() => drawn.map((layer) => hex(layerColor(layer, 1)))));
    }
  });
});
