// The enemies' shots (bolt, Multi-Laser fan, Scattershot pellet, missiles), their ripple and
// fades, the enemy-only weapon effects (ring burst, mine, charged lance) and the enemy Phaser's
// aim line and beam: the shapes, widths, alpha keys and timings Tech draws in code, written to
// public/art/enemy-weapons.json and linked from the core manifest as `enemyWeapons`. The mine's
// collision is the union of its weapon-solids frames as convex parts, checked against them.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { contrast } from "@andornaut/art-kit/build/colour";
import { format, resolveConfig } from "prettier";

import { linkData } from "./manifest.ts";
import { json, projectAt } from "./projection.ts";
import { DISPLAY_SCALE, type Mesh, meshScale } from "./solid.ts";
import { visibleFragments } from "./visible.ts";
import { MINE_FRAME_DEGREES, MINE_FRAMES, mineSolids } from "./weapon-solids.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const MIN_CONTRAST = 5;

type V2 = readonly [number, number];

const space = JSON.parse(readFileSync(`${art}space-palette.json`, "utf8")) as {
  colors: Record<string, string>;
};
const fields = JSON.parse(readFileSync(`${art}galaxies.json`, "utf8")) as {
  lightField: { ink: string };
  galaxies: Record<string, { tint: { light?: boolean }; colors: { background: string } }>;
};

// Space palette roles, then the coral family's side and salvage plate (art/enemies.md).
const COLOURS = {
  obstacle: space.colors.obstacle!,
  weapon: space.colors.weapon!,
  coralSide: "#A8654F",
  plate: "#E6A890",
  white: "#FFFFFF",
  ink: fields.lightField.ink,
} as const;

// Every galaxy draws the shots over the ink edge, which holds 5:1 on each light galaxy's field;
// Phantom's dark field takes the same ink with no floor.
for (const [id, { tint, colors }] of Object.entries(fields.galaxies)) {
  if (!tint.light) continue;
  const ratio = contrast(colors.background.slice(1), COLOURS.ink.slice(1));
  if (ratio < MIN_CONTRAST) {
    throw new Error(`edge is ${ratio.toFixed(2)}:1 on ${id}, below ${MIN_CONTRAST}:1`);
  }
}

const round = (value: number) => Math.round(value * 1000) / 1000;
const point = (x: number, y: number): V2 => [round(x), round(y)];

// The aim grammar shared by the lance and the Phaser: dashed while aiming, solid when it will fire.
const TELL = { width: 1, dash: [6, 4] } as const;

// A beam's opaque bands in coral, plate and white, each `width` px at the nose then the end times
// `w`, and its opaque muzzle bloom discs in the same order (art/weapons.md, Beams).
const BAND_COLOURS = ["obstacle", "plate", "white"] as const;
const flatBeam = (widths: readonly V2[], radii: readonly number[]) => ({
  layers: widths.map((width, i) => ({ colour: BAND_COLOURS[i]!, width })),
  bloom: radii.map((radius, i) => ({ colour: BAND_COLOURS[i]!, radius })),
});

// Every linear fade (ripple, mine fizzle, Scattershot range fade) holds steps: a linear value
// over a step's threshold takes its alpha, and below the last threshold the fade holds `last`.
const FADE = {
  steps: [
    [0.6, 1],
    [0.3, 0.6],
  ],
  last: 0.3,
} as const;

// The enemy bolt, the ring dart's construction stretched to a bolt: a coral body with a white
// core over a coralSide tail wedge, its head at the shot's point.
const BOLT = {
  outer: [point(0, 0), point(-2.16, -1.785), point(-7.2, 0), point(-2.16, 1.785)],
  outerColour: "obstacle",
  inner: [point(-0.72, 0), point(-2.16, -0.95), point(-4.2, 0), point(-2.16, 0.95)],
  innerColour: "white",
  tail: { colour: "coralSide", points: [point(-4.8, -0.935), point(-12, 0), point(-4.8, 0.935)] },
} as const;

// The enemy Multi-Laser: far bolts are small coral darts; near the nose the volley draws Ada's
// band through the heads (art/weapons.md, Bolt, pellet and fan) in coral with a white inner band,
// its trailing edges notched `notch` px forward at the middle head, so it reads as a chevron.
const FAN = {
  far: {
    colour: "obstacle",
    points: [point(0, 0), point(-1.8, -1.105), point(-6, 0), point(-1.8, 1.105)],
  },
  near: {
    spacing: 5.6,
    colour: "obstacle",
    depth: 6.6,
    minRadius: 4,
    widen: 1.105,
    innerColour: "white",
    inner: { inset: 1.5, offset: 2.4 },
    notch: 1.8,
  },
} as const;

// The enemy Scattershot pellet: a coral diamond with a white core, turned to its heading.
const PELLET = {
  outer: [point(2.4, 0), point(0, -1.9), point(-2.4, 0), point(0, 1.9)],
  outerColour: "obstacle",
  inner: [point(1.2, 0), point(0.2, -0.8), point(-0.8, 0), point(0.2, 0.8)],
  innerColour: "white",
} as const;

// The enemy missiles: the weapon-solids frames of these projectiles over a coral flame with a
// plate inner wedge, in the geometry Ada's missiles use.
const MISSILES = {
  rapid: "enemyRapidMissile",
  heavy: "enemyHeavyMissile",
  flame: { colour: "obstacle", innerColour: "plate" },
} as const;

// The ring-burst contact: an amber ground ripple whose stroke thins from `stroke[0]` to
// `stroke[1]` over its life; reduced motion holds it at the full radius at `reducedMotion.stroke`.
const RIPPLE = { colour: "weapon", stroke: [2.2, 1.2], reducedMotion: { stroke: 2 } } as const;

const RING_BURST = {
  // The emission ring's alpha holds to each step's end in ms.
  emission: {
    ms: 180,
    stroke: 2,
    alpha: [
      [90, 1],
      [180, 0.5],
    ],
  },
  muzzle: {
    ms: 120,
    radius: [3.6, 0.6],
    core: { untilMs: 60, radius: [2, 0.4] },
  },
  dart: {
    outer: [point(2.6, 0), point(-0.6, -2.3), point(-3.8, 0), point(-0.6, 2.3)],
    outerColour: "obstacle",
    inner: [point(1, 0), point(-0.6, -1), point(-2.2, 0), point(-0.6, 1)],
    innerColour: "white",
    tail: { colour: "coralSide", points: [point(-3.2, -1), point(-10, 0), point(-3.2, 1)] },
  },
} as const;

// The mine turns clockwise on screen at `degPerSecond` and shows the weapon-solids frame of each
// `stepDeg` step.
const SPIN = { degPerSecond: 60, stepDeg: MINE_FRAME_DEGREES } as const;

// The convex hull of screen points, counter-clockwise in y-down screen space.
function hull(points: readonly V2[]): V2[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: V2, a: V2, b: V2) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: readonly V2[]) => {
    const chain: V2[] = [];
    for (const p of list) {
      while (chain.length >= 2 && cross(chain.at(-2)!, chain.at(-1)!, p) <= 1e-9) chain.pop();
      chain.push(p);
    }
    chain.pop();
    return chain;
  };
  return [...half(sorted), ...half(sorted.toReversed())];
}

// The mine's collision covers its whole stud sweep: the union of its eight frames' silhouettes,
// as the screen outline of each convex solid in logical px about the mine's centre. The ball,
// belt, collar and lamp are the same in every frame; the four studs take each frame's step, so
// 32 stud outlines ring the body.
const outline = (solid: Mesh): V2[] =>
  hull(solid.flatMap(({ points }) => points.map((p) => projectAt(0, 0, p)))).map(([x, y]) =>
    point(x, y),
  );
const frames = Array.from({ length: MINE_FRAMES }, (_, j) => mineSolids(j * MINE_FRAME_DEGREES));
const [first] = frames;
const body = [first![0]!, first![1]!, ...first!.slice(-2)];
const collision = [...body, ...frames.flatMap((solids) => solids.slice(2, -2))].map(outline);

// Checks the parts against the drawn frames on a 0.02 px grid: every pixel a frame draws lies in
// the parts, and against the union of the frames the parts have an IoU of at least 0.98 with
// every mismatch within 0.5 px of an edge.
{
  const step = 0.02;
  const all = collision.flat();
  const [x0, x1] = [Math.min(...all.map(([x]) => x)) - 1, Math.max(...all.map(([x]) => x)) + 1];
  const [y0, y1] = [Math.min(...all.map(([, y]) => y)) - 1, Math.max(...all.map(([, y]) => y)) + 1];
  const columns = Math.ceil((x1 - x0) / step);
  const rows = Math.ceil((y1 - y0) / step);
  // Fill a polygon's even-odd interior, sampled at cell centres, into `grid`.
  const fill = (grid: Uint8Array, polygon: readonly V2[]) => {
    for (let row = 0; row < rows; row++) {
      const y = y0 + (row + 0.5) * step;
      const crossings: number[] = [];
      polygon.forEach((a, i) => {
        const b = polygon[(i + 1) % polygon.length]!;
        if (a[1] <= y !== b[1] <= y)
          crossings.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
      });
      crossings.sort((a, b) => a - b);
      for (let k = 0; k + 1 < crossings.length; k += 2) {
        const from = Math.max(0, Math.ceil((crossings[k]! - x0) / step - 0.5));
        const to = Math.min(columns - 1, Math.floor((crossings[k + 1]! - x0) / step - 0.5));
        for (let column = from; column <= to; column++) grid[row * columns + column] = 1;
      }
    }
  };
  const traced = new Uint8Array(columns * rows);
  for (const part of collision) fill(traced, part);
  const drawn = new Uint8Array(columns * rows);
  for (const solids of frames) {
    const scale = 1 / DISPLAY_SCALE;
    for (const { points } of visibleFragments(
      meshScale(solids.flat(), [scale, scale, scale]),
      (p) => p,
    )) {
      fill(
        drawn,
        points.map(([x, y]): V2 => [x * DISPLAY_SCALE, y * DISPLAY_SCALE]),
      );
    }
  }
  const edges = collision.flatMap((part) =>
    part.map((a, i) => [a, part[(i + 1) % part.length]!] as const),
  );
  const segmentDistance = ([a, b]: readonly [V2, V2], x: number, y: number) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
  };
  let both = 0;
  let either = 0;
  let uncovered = 0;
  let worst = 0;
  for (let cell = 0; cell < traced.length; cell++) {
    const [d, t] = [drawn[cell]!, traced[cell]!];
    if (d && t) both++;
    if (d || t) either++;
    if (d !== t) {
      const x = x0 + ((cell % columns) + 0.5) * step;
      const y = y0 + (Math.floor(cell / columns) + 0.5) * step;
      const edge = Math.min(...edges.map((segment) => segmentDistance(segment, x, y)));
      if (d && edge > step) uncovered++;
      worst = Math.max(worst, edge);
    }
  }
  const iou = both / either;
  if (uncovered > 0 || iou < 0.98 || worst > 0.5) {
    throw new Error(
      `mine collision IoU ${iou.toFixed(4)}, worst ${worst.toFixed(3)} px, ${uncovered} drawn cells uncovered`,
    );
  }
  console.log(
    `mine collision: ${collision.length} parts, IoU ${iou.toFixed(4)}, worst ${worst.toFixed(3)} px`,
  );
}

const MINE_DATA = {
  spin: SPIN,
  // Blink: the lamp shows its blink frame for `onMs` of each `periodMs`, phased from the drop, in
  // the first band whose `aboveRemainingMs` the mine's remaining life exceeds.
  blink: [
    { aboveRemainingMs: 4000, periodMs: 1000, onMs: 120 },
    { aboveRemainingMs: 1500, periodMs: 500, onMs: 100 },
    { aboveRemainingMs: 0, periodMs: 250, onMs: 80 },
  ],
  hint: { ms: 4000, radius: 11, stroke: 1.2, startDeg: -90 },
  fizzle: { ms: 200 },
  // The pop's shockwave shapes that take the field edge: the amber ring, not the cream ellipse.
  pop: { edged: ["ring"] },
  collision,
  reducedMotion: {
    fizzleMs: 200,
    pop: { ms: 200, radius: 16, stroke: 2, fill: 0.15, strokeAlpha: 0.9 },
  },
};

// The hit spark's length; its shapes are the shared contact families (art/weapons.md).
const SPARK = { ms: 160 } as const;

const LANCE = {
  trackMs: 700,
  lockMs: 300,
  flashMs: 300,
  tracking: { ...TELL, marchPxPerSecond: 60 },
  locked: {
    width: 1.5,
    pulses: [
      [0, 60],
      [200, 260],
    ],
    pulseHalo: { radius: 4.5, alpha: 0.5, colour: "plate" },
  },
  charge: { radius: [1, 3.5], core: [0.5, 1.5] },
  keys: [
    [0, 0.5, 0.9],
    [30, 1.2, 1],
    [120, 1, 1],
    [300, 0.35, 0],
  ],
  ...flatBeam(
    [
      [9, 6.8],
      [5.4, 4],
      [2.4, 1.6],
    ],
    [6.5, 4.2, 2.3],
  ),
  spark: SPARK,
  reducedMotion: {
    widthFactor: 1,
    bloom: false,
    holdMs: 180,
  },
} as const;

const PHASER = {
  aimMs: 400,
  solidFromMs: 300,
  flashMs: 150,
  aiming: { ...TELL, width: 1.5 },
  solid: { width: 1.5 },
  // The aim's end chevron, `u` from the aim's end.
  chevron: [point(3, 0), point(-1, -3), point(-1, 3)],
  charge: { radius: [1, 2.5], core: [0.5, 1.1] },
  keys: [
    [0, 0.55, 0.85],
    [20, 1, 1],
    [70, 1, 1],
    [150, 0.4, 0],
  ],
  ...flatBeam(
    [
      [8, 5],
      [4.6, 2.8],
      [2.2, 1.3],
    ],
    [5, 3.1, 1.6],
  ),
  missFade: 28,
  spark: SPARK,
  reducedMotion: {
    widthFactor: 1,
    bloom: false,
    holdMs: 90,
  },
} as const;

const dataPath = `${art}enemy-weapons.json`;
writeFileSync(
  dataPath,
  await format(
    json({
      version: 1,
      colours: COLOURS,
      lightField: { edge: 1, dash: [8, 2] },
      fade: FADE,
      bolt: BOLT,
      fan: FAN,
      pellet: PELLET,
      missiles: MISSILES,
      ripple: RIPPLE,
      ringBurst: RING_BURST,
      mine: MINE_DATA,
      lance: LANCE,
      phaser: PHASER,
    }),
    { ...(await resolveConfig(dataPath)), filepath: dataPath },
  ),
);

linkData("core", { enemyWeapons: "/art/enemy-weapons.json" });
