// Traveling debris: a broken piece of each galaxy's own station as one connected solid in the
// galaxy's field hue, tumbling about a tilted axis through 8 frames. Each frame resolves the
// solid's faces by depth into flat tones under the one light, inside the coral hazard contour
// where the piece is a hazard, and exports as an SVG frame with its data and manifest entries.
import { writeFileSync } from "node:fs";

import { DISPLAY_SCALE } from "./crafts.ts";
import { svgText } from "./svg-text.ts";
import { fromOklab, hex, rgb, toOklab } from "./oklab.ts";
import type { Point } from "./projection.ts";
import { TOLERANCES, traceFills } from "./silhouette.ts";
import { type Mesh, meshBar, meshScale, meshSpiral, meshTube, type Tones } from "./solid.ts";
import { type Fragment, pathData, tonePaths, type V2, visibleFragments } from "./visible.ts";

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

// The tone under the ramp's shadow step, for the second material's far walls: the ramp's last
// step lowered by this much Oklab L.
const DEEP_DROP = 0.06;

// The tumble: the piece leans LEAN degrees about the plan diagonal, then turns 360 / 8 degrees a
// frame about an axis tilted TILT degrees from vertical.
const LEAN = 20;
const TILT = 24;

// Direction mark, logical px: three coral dashes trailing a traveling debris piece. Dash i is
// centred `behind` px past the edge of its frame's drawn bounds along the reverse velocity and
// `side` px to the left of travel.
export const MARK_DASHES = [
  { length: 9, alpha: 0.95, behind: 7.5, side: -3 },
  { length: 6, alpha: 0.7, behind: 14.5, side: 3 },
  { length: 4, alpha: 0.45, behind: 21.5, side: 0 },
] as const;
export const MARK_WIDTH = 2;

export function unit([x, y, z]: Point): Point {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

const r2 = (v: number) => Math.round(v * 100) / 100 + 0;

export function bodyRamp(environmentDetail: string, chroma: number, hue: number): string[] {
  const [L] = toOklab(rgb(environmentDetail));
  const r = (hue * Math.PI) / 180;
  return BODY_LIFT.map((d) =>
    hex(
      fromOklab(L + d, chroma * BODY_CHROMA * Math.cos(r), chroma * BODY_CHROMA * Math.sin(r)),
    ).toUpperCase(),
  );
}

// The two materials of a piece from its five-step body ramp, lit to shadow: the main solid takes
// steps 1, 3 and 5 and the second solid steps 2, 4 and the deep tone.
export type DebrisPaint = { main: Tones; second: Tones };

export function debrisPaint(body: readonly string[]): DebrisPaint {
  const [L, a, b] = toOklab(rgb(body[4]!));
  const deep = hex(fromOklab(L - DEEP_DROP, a, b)).toUpperCase();
  return { main: [body[0]!, body[2]!, body[4]!], second: [body[1]!, body[3]!, deep] };
}

// ------------------------------------------------------------------ models
// Model units are display px before the piece's scale; each model is centred on its bounds.

function centred(mesh: Mesh): Mesh {
  const points = mesh.flatMap((face) => face.points);
  const middle = ([0, 1, 2] as const).map(
    (axis) =>
      (Math.max(...points.map((p) => p[axis])) + Math.min(...points.map((p) => p[axis]))) / 2,
  );
  return mesh.map((face) => ({
    ...face,
    points: face.points.map(([x, y, z]): Point => [x - middle[0]!, y - middle[1]!, z - middle[2]!]),
  }));
}

// A level band of a ring: centre radius, width, base and top, between two plan angles.
function arc(
  mesh: Mesh,
  radius: number,
  width: number,
  [base, top]: readonly [number, number],
  [from, to]: readonly [number, number],
  tones: Tones,
): void {
  meshSpiral(mesh, from, to - from, () => ({ radius, width, top, base }), tones, 6);
}

// Cartwheel: a wheel-rim segment with the stub of its spoke.
export function rimSegment({ main, second }: DebrisPaint): Mesh {
  const mesh: Mesh = [];
  arc(mesh, 30, 11, [-5, 5], [-42, 42], main);
  meshBar(mesh, 0, [13, 25.5], 8, [-3, 3], second);
  meshBar(mesh, 0, [9, 13], 11, [-4.5, 4.5], main);
  return centred(mesh);
}

// Whirlpool: a spiral-arm segment that still carries its end pod.
export function armSegment({ main, second }: DebrisPaint): Mesh {
  const mesh: Mesh = [];
  arc(mesh, 26, 10, [-4.5, 4.5], [-50, 28], main);
  const a = (34 * Math.PI) / 180;
  const [x, y] = [26 * Math.cos(a), 26 * Math.sin(a)];
  meshTube(mesh, [x, y, -6.5], [x, y, 6.5], 8, 8, second);
  return centred(mesh);
}

// Whirlpool: a slice of the drum with the root of one arm.
export function drumSlice({ main, second }: DebrisPaint): Mesh {
  const mesh: Mesh = [];
  meshTube(mesh, [0, 0, -6], [0, 0, 6], 11, 11, second);
  meshTube(mesh, [0, 0, 6], [0, 0, 9], 6.5, 6.5, main);
  meshBar(mesh, 20, [8, 23], 10, [-4, 4], main);
  return centred(mesh);
}

// Needle: a segment of the eye ring with one needle socket block.
export function eyeSegment({ main, second }: DebrisPaint): Mesh {
  const mesh: Mesh = [];
  arc(mesh, 19, 8, [-3.5, 3.5], [-55, 55], main);
  meshBar(mesh, 0, [20, 27], 9, [-4.5, 4.5], second);
  return centred(mesh);
}

// Needle: the broken tip of the needle with its collar.
export function needleTip({ main, second }: DebrisPaint): Mesh {
  const mesh: Mesh = [];
  meshTube(mesh, [-9, 0, 0], [12, 0, 0], 7, 3.6, main, 8, { kind: "flat" });
  meshTube(mesh, [-13, 0, 0], [-7, 0, 0], 9, 9, second, 8, { kind: "flat" });
  return centred(mesh);
}

// ------------------------------------------------------------------ frames

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

const DEGREES = Math.PI / 180;
const TUMBLE_AXIS = turn(unit([1, -1, 0]), TILT * DEGREES, [0, 0, 1]);
const LEAN_AXIS = unit([1, 1, 0]);

// The visible fragments of tumble frame `k`, in frame px from the pivot. `scale` is frame px per
// model unit.
export function tumbleFrame(mesh: Mesh, scale: number, k: number): Fragment[] {
  return visibleFragments(meshScale(mesh, [scale, scale, scale]), (point) =>
    turn(TUMBLE_AXIS, (k * 2 * Math.PI) / TUMBLE_FRAMES, turn(LEAN_AXIS, LEAN * DEGREES, point)),
  );
}

export const tumbleFrames = (mesh: Mesh, scale: number): Fragment[][] =>
  Array.from({ length: TUMBLE_FRAMES }, (_, k) => tumbleFrame(mesh, scale, k));

// The fragments moved so the pivot is at (x, y).
export const placedFragments = (visible: readonly Fragment[], x: number, y: number): Fragment[] =>
  visible.map((fragment) => ({
    ...fragment,
    points: fragment.points.map(([px, py]): V2 => [px + x, py + y]),
  }));

// One path per tone, the silhouette first; `silhouette` is its path data.
export function frameInk(visible: readonly Fragment[]): { ink: string[]; silhouette: string } {
  const paths = tonePaths(visible);
  return {
    ink: paths.map(({ fill, loops }) => `  <path fill="${fill}" d="${pathData(loops)}"/>`),
    silhouette: pathData(paths[0]!.loops),
  };
}

export type DebrisSpec = {
  id: string;
  title: string;
  mesh: Mesh;
  // Display px per model unit.
  scale: number;
  // The frame in frame px and the pivot's height in it; the pivot is on the vertical centre line.
  frame: { width: number; height: number; top: number };
};

// Returns the frames `{id}-{k}.svg` through `writeFrame`, served under `publicDir`, and the
// piece's data and manifest entries.
export function exportDebris(
  dir: string,
  publicDir: string,
  coral: string,
  { frame, id, mesh, scale, title }: DebrisSpec,
  writeFrame: (file: string, svg: string) => void = (file, svg) =>
    writeFileSync(`${dir}${file}.svg`, svg),
) {
  // Contour stroke in frame px: twice the contour, half of it outside the silhouette.
  const stroke = (2 * CONTOUR) / DISPLAY_SCALE;
  const outside = stroke / 2;
  const { width: w, height: h, top } = frame;
  const half = w / 2;
  const files = tumbleFrames(mesh, scale / DISPLAY_SCALE).map((centredOnPivot, k) => {
    const visible = placedFragments(centredOnPivot, half, top);
    const drawn = visible.flatMap(({ points }) => points);
    const xs = drawn.map(([x]) => x);
    const ys = drawn.map(([, y]) => y);
    const bounds = [
      r2(Math.min(...xs) - outside),
      r2(Math.min(...ys) - outside),
      r2(Math.max(...xs) + outside),
      r2(Math.max(...ys) + outside),
    ];
    if (bounds[0]! < 0 || bounds[1]! < 0 || bounds[2]! > w || bounds[3]! > h) {
      throw new Error(
        `${title} ${k}: the drawing ${bounds.join(" ")} leaves its ${w} by ${h} frame`,
      );
    }
    const { ink, silhouette } = frameInk(visible);
    const file = `${id}-${k}`;
    // The viewBox stays in frame px; the intrinsic size is the display size, so the frame
    // rasterizes at the size it is drawn.
    writeFrame(
      file,
      svgText(
        [
          `<svg xmlns="http://www.w3.org/2000/svg" width="${w * DISPLAY_SCALE}" height="${h * DISPLAY_SCALE}" viewBox="0 0 ${w} ${h}">`,
          `  <title>${title} ${k}</title>`,
          // Coral contour: the silhouette stroked wide in coral underneath, then the tones.
          `  <path fill="${coral}" stroke="${coral}" stroke-width="${stroke.toFixed(2)}" stroke-linejoin="round" d="${silhouette}"/>`,
          ...ink,
          "</svg>",
          "",
        ].join("\n"),
      ),
    );
    // The contour is the outermost stroke: the drawing is the faces grown by its half-width.
    const traced = traceFills(
      `${title} ${k}`,
      visible.map(({ points, slot, tones }) => ({
        color: tones[slot],
        points: points.map(([x, y]) => [Number(x.toFixed(2)), Number(y.toFixed(2))] as V2),
      })),
      [w, h],
      TOLERANCES,
      Number(stroke.toFixed(2)) / 2,
    );
    if (traced.tips.length) throw new Error(`${title} ${k}: the outline has a notch tip`);
    return {
      file,
      collision: traced.collision,
      bounds,
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
    frames: files.map(({ bounds, collision, file }) => ({
      file: `${publicDir}${file}.svg`,
      bounds,
      collision,
    })),
  };
  return { data, entries };
}
