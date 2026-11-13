import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { anchor, json, SHIP_HEADINGS, vector } from "./projection.ts";
import { JET_LENGTH, jetLayers } from "./ship-jet-layers.ts";
import { FRAME, retroMouthAxis } from "./ship-model.ts";

// Fixed yellow retro exhaust, independent of the rear jets' engine-level palette.
const layers = jetLayers({
  halo: "#f2d15a",
  outer: ["#c9a978", "#f2d15a"],
  core: ["#efe4cf", "#ffffff"],
});
const headings = Array.from({ length: SHIP_HEADINGS }, (_, yaw) => ({
  index: yaw,
  mouths: [-1, 1].map((sign) => {
    const { half, middle } = retroMouthAxis(sign);
    return {
      anchor: anchor(SHIP_HEADINGS, FRAME / 2, yaw, middle),
      axis: vector(SHIP_HEADINGS, yaw, [0, -1, 0]),
      half: vector(SHIP_HEADINGS, yaw, half),
    };
  }),
}));
const contract = {
  version: 1,
  frame: FRAME,
  length: JET_LENGTH,
  engineLevels: [{ level: 1, layers }],
  headings,
};
writeFileSync(
  fileURLToPath(new URL("../../public/art/ship-retro-jets.json", import.meta.url)),
  json(contract),
);
