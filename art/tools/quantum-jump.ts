import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { ellipse, line } from "@andornaut/art-kit/draw";
import { blankImage } from "@andornaut/art-kit/rgbaImage";
import { format, resolveConfig } from "prettier";

import { linkData, placeEntries } from "./manifest.ts";
import {
  blend,
  blur,
  disc,
  filled,
  over,
  resize,
  rgba,
  type RgbaImage,
  writePng,
} from "./paint.ts";
import { IN_BETWEEN, SHIMMER, SPACE_BG } from "./palette.ts";
import { Random } from "./random.ts";
import { centredView, LOGICAL_PER_DESIGN, shimmer } from "./shimmer.ts";
import { svgPaths } from "./ship-paths.ts";
import { DISPLAY, drawn, FRAME, type Pose, SCHEMES } from "./ship-model.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));

// The field canvas: 960 by 540 logical px at 1 image px per logical px, like the aboard backdrop.
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

// The warp tunnel: the in-between field wrapped round the jump centre, angle to field x and
// depth (inverse radius) to field y, both mirrored because the field does not tile. The far end
// darkens toward the deepest ramp value and streaks run outward in the rim and shimmer colours.
// Six frames loop: each advances the depth a sixth of the mirrored period and every streak a
// whole number of laps per loop.
// Within `coreRadius` the darkening reaches the full deepest value, hiding the depth aliasing.
const TUNNEL = {
  coreRadius: 40,
  cycle: 6,
  darkRadius: 150,
  darkness: 0.75,
  depth: 5200,
  streaks: 70,
} as const;

function tunnel(source: RgbaImage, step: number): RgbaImage {
  const { height, width } = source;
  const out = blankImage(width, height);
  const [cx, cy] = [width / 2, height / 2];
  const period = 2 * (height - 1);
  const deep = rgba(IN_BETWEEN[0]);
  const sample = (u: number, v: number, c: number) => {
    const [x0, y0] = [Math.floor(u), Math.floor(v)];
    const [x1, y1] = [Math.min(x0 + 1, width - 1), Math.min(y0 + 1, height - 1)];
    const [fx, fy] = [u - x0, v - y0];
    const at = (x: number, y: number) => source.data[(y * width + x) * 4 + c]!;
    const top = at(x0, y0) * (1 - fx) + at(x1, y0) * fx;
    const bottom = at(x0, y1) * (1 - fx) + at(x1, y1) * fx;
    return top * (1 - fy) + bottom * fy;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [dx, dy] = [x + 0.5 - cx, y + 0.5 - cy];
      const r = Math.hypot(dx, dy);
      const u = (Math.abs(Math.atan2(dy, dx)) / Math.PI) * (width - 1);
      const depth = TUNNEL.depth / Math.max(r, 6) + (step * period) / TUNNEL.cycle;
      const v = Math.abs((depth % period) - (height - 1));
      const near = Math.min(
        1,
        Math.max(0, 1 - r / TUNNEL.darkRadius) ** 1.5 * TUNNEL.darkness +
          Math.max(0, 1 - r / TUNNEL.coreRadius) * (1 - TUNNEL.darkness),
      );
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        out.data[i + c] = Math.round(sample(u, v, c) * (1 - near) + deep[c]! * near);
      }
      out.data[i + 3] = 255;
    }
  }
  // Streaks at 2x, reduced onto the tunnel.
  const layer = blankImage(width * 2, height * 2);
  const random = new Random(23);
  for (let n = 0; n < TUNNEL.streaks; n++) {
    const angle = random.random() * 2 * Math.PI;
    const base = random.random();
    const laps = 1 + Math.floor(random.random() * 2);
    const s = (base + (step * laps) / TUNNEL.cycle) % 1;
    const r0 = 30 + s * s * 520;
    const r1 = r0 * (1.25 + 0.5 * s);
    const colour = n % 3 === 0 ? SHIMMER : IN_BETWEEN[4];
    const end = (radius: number) => ({
      x: 2 * (cx + Math.cos(angle) * radius),
      y: 2 * (cy + Math.sin(angle) * radius),
    });
    line(
      { fill: rgba(colour, Math.round(70 + 150 * s)), width: s < 0.6 ? 2 : 4 },
      [end(r0), end(r1)],
      layer,
    );
  }
  over(out, resize(layer, width, height));
  return out;
}

const tunnelSource = FIELDS[0]![1];
const TUNNEL_FRAMES: readonly (readonly [string, RgbaImage])[] = [
  ...Array.from({ length: TUNNEL.cycle }, (_, i) => [`t${i}`, tunnel(tunnelSource, i)] as const),
];
// The jump step's bright tunnel: the next loop frame 22% toward the lightest ramp value, as the
// field's jump frame.
const TUNNEL_SHEET: readonly (readonly [string, RgbaImage])[] = [
  ...TUNNEL_FRAMES,
  ["jump", toward(tunnel(tunnelSource, TUNNEL.cycle - 1), IN_BETWEEN[4], 0.22)],
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
const tunnelSheet = sheet(
  TUNNEL_SHEET.map(([, image]) => image),
  1,
);
writePng(`${art}quantum-jump-tunnel.png`, tunnelSheet, true);

// Warp ship poses at the arrival heading, drawn from the shared ship model in every paint: banks
// (roll, degrees), a stretch along the hull and a squash across it, about the pivot. "sprite" in a
// step is the in-game idle frame instead. Frames are 256 frame px square, pivot at the centre,
// at the sprite's display scale, so a step's scale 1 is the in-game size.
const WARP_HEADING = 24;
const WARP_FRAME = 256;
const POSES: readonly (Omit<Pose, "yaw"> & { readonly id: string })[] = [
  { id: "bank-8", roll: 8 },
  { id: "bank-16", roll: 16, thrust: true },
  { id: "bank-24", roll: 24, thrust: true },
  { id: "bank-30", roll: 30, thrust: true },
  { id: "stretch-30", roll: 30, squash: 0.85, stretch: 3.2, thrust: true },
  { id: "settle-24", roll: 24, stretch: 1.8, thrust: true },
  { id: "settle-16", roll: 16, stretch: 1.3, thrust: true },
  { id: "settle-10", roll: 10, stretch: 1.1, thrust: true },
  { id: "settle-5", roll: 5 },
];
const posePath = (scheme: string, pose: string) => `/art/quantum-jump-ship/${scheme}/${pose}.svg`;

function poseSvg(scheme: (typeof SCHEMES)[number], pose: (typeof POSES)[number]): string {
  const polygons = drawn(WARP_FRAME / 2, scheme.paint, { ...pose, yaw: WARP_HEADING });
  for (const { outline } of polygons) {
    if (outline.some(([x, y]) => Math.min(x, y) < 2 || Math.max(x, y) > WARP_FRAME - 2)) {
      throw new Error(`warp pose ${pose.id} leaves its ${WARP_FRAME} frame`);
    }
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WARP_FRAME}" height="${WARP_FRAME}" viewBox="0 0 ${WARP_FRAME} ${WARP_FRAME}">`,
    `  <title>Quantum jump ship ${pose.id} ${scheme.name}</title>`,
    ...svgPaths(polygons).map(({ color, path }) => `  <path fill="${color}" d="${path}"/>`),
    "</svg>",
    "",
  ].join("\n");
}

for (const scheme of SCHEMES) {
  mkdirSync(`${art}quantum-jump-ship/${scheme.id}`, { recursive: true });
  for (const pose of POSES) {
    writeFileSync(
      `${art}${posePath(scheme.id, pose.id).slice("/art/".length)}`,
      poseSvg(scheme, pose),
    );
  }
}

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
placeEntries("core", "quantum-jump", [
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
  entry(
    "quantum-jump-tunnel",
    tunnelSheet,
    CANVAS.width,
    CANVAS.height,
    TUNNEL_SHEET.map(([name]) => name),
  ),
]);

// Logical px: 360 per 390 design px. Iris radii are fractions of the view's half-diagonal
// while they reach the screen edges and logical px while they hug the ship.
const px = (design: number) => Math.round(design * LOGICAL_PER_DESIGN);
const HALF_DIAGONAL = Math.hypot(844 / 2, 390 / 2);
const reach = (design: number) => Math.round((design / HALF_DIAGONAL) * 1000) / 1000;

// Warp steps within each phase: the tunnel frame and its opening, the ship's pose, scale and
// whitening, the glow and the speck streaks. Steps hold; nothing tweens between them.
type Ship = { pose: string; scale: number; turn?: number; white?: number };
type Step = {
  ms: number;
  glow?: string;
  iris?: { radius: number } | { reach: number };
  ship?: Ship;
  star?: true;
  streak?: number;
  tunnel?: string;
};
const ship = (pose: string, scale: number, white = 0): Ship => ({
  pose,
  scale,
  ...(white ? { white } : {}),
});
const turn = (share: number): Ship => ({ pose: "sprite", scale: 1, turn: share });
const STEPS: Readonly<Record<string, readonly Step[]>> = {
  space: [{ ms: 100 }],
  charge: [1 / 3, 2 / 3, 1].map((share) => ({
    ms: 50,
    glow: "full",
    ship: turn(Math.round(share * 1000) / 1000),
    streak: 1,
  })),
  close: (
    [
      [0.86, "bank-8", 1.25, 0.1],
      [0.74, "bank-16", 1.55, 0.2],
      [0.62, "bank-24", 1.9, 0.3],
    ] as const
  ).map(([open, pose, scale, white], i) => ({
    ms: 50,
    glow: "full",
    iris: { reach: open },
    ship: ship(pose, scale, white),
    streak: 1.4,
    tunnel: `t${i}`,
  })),
  tight: (
    [
      [2.6, 0.2],
      [3.2, 0.3],
    ] as const
  ).map(([scale, white], i) => ({
    ms: 60,
    glow: "full",
    ship: ship("bank-30", scale, white),
    tunnel: `t${3 + i}`,
  })),
  jump: [{ ms: 80, ship: ship("stretch-30", 3.3, 0.7), star: true, tunnel: "jump" }],
  open: (
    [
      [46, "settle-24", 2.8, 0.35],
      [90, "settle-16", 2.3, 0.25],
      [140, "settle-10", 1.85, 0.15],
      [196, "settle-5", 1.55, 0.1],
      [258, "sprite", 1.3, 0.05],
      [320, "sprite", 1.1, 0],
    ] as const
  ).map(([radius, pose, scale, white], i) => ({
    ms: 50,
    glow: "mid",
    iris: { radius },
    ship: ship(pose, scale, white),
    tunnel: `t${i}`,
  })),
  clear: [0.86, 0.96].map((open, i) => ({
    ms: 50,
    glow: "low",
    iris: { reach: open },
    ship: ship("sprite", 1),
    tunnel: `t${i}`,
  })),
};

// CLEANUP (added 2026-11-12): each phase's iris, field, white and streak fields drive the
// renderer in use, which draws one hold per phase. Remove them, and the field frames close,
// tight, jump, open and clear, once Tech draws the warp steps.
const PHASES = [
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
];
for (const phase of PHASES) {
  const total = STEPS[phase.name]!.reduce((sum, step) => sum + step.ms, 0);
  if (total !== phase.ms) {
    throw new Error(`warp steps for ${phase.name} last ${total} ms, not ${phase.ms}`);
  }
}

const effect = {
  version: 1,
  durationMs: 1000,
  frames: PHASES.map((phase) => ({ ...phase, steps: STEPS[phase.name] })),
  warp: {
    heading: WARP_HEADING,
    frame: WARP_FRAME,
    displayScale: DISPLAY / FRAME,
    tunnel: "quantum-jump-tunnel",
    poses: POSES.map(({ id, roll = 0, squash = 1, stretch = 1, thrust = false }) => ({
      id,
      roll,
      stretch,
      squash,
      thrust,
      paths: Object.fromEntries(SCHEMES.map((scheme) => [scheme.id, posePath(scheme.id, id)])),
    })),
  },
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
    // The ship holds still at its place above the cross-fade, then cross-fades into the
    // destination's ship (or out, on a destination without it).
    ship: { holdToMs: 550, crossFadeToMs: 750 },
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

// The core manifest names the effect data next to the space palette.
linkData("core", { quantumJump: "/art/quantum-jump.json" });
