// Elder Loom's glider: a non-hostile story craft at 16 headings with speed jets and nose data in
// the Cartwheel story-craft schema. Contract: art/needle.md (Elder Loom's glider).
// Usage: node art/tools/needle-craft.ts
import { writeFileSync } from "node:fs";

import { replaceEntries } from "./manifest.ts";
import {
  blueSide,
  glass,
  glassSide,
  lamp,
  lav,
  lavSide,
  OUT,
  pearl,
  pearlRear,
  pearlSide,
  placed,
  PUBLIC,
  squareFrame,
  steel,
  steelSide,
  svgFile,
} from "./needle-common.ts";
import {
  anchor,
  ENEMY_HEADINGS,
  json,
  type Point,
  projectAt,
  rotate,
  round,
  vector,
} from "./projection.ts";
import {
  along,
  blue,
  DISPLAY_SCALE,
  facing,
  orientedBox,
  orientedPlan,
  type Part,
  type Plan,
  polygons,
  wallWindows,
} from "./solid.ts";

// Plans in (u forward, v across); local forward is -y, as for every craft.
const FWD = -Math.PI / 2;
const uv = (u: number, v: number) => along(FWD, u, v);
const craftPlan = (local: Plan) => orientedPlan(0, 0, FWD, local);
const craftBox = (u: number, v: number, length: number, width: number) =>
  orientedBox(...uv(u, v), FWD, length, width);

type Visible = (nx: number, ny: number) => boolean;

// A long-winged sailplane: slender fuselage, straight wings with lavender thread bands near the
// tips, a T-tail, a smoked canopy with a warm pane and two motor nacelles under the wing roots.
function glider(visible: Visible): Part[][] {
  const hull = craftPlan([
    [-25, -1.8],
    [6, -3.3],
    [15, -2.9],
    [21, -1.2],
    [23, 0],
    [21, 1.2],
    [15, 2.9],
    [6, 3.3],
    [-25, 1.8],
  ]);
  const wing = (s: number): Plan =>
    craftPlan(
      s < 0
        ? [
            [9.5, -2.8],
            [2, -2.8],
            [3.6, -33],
            [7.6, -33],
          ]
        : [
            [2, 2.8],
            [9.5, 2.8],
            [7.6, 33],
            [3.6, 33],
          ],
    );
  const band = (s: number): Plan =>
    craftPlan(
      s < 0
        ? [
            [7.9, -25],
            [3.3, -25],
            [3.45, -28],
            [7.85, -28],
          ]
        : [
            [3.3, 25],
            [7.9, 25],
            [7.85, 28],
            [3.45, 28],
          ],
    );
  const canopy = craftBox(11, 0, 11, 4.8);
  return [
    [{ plan: hull, z0: 3, z1: 8, top: pearl, side: pearlSide, rear: pearlRear }],
    ...[-1, 1].map((s): Part[] => [
      { plan: wing(s), z0: 6, z1: 7.6, top: pearl, side: pearlSide, rear: pearlRear },
      { plan: band(s), z0: 7.6, z1: 8, top: lav, side: lavSide },
      { plan: craftBox(5.6, s * 33.6, 2.4, 2.2), z0: 5.8, z1: 8.2, top: blue, side: blueSide },
    ]),
    ...[-1, 1].map((s): Part[] => [
      { plan: craftBox(4.5, s * 7, 8, 3.4), z0: 3.6, z1: 6, top: steel, side: steelSide },
    ]),
    [
      { plan: canopy, z0: 8, z1: 10.6, top: glass, side: glassSide },
      ...wallWindows(visible, 8.4, 10.2, 1, 3.4, canopy, lamp),
    ],
    [
      {
        plan: craftBox(-21, 0, 8, 1.6),
        z0: 8,
        z1: 15.5,
        top: pearl,
        side: pearlSide,
        rear: pearlRear,
      },
    ],
    [
      {
        plan: craftBox(-22.5, 0, 5, 19),
        z0: 15.5,
        z1: 16.8,
        top: pearl,
        side: pearlSide,
        rear: pearlRear,
      },
      { plan: craftBox(-22.5, -8.2, 5.2, 2.2), z0: 16.8, z1: 17, top: lav, side: lavSide },
      { plan: craftBox(-22.5, 8.2, 5.2, 2.2), z0: 16.8, z1: 17, top: lav, side: lavSide },
    ],
  ];
}

const NAME = "glider";
const TITLE = "Elder Loom's glider";
// Heights parts rest on (hull top, then fin top): groups based there draw after those below.
const LEVELS = [8, 15.5];
// Jet mouths (u, v, z) at the nacelle tails.
const MOUTHS = [
  [0.5, -7, 4.8],
  [0.5, 7, 4.8],
] as const;
const MOUTH_WIDTH = 3;
// The story craft's civil jet palette (art/cartwheel.md).
const JETS = { outer: ["#c9a978", "#ffe9b8"], core: ["#efe4cf", "#ffffff"] };

const view = (yaw: number) => (point: Point) => rotate(ENEMY_HEADINGS, yaw, point);
const visibleAt = (yaw: number) => (nx: number, ny: number) => {
  const [x, y] = rotate(ENEMY_HEADINGS, yaw, [nx, ny, 0]);
  return facing(x, y);
};
const headingFaces = (yaw: number) => polygons(glider(visibleAt(yaw)), view(yaw), LEVELS);

const frame = squareFrame(
  Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => headingFaces(yaw))
    .flat()
    .flatMap(({ points }) => points),
);
const centre = frame / 2;

// The nose tip: the midpoint of the forward-most top edge of the solid parts, nearest the centre
// line; window panes are left out.
function noseTip(): { reach: number; tip: Point } {
  const parts = glider(() => false).flat();
  const ys = parts.flatMap(({ plan }) => plan.map(([, y]) => -y));
  const reach = Math.max(...ys);
  const edges = parts.flatMap(({ plan, z1 }) => {
    const front = plan.filter(([, y]) => Math.abs(y + reach) < 1e-9).map(([x]) => x);
    return front.length === 0 ? [] : [{ v: (Math.min(...front) + Math.max(...front)) / 2, z: z1 }];
  });
  const { v, z } = edges.sort(
    (a, b) => Math.abs(a.v) - Math.abs(b.v) || a.v - b.v || b.z - a.z,
  )[0]!;
  return { reach, tip: [...uv(reach, v), z] };
}

// World units from the pivot to the point under the nose on the centre line: the art's projection
// at display scale through the inverse of the game's (x - y, (x + y) / 2).
function noseDistance(reach: number, yaw: number): number {
  const [x, y] = projectAt(0, 0, rotate(ENEMY_HEADINGS, yaw, [...uv(reach, 0), 0]));
  const [sx, sy] = [x * DISPLAY_SCALE, y * DISPLAY_SCALE];
  return round(Math.hypot(sy + sx / 2, sy - sx / 2));
}

type Point2 = readonly [number, number];
const segmentDistance = ([px, py]: Point2, [ax, ay]: Point2, [bx, by]: Point2) => {
  const [ex, ey] = [bx - ax, by - ay];
  const t = Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey)));
  return Math.hypot(px - ax - t * ex, py - ay - t * ey);
};

const { reach, tip } = noseTip();
const nose = Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => {
  const point = anchor(ENEMY_HEADINGS, centre, yaw, tip);
  const gap = Math.min(
    ...headingFaces(yaw).flatMap(({ points }) => {
      const drawn = points.map((p) => projectAt(centre, centre, p));
      return drawn.map((a, i) => segmentDistance(point, a, drawn[(i + 1) % drawn.length]!));
    }),
  );
  if (gap > 0.5) {
    throw new Error(`${NAME}-${yaw} nose is ${gap.toFixed(2)} frame px off the hull`);
  }
  return { distance: noseDistance(reach, yaw), tip: point };
});

const half = MOUTH_WIDTH / 2;
const scale = Math.sqrt(frame / 96);
writeFileSync(
  `${OUT}${NAME}-jets.json`,
  json({
    version: 1,
    frame,
    length: { base: round(6 * scale), scale: round(24 * scale), exponent: 2 },
    layers: [
      { name: "outer", colors: JETS.outer, width: 1.6, length: 1 },
      { name: "core", colors: JETS.core, width: 0.8, length: 0.55 },
    ],
    headings: Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => ({
      index: yaw,
      mouths: MOUTHS.map(([u, v, z]) => ({
        anchor: anchor(ENEMY_HEADINGS, centre, yaw, [...uv(u, v), z]),
        axis: vector(ENEMY_HEADINGS, yaw, [0, 1, 0]),
        half: vector(ENEMY_HEADINGS, yaw, [-half, 0, 0]),
      })),
    })),
    nose,
  }),
);

const display = round(frame * DISPLAY_SCALE);
const entries = Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => {
  writeFileSync(
    `${OUT}${NAME}-${yaw}.svg`,
    svgFile(`${TITLE} ${yaw}`, frame, frame, placed(centre, centre, headingFaces(yaw))),
  );
  return {
    id: `craft-${NAME}-${yaw}`,
    path: `${PUBLIC}${NAME}-${yaw}.svg`,
    width: frame,
    height: frame,
    displayWidth: display,
    displayHeight: display,
    facing: `world-${yaw}`,
    directionIndex: yaw,
    pivot: { x: 0.5, y: 0.5 },
    craft: NAME,
  };
});

replaceEntries("needle", (id) => id.startsWith(`craft-${NAME}-`), entries);
console.log(
  `${NAME} frame ${frame}, reach ${reach}, nose ${nose.map(({ distance }) => distance).join(" ")}`,
);
