import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { filled, over, resize, rgba, writePng } from "./paint.ts";
import { SPACE_BG } from "./palette.ts";
import { classic, drawn, FRAME, UP } from "./ship-model.ts";
import { paintShip } from "./ship-raster.ts";
import { svgPaths } from "./ship-paths.ts";

const output = fileURLToPath(new URL("../../public/art/app-icon/", import.meta.url));
const SIZE = 512;
const SCALE = 5.8;
const OFFSET = [-22.4, -3.2] as const;
const polygons = drawn(FRAME / 2, classic.paint, { yaw: UP });
const background = rgba(`#${SPACE_BG}`);

writeFileSync(
  `${output}icon.svg`,
  [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">`,
    `  <path fill="#${SPACE_BG}" d="M0 0H${SIZE}V${SIZE}H0Z"/>`,
    `  <g transform="translate(${OFFSET.join(" ")}) scale(${SCALE})">`,
    ...svgPaths(polygons).map(({ color, path }) => `    <path fill="${color}" d="${path}"/>`),
    "  </g>",
    "</svg>",
    "",
  ].join("\n"),
);

// Raster exports sample the same projected geometry without an external SVG delegate.
const density = 4;
const master = filled(background, SIZE * density, SIZE * density);
paintShip(
  master,
  polygons.map(({ color, outline }) => ({
    color,
    outline: outline.map(
      ([x, y]) => [(x * SCALE + OFFSET[0]) * density, (y * SCALE + OFFSET[1]) * density] as const,
    ),
  })),
);
const images = new Map<number, ReturnType<typeof resize>>();
for (const size of [16, 32, 180, 192, 512]) images.set(size, resize(master, size, size));
for (const [name, size] of [
  ["icon-192", 192],
  ["icon-512", 512],
  ["icon-maskable-512", 512],
  ["apple-touch-icon", 180],
  ["favicon-16", 16],
  ["favicon-32", 32],
] as const)
  writePng(`${output}${name}.png`, images.get(size)!, true);

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
writePng(`${output}contact-sheet.png`, contact, true);
