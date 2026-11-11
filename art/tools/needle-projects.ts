// Needle's community project world changes: the Channel lights lamp buoy, placed along the
// practice channel by a path anchor, and the Loom hall, which replaces the Weavers' station
// frames (drawn by needle-station.ts). Contract: art/needle.md (World changes).
// Usage: node art/tools/needle-projects.ts
import { writeFileSync } from "node:fs";

import { replaceEntries } from "./manifest.ts";
import {
  lamp,
  layout,
  OUT,
  pearl,
  pearlSide,
  placed,
  PUBLIC,
  silver,
  silverSide,
  svgFile,
} from "./needle-common.ts";
import { type Point, projectAt, round } from "./projection.ts";
import { BLINK_MS, box, DISPLAY_SCALE, ngon, type Part, polygons } from "./solid.ts";
import { writeProjects } from "./projects.ts";

const LAMP_DIM = "#8c7c60";
const POOL_R = 14;
const POOL_ALPHA = { a: 0.14, b: 0.05 };
// Lamp pairs along the practice channel, world units: the first `start` from its start, then
// every `spacing`, `inset` inside each edge.
const ANCHORS = { start: 40, spacing: 80, inset: 4 };

// A small pearl float, a silver mast and a soft warm lamp.
function lampBuoy(lit: boolean): Part[][] {
  const p = Math.PI / 8;
  return [
    [
      { plan: ngon(8, 5, 0, 0, p), z0: 0, z1: 3.5, top: pearl, side: pearlSide },
      { plan: ngon(8, 3.2, 0, 0, p), z0: 3.5, z1: 5, top: silver, side: silverSide },
      { plan: box(-0.7, -0.7, 0.7, 0.7), z0: 5, z1: 16, top: silver, side: silverSide },
      {
        plan: ngon(8, 2.4, 0, 0, p),
        z0: 16,
        z1: 19.5,
        top: lit ? lamp : LAMP_DIM,
        side: lit ? "#e6c98f" : "#6b5e49",
      },
      { plan: ngon(8, 1.6, 0, 0, p), z0: 19.5, z1: 20.5, top: pearl, side: pearlSide },
    ],
  ];
}

// The lamp's pool of light on the world plane round the float.
const pool: Point[] = Array.from({ length: 24 }, (_, i) => [
  POOL_R * Math.cos((2 * Math.PI * i) / 24),
  POOL_R * Math.sin((2 * Math.PI * i) / 24),
  0,
]);
const frame = layout([
  ...polygons(lampBuoy(true)),
  ...polygons(lampBuoy(false)),
  { color: lamp, points: pool },
]);

const lamps = (["a", "b"] as const).map((letter) => {
  const lit = letter === "a";
  const shapes = [
    {
      color: lamp,
      opacity: POOL_ALPHA[letter],
      points: pool.map((p) => projectAt(frame.halfWidth, frame.above, p)),
    },
    ...placed(frame.halfWidth, frame.above, polygons(lampBuoy(lit))),
  ];
  writeFileSync(
    `${OUT}lamp-${letter}.svg`,
    svgFile(`Channel light ${letter.toUpperCase()}`, frame.width, frame.height, shapes),
  );
  return {
    id: `needle-lamp-${letter}`,
    path: `${PUBLIC}lamp-${letter}.svg`,
    width: frame.width,
    height: frame.height,
    displayWidth: round(frame.width * DISPLAY_SCALE),
    displayHeight: round(frame.height * DISPLAY_SCALE),
    facing: "fixed",
    pivot: { x: 0.5, y: frame.above / frame.height },
    frameMs: BLINK_MS,
    project: "channelLights",
  };
});
replaceEntries("needle", (id) => id.startsWith("needle-lamp-"), lamps);

writeProjects({
  channelLights: {
    galaxy: "needle",
    kind: "path",
    path: "practice",
    frames: ["needle-lamp-a", "needle-lamp-b"],
    anchors: { ...ANCHORS, sides: [-1, 1], phase: "alternate" },
  },
  loomHall: {
    galaxy: "needle",
    destination: "station",
    kind: "replace",
    frames: ["needle-station-hall-a", "needle-station-hall-b"],
    replaces: ["needle-station-a", "needle-station-b"],
  },
});
console.log(
  `lamp frame ${frame.width} by ${frame.height}, pivot (${frame.halfWidth}, ${frame.above})`,
);
