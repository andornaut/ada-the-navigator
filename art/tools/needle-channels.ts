// Needle's narrow channels: the stitched edge line as runtime drawing data, the channel debris
// (an eye-ring segment and a needle tip in a lifted stone ramp with no contour: harmless matter), and the
// Eye's layout proposal for Gameplay. Contract: art/needle.md (Channels).
// Usage: node art/tools/needle-channels.ts
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  debrisPaint,
  eyeSegment,
  frameInk,
  needleTip,
  placedFragments,
  tumbleFrames,
} from "./debris.ts";
import { writeDebrisFrames } from "./debris-sheets.ts";
import { svgText } from "./svg-text.ts";
import { linkData, replaceEntries } from "./manifest.ts";
import { floorEdge, lift, MARKER, OUT, type Polygon, PUBLIC } from "./needle-common.ts";
import { stageRows } from "./polish-rows.ts";
import { json, round } from "./projection.ts";
import { DISPLAY_SCALE, type Mesh } from "./solid.ts";
import type { Fragment } from "./visible.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
// The play stone ramp (asteroids.json `stone`), the starting point of the lift.
const STONE = (
  JSON.parse(readFileSync(`${root}public/art/asteroids.json`, "utf8")) as { stone: string[] }
).stone;
const EDGE_FLOOR = 3;
const FRAMES = 8;
// The square frame of each piece, in frame px, with the pivot at its centre.
const FRAME = 80;

// ---------------------------------------------------------------- stitch
const STITCH = {
  color: MARKER,
  alpha: 0.38,
  width: 1,
  dash: [6, 4],
  inset: 0,
};

// ---------------------------------------------------------------- debris
// `scale` is display px per model unit.
const PIECES: {
  id: string;
  title: string;
  build: (paint: ReturnType<typeof debrisPaint>) => Mesh;
  scale: number;
}[] = [
  {
    id: "needle-debris-plate",
    title: "Needle channel debris plate",
    build: eyeSegment,
    scale: 0.7,
  },
  {
    id: "needle-debris-girder",
    title: "Needle channel debris girder",
    build: needleTip,
    scale: 0.93,
  },
];

// Each piece's 8 frames in `body`, in frame px with the pivot at the frame's centre.
const posed = (body: readonly string[]): Fragment[][][] =>
  PIECES.map(({ build, scale }) =>
    tumbleFrames(build(debrisPaint(body)), scale / DISPLAY_SCALE).map((visible) =>
      placedFragments(visible, FRAME / 2, FRAME / 2),
    ),
  );

const polygons = (visible: readonly Fragment[]): Polygon[] =>
  visible.map(({ points, slot, tones }) => ({ color: tones[slot], points }));

// The least Oklab L lift (0.01 steps) that puts each piece's edge median, over its 8 frames, at
// the floor or more.
const edgeOf = (body: readonly string[]) =>
  Math.min(
    ...posed(body).map((sets) => {
      const medians = sets.map((visible) => floorEdge(FRAME, FRAME, polygons(visible)));
      return medians.toSorted((a, b) => a - b)[Math.floor(medians.length / 2)]!;
    }),
  );
let bodyLift = 0;
while (edgeOf(lift(STONE, bodyLift)) < EDGE_FLOOR) {
  bodyLift = round(bodyLift + 0.01);
  if (bodyLift > 0.3) throw new Error("channel debris cannot reach its edge floor");
}
const BODY = lift(STONE, bodyLift);

const debrisSvg = new Map<string, string>();
const pieceData = posed(BODY).map((sets, index) => {
  const piece = PIECES[index]!;
  const centre = FRAME / 2;
  const files = sets.map((visible, k) => {
    const file = `${piece.id.slice("needle-".length)}-${k}`;
    const pts = visible.flatMap(({ points }) => points);
    const xs = pts.map(([x]) => x);
    const ys = pts.map(([, y]) => y);
    const bounds = [
      round(Math.min(...xs)),
      round(Math.min(...ys)),
      round(Math.max(...xs)),
      round(Math.max(...ys)),
    ];
    if (bounds[0]! < 0 || bounds[1]! < 0 || bounds[2]! > FRAME || bounds[3]! > FRAME) {
      throw new Error(`${piece.title} ${k}: the drawing leaves its ${FRAME} px frame`);
    }
    debrisSvg.set(
      `${file}.svg`,
      svgText(
        [
          `<svg xmlns="http://www.w3.org/2000/svg" width="${round(FRAME * DISPLAY_SCALE)}" height="${round(FRAME * DISPLAY_SCALE)}" viewBox="0 0 ${FRAME} ${FRAME}">`,
          `  <title>${piece.title} ${k}</title>`,
          ...frameInk(visible).ink,
          "</svg>",
          "",
        ].join("\n"),
      ),
    );
    return {
      file: `${PUBLIC}${file}.svg`,
      bounds,
      reach: Math.max(...pts.map(([x, y]) => Math.hypot(x - centre, y - centre))),
    };
  });
  return {
    id: piece.id,
    frame: FRAME,
    display: round(FRAME * DISPLAY_SCALE),
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
// The staged looks (art/needle.md, Bolder stitch and Ordered Eye): a bolder stitch, and the
// Eye's debris on an even spacing with one piece per row and its tumble frame stepping in order.
stageRows("runtime-stitch", {
  file: `${PUBLIC}channels.json`,
  stitch: { width: 2, dash: [10, 8], alpha: 0.6 },
});
stageRows("runtime-eye", {
  file: `${PUBLIC}eye.json`,
  eyelids: { ...EYE.eyelids, spread: 0 },
  debris: {
    ...EYE.debris,
    spacing: 44,
    // The piece of each row, from the channel edge outward.
    pieces: ["needle-debris-plate", "needle-debris-girder", "needle-debris-plate"],
    // Piece `index` along the path in row `row` starts on tumble frame
    // (index * frame.index + row * frame.row) mod 8.
    frame: { index: 1, row: 3 },
  },
});
replaceEntries(
  "needle",
  (id) => id.startsWith("needle-debris-"),
  writeDebrisFrames("needle", entries, debrisSvg),
);
linkData("needle", { needleChannels: `${PUBLIC}channels.json`, needleEye: `${PUBLIC}eye.json` });
console.log(
  `debris lift ${bodyLift}, body ${BODY.join(" ")}, worst piece edge median ${edgeOf(BODY).toFixed(2)}; gates off horizontal ${gates.map(({ offHorizontal: o }) => o.toFixed(1)).join(" ")}`,
);
