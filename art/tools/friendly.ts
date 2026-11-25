// The friendly object producer (art/friendly-redesign.md). `node art/tools/friendly.ts` writes
// the pickups, caches, landmarks and galaxy beacons as sheets of nested roots beside the shipped
// art, the pickups' collision parts, and the manifest rows that switch to them in
// art/friendly-rows.json.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { DISPLAY_SCALE } from "./crafts.ts";
import { traceEnemyFills } from "./enemy-outline.ts";
import { tonePaths } from "./fleet.ts";
import {
  type FriendlyManifest,
  type FriendlyObject,
  friendlyObjects,
  GATE_AXES,
  GATE_COLLAR,
  GATE_LAMP,
  type GateLayer,
  GATE_OPENING,
  GATE_RIM,
  MOORING_ARMS,
  MOORING_CLEAT,
  NEEDLE_GATE_TONES,
  ringGate,
  WORLD_UNIT,
} from "./friendly-models.ts";
import { writeOnce } from "./manifest.ts";
import { json, type Point, projectAt, round } from "./projection.ts";
import { type Fill, TOLERANCES } from "./silhouette.ts";
import type { Mesh } from "./solid.ts";
import { svgText } from "./svg-text.ts";
import { type Fragment, type V2, visibleFragments } from "./visible.ts";

const identity = (point: Point) => point;
const colour = ({ slot, tones }: Fragment) => tones[slot];
const pathData = (loops: readonly V2[][]) =>
  loops.map((loop) => `M${loop.map(([x, y]) => `${x},${y}`).join("L")}Z`).join("");
const px = (value: number) => Math.round(value * 100) / 100 + 0;

export type FriendlyFrame = {
  id: string;
  svg: string;
  // The drawn outline, for a review sheet's keyline.
  silhouette: string;
  // Drawn extents in frame px: left, top, right, bottom.
  drawn: readonly [number, number, number, number];
  collision?: V2[][];
  row: Readonly<Record<string, unknown>>;
};
// An object drawn at its display size: its frame in frame px, where the model origin draws in
// it, and the frame px per model unit.
export type DrawnObject = Omit<FriendlyObject, "pivot"> & {
  width: number;
  height: number;
  // The manifest pivot, in frame px: the origin for a `ground` object, the centre otherwise.
  pivot: readonly [number, number];
  origin: readonly [number, number];
  scale: number;
  drawn: FriendlyFrame[];
};

const extents = (fragments: readonly Fragment[]) => {
  const xs = fragments.flatMap(({ points }) => points.map(([x]) => x));
  const ys = fragments.flatMap(({ points }) => points.map(([, y]) => y));
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as const;
};
const eight = (value: number) => Math.ceil(value / 8) * 8;

// One frame's markup and its outline: notch tips first, then one path per tone.
function frameSvg(
  width: number,
  height: number,
  title: string,
  placed: readonly Fragment[],
  tips: readonly Fill[] = [],
): { svg: string; silhouette: string } {
  const paths = tonePaths(placed);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<title>${title}</title>`,
    ...tips.map(
      ({ color, points }) =>
        `<polygon fill="${color}" points="${points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ")}"/>`,
    ),
    ...paths.map(({ fill, loops }) => `<path fill="${fill}" d="${pathData(loops)}"/>`),
    "</svg>",
  ].join("");
  return { svg: svgText(svg), silhouette: pathData(paths[0]!.loops) };
}

export function draw(object: FriendlyObject): DrawnObject {
  const visible = object.frames.map(({ mesh }) => visibleFragments(mesh, identity));
  const [x0, y0, x1, y1] = extents(visible[0]!);
  // Frame px per model unit: the first frame's drawn extents fit the object's display box.
  const scale = Math.min(object.fit[0] / (x1 - x0), object.fit[1] / (y1 - y0)) / DISPLAY_SCALE;
  const all = extents(visible.flat()).map((v) => v * scale) as unknown as readonly [
    number,
    number,
    number,
    number,
  ];
  // One frame px of margin on every side, sizes in multiples of 8.
  let width: number;
  let height: number;
  let origin: readonly [number, number];
  if (object.pivot === "ground") {
    width = eight(2 * (Math.ceil(Math.max(-all[0], all[2])) + 1));
    const above = Math.ceil(-all[1]) + 1;
    height = eight(above + Math.ceil(all[3]) + 1);
    origin = [width / 2, above];
  } else {
    width = eight(all[2] - all[0] + 2);
    height = eight(all[3] - all[1] + 2);
    origin = [px(width / 2 - (all[0] + all[2]) / 2), px(height / 2 - (all[1] + all[3]) / 2)];
  }
  const drawn = object.frames.map(({ id, title, row = {} }, index): FriendlyFrame => {
    const placed = visible[index]!.map((fragment) => ({
      ...fragment,
      points: fragment.points.map(([x, y]): V2 => [x * scale + origin[0], y * scale + origin[1]]),
    }));
    const traced = object.collision
      ? traceEnemyFills(
          id,
          placed.map((fragment): Fill => ({
            color: colour(fragment),
            points: fragment.points.map(([x, y]): V2 => [px(x), px(y)]),
          })),
          [width, height],
          TOLERANCES,
        )
      : undefined;
    const { svg, silhouette } = frameSvg(width, height, title, placed, traced?.tips);
    const box = extents(placed);
    return {
      id,
      svg,
      silhouette,
      drawn: [px(box[0]), px(box[1]), px(box[2]), px(box[3])],
      ...(traced ? { collision: traced.collision } : {}),
      row,
    };
  });
  return {
    ...object,
    width,
    height,
    pivot: object.pivot === "ground" ? origin : [width / 2, height / 2],
    origin,
    scale,
    drawn,
  };
}

export const drawnObjects = (): DrawnObject[] => friendlyObjects().map(draw);

// ------------------------------------------------------------------ ring gates

const GATE_FRAME = 288;
const GATE_STATES = ["dark", "lit"] as const;
const GATE_LAYERS = ["back", "front"] as const;
// Gates sit at least this far off screen horizontal (Gameplay).
const MIN_SCREEN_ANGLE = 30;

export type GateFrame = {
  id: string;
  state: (typeof GATE_STATES)[number];
  orientation: number;
  layer: GateLayer;
  svg: string;
  silhouette: string;
};
export type DrawnGates = {
  frames: GateFrame[];
  // The whole gate's drawn extents per orientation, in display px: width and height.
  extents: (readonly [number, number])[];
};

const gateFragments = (mesh: Mesh): Fragment[] =>
  visibleFragments(mesh, identity).map((fragment) => ({
    ...fragment,
    points: fragment.points.map(([x, y]): V2 => [
      x / DISPLAY_SCALE + GATE_FRAME / 2,
      y / DISPLAY_SCALE + GATE_FRAME / 2,
    ]),
  }));

export function drawGates(): DrawnGates {
  const frames: GateFrame[] = [];
  const sizes: (readonly [number, number])[] = [];
  for (const [orientation, degrees] of GATE_AXES.entries()) {
    const [x0, y0, x1, y1] = extents(gateFragments(ringGate(degrees, true)));
    if (x0 < 1 || y0 < 1 || x1 > GATE_FRAME - 1 || y1 > GATE_FRAME - 1) {
      throw new Error(`Ring gate ${orientation} leaves its frame`);
    }
    sizes.push([round((x1 - x0) * DISPLAY_SCALE), round((y1 - y0) * DISPLAY_SCALE)]);
    for (const state of GATE_STATES) {
      for (const layer of GATE_LAYERS) {
        const id = `needle-gate-${state}-${orientation}-${layer}`;
        frames.push({
          id,
          state,
          orientation,
          layer,
          ...frameSvg(
            GATE_FRAME,
            GATE_FRAME,
            `Ring gate ${state} ${orientation} ${layer}`,
            gateFragments(ringGate(degrees, state === "lit", layer)),
          ),
        });
      }
    }
  }
  return { frames, extents: sizes };
}

// Nested roots four to a row.
function gateSheet(frames: readonly GateFrame[]): string {
  const namespace = 'xmlns="http://www.w3.org/2000/svg"';
  const columns = 4;
  const root = `<svg ${namespace} width="${GATE_FRAME}" height="${GATE_FRAME}" viewBox="0 0 ${GATE_FRAME} ${GATE_FRAME}">`;
  const roots = frames.map(({ id, svg }, index) => {
    if (!svg.startsWith(root) || !svg.endsWith("</svg>")) {
      throw new Error(`Unexpected frame root: ${id}`);
    }
    const [x, y] = [(index % columns) * GATE_FRAME, Math.floor(index / columns) * GATE_FRAME];
    return `<svg id="${id}" x="${x}" y="${y}" ${svg.slice("<svg ".length)}`;
  });
  const [width, height] = [columns * GATE_FRAME, Math.ceil(frames.length / columns) * GATE_FRAME];
  return `<svg ${namespace} width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${roots.join("")}</svg>\n`;
}

const gateRows = (frames: readonly GateFrame[], path: string) =>
  frames.map(({ id, state, orientation, layer }) => ({
    id,
    path,
    width: GATE_FRAME,
    height: GATE_FRAME,
    displayWidth: GATE_FRAME * DISPLAY_SCALE,
    displayHeight: GATE_FRAME * DISPLAY_SCALE,
    facing: `axis-${orientation}`,
    pivot: { x: 0.5, y: 0.5 },
    gate: state,
    orientation,
    layer,
    svgSheet: true,
  }));

// The gate data the runtime reads, in the shape of the shipped gates.json.
function gateData({ frames, extents: sizes }: DrawnGates): string {
  const view = Math.sqrt(3);
  return json({
    version: 1,
    frame: GATE_FRAME,
    displayScale: DISPLAY_SCALE,
    opening: GATE_OPENING,
    rim: GATE_RIM,
    // Art only, without collision: the collars' reach from the centre, in world units.
    collar: round(GATE_COLLAR),
    // Display px per world unit, exact across the screen, and how many times farther down the
    // screen the art draws a ground offset than the game's (x - y, (x + y) / 2).
    worldUnit: round(WORLD_UNIT),
    groundDepth: round(WORLD_UNIT),
    minScreenAngle: MIN_SCREEN_ANGLE,
    layers: GATE_LAYERS,
    light: { fadeMs: 240, easing: "cubicOut" },
    orientations: GATE_AXES.map((degrees, index) => {
      const a = (degrees * Math.PI) / 180;
      const [wx, wy] = [Math.cos(a), Math.sin(a)];
      const [sx, sy] = projectAt(0, 0, [wx, wy, 0]);
      const length = Math.hypot(sx, sy);
      const [gx, gy] = [wx - wy, (wx + wy) / 2];
      const files = (state: string) =>
        Object.fromEntries(
          GATE_LAYERS.map((layer) => [
            layer,
            frames.find((f) => f.state === state && f.orientation === index && f.layer === layer)!
              .id,
          ]),
        );
      return {
        index,
        // The axis on the world plane, and where the art and the game draw it on screen.
        worldAxis: [round(wx), round(wy)],
        axis: [round(sx / length), round(sy / length)],
        gameAxis: [round(gx / Math.hypot(gx, gy)), round(gy / Math.hypot(gx, gy))],
        open: round(Math.abs(wx + wy) / view),
        offHorizontal: round((Math.atan2(sy, Math.abs(sx)) * 180) / Math.PI),
        extent: sizes[index],
        files: { dark: files("dark"), lit: files("lit") },
      };
    }),
    colors: {
      rim: NEEDLE_GATE_TONES.rim,
      band: NEEDLE_GATE_TONES.band,
      lampLit: GATE_LAMP.lit,
      lampDark: GATE_LAMP.dark,
    },
  });
}

// ------------------------------------------------------------------ sheets and rows

const directory = (manifest: FriendlyManifest, sheet: FriendlyObject["sheet"]) =>
  manifest === "core" ? `/art/${sheet}/` : `/art/${manifest}/`;
const sheetFile = (sheet: FriendlyObject["sheet"]) => `${sheet}-sheet.svg`;

// The frames of a group as one sheet of nested roots in a row, each carrying its manifest id.
function sheetText(objects: readonly DrawnObject[]): string {
  const namespace = 'xmlns="http://www.w3.org/2000/svg"';
  let x = 0;
  const roots: string[] = [];
  for (const { width, height, drawn } of objects) {
    const root = `<svg ${namespace} width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
    for (const { id, svg } of drawn) {
      if (!svg.startsWith(root) || !svg.endsWith("</svg>")) {
        throw new Error(`Unexpected frame root: ${id}`);
      }
      roots.push(`<svg id="${id}" x="${x}" y="0" ${svg.slice("<svg ".length)}`);
      x += width;
    }
  }
  const height = Math.max(...objects.map((object) => object.height));
  return `<svg ${namespace} width="${x}" height="${height}" viewBox="0 0 ${x} ${height}">${roots.join("")}</svg>\n`;
}

// The mooring buoy's arm tips in frame px and the unit screen direction each arm points.
function moorings({ origin, scale }: DrawnObject) {
  return MOORING_ARMS.map((degrees) => {
    const a = (degrees * Math.PI) / 180;
    const [x, y] = projectAt(origin[0], origin[1], [
      MOORING_CLEAT.radius * scale * Math.cos(a),
      MOORING_CLEAT.radius * scale * Math.sin(a),
      MOORING_CLEAT.height * scale,
    ]);
    const [dx, dy] = projectAt(0, 0, [Math.cos(a), Math.sin(a), 0]);
    const length = Math.hypot(dx, dy);
    return { x: round(x), y: round(y), outward: [round(dx / length), round(dy / length)] };
  });
}

// The manifest rows that replace the shipped rows of the same objects at the switch.
function rows(object: DrawnObject, path: string) {
  const { width, height, pivot } = object;
  return object.drawn.map(({ id, row }) => ({
    id,
    path,
    svgSheet: true,
    width,
    height,
    displayWidth: width * DISPLAY_SCALE,
    displayHeight: height * DISPLAY_SCALE,
    pivot: { x: pivot[0] / width, y: pivot[1] / height },
    ...object.row,
    ...row,
    ...(object.key === "mooringBuoy" ? { moorings: moorings(object) } : {}),
  }));
}

// Collision parts and drawn extents of the objects Ada collects, by frame id, in frame px.
function collisionFile(objects: readonly DrawnObject[]): string {
  return json({
    version: 1,
    displayScale: DISPLAY_SCALE,
    frames: Object.fromEntries(
      objects
        .filter(({ collision }) => collision)
        .flatMap(({ width, height, pivot, drawn }) =>
          drawn.map(({ id, drawn: box, collision }) => [
            id,
            { frame: [width, height], pivot, drawn: box, collision },
          ]),
        ),
    ),
  });
}

const ROWS = fileURLToPath(new URL("../friendly-rows.json", import.meta.url));
const PICKUPS = "pickups.json";
const GATE_SHEET = "ring-gates-sheet.svg";
const GATE_DATA = "ring-gates.json";

function main() {
  const objects = drawnObjects();
  const staged: Record<string, { assets: unknown[]; data?: Record<string, string> }> = {};
  const groups = new Map<string, DrawnObject[]>();
  for (const object of objects) {
    const key = `${object.manifest} ${object.sheet}`;
    groups.set(key, [...(groups.get(key) ?? []), object]);
  }
  for (const members of groups.values()) {
    const { manifest, sheet } = members[0]!;
    const files = new Map([[sheetFile(sheet), sheetText(members)]]);
    if (sheet === "pickups") files.set(PICKUPS, collisionFile(members));
    const paths = writeOnce(directory(manifest, sheet), new Map(), files);
    const entry = (staged[manifest] ??= { assets: [] });
    entry.assets.push(...members.flatMap((object) => rows(object, paths.get(sheetFile(sheet))!)));
    if (sheet === "pickups") entry.data = { pickups: paths.get(PICKUPS)! };
  }
  const gates = drawGates();
  const gatePaths = writeOnce(
    "/art/needle/",
    new Map(),
    new Map([
      [GATE_SHEET, gateSheet(gates.frames)],
      [GATE_DATA, gateData(gates)],
    ]),
  );
  const needle = (staged.needle ??= { assets: [] });
  needle.assets.push(...gateRows(gates.frames, gatePaths.get(GATE_SHEET)!));
  needle.data = { needleGates: gatePaths.get(GATE_DATA)! };
  const text = json(staged);
  if (!existsSync(ROWS) || readFileSync(ROWS, "utf8") !== text) writeFileSync(ROWS, text);
  for (const { name, width, height, pivot, drawn } of objects) {
    const [x0, y0, x1, y1] = drawn[0]!.drawn;
    console.log(
      `${name}: frame ${width} x ${height}, pivot ${pivot.join(", ")}, drawn ${round((x1 - x0) * DISPLAY_SCALE)} x ${round((y1 - y0) * DISPLAY_SCALE)} display px, ${drawn.length} frame(s)`,
    );
  }
  console.log(
    `Ring gate: frame ${GATE_FRAME}, drawn ${gates.extents.map(([w, h]) => `${w} x ${h}`).join(", ")} display px`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
