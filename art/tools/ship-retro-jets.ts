import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { anchor, json, round, SHIP_HEADINGS, SHIP_HEADING_CONTRACT, vector } from "./projection.ts";
import { JET_LEVELS, JET_PROFILE, jetLayers, RETRO_JET } from "./ship-jet-layers.ts";
import { FRAME, plumeSide, retroMouthAxis, retroRoot } from "./ship-model.ts";

// Reverse plumes: the forward layers and profile at the retro widths and reach, rooted at each
// wing tip and aimed forward and outboard. The hull draws over them.
const plume = {
  halfWidth: jetLayers(JET_LEVELS[0], RETRO_JET.width)[0]!.width,
  rootShare: JET_PROFILE[0][1],
};
const headings = Array.from({ length: SHIP_HEADINGS }, (_, yaw) => ({
  index: yaw,
  mouths: [-1, 1].map((sign) => {
    const model = retroMouthAxis(sign);
    return {
      anchor: anchor(SHIP_HEADINGS, FRAME / 2, yaw, retroRoot({ yaw }, plume, sign)),
      axis: vector(SHIP_HEADINGS, yaw, model.axis),
      half: plumeSide({ yaw }, model.axis, model.side),
    };
  }),
}));
const contract = {
  version: 1,
  shipHeadings: SHIP_HEADING_CONTRACT,
  frame: FRAME,
  length: {
    base: round(RETRO_JET.length.base * RETRO_JET.reach),
    scale: round(RETRO_JET.length.scale * RETRO_JET.reach),
    exponent: 1,
  },
  profile: JET_PROFILE,
  engineLevels: JET_LEVELS.map((entry) => ({
    level: entry.level,
    layers: jetLayers(entry, RETRO_JET.width),
  })),
  headings,
};
writeFileSync(
  fileURLToPath(new URL("../../public/art/ship-retro-jets.json", import.meta.url)),
  json(contract),
);
