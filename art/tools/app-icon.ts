import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  engineJets,
  jetTriangles,
  normalJetTailRegions,
  readEngineJets,
} from "../../src/game/shipJets.ts";
import { filled, fillPolygon, over, resize, rgba, writePng, type Xy } from "./paint.ts";
import { SPACE_BG } from "./palette.ts";
import { classic, drawn, FRAME } from "./ship-model.ts";
import { paintShip } from "./ship-raster.ts";

const output = fileURLToPath(new URL("../../public/art/app-icon/", import.meta.url));
// Review imagery stays out of the shipped art.
const review = fileURLToPath(new URL("../review/", import.meta.url));
const SIZE = 512;
const HEADING = 46;
const SPEED = 0.6;
const DENSITY = 4;
const SAFE_ZONE = 0.8;
// A small margin inside the circular crop leaves room for the reduction filter.
const REGULAR_RADIUS = SIZE * 0.48;
const background = rgba(`#${SPACE_BG}`);
const hull = drawn(FRAME / 2, classic.paint, { yaw: HEADING });
const data = readEngineJets(
  JSON.parse(readFileSync(new URL("../../public/art/ship-jets.json", import.meta.url), "utf8")),
);
if (!data || data.frame !== FRAME) throw new Error("Invalid Classic ship jet art");
const jets = engineJets(data, 1);
const pivot = { x: 0, y: 0 };
const frameDisplay = { displayHeight: FRAME, displayWidth: FRAME, pivot };
const tail = normalJetTailRegions(jets, frameDisplay, HEADING);

const composition = [
  ...hull.flatMap(({ outline }) => outline),
  ...jetTriangles(jets, frameDisplay, HEADING, SPEED).flatMap(({ points }) =>
    points.map(({ x, y }): Xy => [x, y]),
  ),
];
const xs = composition.map(([x]) => x);
const ys = composition.map(([, y]) => y);
const centreX = (Math.min(...xs) + Math.max(...xs)) / 2;
const centreY = (Math.min(...ys) + Math.max(...ys)) / 2;
const radius = Math.max(...composition.map(([x, y]) => Math.hypot(x - centreX, y - centreY)));
const scale = REGULAR_RADIUS / radius;

// One hull-and-exhaust fit serves both exports and both jet material profiles.
function raster(displaySize: number, fit = 1) {
  const project = ([x, y]: Xy): Xy => [
    (SIZE / 2 + (x - centreX) * scale * fit) * DENSITY,
    (SIZE / 2 + (y - centreY) * scale * fit) * DENSITY,
  ];
  const master = filled(background, SIZE * DENSITY, SIZE * DENSITY);
  paintShip(
    master,
    hull.map(({ color, outline }) => ({ color, outline: outline.map(project) })),
  );
  const hullPixels = master.data.slice();

  // Use the destination's frame size to choose the canonical small jet material.
  const displayScale = (displaySize * scale * fit) / SIZE;
  const display = {
    displayHeight: FRAME * displayScale,
    displayWidth: FRAME * displayScale,
    pivot,
  };
  for (const { alpha, color, points } of jetTriangles(jets, display, HEADING, SPEED)) {
    if (alpha !== 1) throw new Error("Expected opaque normal jet material");
    fillPolygon(
      master,
      points.map(({ x, y }) => project([x / displayScale, y / displayScale])),
      rgba(color.toString(16).padStart(6, "0")),
    );
  }

  // Normal exhaust draws in front, with the original hull pixels restored at the tail.
  const mask = filled([0, 0, 0, 0], master.width, master.height);
  for (const region of tail) {
    fillPolygon(
      mask,
      region.map(({ x, y }) => project([x, y])),
      [255, 255, 255, 255],
    );
  }
  for (let at = 0; at < mask.data.length; at += 4) {
    if (mask.data[at + 3]) master.data.set(hullPixels.subarray(at, at + 4), at);
  }
  return master;
}

const master = raster(SIZE);
const images = new Map<number, ReturnType<typeof resize>>();
for (const size of [16, 32, 180, 192, 512]) {
  images.set(size, resize(size <= 32 ? raster(size) : master, size, size));
}
for (const [name, size] of [
  ["icon-192", 192],
  ["icon-512", 512],
  ["apple-touch-icon", 180],
  ["favicon-16", 16],
  ["favicon-32", 32],
] as const)
  writePng(`${output}${name}.png`, images.get(size)!, true);

writePng(`${output}icon-maskable-512.png`, resize(raster(SIZE, SAFE_ZONE), SIZE, SIZE), true);

// ICO PNG payloads retain the exact exported 16 and 32 pixel favicon images.
const payloads = [16, 32].map((size) => ({
  size,
  png: readFileSync(`${output}favicon-${size}.png`),
}));
const header = Buffer.alloc(6 + payloads.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(payloads.length, 4);
let offset = header.length;
for (const [i, { size, png }] of payloads.entries()) {
  const at = 6 + i * 16;
  header[at] = size;
  header[at + 1] = size;
  header.writeUInt16LE(1, at + 4);
  header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(png.length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += png.length;
}
writeFileSync(`${output}favicon.ico`, Buffer.concat([header, ...payloads.map(({ png }) => png)]));
const contact = filled(background, 576, 192);
over(contact, images.get(192)!);
for (const [column, size] of [
  [1, 16],
  [2, 32],
] as const) {
  const source = images.get(size)!;
  for (let y = 0; y < 192; y++)
    for (let x = 0; x < 192; x++) {
      const i = (Math.floor((y * size) / 192) * size + Math.floor((x * size) / 192)) * 4;
      contact.data.set(source.data.subarray(i, i + 4), (y * 576 + column * 192 + x) * 4);
    }
}
mkdirSync(review, { recursive: true });
writePng(`${review}app-icon-contact-sheet.png`, contact, true);
