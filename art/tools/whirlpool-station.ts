// The Eddy: an open spiral with an inward current chase and a layered ocean-coloured core.
// Contract: art/whirlpool.md (Station). Usage: node art/tools/whirlpool-station.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { contrast } from "@andornaut/art-kit/build/colour";

import { replaceEntries } from "./manifest.ts";
import { floorColour } from "./palette.ts";
import { placed, RIGHT, svgFile } from "./needle-common.ts";
import { round } from "./projection.ts";
import {
  blue,
  blueDim,
  DESTINATION_SCALE,
  DISPLAY_SCALE,
  facing,
  ngon,
  orientedBox,
  orientedPlan,
  type Part,
  type Plan,
  polygons,
  wallWindows,
  warm,
} from "./solid.ts";
import { svgText } from "./svg-text.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const OUT = `${art}whirlpool/`;
const PATH = "/art/whirlpool/";

// Four frames of 350 ms: the beacon and windows lit on 0 and 1 and dim on 2 and 3 (the
// station's 700 ms blink), while the chevron chase moves one step inward per frame.
const FRAMES = 4;
const FRAME_MS = 350;

// Enlarge the model around the same world-plane origin and retain the normalized pivot.
const MODEL_SCALE = 1.17 * 1.44;
const frame = { width: 304, height: 208, halfWidth: 152, above: 91 };

const C = {
  chevron: "#f9fff4",
  chevronDim: "#82b9b6",
  channel: "#284b63",
  rail: "#a0e5d4",
  railSide: "#447a89",
  plinth: "#537caa",
  plinthSide: "#35476b",
  hull: "#46adad",
  hullSide: "#2e707c",
  deck: "#9e8eb9",
  deckSide: "#54496e",
  sail: "#94d5c0",
  sailSide: "#397b83",
  mint: "#c1ffdf",
  mintDim: "#65948d",
  windowDim: "#b29a73",
} as const;

const SECTORS = [
  { top: "#57c0ad", side: "#317f84" },
  { top: "#5abdd5", side: "#326b92" },
  { top: "#779cda", side: "#465983" },
  { top: "#a398cb", side: "#655984" },
  { top: "#6ec7ac", side: "#438c85" },
];

// Thirty segments over 1.3 turns, rising around the core as the radius contracts.
const RAMP = { segments: 30, turns: 1.3, outer: 66, inner: 24, width: 11, start: 100 };
const rampAt = (t: number) => ({
  angle: (RAMP.start * Math.PI) / 180 + t * RAMP.turns * 2 * Math.PI,
  radius: RAMP.outer + (RAMP.inner - RAMP.outer) * t,
});
function rampPoint({ angle, radius }: ReturnType<typeof rampAt>, offset: number) {
  return [(radius + offset) * Math.cos(angle), (radius + offset) * Math.sin(angle)] as const;
}

function spiral(frameIndex: number): Part[][] {
  return Array.from({ length: RAMP.segments }, (_, i) => {
    const [t0, t1] = [i / RAMP.segments, (i + 1) / RAMP.segments];
    const [p, q] = [rampAt(t0), rampAt(t1)];
    const half = RAMP.width / 2;
    const plan: Plan = [
      rampPoint(p, half),
      rampPoint(q, half),
      rampPoint(q, -half),
      rampPoint(p, -half),
    ];
    const z1 = 3 + 13 * t1;
    const sector = SECTORS[Math.floor((i * SECTORS.length) / RAMP.segments)]!;
    // The dark channel and its continuous pale outer rail separate the two turns.
    const strip = (inner: number, outer: number): Plan => [
      rampPoint(p, outer),
      rampPoint(q, outer),
      rampPoint(q, inner),
      rampPoint(p, inner),
    ];
    const parts: Part[] = [
      { plan, z0: z1 - 5, z1, ...sector },
      { plan: strip(-3.35, 3.35), z0: z1, z1, top: C.channel, side: C.channel },
      { plan: strip(3.6, half), z0: z1, z1: z1 + 0.65, top: C.rail, side: C.railSide },
    ];
    if (i % 2 === 1) {
      const midpoint = rampAt((t0 + t1) / 2);
      const [x, y] = rampPoint(midpoint, 0);
      const [px, py] = rampPoint(p, 0);
      const [qx, qy] = rampPoint(q, 0);
      const tangent = Math.atan2(qy - py, qx - px);
      const k = (i - 1) / 2;
      const fill = k % FRAMES === frameIndex ? C.chevron : C.chevronDim;
      parts.push({
        plan: orientedPlan(x, y, tangent, [
          [-2.5, -2.9],
          [-0.3, -2.9],
          [2.7, 0],
          [-0.3, 2.9],
          [-2.5, 2.9],
          [0.5, 0],
        ]),
        z0: z1 + 0.1,
        z1: z1 + 0.1,
        top: fill,
        side: fill,
      });
    }
    return parts;
  });
}

function core(lit: boolean): Part[] {
  const foot = ngon(6, 17, 0, 0, Math.PI / 6);
  const hull: Plan = [
    [-14, -8],
    [-5, -16],
    [5, -12],
    [13, -2],
    [10, 10],
    [0, 13],
    [-12, 7],
  ];
  const deck = ngon(6, 13, 1, -1, Math.PI / 6);
  const sail: Plan = [
    [-10, -12],
    [-4, -15],
    [3, -9],
    [-2, -1],
    [-8, 8],
    [-14, 3],
    [-15, -4],
  ];
  const windows = lit ? warm : C.windowDim;
  return [
    {
      plan: orientedBox(-14, -7, Math.PI / 6, 19, 7),
      z0: 10,
      z1: 16,
      top: C.plinth,
      side: C.plinthSide,
    },
    { plan: foot, z0: 1, z1: 10, top: C.plinth, side: C.plinthSide },
    { plan: hull, z0: 10, z1: 24, top: C.hull, side: C.hullSide },
    ...wallWindows(facing, 14, 18.5, 2, 3.3, hull, windows),
    { plan: deck, z0: 23, z1: 31, top: C.deck, side: C.deckSide },
    ...wallWindows(facing, 25, 28.5, 2, 3.8, deck, lit ? C.mint : C.mintDim),
    { plan: sail, z0: 31, z1: 38, top: C.sail, side: C.sailSide },
    ...[-10, -6, -2].map((y) => ({
      plan: orientedBox(-8, y, Math.PI / 6, 6, 1.3),
      z0: 38,
      z1: 38.3,
      top: C.plinth,
      side: C.plinthSide,
    })),
    {
      plan: orientedBox(-7, -9, Math.PI / 6, 6, 5),
      z0: 38,
      z1: 39.2,
      top: lit ? blue : blueDim,
      side: C.plinthSide,
    },
  ];
}

// A short brace branches from the outer turn into a raised sensor pod at its near-right edge.
function sensor(lit: boolean): Part[] {
  const plan = (outline: Plan) => orientedPlan(0, 0, RIGHT, outline);
  const pulse = lit ? C.mint : C.mintDim;
  return [
    {
      plan: plan([
        [36, 20],
        [40, 19],
        [49, 48],
        [44, 50],
      ]),
      z0: 4,
      z1: 8,
      top: C.plinth,
      side: C.plinthSide,
    },
    {
      plan: plan([
        [39, 47],
        [47, 43],
        [52, 49],
        [51, 58],
        [44, 63],
        [37, 55],
      ]),
      z0: 3,
      z1: 11,
      top: C.deck,
      side: C.deckSide,
    },
    {
      plan: plan([
        [41, 47],
        [47, 45],
        [50, 50],
        [47, 55],
        [40, 52],
      ]),
      z0: 11,
      z1: 17,
      top: C.sail,
      side: C.sailSide,
    },
    {
      plan: plan([
        [42, 48],
        [46, 47],
        [48, 50],
        [44, 52],
      ]),
      z0: 17,
      z1: 17,
      top: pulse,
      side: pulse,
    },
  ];
}

// Whirlpool's floor: the body and every lit lamp at 5:1 or more on the field. On a light field
// the station's ink keyline carries the floor and the fills stay as drawn.
const galaxy = (
  JSON.parse(readFileSync(`${art}galaxies.json`, "utf8")) as {
    galaxies: Record<string, { colors: Record<string, string>; tint: { light?: boolean } }>;
  }
).galaxies.whirlpool!;
const field = galaxy.colors.background!;
const ratio = (colour: string) => contrast(colour.slice(1), field.slice(1));
const FLOOR = {
  ...Object.fromEntries(SECTORS.map(({ top }, i) => [`sector ${i}`, top])),
  plinth: C.plinth,
  hull: C.hull,
  deck: C.deck,
  sail: C.sail,
  chevron: C.chevron,
  mint: C.mint,
  rail: C.rail,
  warm,
  blue,
};
for (const [role, fill] of Object.entries(FLOOR)) {
  const colour = floorColour(Boolean(galaxy.tint.light), fill);
  if (ratio(colour) < 5) {
    throw new Error(`whirlpool station ${role} ${colour} is ${ratio(colour).toFixed(2)}:1`);
  }
}

const frames = Array.from({ length: FRAMES }, (_, k) => {
  const lit = k < FRAMES / 2;
  return polygons([...spiral(k), core(lit), sensor(lit)], ([x, y, z]) => [
    x * MODEL_SCALE,
    y * MODEL_SCALE,
    z * MODEL_SCALE,
  ]);
});
const scale = DISPLAY_SCALE * DESTINATION_SCALE;
mkdirSync(OUT, { recursive: true });
const entries = frames.map((faces, k) => {
  const artwork = placed(frame.halfWidth, frame.above, faces);
  for (const { points } of artwork) {
    if (points.some(([x, y]) => x < 4 || x > frame.width - 4 || y < 4 || y > frame.height - 4)) {
      throw new Error("Eddy station exceeds its fixed frame");
    }
  }
  writeFileSync(
    `${OUT}station-${k}.svg`,
    svgText(
      svgFile(`Whirlpool station ${k}`, frame.width, frame.height, artwork, DESTINATION_SCALE),
    ),
  );
  return {
    id: `whirlpool-station-${k}`,
    path: `${PATH}station-${k}.svg`,
    width: frame.width,
    height: frame.height,
    displayWidth: round(frame.width * scale),
    displayHeight: round(frame.height * scale),
    facing: "fixed",
    pivot: { x: 0.5, y: frame.above / frame.height },
    frameMs: FRAME_MS,
    destination: "station",
    frameIndex: k,
  };
});

// The station opens Whirlpool's manifest.
replaceEntries(
  "whirlpool",
  (id) => id.startsWith("whirlpool-station-"),
  entries,
  () => true,
);
console.log(
  `station frame ${frame.width} by ${frame.height}, pivot (${frame.halfWidth}, ${frame.above})`,
);
