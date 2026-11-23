// Needle's community project world changes: the Channel lights lamp buoy, placed along the
// practice channel by a path anchor, and the Loom hall, which replaces the Weavers' station
// frames (drawn by needle-station.ts). Contract: art/needle.md (World changes).
// Usage: node art/tools/needle-projects.ts [--pack-projects]
import { writeFileSync } from "node:fs";

import { packAtlas } from "@andornaut/art-kit/build/atlasLayout";

import { readManifest, replaceEntries } from "./manifest.ts";
import { svgText } from "./svg-text.ts";
import {
  glassSide,
  lamp,
  layout,
  OUT,
  pearl,
  pearlSide,
  placed,
  PUBLIC,
  silver,
  silverSide,
  svgFile,
} from "./needle-common.ts";
import { type Point, projectAt, round } from "./projection.ts";
import { BLINK_MS, box, DISPLAY_SCALE, ngon, type Part, polygons } from "./solid.ts";
import { writeProjects } from "./projects.ts";

const args = process.argv.slice(2);
if (args.length && (args.length !== 1 || args[0] !== "--pack-projects")) {
  throw new Error("Usage: node art/tools/needle-projects.ts [--pack-projects]");
}
const sheet = "projects-sheet.svg";
const sheetPath = PUBLIC + sheet;
const ownsLamp = (id: string) => /^needle-lamp-[ab]$/.test(id);
const ownsBerth = (id: string) => /^needle-practice-berth-[ab]$/.test(id);
const installed = readManifest("needle").assets.filter(
  ({ id }) => ownsLamp(id) || ownsBerth(id),
) as {
  id: string;
  path: string;
  svgSheet?: boolean;
}[];
const selected = installed.some(({ path, svgSheet }) => path === sheetPath || svgSheet === true);
const packed = args.length === 1 || selected;
const files = new Map<string, string>();

const LAMP_GROWTH = 1.5;
const LAMP_DIM = "#8c7c60";
const POOL_R = 14;
const POOL_ALPHA = { a: 0.14, b: 0.05 };
// Lamp pairs along the practice channel, world units: the first `start` from its start, then
// every `spacing`, `inset` inside each edge.
const ANCHORS = { start: 40, spacing: 80, inset: 4 };

// A small pearl float, a silver mast and a soft warm lamp.
function lampBuoy(lit: boolean): Part[][] {
  const p = Math.PI / 8;
  return [
    [
      { plan: ngon(8, 5, 0, 0, p), z0: 0, z1: 3.5, top: pearl, side: pearlSide },
      { plan: ngon(8, 3.2, 0, 0, p), z0: 3.5, z1: 5, top: silver, side: silverSide },
      { plan: box(-0.7, -0.7, 0.7, 0.7), z0: 5, z1: 16, top: silver, side: silverSide },
      {
        plan: ngon(8, 2.4, 0, 0, p),
        z0: 16,
        z1: 19.5,
        top: lit ? lamp : LAMP_DIM,
        side: lit ? "#e6c98f" : "#6b5e49",
      },
      { plan: ngon(8, 1.6, 0, 0, p), z0: 19.5, z1: 20.5, top: pearl, side: pearlSide },
    ],
  ];
}

// The lamp's pool of light on the world plane round the float.
const pool: Point[] = Array.from({ length: 24 }, (_, i) => [
  POOL_R * Math.cos((2 * Math.PI * i) / 24),
  POOL_R * Math.sin((2 * Math.PI * i) / 24),
  0,
]);
function lampFaces(lit: boolean) {
  return polygons(lampBuoy(lit)).map(({ color, points }) => ({
    color,
    points: points.map(([x, y, z]): Point => [x * LAMP_GROWTH, y * LAMP_GROWTH, z * LAMP_GROWTH]),
  }));
}

const frame = layout([...lampFaces(true), ...lampFaces(false), { color: lamp, points: pool }]);

const lamps = (["a", "b"] as const).map((letter) => {
  const lit = letter === "a";
  const shapes = [
    {
      color: lamp,
      opacity: POOL_ALPHA[letter],
      points: pool.map((p) => projectAt(frame.halfWidth, frame.above, p)),
    },
    ...placed(frame.halfWidth, frame.above, lampFaces(lit)),
  ];
  files.set(
    `lamp-${letter}.svg`,
    svgText(svgFile(`Channel light ${letter.toUpperCase()}`, frame.width, frame.height, shapes)),
  );
  return {
    id: `needle-lamp-${letter}`,
    path: packed ? sheetPath : `${PUBLIC}lamp-${letter}.svg`,
    ...(packed ? { svgSheet: true } : {}),
    width: frame.width,
    height: frame.height,
    displayWidth: round(frame.width * DISPLAY_SCALE),
    displayHeight: round(frame.height * DISPLAY_SCALE),
    facing: "fixed",
    pivot: { x: 0.5, y: frame.above / frame.height },
    frameMs: BLINK_MS,
    project: "channelLights",
  };
});

// A small deck with an open viewing edge and low lights on the two corners.
function observationDeck(lit: boolean): Part[][] {
  const z = 5;
  const outer = [
    [-21, -8],
    [-14, -17],
    [17, -17],
    [22, -11],
    [21, 13],
    [14, 17],
    [-17, 16],
  ] as const;
  return [
    [{ plan: outer, z0: 0, z1: z, top: silver, side: silverSide }],
    [
      { plan: box(-13, -10, 15, 11), z0: z, z1: z + 0.8, top: pearl, side: pearlSide },
      ...[-15, 0, 15].map((x) => ({
        plan: box(x - 1.2, 10, x + 1.2, 13),
        z0: z,
        z1: z + 8,
        top: silver,
        side: glassSide,
      })),
      { plan: box(-16, 10, 16, 13), z0: z + 7, z1: z + 9, top: silverSide, side: glassSide },
      ...[-16, 16].map((x) => ({
        plan: box(x - 2, -13, x + 2, -9),
        z0: z,
        z1: z + 6,
        top: lit ? lamp : "#bfae94",
        side: pearlSide,
      })),
    ],
  ];
}

const berthFaces = [true, false].map((lit) => polygons(observationDeck(lit), undefined, [5]));
const berthFrame = layout(berthFaces.flat());
const berth = (["a", "b"] as const).map((letter, index) => {
  const id = `needle-practice-berth-${letter}`;
  const file = `practice-berth-${letter}.svg`;
  files.set(
    file,
    svgText(
      svgFile(
        `Practice berth ${letter.toUpperCase()}`,
        berthFrame.width,
        berthFrame.height,
        placed(berthFrame.halfWidth, berthFrame.above, berthFaces[index]!),
      ),
    ),
  );
  return {
    id,
    path: packed ? sheetPath : PUBLIC + file,
    ...(packed ? { svgSheet: true } : {}),
    width: berthFrame.width,
    height: berthFrame.height,
    displayWidth: round(berthFrame.width * DISPLAY_SCALE),
    displayHeight: round(berthFrame.height * DISPLAY_SCALE),
    facing: "fixed",
    pivot: { x: 0.5, y: berthFrame.above / berthFrame.height },
    frameMs: BLINK_MS,
    project: "practiceBerth",
  };
});
if (packed) {
  const entries = [...lamps, ...berth];
  const ids = new Set(entries.map(({ id }) => id));
  if (
    selected &&
    (installed.length !== entries.length ||
      installed.some(
        ({ id, path, svgSheet }) => !ids.has(id) || path !== sheetPath || svgSheet !== true,
      ))
  ) {
    throw new Error("Needle project sheet selection must include both complete A/B pairs");
  }
  const rectangles = entries.map(({ width, height }) => ({ width, height }));
  const width = rectangles.reduce((total, rectangle) => total + rectangle.width, 0);
  const page = packAtlas({ compare: () => 0, extrude: 0, maxSize: width, widths: [width] }, [
    { rectangles, value: sheet },
  ])?.pages[0];
  if (!page) throw new Error("Cannot pack Needle project sheet");
  const namespace = "http://www.w3.org/2000/svg";
  const roots = [...files.values()].map((svg, index) => {
    const row = entries[index]!;
    const root = `<svg xmlns="${namespace}" width="${row.displayWidth}" height="${row.displayHeight}" viewBox="0 0 ${row.width} ${row.height}">`;
    const source = svg.trimEnd();
    if (!source.startsWith(root) || !source.endsWith("</svg>")) {
      throw new Error(`Unexpected Needle project root: ${row.id}`);
    }
    const { x, y } = page.placed[0]!.at[index]!;
    return `<svg id="${row.id}" x="${x}" y="${y}" ${source.slice("<svg ".length)}`;
  });
  writeFileSync(
    OUT + sheet,
    `<svg xmlns="${namespace}" width="${width}" height="${page.height}" viewBox="0 0 ${width} ${page.height}">${roots.join("")}</svg>\n`,
  );
} else {
  for (const [file, svg] of files) writeFileSync(OUT + file, svg);
}
replaceEntries("needle", ownsLamp, lamps);
replaceEntries("needle", ownsBerth, berth);

writeProjects({
  channelLights: {
    galaxy: "needle",
    kind: "path",
    path: "practice",
    frames: ["needle-lamp-a", "needle-lamp-b"],
    anchors: { ...ANCHORS, sides: [-1, 1], phase: "alternate" },
  },
  loomHall: {
    galaxy: "needle",
    destination: "station",
    kind: "replace",
    frames: ["needle-station-hall-a", "needle-station-hall-b"],
    replaces: ["needle-station-a", "needle-station-b"],
  },
  practiceBerth: {
    galaxy: "needle",
    kind: "overlay",
    site: "needlePractice",
    frames: berth.map(({ id }) => id),
    offset: [-106, 158],
    frameMs: BLINK_MS,
  },
});
console.log(
  `lamp frame ${frame.width} by ${frame.height}, pivot (${frame.halfWidth}, ${frame.above})`,
);
