// The friendly object producer (art/friendly-redesign.md). `node art/tools/friendly.ts` writes
// the pickups, caches, landmarks, galaxy beacons, ring gates and friendly craft as sheets of
// nested roots, their data files, their manifest rows, data links and sidecars, and where the
// project sprites stand (art/tools/friendly-projects.ts). The whales are written beside the
// shipped whale art, with their rows and data link staged in art/friendly-rows.json.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Frame } from "@andornaut/art-kit/build/grid";

import { DISPLAY_SCALE } from "./crafts.ts";
import { traceEnemyFills } from "./enemy-outline.ts";
import { tonePaths } from "./fleet.ts";
import {
  craftJets,
  craftJetsFile,
  craftRows,
  craftSheet,
  craftSheetFile,
  craftTow,
  drawnCrafts,
  PHANTOM_JETS_FILE,
  TOW_FILE,
  TOW_LINE,
} from "./friendly-craft.ts";
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
import {
  drawnWhales,
  type ShippedWhales,
  WHALE_DATA_FILE,
  WHALE_MANIFEST,
  whaleData,
  whaleLayout,
  whaleRows,
  whaleSheet,
  whaleSheetFile,
} from "./friendly-whales.ts";
import { PROJECTS, WHIRLPOOL_PROJECTS, WHIRLPOOL_PROJECTS_FILE } from "./friendly-projects.ts";
import {
  linkData,
  type ManifestFile,
  mergeEntries,
  mergeSidecars,
  type Sidecars,
  writeOnce,
} from "./manifest.ts";
import { writeProjects } from "./projects.ts";
import { INK } from "./palette.ts";
import { json, type Point, projectAt, round } from "./projection.ts";
import { type Fill, TOLERANCES } from "./silhouette.ts";
import type { Mesh } from "./solid.ts";
import { prettify, writeSprites } from "./sprite-sheet.ts";
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

// The convex hull of a set of points, to two decimals, by monotone chain.
function hull(points: readonly V2[]): V2[] {
  const sorted = points
    .map(([x, y]): V2 => [px(x), px(y)])
    .toSorted((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o: V2, a: V2, b: V2) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const chain = (list: readonly V2[]) => {
    const out: V2[] = [];
    for (const p of list) {
      while (out.length >= 2 && turn(out.at(-2)!, out.at(-1)!, p) <= 1e-9) out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return [...chain(sorted), ...chain(sorted.toReversed())];
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
    // A strip's frames share the first frame's collision parts, so the pickup's body holds
    // still through its loop.
    const traced =
      object.collision === "hull" && index === 0
        ? { collision: [hull(placed.flatMap(({ points }) => points))], tips: [] }
        : object.collision && !(object.strip && index > 0)
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
  for (const { width, height, drawn, strip } of objects) {
    const root = `<svg ${namespace} width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
    for (const { id, svg } of drawn) {
      if (!svg.startsWith(root) || !svg.endsWith("</svg>")) {
        throw new Error(`Unexpected frame root: ${id}`);
      }
    }
    if (strip) {
      // One root holding the frames side by side.
      const wide = width * drawn.length;
      const inner = drawn.map(
        ({ svg }, index) => `<svg x="${index * width}" y="0" ${svg.slice("<svg ".length)}`,
      );
      roots.push(
        `<svg id="${drawn[0]!.id}" x="${x}" y="0" ${namespace} width="${wide}" height="${height}" viewBox="0 0 ${wide} ${height}">${inner.join("")}</svg>`,
      );
      x += wide;
      continue;
    }
    for (const { id, svg } of drawn) {
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

// An object's manifest rows.
function rows(object: DrawnObject, path: string) {
  const { width, height, pivot } = object;
  const frames = object.strip ? object.drawn.slice(0, 1) : object.drawn;
  return frames.map(({ id, row }) => ({
    id,
    path,
    svgSheet: true,
    // A strip's row spans its frames; its display size and pivot are one frame's.
    width: object.strip ? width * object.drawn.length : width,
    height,
    displayWidth: width * DISPLAY_SCALE,
    displayHeight: height * DISPLAY_SCALE,
    pivot: { x: pivot[0] / width, y: pivot[1] / height },
    ...(object.strip ? { frameWidth: width, frameHeight: height } : {}),
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
        .flatMap(({ width, height, pivot, drawn, strip }) =>
          // A strip is keyed by its row: its first frame's extents and parts.
          (strip ? drawn.slice(0, 1) : drawn).map(({ id, drawn: box, collision }) => [
            id,
            { frame: [width, height], pivot, drawn: box, collision },
          ]),
        ),
    ),
  });
}

type Rows = { assets: { id: string }[]; data?: Record<string, string>; sidecars?: Sidecars };

// Writes each craft's sheet, its jets file or its galaxy's tow file, and collects their rows,
// sidecars and tow links. Phantom's craft share one jets file keyed by craft, and Cartwheel's
// tow file holds the tow line.
function craftFiles(live: Record<string, Rows>) {
  const crafts = drawnCrafts();
  const folders = [...new Set(crafts.map(({ folder }) => folder))];
  for (const folder of folders) {
    const members = crafts.filter((craft) => craft.folder === folder);
    const flying = members.filter(({ stranded }) => !stranded);
    const towed = members.filter(({ stranded }) => stranded);
    const files = new Map<string, string>();
    for (const craft of members) files.set(craftSheetFile(craft), craftSheet(craft));
    if (folder === "phantom") {
      files.set(
        PHANTOM_JETS_FILE,
        json(
          Object.fromEntries(
            flying
              .toSorted((a, b) => (a.name < b.name ? -1 : 1))
              .map((craft) => [craft.name, JSON.parse(craftJets(craft)) as unknown]),
          ),
        ),
      );
    } else {
      for (const craft of flying) files.set(craftJetsFile(craft), craftJets(craft));
    }
    if (towed.length > 0) {
      files.set(
        TOW_FILE,
        json({
          version: 1,
          displayScale: DISPLAY_SCALE,
          ...(folder === "cartwheel" ? { line: TOW_LINE } : {}),
          craft: towed.map(craftTow),
        }),
      );
    }
    const paths = writeOnce(`/art/${folder}/`, new Map(), files);
    for (const craft of members) {
      const entry = (live[craft.manifest] ??= { assets: [] });
      entry.assets.push(...craftRows(craft, paths.get(craftSheetFile(craft))!));
      if (!craft.stranded) {
        (entry.sidecars ??= {})[craft.name] = {
          jets: paths.get(folder === "phantom" ? PHANTOM_JETS_FILE : craftJetsFile(craft))!,
        };
      }
    }
    if (towed.length > 0) {
      const tow = paths.get(TOW_FILE)!;
      (live[folder] ??= { assets: [] }).data = { ...live[folder]!.data, tow };
      // Core's tow link names the file that holds the tow line.
      if (folder === "cartwheel") live.core!.data = { ...live.core!.data, tow };
    }
  }
  return crafts;
}

// Writes each whale kind's sheets and the whale data, and stages their rows
// and the `whales` link of every manifest that carries one.
function stageWhales(staged: Record<string, Rows>) {
  const whales = drawnWhales();
  const files = new Map<string, string>();
  for (const whale of whales) {
    for (let sheet = 0; sheet < whaleLayout(whale.frame).sheets; sheet++) {
      files.set(whaleSheetFile(whale.kind, sheet), whaleSheet(whale, sheet));
    }
  }
  const paths = writeOnce("/art/whales/", new Map(), files);
  for (const whale of whales) {
    const entry = (staged[WHALE_MANIFEST[whale.kind]] ??= { assets: [] });
    const { headings } = whaleLayout(whale.frame);
    for (const yaw of whale.headings.keys()) {
      const sheet = Math.floor(yaw / headings);
      entry.assets.push(...whaleRows(whale, yaw, paths.get(whaleSheetFile(whale.kind, sheet))!));
    }
  }
  const shipped = JSON.parse(
    readFileSync(fileURLToPath(new URL("../../public/art/whales.json", import.meta.url)), "utf8"),
  ) as ShippedWhales;
  const data = writeOnce(
    "/art/",
    new Map(),
    new Map([[WHALE_DATA_FILE, json(whaleData(whales, shipped))]]),
  ).get(WHALE_DATA_FILE)!;
  for (const manifest of ["whirlpool", "phantom"]) {
    const entry = (staged[manifest] ??= { assets: [] });
    entry.data = { ...entry.data, whales: data };
  }
  return whales;
}

// A stroked circular arc, as SVG's `a r r 0 0 1 dx dy` from `from`: its centre, radius, start
// angle and clockwise span, the arc being under half a turn.
type Arc = { centre: V2; radius: number; start: number; span: number; half: number };
function arc(from: V2, radius: number, delta: V2, width: number): Arc {
  const [hx, hy] = [-delta[0] / 2, -delta[1] / 2];
  const k = Math.sqrt(Math.max(0, radius ** 2 / (hx ** 2 + hy ** 2) - 1));
  const centre: V2 = [from[0] - hx + k * hy, from[1] - hy - k * hx];
  const angle = ([x, y]: V2) => Math.atan2(y - centre[1], x - centre[0]);
  const start = angle(from);
  const turn = (a: number) => (((a - start) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const span = turn(angle([from[0] + delta[0], from[1] + delta[1]]));
  return { centre, radius, start, span, half: width / 2 };
}
function onArc({ centre, radius, start, span, half }: Arc, [x, y]: V2): boolean {
  const [dx, dy] = [x - centre[0], y - centre[1]];
  const turn = (((Math.atan2(dy, dx) - start) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  if (turn <= span) return Math.abs(Math.hypot(dx, dy) - radius) <= half;
  // Round caps.
  const ends = [start, start + span].map((a): V2 => [
    centre[0] + radius * Math.cos(a),
    centre[1] + radius * Math.sin(a),
  ]);
  return ends.some(([ex, ey]) => Math.hypot(x - ex, y - ey) <= half);
}

// The 24 px holodisk item icon: icon-holodisk-20's design (shared-resource-svg.ts) on its
// 20 unit grid, scaled to the frame. A `#2a2536` disc with a pink rim, the pink hologram ring,
// the ink hub, a lit arc at the upper left and an ink shade at the lower right rim.
export const HOLODISK_ICON = 24;
const ICON_RIM = "e868c8";
const ICON_HIGHLIGHT = arc([4.1, 9], 6, [5.4, -5.2], 1.45);
const ICON_SHADE = arc([16.8, 10.8], 6.9, [-5.5, 5.9], 1.65);
// 5 by 5 samples a pixel; the most covered colour fills it, the later painted on a tie.
const ICON_SAMPLES = 5;
export function holodiskIcon(size: number): Frame {
  const paint = (point: V2): string | null => {
    const d = Math.hypot(point[0] - 10, point[1] - 10);
    if (onArc(ICON_SHADE, point)) return INK;
    if (onArc(ICON_HIGHLIGHT, point)) return "4a4358";
    // The hub's radius drops from 2 to 1.7 so its corner pixels fall clear and it draws round.
    if (d <= 1.7) return INK;
    if (d <= 4.9 || Math.abs(d - 8.3) <= 0.75) return ICON_RIM;
    return d <= 8.3 ? "2a2536" : null;
  };
  const order = [null, "2a2536", ICON_RIM, INK, "4a4358"];
  return Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => {
      const counts = new Map<string | null, number>();
      for (let j = 0; j < ICON_SAMPLES; j++) {
        for (let i = 0; i < ICON_SAMPLES; i++) {
          const point: V2 = [
            ((x + (i + 0.5) / ICON_SAMPLES) * 20) / size,
            ((y + (j + 0.5) / ICON_SAMPLES) * 20) / size,
          ];
          const colour = paint(point);
          counts.set(colour, (counts.get(colour) ?? 0) + 1);
        }
      }
      return [...counts].toSorted(
        ([a, m], [b, n]) => n - m || order.indexOf(b) - order.indexOf(a),
      )[0]![0];
    }),
  );
}

// Writes icon-holodisk-24 and keeps its UI subset entry, sorted by key.
async function writeHolodiskIcon() {
  const key = `icon-holodisk-${HOLODISK_ICON}`;
  const ui = fileURLToPath(new URL("../../public/art/ui/", import.meta.url));
  await writeSprites(
    { data: `${ui}sprites/${key}.json`, sheet: `${ui}sprites/${key}.png` },
    { key },
    [["rest", [holodiskIcon(HOLODISK_ICON)], 100]],
  );
  const path = `${ui}manifest.json`;
  const before = readFileSync(path, "utf8");
  const manifest = JSON.parse(before) as { sprites: { key: string }[] };
  manifest.sprites = [
    ...manifest.sprites.filter((entry) => entry.key !== key),
    { key, png: `sprites/${key}.png`, json: `sprites/${key}.json`, once: [] },
  ].toSorted((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const text = `${JSON.stringify(manifest, null, 2)}\n`;
  if (text !== before) {
    writeFileSync(path, text);
    await prettify(path);
  }
}

const ROWS = fileURLToPath(new URL("../friendly-rows.json", import.meta.url));
const PICKUPS = "pickups.json";
const GATE_SHEET = "ring-gates-sheet.svg";
const GATE_DATA = "ring-gates.json";

// Writes the collected rows, data links and jets sidecars to their manifests. A row keeps its
// place in its manifest, and a new one follows the row written before it.
function writeManifests(live: Readonly<Record<string, Rows>>) {
  for (const [file, { assets, data, sidecars }] of Object.entries(live) as [ManifestFile, Rows][]) {
    const ids = new Set(assets.map(({ id }) => id));
    mergeEntries(file, (id) => ids.has(id), assets);
    if (data) linkData(file, data);
    if (sidecars) {
      mergeSidecars(file, (craft, kind) => kind === "jets" && craft in sidecars, sidecars);
    }
  }
}

async function main() {
  const objects = drawnObjects();
  const live: Record<string, Rows> = {};
  const staged: Record<string, Rows> = {};
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
    const entry = (live[manifest] ??= { assets: [] });
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
  const needle = (live.needle ??= { assets: [] });
  needle.assets.push(...gateRows(gates.frames, gatePaths.get(GATE_SHEET)!));
  needle.data = { needleGates: gatePaths.get(GATE_DATA)! };
  const crafts = craftFiles(live);
  const whirlpoolProjects = writeOnce(
    "/art/whirlpool/",
    new Map(),
    new Map([[WHIRLPOOL_PROJECTS_FILE, json(WHIRLPOOL_PROJECTS)]]),
  ).get(WHIRLPOOL_PROJECTS_FILE)!;
  const whirlpool = (live.whirlpool ??= { assets: [] });
  whirlpool.data = { ...whirlpool.data, whirlpoolProjects };
  writeManifests(live);
  writeProjects(PROJECTS);
  const whales = stageWhales(staged);
  await writeHolodiskIcon();
  const text = json(staged);
  if (!existsSync(ROWS) || readFileSync(ROWS, "utf8") !== text) writeFileSync(ROWS, text);
  for (const { name, width, height, pivot, drawn } of objects) {
    const [x0, y0, x1, y1] = drawn[0]!.drawn;
    console.log(
      `${name}: frame ${width} x ${height}, pivot ${pivot.join(", ")}, drawn ${round((x1 - x0) * DISPLAY_SCALE)} x ${round((y1 - y0) * DISPLAY_SCALE)} display px, ${drawn.length} frame(s)`,
    );
  }
  for (const { name, frame, frames } of crafts) {
    const [x0, y0, x1, y1] = frames[0]!.drawn;
    console.log(
      `craft-${name}: frame ${frame}, drawn ${round((x1 - x0) * DISPLAY_SCALE)} x ${round((y1 - y0) * DISPLAY_SCALE)} display px at heading 0, ${frames.length} frames`,
    );
  }
  for (const { kind, frame, headings } of whales) {
    const [x0, y0, x1, y1] = headings[0]!.frames[0]!.drawn;
    console.log(
      `whale-${kind}: frame ${frame}, drawn ${round((x1 - x0) * DISPLAY_SCALE)} x ${round((y1 - y0) * DISPLAY_SCALE)} display px at heading 0, footprint ${headings[0]!.footprintRadius}`,
    );
  }
  console.log(
    `Ring gate: frame ${GATE_FRAME}, drawn ${gates.extents.map(([w, h]) => `${w} x ${h}`).join(", ")} display px`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
