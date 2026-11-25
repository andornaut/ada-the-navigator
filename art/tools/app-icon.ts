import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { filled, fillPolygon, over, resize, rgba, writePng, type Xy } from "./paint.ts";
import { SPACE_BG } from "./palette.ts";
import { JET_LENGTH, JET_LEVELS, JET_PROFILE, JET_SHAPE, jetLayers } from "./ship-jet-layers.ts";
import { classic, drawn, forwardJetMouths, FRAME } from "./ship-model.ts";
import { jetLength, plumeColor, plumePolygon } from "./ship-plume.ts";
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
// Engine 1 plumes on the dark field, with the hull regions that draw over them.
const layers = jetLayers(JET_LEVELS[0]);
const mouths = forwardJetMouths(
  FRAME / 2,
  { yaw: HEADING },
  { halfWidth: JET_SHAPE.outer.width, length: JET_LENGTH.base + JET_LENGTH.scale },
);
const plumes = mouths.flatMap((mouth) =>
  layers.map((layer) => ({
    color: plumeColor(layer.colors, SPEED),
    points: plumePolygon(JET_PROFILE, mouth, layer, jetLength(JET_LENGTH, SPEED)),
  })),
);

const composition = [
  ...hull.flatMap(({ outline }) => outline),
  ...plumes.flatMap(({ points }) => points),
];
const xs = composition.map(([x]) => x);
const ys = composition.map(([, y]) => y);
const centreX = (Math.min(...xs) + Math.max(...xs)) / 2;
const centreY = (Math.min(...ys) + Math.max(...ys)) / 2;
const radius = Math.max(...composition.map(([x, y]) => Math.hypot(x - centreX, y - centreY)));
const scale = REGULAR_RADIUS / radius;

// One hull-and-exhaust fit serves every export.
function raster(fit = 1) {
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
  for (const { color, points } of plumes) fillPolygon(master, points.map(project), rgba(color));

  // The plumes lie in the exhaust plane: the hull nearer than it draws over them.
  const mask = filled([0, 0, 0, 0], master.width, master.height);
  for (const region of mouths.flatMap(({ occluders }) => occluders)) {
    fillPolygon(mask, region.map(project), [255, 255, 255, 255]);
  }
  for (let at = 0; at < mask.data.length; at += 4) {
    if (mask.data[at + 3]) master.data.set(hullPixels.subarray(at, at + 4), at);
  }
  return master;
}

const master = raster();
const images = new Map<number, ReturnType<typeof resize>>();
for (const size of [16, 32, 180, 192, 512]) {
  images.set(size, resize(master, size, size));
}
for (const [name, size] of [
  ["icon-192", 192],
  ["icon-512", 512],
  ["apple-touch-icon", 180],
  ["favicon-16", 16],
  ["favicon-32", 32],
] as const)
  writePng(`${output}${name}.png`, images.get(size)!, true);

writePng(`${output}icon-maskable-512.png`, resize(raster(SAFE_ZONE), SIZE, SIZE), true);

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
