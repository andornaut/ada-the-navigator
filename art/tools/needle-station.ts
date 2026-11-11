// The Weavers' station, Needle's dockable station: a spool hub, a loom frame, a bobbin rack and a
// dock, with the Loom hall replacement frames. Contract: art/needle.md (Weavers' station).
// Usage: node art/tools/needle-station.ts
import { mkdirSync, writeFileSync } from "node:fs";

import { replaceEntries } from "./manifest.ts";
import {
  BACK,
  blueSide,
  blueDimSide,
  dockAt,
  lav,
  lavSide,
  layout,
  LEFT,
  OUT,
  pearl,
  pearlSide,
  placed,
  PUBLIC,
  RIGHT,
  rose,
  roseSide,
  sage,
  sageSide,
  silver,
  silverSide,
  svgFile,
  type Layout,
} from "./needle-common.ts";
import { round } from "./projection.ts";
import {
  along,
  approachLights,
  BLINK_MS,
  blue,
  blueDim,
  box,
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

// Dock face and mouth, model units from the hub centre on the dock axis.
const DOCK_FACE = 72;
const DOCK_MOUTH = 24;
// Berths: the loom's outer post (left) and the mooring post or, with the hall, the hall's end
// (right). Berth points sit on the world plane just beyond each.
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

function beacon(x: number, y: number, z0: number, lit: boolean): Part {
  return {
    plan: box(x - 2.4, y - 2.4, x + 2.4, y + 2.4),
    z0,
    z1: z0 + 3.5,
    top: lit ? blue : blueDim,
    side: lit ? blueSide : blueDimSide,
  };
}

function bobbin(cx: number, cy: number, z: number, thread: string, threadSide: string): Part[] {
  const p = Math.PI / 10;
  return [
    { plan: ngon(10, 6, cx, cy, p), z0: z, z1: z + 1.5, top: pearl, side: pearlSide },
    { plan: ngon(10, 4.6, cx, cy, p), z0: z + 1.5, z1: z + 8, top: thread, side: threadSide },
    { plan: ngon(10, 6, cx, cy, p), z0: z + 8, z1: z + 9.5, top: pearl, side: pearlSide },
  ];
}

// Groups draw far to near by their first part; parts inside a group keep list order.
function station(lit: boolean, hall: boolean): Part[][] {
  const groups: Part[][] = [];

  // Bobbin rack behind the hub: lavender, rose and sage thread.
  groups.push([
    {
      plan: orientedBox(...along(BACK, 33.5, 0), BACK, 21, 7),
      z0: 2,
      z1: 7,
      top: pearl,
      side: pearlSide,
    },
  ]);
  groups.push([
    {
      plan: orientedBox(...along(BACK, 44, 0), BACK, 7, 58),
      z0: 2,
      z1: 7,
      top: pearl,
      side: pearlSide,
    },
    ...bobbin(...along(BACK, 44, -21), 7, lav, lavSide),
    ...bobbin(...along(BACK, 44, 0), 7, rose, roseSide),
    ...bobbin(...along(BACK, 44, 21), 7, sage, sageSide),
  ]);

  // Hub: spool flanges round a core wound in lavender and silver thread, a domed cabin, the
  // spindle mast and its beacon.
  const p = Math.PI / 12;
  const flange = ngon(12, 25, 0, 0, p);
  const core = ngon(12, 17.5, 0, 0, p);
  const steps = [4, 8, 9.5, 13.5, 15, 19, 22];
  const bands = steps.slice(0, -1).map((z0, i): Part => ({
    plan: core,
    z0,
    z1: steps[i + 1]!,
    top: i % 2 === 0 ? lav : silver,
    side: i % 2 === 0 ? lavSide : silverSide,
  }));
  const cabin = ngon(12, 14, 0, 0, p);
  groups.push([
    { plan: flange, z0: 0, z1: 4, top: pearl, side: pearlSide },
    ...bands,
    { plan: flange, z0: 22, z1: 26, top: pearl, side: pearlSide },
    ...wallWindows(facing, 23, 25, 1, 3.2, flange),
    { plan: cabin, z0: 26, z1: 33, top: pearl, side: pearlSide },
    ...wallWindows(facing, 28, 31, 1, 3, cabin),
    { plan: ngon(12, 9, 0, 0, p), z0: 33, z1: 36, top: silver, side: silverSide },
    { plan: box(-1.3, -1.3, 1.3, 1.3), z0: 36, z1: 54, top: silver, side: silverSide },
    beacon(0, 0, 54, lit),
  ]);

  // Loom frame to screen left: a sill beam, silver warp threads behind a band of woven lavender
  // cloth with rose and sage weft stripes, two posts and a lintel. Its beacon blinks opposite.
  const loom: Part[] = [
    {
      plan: orientedBox(...along(LEFT, 74, 0), LEFT, 101, 8),
      z0: 1,
      z1: 7,
      top: pearl,
      side: pearlSide,
    },
  ];
  for (let r = 52; r <= 114; r += 7.75) {
    loom.push({
      plan: orientedBox(...along(LEFT, r, 1.2), LEFT, 2.6, 2.6),
      z0: 7,
      z1: 41,
      top: silver,
      side: silverSide,
    });
  }
  loom.push(
    {
      plan: orientedBox(...along(LEFT, 82, -1.4), LEFT, 64, 1.8),
      z0: 7,
      z1: 19,
      top: lav,
      side: lavSide,
    },
    {
      plan: orientedBox(...along(LEFT, 82, -2.4), LEFT, 64, 0.4),
      z0: 11,
      z1: 13,
      top: rose,
      side: rose,
    },
    {
      plan: orientedBox(...along(LEFT, 82, -2.4), LEFT, 64, 0.4),
      z0: 15.5,
      z1: 17,
      top: sage,
      side: sage,
    },
    {
      plan: orientedBox(...along(LEFT, 44, 0), LEFT, 9, 9),
      z0: 0,
      z1: 47,
      top: pearl,
      side: pearlSide,
    },
    {
      plan: orientedBox(...along(LEFT, 121, 0), LEFT, 9, 9),
      z0: 0,
      z1: 47,
      top: pearl,
      side: pearlSide,
    },
    {
      plan: orientedBox(...along(LEFT, 82.5, 0), LEFT, 86, 7),
      z0: 41,
      z1: 47,
      top: pearl,
      side: pearlSide,
    },
    beacon(...along(LEFT, 121, 0), 47, !lit),
  );
  groups.push(loom);

  if (hall) {
    // Loom hall: a link, a long hall with eight warm windows on the near wall, a stepped lavender
    // roof with three lanterns, and a lavender porch with a lit door toward the dock side.
    const plan = orientedBox(...along(RIGHT, 70, 0), RIGHT, 80, 25);
    groups.push([
      {
        plan: orientedBox(...along(RIGHT, 27, 0), RIGHT, 7, 10),
        z0: 2,
        z1: 9,
        top: pearl,
        side: pearlSide,
      },
    ]);
    groups.push([
      { plan, z0: 0, z1: 15, top: pearl, side: pearlSide },
      ...wallWindows(facing, 5.5, 10.5, 8, 3.4, plan),
      {
        plan: orientedBox(...along(RIGHT, 70, 0), RIGHT, 80, 18),
        z0: 15,
        z1: 19,
        top: lav,
        side: lavSide,
      },
      {
        plan: orientedBox(...along(RIGHT, 70, 0), RIGHT, 80, 9),
        z0: 19,
        z1: 22,
        top: lav,
        side: lavSide,
      },
      ...[48, 70, 92].map((r): Part => ({
        plan: orientedBox(...along(RIGHT, r, 0), RIGHT, 4, 4),
        z0: 22,
        z1: 25,
        top: warm,
        side: warm,
      })),
      // The far end post carries the right berth's beacon.
      beacon(...along(RIGHT, 108, 0), 15, !lit),
    ]);
    const [px, py] = along(RIGHT, 70, 0);
    const porch = orientedBox(px + Math.cos(DOCK) * 15, py + Math.sin(DOCK) * 15, RIGHT, 14, 5);
    groups.push([
      { plan: porch, z0: 0, z1: 12, top: lav, side: lavSide },
      ...wallWindows((nx, ny) => nx + ny > 0.9, 0.5, 8.5, 1, 6, porch, warm),
    ]);
  } else {
    // Mooring arm and post: the right berth.
    groups.push([
      {
        plan: orientedBox(...along(RIGHT, 45, 0), RIGHT, 43, 8),
        z0: 1,
        z1: 7,
        top: pearl,
        side: pearlSide,
      },
      {
        plan: orientedBox(...along(RIGHT, 66, 0), RIGHT, 8, 8),
        z0: 0,
        z1: 20,
        top: pearl,
        side: pearlSide,
      },
      beacon(...along(RIGHT, 66, 0), 20, !lit),
    ]);
  }

  // Dock toward the viewer, in the station family's collar, mouth and lights.
  const arm = orientedBox(...along(DOCK, 45, 0), DOCK, 43, 16);
  groups.push([
    { plan: arm, z0: 1, z1: 10, top: pearl, side: pearlSide },
    ...wallWindows((a, b) => a + b > -0.2 && Math.abs(a - b) > 0.5, 4, 7, 2, 2.6, arm),
    ...dockCollar(lit, DOCK_FACE, DOCK_MOUTH, 34, pearl, pearlSide, 14),
  ]);
  groups.push(approachLights(lit, DOCK_FACE));
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
  const dock = dockAt(frame, DOCK, DOCK_FACE, DOCK_MOUTH);
  const berths = BERTHS[variant as keyof typeof BERTHS].map(([angle, face]) =>
    dockAt(frame, angle, face, BERTH_WIDTH),
  );
  return (["a", "b"] as const).map((letter) => {
    const faces = polygons(station(letter === "a", hall));
    const title = `Weavers' station${hall ? ", Loom hall" : ""} ${letter.toUpperCase()}`;
    writeFileSync(
      `${OUT}${name}-${letter}.svg`,
      svgFile(title, frame.width, frame.height, placed(frame.halfWidth, frame.above, faces)),
    );
    return {
      id: `needle-${name}-${letter}`,
      path: `${PUBLIC}${name}-${letter}.svg`,
      width: frame.width,
      height: frame.height,
      displayWidth: round(frame.width * DISPLAY_SCALE),
      displayHeight: round(frame.height * DISPLAY_SCALE),
      facing: "fixed",
      pivot: { x: 0.5, y: frame.above / frame.height },
      frameMs: BLINK_MS,
      dock,
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
