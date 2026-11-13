// Standalone household character sprites. Story backgrounds remain environment-only.
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { catCurled, catSitting } from "./family-sprites.ts";
import { replaceEntries } from "./manifest.ts";
import { writePng } from "./paint.ts";

const directory = fileURLToPath(new URL("../../public/art/characters/", import.meta.url));
mkdirSync(directory, { recursive: true });
const entries = [];
for (const name of ["gadget", "kiwi"] as const) {
  for (const [pose, make] of [
    ["sitting", catSitting],
    ["curled", catCurled],
  ] as const) {
    const { image, centre } = make(name);
    const key = `${name}-${pose}`;
    writePng(`${directory}${key}.png`, image);
    entries.push({
      id: `household-${key}`,
      path: `/art/characters/${key}.png`,
      width: image.width,
      height: image.height,
      pivot: { x: centre / image.width, y: 1 },
    });
  }
}
replaceEntries("core", (id) => id.startsWith("household-"), entries);
