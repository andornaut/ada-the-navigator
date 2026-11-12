import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { SPACE_BG } from "./palette.ts";
import { classic, drawn, FRAME, UP } from "./ship-model.ts";

// The app icon's vector master: the nose-up sprite frame's polygons from the shared ship model,
// centred on a dark lavender square. Each polygon strokes in its own fill to hide antialiasing
// seams. The PNG exports are rasterized from this file (art/app-icon.md).
const output = fileURLToPath(new URL("../../public/art/app-icon/icon.svg", import.meta.url));

// 512 canvas; the frame's bounding box centres on it and fits inside radius 185 px.
const SIZE = 512;
const PLACE = "translate(-22.4 -3.2) scale(5.8)";
const STROKE = 0.12;

const polygons = drawn(FRAME / 2, classic.paint, { yaw: UP }).map(({ color, outline }) => {
  const points = outline.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  return `    <polygon fill="${color}" stroke="${color}" points="${points}" />`;
});

writeFileSync(
  output,
  [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">`,
    `  <path fill="#${SPACE_BG}" d="M0 0H${SIZE}V${SIZE}H0Z" />`,
    `  <g transform="${PLACE}" stroke-width="${STROKE}" stroke-linejoin="round">`,
    ...polygons,
    "  </g>",
    "</svg>",
    "",
  ].join("\n"),
);
