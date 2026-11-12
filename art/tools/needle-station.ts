// The Weavers' station, Needle's station, entered by Use: the Whorl, a spindle core wound with
// thread, a woven habitat ring on five thread spokes and two needle masts ending in story-craft
// berths, with the Loom hall replacement frames. Contract: art/needle.md (Weavers' station).
// Usage: node art/tools/needle-station.ts
import { mkdirSync, writeFileSync } from "node:fs";

import { replaceEntries } from "./manifest.ts";
import {
  blueDimSide,
  blueSide,
  dockAt,
  lamp,
  lav,
  lavSide,
  layout,
  type Layout,
  LEFT,
  OUT,
  pearl,
  pearlSide,
  placed,
  PUBLIC,
  RIGHT,
  rose,
  roseSide,
  silver,
  silverSide,
  svgFile,
} from "./needle-common.ts";
import { round } from "./projection.ts";
import {
  along,
  BLINK_MS,
  blue,
  blueDim,
  box,
  DESTINATION_SCALE,
  DISPLAY_SCALE,
  DOCK,
  dockCollar,
  facing,
  ngon,
  orientedBox,
  type Part,
  polygons,
  wallWindows,
  warm,
} from "./solid.ts";

// Story-craft berths: each needle mast ends in a small mouth collar on the world plane whose face
// is the berth point, model units from the core along the screen-horizontal axes: the long mast
// to the left, the short one to the right, and with the Loom hall the hall's end to the right.
// These radii keep the berths' world offsets of the earlier station.
const BERTH_WIDTH = 20;
const BERTHS = {
  base: [
    [LEFT, 130],
    [RIGHT, 74],
  ],
  hall: [
    [LEFT, 130],
    [RIGHT, 114],
  ],
} as const;

// The woven habitat ring round the core.
const R_IN = 44;
const R_OUT = 60;
const RING = [12, 21] as const;
const SEGMENTS = 30;
const SPOKES = 5;
const LAMP_DIM = "#8c7c60";

function annulus(r0: number, r1: number, a0: number, a1: number) {
  return [
    [r1 * Math.cos(a0), r1 * Math.sin(a0)],
    [r1 * Math.cos(a1), r1 * Math.sin(a1)],
    [r0 * Math.cos(a1), r0 * Math.sin(a1)],
    [r0 * Math.cos(a0), r0 * Math.sin(a0)],
  ] as const;
}

function beacon(x: number, y: number, z0: number, lit: boolean): Part {
  return {
    plan: box(x - 2.2, y - 2.2, x + 2.2, y + 2.2),
    z0,
    z1: z0 + 3.4,
    top: lit ? blue : blueDim,
    side: lit ? blueSide : blueDimSide,
  };
}

// A needle mast along `angle` from the core to `face`, at ring height, ending in a story-craft
// mouth collar on the world plane with an open eye and its lamp on top.
function needle(lit: boolean, angle: number, face: number, lampOn: boolean): Part[] {
  const tip = face - 8;
  const shaft = [
    [9, -2.2],
    [tip - 6, -1.8],
    [tip, -1.2],
    [tip, 1.2],
    [tip - 6, 1.8],
    [9, 2.2],
  ].map(([u, v]) => along(angle, u!, v!));
  const [ex, ey] = along(angle, face - 4, 0);
  return [
    { plan: shaft, z0: 15, z1: 17.6, top: silver, side: silverSide },
    ...dockCollar(lit, face, BERTH_WIDTH, BERTH_WIDTH + 8, pearl, pearlSide, 10, angle),
    { plan: ngon(10, 5.2, ex, ey), z0: 14, z1: 15, top: pearl, side: pearlSide },
    {
      plan: ngon(10, 2.8, ex, ey),
      z0: 14,
      z1: 16.6,
      top: lampOn ? lamp : LAMP_DIM,
      side: lampOn ? "#e6c98f" : "#6b5e49",
    },
  ];
}

// Groups draw far to near by their first part; parts inside a group keep list order.
function station(lit: boolean, hall: boolean): Part[][] {
  const groups: Part[][] = [];

  // The woven ring: a pearl hoop with two threads crossing over and under each other every
  // segment, lavender outside and silver inside, warm windows and a thin silver band round the
  // outer wall.
  for (let i = 0; i < SEGMENTS; i++) {
    const [a0, a1] = [(2 * Math.PI * i) / SEGMENTS, (2 * Math.PI * (i + 1)) / SEGMENTS];
    const plan = annulus(R_IN, R_OUT, a0, a1);
    const over = i % 2 === 0;
    const segment: Part[] = [
      { plan, z0: RING[0], z1: RING[1], top: pearl, side: pearlSide },
      {
        plan: annulus(R_OUT - 0.01, R_OUT + 0.4, a0, a1),
        z0: 15.6,
        z1: 16.8,
        top: silver,
        side: silver,
      },
      {
        plan: annulus(52.6, 59, a0, a1),
        z0: RING[1],
        z1: RING[1] + (over ? 3 : 0.7),
        top: lav,
        side: lavSide,
      },
      {
        plan: annulus(45, 51.4, a0, a1),
        z0: RING[1],
        z1: RING[1] + (over ? 0.7 : 3),
        top: silver,
        side: silverSide,
      },
    ];
    if (i % 2 === 0) {
      segment.push(...wallWindows((nx, ny) => nx + ny > 0.9, 17.4, 19.6, 1, 3, plan));
    }
    groups.push(segment);
  }

  // Five thread spokes from the core to the ring, at uneven angles.
  for (let k = 0; k < SPOKES; k++) {
    const a = ((18 + k * 72 + (k % 2) * 9) * Math.PI) / 180;
    const mid = (9 + R_IN) / 2;
    groups.push([
      {
        plan: orientedBox(mid * Math.cos(a), mid * Math.sin(a), a, R_IN - 8, 2.6),
        z0: 15.5,
        z1: 18,
        top: silver,
        side: silverSide,
      },
    ]);
  }

  // The needle masts and their berths; the lamps blink opposite each other and the beacon.
  const [left, right] = BERTHS[hall ? "hall" : "base"];
  groups.push(needle(lit, left[0], left[1], !lit));
  groups.push(needle(lit, right[0], right[1], lit));

  if (hall) {
    // Loom hall along the right mast: pearl walls with warm windows on the near side, a stepped
    // lavender roof with three lanterns and a lavender porch with a lit door toward the viewer.
    const plan = orientedBox(...along(RIGHT, 84, 0), RIGHT, 44, 22);
    groups.push([
      { plan, z0: 6, z1: 19, top: pearl, side: pearlSide },
      ...wallWindows(facing, 10, 15, 5, 3.4, plan),
      {
        plan: orientedBox(...along(RIGHT, 84, 0), RIGHT, 44, 16),
        z0: 19,
        z1: 22,
        top: lav,
        side: lavSide,
      },
      {
        plan: orientedBox(...along(RIGHT, 84, 0), RIGHT, 44, 8),
        z0: 22,
        z1: 24.5,
        top: lav,
        side: lavSide,
      },
      ...[70, 84, 98].map((r): Part => ({
        plan: orientedBox(...along(RIGHT, r, 0), RIGHT, 4, 4),
        z0: 24.5,
        z1: 27,
        top: warm,
        side: warm,
      })),
    ]);
    const [px, py] = along(RIGHT, 84, 0);
    const porch = orientedBox(px + Math.cos(DOCK) * 13, py + Math.sin(DOCK) * 13, RIGHT, 12, 4);
    groups.push([
      { plan: porch, z0: 6, z1: 16, top: lav, side: lavSide },
      ...wallWindows((nx, ny) => nx + ny > 0.9, 6.5, 13, 1, 5, porch, warm),
    ]);
  }

  // The spindle core: a lower point under the ring, a pearl base module with windows, a shaft
  // wound with a cop of lavender, rose and silver thread, a tapered tip and the mast beacon.
  const p = Math.PI / 12;
  const base = ngon(12, 20, 0, 0, p);
  const core: Part[] = [
    { plan: ngon(8, 2, 0, 0, p), z0: -26, z1: -16, top: silver, side: silverSide },
    { plan: ngon(12, 6, 0, 0, p), z0: -16, z1: -6, top: pearl, side: pearlSide },
    { plan: ngon(12, 13, 0, 0, p), z0: -6, z1: 0, top: pearl, side: pearlSide },
    { plan: base, z0: 0, z1: 11, top: pearl, side: pearlSide },
    ...wallWindows(facing, 4, 8, 2, 3.4, base),
    { plan: ngon(12, 9, 0, 0, p), z0: 11, z1: 28, top: pearl, side: pearlSide },
  ];
  const cop = [
    [28, 32, 12, silver, silverSide],
    [32, 37, 14.5, lav, lavSide],
    [37, 40, 15, rose, roseSide],
    [40, 45, 14.5, lav, lavSide],
    [45, 49, 12, silver, silverSide],
  ] as const;
  for (const [z0, z1, r, top, side] of cop) {
    core.push({ plan: ngon(12, r, 0, 0, p), z0, z1, top, side });
  }
  core.push(
    { plan: ngon(12, 7, 0, 0, p), z0: 49, z1: 62, top: pearl, side: pearlSide },
    { plan: ngon(12, 4, 0, 0, p), z0: 62, z1: 70, top: silver, side: silverSide },
    { plan: ngon(8, 1.6, 0, 0, p), z0: 70, z1: 78, top: silver, side: silverSide },
    beacon(0, 0, 78, lit),
  );
  groups.push(core);
  return groups;
}

const variants = { base: false, hall: true } as const;
const frame: Layout = layout(
  Object.values(variants).flatMap((hall) => [
    ...polygons(station(true, hall)),
    ...polygons(station(false, hall)),
  ]),
);

mkdirSync(OUT, { recursive: true });
const entries = Object.entries(variants).flatMap(([variant, hall]) => {
  const name = hall ? "station-hall" : "station";
  const berths = BERTHS[variant as keyof typeof BERTHS].map(([angle, face]) =>
    dockAt(frame, angle, face, BERTH_WIDTH),
  );
  return (["a", "b"] as const).map((letter) => {
    const faces = polygons(station(letter === "a", hall));
    const title = `Weavers' station${hall ? ", Loom hall" : ""} ${letter.toUpperCase()}`;
    writeFileSync(
      `${OUT}${name}-${letter}.svg`,
      svgFile(
        title,
        frame.width,
        frame.height,
        placed(frame.halfWidth, frame.above, faces),
        DESTINATION_SCALE,
      ),
    );
    return {
      id: `needle-${name}-${letter}`,
      path: `${PUBLIC}${name}-${letter}.svg`,
      width: frame.width,
      height: frame.height,
      displayWidth: round(frame.width * DISPLAY_SCALE * DESTINATION_SCALE),
      displayHeight: round(frame.height * DISPLAY_SCALE * DESTINATION_SCALE),
      facing: "fixed",
      pivot: { x: 0.5, y: frame.above / frame.height },
      frameMs: BLINK_MS,
      berths,
      destination: "station",
      variant: hall ? "loom-hall" : "base",
      ...(hall ? { project: "loomHall" } : {}),
    };
  });
});

// The station opens Needle's manifest.
replaceEntries(
  "needle",
  (id) => id.startsWith("needle-station-"),
  entries,
  () => true,
);
console.log(
  `station frame ${frame.width} by ${frame.height}, pivot (${frame.halfWidth}, ${frame.above})`,
);
