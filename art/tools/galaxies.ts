// Galaxy hues: each galaxy retints the space field (background, environment and detail) to one
// Oklab hue and chroma, keeping each role's lightness offset; signals keep their colours. A light
// galaxy mirrors the role steps below its background and carries the light-field rule. Each
// galaxy also takes a route-map marker colour, and a galaxy without captured art a placeholder
// selector preview.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { contrast } from "@andornaut/art-kit/colour";
import { format, resolveConfig } from "prettier";

import { linkData, replaceEntries } from "./manifest.ts";
import { fromOklab, hex, rgb, toOklab } from "./oklab.ts";
import {
  disc,
  fillPolygon,
  filled,
  grey,
  polyline,
  rgba,
  type RgbaImage,
  writePng,
  type Xy,
} from "./paint.ts";
import { json } from "./projection.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));

const FIELD = ["background", "environment", "environmentDetail"] as const;
const SIGNALS = ["pointOfInterest", "obstacle", "active", "weapon", "shipHardpoint"] as const;
const MIN_CONTRAST = 5;
const INK = "#181425";

type Tint = { lightness: number; chroma: number; hue: number; light?: true };

// Galaxies by stable id, in id order. Route order, numbers, names and flavour lines are
// Gameplay's. Sunflower's background is Chibi's farm yellow #D8C994.
const GALAXIES: Readonly<Record<string, Tint>> = {
  andromeda: { lightness: 0, chroma: 0.05, hue: 278 },
  "black-eye": { lightness: -0.05, chroma: 0.034, hue: 320 },
  cartwheel: { lightness: 0, chroma: 0.036, hue: 30 },
  needle: { lightness: -0.025, chroma: 0.008, hue: 60 },
  sunflower: { lightness: 0.5549, chroma: 0.0714, hue: 94.2, light: true },
  whirlpool: { lightness: 0, chroma: 0.034, hue: 215 },
};

// Bank fields by id: tints kept for a later galaxy and assigned to none; Gameplay places them.
const BANK: Readonly<Record<string, Tint>> = {
  "dark-gold": { lightness: 0, chroma: 0.038, hue: 80 },
};

// Route-map markers (art/galaxies.md "Markers"): a light galaxy's marker is its background; a
// dark galaxy's takes Oklab L `lightness` at its tint hue with `chromaScale` times its chroma.
// Every locked marker is one grey, so it gives away no hue. Ink numbers sit on every face.
const MARKER = { lightness: 0.83, chromaScale: 2, locked: "#8B8B8B" } as const;
const MIN_MARKER_INK = 4.5;
const MIN_MARKER_DISTANCE = 0.055;
const MIN_LOCKED_DISTANCE = 0.15;

// Galaxies whose space art is not built yet: their selector previews are drawn placeholders.
const PLACEHOLDERS = ["andromeda", "needle"] as const;

// Field paint: Oklab lightness below 0.45 and chroma below 0.06.
const FIELD_PAINT = { lightness: 0.45, chroma: 0.06 } as const;

// The selector's preview: a half-scale crop of a HUD-free capture in the galaxy's own field;
// locked previews map its ITU-R 601 luma Y to offset + scale * Y.
const PREVIEW = {
  crop: { width: 360, height: 180 },
  width: 180,
  height: 90,
  locked: { offset: 30, scale: 0.6 },
};

// The light-field rule (art/galaxies.md "Light fields"), drawn by Tech in a light galaxy. Widths
// are logical px; the jet layers replace the ship's and the enemies' jet layers.
const LIGHT_FIELD = {
  ink: INK,
  keyline: 1,
  // Drawn over the keyline: play objects and pickups, then the amber and coral effects.
  keylined: [
    "ship",
    "swarm",
    "fighter",
    "interceptor",
    "retaliator",
    "frigate",
    "capital",
    "asteroid",
    "stardust",
    "discoveryCache",
    "outpost",
    "station",
    "holodisk",
    "upgradePickup",
    "wreck",
    "beacon",
    "nebulaStars",
    "huntGlint",
    "strandedCraft",
  ],
  effects: ["missile", "blastRing", "blastFlash", "hitSpark", "destructionShards"],
  // Places Ada visits take a wider keyline, so they read at a glance on a light field
  // (art/destinations.md): every station, outpost, settlement and story place.
  destinationKeyline: { width: 2, kinds: ["station", "outpost", "storyPlace"] },
  // The status pill's 1 px ink outlines, as on the +N tick.
  hudOutline: { width: 1, parts: ["shieldIcon", "shieldBar"] },
  shotEdge: 1,
  phaser: { glow: { width: [6.5, 4], alpha: 0.9 }, bloom: { radius: 5, alpha: 0.6 } },
  indicatorStroke: 4,
  // Edge markers' ink outline, as the Scattershot dot's (space-palette.md, Edge markers).
  markerOutline: 1,
  jets: {
    // CLEANUP (added 2026-11-12): engine level 1's light layers for the runtime that predates
    // shipLevels. Remove once Tech reads shipLevels for Ada's jets.
    ship: [
      { name: "outer", colors: ["#1767b3", "#1767b3"], width: 1.6, length: 1 },
      { name: "core", colors: ["#2585d0", "#64caff"], width: 0.8, length: 0.55 },
    ],
    // Ada's light-field jets by engine level: a flat dark outer and a core gradient, no halo.
    shipLevels: [
      {
        level: 1,
        layers: [
          { name: "outer", colors: ["#1767b3", "#1767b3"], width: 1.6, length: 1 },
          { name: "core", colors: ["#2585d0", "#64caff"], width: 0.8, length: 0.55 },
        ],
      },
      {
        level: 2,
        layers: [
          { name: "outer", colors: ["#a84400", "#a84400"], width: 1.6, length: 1 },
          { name: "core", colors: ["#ea6a00", "#ffb24d"], width: 0.8, length: 0.55 },
        ],
      },
      {
        level: 3,
        layers: [
          { name: "outer", colors: ["#7a3fd6", "#7a3fd6"], width: 1.6, length: 1 },
          { name: "core", colors: ["#8652e7", "#b98cff"], width: 0.8, length: 0.55 },
        ],
      },
    ],
    enemy: [
      { name: "outer", colors: ["#7f4b3d", "#7f4b3d"], width: 1.6, length: 1 },
      { name: "core", colors: ["#a8654f", "#d68b72"], width: 0.8, length: 0.55 },
    ],
  },
  holodiskBeacon: "base",
} as const;

const lightnessOf = (colour: string) => toOklab(rgb(colour))[0];

// A role keeps its Oklab L step from the base background; a light tint mirrors the step below it.
function tint({ chroma, hue, light, lightness }: Tint, background: number, colour: string): string {
  const L = lightnessOf(colour);
  const stepped = light ? 2 * background - L : L;
  const h = (hue * Math.PI) / 180;
  return hex(
    fromOklab(stepped + lightness, chroma * Math.cos(h), chroma * Math.sin(h)),
  ).toUpperCase();
}

const base = JSON.parse(readFileSync(`${art}space-palette.json`, "utf8")) as {
  colors: Record<string, string>;
};
const baseBackground = lightnessOf(base.colors.background!);
function field(id: string, t: Tint): Record<string, string> {
  const colors = Object.fromEntries(
    FIELD.map((role) => [role, tint(t, baseBackground, base.colors[role]!)]),
  );
  // On a light field every play object sits in an ink keyline, so the keyline carries the signal.
  const edges: [string, string][] = t.light
    ? [["ink keyline", INK]]
    : SIGNALS.map((signal) => [signal, base.colors[signal]!]);
  for (const [name, edge] of edges) {
    const ratio = contrast(colors.background!.slice(1), edge.slice(1));
    if (ratio < MIN_CONTRAST) {
      throw new Error(`${name} on ${id} is ${ratio.toFixed(2)}:1, below ${MIN_CONTRAST}:1`);
    }
  }
  return colors;
}

function marker(t: Tint, colors: Record<string, string>): string {
  if (t.light) {
    return colors.background!;
  }
  const h = (t.hue * Math.PI) / 180;
  const c = t.chroma * MARKER.chromaScale;
  return hex(fromOklab(MARKER.lightness, c * Math.cos(h), c * Math.sin(h))).toUpperCase();
}

const distance = (a: string, b: string) => {
  const [p, q] = [toOklab(rgb(a)), toOklab(rgb(b))];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
};

const galaxies = Object.fromEntries(
  Object.entries(GALAXIES).map(([id, t]) => {
    const colors = field(id, t);
    return [id, { tint: t, colors, marker: marker(t, colors) }];
  }),
);
const bank = Object.fromEntries(
  Object.entries(BANK).map(([id, t]) => [id, { tint: t, colors: field(id, t) }]),
);

// Ink numbers read on every face; markers stay apart from each other and from the locked grey.
const faces: [string, string][] = [
  ...Object.entries(galaxies).map(([id, g]): [string, string] => [id, g.marker]),
  ["locked", MARKER.locked],
];
for (const [id, m] of faces) {
  const ratio = contrast(m.slice(1), INK.slice(1));
  if (ratio < MIN_MARKER_INK) {
    throw new Error(`ink on the ${id} marker is ${ratio.toFixed(2)}:1, below ${MIN_MARKER_INK}:1`);
  }
}
const ids = Object.keys(galaxies);
for (const [i, a] of ids.entries()) {
  const locked = distance(galaxies[a]!.marker, MARKER.locked);
  if (locked < MIN_LOCKED_DISTANCE) {
    throw new Error(`the ${a} marker is ${locked.toFixed(3)} from the locked grey`);
  }
  for (const b of ids.slice(i + 1)) {
    const d = distance(galaxies[a]!.marker, galaxies[b]!.marker);
    if (d < MIN_MARKER_DISTANCE) {
      throw new Error(`the ${a} and ${b} markers are ${d.toFixed(3)} apart`);
    }
  }
}

const dataPath = `${art}galaxies.json`;
writeFileSync(
  dataPath,
  await format(
    json({
      version: 1,
      fieldPaint: FIELD_PAINT,
      preview: PREVIEW,
      marker: MARKER,
      lightField: LIGHT_FIELD,
      galaxies,
      bank,
    }),
    { ...(await resolveConfig(dataPath)), filepath: dataPath },
  ),
);

linkData("core", { galaxyFields: "/art/galaxies.json" });

// ------------------------------------------------------------------ placeholder previews

// A placeholder preview at the selector's size, in field tones only, with an identifying motif
// centred where a capture puts the first destination (a third in), a dashed 1 px frame and a
// hatched corner that mark it as a placeholder.
function ellipsePoints([cx, cy]: Xy, rx: number, ry: number, degrees: number): Xy[] {
  const r = (degrees * Math.PI) / 180;
  return Array.from({ length: 48 }, (_, k) => {
    const a = (k / 48) * 2 * Math.PI;
    const x = rx * Math.cos(a);
    const y = ry * Math.sin(a);
    return [cx + x * Math.cos(r) - y * Math.sin(r), cy + x * Math.sin(r) + y * Math.cos(r)] as Xy;
  });
}

function placeholder(id: (typeof PLACEHOLDERS)[number], colors: Record<string, string>): RgbaImage {
  const { width, height } = PREVIEW;
  const image = filled(rgba(colors.background!), width, height);
  const env = rgba(colors.environment!);
  const det = rgba(colors.environmentDetail!);
  const centre: Xy = [width / 3, height / 2];
  if (id === "andromeda") {
    // A tilted two-armed spiral seen near face on: a disc, two arms and a core.
    const tilt = 18;
    fillPolygon(image, ellipsePoints(centre, 40, 15, tilt), env);
    const r = (tilt * Math.PI) / 180;
    for (const start of [0, Math.PI]) {
      const arm = Array.from({ length: 60 }, (_, k) => {
        const a = start + k * 0.09;
        const radius = 5 + k * 0.55;
        const x = radius * Math.cos(a);
        const y = radius * Math.sin(a) * 0.38;
        return [
          centre[0] + x * Math.cos(r) - y * Math.sin(r),
          centre[1] + x * Math.sin(r) + y * Math.cos(r),
        ] as Xy;
      });
      polyline(image, arm, det, 2);
    }
    fillPolygon(image, ellipsePoints(centre, 9, 4, tilt), det);
  } else {
    // A thin galaxy seen edge on: one long silver line with a small central bulge.
    const a = (-12 * Math.PI) / 180;
    const along = (t: number, lift = 0): Xy => [
      centre[0] + t * Math.cos(a),
      centre[1] + t * Math.sin(a) + lift,
    ];
    polyline(image, [along(-70), along(140)], env, 5);
    polyline(image, [along(-70), along(140)], det, 2);
    fillPolygon(image, ellipsePoints(centre, 14, 4, -12), det);
    for (const [k, t] of [-60, -44, -30, -18, 18, 30, 48, 66, 88, 110, 128].entries()) {
      disc(image, along(t, ((k * 7) % 5) - 2), 0.5, det);
    }
  }
  for (let x = 2; x < width - 2; x += 4) {
    polyline(
      image,
      [
        [x, 2],
        [x + 1, 2],
      ],
      det,
      1,
    );
    polyline(
      image,
      [
        [x, height - 3],
        [x + 1, height - 3],
      ],
      det,
      1,
    );
  }
  for (let y = 2; y < height - 2; y += 4) {
    polyline(
      image,
      [
        [2, y],
        [2, y + 1],
      ],
      det,
      1,
    );
    polyline(
      image,
      [
        [width - 3, y],
        [width - 3, y + 1],
      ],
      det,
      1,
    );
  }
  for (let k = 0; k < 24; k += 4) {
    polyline(
      image,
      [
        [width - 24 + k, height - 4],
        [width - 4, height - 24 + k],
      ],
      det,
      1,
    );
  }
  return image;
}

// The locked rule: each pixel 30 + 0.6 Y, Y the ITU-R 601 luma, truncated.
function locked(image: RgbaImage): RgbaImage {
  const out = grey(image);
  for (let i = 0; i < out.width * out.height; i++) {
    const v = Math.trunc(PREVIEW.locked.offset + PREVIEW.locked.scale * out.data[i * 4]!);
    out.data.set([v, v, v, 255], i * 4);
  }
  return out;
}

const previewDir = `${art}previews/`;
mkdirSync(previewDir, { recursive: true });
const previewEntries = PLACEHOLDERS.flatMap((id) =>
  (
    [
      ["", placeholder(id, galaxies[id]!.colors)],
      // Locked captures fly the base field, so the greyed placeholder draws on it too.
      ["-locked", locked(placeholder(id, base.colors))],
    ] as const
  ).map(([suffix, image]) => {
    writePng(`${previewDir}galaxy-${id}${suffix}.png`, image, true);
    return {
      id: `galaxy-preview-${id}${suffix}`,
      path: `/art/previews/galaxy-${id}${suffix}.png`,
      width: PREVIEW.width,
      height: PREVIEW.height,
      displayWidth: PREVIEW.width,
      displayHeight: PREVIEW.height,
      facing: "front",
      pivot: { x: 0, y: 0 },
      placeholder: true,
    };
  }),
);
replaceEntries("core", (id) => id.startsWith("galaxy-preview-"), previewEntries);
