// The upgrade pickup's chevron mask (art/weapons.md, Pickups): one chevron of the generic upgrade
// glyph as a white polygon, the outline of a 2.2 px mitred stroke with butt caps, written to
// public/art/pickups/upgrade-chevron.svg. Tech tints two copies inside the amber square and lights
// them in turn; the core manifest entry `upgrade-chevron` carries their offsets and the climb.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { replaceEntries } from "./manifest.ts";

const dir = fileURLToPath(new URL("../../public/art/pickups/", import.meta.url));
const ID = "upgrade-chevron";
const FILE = "upgrade-chevron.svg";

// Centreline: arms from (-HALF, RISE / 2) up to the apex (0, -RISE / 2) and down to (HALF, RISE / 2),
// centred on the frame. The frame is FRAME_W by FRAME_H display px.
const HALF = 5.2;
const RISE = 4.2;
const WIDTH = 2.2;
const GAP = 4.8; // centre to centre of the two chevrons
const FRAME_W = 12;
const FRAME_H = 8;

const round = (value: number) => Math.round(value * 1000) / 1000;

function outline(): [number, number][] {
  const length = Math.hypot(HALF, RISE);
  // Unit normal of the left arm, pointing up and out; the right arm mirrors it.
  const nx = -RISE / length;
  const ny = -HALF / length;
  const w = WIDTH / 2;
  const miter = w / Math.sin(Math.atan2(HALF, RISE));
  const left: [number, number] = [-HALF, RISE / 2];
  const right: [number, number] = [HALF, RISE / 2];
  return [
    [left[0] + w * nx, left[1] + w * ny],
    [0, -RISE / 2 - miter],
    [right[0] - w * nx, right[1] + w * ny],
    [right[0] + w * nx, right[1] - w * ny],
    [0, -RISE / 2 + miter],
    [left[0] - w * nx, left[1] - w * ny],
  ];
}

const points = outline().map(([x, y]) => [round(x + FRAME_W / 2), round(y + FRAME_H / 2)]);
for (const [x = 0, y = 0] of points) {
  if (x < 0 || x > FRAME_W || y < 0 || y > FRAME_H) {
    throw new Error(`chevron point ${x}, ${y} is outside the ${FRAME_W}x${FRAME_H} frame`);
  }
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FRAME_W}" height="${FRAME_H}" viewBox="0 0 ${FRAME_W} ${FRAME_H}">
  <title>Upgrade pickup chevron</title>
  <polygon fill="#ffffff" points="${points.map((p) => p.join(",")).join(" ")}"/>
</svg>
`;

mkdirSync(dir, { recursive: true });
const path = `${dir}${FILE}`;
if (!existsSync(path) || readFileSync(path, "utf8") !== svg) {
  writeFileSync(path, svg);
}

replaceEntries("core", (id) => id === ID, [
  {
    id: ID,
    path: `/art/pickups/${FILE}`,
    width: FRAME_W,
    height: FRAME_H,
    displayWidth: FRAME_W,
    displayHeight: FRAME_H,
    facing: "fixed",
    pivot: { x: 0.5, y: 0.5 },
    chevrons: [
      { name: "lower", offset: [0, GAP / 2] },
      { name: "upper", offset: [0, -GAP / 2] },
    ],
    climb: [{ ms: 900 }, { ms: 120, lit: "lower" }, { ms: 120, lit: "upper" }],
  },
]);
