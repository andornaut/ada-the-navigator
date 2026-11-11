import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { type Craft, crafts, drawOrder, faces, hullEntries, jetsFile } from "./crafts.ts";
import { anchor, ENEMY_HEADINGS, json, project, vector } from "./projection.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const output = `${art}enemies/`;
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

function jets(craft: Craft): string {
  const centre = craft.frame / 2;
  const half = craft.mouthWidth / 2;
  return jetsFile(craft.frame, (yaw) =>
    craft.mouths.map(([x, y]) => ({
      anchor: anchor(ENEMY_HEADINGS, centre, yaw, [x, y, MOUTH_Z]),
      axis: vector(ENEMY_HEADINGS, yaw, [0, 1, 0]),
      half: vector(ENEMY_HEADINGS, yaw, [-half, 0, 0]),
    })),
  );
}

mkdirSync(output, { recursive: true });
for (const craft of crafts) {
  writeFileSync(`${output}${craft.name}-jets.json`, jets(craft));
  for (let yaw = 0; yaw < ENEMY_HEADINGS; yaw++) {
    writeFileSync(`${output}${craft.name}-${yaw}.svg`, svg(craft, yaw));
  }
}

// Enemy entries follow the other assets, whose order is unchanged.
const manifestPath = `${art}manifest.json`;
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { assets: { id: string }[] };
manifest.assets = [
  ...manifest.assets.filter(({ id }) => !id.startsWith("enemy-")),
  ...crafts.flatMap(({ frame, name }) => hullEntries(name, frame)),
];
writeFileSync(manifestPath, json(manifest));
