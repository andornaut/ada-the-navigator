import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { blankImage } from "@andornaut/art-kit/build/rgbaImage";
import { encodeLossyWebp } from "@andornaut/art-kit/build/webp";
import { format, resolveConfig } from "prettier";

import { linkData, placeEntries } from "./manifest.ts";
import {
  blend,
  disc,
  filled,
  fillPolygon,
  over,
  resize,
  rgba,
  type RgbaImage,
  writePng,
} from "./paint.ts";
import { IN_BETWEEN, SHIMMER, SPACE_BG } from "./palette.ts";
import { SHIP_HEADING_CONTRACT } from "./projection.ts";
import { LOGICAL_PER_DESIGN } from "./shimmer.ts";
import { DISPLAY, FRAME, forwardJetMouths, SCHEMES } from "./ship-model.ts";
import { plumeReach } from "./ship-jet-layers.ts";
import { AUTHORED_JET_CURVE } from "./ship-jet-svg.ts";
import { writeShipMaterials } from "./ship-materials.ts";
import { WARP_FRAME, WARP_HEADING, WARP_POSES as POSES } from "./ship-poses.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const dataOnly = process.argv.includes("--data-only");
const paintOnly = process.argv.includes("--paint-only");

// The field canvas: 960 by 540 logical px at 1 image px per logical px, like the aboard backdrop.
const CANVAS = { width: 960, height: 540 } as const;
const GLOW = "a8dcff";
const RED = "e43b44";
// Emergency tint: the red wash over the charge frame and the red still in-between.
const RED_WASH = 0.15;

const toward = (image: RgbaImage, colour: string, t: number) =>
  blend(image, filled(rgba(colour), image.width, image.height), t);
const mix = (from: string, to: string, t: number) => {
  const [a, b] = [rgba(from), rgba(to)];
  return [0, 1, 2].map((c) => Math.round(a[c]! + (b[c]! - a[c]!) * t)) as [number, number, number];
};
// Shapes draw at SS times the frame and reduce onto it, for clean flat edges.
const SS = 2;
const polar = (radius: number, degrees: number): [number, number] => [
  radius * Math.cos((degrees * Math.PI) / 180),
  radius * Math.sin((degrees * Math.PI) / 180),
];

// The warp tunnel: eight flat walls round the jump centre, in nested depth steps that halve in
// size, each wall one tone under the one light from the upper left and each step deeper toward
// the deepest ramp value, with a flat core. Eight wedges run outward on the wall seams, lilac
// and cyan in turn. Six frames loop: each advances the depth a sixth of a step and every wedge
// a sixth of its run.
const TUNNEL = {
  cycle: 6,
  sides: 8,
  // Depth steps drawn, the outermost reaching past the canvas corners.
  steps: 4,
  // The outermost step's corner radius as a share of the canvas half-diagonal.
  reach: 1.1,
  light: [-0.6, -0.8],
  // A wall is lit above this share of the light and shaded below its negative.
  facing: 0.45,
  // How far the deepest step moves toward the deepest ramp value.
  darkness: 0.72,
  // The jump step's bright frame: this far toward the lightest ramp value.
  bright: 0.3,
  wedges: { length: 46, halfWidth: 2.2, from: 0.16, run: 0.5, stagger: 0.37 },
} as const;

function tunnel(phase: number, bright = false): RgbaImage {
  const { height, width } = CANVAS;
  const out = filled(rgba(IN_BETWEEN[2]), width * SS, height * SS);
  const [cx, cy] = [(width * SS) / 2, (height * SS) / 2];
  const reach = Math.hypot(width / 2, height / 2) * TUNNEL.reach * SS;
  const corner = 180 / TUNNEL.sides;
  const lift = (tone: readonly number[]) =>
    bright
      ? tone.map((v, c) => Math.round(v + (rgba(IN_BETWEEN[4])[c]! - v) * TUNNEL.bright))
      : tone;
  const paint = (tone: readonly number[]) =>
    [...lift(tone), 255] as unknown as ReturnType<typeof rgba>;
  const radius = (step: number) => reach * 0.5 ** (step - phase);
  for (let step = 0; step < TUNNEL.steps; step++) {
    const depth = Math.min(1, (step + 1 - phase) / TUNNEL.steps);
    for (let i = 0; i < TUNNEL.sides; i++) {
      const [a0, a1] = [corner + 2 * corner * i, corner + 2 * corner * (i + 1)];
      const middle = (((a0 + a1) / 2) * Math.PI) / 180;
      // The wall faces the jump centre.
      const lit = -Math.cos(middle) * -TUNNEL.light[0] - Math.sin(middle) * -TUNNEL.light[1];
      const wall =
        lit > TUNNEL.facing ? IN_BETWEEN[3] : lit > -TUNNEL.facing ? IN_BETWEEN[2] : IN_BETWEEN[1];
      const at = (r: number, degrees: number): [number, number] => {
        const [x, y] = polar(r, degrees);
        return [cx + x, cy + y];
      };
      fillPolygon(
        out,
        [
          at(radius(step), a0),
          at(radius(step), a1),
          at(radius(step + 1), a1),
          at(radius(step + 1), a0),
        ],
        paint(mix(wall, IN_BETWEEN[0], TUNNEL.darkness * depth)),
      );
    }
  }
  fillPolygon(
    out,
    Array.from({ length: TUNNEL.sides }, (_, i): [number, number] => {
      const [x, y] = polar(radius(TUNNEL.steps), corner + 2 * corner * i);
      return [cx + x, cy + y];
    }),
    paint(rgba(IN_BETWEEN[0]).slice(0, 3)),
  );
  const { from, halfWidth, length, run, stagger } = TUNNEL.wedges;
  for (let i = 0; i < TUNNEL.sides; i++) {
    const seam = corner + 2 * corner * i;
    const start = reach * (from + run * ((phase + i * stagger) % 1));
    const [bx, by] = polar(start, seam);
    const [tx, ty] = polar(start + length * SS, seam);
    const [nx, ny] = polar(halfWidth * SS, seam + 90);
    fillPolygon(
      out,
      [
        [cx + bx, cy + by],
        [cx + tx + nx, cy + ty + ny],
        [cx + tx - nx, cy + ty - ny],
      ],
      rgba(i % 2 === 1 ? SHIMMER : IN_BETWEEN[4]),
    );
  }
  return resize(out, width, height);
}

// The field frames of the renderer in use: the flat tunnel at one phase per hold. Reduced
// motion holds a still one 45% toward the space background.
const still = toward(tunnel(0), SPACE_BG, 0.45);
const FIELDS: readonly (readonly [string, RgbaImage])[] = [
  ["close", tunnel(0)],
  ["tight", tunnel(2 / TUNNEL.cycle)],
  // The one bright frame.
  ["jump", tunnel((TUNNEL.cycle - 1) / TUNNEL.cycle, true)],
  ["open", tunnel(3 / TUNNEL.cycle)],
  ["clear", tunnel(4 / TUNNEL.cycle)],
  ["still", still],
  ["still-emergency", toward(still, RED, RED_WASH)],
];

const TUNNEL_FRAMES: readonly (readonly [string, RgbaImage])[] = Array.from(
  { length: TUNNEL.cycle },
  (_, i) => [`t${i}`, tunnel(i / TUNNEL.cycle)] as const,
);
const TUNNEL_SHEET: readonly (readonly [string, RgbaImage])[] = [
  ...TUNNEL_FRAMES,
  ["jump", tunnel((TUNNEL.cycle - 1) / TUNNEL.cycle, true)],
];

// Charge glow round the ship: two flat discs, the outer of radius 26 + 10 g design px at alpha
// 0.35 g and the inner 0.72 of it at alpha 0.55 g over the outer.
const GLOW_SIZE = 112;
const GLOW_DISCS = { inner: 0.72, alpha: [0.35, 0.55] } as const;
const LEVELS: readonly (readonly [string, number, string])[] = [
  ["full", 1, GLOW],
  ["mid", 0.6, GLOW],
  ["low", 0.2, GLOW],
  ["emergency", 1, RED],
];

function glow(level: number, colour: string): RgbaImage {
  const image = blankImage(GLOW_SIZE * SS, GLOW_SIZE * SS);
  const c = (GLOW_SIZE * SS) / 2;
  const outer = (26 + 10 * level) * LOGICAL_PER_DESIGN * SS;
  const [far, near] = [GLOW_DISCS.alpha[0] * level, GLOW_DISCS.alpha[1] * level];
  disc(image, [c, c], outer, rgba(colour, Math.round(255 * far)));
  disc(
    image,
    [c, c],
    outer * GLOW_DISCS.inner,
    rgba(colour, Math.round(255 * (1 - (1 - far) * (1 - near)))),
  );
  return resize(image, GLOW_SIZE, GLOW_SIZE);
}

// The jump frame's star: a four-point lilac burst 18 px to its points, a white four-point burst
// of 10 px over it and a white core.
const STAR = 37;
const STAR_BURSTS = [
  { radius: 18, waist: 0.3, colour: IN_BETWEEN[4] },
  { radius: 10.2, waist: 0.34, colour: "ffffff" },
] as const;
const STAR_CORE = 3.6;

function star(): RgbaImage {
  const scale = 4;
  const image = blankImage(STAR * scale, STAR * scale);
  const c = (STAR * scale) / 2;
  for (const { colour, radius, waist } of STAR_BURSTS) {
    fillPolygon(
      image,
      Array.from({ length: 8 }, (_, i): [number, number] => {
        const [x, y] = polar(radius * scale * (i % 2 === 0 ? 1 : waist), 45 * i);
        return [c + x, c + y];
      }),
      rgba(colour),
    );
  }
  disc(image, [c, c], STAR_CORE * scale, rgba("ffffff"));
  return resize(image, STAR, STAR);
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
// The field and tunnel sheets are opaque lossy WebP at quality 90: every alpha byte maps to 255
// and the stored RGB channels are encoded without compositing.
const OPAQUE_WEBP = { quality: 90, method: 6, alphaQuality: 100, exact: false } as const;
if (!dataOnly && !paintOnly) {
  writeFileSync(
    `${art}quantum-jump-field.webp`,
    await encodeLossyWebp(OPAQUE_WEBP, {
      ...fieldSheet,
      data: fieldSheet.data.map((channel, index) => (index % 4 === 3 ? 255 : channel)),
    }),
  );
}
if (!dataOnly && !paintOnly) writePng(`${art}quantum-jump-glow.png`, glowSheet);
if (!dataOnly && !paintOnly) writePng(`${art}quantum-jump-star.png`, starImage);
const tunnelSheet = sheet(
  TUNNEL_SHEET.map(([, image]) => image),
  1,
);
if (!dataOnly && !paintOnly) {
  writeFileSync(
    `${art}quantum-jump-tunnel.webp`,
    await encodeLossyWebp(OPAQUE_WEBP, {
      ...tunnelSheet,
      data: tunnelSheet.data.map((channel, index) => (index % 4 === 3 ? 255 : channel)),
    }),
  );
}

// Warp ship poses at the arrival heading, drawn from the shared ship model in every paint: banks
// (roll, degrees), a stretch along the hull and a squash across it, about the pivot. "sprite" in a
// step is the in-game idle frame instead. Frames are 256 frame px square, pivot at the centre,
// at the sprite's display scale, so a step's scale 1 is the in-game size.
const posePath = (scheme: string, pose: string) => `/art/quantum-jump-ship/${scheme}/${pose}.svg`;

// Pose paths remain logical metadata; the runtime resolves their shared material geometry.

const entry = (
  id: string,
  image: RgbaImage,
  frameWidth: number,
  frameHeight: number,
  names: readonly string[],
) => ({
  id,
  path: `/art/${id}.${
    id === "quantum-jump-field" || id === "quantum-jump-tunnel" ? "webp" : "png"
  }`,
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
if (!dataOnly && !paintOnly)
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
  shipHeadings: SHIP_HEADING_CONTRACT,
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
      ...(thrust
        ? {
            jets: {
              version: 1,
              frame: WARP_FRAME,
              length: AUTHORED_JET_CURVE,
              headings: [
                {
                  index: 0,
                  mouths: forwardJetMouths(
                    WARP_FRAME / 2,
                    { yaw: WARP_HEADING, roll, squash, stretch },
                    plumeReach(AUTHORED_JET_CURVE.base),
                  ),
                },
              ],
            },
          }
        : {}),
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
if (!paintOnly) {
  writeFileSync(dataPath, JSON.stringify(effect));
  writeFileSync(
    dataPath,
    await format(readFileSync(dataPath, "utf8"), {
      ...(await resolveConfig(dataPath)),
      filepath: dataPath,
    }),
  );
}

// The core manifest names the effect data next to the space palette.
if (!dataOnly && !paintOnly) {
  linkData("core", { quantumJump: "/art/quantum-jump.json" });
  writeShipMaterials();
}
