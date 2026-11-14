import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { anchor, json, round, SHIP_HEADINGS, vector } from "./projection.ts";
import { JET_LENGTH, JET_LEVELS, jetLayers } from "./ship-jet-layers.ts";
import { FRAME, jetAttachment, retroMouthAxis } from "./ship-model.ts";

// Compatibility layers derive from the same source as the forward exhaust. Runtime selects
// the forward engine/field material and anchors the whole group by its widest visible layer.
const engineLevels = JET_LEVELS.map((entry) => ({ level: entry.level, layers: jetLayers(entry) }));
const fallbackWidth = Math.max(...engineLevels[0]!.layers.map((layer) => layer.width));
const headings = Array.from({ length: SHIP_HEADINGS }, (_, yaw) => ({
  index: yaw,
  mouths: [-1, 1].map((sign) => {
    const model = retroMouthAxis(sign);
    const { corner } = jetAttachment(yaw, sign);
    const outerCorner = anchor(SHIP_HEADINGS, FRAME / 2, yaw, corner);
    const half = vector(SHIP_HEADINGS, yaw, model.half);
    const axis = vector(SHIP_HEADINGS, yaw, model.axis);
    // Express the model rear plane in the same quantized basis as the rendered triangles.
    const dot = (point: readonly number[]) =>
      model.rearNormal.reduce((sum, value, index) => sum + value * point[index]!, 0);
    const h = dot(model.half);
    const a = dot(model.axis);
    const determinant = half[0] * axis[1] - half[1] * axis[0];
    const normal = [
      (h * axis[1] - half[1] * a) / determinant,
      (half[0] * a - h * axis[0]) / determinant,
    ];
    return {
      anchor: outerCorner.map((value, index) => value - half[index]! * fallbackWidth),
      axis,
      half,
      outerCorner,
      coreOutboard: true,
      rearClip: {
        normal,
        constant: normal[0]! * outerCorner[0] + normal[1]! * outerCorner[1],
      },
    };
  }),
}));
const contract = {
  version: 1,
  frame: FRAME,
  length: {
    base: round(JET_LENGTH.base * 1.1),
    scale: round(JET_LENGTH.scale * 1.1),
    exponent: JET_LENGTH.exponent,
  },
  engineLevels,
  headings,
};
writeFileSync(
  fileURLToPath(new URL("../../public/art/ship-retro-jets.json", import.meta.url)),
  json(contract),
);
