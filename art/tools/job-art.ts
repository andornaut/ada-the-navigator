import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { packAtlas } from "@andornaut/art-kit/build/atlasLayout";
import type { Frame } from "@andornaut/art-kit/build/grid";
import { writeSpriteSheet } from "@andornaut/art-kit/build/spriteSheet";
import { format, resolveConfig } from "prettier";

import { editManifest, readManifest, replaceEntries } from "./manifest.ts";
import { SVG_DECIMALS, svgText } from "./svg-text.ts";
import { hex, rgb } from "./oklab.ts";
import { json } from "./projection.ts";
import { traceGrid, withCollision } from "./silhouette.ts";

// Job art in space (art/jobs.md): the three landmark kinds, the lost item's glint and the search
// area's stroke rules, written as shared core assets with per-galaxy nebula tints keyed by galaxy
// id in public/art/jobs.json, the core manifest's `jobs` link.

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const dir = `${art}landmarks/`;
mkdirSync(dir, { recursive: true });

const space = JSON.parse(readFileSync(`${art}space-palette.json`, "utf8")) as {
  colors: Record<string, string>;
};
const fields = JSON.parse(readFileSync(`${art}galaxies.json`, "utf8")) as {
  galaxies: Record<string, { colors: Record<string, string>; tint: { light?: boolean } }>;
};
const POI = space.colors.pointOfInterest!.toLowerCase();
const POI_SIDE = "#8f7c9c";
const PANEL_FACE = "#354a78";
const PANEL_GRID = "#8bb6d7";
const WHITE = "#ffffff";
const INK = "#181425";

// Written files go through the project's Prettier settings so they stay Prettier-clean.
async function prettify(file: string): Promise<void> {
  const options = await resolveConfig(file);
  writeFileSync(file, await format(readFileSync(file, "utf8"), { ...options, filepath: file }));
}

// sRGB channel mix: `from` moved `t` of the way toward `to`, rounded half up.
function mix(from: string, to: string, t: number): string {
  const [a, b] = [rgb(from), rgb(to)];
  return hex(a.map((v, i) => Math.floor(v + (b[i]! - v) * t + 0.5)) as [number, number, number]);
}

// Nebula tints (`tintRule`): on a dark field the outer mass is the field's environmentDetail
// moved 0.16 toward pointOfInterest and the core 0.34; on a light field the outer mass is the
// environmentDetail and the core moves 0.18 toward ink, stepping darker as Chibi's farm layers do.
const RULE = { dark: { core: 0.34, outer: 0.16 }, light: { core: 0.18, outer: 0 } } as const;
function tints(detail: string, light: boolean) {
  return light
    ? { nebulaCore: mix(detail, INK, RULE.light.core), nebulaOuter: mix(detail, INK, 0) }
    : {
        nebulaCore: mix(detail, POI, RULE.dark.core),
        nebulaOuter: mix(detail, POI, RULE.dark.outer),
      };
}
const TINTS = Object.fromEntries([
  ["base", tints(space.colors.environmentDetail!, false)],
  ...Object.entries(fields.galaxies).map(([id, { colors, tint }]) => [
    id,
    tints(colors.environmentDetail!, Boolean(tint.light)),
  ]),
]);

// Nebula: blurred white masses Tech multiplies by the galaxy's tint, outer then core, and an
// untinted star layer. Ellipses are [cx, cy, rx, ry] from the box centre, turned -6.875 degrees.
const NEBULA = { width: 380, height: 180, displayWidth: 475, displayHeight: 225 } as const;
const TURN = -6.875;
const OUTER: readonly (readonly number[])[] = [
  [0, 0, 120, 52],
  [-70, 14, 70, 34],
  [74, -12, 76, 36],
  [20, 26, 80, 26],
];
const CORE: readonly (readonly number[])[] = [
  [-10, 2, 56, 22],
  [46, -8, 34, 16],
];

function mass(ellipses: readonly (readonly number[])[], blur: number): string {
  const cx = NEBULA.width / 2;
  const cy = NEBULA.height / 2;
  const shapes = ellipses.map(([dx, dy, rx, ry]) => {
    const x = cx + dx!;
    const y = cy + dy!;
    return `    <ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${TURN} ${x} ${y})" />`;
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${NEBULA.displayWidth}" height="${NEBULA.displayHeight}" viewBox="0 0 ${NEBULA.width} ${NEBULA.height}">`,
    `  <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${blur}" /></filter>`,
    `  <g fill="${WHITE}" filter="url(#soft)">`,
    ...shapes,
    "  </g>",
    "</svg>",
    "",
  ].join("\n");
}

// Stars: "W" white, "L" lavender, "D" lavender shade, "." clear; placed by their top-left pixel
// from the box centre.
const STAR = [".W.", "WLW", ".W."];
const STAR_BIG = ["...W...", "...L...", "..DLD..", "WLLWLLW", "..DLD..", "...L...", "...W..."];
const STARS: readonly [readonly string[], number, number][] = [
  [STAR_BIG, -30, -14],
  [STAR, 54, -26],
  [STAR, -92, 18],
  [STAR, 30, 22],
];
const STAR_COLOURS: Readonly<Record<string, string>> = { D: POI_SIDE, L: POI, W: WHITE };

function pixels(
  rows: readonly string[],
  colours: Readonly<Record<string, string>>,
  x0: number,
  y0: number,
) {
  return rows.flatMap((row, y) =>
    [...row].flatMap((cell, x) =>
      colours[cell]
        ? [`  <rect x="${x0 + x}" y="${y0 + y}" width="1" height="1" fill="${colours[cell]}" />`]
        : [],
    ),
  );
}

function stars(): string {
  const cx = NEBULA.width / 2;
  const cy = NEBULA.height / 2;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${NEBULA.displayWidth}" height="${NEBULA.displayHeight}" viewBox="0 0 ${NEBULA.width} ${NEBULA.height}" shape-rendering="crispEdges">`,
    ...STARS.flatMap(([rows, dx, dy]) => pixels(rows, STAR_COLOURS, cx + dx, cy + dy)),
    "</svg>",
    "",
  ].join("\n");
}

// Wreck: an unlit hull split in two with debris, in a 100 x 60 viewBox.
const HULL = {
  break: "#2a2433",
  rust: "#a77a68",
  side: "#6b6482",
  top: "#9d95ad",
  window: "#3f3a4d",
};
const WRECK = { width: 100, height: 60, displayWidth: 189, displayHeight: 113.4 } as const;
const WRECK_PARTS: readonly [string, readonly (readonly [number, number])[]][] = [
  // Bow half, left: nose to the break, three dark windows and a rust band.
  [
    HULL.side,
    [
      [6, 30],
      [18, 22],
      [44, 22],
      [46, 40],
      [16, 42],
    ],
  ],
  [
    HULL.top,
    [
      [6, 30],
      [16, 18],
      [40, 14],
      [44, 22],
      [18, 22],
    ],
  ],
  [
    HULL.break,
    [
      [44, 22],
      [40, 14],
      [43, 17],
      [47, 24],
      [45, 32],
      [48, 37],
      [46, 40],
    ],
  ],
  [
    HULL.rust,
    [
      [22, 30],
      [34, 30],
      [34, 33],
      [22, 33],
    ],
  ],
  [
    HULL.window,
    [
      [20, 25],
      [24, 25],
      [24, 27],
      [20, 27],
    ],
  ],
  [
    HULL.window,
    [
      [27, 25],
      [31, 25],
      [31, 27],
      [27, 27],
    ],
  ],
  [
    HULL.window,
    [
      [34, 25],
      [38, 25],
      [38, 27],
      [34, 27],
    ],
  ],
  // Exposed ribs across the torn bow skin.
  [
    HULL.break,
    [
      [40, 18],
      [42, 19],
      [41, 23],
      [40, 22],
    ],
  ],
  [
    HULL.rust,
    [
      [42, 26],
      [44, 28],
      [44, 35],
      [42, 32],
    ],
  ],
  // Stern half, right, drifted and tilted, with its fin.
  [
    HULL.side,
    [
      [56, 30],
      [86, 34],
      [92, 46],
      [60, 48],
    ],
  ],
  [
    HULL.top,
    [
      [58, 22],
      [84, 24],
      [86, 34],
      [56, 30],
    ],
  ],
  [
    HULL.break,
    [
      [58, 22],
      [56, 30],
      [60, 48],
      [54, 42],
      [57, 36],
      [53, 30],
    ],
  ],
  [
    HULL.side,
    [
      [86, 34],
      [94, 32],
      [96, 42],
      [92, 46],
    ],
  ],
  [
    HULL.rust,
    [
      [66, 38],
      [80, 40],
      [80, 43],
      [66, 41],
    ],
  ],
  [
    HULL.top,
    [
      [70, 24],
      [74, 14],
      [78, 15],
      [78, 24],
    ],
  ],
  // Debris.
  [
    HULL.side,
    [
      [48, 8],
      [52, 6],
      [54, 10],
      [50, 12],
    ],
  ],
  [
    HULL.top,
    [
      [50, 50],
      [55, 49],
      [54, 53],
    ],
  ],
  [
    HULL.side,
    [
      [30, 48],
      [34, 47],
      [35, 51],
      [31, 52],
    ],
  ],
];

function wreck(): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WRECK.displayWidth}" height="${WRECK.displayHeight}" viewBox="0 0 ${WRECK.width} ${WRECK.height}">`,
    ...WRECK_PARTS.map(
      ([fill, points]) =>
        `  <polygon fill="${fill}" points="${points.map((p) => p.join(",")).join(" ")}" />`,
    ),
    "</svg>",
    "",
  ].join("\n");
}

// The signal beacon is a low, horizontal satellite. Its corner-cut solar wings flank an
// armoured transmitter at the world anchor, with paired signal arcs above and below.
const BEACON = {
  width: 48,
  height: 30,
  displayWidth: 108,
  displayHeight: 67.5,
  transmitter: [24, 15],
} as const;
const ARCS = { a: 7.5, b: 12 } as const;
const BLINK_MS = 700;

function arc(radius: number, from: number, to: number): string {
  const [cx, cy] = BEACON.transmitter;
  const point = (angle: number) =>
    `${cx + radius * Math.cos(angle)} ${cy + radius * Math.sin(angle)}`;
  return `M${point(from)}A${radius} ${radius} 0 0 1 ${point(to)}`;
}

function beacon(frame: keyof typeof ARCS): string {
  const [lx, ly] = BEACON.transmitter;
  const radius = ARCS[frame];
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BEACON.displayWidth}" height="${BEACON.displayHeight}" viewBox="0 0 ${BEACON.width} ${BEACON.height}">`,
    `  <path d="M5.5 13.5h37v3h-37z" fill="#b6c4df" stroke="#303a51" stroke-width="1" />`,
    `  <path d="M7.5 13.8l2 2.4 2-2.4 2 2.4 2-2.4 2 2.4 2-2.4m21 0-2 2.4-2-2.4-2 2.4-2-2.4-2 2.4-2-2.4" fill="none" stroke="#4f5c79" stroke-width=".8" />`,
    ...[false, true].map(
      (mirror) => `  <g${mirror ? ' transform="translate(48 0) scale(-1 1)"' : ""}>
    <path d="M1 9.5 3.5 7H6l1.5 2.5v11L5.5 23h-2L1 20.5z" fill="${PANEL_FACE}" stroke="#bdc7dc" />
    <path d="M4 8v14M1.5 12H7m-5.5 5H7" fill="none" stroke="${PANEL_GRID}" stroke-width=".7" />
    <path d="M1.5 10 4 7.5h1.5" fill="none" stroke="#eef3fb" stroke-width=".8" />
  </g>`,
    ),
    `  <path d="M19 12.5 22 9.5h4l3 3v5l-3 3h-4l-3-3z" fill="#ad7965" stroke="#5c4a61" />`,
    `  <path d="M20 12.5 23 10h3l2 2.5-5 2.5z" fill="#d6a28c" />`,
    '  <path d="M21 17.5h1.5m3 0H27" fill="none" stroke="#ffe9b8" stroke-width=".8" />',
    `  <circle cx="${lx}" cy="${ly}" r="2.4" fill="#5a647d" />`,
    `  <circle cx="${lx}" cy="${ly}" r="1.35" fill="${WHITE}" />`,
    `  <path d="${arc(radius, Math.PI * 0.28, Math.PI * 0.72)}${arc(radius, Math.PI * 1.28, Math.PI * 1.72)}" fill="none" stroke="${POI}" stroke-width="1.5" stroke-linecap="round" />`,
    "</svg>",
    "",
  ].join("\n");
}

const beaconFrames = (["a", "b"] as const).map((frame) => ({
  id: `landmark-beacon-${frame}`,
  file: `beacon-${frame}.svg`,
  root: svgText(beacon(frame), SVG_DECIMALS.landmarks),
}));
const beaconSheetFile = "beacon-sheet.svg";
const beaconSheetPath = `/art/landmarks/${beaconSheetFile}`;
const installed = readManifest("core").assets.filter(
  (row): row is { id: string; path?: unknown; svgSheet?: unknown } =>
    beaconFrames.some(({ id }) => id === row.id),
);
const packedBeacon = installed.some(
  ({ path, svgSheet }) => path === beaconSheetPath || svgSheet === true,
);
if (
  packedBeacon &&
  (installed.length !== beaconFrames.length ||
    installed.some(
      ({ id, path, svgSheet }, index) =>
        id !== beaconFrames[index]!.id || path !== beaconSheetPath || svgSheet !== true,
    ))
) {
  throw new Error("The landmark beacon sheet selection must include both phases in source order");
}

function writeBeaconFrames(): void {
  if (!packedBeacon) {
    for (const { file, root } of beaconFrames) writeFileSync(dir + file, root);
    return;
  }

  // Reserve whole-pixel cells around the intrinsic viewports. The SVG roots retain their
  // authored fractional height and independent viewBox.
  const cell = { width: Math.ceil(BEACON.displayWidth), height: Math.ceil(BEACON.displayHeight) };
  const sheetWidth = cell.width * beaconFrames.length;
  const layout = packAtlas(
    { compare: () => 0, extrude: 0, maxSize: sheetWidth, widths: [sheetWidth] },
    [{ rectangles: beaconFrames.map(() => cell), value: beaconSheetFile }],
  );
  const page = layout?.pages[0];
  const slots = page?.placed[0]?.at;
  if (layout?.pages.length !== 1 || !page || slots?.length !== beaconFrames.length) {
    throw new Error("Cannot pack the landmark beacon sheet");
  }
  const roots = beaconFrames.map(({ id, root }, index) => {
    const { x, y } = slots[index]!;
    return `<svg id="${id}" x="${x}" y="${y}" ${root.slice("<svg ".length)}`;
  });
  const { width, height } = page;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  writeFileSync(dir + beaconSheetFile, `${svg}${roots.join("")}</svg>\n`);
}

writeFileSync(`${dir}nebula-outer.svg`, svgText(mass(OUTER, 10), SVG_DECIMALS.landmarks));
writeFileSync(`${dir}nebula-core.svg`, svgText(mass(CORE, 7), SVG_DECIMALS.landmarks));
writeFileSync(`${dir}nebula-stars.svg`, svgText(stars(), SVG_DECIMALS.landmarks));
writeFileSync(`${dir}wreck.svg`, svgText(wreck(), SVG_DECIMALS.landmarks));
writeBeaconFrames();

// The lost item's glint: a 15 x 15 sparkle, lavender rays and shade around a white core, on
// Stardust's loop. "W" white, "L" lavender, "D" shade, "." clear.
const GLINT_COLOURS: Readonly<Record<string, string>> = {
  D: "8f7c9c",
  L: POI.slice(1),
  W: "ffffff",
};
const GLINT = {
  rest: [
    "...............",
    "...............",
    "...............",
    "...............",
    ".......L.......",
    "......DLD......",
    ".....DLWLD.....",
    "....LLWWWLL....",
    ".....DLWLD.....",
    "......DLD......",
    ".......L.......",
    "...............",
    "...............",
    "...............",
    "...............",
  ],
  glint1: [
    "...............",
    "...............",
    ".......L.......",
    ".......L.......",
    ".......L.......",
    ".....L.L.L.....",
    ".....DLWLD.....",
    "..LLLLWWWLLLL..",
    ".....DLWLD.....",
    ".....L.L.L.....",
    ".......L.......",
    ".......L.......",
    ".......L.......",
    "...............",
    "...............",
  ],
  glint2: [
    ".......W.......",
    ".......L.......",
    ".......L.......",
    "...L...L...L...",
    "....L..L..L....",
    "......DLD......",
    ".....DLWLD.....",
    "WLLLLLWWWLLLLLW",
    ".....DLWLD.....",
    "......DLD......",
    "....L..L..L....",
    "...L...L...L...",
    ".......L.......",
    ".......L.......",
    ".......W.......",
  ],
} as const;
const LOOP = [
  ["rest", 420],
  ["glint1", 60],
  ["glint2", 80],
  ["glint1", 60],
] as const;
const GLINT_SIZE = 15;

function frame(rows: readonly string[]): Frame {
  return rows.map((row) => [...row].map((cell) => GLINT_COLOURS[cell] ?? null));
}

// The rays are light, as the cache's halo is: every frame carries the rest frame's core as its
// collision, the item Ada touches to collect it.
const CORE_ROWS = GLINT.rest.map((row, y) => (y === 4 || y === 10 ? "..............." : row));
const core = traceGrid("hunt-glint core", frame(CORE_ROWS)).collision;
const sheet = LOOP.map(([name]) => frame(GLINT[name]));
await writeSpriteSheet(
  { data: `${art}hunt-glint.json`, sheet: `${art}hunt-glint.png` },
  { key: "hunt-glint" },
  [["glint", sheet, LOOP.map(([, ms]) => ms)]],
);
writeFileSync(
  `${art}hunt-glint.json`,
  withCollision(
    readFileSync(`${art}hunt-glint.json`, "utf8"),
    LOOP.map(() => core),
  ),
);
await prettify(`${art}hunt-glint.json`);

// Core manifest entries, after the discovery cache and ore nugget, before the enemies.
const fixed = { facing: "fixed", pivot: { x: 0.5, y: 0.5 } } as const;
const svgEntry = (
  id: string,
  file: string,
  width: number,
  height: number,
  displayWidth: number,
  displayHeight: number,
) => ({
  id,
  path: `/art/landmarks/${file}`,
  width,
  height,
  displayWidth,
  displayHeight,
  ...fixed,
});
const entries = [
  svgEntry(
    "landmark-nebula-outer",
    "nebula-outer.svg",
    NEBULA.displayWidth,
    NEBULA.displayHeight,
    NEBULA.displayWidth,
    NEBULA.displayHeight,
  ),
  svgEntry(
    "landmark-nebula-core",
    "nebula-core.svg",
    NEBULA.displayWidth,
    NEBULA.displayHeight,
    NEBULA.displayWidth,
    NEBULA.displayHeight,
  ),
  svgEntry(
    "landmark-nebula-stars",
    "nebula-stars.svg",
    NEBULA.displayWidth,
    NEBULA.displayHeight,
    NEBULA.displayWidth,
    NEBULA.displayHeight,
  ),
  svgEntry(
    "landmark-wreck",
    "wreck.svg",
    WRECK.displayWidth,
    WRECK.displayHeight,
    WRECK.displayWidth,
    WRECK.displayHeight,
  ),
  ...beaconFrames.map(({ id, file }) => ({
    ...svgEntry(
      id,
      packedBeacon ? beaconSheetFile : file,
      packedBeacon ? BEACON.width : BEACON.displayWidth,
      packedBeacon ? BEACON.height : BEACON.displayHeight,
      BEACON.displayWidth,
      BEACON.displayHeight,
    ),
    frameMs: BLINK_MS,
    ...(packedBeacon
      ? {
          svgSheet: true,
          intrinsicWidth: BEACON.displayWidth,
          intrinsicHeight: BEACON.displayHeight,
        }
      : {}),
  })),
  {
    id: "hunt-glint",
    path: "/art/hunt-glint.png",
    width: GLINT_SIZE * LOOP.length,
    height: GLINT_SIZE,
    displayWidth: GLINT_SIZE,
    displayHeight: GLINT_SIZE,
    facing: "front",
    pivot: { x: 0.5, y: 0.5 },
    frameWidth: GLINT_SIZE,
    frameHeight: GLINT_SIZE,
    frames: { rest: 0, glint1: 1, glint2: 2 },
    loop: LOOP.map(([name, ms], index) => ({ frame: index, name, ms })),
  },
];
replaceEntries(
  "core",
  (id) => id.startsWith("landmark-") || id === "hunt-glint",
  entries,
  (id) => id.startsWith("enemy-"),
);
editManifest("core", (manifest) => {
  manifest.jobs = "/art/jobs.json";
});

// The data the scene and the Map draw from: which entries make each landmark, the nebula tints by
// galaxy id, and the search area, Map area and glint ping strokes, in logical px.
const data = {
  version: 1,
  landmarks: {
    nebula: {
      layers: [
        { id: "landmark-nebula-outer", tint: "nebulaOuter" },
        { id: "landmark-nebula-core", tint: "nebulaCore" },
        { id: "landmark-nebula-stars", keyline: "nebulaStars" },
      ],
    },
    wreck: { layers: [{ id: "landmark-wreck", keyline: "wreck" }] },
    beacon: {
      frames: ["landmark-beacon-a", "landmark-beacon-b"],
      frameMs: BLINK_MS,
      reducedMotion: "landmark-beacon-a",
      keyline: "beacon",
    },
  },
  tintRule: {
    dark: { toward: "pointOfInterest", ...RULE.dark },
    light: { toward: "ink", ...RULE.light },
  },
  tints: TINTS,
  searchArea: {
    colour: "pointOfInterest",
    width: 2,
    alpha: 0.8,
    dash: [12, 8],
    lightInk: { width: 4, alpha: 0.8 },
  },
  mapArea: { colour: "#feae34", width: 2, ink: 4, dash: [6, 4], minRadius: 19 },
  glint: {
    id: "hunt-glint",
    keyline: "huntGlint",
    reducedMotion: "rest",
    ping: {
      colour: "pointOfInterest",
      width: 1,
      lightInk: 3,
      from: 8,
      to: 28,
      aspect: 0.5,
      ms: 1200,
      alpha: [0.9, 0],
      reducedMotion: false,
    },
  },
};
writeFileSync(`${art}jobs.json`, json(data));
await prettify(`${art}jobs.json`);
