import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { type Craft, crafts, drawOrder, faces, hullEntries, jetsFile } from "./crafts.ts";
import { replaceEntries } from "./manifest.ts";
import { anchor, ENEMY_HEADINGS, project, vector } from "./projection.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const output = `${art}enemies/`;
const MOUTH_Z = 2;

export function svg(craft: Craft, yaw: number): string {
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

export function jets(craft: Craft): string {
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

function main() {
  mkdirSync(output, { recursive: true });
  for (const craft of crafts) {
    writeFileSync(`${output}${craft.name}-jets.json`, jets(craft));
    for (let yaw = 0; yaw < ENEMY_HEADINGS; yaw++) {
      writeFileSync(`${output}${craft.name}-${yaw}.svg`, svg(craft, yaw));
    }
  }

  // Only this tool's hull frames, in place; heavies.ts owns the other `enemy-` entries.
  const names = crafts.map(({ name }) => name).join("|");
  const hull = new RegExp(`^enemy-(${names})-\\d+$`);
  replaceEntries(
    (id) => hull.test(id),
    crafts.flatMap(({ frame, name }) => hullEntries(name, frame)),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
