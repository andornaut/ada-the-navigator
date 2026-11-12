// Whirlpool's community project world changes (art/whirlpool.md "Project world changes"): the
// nursery beacon by the whale family and the current-map buoys along the whales' current. Fixed
// flat-shaded solids in the whale and debris convention, exported as SVG frames with their
// manifest entries and the placement data Tech reads (projects.json).
import { writeFileSync } from "node:fs";

import { DISPLAY_SCALE } from "./crafts.ts";
import { depth, facesViewer, type Point } from "./projection.ts";

// World light from above and screen-left of the viewer, stepped into five tones as the whales.
const LIGHT = unit([-0.25, 0.45, 1]);
const STEPS = [0.9, 0.78, 0.6, 0.3];
type Ramp = readonly string[];
type Fill = Ramp | string;
type Face = { fill: Fill; points: Point[] };
// `decal` faces draw unstroked after the body; `bias` moves a part nearer in the part sort.
type Part = { faces: Face[]; decal?: boolean; bias?: number };

function unit([x, y, z]: Point): Point {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

function newell(points: readonly Point[]): Point {
  let [nx, ny, nz] = [0, 0, 0];
  for (const [i, a] of points.entries()) {
    const b = points[(i + 1) % points.length]!;
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return [nx, ny, nz];
}

function tone(points: readonly Point[], ramp: Ramp): string {
  const n = newell(points);
  const l = Math.hypot(...n) < 1e-9 ? 0.7 : dot(unit(n), LIGHT);
  const i = STEPS.findIndex((step) => l >= step);
  return ramp[i < 0 ? 4 : i]!;
}

const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function centroid(points: readonly Point[]): Point {
  const k = points.length;
  return [0, 1, 2].map((i) => points.reduce((sum, p) => sum + p[i]!, 0) / k) as unknown as Point;
}

// The face oriented so its normal points away from `inside`.
function outward(points: Point[], inside: Point): Point[] {
  const n = newell(points);
  const c = centroid(points);
  const away: Point = [c[0] - inside[0], c[1] - inside[1], c[2] - inside[2]];
  return dot(n, away) < 0 ? points.toReversed() : points;
}

type Lathe = { phase?: number; top?: string; caps?: boolean };

// A surface of revolution from (r, z) pairs bottom to top, `n` sides, with flat end caps where
// r > 0. A flat step faces up when it narrows and down when it widens.
function lathe(
  profile: readonly (readonly [number, number])[],
  n: number,
  ramp: Fill,
  { caps = true, phase = Math.PI / 4 - Math.PI / n, top }: Lathe = {},
): Face[] {
  const angles = Array.from({ length: n }, (_, j) => phase + (2 * Math.PI * j) / n);
  const rings = profile.map(([r, z]) =>
    angles.map((a): Point => [r * Math.cos(a), r * Math.sin(a), z]),
  );
  const faces: Face[] = [];
  for (let i = 0; i < rings.length - 1; i++) {
    const [r0, z0] = profile[i]!;
    const [r1, z1] = profile[i + 1]!;
    const zm = (z0 + z1) / 2;
    const inside: Point = [0, 0, z0 === z1 ? (r1 < r0 ? zm - 1 : zm + 1) : zm];
    const a = rings[i]!;
    const b = rings[i + 1]!;
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      const points =
        r0 === 0
          ? [a[0]!, b[k]!, b[j]!]
          : r1 === 0
            ? [a[j]!, a[k]!, b[0]!]
            : [a[j]!, a[k]!, b[k]!, b[j]!];
      faces.push({ fill: ramp, points: outward(points, inside) });
    }
  }
  for (const [index, push] of [
    [0, -1],
    [profile.length - 1, 1],
  ] as const) {
    const [r, z] = profile[index]!;
    if (r > 0 && caps) {
      faces.push({
        fill: push > 0 && top ? top : ramp,
        points: outward(rings[index]!, [0, 0, z - push]),
      });
    }
  }
  return faces;
}

function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, ramp: Fill) {
  const plan = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ] as const;
  const up = plan.map(([x, y]): Point => [x, y, z1]);
  const lo = plan.map(([x, y]): Point => [x, y, z0]);
  const inside: Point = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  const faces: Face[] = [
    { fill: ramp, points: outward(up, inside) },
    { fill: ramp, points: outward(lo, inside) },
  ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    faces.push({ fill: ramp, points: outward([up[i]!, up[j]!, lo[j]!, lo[i]!], inside) });
  }
  return faces;
}

const scaled = (profile: readonly (readonly [number, number])[], k: number) =>
  profile.map(([r, z]) => [r * k, z * k] as const);

// ------------------------------------------------------------------ palette

// Cream: the station family's cream #efe4cf and side #bfae94 as tones 1 and 3.
export const CREAM = ["#f7f0e2", "#efe4cf", "#d9cbb1", "#bfae94", "#9f8f78"];
const STRUT = ["#c9b99d", "#b3a385", "#9c8c70", "#85765d", "#6e614c"];
// Warm lantern glass around the station family's warm #ffe9b8, lit in A and softer in B; the
// glass glows, so its ramp spans little.
export const GLASS = {
  a: ["#fff6dc", "#fff6dc", "#ffe9b8", "#ffe9b8", "#f9dfa6"],
  b: ["#f6dca4", "#f6dca4", "#ecc98a", "#ecc98a", "#e0b878"],
};
const CORE = { a: "#ffffff", b: "#fff6dc" };
// The buoy lamp and song band in the whale glow #cbb8ee and core #f7f2ff when lit, the whale fin
// shadows when dim.
export const LAMP = {
  a: ["#f7f2ff", "#f7f2ff", "#e4d9f8", "#cbb8ee", "#cbb8ee"],
  b: ["#6e68b3", "#5d569c", "#4c4585", "#433c76", "#3a3467"],
};
const BAND = { a: "#cbb8ee", b: "#4c4585" };
export const POOL_COLOR = "#ffe9b8";

type Frame = "a" | "b";

// ------------------------------------------------------------------ models

// A six-sided lantern on a mast over a cradle float, in model units before `NURSERY.scale`.
function nursery(frame: Frame): Part[] {
  const hex = { phase: (15 * Math.PI) / 180 };
  const parts: Part[] = [
    // A shallow cradle bowl with a rolled rim, hovering 3 above the plane; its hollow is the top cap.
    {
      faces: lathe(
        [
          [0, 3],
          [12, 4],
          [20, 8],
          [24, 13],
          [23, 15.5],
          [17, 15.5],
        ],
        12,
        CREAM,
        { top: CREAM[3]! },
      ),
    },
    {
      faces: lathe(
        [
          [5, 15],
          [5, 18],
          [2.4, 19],
          [2.4, 34],
        ],
        8,
        STRUT,
      ),
    },
    {
      faces: lathe(
        [
          [10, 33],
          [10, 36],
        ],
        6,
        CREAM,
        hex,
      ),
    },
    {
      faces: lathe(
        [
          [8.2, 36],
          [8.2, 54],
        ],
        6,
        GLASS[frame],
        hex,
      ),
    },
  ];
  for (let j = 0; j < 6; j++) {
    const a = ((15 + 60 * j) * Math.PI) / 180;
    const [x, y] = [8.6 * Math.cos(a), 8.6 * Math.sin(a)];
    // Side struts sit level with the glass centre and draw after it.
    parts.push({ bias: 1, faces: box(x - 0.7, y - 0.7, 36, x + 0.7, y + 0.7, 54, STRUT) });
  }
  parts.push({
    faces: lathe(
      [
        [11, 54],
        [11, 57],
        [7, 58],
        [7, 61],
        [2.5, 62],
        [2.5, 66],
        [0, 67],
      ],
      6,
      CREAM,
      hex,
    ),
  });
  // The core: a tall diamond on the front pane, the one facing the viewer.
  const [a, b] = [(15 * Math.PI) / 180, (75 * Math.PI) / 180];
  const mid = [(Math.cos(a) + Math.cos(b)) / 2, (Math.sin(a) + Math.sin(b)) / 2] as const;
  const out = unit([mid[0], mid[1], 0]);
  const c: Point = [mid[0] * 8.2 + out[0] * 0.4, mid[1] * 8.2 + out[1] * 0.4, 45];
  const t = unit([Math.cos(b) - Math.cos(a), Math.sin(b) - Math.sin(a), 0]);
  const [hw, hh] = frame === "a" ? [2.2, 5.5] : [1.6, 4];
  const diamond: Point[] = [
    [c[0], c[1], c[2] + hh],
    [c[0] + t[0] * hw, c[1] + t[1] * hw, c[2]],
    [c[0], c[1], c[2] - hh],
    [c[0] - t[0] * hw, c[1] - t[1] * hw, c[2]],
  ];
  parts.push({ decal: true, faces: [{ fill: CORE[frame], points: outward(diamond, [0, 0, 45]) }] });
  return parts;
}

// A spindle float with a song band at the waist and a lamp on a short mast.
function buoy(frame: Frame): Part[] {
  const k = 1.8;
  return [
    {
      faces: lathe(
        scaled(
          [
            [0, 1],
            [6, 6],
            [8, 8],
            [8, 12],
            [6.5, 14],
            [3.5, 16],
          ],
          k,
        ),
        8,
        CREAM,
      ),
    },
    {
      bias: 100,
      faces: lathe(
        scaled(
          [
            [8.6, 8.5],
            [8.6, 11.5],
          ],
          k,
        ),
        8,
        BAND[frame],
        { caps: false },
      ),
    },
    {
      faces: lathe(
        scaled(
          [
            [1.3, 15.5],
            [1.3, 21],
          ],
          k,
        ),
        6,
        STRUT,
      ),
    },
    {
      faces: lathe(
        scaled(
          [
            [0, 20.5],
            [3.2, 23],
            [3.2, 24.5],
            [0, 27.5],
          ],
          k,
        ),
        6,
        LAMP[frame],
        { phase: (15 * Math.PI) / 180 },
      ),
    },
  ];
}

// ------------------------------------------------------------------ export

type Poly = { fill: string; decal: boolean; pts: [number, number][] };

// Visible faces, parts far to near and faces far to near inside each, in frame px about the pivot.
function polygons(parts: readonly Part[], scale: number): Poly[] {
  const key = (part: Part) => depth(part.faces.flatMap(({ points }) => points)) - (part.bias ?? 0);
  return parts
    .toSorted((p, q) => key(q) - key(p))
    .flatMap((part) =>
      part.faces
        .filter(({ points }) => facesViewer(points))
        .map(({ fill, points }) => ({
          depth: depth(points),
          fill: typeof fill === "string" ? fill : tone(points, fill),
          pts: points.map(([x, y, z]): [number, number] => [
            (((x - y) * Math.sqrt(3)) / 2) * scale,
            ((x + y) / 2 - z) * scale,
          ]),
        }))
        .sort((p, q) => q.depth - p.depth)
        .map(({ fill, pts }) => ({ decal: part.decal === true, fill, pts })),
    );
}

type Spec = {
  id: string;
  title: string;
  model: (frame: Frame) => Part[];
  scale: number;
  // Frame px, multiples of 16, and the pivot as a fraction of the frame.
  frame: readonly [number, number];
  pivot: readonly [number, number];
};

const r2 = (v: number) => Math.round(v * 100) / 100 + 0;

function svg(spec: Spec, frame: Frame, polys: readonly Poly[]): string {
  const [fw, fh] = spec.frame;
  const [px, py] = [spec.pivot[0] * fw, spec.pivot[1] * fh];
  const xs = polys.flatMap(({ pts }) => pts.map(([x]) => x + px));
  const ys = polys.flatMap(({ pts }) => pts.map(([, y]) => y + py));
  // The drawn extent, seams included, stays inside the frame.
  if (
    Math.min(...xs) < 0.5 ||
    Math.min(...ys) < 0.5 ||
    Math.max(...xs) > fw - 0.5 ||
    Math.max(...ys) > fh - 0.5
  ) {
    throw new Error(`${spec.id}-${frame} overflows its ${fw} by ${fh} frame`);
  }
  const line = ({ fill, pts }: Poly, seam: boolean) =>
    `    <polygon fill="${fill}"${seam ? ` stroke="${fill}"` : ""} points="${pts
      .map(([x, y]) => `${(x + px).toFixed(2)},${(y + py).toFixed(2)}`)
      .join(" ")}"/>`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fw * DISPLAY_SCALE}" height="${fh * DISPLAY_SCALE}" viewBox="0 0 ${fw} ${fh}">`,
    `  <title>${spec.title} ${frame.toUpperCase()}</title>`,
    '  <g stroke-width="1" stroke-linejoin="round">',
    ...polys.filter(({ decal }) => !decal).map((poly) => line(poly, true)),
    "  </g>",
    "  <g>",
    ...polys.filter(({ decal }) => decal).map((poly) => line(poly, false)),
    "  </g>",
    "</svg>",
    "",
  ].join("\n");
}

export const NURSERY: Spec = {
  id: "whirlpool-nursery-beacon",
  title: "Nursery beacon",
  model: nursery,
  scale: 1.25,
  frame: [80, 112],
  pivot: [0.5, 0.8],
};

export const BUOY: Spec = {
  id: "whirlpool-current-buoy",
  title: "Current buoy",
  model: buoy,
  scale: 1,
  frame: [48, 64],
  pivot: [0.5, 0.8],
};

// The beacon breathes slowly between A and B: a soft light, not a signal.
export const NURSERY_FRAME_MS = 1400;

// Writes a project change's A and B frames to `dir` and returns its manifest entries.
export function exportProject(
  dir: string,
  publicDir: string,
  project: string,
  spec: Spec,
  frameMs?: number,
) {
  const [width, height] = spec.frame;
  return (["a", "b"] as const).map((frame) => {
    const file = `${spec.id}-${frame}.svg`;
    writeFileSync(`${dir}${file}`, svg(spec, frame, polygons(spec.model(frame), spec.scale)));
    return {
      id: `${spec.id}-${frame}`,
      path: `${publicDir}${file}`,
      width,
      height,
      displayWidth: width * DISPLAY_SCALE,
      displayHeight: height * DISPLAY_SCALE,
      facing: "fixed",
      pivot: { x: r2(spec.pivot[0]), y: r2(spec.pivot[1]) },
      ...(frameMs === undefined ? {} : { frameMs }),
      project,
    };
  });
}

// Placement Tech reads. Offsets and lengths are world units.
export const PROJECTS = {
  nurseryBeacon: {
    site: "family",
    frames: [`${NURSERY.id}-a`, `${NURSERY.id}-b`],
    frameMs: NURSERY_FRAME_MS,
    // From the family destination (the smaller adult's position): ahead of the family's heads
    // and clear of every member's drawn frame, so the pivot depth sort needs no layers.
    offset: [-54, 58],
    // Rings on the world plane at field level, drawn smallest last; `alpha` per ring in A, B.
    pool: { color: POOL_COLOR, centre: [-6, 54], radii: [72, 56, 40, 24], alpha: [0.07, 0.05] },
  },
  currentBuoys: {
    site: "whalesCurrent",
    frames: [`${BUOY.id}-a`, `${BUOY.id}-b`],
    // Buoy k sits at arc s = start + k * spacing while s <= length - start, on each side of
    // `sides` at d = side * (width / 2 + edge), d positive to the left of the flow.
    spacing: 128,
    start: 64,
    edge: 20,
    sides: [1, -1],
    // At step floor(t / stepMs), buoy k on either side shows A when (step - k) mod steps is 0,
    // otherwise B: one lit pair runs downstream.
    chase: { stepMs: 300, steps: 4 },
  },
} as const;
