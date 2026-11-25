// The station producer (art/station-redesign.md). `node art/tools/stations.ts` writes each
// structure's sheet of lit and dim frames beside the shipped station art, and the manifest rows
// that switch to them in art/station-rows.json.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { type ManifestFile, readManifest } from "./manifest.ts";
import { json, type Point, projectAt, round } from "./projection.ts";
import { DESTINATION_SCALE, DISPLAY_SCALE, HUB_SCALE, type Mesh } from "./solid.ts";
import { flower, needle, saucer, twin, wheels, whirl } from "./station-models.ts";
import { svgText } from "./svg-text.ts";
import { type Fragment, tonePaths, type V2, visibleFragments } from "./visible.ts";

// Frame px to display px.
const STATION = DISPLAY_SCALE * DESTINATION_SCALE;
const HUB = DISPLAY_SCALE * HUB_SCALE;
// Clear frame px round the drawn silhouette, for the keyline the game grows from it.
const MARGIN = 4;
// The silhouette may differ from its reference size by this many display px.
const SIZE_TOLERANCE = 1.5;

// A frame of a structure's sheet. `same` names the frame whose root it shares.
type FrameSpec = { id: string; lit: boolean; same?: string };
// A berth in model space: its point, the level direction a craft leaves along, and the mouth
// width the shipped row carries, in frame px.
type Berth = { at: Point; outward: Point; width: number };

export type Structure = {
  key: string;
  title: string;
  manifest: ManifestFile;
  file: string;
  scale: number;
  // The model height that lies on the world plane; the pivot is the model's axis there.
  plane: number;
  mesh: (lit: boolean) => Mesh;
  frames: readonly FrameSpec[];
  berths?: readonly Berth[];
  // The reference silhouette, in display px.
  size: readonly [number, number];
};

const blink = (stem: string): FrameSpec[] => [
  { id: `${stem}-a`, lit: true },
  { id: `${stem}-b`, lit: false },
];
// A loop of `count` frames: the first half lit and the second dim.
const loop = (stem: string, count: number): FrameSpec[] =>
  Array.from({ length: count }, (_, i) => {
    const lit = i < count / 2;
    const first = lit ? 0 : count / 2;
    return { id: `${stem}-${i}`, lit, ...(i !== first && { same: `${stem}-${first}` }) };
  });

const SQRT1_2 = Math.SQRT1_2;

export const STRUCTURES: readonly Structure[] = [
  {
    key: "sunflower-station",
    title: "Sunflower station",
    manifest: "core",
    file: "station-bloom-sheet.svg",
    scale: STATION,
    plane: 0,
    mesh: (lit) => flower(lit),
    frames: blink("station"),
    size: [172, 161],
  },
  {
    key: "cartwheel-hub-repaired",
    title: "Mining hub, repaired",
    manifest: "cartwheel",
    file: "wheel-hub-repaired-sheet.svg",
    scale: HUB,
    // The large wheel's mid height, where story craft meet its rim.
    plane: -24,
    mesh: (lit) => wheels(lit),
    frames: blink("outpost-hub-repaired"),
    berths: [
      { at: [0, 68.5, -24], outward: [0, 1, 0], width: 28.169 },
      { at: [68.5, 0, -24], outward: [1, 0, 0], width: 28.169 },
    ],
    size: [168, 142],
  },
  {
    key: "whirlpool-station",
    title: "Whirlpool station",
    manifest: "whirlpool",
    file: "ramp-station-sheet.svg",
    scale: STATION,
    plane: 0,
    mesh: whirl,
    frames: loop("whirlpool-station", 4),
    size: [205, 138],
  },
  {
    key: "needle-station",
    title: "Weavers' station",
    manifest: "needle",
    file: "eye-station-sheet.svg",
    scale: STATION,
    plane: 0,
    mesh: (lit) => needle(lit),
    frames: blink("needle-station"),
    // The needle's blunt ends, left then right.
    berths: [
      { at: [-129 * SQRT1_2, 129 * SQRT1_2, 0], outward: [-1, 1, 0], width: 24.495 },
      { at: [129 * SQRT1_2, -129 * SQRT1_2, 0], outward: [1, -1, 0], width: 24.495 },
    ],
    size: [316, 73],
  },
  {
    key: "andromeda-station",
    title: "Settlers' station",
    manifest: "andromeda",
    file: "saucer-station-sheet.svg",
    scale: STATION,
    plane: 0,
    mesh: (lit) => saucer(lit),
    frames: blink("station-settlers"),
    size: [197, 145],
  },
  {
    key: "phantom-station",
    title: "Phantom station",
    manifest: "phantom",
    file: "triarm-station-sheet.svg",
    scale: STATION,
    plane: 0,
    mesh: (lit) => twin(lit),
    frames: loop("phantom-station", 8),
    size: [196, 169],
  },
];

// The visible fragments of a structure, in frame px from its pivot.
function fragments({ mesh, plane, scale }: Structure, lit: boolean): Fragment[] {
  const placed = mesh(lit).map((face) => ({
    ...face,
    points: face.points.map(([x, y, z]): Point => [x / scale, y / scale, (z - plane) / scale]),
  }));
  return visibleFragments(placed, (point) => point);
}

const d = (loops: readonly V2[][]) =>
  loops.map((loop) => `M${loop.map(([x, y]) => `${x},${y}`).join("L")}Z`).join("");

export type Drawn = {
  structure: Structure;
  width: number;
  height: number;
  // Frame px from the frame's top to the pivot; the pivot is on the frame's vertical centre line.
  above: number;
  // The silhouette's display size.
  size: readonly [number, number];
  silhouette: string;
  // The frame's content by lit state, without its root.
  body: (lit: boolean) => string;
};

export function draw(structure: Structure): Drawn {
  const states = new Map([true, false].map((lit) => [lit, fragments(structure, lit)]));
  const points = [...states.values()].flatMap((visible) => visible.flatMap((f) => f.points));
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const [left, right] = [Math.min(...xs), Math.max(...xs)];
  const [top, bottom] = [Math.min(...ys), Math.max(...ys)];
  const width = Math.ceil((2 * Math.max(-left, right) + 2 * MARGIN) / 8) * 8;
  const above = Math.ceil(-top + MARGIN);
  const height = Math.ceil((above + bottom + MARGIN) / 8) * 8;
  const size = [(right - left) * structure.scale, (bottom - top) * structure.scale] as const;
  if (size.some((v, i) => Math.abs(v - structure.size[i]!) > SIZE_TOLERANCE)) {
    throw new Error(
      `${structure.key} draws ${size.map((v) => v.toFixed(1)).join(" by ")}, not ${structure.size.join(" by ")}`,
    );
  }
  const paths = new Map(
    [...states].map(([lit, visible]) => [
      lit,
      tonePaths(
        visible.map((fragment) => ({
          ...fragment,
          points: fragment.points.map(([x, y]): V2 => [x + width / 2, y + above]),
        })),
      ),
    ]),
  );
  const silhouette = d(paths.get(true)![0]!.loops);
  if (d(paths.get(false)![0]!.loops) !== silhouette) {
    throw new Error(`${structure.key}: the lit and dim frames differ in silhouette`);
  }
  return {
    structure,
    width,
    height,
    above,
    size,
    silhouette,
    body: (lit) =>
      paths
        .get(lit)!
        .map(({ fill, loops }) => `<path fill="${fill}" d="${d(loops)}"/>`)
        .join(""),
  };
}

const directory = (manifest: ManifestFile) => (manifest === "core" ? "/art/" : `/art/${manifest}/`);

type Row = { id: string; [key: string]: unknown };

// The sheet of a structure and the rows that replace its shipped rows. A row keeps the fields of
// the row it replaces; its path, sizes, pivot and berths change.
function sheet(drawn: Drawn): { text: string; rows: Row[] } {
  const { structure, width, height, above } = drawn;
  const { scale, manifest, frames, berths, title } = structure;
  const shipped: Row[] = readManifest(manifest).assets;
  const display = [round(width * scale), round(height * scale)] as const;
  const path = directory(manifest) + structure.file;
  const roots = frames.filter(({ same }) => same === undefined);
  const rows = frames.map(({ id, same }): Row => {
    const row = shipped.find((entry) => entry.id === id);
    if (!row) throw new Error(`${id} has no row in the ${manifest} manifest`);
    // A row that carries its intrinsic size has its root at display size.
    const intrinsic = "intrinsicWidth" in row;
    return {
      ...row,
      path,
      width,
      height,
      displayWidth: display[0],
      displayHeight: display[1],
      pivot: { x: 0.5, y: Math.round((above / height) * 1e5) / 1e5 },
      ...(berths && {
        berths: berths.map(({ at, outward, width: mouth }) => {
          const [x, y] = projectAt(0, 0, [
            at[0] / scale,
            at[1] / scale,
            (at[2] - structure.plane) / scale,
          ]);
          const [ox, oy] = projectAt(0, 0, outward);
          const length = Math.hypot(ox, oy);
          return {
            x: round(width / 2 + x),
            y: round(above + y),
            outward: [round(ox / length), round(oy / length)],
            width: mouth,
          };
        }),
      }),
      svgSheet: true,
      ...(same !== undefined && { svgSheetMember: same }),
      ...(intrinsic && { intrinsicWidth: display[0], intrinsicHeight: display[1] }),
    };
  });
  const children = roots.map(({ id, lit }, index) => {
    const intrinsic = "intrinsicWidth" in rows.find((row) => row.id === id)!;
    const [w, h] = intrinsic ? display : [width, height];
    const root = svgText(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${width} ${height}"><title>${title}, ${lit ? "lit" : "dim"}</title>${drawn.body(lit)}</svg>`,
    );
    return `<svg id="${id}" x="${index * width}" y="0" ${root.trimEnd().slice("<svg ".length)}`;
  });
  const wide = roots.length * width;
  return {
    text: `<svg xmlns="http://www.w3.org/2000/svg" width="${wide}" height="${height}" viewBox="0 0 ${wide} ${height}">${children.join("")}</svg>\n`,
    rows,
  };
}

const ROWS = fileURLToPath(new URL("../station-rows.json", import.meta.url));
const ART = fileURLToPath(new URL("../../public/", import.meta.url));

function writeIfChanged(path: string, text: string) {
  if (!existsSync(path) || readFileSync(path, "utf8") !== text) writeFileSync(path, text);
}

function main() {
  const rows: Record<string, { assets: Row[] }> = {};
  for (const structure of STRUCTURES) {
    const drawn = draw(structure);
    const { text, rows: assets } = sheet(drawn);
    writeIfChanged(`${ART}${directory(structure.manifest).slice(1)}${structure.file}`, text);
    (rows[structure.manifest] ??= { assets: [] }).assets.push(...assets);
    const [w, h] = drawn.size;
    console.log(
      `${structure.key}: frame ${drawn.width} by ${drawn.height}, pivot y ${drawn.above}, silhouette ${w.toFixed(1)} by ${h.toFixed(1)} display px`,
    );
  }
  writeIfChanged(ROWS, json(rows));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
