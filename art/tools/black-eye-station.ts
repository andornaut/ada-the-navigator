// Black Eye's own station, entered by Use: the Bobbin, a long habitat cylinder of lilac goo that
// turns under a helical band of set goo and a line of warm windows, with a goo dome aft, a blunt
// command section and a lamp stalk forward, and two solar wings on a short truss. Eight rotation
// frames; no dock. Contract: art/black-eye.md (Station).
// Usage: node art/tools/black-eye-station.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { blurb } from "./black-eye-models.ts";
import { unit } from "./debris.ts";
import { replaceEntries } from "./manifest.ts";
import { depth, facesViewer, type Point, projectAt, round } from "./projection.ts";
import { DESTINATION_SCALE, DISPLAY_SCALE, type Face } from "./solid.ts";

const output = fileURLToPath(new URL("../../public/art/black-eye/", import.meta.url));
const PATH = "/art/black-eye/";
const PAD = 4;
const STEP = 16;

// Rotation: the winding repeats every 8 of the hull's 16 facets, so 8 one-facet steps loop.
const ROTATION_FRAMES = 8;
const FRAME_MS = 150;
const SIDES = 16;

// Ramps, lit to shadow, shaded from the world light as the debris and gates are.
const RAMP = {
  goo: [blurb.gloss, blurb.goo, "#bba0d8", blurb.gooSide, blurb.deck],
  float: ["#a58bc3", blurb.deckInset, blurb.deck, "#7d64a0", "#715a94"],
  panel: [blurb.deckInset, blurb.deck, "#7d64a0", "#715a94", "#664f88"],
  frame: [blurb.gloss, blurb.goo, "#bba0d8", blurb.gooSide, "#9478b4"],
  warm: [blurb.lamp, blurb.lamp, "#f0d8a6", "#e6c98f", "#d9b878"],
  dim: [blurb.lampDim, blurb.lampDim, "#7c6d54", "#6b5e49", "#5c5140"],
} as const;
type Ramp = readonly string[];

const LIGHT = unit([-0.25, 0.45, 1]);
const STEPS = [0.9, 0.7, 0.45, 0.15];
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function normal(points: readonly Point[]): Point {
  let [nx, ny, nz] = [0, 0, 0];
  for (const [i, a] of points.entries()) {
    const b = points[(i + 1) % points.length]!;
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return [nx, ny, nz];
}

const tone = (ramp: Ramp, face: readonly Point[]) => {
  const i = STEPS.findIndex((s) => dot(unit(normal(face)), LIGHT) >= s);
  return ramp[i < 0 ? ramp.length - 1 : i]!;
};

// The hull's axis on the world plane: screen right, turned 0.32 rad toward the viewer, at height
// ZC above the pivot. s runs along the axis, r out from it, t round it from across toward up.
const AXIS = -Math.PI / 4 + 0.32;
const ZC = 26;
const RC = 20;
const ax: Point = [Math.cos(AXIS), Math.sin(AXIS), 0];
const across: Point = [-Math.sin(AXIS), Math.cos(AXIS), 0];
const P = (s: number, r: number, t: number): Point => [
  s * ax[0] + r * Math.cos(t) * across[0],
  s * ax[1] + r * Math.cos(t) * across[1],
  ZC + r * Math.sin(t),
];

type Group = { points: Point[]; ramp: Ramp }[];

// Quads between successive (s, r) stations of a profile, `sides` round; `pick(k, j)` is the ramp
// of facet k in band j.
function lathe(
  profile: readonly (readonly [number, number])[],
  sides: number,
  pick: (k: number, j: number) => Ramp,
): Group {
  const faces: Group = [];
  for (let j = 0; j < profile.length - 1; j++) {
    const [s0, r0] = profile[j]!;
    const [s1, r1] = profile[j + 1]!;
    for (let k = 0; k < sides; k++) {
      const [t0, t1] = [(k * 2 * Math.PI) / sides, ((k + 1) * 2 * Math.PI) / sides];
      faces.push({
        points: [P(s0, r0, t0), P(s1, r1, t0), P(s1, r1, t1), P(s0, r0, t1)],
        ramp: pick(k, j),
      });
    }
  }
  return faces;
}

// A box in the axis frame: s along the axis, v across it, z up.
function block(
  s0: number,
  s1: number,
  v0: number,
  v1: number,
  z0: number,
  z1: number,
  ramp: Ramp,
): Group {
  const Q = (s: number, v: number, z: number): Point => [
    s * ax[0] + v * across[0],
    s * ax[1] + v * across[1],
    z,
  ];
  const [a, b, c, d] = [Q(s0, v0, z0), Q(s1, v0, z0), Q(s1, v1, z0), Q(s0, v1, z0)];
  const [e, f, g, h] = [Q(s0, v0, z1), Q(s1, v0, z1), Q(s1, v1, z1), Q(s0, v1, z1)];
  return [
    [e, f, g, h],
    [d, c, b, a],
    [a, b, f, e],
    [b, c, g, f],
    [c, d, h, g],
    [d, a, e, h],
  ].map((points) => ({ points, ramp }));
}

const HULL = [-56, 56] as const;
const BAND = 4;

function bobbin(rotation: number, lit: boolean): Group[] {
  const groups: Group[] = [];
  // Aft of the dome: a short truss with two flat solar wings across the axis, three cells each
  // of set goo in lilac goo frames.
  groups.push(block(HULL[0] - 48, HULL[0] - 22, -1.4, 1.4, ZC - 1.4, ZC + 1.4, RAMP.frame));
  for (const side of [-1, 1]) {
    const [v0, v1] = [side * 2, side * 8].toSorted((p, q) => p - q);
    groups.push(block(HULL[0] - 42, HULL[0] - 30, v0!, v1!, ZC - 0.8, ZC + 0.8, RAMP.frame));
    for (let i = 0; i < 3; i++) {
      const [w0, w1] = [side * (8 + i * 13), side * (20 + i * 13)].toSorted((p, q) => p - q);
      groups.push(block(HULL[0] - 46, HULL[0] - 26, w0!, w1!, ZC - 0.5, ZC + 0.5, RAMP.panel));
    }
  }
  // Aft: a goo dome with a set-goo rim, as the Blurbs build their homes.
  groups.push(
    lathe(
      [
        [HULL[0] - 22, 0.01],
        [HULL[0] - 21, 6],
        [HULL[0] - 18, 10.5],
        [HULL[0] - 13, 13.5],
        [HULL[0] - 6, 15],
        [HULL[0] - 2, 15],
        [HULL[0], 16],
      ],
      12,
      (_k, j) => (j === 5 ? RAMP.float : RAMP.goo),
    ),
  );
  // The habitat cylinder: lilac goo wound with a helical band of set goo, two turns round, and a
  // line of warm windows; both turn with the cylinder, one facet per frame.
  const bands = Math.round((HULL[1] - HULL[0]) / BAND);
  const profile = [
    [HULL[0], 16] as const,
    ...Array.from({ length: bands + 1 }, (_, j) => [HULL[0] + j * BAND, RC] as const),
    [HULL[1], 16] as const,
  ];
  groups.push(
    lathe(profile, SIDES, (k, j) => {
      if (j === 0 || j === profile.length - 2) return RAMP.float;
      const m = (((k + rotation - Math.floor(j / 2)) % 8) + 8) % 8;
      if (m === 0 || m === 1) return RAMP.float;
      if ((k + rotation) % 8 === 4 && j % 3 === 1) return RAMP.warm;
      return RAMP.goo;
    }),
  );
  // Forward: a blunt stepped command section with a band of lit windows, and a lamp stalk with a
  // round lamp, lit in the first half of the loop.
  groups.push(
    lathe(
      [
        [HULL[1], 16],
        [HULL[1] + 6, 17],
        [HULL[1] + 14, 17],
        [HULL[1] + 18, 13],
        [HULL[1] + 24, 8],
        [HULL[1] + 26, 0.01],
      ],
      12,
      (k, j) => (j === 1 ? (k % 2 ? RAMP.warm : RAMP.float) : j === 0 ? RAMP.float : RAMP.goo),
    ),
  );
  groups.push(block(HULL[1] + 26, HULL[1] + 40, -0.9, 0.9, ZC - 0.9, ZC + 0.9, RAMP.float));
  groups.push(
    lathe(
      [
        [HULL[1] + 39, 0.01],
        [HULL[1] + 40, 2.6],
        [HULL[1] + 43, 3.6],
        [HULL[1] + 46, 2.6],
        [HULL[1] + 47, 0.01],
      ],
      8,
      () => (lit ? RAMP.warm : RAMP.dim),
    ),
  );
  return groups;
}

// Groups draw far to near by their centroid depth; inside a convex group, faces far to near.
function draw(groups: readonly Group[]): Face[] {
  return groups
    .toSorted((a, b) => depth(b.flatMap((f) => f.points)) - depth(a.flatMap((f) => f.points)))
    .flatMap((group) =>
      group
        .filter(({ points }) => facesViewer(points))
        .toSorted((a, b) => depth(b.points) - depth(a.points))
        .map(({ points, ramp }) => ({ color: tone(ramp, points), points })),
    );
}

const frames = Array.from({ length: ROTATION_FRAMES }, (_, k) =>
  draw(bobbin(k, k < ROTATION_FRAMES / 2)),
);

// One frame over every rotation frame: the pivot (the world plane under the hull's middle) on
// the vertical centre line, sides in multiples of 16 and an exact five-decimal pivot height.
function layout(faces: readonly Face[]) {
  const all = faces.flatMap(({ points }) => points.map((p) => projectAt(0, 0, p)));
  const half = Math.max(...all.map(([x]) => Math.abs(x))) + PAD;
  const halfWidth = Math.ceil(half / (STEP / 2)) * (STEP / 2);
  const minAbove = Math.ceil(-Math.min(...all.map(([, y]) => y)) + PAD);
  const minBelow = Math.ceil(Math.max(...all.map(([, y]) => y)) + PAD);
  for (let height = Math.ceil((minAbove + minBelow) / STEP) * STEP; ; height += STEP) {
    for (let above = minAbove; above <= height - minBelow; above++) {
      if ((above * 100000) % height === 0) {
        return { halfWidth, above, width: halfWidth * 2, height };
      }
    }
  }
}

const frame = layout(frames.flat());
const scale = DISPLAY_SCALE * DESTINATION_SCALE;
mkdirSync(output, { recursive: true });
const entries = frames.map((faces, k) => {
  const shapes = faces.map(({ color, points }) => {
    const pts = points
      .map((p) => projectAt(frame.halfWidth, frame.above, p))
      .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
      .join(" ");
    return `  <polygon fill="${color}" points="${pts}"/>`;
  });
  writeFileSync(
    `${output}station-${k}.svg`,
    [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${round(frame.width * scale)}" height="${round(frame.height * scale)}" viewBox="0 0 ${frame.width} ${frame.height}">`,
      `  <title>Black Eye station ${k}</title>`,
      ...shapes,
      "</svg>",
      "",
    ].join("\n"),
  );
  return {
    id: `black-eye-station-${k}`,
    path: `${PATH}station-${k}.svg`,
    width: frame.width,
    height: frame.height,
    displayWidth: round(frame.width * scale),
    displayHeight: round(frame.height * scale),
    facing: "fixed",
    pivot: { x: 0.5, y: frame.above / frame.height },
    frameMs: FRAME_MS,
    destination: "station",
    rotationIndex: k,
  };
});

// The station opens Black Eye's manifest, before the settlements.
replaceEntries(
  "black-eye",
  (id) => id.startsWith("black-eye-station-"),
  entries,
  () => true,
);
console.log(
  `station frame ${frame.width} by ${frame.height}, pivot (${frame.halfWidth}, ${frame.above})`,
);
