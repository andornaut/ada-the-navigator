import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { type Craft, crafts, drawOrder, faces } from "./crafts.ts";
import { anchor, HEADINGS, json, project, round, vector } from "./projection.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const output = `${art}enemies/`;
// Frame px to Ada's logical display px: 42 / 96.
const DISPLAY_SCALE = 0.4375;
const MOUTH_Z = 2;

function svg(craft: Craft, yaw: number): string {
  const centre = craft.frame / 2;
  const polygons = drawOrder(yaw, craft.parts[0]!.z1, craft.parts)
    .flatMap((part) => faces(yaw, part))
    .map(({ color, points }) => {
      const projected = points.map((point) => project(centre, point));
      return `  <polygon fill="${color}" points="${projected.join(" ")}"/>`;
    });
  const size = craft.frame;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `  <title>${craft.title} ${yaw} idle</title>`,
    ...polygons,
    "</svg>",
    "",
  ].join("\n");
}

// Speed jets: Tech draws outer and core triangles per mouth behind the idle frame.
function jets(craft: Craft): string {
  const centre = craft.frame / 2;
  const scale = Math.sqrt(craft.frame / 96);
  const half = craft.mouthWidth / 2;
  const headings = Array.from({ length: HEADINGS }, (_, yaw) => ({
    index: yaw,
    mouths: craft.mouths.map(([x, y]) => ({
      anchor: anchor(centre, yaw, [x, y, MOUTH_Z]),
      axis: vector(yaw, [0, 1, 0]),
      half: vector(yaw, [-half, 0, 0]),
    })),
  }));
  return json({
    version: 1,
    frame: craft.frame,
    length: { base: round(6 * scale), scale: round(24 * scale), exponent: 2 },
    layers: [
      { name: "outer", colors: ["#b8644c", "#f0a07c"], width: 1.6, length: 1 },
      { name: "core", colors: ["#d68b72", "#ffe2c8"], width: 0.8, length: 0.55 },
    ],
    headings,
  });
}

function manifestEntries(craft: Craft) {
  const display = craft.frame * DISPLAY_SCALE;
  return Array.from({ length: HEADINGS }, (_, yaw) => ({
    id: `enemy-${craft.name}-${yaw}`,
    path: `/art/enemies/${craft.name}-${yaw}.svg`,
    width: craft.frame,
    height: craft.frame,
    displayWidth: display,
    displayHeight: display,
    facing: `world-${yaw}`,
    directionIndex: yaw,
    pivot: { x: 0.5, y: 0.5 },
    archetype: craft.name,
  }));
}

mkdirSync(output, { recursive: true });
for (const craft of crafts) {
  writeFileSync(`${output}${craft.name}-jets.json`, jets(craft));
  for (let yaw = 0; yaw < HEADINGS; yaw++) {
    writeFileSync(`${output}${craft.name}-${yaw}.svg`, svg(craft, yaw));
  }
}

// Enemy entries follow the other assets, whose order is unchanged.
const manifestPath = `${art}manifest.json`;
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { assets: { id: string }[] };
manifest.assets = [
  ...manifest.assets.filter(({ id }) => !id.startsWith("enemy-")),
  ...crafts.flatMap(manifestEntries),
];
writeFileSync(manifestPath, json(manifest));
