// Whirlpool's lantern whale and its family: 16 headings by 8 swim frames per kind as flat-shaded
// SVGs in public/art/whales/, their entries in Whirlpool's manifest and public/art/whales.json
// (art/whales.md).
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { linkData, placeEntries, replaceEntries } from "./manifest.ts";
import {
  depth,
  ENEMY_HEADINGS,
  facesViewer,
  json,
  type Point,
  projectAt,
  rotate,
  round,
} from "./projection.ts";

const HEADINGS = ENEMY_HEADINGS;
const FRAMES = 8;
// Frame px to Ada's logical display px: 42 / 96.
const DISPLAY = 0.4375;
// Same-colour seam stroke on hull faces, frame px, so adjacent facets rasterize without gaps.
const SEAM = 1;
// Clear margin round the drawing, frame px.
const MARGIN = 1;

type V2 = [number, number];
type Ramp = readonly [string, string, string, string, string];
// A face is lit from a ramp or painted one flat colour. A body quad keeps its two triangles in
// `halves`: it draws whole when both face the viewer in one tone, else as its visible halves.
type Face = { fill: Ramp | string; halves?: [Point[], Point[]]; points: Point[] };
// Parts draw by layer, then far to near; faces within a part draw far to near.
type Part = { faces: Face[]; layer: number };

const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Point, k: number): Point => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Point, b: Point): Point => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: Point): Point => scale(a, 1 / Math.hypot(...a));

// World light from above and screen-left of the viewer, stepped into five tones as the asteroids.
const LIGHT = unit([-0.25, 0.45, 1]);
const STEPS = [0.9, 0.78, 0.6, 0.3];

function newell(points: readonly Point[]): Point {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (const [i, a] of points.entries()) {
    const b = points[(i + 1) % points.length]!;
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return [nx, ny, nz];
}

function tone(normal: Point, ramp: Ramp): string {
  const l = dot(unit(normal), LIGHT);
  const i = STEPS.findIndex((step) => l >= step);
  return ramp[i < 0 ? 4 : i]!;
}

function centroid(points: readonly Point[]): Point {
  return scale(points.reduce(add, [0, 0, 0]), 1 / points.length);
}

// The face oriented so its normal points away from `inside`.
function outward(points: Point[], inside: Point): Point[] {
  const n = newell(points);
  const c = centroid(points);
  return dot(n, [c[0] - inside[0], c[1] - inside[1], c[2] - inside[2]]) < 0
    ? points.toReversed()
    : points;
}

type Station = readonly [y: number, halfWidth: number, top: number, bottom: number, zc: number];

// A closed body from elliptical rings, belly faces below `belly(ringFraction)` on each ring.
function loft(
  stations: readonly Station[],
  segments: number,
  deform: (p: Point) => Point,
  top: Ramp,
  bellyRamp: Ramp,
  belly: (fraction: number) => number,
): Part {
  const phase = Math.PI / 2;
  const angle = (j: number) => phase + (2 * Math.PI * j) / segments;
  const rings = stations.map(([y, a, b, c, zc]) => ({
    centre: [0, y, zc] as Point,
    ring: Array.from({ length: segments }, (_, j) => {
      const s = Math.sin(angle(j));
      return deform([a * Math.cos(angle(j)), y, zc + (s > 0 ? b : c) * s]);
    }),
  }));
  const faces: Face[] = [];
  for (let i = 0; i < rings.length - 1; i++) {
    const r0 = rings[i]!;
    const r1 = rings[i + 1]!;
    const inside = deform(scale(add(r0.centre, r1.centre), 0.5));
    const limit = belly(i / (rings.length - 1));
    for (let j = 0; j < segments; j++) {
      const k = (j + 1) % segments;
      const fill = Math.sin(angle(j + 0.5)) < limit ? bellyRamp : top;
      const [a, b, c, d] = [r0.ring[j]!, r0.ring[k]!, r1.ring[k]!, r1.ring[j]!];
      faces.push({
        fill,
        halves: [outward([a, b, c], inside), outward([a, c, d], inside)],
        points: outward([a, b, c, d], inside),
      });
    }
  }
  // Caps fan to the end centres, pushed out a little.
  for (const [index, push] of [
    [0, -1],
    [rings.length - 1, 1],
  ] as const) {
    const { centre, ring } = rings[index]!;
    const tip = deform([0, centre[1] + push * 2, centre[2]]);
    const inside = deform([0, centre[1] - push * 4, centre[2]]);
    for (let j = 0; j < segments; j++) {
      const k = (j + 1) % segments;
      const fill = Math.sin(angle(j + 0.5)) < -0.25 ? bellyRamp : top;
      faces.push({ fill, points: outward([ring[j]!, ring[k]!, tip], inside) });
    }
  }
  return { faces, layer: 0 };
}

// An extruded plan, every vertex transformed after extrusion.
function prism(
  plan: readonly V2[],
  z0: number,
  z1: number,
  transform: (p: Point) => Point,
  top: Ramp,
  side: Ramp,
): Part {
  // Counterclockwise from above.
  const area = plan.reduce((sum, [x, y], i) => {
    const [nx, ny] = plan[(i + 1) % plan.length]!;
    return sum + x * ny - nx * y;
  }, 0);
  const ccw = area < 0 ? plan.toReversed() : plan;
  const upper = ccw.map(([x, y]) => transform([x, y, z1]));
  const lower = ccw.map(([x, y]) => transform([x, y, z0]));
  const faces: Face[] = [
    { fill: top, points: upper },
    { fill: side, points: lower.toReversed() },
  ];
  for (let i = 0; i < ccw.length; i++) {
    const j = (i + 1) % ccw.length;
    faces.push({ fill: side, points: [upper[j]!, upper[i]!, lower[i]!, lower[j]!] });
  }
  return { faces, layer: 0 };
}

// A flat polygon tangent to a surface point, lifted along its normal.
function decal(
  centre: Point,
  normal: Point,
  radius: number,
  fill: string,
  sides = 6,
  lift = 0.35,
  squash = 1,
): Face {
  const n = unit(normal);
  const ref: Point = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = unit(cross(n, ref));
  const v = cross(n, u);
  const points = Array.from({ length: sides }, (_, i): Point => {
    const a = (2 * Math.PI * i) / sides;
    return add(
      add(add(centre, scale(n, lift)), scale(u, Math.cos(a) * radius)),
      scale(v, Math.sin(a) * radius * squash),
    );
  });
  return { fill, points: dot(newell(points), n) < 0 ? points.toReversed() : points };
}

// ------------------------------------------------------------------ the lantern whale

type Palette = { body: Ramp; belly: Ramp; fin: Ramp; glow: string; glowDim: string };

const EYE = "#181425";
const GLINT = "#ffffff";
const SMILE = "#2c2660";

const PALETTES = {
  adult: {
    body: ["#aaa5e6", "#918bd4", "#7a74c0", "#6660a8", "#544d91"],
    belly: ["#e6e0f8", "#cec6ec", "#b3aad9", "#988ec0", "#7c72a4"],
    fin: ["#9d97dd", "#847dc9", "#6e68b3", "#5d569c", "#4c4585"],
    glow: "#f7f2ff",
    glowDim: "#cbb8ee",
  },
  calf: {
    body: ["#bfbaef", "#a8a2e1", "#918bcf", "#7d77ba", "#6b64a6"],
    belly: ["#eeeafb", "#d9d2f2", "#c1b8e3", "#a69dcc", "#8a80b0"],
    fin: ["#afa9e6", "#9790d6", "#7e77c0", "#665fa6", "#504a87"],
    glow: "#fbf8ff",
    glowDim: "#d8c9f4",
  },
} as const satisfies Record<string, Palette>;

// Body rings: t, half width, top, bottom and centre height as fractions of body length.
const PROFILE: readonly (readonly [number, number, number, number, number])[] = [
  [0.0, 0.04, 0.03, 0.034, -0.012],
  [0.035, 0.085, 0.066, 0.075, -0.008],
  [0.09, 0.12, 0.092, 0.104, -0.004],
  [0.18, 0.143, 0.108, 0.12, 0],
  [0.3, 0.15, 0.112, 0.12, 0],
  [0.43, 0.138, 0.102, 0.104, 0.002],
  [0.56, 0.115, 0.086, 0.08, 0.004],
  [0.68, 0.085, 0.064, 0.056, 0.004],
  [0.79, 0.055, 0.042, 0.036, 0.002],
  [0.88, 0.033, 0.026, 0.022, 0],
  [0.95, 0.02, 0.017, 0.014, 0],
  [1.0, 0.013, 0.012, 0.01, 0],
];

function profileAt(t: number): readonly number[] {
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const [t0, ...v0] = PROFILE[i]!;
    const [t1, ...v1] = PROFILE[i + 1]!;
    if (t0 <= t && t <= t1) {
      const f = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
      return v0.map((a, k) => a + (v1[k]! - a) * f);
    }
  }
  return (t > PROFILE.at(-1)![0] ? PROFILE.at(-1)! : PROFILE[0]!).slice(1);
}

// Flipper plan: span fraction, then chord position as a fraction of body length.
const FLIPPER: readonly V2[] = [
  [0, -0.065],
  [0.34, -0.01],
  [0.66, 0.07],
  [0.9, 0.15],
  [1.0, 0.21],
  [0.93, 0.25],
  [0.66, 0.2],
  [0.33, 0.12],
  [0, 0.085],
];
// Right half of the notched fluke, fractions of body length from the head.
const FLUKE: readonly V2[] = [
  [0.0, 0.985],
  [0.07, 1.01],
  [0.15, 1.04],
  [0.205, 1.085],
  [0.17, 1.095],
  [0.09, 1.075],
  [0.025, 1.085],
  [0.0, 1.07],
];

type Model = {
  // Body length, frame px.
  length: number;
  palette: Palette;
  calf: boolean;
  spots: number;
  // Two rows down the back, or one centre row that alternates single and paired spots.
  pattern: "rows" | "centre";
};

// The posed whale at swim `phase` (radians). `lit` is the spot pair the song ripple lights.
function lantern({ calf, length: L, palette, pattern, spots }: Model, phase: number, lit: number) {
  const hover = 0.085 * L;
  const head = calf ? 1.14 : 1;
  const amp = 0.05 * L;
  const bob = 0.007 * L * Math.sin(phase + Math.PI / 2);
  const wave = (t: number) => amp * Math.max(0, (t - 0.32) / 0.68) ** 2 * Math.sin(phase - 2.3 * t);
  const deform = ([x, y, z]: Point): Point => [x, y, z + hover + bob + wave((y + L / 2) / L)];

  const stations = PROFILE.map(([t, a, b, c, zc]): Station => {
    const k = t < 0.45 ? head : 1 + (head - 1) * Math.max(0, (0.6 - t) / 0.15);
    return [t * L - L / 2, a * L * k * 1.2, b * L * k * 1.1, c * L * k * 1.1, zc * L];
  });
  const parts: Part[] = [
    loft(stations, 10, deform, palette.body, palette.belly, (f) => (f < 0.45 ? 0.05 : -0.3)),
  ];

  // A deformed surface point at body fraction t and ring angle th, with its outward normal.
  const surface = (t: number, th: number): [Point, Point] => {
    const [a0, b0, c0, zc0] = profileAt(t) as [number, number, number, number];
    const k = t < 0.45 ? head : 1;
    const [a, b, c] = [a0 * L * k * 1.2, b0 * L * k * 1.1, c0 * L * k * 1.1];
    const s = Math.sin(th);
    const r = s > 0 ? b : c;
    return [
      deform([a * Math.cos(th), t * L - L / 2, zc0 * L + r * s]),
      [Math.cos(th) / a, 0, s / r],
    ];
  };

  // Long swept flippers; the beat follows the swim phase.
  const reach = (calf ? 0.24 : 0.29) * L;
  const droop = ((20 + 10 * Math.sin(phase + 0.8)) * Math.PI) / 180;
  for (const side of [-1, 1]) {
    const [[x0, ry, rz]] = surface(0.3, Math.PI / 2 - side * (Math.PI / 2) * 0.92);
    const rx = side * Math.abs(x0) * 0.92;
    const transform = ([u, v, z]: Point): Point => [
      rx + side * u * Math.cos(droop),
      ry + v,
      rz - 0.02 * L + z - u * Math.sin(droop),
    ];
    const plan = FLIPPER.map(([u, v]): V2 => [u * reach, v * L]);
    parts.push(prism(plan, -0.006 * L, 0.006 * L, transform, palette.fin, palette.fin));
  }

  // The fluke follows the body wave past the tail tip.
  const fluke = [...FLUKE, ...FLUKE.toReversed().map(([x, y]): V2 => [-x, y])].map(([x, y]): V2 => [
    x * L,
    y * L - L / 2,
  ]);
  parts.push(prism(fluke, -0.005 * L, 0.005 * L, deform, palette.fin, palette.belly));

  // Spots, crown, eyes and smile.
  const decals: Face[] = [];
  for (let i = 0; i < spots; i++) {
    const t = 0.17 + (i * 0.56) / Math.max(1, spots - 1);
    const r = (0.024 - (0.011 * i) / Math.max(1, spots - 1)) * L * (calf ? 1.2 : 1);
    const fill = i === lit || i === lit - 1 ? palette.glow : palette.glowDim;
    const offsets = pattern === "rows" ? [-0.62, 0.62] : i % 2 === 0 ? [0] : [-0.42, 0.42];
    for (const offset of offsets) {
      const [p, n] = surface(t, Math.PI / 2 + offset);
      decals.push(decal(p, n, r, fill), decal(p, n, r * 0.5, palette.glow, 6, 0.5));
    }
  }
  for (const [t, th] of [
    [0.07, Math.PI / 2],
    [0.105, Math.PI / 2 - 0.35],
    [0.105, Math.PI / 2 + 0.35],
  ] as const) {
    const [p, n] = surface(t, th);
    decals.push(decal(p, n, 0.012 * L, lit > 1 ? palette.glowDim : palette.glow));
  }
  const eye = (calf ? 0.026 : 0.019) * L;
  for (const side of [-1, 1]) {
    const th = Math.PI / 2 - side * (Math.PI / 2 + 0.05);
    const [p, n] = surface(0.115, th);
    decals.push(decal(p, n, eye, EYE, 8, 0.4, 0.85));
    const [p2, n2] = surface(0.105, th - side * 0.18);
    decals.push(decal(p2, n2, eye * 0.42, GLINT, 6, 0.7));
    // A short upturned strip from the snout below the eye.
    for (let k = 0; k < 5; k++) {
      const [p3, n3] = surface(0.03 + k * 0.018, th - side * (-0.42 + 0.05 * k * k * 0.3));
      decals.push(decal(p3, n3, 0.0055 * L, SMILE, 4, 0.4));
    }
  }
  parts.push({ faces: decals, layer: 1 });
  return parts;
}

// ------------------------------------------------------------------ kinds

type Kind = {
  kind: string;
  title: string;
  model: Model;
  // Loop frame duration, ms.
  idleMs: number;
  swimMs: number;
  // Heading held while the whale is still.
  stationaryHeading: number;
};

const KINDS: Kind[] = [
  {
    kind: "whale",
    title: "Whale",
    model: { calf: false, length: 190, palette: PALETTES.adult, pattern: "rows", spots: 6 },
    idleMs: 300,
    swimMs: 150,
    stationaryHeading: 4,
  },
  {
    kind: "adult",
    title: "Smaller adult",
    model: { calf: false, length: 150, palette: PALETTES.adult, pattern: "centre", spots: 5 },
    idleMs: 300,
    swimMs: 150,
    stationaryHeading: 6,
  },
  {
    kind: "calf",
    title: "Calf",
    model: { calf: true, length: 80, palette: PALETTES.calf, pattern: "rows", spots: 4 },
    idleMs: 200,
    swimMs: 100,
    stationaryHeading: 6,
  },
  {
    kind: "youngCalf",
    title: "Younger calf",
    model: { calf: true, length: 66, palette: PALETTES.calf, pattern: "rows", spots: 3 },
    idleMs: 200,
    swimMs: 100,
    stationaryHeading: 7,
  },
];

// The family destination: each member's offset from the smaller adult in world units.
const FAMILY = [
  { kind: "adult", offset: [0, 0] },
  { kind: "calf", offset: [38, 40] },
  { kind: "youngCalf", offset: [-18, 58] },
];

// ------------------------------------------------------------------ frames

type Poly = { fill: string; hull: boolean; pts: V2[] };

// Moves every point so the plan's bounding box centres on the origin, the pivot.
function centred(parts: Part[]): Part[] {
  const ys = parts.flatMap(({ faces, layer }) =>
    layer === 0 ? faces.flatMap(({ points }) => points.map((p) => p[1])) : [],
  );
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  return parts.map((part) => ({
    ...part,
    faces: part.faces.map((face) => mapFace(face, ([x, y, z]) => [x, y - mid, z])),
  }));
}

// The face with `move` applied to every point, its halves included.
function mapFace({ fill, halves, points }: Face, move: (p: Point) => Point): Face {
  const face: Face = { fill, points: points.map(move) };
  if (halves) {
    face.halves = [halves[0].map(move), halves[1].map(move)];
  }
  return face;
}

const colour = (fill: Ramp | string, points: readonly Point[]) =>
  typeof fill === "string" ? fill : tone(newell(points), fill);

// A rotated face's visible polygons: a body quad whole or as its visible halves.
function visible({ fill, halves, points }: Face): { fill: string; points: Point[] }[] {
  const shown = (halves ?? [points])
    .filter((half) => facesViewer(half))
    .map((half) => ({ fill: colour(fill, half), points: half }));
  return halves && shown.length === 2 && shown[0]!.fill === shown[1]!.fill
    ? [{ fill: shown[0]!.fill, points }]
    : shown;
}

// Visible faces in draw order, frame px with the pivot at the origin.
function polygons(parts: readonly Part[], yaw: number): Poly[] {
  const turned = parts.map((part) => {
    const faces = part.faces.map((face) => mapFace(face, (p) => rotate(HEADINGS, yaw, p)));
    return { depth: depth(faces.flatMap(({ points }) => points)), faces, layer: part.layer };
  });
  turned.sort((a, b) => a.layer - b.layer || b.depth - a.depth);
  return turned.flatMap(({ faces, layer }) =>
    faces
      .flatMap(visible)
      .map(({ fill, points }) => ({
        depth: depth(points),
        fill,
        hull: layer === 0,
        pts: points.map((p) => projectAt(0, 0, p)),
      }))
      .sort((a, b) => b.depth - a.depth),
  );
}

// World units from the pivot for a rotated point's plan position (asteroids.ts `world`).
function world([x, y]: Point): V2 {
  const sx = (DISPLAY * (x - y) * Math.sqrt(3)) / 2;
  const sy = (DISPLAY * (x + y)) / 2;
  return [sx / 2 + sy, sy - sx / 2];
}

const r2 = (v: number) => Math.round(v * 100) / 100 + 0;
const r5 = (v: number) => Math.round(v * 1e5) / 1e5 + 0;

function svgFrame(title: string, canvas: Canvas, polys: readonly Poly[]): string {
  const line = ({ fill, pts }: Poly, seam: boolean) => {
    const points = pts
      .map(([x, y]) => `${(x - canvas.x0).toFixed(1)},${(y - canvas.y0).toFixed(1)}`)
      .join(" ");
    return `    <polygon fill="${fill}"${seam ? ` stroke="${fill}"` : ""} points="${points}"/>`;
  };
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${round(canvas.frameWidth)} ${round(canvas.frameHeight)}">`,
    `  <title>${title}</title>`,
    `  <g stroke-width="${SEAM}" stroke-linejoin="round">`,
    ...polys.filter(({ hull }) => hull).map((poly) => line(poly, true)),
    "  </g>",
    "  <g>",
    ...polys.filter(({ hull }) => !hull).map((poly) => line(poly, false)),
    "  </g>",
    "</svg>",
    "",
  ].join("\n");
}

// One heading's canvas, shared by its loop frames: integer display px, frame px viewBox, centred
// on the drawing. x0, y0 are the canvas origin in pivot-relative frame px.
type Canvas = {
  frameHeight: number;
  frameWidth: number;
  height: number;
  width: number;
  x0: number;
  y0: number;
};

function canvasFor(frames: readonly Poly[][]): Canvas {
  const pts = frames.flat().flatMap(({ pts }) => pts);
  const grow = SEAM / 2 + MARGIN;
  const [minX, maxX] = [Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[0]))];
  const [minY, maxY] = [Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[1]))];
  const width = Math.ceil((maxX - minX + 2 * grow) * DISPLAY);
  const height = Math.ceil((maxY - minY + 2 * grow) * DISPLAY);
  const frameWidth = width / DISPLAY;
  const frameHeight = height / DISPLAY;
  return {
    frameHeight,
    frameWidth,
    height,
    width,
    x0: (minX + maxX - frameWidth) / 2,
    y0: (minY + maxY - frameHeight) / 2,
  };
}

// Frame file pattern, as whales.json states it.
const FILES = "/art/whales/{kind}-{heading}-{frame}.svg";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
mkdirSync(`${art}whales/`, { recursive: true });

const entries: object[] = [];
let pixels = 0;
const kinds = KINDS.map(({ idleMs, kind, model, stationaryHeading, swimMs, title }) => {
  const posed = Array.from({ length: FRAMES }, (_, f) =>
    centred(lantern(model, (2 * Math.PI * f) / FRAMES, f)),
  );
  const headings = Array.from({ length: HEADINGS }, (_, yaw) => {
    const frames = posed.map((parts) => polygons(parts, yaw));
    const canvas = canvasFor(frames);
    const files = frames.map((polys, f) => {
      const path = FILES.replace("{kind}", kind)
        .replace("{heading}", `${yaw}`)
        .replace("{frame}", `${f}`);
      writeFileSync(
        `${art}${path.slice(5)}`,
        svgFrame(`${title} ${yaw} frame ${f}`, canvas, polys),
      );
      return path;
    });
    const pivot = { x: r5(-canvas.x0 / canvas.frameWidth), y: r5(-canvas.y0 / canvas.frameHeight) };
    files.forEach((path, f) => {
      pixels += canvas.width * canvas.height;
      entries.push({
        id: `whale-${kind}-${yaw}-${f}`,
        path,
        width: canvas.width,
        height: canvas.height,
        displayWidth: canvas.width,
        displayHeight: canvas.height,
        facing: `world-${yaw}`,
        directionIndex: yaw,
        pivot,
        kind,
        loopFrame: f,
      });
    });
    // The plan straight down onto the world plane, over every loop frame.
    const footprintRadius = Math.max(
      ...posed.flatMap((parts) =>
        parts
          .filter(({ layer }) => layer === 0)
          .flatMap(({ faces }) => faces.flatMap(({ points }) => points))
          .map((p) => Math.hypot(...world(rotate(HEADINGS, yaw, p)))),
      ),
    );
    return {
      index: yaw,
      frame: { width: round(canvas.frameWidth), height: round(canvas.frameHeight) },
      display: { width: canvas.width, height: canvas.height },
      pivot: [pivot.x, pivot.y],
      footprintRadius: r2(footprintRadius),
    };
  });
  return {
    kind,
    title,
    length: model.length,
    scale: r5(model.length / KINDS[0]!.model.length),
    spots: { count: model.spots, pattern: model.pattern },
    loop: { frames: FRAMES, idleMs, swimMs },
    stationaryHeading,
    headings,
  };
});

writeFileSync(
  `${art}whales.json`,
  json({
    version: 1,
    displayScale: DISPLAY,
    headings: HEADINGS,
    files: FILES,
    palette: {
      hull: PALETTES.adult.body,
      throat: PALETTES.adult.belly,
      fin: PALETTES.adult.fin,
      glow: PALETTES.adult.glowDim,
      glowCore: PALETTES.adult.glow,
      calfHull: PALETTES.calf.body,
      calfThroat: PALETTES.calf.belly,
      calfFin: PALETTES.calf.fin,
      calfGlow: PALETTES.calf.glowDim,
      calfGlowCore: PALETTES.calf.glow,
    },
    reducedMotion: { frame: 0 },
    family: FAMILY,
    kinds,
  }),
);
// The whale and the smaller adult are also Black Eye finale allies, so their frames are shared
// art in core; the calves are Whirlpool's alone. Whirlpool's entries go first, so no id is ever in
// both.
const SHARED = ["whale", "adult"];
const shared = (entry: object) => SHARED.includes((entry as { kind: string }).kind);
// In place in Whirlpool's manifest, which the station opens.
replaceEntries(
  "whirlpool",
  (id) => id.startsWith("whale-"),
  entries.filter((entry) => !shared(entry)) as { id: string }[],
);
placeEntries("core", "whale-", entries.filter(shared) as { id: string }[]);

// Whirlpool's manifest names the whale data.
linkData("whirlpool", { whales: "/art/whales.json" });
console.log(`${entries.length} frames, ${(pixels / 1e6).toFixed(3)} megapixels rasterized`);
