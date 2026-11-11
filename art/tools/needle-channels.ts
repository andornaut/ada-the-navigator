// Needle's narrow channels: the stitched edge line as runtime drawing data, the channel debris
// (the shared plate and girder in a lifted stone ramp with no contour: harmless matter), and the
// Eye's layout proposal for Gameplay. Contract: art/needle.md (Channels).
// Usage: node art/tools/needle-channels.ts
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { bentPlate, brokenGirder, type Solid, unit } from "./debris.ts";
import { linkData, replaceEntries } from "./manifest.ts";
import {
  edgeContrast,
  lift,
  MARKER,
  OUT,
  type Polygon,
  PUBLIC,
  squareFrame,
  svgFile,
} from "./needle-common.ts";
import { depth, facesViewer, json, type Point, projectAt, round } from "./projection.ts";
import { DISPLAY_SCALE } from "./solid.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
// The play stone ramp (asteroids.json `stone`), the starting point of the lift.
const STONE = (
  JSON.parse(readFileSync(`${root}public/art/asteroids.json`, "utf8")) as { stone: string[] }
).stone;
const EDGE_FLOOR = 3;
const SCALE = 0.8;
const FRAMES = 8;
const SEAM = 1.2;

// ---------------------------------------------------------------- stitch
const STITCH = {
  color: MARKER,
  alpha: 0.38,
  width: 1,
  dash: [6, 4],
  inset: 0,
};

// ---------------------------------------------------------------- debris
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

function tone(body: readonly string[], face: readonly Point[], accent: boolean): string {
  const l = dot(unit(normal(face)), LIGHT);
  const i = STEPS.findIndex((s) => l >= s);
  return body[Math.min(body.length - 1, (i < 0 ? body.length - 1 : i) + (accent ? 1 : 0))]!;
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

const PIECES: { id: string; title: string; solid: Solid; axis: Point }[] = [
  {
    id: "needle-debris-plate",
    title: "Needle channel debris plate",
    solid: bentPlate(),
    axis: unit([0.3, 0.2, 1]),
  },
  {
    id: "needle-debris-girder",
    title: "Needle channel debris girder",
    solid: brokenGirder(),
    axis: unit([0.25, -0.3, 1]),
  },
];

type Facet = { accent: boolean; face: Point[] };

const posed = ({ axis, solid }: (typeof PIECES)[number]): Facet[][] =>
  Array.from({ length: FRAMES }, (_, k) =>
    solid.flatMap(({ accent, faces }) =>
      faces.map((f) => ({
        accent: accent ?? false,
        face: f.map((p) => {
          const q = turn(axis, (k * 2 * Math.PI) / FRAMES, p);
          return [q[0] * SCALE, q[1] * SCALE, q[2] * SCALE] as Point;
        }),
      })),
    ),
  );

const drawFrame = (body: readonly string[], facets: readonly Facet[], centre: number): Polygon[] =>
  facets
    .filter(({ face }) => facesViewer(face))
    .toSorted((a, b) => depth(b.face) - depth(a.face))
    .map(({ accent, face }) => ({
      color: tone(body, face, accent),
      points: face.map((p) => projectAt(centre, centre, p)),
    }));

const frames = PIECES.map((piece) => {
  const sets = posed(piece);
  return { piece, sets, frame: squareFrame(sets.flat().flatMap(({ face }) => face)) };
});

// The least Oklab L lift (0.01 steps) that puts each piece's edge median, over its 8 frames, at
// the floor or more.
const edgeOf = (body: readonly string[]) =>
  Math.min(
    ...frames.map(({ frame, sets }) => {
      const medians = sets.map(
        (facets) => edgeContrast(frame, frame, drawFrame(body, facets, frame / 2)).median,
      );
      return medians.toSorted((a, b) => a - b)[Math.floor(medians.length / 2)]!;
    }),
  );
let bodyLift = 0;
while (edgeOf(lift(STONE, bodyLift)) < EDGE_FLOOR) {
  bodyLift = round(bodyLift + 0.01);
  if (bodyLift > 0.3) throw new Error("channel debris cannot reach its edge floor");
}
const BODY = lift(STONE, bodyLift);

const pieceData = frames.map(({ frame, piece, sets }) => {
  const centre = frame / 2;
  const files = sets.map((facets, k) => {
    const polygons = drawFrame(BODY, facets, centre);
    const file = `${piece.id.slice("needle-".length)}-${k}`;
    const svg = svgFile(`${piece.title} ${k}`, frame, frame, polygons).replace(
      /<polygon fill="(#[0-9A-Fa-f]{6})"/g,
      `<polygon fill="$1" stroke="$1" stroke-width="${SEAM}" stroke-linejoin="round"`,
    );
    writeFileSync(`${OUT}${file}.svg`, svg);
    const pts = polygons.flatMap(({ points }) => points);
    const xs = pts.map(([x]) => x);
    const ys = pts.map(([, y]) => y);
    const pad = SEAM / 2;
    return {
      file: `${PUBLIC}${file}.svg`,
      bounds: [
        round(Math.min(...xs) - pad),
        round(Math.min(...ys) - pad),
        round(Math.max(...xs) + pad),
        round(Math.max(...ys) + pad),
      ],
      reach: Math.max(...pts.map(([x, y]) => Math.hypot(x - centre, y - centre))) + pad,
    };
  });
  return {
    id: piece.id,
    frame,
    display: round(frame * DISPLAY_SCALE),
    pivot: [0.5, 0.5],
    radius: round(Math.max(...files.map(({ reach }) => reach))),
    frames: files.map(({ bounds, file }) => ({ file, bounds })),
  };
});

const entries = pieceData.flatMap(({ display, frame, frames: list, id }) =>
  list.map(({ file }, k) => ({
    id: `${id}-${k}`,
    path: file,
    width: frame,
    height: frame,
    displayWidth: display,
    displayHeight: display,
    facing: "front",
    tumbleIndex: k,
    pivot: { x: 0.5, y: 0.5 },
    debris: id,
  })),
);

// ---------------------------------------------------------------- the Eye
// World units from the Eye's entry. The axis runs at 20 degrees on the world plane, so with the
// S-curve's 12.4 degree swing every gate tangent stays 30 degrees or more off screen horizontal.
const EYE = {
  length: 2600,
  axis: 20,
  swing: 90,
  width: 150,
  gates: 8,
  firstGate: 0.12,
  gateStep: 0.1,
  holodiskBeyond: 60,
  pack: [420, -60] as const,
  eyelids: { base: 70, swell: 260, spread: 25 },
  debris: { rows: 3, spacing: 34, gap: 12, rowStep: 26, drift: [6, 12] as const },
};
const MIN_SCREEN_ANGLE = 30;

const axis = (EYE.axis * Math.PI) / 180;
const toWorld = (u: number, v: number): [number, number] => [
  round(u * Math.cos(axis) - v * Math.sin(axis)),
  round(u * Math.sin(axis) + v * Math.cos(axis)),
];
const centreAt = (t: number) => toWorld(t * EYE.length, EYE.swing * Math.sin(2 * Math.PI * t));
const tangentAt = (t: number): [number, number] => {
  const du = EYE.length;
  const dv = EYE.swing * 2 * Math.PI * Math.cos(2 * Math.PI * t);
  const l = Math.hypot(du, dv);
  const [x, y] = toWorld(du / l, dv / l);
  const n = Math.hypot(x, y);
  return [round(x / n), round(y / n)];
};
// Degrees off screen horizontal of a world direction in the game's projection (x - y, (x + y) / 2).
const offHorizontal = ([x, y]: readonly [number, number]) => {
  const a = Math.abs((Math.atan2((x + y) / 2, x - y) * 180) / Math.PI) % 180;
  return Math.min(a, 180 - a);
};
const POINTS = 60;
const path = Array.from({ length: POINTS + 1 }, (_, i) => centreAt(i / POINTS));
const gates = Array.from({ length: EYE.gates }, (_, i) => {
  const t = EYE.firstGate + i * EYE.gateStep;
  const tangent = tangentAt(t);
  const off = offHorizontal(tangent);
  if (off < MIN_SCREEN_ANGLE) {
    throw new Error(`Eye gate ${i + 1} is ${off.toFixed(1)} degrees off screen horizontal`);
  }
  return {
    index: i,
    along: round(t * EYE.length),
    point: centreAt(t),
    tangent,
    offHorizontal: round(off),
  };
});
const eye = {
  version: 1,
  proposal: "Art's layout for the Eye, in world units from its entry; Gameplay places the Eye",
  width: EYE.width,
  length: EYE.length,
  path,
  gates,
  holodisk: toWorld(EYE.length + EYE.holodiskBeyond, 0),
  pack: toWorld(EYE.length + EYE.pack[0], EYE.pack[1]),
  eyelids: EYE.eyelids,
  debris: EYE.debris,
};

// ---------------------------------------------------------------- write
writeFileSync(
  `${OUT}channels.json`,
  json({
    version: 1,
    displayScale: DISPLAY_SCALE,
    stitch: STITCH,
    debris: {
      body: BODY,
      contour: null,
      tumble: { frames: FRAMES, degPerSecond: [60, 120] },
      cue: "asteroid",
      pieces: pieceData,
    },
  }),
);
writeFileSync(`${OUT}eye.json`, json(eye));
replaceEntries("needle", (id) => id.startsWith("needle-debris-"), entries);
linkData("needle", { needleChannels: `${PUBLIC}channels.json`, needleEye: `${PUBLIC}eye.json` });
console.log(
  `debris lift ${bodyLift}, body ${BODY.join(" ")}, worst piece edge median ${edgeOf(BODY).toFixed(2)}; gates off horizontal ${gates.map(({ offHorizontal: o }) => o.toFixed(1)).join(" ")}`,
);
