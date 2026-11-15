import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { anchor, json, round, SHIP_HEADINGS, SHIP_HEADING_CONTRACT, vector } from "./projection.ts";
import { JET_LENGTH, JET_LEVELS, jetLayers } from "./ship-jet-layers.ts";
import { FRAME, jetAttachment, normalJetStation, retroMouthAxis } from "./ship-model.ts";

// Shape proportions match the normal flame. Runtime derives opaque reverse materials from
// the selected main engine/field layers and anchors the whole group at the existing corner.
const coreRatio = normalJetStation({ yaw: 0, thrust: false }, 1).coreWidth;
const engineLevels = JET_LEVELS.map((entry) => {
  const layers = jetLayers(entry);
  const core = layers.find((layer) => layer.name === "core")!;
  return {
    level: entry.level,
    layers: layers.map((layer, index) => ({
      ...layer,
      width: index === 0 ? layer.width : (layers[0]!.width * coreRatio * layer.width) / core.width,
    })),
  };
});
const fullLength = round((JET_LENGTH.base + JET_LENGTH.scale) * 1.1);
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
      rearClip: {
        normal,
        constant: normal[0]! * outerCorner[0] + normal[1]! * outerCorner[1],
      },
    };
  }),
}));
const contract = {
  version: 1,
  reverseStyle: "centered-main",
  shipHeadings: SHIP_HEADING_CONTRACT,
  frame: FRAME,
  length: {
    base: round(fullLength * 0.45),
    scale: round(fullLength * 0.7),
    exponent: 1,
  },
  engineLevels,
  headings,
};
writeFileSync(
  fileURLToPath(new URL("../../public/art/ship-retro-jets.json", import.meta.url)),
  json(contract),
);
