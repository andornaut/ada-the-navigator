import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { ellipse, line } from "@andornaut/art-kit/draw";
import { blankImage } from "@andornaut/art-kit/rgbaImage";
import { format, resolveConfig } from "prettier";

import { placeEntries } from "./manifest.ts";
import { blend, blur, disc, filled, over, rgba, type RgbaImage, writePng } from "./paint.ts";
import { IN_BETWEEN, SHIMMER, SPACE_BG } from "./palette.ts";
import { json } from "./projection.ts";
import { centredView, LOGICAL_PER_DESIGN, shimmer } from "./shimmer.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));

// The field canvas: 960 by 540 logical px at 1 image px per logical px, like the cockpit.
const CANVAS = { width: 960, height: 540 } as const;
const GLOW = "a8dcff";
const RED = "e43b44";
// Emergency tint: the red wash over the charge frame and the red still in-between.
const RED_WASH = 0.15;

const view = centredView(CANVAS.width, CANVAS.height, 1);
const toward = (image: RgbaImage, colour: string, t: number) =>
  blend(image, filled(rgba(colour), image.width, image.height), t);
// Reduced motion: 25% band contrast, no sparkle, 45% toward the space background.
const still = toward(shimmer(view, { contrast: 0.25, sparkle: false }), SPACE_BG, 0.45);
const FIELDS: readonly (readonly [string, RgbaImage])[] = [
  ["close", shimmer(view, { phase: 0 })],
  ["tight", shimmer(view, { phase: 0.18 })],
  // The one bright frame: 22% toward the lightest ramp value.
  ["jump", toward(shimmer(view, { phase: 0.36 }), IN_BETWEEN[4], 0.22)],
  ["open", shimmer(view, { phase: 0.54 })],
  ["clear", shimmer(view, { phase: 0.7 })],
  ["still", still],
  ["still-emergency", toward(still, RED, RED_WASH)],
];

// Charge glow round the ship: a soft disc, radius 26 + 10 g design px, alpha 120 g.
const GLOW_SIZE = 112;
const LEVELS: readonly (readonly [string, number, string])[] = [
  ["full", 1, GLOW],
  ["mid", 0.6, GLOW],
  ["low", 0.2, GLOW],
  ["emergency", 1, RED],
];
function glow(level: number, colour: string): RgbaImage {
  const image = blankImage(GLOW_SIZE, GLOW_SIZE);
  const c = GLOW_SIZE / 2;
  disc(
    image,
    [c, c],
    (26 + 10 * level) * LOGICAL_PER_DESIGN,
    rgba(colour, Math.trunc(120 * level)),
  );
  blur(image, 8 * LOGICAL_PER_DESIGN);
  return image;
}

// The jump frame's star: four 3 px arms of 18 px, four 2 px diagonals and a white core.
const STAR = 37;
function star(): RgbaImage {
  const image = blankImage(STAR, STAR);
  const c = (STAR - 1) / 2;
  const light = rgba(IN_BETWEEN[4]);
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    line(
      { fill: light, width: 3 },
      [
        { x: c, y: c },
        { x: c + dx * 18, y: c + dy * 18 },
      ],
      image,
    );
  }
  for (const [dx, dy] of [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ] as const) {
    line(
      { fill: light, width: 2 },
      [
        { x: c, y: c },
        { x: c + dx * 18 * 0.45, y: c + dy * 18 * 0.45 },
      ],
      image,
    );
  }
  ellipse({ fill: rgba("ffffff") }, { x0: c - 5, y0: c - 5, x1: c + 5, y1: c + 5 }, image);
  return image;
}

function sheet(frames: readonly RgbaImage[], columns: number): RgbaImage {
  const { height, width } = frames[0]!;
  const rows = Math.ceil(frames.length / columns);
  const out = blankImage(width * Math.min(columns, frames.length), height * rows);
  frames.forEach((frame, i) =>
    over(out, frame, (i % columns) * width, Math.floor(i / columns) * height),
  );
  return out;
}

const fieldSheet = sheet(
  FIELDS.map(([, image]) => image),
  1,
);
const glowSheet = sheet(
  LEVELS.map(([, level, colour]) => glow(level, colour)),
  LEVELS.length,
);
const starImage = star();
writePng(`${art}quantum-jump-field.png`, fieldSheet, true);
writePng(`${art}quantum-jump-glow.png`, glowSheet);
writePng(`${art}quantum-jump-star.png`, starImage);

const entry = (
  id: string,
  image: RgbaImage,
  frameWidth: number,
  frameHeight: number,
  names: readonly string[],
) => ({
  id,
  path: `/art/${id}.png`,
  width: image.width,
  height: image.height,
  displayWidth: frameWidth,
  displayHeight: frameHeight,
  facing: "front",
  pivot: { x: 0.5, y: 0.5 },
  frameWidth,
  frameHeight,
  frames: Object.fromEntries(names.map((name, i) => [name, i])),
});
placeEntries("quantum-jump", [
  entry(
    "quantum-jump-field",
    fieldSheet,
    CANVAS.width,
    CANVAS.height,
    FIELDS.map(([name]) => name),
  ),
  entry(
    "quantum-jump-glow",
    glowSheet,
    GLOW_SIZE,
    GLOW_SIZE,
    LEVELS.map(([name]) => name),
  ),
  entry("quantum-jump-star", starImage, STAR, STAR, ["jump"]),
]);

// Logical px: 360 per 390 design px. Iris radii are fractions of the view's half-diagonal
// while they reach the screen edges and logical px while they hug the ship.
const px = (design: number) => Math.round(design * LOGICAL_PER_DESIGN);
const HALF_DIAGONAL = Math.hypot(844 / 2, 390 / 2);
const reach = (design: number) => Math.round((design / HALF_DIAGONAL) * 1000) / 1000;
const effect = {
  version: 1,
  durationMs: 1000,
  frames: [
    { name: "space", startMs: 0, ms: 100 },
    { name: "charge", startMs: 100, ms: 150, glow: "full", streak: 1 },
    {
      name: "close",
      startMs: 250,
      ms: 150,
      iris: { reach: reach(300) },
      field: "close",
      glow: "full",
      white: 0.3,
      streak: 1.4,
    },
    {
      name: "tight",
      startMs: 400,
      ms: 120,
      iris: { radius: px(72) },
      field: "tight",
      glow: "full",
      white: 0.7,
    },
    { name: "jump", startMs: 520, ms: 80, field: "jump", star: true, bright: true },
    {
      name: "open",
      startMs: 600,
      ms: 300,
      destination: true,
      iris: { radius: px(130) },
      field: "open",
      glow: "mid",
      white: 0.6,
    },
    {
      name: "clear",
      startMs: 900,
      ms: 100,
      destination: true,
      iris: { reach: reach(430) },
      field: "clear",
      glow: "low",
    },
  ],
  iris: {
    rim: { colour: `#${IN_BETWEEN[4]}`, from: 0, to: 3 },
    line: { colour: `#${SHIMMER}`, at: 5, width: 1 },
  },
  streak: { colour: "#4a4858", length: px(8), width: 1 },
  emergency: {
    charge: { glow: "emergency", wash: { colour: `#${RED}`, alpha: RED_WASH } },
    still: "still-emergency",
  },
  reducedMotion: {
    durationMs: 900,
    still: "still",
    steps: [
      { fromMs: 0, toMs: 100, show: "source" },
      { fromMs: 100, toMs: 400, crossFade: ["source", "still"] },
      { fromMs: 400, toMs: 550, show: "still" },
      { fromMs: 550, toMs: 750, crossFade: ["still", "destination"] },
      { fromMs: 750, toMs: 900, show: "destination" },
    ],
  },
};
const dataPath = `${art}quantum-jump.json`;
writeFileSync(dataPath, JSON.stringify(effect));
writeFileSync(
  dataPath,
  await format(readFileSync(dataPath, "utf8"), {
    ...(await resolveConfig(dataPath)),
    filepath: dataPath,
  }),
);

// The root manifest names the effect data next to the space palette.
const manifestPath = `${art}manifest.json`;
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
if (manifest.quantumJump !== "/art/quantum-jump.json") {
  manifest.quantumJump = "/art/quantum-jump.json";
  writeFileSync(manifestPath, json(manifest));
}
