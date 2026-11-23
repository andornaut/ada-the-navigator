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
  box,
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
// station's 700 ms blink), while the marker chase moves one step inward per frame.
const FRAMES = 4;
const FRAME_MS = 350;

// Enlarge the model around the same world-plane origin and retain the normalized pivot.
const MODEL_SCALE = 1.17 * 1.44;
const frame = { width: 304, height: 208, halfWidth: 152, above: 91 };

const C = {
  marker: "#f9fff4",
  markerDim: "#597f8b",
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
  const segments = Array.from({ length: RAMP.segments }, (_, i) => {
    const t0 = i / RAMP.segments;
    const t1 = (i + 1) / RAMP.segments;
    const p = rampAt(t0);
    const q = rampAt(t1);
    const [px, py] = rampPoint(p, 0);
    const [qx, qy] = rampPoint(q, 0);
    return { t0, t1, p, q, length: Math.hypot(qx - px, qy - py) };
  });
  // Centre the same square-corner markers at equal distances along the painted channel.
  const count = 15;
  const pitch = segments.reduce((total, { length }) => total + length, 0) / count;
  let alongChannel = 0;
  let marker = 0;
  return segments.map(({ t0, t1, p, q, length }, i) => {
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
    while (marker < count && (marker + 0.5) * pitch < alongChannel + length) {
      const fraction = ((marker + 0.5) * pitch - alongChannel) / length;
      const point = rampAt(t0 + (t1 - t0) * fraction);
      const [x, y] = rampPoint(point, 0);
      const turn = RAMP.turns * 2 * Math.PI;
      const tangent = point.angle + Math.atan2(point.radius * turn, RAMP.inner - RAMP.outer);
      const fill = marker % FRAMES === frameIndex ? C.marker : C.markerDim;
      parts.push({
        plan: orientedBox(x, y, tangent, 4.8, 3.2),
        z0: z1 + 0.12,
        z1: z1 + 0.12,
        top: fill,
        side: fill,
      });
      marker++;
    }
    alongChannel += length;
    return parts;
  });
}

function core(lit: boolean): Part[] {
  const foot = ngon(6, 17, 0, 0, Math.PI / 6);
  const hull: Plan = ngon(6, 15, 0, 0, Math.PI / 6);
  const deck = ngon(6, 13, 0, 0, Math.PI / 6);
  const sail = ngon(6, 9, 0, 0, Math.PI / 6);
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
    {
      plan: ngon(6, 4.5, 0, 0, Math.PI / 6),
      z0: 38,
      z1: 39.2,
      top: lit ? blue : blueDim,
      side: C.plinthSide,
    },
  ];
}

// The sensor is a wide station block seated against the outer turn.
function sensor(lit: boolean): Part[] {
  const plan = (u0: number, v0: number, u1: number, v1: number) =>
    orientedPlan(0, 0, RIGHT, box(u0, v0, u1, v1));
  const pulse = lit ? C.mint : C.mintDim;
  return [
    { plan: plan(36, 21, 50, 47), z0: 4, z1: 8, top: C.plinth, side: C.plinthSide },
    { plan: plan(36, 41, 53, 60), z0: 3, z1: 11, top: C.deck, side: C.deckSide },
    { plan: plan(39, 44, 50, 57), z0: 11, z1: 17, top: C.sail, side: C.sailSide },
    { plan: plan(42, 48, 47, 53), z0: 17, z1: 17, top: pulse, side: pulse },
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
  marker: C.marker,
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
