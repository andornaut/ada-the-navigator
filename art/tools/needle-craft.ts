// Elder Loom's saucer: a non-hostile story craft at 16 headings with speed jets and nose data in
// the Cartwheel story-craft schema. Contract: art/needle.md (Elder Loom's saucer).
// Usage: node art/tools/needle-craft.ts
import { writeFileSync } from "node:fs";

import { jetsFile, type JetColors } from "./crafts.ts";
import { replaceEntries } from "./manifest.ts";
import { OUT, placed, PUBLIC, squareFrame, svgFile } from "./needle-common.ts";
import { noses } from "./nose.ts";
import { anchor, ENEMY_HEADINGS, type Point, rotate, round, vector } from "./projection.ts";
import { saucer, SAUCER_LEVELS, SAUCER_MOUTH_WIDTH, SAUCER_MOUTHS } from "./saucer-model.ts";
import { along, DISPLAY_SCALE, polygons } from "./solid.ts";

const uv = (u: number, v: number) => along(-Math.PI / 2, u, v);

// The craft keeps its `glider` ids and files.
const NAME = "glider";
const TITLE = "Elder Loom's saucer";
const LEVELS = SAUCER_LEVELS;
const MOUTHS = SAUCER_MOUTHS;
const MOUTH_WIDTH = SAUCER_MOUTH_WIDTH;
// The story craft's civil jet palette (art/cartwheel.md).
const JETS: JetColors = { outer: ["#c9a978", "#ffe9b8"], core: ["#efe4cf", "#ffffff"] };

const view = (yaw: number) => (point: Point) => rotate(ENEMY_HEADINGS, yaw, point);
const headingFaces = (yaw: number) => polygons(saucer(), view(yaw), LEVELS);

const frame = squareFrame(
  Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => headingFaces(yaw))
    .flat()
    .flatMap(({ points }) => points),
);
const centre = frame / 2;

const nose = noses(headingFaces, frame, { name: NAME, build: saucer });

const half = MOUTH_WIDTH / 2;
writeFileSync(
  `${OUT}${NAME}-jets.json`,
  jetsFile(
    frame,
    (yaw) =>
      MOUTHS.map(([u, v, z]) => ({
        anchor: anchor(ENEMY_HEADINGS, centre, yaw, [...uv(u, v), z]),
        axis: vector(ENEMY_HEADINGS, yaw, [0, 1, 0]),
        half: vector(ENEMY_HEADINGS, yaw, [-half, 0, 0]),
      })),
    JETS,
    { nose },
  ),
);

const display = round(frame * DISPLAY_SCALE);
const entries = Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => {
  writeFileSync(
    `${OUT}${NAME}-${yaw}.svg`,
    svgFile(`${TITLE} ${yaw}`, frame, frame, placed(centre, centre, headingFaces(yaw))),
  );
  return {
    id: `craft-${NAME}-${yaw}`,
    path: `${PUBLIC}${NAME}-${yaw}.svg`,
    width: frame,
    height: frame,
    displayWidth: display,
    displayHeight: display,
    facing: `world-${yaw}`,
    directionIndex: yaw,
    pivot: { x: 0.5, y: 0.5 },
    craft: NAME,
  };
});

replaceEntries("needle", (id) => id.startsWith(`craft-${NAME}-`), entries);
console.log(`${NAME} frame ${frame}, nose ${nose.map(({ distance }) => distance).join(" ")}`);
