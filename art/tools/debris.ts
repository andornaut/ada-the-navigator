// Traveling debris: flat-shaded solids in a galaxy's field hue inside the coral hazard contour,
// tumbling about a tilted axis through 8 frames, exported as SVG frames with their data and
// root manifest entries.
import { writeFileSync } from "node:fs";

import { DISPLAY_SCALE } from "./crafts.ts";
import { fromOklab, hex, rgb, toOklab } from "./oklab.ts";
import { depth, facesViewer, type Point, projectAt } from "./projection.ts";

// Contour outside the silhouette, in display px.
export const CONTOUR = 1.5;
export const TUMBLE_FRAMES = 8;
// Tumble rate range per piece, degrees per second.
export const TUMBLE_DEG_PER_SECOND = [60, 120] as const;

// Body ramp, lit to shadow: the galaxy's environmentDetail lightness lifted by these steps, at
// the galaxy tint hue with BODY_CHROMA times its chroma: muted field matter, never the neutral
// stone of harmless rocks.
const BODY_LIFT = [0.2, 0.15, 0.1, 0.06, 0.03] as const;
const BODY_CHROMA = 1.3;

// World light, from above and screen-left of the viewer (ship.ts LIGHT).
const LIGHT = unit([-0.25, 0.45, 1]);
const STEPS = [0.9, 0.7, 0.45, 0.15];
// Same-colour seam stroke in frame px: hides anti-aliasing cracks between facets.
const SEAM = 1.2;

// Direction mark, logical px: three coral dashes trailing a traveling debris piece. Dash i is
// centred `behind` px past the edge of its frame's drawn bounds along the reverse velocity and
// `side` px to the left of travel.
export const MARK_DASHES = [
  { length: 9, alpha: 0.95, behind: 7.5, side: -3 },
  { length: 6, alpha: 0.7, behind: 14.5, side: 3 },
  { length: 4, alpha: 0.45, behind: 21.5, side: 0 },
] as const;
export const MARK_WIDTH = 2;

export type Solid = { faces: Point[][]; accent?: boolean }[];

export function unit([x, y, z]: Point): Point {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

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

const r2 = (v: number) => Math.round(v * 100) / 100 + 0;

const points = (list: readonly (readonly [number, number])[]) =>
  list.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");

export function bodyRamp(environmentDetail: string, chroma: number, hue: number): string[] {
  const [L] = toOklab(rgb(environmentDetail));
  const r = (hue * Math.PI) / 180;
  return BODY_LIFT.map((d) =>
    hex(
      fromOklab(L + d, chroma * BODY_CHROMA * Math.cos(r), chroma * BODY_CHROMA * Math.sin(r)),
    ).toUpperCase(),
  );
}

// A closed prism from a plan polygon (counterclockwise), z0 to z1.
function prism(plan: readonly (readonly [number, number])[], z0: number, z1: number): Point[][] {
  const out: Point[][] = [
    plan.map(([x, y]): Point => [x, y, z1]),
    plan.map(([x, y]): Point => [x, y, z0]).toReversed(),
  ];
  for (const [i, a] of plan.entries()) {
    const b = plan[(i + 1) % plan.length]!;
    out.push([
      [a[0], a[1], z0],
      [b[0], b[1], z0],
      [b[0], b[1], z1],
      [a[0], a[1], z1],
    ]);
  }
  return out;
}

const ccw = (plan: [number, number][]) => {
  const a = plan.reduce((s, p, i) => {
    const q = plan[(i + 1) % plan.length]!;
    return s + p[0] * q[1] - q[0] * p[1];
  }, 0);
  return a > 0 ? plan : plan.toReversed();
};

// A bent hull plate, torn on one edge, folded along a rib.
export function bentPlate(): Solid {
  const left = ccw([
    [-30, -14],
    [-4, -16],
    [-2, 14],
    [-22, 18],
    [-27, 9],
    [-34, 6],
  ]);
  const right = ccw([
    [-2, -16],
    [22, -12],
    [30, -2],
    [24, 4],
    [28, 12],
    [0, 14],
  ]);
  const fold = (faces: Point[][], a: number): Point[][] =>
    faces.map((f) =>
      f.map(([x, y, z]): Point =>
        x > -2 ? [-2 + (x + 2) * Math.cos(a), y, z + (x + 2) * Math.sin(a)] : [x, y, z],
      ),
    );
  return [
    { faces: prism(left, -2.5, 2.5) },
    { faces: fold(prism(right, -2.5, 2.5), 0.55) },
    {
      faces: prism(
        ccw([
          [-5, -17],
          [1, -17],
          [1, 15],
          [-5, 15],
        ]),
        2.5,
        6.5,
      ),
      accent: true,
    },
  ];
}

// A broken girder: an I-beam stub whose web is the deeper rib, with a torn panel still riveted
// to one flange.
export function brokenGirder(): Solid {
  const flange = (y: number) =>
    prism(
      ccw([
        [-34, y - 3],
        [30, y - 3],
        [36, y + 3],
        [-30, y + 3],
      ]),
      -4,
      4,
    );
  return [
    { faces: flange(-9) },
    { faces: flange(9) },
    {
      faces: prism(
        ccw([
          [-30, -6],
          [30, -6],
          [30, 6],
          [-30, 6],
        ]),
        -1.6,
        1.6,
      ),
      accent: true,
    },
    {
      faces: prism(
        ccw([
          [-14, 9],
          [10, 9],
          [16, 26],
          [-2, 30],
          [-12, 22],
        ]),
        2,
        4.5,
      ),
    },
  ];
}

function turn(axis: Point, angle: number, [x, y, z]: Point): Point {
  const [u, v, w] = axis;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const d = u * x + v * y + w * z;
  return [
    u * d * (1 - c) + x * c + (-w * y + v * z) * s,
    v * d * (1 - c) + y * c + (w * x - u * z) * s,
    w * d * (1 - c) + z * c + (-v * x + u * y) * s,
  ];
}

// Facets take a body tone by the light; accent parts sit one tone deeper.
function tone(body: readonly string[], face: readonly Point[], accent: boolean): string {
  const l = dot(unit(normal(face)), LIGHT);
  const i = STEPS.findIndex((s) => l >= s);
  return body[Math.min(body.length - 1, (i < 0 ? body.length - 1 : i) + (accent ? 1 : 0))]!;
}

export type DebrisSpec = {
  id: string;
  title: string;
  solid: Solid;
  axis: Point;
  scale: number;
};

// Writes the frames `{id}-{k}.svg` to `dir`, served under `publicDir`, and returns the piece's
// data and manifest entries.
export function exportDebris(
  dir: string,
  publicDir: string,
  body: readonly string[],
  coral: string,
  { axis, id, scale, solid, title }: DebrisSpec,
) {
  const frames = Array.from({ length: TUMBLE_FRAMES }, (_, k) =>
    solid.flatMap(({ accent, faces }) =>
      faces.map((f) => ({
        accent: accent ?? false,
        face: f.map((p) => {
          const q = turn(axis, (k * 2 * Math.PI) / TUMBLE_FRAMES, p);
          return [q[0] * scale, q[1] * scale, q[2] * scale] as Point;
        }),
      })),
    ),
  );
  // Contour stroke in frame px: twice the contour, half of it outside the silhouette.
  const stroke = (2 * CONTOUR) / DISPLAY_SCALE;
  const all = frames.flat().flatMap(({ face }) => face.map((p) => projectAt(0, 0, p)));
  const pad = Math.ceil(stroke / 2) + 3;
  const half = Math.ceil(Math.max(...all.map(([x]) => Math.abs(x)))) + pad;
  const top = Math.ceil(-Math.min(...all.map(([, y]) => y))) + pad;
  const w = half * 2;
  const h = top + Math.ceil(Math.max(...all.map(([, y]) => y))) + pad;
  const files = frames.map((faces, k) => {
    const visible = faces
      .filter(({ face }) => facesViewer(face))
      .toSorted((a, b) => depth(b.face) - depth(a.face))
      .map(({ accent, face }) => ({
        fill: tone(body, face, accent),
        pts: face.map((p) => projectAt(half, top, p)),
      }));
    // Coral contour: every visible face stroked wide in coral underneath, then the faces.
    const under = visible.map(
      ({ pts }) =>
        `  <polygon fill="${coral}" stroke="${coral}" stroke-width="${stroke.toFixed(2)}" stroke-linejoin="round" points="${points(pts)}"/>`,
    );
    const faceSvg = visible.map(
      ({ fill, pts }) =>
        `  <polygon fill="${fill}" stroke="${fill}" stroke-width="${SEAM}" stroke-linejoin="round" points="${points(pts)}"/>`,
    );
    const file = `${id}-${k}`;
    // The viewBox stays in frame px; the intrinsic size is the display size, so the frame
    // rasterizes at the size it is drawn.
    writeFileSync(
      `${dir}${file}.svg`,
      [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w * DISPLAY_SCALE}" height="${h * DISPLAY_SCALE}" viewBox="0 0 ${w} ${h}">`,
        `  <title>${title} ${k}</title>`,
        ...under,
        ...faceSvg,
        "</svg>",
        "",
      ].join("\n"),
    );
    const drawn = visible.flatMap(({ pts }) => pts);
    const xs = drawn.map(([x]) => x);
    const ys = drawn.map(([, y]) => y);
    const outside = stroke / 2;
    return {
      file,
      bounds: [
        r2(Math.min(...xs) - outside),
        r2(Math.min(...ys) - outside),
        r2(Math.max(...xs) + outside),
        r2(Math.max(...ys) + outside),
      ],
      reach: Math.max(...drawn.map(([x, y]) => Math.hypot(x - half, y - top))) + outside,
    };
  });
  const pivot = { x: 0.5, y: Math.round((top / h) * 1e5) / 1e5 };
  const entries = files.map(({ file }, k) => ({
    id: file,
    path: `${publicDir}${file}.svg`,
    width: w,
    height: h,
    displayWidth: w * DISPLAY_SCALE,
    displayHeight: h * DISPLAY_SCALE,
    facing: "front",
    tumbleIndex: k,
    pivot,
    debris: id,
  }));
  const data = {
    id,
    frame: { width: w, height: h },
    display: { width: w * DISPLAY_SCALE, height: h * DISPLAY_SCALE },
    pivot: [pivot.x, pivot.y],
    radius: r2(Math.max(...files.map(({ reach }) => reach))),
    frames: files.map(({ bounds, file }) => ({ file: `${publicDir}${file}.svg`, bounds })),
  };
  return { data, entries };
}
