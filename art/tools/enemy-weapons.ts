// Enemy-only weapon effects (ring burst, mine, charged lance) and the enemy Phaser's aim line and
// beam: the shapes, widths, alpha keys and timings Tech draws in code, written to
// public/art/enemy-weapons.json and linked from the core manifest as `enemyWeapons`. The mine's
// collision is its drawn silhouette as analytic convex parts, checked against the drawing.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { contrast } from "@andornaut/art-kit/colour";
import { format, resolveConfig } from "prettier";

import { linkData } from "./manifest.ts";
import { json } from "./projection.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const MIN_CONTRAST = 5;

type V2 = readonly [number, number];

const space = JSON.parse(readFileSync(`${art}space-palette.json`, "utf8")) as {
  colors: Record<string, string>;
};
const fields = JSON.parse(readFileSync(`${art}galaxies.json`, "utf8")) as {
  lightField: { ink: string };
  galaxies: { id: string; tint: { light?: boolean }; colors: { background: string } }[];
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
type Colour = keyof typeof COLOURS;

// Every colour that carries a shape at alpha 1 holds 5:1 on each dark galaxy; on a light galaxy
// the ink edge carries it.
const CARRIERS: readonly Colour[] = ["obstacle", "weapon", "plate", "white"];
for (const { id, tint, colors } of fields.galaxies) {
  const bg = colors.background.slice(1);
  const checks: readonly Colour[] = tint.light ? ["ink"] : CARRIERS;
  for (const name of checks) {
    const ratio = contrast(bg, COLOURS[name].slice(1));
    if (ratio < MIN_CONTRAST) {
      throw new Error(`${name} is ${ratio.toFixed(2)}:1 on ${id}, below ${MIN_CONTRAST}:1`);
    }
  }
}

const round = (value: number) => Math.round(value * 1000) / 1000;
const point = (x: number, y: number): V2 => [round(x), round(y)];

// The aim grammar shared by the lance and the Phaser: dashed while aiming, solid when it will fire.
const TELL = { width: 1, dash: [6, 4], colour: "obstacle" } as const;

const RING_BURST = {
  emission: { ms: 180, stroke: 1.5, colour: "obstacle" },
  muzzle: {
    ms: 120,
    radius: [3.6, 0.6],
    colour: "obstacle",
    core: { untilMs: 60, radius: [2, 0.4], colour: "white" },
  },
  dart: {
    outer: [point(2.2, 0), point(-0.6, -2), point(-3.6, 0), point(-0.6, 2)],
    outerColour: "obstacle",
    inner: [point(0.8, 0), point(-0.6, -0.9), point(-2, 0), point(-0.6, 0.9)],
    innerColour: "white",
    tail: { head: -3, length: 9, width: [2, 0.5], alpha: [0.9, 0], colour: "obstacle" },
  },
} as const;

// The spiked mine, at spin 0: spike i points along screen angle 45 i degrees (0 is screen right,
// angles clockwise on screen), and the whole mine turns clockwise at `spin.degPerSecond`.
const MINE = {
  spin: { degPerSecond: 60 },
  spikes: { count: 8, tip: 7.5, base: 3.6, halfWidth: 1.5, colour: "obstacle" },
  body: { radius: 5, colour: "coralSide" },
  top: { radius: 4.3, offset: point(-0.6, -0.7), colour: "obstacle" },
  core: {
    ring: { radius: 2.5, colour: "ink" },
    light: { radius: 1.5, colour: "weapon" },
    flash: { radius: 1.8, colour: "white" },
  },
} as const;

function spike(i: number): V2[] {
  const { count, tip, base, halfWidth } = MINE.spikes;
  const angle = (2 * Math.PI * i) / count;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    point(c * tip, s * tip),
    point(c * base + s * halfWidth, s * base - c * halfWidth),
    point(c * base - s * halfWidth, s * base + c * halfWidth),
  ];
}

// The body disc as an inscribed regular polygon; its edges lie within 0.03 px of the circle.
const BODY_SIDES = 32;
const bodyPolygon = Array.from({ length: BODY_SIDES }, (_, i) => {
  const angle = (2 * Math.PI * (i + 0.5)) / BODY_SIDES;
  return point(Math.cos(angle) * MINE.body.radius, Math.sin(angle) * MINE.body.radius);
});
const collision = [bodyPolygon, ...Array.from({ length: MINE.spikes.count }, (_, i) => spike(i))];

const inConvex = (part: readonly V2[], x: number, y: number) =>
  part.every((a, i) => {
    const b = part[(i + 1) % part.length]!;
    return (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) >= 0;
  });
const orient = (part: V2[]) => {
  const area = part.reduce((sum, a, i) => {
    const b = part[(i + 1) % part.length]!;
    return sum + a[0] * b[1] - b[0] * a[1];
  }, 0);
  return area < 0 ? [...part].reverse() : part;
};
const segmentDistance = (a: V2, b: V2, x: number, y: number) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
};

// Checks the parts against the drawn silhouette (the body circle and the exact spike triangles)
// on a 0.02 px grid: IoU at least 0.98 and every mismatch within 1 px of the drawn edge.
{
  const parts = collision.map(orient);
  const spikes = Array.from({ length: MINE.spikes.count }, (_, i) => orient(spike(i)));
  const reach = MINE.spikes.tip + 0.5;
  const step = 0.02;
  let both = 0;
  let either = 0;
  let worst = 0;
  for (let y = -reach; y <= reach; y += step) {
    for (let x = -reach; x <= reach; x += step) {
      const drawn =
        Math.hypot(x, y) <= MINE.body.radius || spikes.some((part) => inConvex(part, x, y));
      const traced = parts.some((part) => inConvex(part, x, y));
      if (drawn && traced) both++;
      if (drawn || traced) either++;
      if (drawn !== traced) {
        const edge = Math.min(
          Math.abs(Math.hypot(x, y) - MINE.body.radius),
          ...spikes.flatMap((part) =>
            part.map((a, i) => segmentDistance(a, part[(i + 1) % part.length]!, x, y)),
          ),
        );
        worst = Math.max(worst, edge);
      }
    }
  }
  const iou = both / either;
  if (iou < 0.98 || worst > 1) {
    throw new Error(`mine collision IoU ${iou.toFixed(4)}, worst ${worst.toFixed(3)} px`);
  }
  console.log(`mine collision: IoU ${iou.toFixed(4)}, worst ${worst.toFixed(3)} px`);
}

const MINE_DATA = {
  ...MINE,
  // Blink: the core shows `flash` for `onMs` of each `periodMs`, phased from the drop, in the
  // first band whose `aboveRemainingMs` the mine's remaining life exceeds.
  blink: [
    { aboveRemainingMs: 4000, periodMs: 1000, onMs: 120 },
    { aboveRemainingMs: 1500, periodMs: 500, onMs: 100 },
    { aboveRemainingMs: 0, periodMs: 250, onMs: 80 },
  ],
  hint: { ms: 4000, radius: 11, stroke: 1.2, startDeg: -90, colour: "obstacle" },
  fizzle: {
    ms: 200,
    flecks: {
      count: 4,
      startDeg: 45,
      radius: 1,
      distance: [5, 11],
      yScale: 0.75,
      colour: "obstacle",
    },
  },
  pop: {
    ms: 220,
    growMs: 110,
    radius: [5, 16],
    stroke: [2, 1],
    tint: 0.14,
    colour: "obstacle",
    flecks: {
      count: 4,
      startDeg: 20,
      radius: 1.1,
      distance: [4, 13],
      yScale: 0.6,
      ms: 180,
      colour: "obstacle",
    },
    flash: {
      radius: 6,
      steps: [
        { fromMs: 0, toMs: 40, scale: 1, alpha: 0.95 },
        { fromMs: 40, toMs: 80, scale: 0.55, alpha: 0.6 },
      ],
      layers: [
        { scale: 1.25, colour: "obstacle", alpha: 0.3 },
        { scale: 1, colour: "obstacle", alpha: 0.85 },
        { scale: 0.66, colour: "plate", alpha: 1 },
        { scale: 0.36, colour: "white", alpha: 1 },
      ],
    },
  },
  collision,
  reducedMotion: {
    fizzleMs: 200,
    pop: { ms: 200, radius: 16, stroke: 2, fill: 0.15, strokeAlpha: 0.9 },
  },
};

// The Phaser hit spark (art/weapons.md), recoloured: rays white then coral, coral flecks.
const SPARK = { ms: 160, rays: ["white", "obstacle"], core: "white", flecks: "obstacle" } as const;

const LANCE = {
  trackMs: 700,
  lockMs: 300,
  flashMs: 300,
  tracking: { ...TELL, marchPxPerSecond: 60 },
  locked: {
    width: 1.5,
    colour: "plate",
    pulses: [
      [0, 60],
      [200, 260],
    ],
    pulseColour: "white",
    pulseHalo: { radius: 4.5, alpha: 0.5, colour: "plate" },
  },
  charge: { radius: [1, 3.5], core: [0.5, 1.5], colour: "obstacle", coreColour: "white" },
  keys: [
    [0, 0.5, 0.9],
    [30, 1.2, 1],
    [120, 1, 1],
    [300, 0.35, 0],
  ],
  layers: [
    { part: "glow", colour: "obstacle", width: [12, 9], alpha: 0.45 },
    { part: "body", colour: "obstacle", width: [6, 4.5], alpha: 1 },
    { part: "core", colour: "white", width: [2.4, 1.6], alpha: 1 },
  ],
  bloom: [
    { colour: "obstacle", radius: 7, alpha: 0.3 },
    { colour: "obstacle", radius: 4.5, alpha: 0.9 },
    { colour: "white", radius: 2.5, alpha: 1 },
  ],
  spark: { ...SPARK, scale: 1.35 },
  lightField: { glow: { width: [10, 7.5], alpha: 0.9 }, bloomAlpha: 0.6 },
  reducedMotion: {
    line: { width: 3, colour: "obstacle" },
    edge: { width: 6, alpha: 0.35, colour: "obstacle", lightAlpha: 0.9 },
    holdMs: 180,
    ms: 300,
    spark: { radius: 4, stroke: 1.5, colour: "obstacle" },
  },
} as const;

const PHASER = {
  aimMs: 400,
  solidFromMs: 300,
  flashMs: 150,
  aiming: TELL,
  solid: { width: 1, colour: "plate" },
  endTick: { length: 5 },
  charge: { radius: [1, 2.5], core: [0.5, 1.1], colour: "obstacle", coreColour: "white" },
  keys: [
    [0, 0.55, 0.85],
    [20, 1, 1],
    [70, 1, 1],
    [150, 0.4, 0],
  ],
  layers: [
    { part: "glow", colour: "obstacle", width: [8, 5], alpha: 0.38 },
    { part: "body", colour: "obstacle", width: [4, 2.4], alpha: 1 },
    { part: "core", colour: "white", width: [1.8, 1], alpha: 1 },
  ],
  bloom: [
    { colour: "obstacle", radius: 5, alpha: 0.3 },
    { colour: "obstacle", radius: 2.9, alpha: 0.9 },
    { colour: "white", radius: 1.6, alpha: 1 },
  ],
  missFade: 28,
  spark: { ...SPARK, scale: 1 },
  lightField: { glow: { width: [6.5, 4], alpha: 0.9 }, bloomAlpha: 0.6 },
  reducedMotion: {
    line: { width: 2, colour: "obstacle" },
    edge: { width: 4, alpha: 0.35, colour: "obstacle", lightAlpha: 0.9 },
    holdMs: 90,
    ms: 150,
    spark: { radius: 3, stroke: 1.5, colour: "obstacle" },
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
      ringBurst: RING_BURST,
      mine: MINE_DATA,
      lance: LANCE,
      phaser: PHASER,
    }),
    { ...(await resolveConfig(dataPath)), filepath: dataPath },
  ),
);

linkData("core", { enemyWeapons: "/art/enemy-weapons.json" });
