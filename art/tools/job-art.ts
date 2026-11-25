import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { format, resolveConfig } from "prettier";

import { editManifest, replaceEntries } from "./manifest.ts";
import { stageRows } from "./polish-rows.ts";
import { SVG_DECIMALS, svgText } from "./svg-text.ts";
import { hex, rgb } from "./oklab.ts";
import { json } from "./projection.ts";

// Job art in space (art/jobs.md): the nebula landmark's layers, with per-galaxy tints keyed by
// galaxy id, and the data the scene and the Map draw every job landmark, the search area and the
// lost item's glint from, in public/art/jobs.json, the core manifest's `jobs` link. The survey
// beacon, the wreck and the glint are friendly objects (art/tools/friendly.ts).

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

// The survey beacon blinks on this step (art/friendly-redesign.md draws it).
const BLINK_MS = 700;

writeFileSync(`${dir}nebula-outer.svg`, svgText(mass(OUTER, 10), SVG_DECIMALS.landmarks));
writeFileSync(`${dir}nebula-core.svg`, svgText(mass(CORE, 7), SVG_DECIMALS.landmarks));
writeFileSync(`${dir}nebula-stars.svg`, svgText(stars(), SVG_DECIMALS.landmarks));

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
];
replaceEntries(
  "core",
  (id) => id.startsWith("landmark-nebula-"),
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
// The staged ping (art/jobs.md): a stroke that narrows with progress `p` and fades in held
// steps. It replaces `glint.ping` whole.
stageRows("effects-ping", {
  file: "/art/jobs.json",
  glint: {
    ping: {
      colour: data.glint.ping.colour,
      // The stroke at p 0 and at p 1, linear between.
      width: [2, 1],
      // The light-field ink ring: a px of ink each side of the widest stroke.
      lightInk: 4,
      from: data.glint.ping.from,
      to: data.glint.ping.to,
      aspect: data.glint.ping.aspect,
      ms: data.glint.ping.ms,
      fade: {
        steps: [
          { from: 0, alpha: 1 },
          { from: 0.5, alpha: 0.6 },
          { from: 0.8, alpha: 0.3 },
        ],
      },
      reducedMotion: data.glint.ping.reducedMotion,
    },
  },
});
await prettify(`${art}jobs.json`);
