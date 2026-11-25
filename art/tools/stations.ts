// The station producer (art/station-redesign.md). `node art/tools/stations.ts` writes each
// structure's sheet of lit and dim frames beside the shipped station art, and the manifest rows
// and project anchors that switch to them in art/station-rows.json.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { type ManifestFile, readManifest } from "./manifest.ts";
import { json, type Point, projectAt, round } from "./projection.ts";
import { BLINK_MS, DESTINATION_SCALE, DISPLAY_SCALE, HUB_SCALE, type Mesh } from "./solid.ts";
import {
  flower,
  type Flower,
  leafFlower,
  needle,
  PROJECT,
  saucer,
  type Saucer,
  scaled,
  twin,
  type Twin,
  wheels,
  whirl,
} from "./station-models.ts";
import { svgText } from "./svg-text.ts";
import { type Fragment, tonePaths, type V2, visibleFragments } from "./visible.ts";

// Frame px to display px, as the shipped rows scale each kind of destination.
const STATION = DISPLAY_SCALE * DESTINATION_SCALE;
const HUB = DISPLAY_SCALE * HUB_SCALE;
const OUTPOST = STATION * 1.4;
const SETTLEMENT = STATION * 1.45;
// Clear frame px round the drawn silhouette, for the keyline the game grows from it.
const MARGIN = 4;
// The silhouette may differ from its reference size by this many display px.
const SIZE_TOLERANCE = 1.5;

// A frame of a structure's sheet. `same` names the frame whose root it shares.
type FrameSpec = { id: string; lit: boolean; same?: string };
// A berth in model space: its point, the level direction a craft leaves along, and the mouth
// width the shipped row carries, in frame px.
type Berth = { at: Point; outward: Point; width: number };
type Row = { id: string; [key: string]: unknown };

// One state of a structure: a pair or loop of frames of one model.
export type State = {
  title: string;
  frames: readonly FrameSpec[];
  mesh: (lit: boolean) => Mesh;
  // Draws the model's project solid alone, as far as the whole model leaves it visible.
  overlay?: boolean;
  // The reference silhouette, in display px.
  size?: readonly [number, number];
  berths?: readonly Berth[];
  // The outposts' dock: the body's wall on the axis straight down the screen from the pivot, as
  // a radius in display px, and the mouth width the shipped row carries, in frame px.
  dock?: { radius: number; width: number };
  // The fields of a row that replaces no shipped row.
  fresh?: Record<string, unknown>;
};

export type Structure = {
  key: string;
  manifest: ManifestFile;
  file: string;
  scale: number;
  // The model point on the pivot: the structure's axis at its world-plane height.
  origin: Point;
  // Every state shares one frame and pivot.
  states: readonly State[];
  // An overlay's project in projects.json and the model point on its base's pivot; the base's
  // frames have this structure's scale.
  anchor?: { project: string; base: Point };
};

const blink = (stem: string): FrameSpec[] => [
  { id: `${stem}-a`, lit: true },
  { id: `${stem}-b`, lit: false },
];
// A blink pair that stays dim.
const dark = (stem: string): FrameSpec[] => [
  { id: `${stem}-a`, lit: false },
  { id: `${stem}-b`, lit: false, same: `${stem}-a` },
];
// A loop of `count` frames: the first half lit and the second dim.
const loop = (stem: string, count: number): FrameSpec[] =>
  Array.from({ length: count }, (_, i) => {
    const lit = i < count / 2;
    const first = lit ? 0 : count / 2;
    return { id: `${stem}-${i}`, lit, ...(i !== first && { same: `${stem}-${first}` }) };
  });

const pol = (r: number, degrees: number, z = 0): Point => [
  r * Math.cos((degrees * Math.PI) / 180),
  r * Math.sin((degrees * Math.PI) / 180),
  z,
];
const ORIGIN: Point = [0, 0, 0];

// The hub's world plane is the large wheel's mid height, where story craft meet its rim.
const HUB_PLANE = -24;
const GROWERS: Flower = { petals: 6, reach: 60, disc: 28, stalk: 58, bulb: false, half: 19 };
const WORKSHOP: Flower = {
  angles: [90, 135, 180, 225, 270],
  reach: 72,
  disc: 30,
  stalk: 58,
  bulb: false,
};
const HAMLET: Saucer = { reach: 58, bulge: [36, 24, 16], turret: [12, 12], keel: 58 };
const LAMPHOUSE: Saucer = { reach: 44, bulge: [30, 20, 16], turret: [14, 34], keel: 40 };
const HOMES: Twin = { tiers: [[0, "pale"]], reach: 70, keel: 30 };
const HARBOUR: Twin = {
  arms: 2,
  tiers: [
    [-36, "violet"],
    [8, "pale"],
  ],
  reach: 92,
  turn: 135,
  notch: 22,
  tip: 6,
  keel: 22,
};
const SIGNAL: Twin = {
  tiers: [
    [-64, "violet"],
    [-16, "violet"],
    [32, "pale"],
  ],
  reach: 52,
  notch: 15,
};

// A Phantom settlement: cracked, one arm of its top slab short and every lamp dim, and mended.
function settlement(
  variant: string,
  title: string,
  options: Twin,
  k: number,
  dock: number,
  cracked: readonly [number, number],
  mended: readonly [number, number],
): Structure {
  return {
    key: `phantom-${variant}`,
    manifest: "phantom",
    file: `${variant}-triarm-sheet.svg`,
    scale: SETTLEMENT,
    origin: ORIGIN,
    states: [
      {
        title: `${title}, cracked`,
        frames: dark(`outpost-${variant}-cracked`),
        mesh: (lit) => scaled(twin(lit, { ...options, cracked: 0 }), k),
        size: cracked,
        dock: { radius: dock, width: 22.045 },
      },
      {
        title: `${title}, mended`,
        frames: blink(`outpost-${variant}-mended`),
        mesh: (lit) => scaled(twin(lit, { ...options, mended: 0 }), k),
        size: mended,
        dock: { radius: dock, width: 22.045 },
      },
    ],
  };
}

export const STRUCTURES: readonly Structure[] = [
  {
    key: "sunflower-station",
    manifest: "core",
    file: "station-bloom-sheet.svg",
    scale: STATION,
    origin: ORIGIN,
    states: [
      {
        title: "Sunflower station",
        frames: blink("station"),
        mesh: (lit) => flower(lit),
        size: [172, 161],
      },
    ],
  },
  {
    key: "sunflower-second-station",
    manifest: "sunflower",
    file: "leaf-station-sheet.svg",
    scale: STATION,
    origin: ORIGIN,
    states: [
      {
        title: "Sunflower second station",
        frames: blink("station-leaf"),
        mesh: (lit) => leafFlower(lit),
        size: [165, 101],
        fresh: { facing: "fixed", pivot: {}, frameMs: BLINK_MS },
      },
    ],
  },
  {
    key: "sunflower-growers",
    manifest: "sunflower",
    file: "growers-bud-sheet.svg",
    scale: OUTPOST,
    origin: ORIGIN,
    states: [
      {
        title: "Growers' outpost",
        frames: blink("outpost-growers"),
        mesh: (lit) => flower(lit, GROWERS),
        size: [146, 110],
        dock: { radius: 28, width: 31.843 },
      },
      {
        title: "Growers with greenhouseRing",
        frames: blink("outpost-growers-ring"),
        mesh: (lit) => flower(lit, { ...GROWERS, greenhouse: true }),
        size: [169, 123],
        dock: { radius: 28, width: 31.843 },
      },
    ],
  },
  {
    key: "sunflower-workshop",
    manifest: "sunflower",
    file: "workshop-bloom-sheet.svg",
    scale: OUTPOST,
    origin: ORIGIN,
    states: [
      {
        title: "Workshop",
        frames: blink("outpost-workshop"),
        mesh: (lit) => flower(lit, WORKSHOP),
        size: [151, 122],
        dock: { radius: 30, width: 29.394 },
      },
    ],
  },
  {
    key: "sunflower-workshop-crane",
    manifest: "sunflower",
    file: "workshop-boom-sheet.svg",
    scale: OUTPOST,
    // The lifting drum's axis.
    origin: pol(84, 0),
    anchor: { project: "workshopCrane", base: ORIGIN },
    states: [
      {
        title: "workshopCrane",
        frames: blink("outpost-workshop-crane"),
        mesh: (lit) => flower(lit, { ...WORKSHOP, boom: 0 }),
        overlay: true,
      },
    ],
  },
  {
    key: "sunflower-salvagers",
    manifest: "sunflower",
    file: "salvagers-leaf-sheet.svg",
    scale: OUTPOST,
    origin: ORIGIN,
    states: [
      {
        title: "Salvagers' yard",
        frames: blink("outpost-salvagers"),
        mesh: (lit) =>
          scaled(
            leafFlower(lit, { angles: [0, 90, 180, 270], reach: 84, peg: 22, tall: 30, foot: 30 }),
            1.05,
          ),
        size: [153, 102],
        dock: { radius: 25 * 1.05, width: 31.843 },
      },
    ],
  },
  {
    key: "cartwheel-hub",
    manifest: "cartwheel",
    file: "wheel-hub-sheet.svg",
    scale: HUB,
    origin: [0, 0, HUB_PLANE],
    states: [
      {
        title: "Mining hub, worn",
        frames: blink("outpost-hub"),
        mesh: (lit) => wheels(lit, { gap: [40, 110] }),
        size: [168, 142],
        berths: hubBerths(),
      },
      {
        title: "Mining hub, repaired",
        frames: blink("outpost-hub-repaired"),
        mesh: (lit) => wheels(lit),
        size: [168, 142],
        berths: hubBerths(),
      },
      {
        title: "dockingBay",
        frames: blink("outpost-hub-bay"),
        mesh: (lit) => wheels(lit, { bay: 45 }),
        overlay: true,
        // The berth drum's wall on the axis straight down the screen.
        berths: [{ at: pol(105, 45, HUB_PLANE), outward: [1, 1, 0], width: 36.742 }],
      },
    ],
  },
  {
    key: "whirlpool-station",
    manifest: "whirlpool",
    file: "ramp-station-sheet.svg",
    scale: STATION,
    origin: ORIGIN,
    states: [
      {
        title: "Whirlpool station",
        frames: loop("whirlpool-station", 4),
        mesh: whirl,
        size: [205, 138],
      },
    ],
  },
  {
    key: "needle-station",
    manifest: "needle",
    file: "eye-station-sheet.svg",
    scale: STATION,
    origin: ORIGIN,
    states: [
      {
        title: "Weavers' station",
        frames: blink("needle-station"),
        mesh: (lit) => needle(lit),
        size: [316, 73],
        berths: needleBerths(129),
      },
      {
        title: "Weavers' station with loomHall",
        frames: blink("needle-station-hall"),
        mesh: (lit) => needle(lit, { eyes: [-36, 36], outer: 34, inner: 24, length: 138 }),
        size: [341, 60],
        berths: needleBerths(139),
      },
    ],
  },
  {
    key: "andromeda-station",
    manifest: "andromeda",
    file: "saucer-station-sheet.svg",
    scale: STATION,
    origin: ORIGIN,
    states: [
      {
        title: "Settlers' station",
        frames: blink("station-settlers"),
        mesh: (lit) => saucer(lit),
        size: [197, 145],
      },
    ],
  },
  {
    key: "andromeda-school",
    manifest: "andromeda",
    file: "saucer-school-sheet.svg",
    scale: STATION,
    // The school saucer's axis.
    origin: pol(104, 135),
    anchor: { project: "courierSchool", base: ORIGIN },
    states: [
      {
        title: "courierSchool",
        frames: blink("station-settlers-school"),
        mesh: (lit) => saucer(lit, { school: true }),
        overlay: true,
        // The school saucer's wall on the axis straight down the screen.
        berths: [
          {
            at: [pol(104, 135)[0] + pol(16, 45)[0], pol(104, 135)[1] + pol(16, 45)[1], 0],
            outward: [1, 1, 0],
            width: 19.596,
          },
        ],
      },
    ],
  },
  {
    key: "andromeda-hamlet",
    manifest: "andromeda",
    file: "hamlet-saucer-sheet.svg",
    scale: SETTLEMENT,
    origin: ORIGIN,
    states: [
      {
        title: "Hamlet",
        frames: blink("outpost-hamlet"),
        mesh: (lit) => scaled(saucer(lit, HAMLET), 0.56),
        size: [80, 75],
        dock: { radius: 58 * 0.56, width: 22.045 },
      },
    ],
  },
  {
    key: "andromeda-lamphouse",
    manifest: "andromeda",
    file: "lamphouse-saucer-sheet.svg",
    scale: SETTLEMENT,
    origin: ORIGIN,
    states: [
      {
        title: "Lamphouse",
        frames: blink("outpost-lamphouse"),
        mesh: (lit) => scaled(saucer(lit, LAMPHOUSE), 0.55),
        size: [60, 76],
        dock: { radius: 44 * 0.55, width: 19.596 },
      },
    ],
  },
  {
    key: "phantom-station",
    manifest: "phantom",
    file: "triarm-station-sheet.svg",
    scale: STATION,
    origin: ORIGIN,
    states: [
      {
        title: "Phantom station",
        frames: loop("phantom-station", 8),
        mesh: (lit) => twin(lit),
        size: [196, 169],
      },
    ],
  },
  // The homes and the signal dock on the arm that points down the screen, at the length it keeps
  // when cracked; the harbour docks on its hull between the bar's arms.
  settlement("homes", "Homes", HOMES, 0.72, 70 * 0.72 * 0.52, [113, 55], [113, 67]),
  settlement("harbour", "Harbour", HARBOUR, 0.6, 22 * 0.6, [136, 59], [136, 59]),
  settlement("signal", "Signal", SIGNAL, 0.7, 52 * 0.7 * 0.52, [82, 119], [82, 119]),
];

// The hub's berths, left then right: the large wheel's rim wall at its screen left and right.
function hubBerths(): Berth[] {
  return [
    { at: pol(68.5, 135, HUB_PLANE), outward: [-1, 1, 0], width: 28.169 },
    { at: pol(68.5, -45, HUB_PLANE), outward: [1, -1, 0], width: 28.169 },
  ];
}

// The needle's blunt ends, left then right, `reach` display px from its middle.
function needleBerths(reach: number): Berth[] {
  return [
    { at: pol(reach, 135), outward: [-1, 1, 0], width: 24.495 },
    { at: pol(reach, -45), outward: [1, -1, 0], width: 24.495 },
  ];
}

// Frame px from the pivot of a model point.
const place = ({ origin, scale }: Structure, [x, y, z]: Point): V2 =>
  projectAt(0, 0, [(x - origin[0]) / scale, (y - origin[1]) / scale, (z - origin[2]) / scale]);

// The visible fragments of a state, in frame px from the pivot.
function fragments(structure: Structure, { mesh }: State, lit: boolean): Fragment[] {
  const { origin, scale } = structure;
  const placed = mesh(lit).map((face) => ({
    ...face,
    points: face.points.map(([x, y, z]): Point => [
      (x - origin[0]) / scale,
      (y - origin[1]) / scale,
      (z - origin[2]) / scale,
    ]),
  }));
  return visibleFragments(placed, (point) => point);
}

const d = (loops: readonly V2[][]) =>
  loops.map((loop) => `M${loop.map(([x, y]) => `${x},${y}`).join("L")}Z`).join("");

type Paths = ReturnType<typeof tonePaths>;
const markup = (paths: Paths) =>
  paths.map(({ fill, loops }) => `<path fill="${fill}" d="${d(loops)}"/>`).join("");

export type DrawnState = {
  state: State;
  // The silhouette's display size.
  size: readonly [number, number];
  silhouette: string;
  // The frame's content by lit state, without its root.
  body: (lit: boolean) => string;
  // An overlay's whole model, body included, and its silhouette.
  scene?: { silhouette: string; body: (lit: boolean) => string };
};
export type Drawn = {
  structure: Structure;
  width: number;
  height: number;
  // Frame px from the frame's top to the pivot; the pivot is on the frame's vertical centre line.
  above: number;
  states: DrawnState[];
};

export function draw(structure: Structure): Drawn {
  const lights = [true, false];
  const visible = structure.states.map((state) => {
    const all = new Map(lights.map((lit) => [lit, fragments(structure, state, lit)]));
    const own = new Map(
      [...all].map(([lit, list]) => [
        lit,
        state.overlay ? list.filter(({ group }) => group === PROJECT) : list,
      ]),
    );
    return { state, all, own };
  });
  const points = visible.flatMap(({ own }) =>
    [...own.values()].flatMap((list) => list.flatMap((f) => f.points)),
  );
  const [left, right] = [Math.min(...points.map(([x]) => x)), Math.max(...points.map(([x]) => x))];
  const [top, bottom] = [
    Math.min(...points.map(([, y]) => y)),
    Math.max(...points.map(([, y]) => y)),
  ];
  const width = Math.ceil((2 * Math.max(-left, right) + 2 * MARGIN) / 8) * 8;
  const above = Math.ceil(-top + MARGIN);
  const height = Math.ceil((above + bottom + MARGIN) / 8) * 8;
  const framed = (list: readonly Fragment[]): Paths =>
    tonePaths(
      list.map((fragment) => ({
        ...fragment,
        points: fragment.points.map(([x, y]): V2 => [x + width / 2, y + above]),
      })),
    );
  const states = visible.map(({ state, all, own }): DrawnState => {
    const paths = new Map(lights.map((lit) => [lit, framed(own.get(lit)!)]));
    const silhouette = d(paths.get(true)![0]!.loops);
    if (d(paths.get(false)![0]!.loops) !== silhouette) {
      throw new Error(`${state.title}: the lit and dim frames differ in silhouette`);
    }
    const drawn = own.get(true)!.flatMap((f) => f.points);
    const size = [
      (Math.max(...drawn.map(([x]) => x)) - Math.min(...drawn.map(([x]) => x))) * structure.scale,
      (Math.max(...drawn.map(([, y]) => y)) - Math.min(...drawn.map(([, y]) => y))) *
        structure.scale,
    ] as const;
    if (state.size && size.some((v, i) => Math.abs(v - state.size![i]!) > SIZE_TOLERANCE)) {
      throw new Error(
        `${state.title} draws ${size.map((v) => v.toFixed(1)).join(" by ")}, not ${state.size.join(" by ")}`,
      );
    }
    const scenes = state.overlay && new Map(lights.map((lit) => [lit, framed(all.get(lit)!)]));
    return {
      state,
      size,
      silhouette,
      body: (lit) => markup(paths.get(lit)!),
      ...(scenes && {
        scene: {
          silhouette: d(scenes.get(true)![0]!.loops),
          body: (lit) => markup(scenes.get(lit)!),
        },
      }),
    };
  });
  return { structure, width, height, above, states };
}

const directory = (manifest: ManifestFile) => (manifest === "core" ? "/art/" : `/art/${manifest}/`);

// The sheet of a structure and the rows that replace its shipped rows. A row keeps the fields of
// the row it replaces; its path, sizes, pivot, dock and berths change.
function sheet(drawn: Drawn): { text: string; rows: Row[] } {
  const { structure, width, height, above } = drawn;
  const { scale, manifest } = structure;
  const shipped: Row[] = readManifest(manifest).assets;
  const display = [round(width * scale), round(height * scale)] as const;
  const path = directory(manifest) + structure.file;
  const at = (point: Point) => {
    const [x, y] = place(structure, point);
    return { x: round(width / 2 + x), y: round(above + y) };
  };
  const outward = (direction: Point) => {
    const [x, y] = projectAt(0, 0, direction);
    return [round(x / Math.hypot(x, y)), round(y / Math.hypot(x, y))];
  };
  const rows: Row[] = [];
  const children: string[] = [];
  for (const { state, body } of drawn.states) {
    for (const { id, lit, same } of state.frames) {
      const row: Row | undefined = state.fresh
        ? { id, path, width, height, displayWidth: 0, displayHeight: 0, ...state.fresh }
        : shipped.find((entry) => entry.id === id);
      if (!row) throw new Error(`${id} has no row in the ${manifest} manifest`);
      // A row that carries its intrinsic size has its root at display size.
      const intrinsic = "intrinsicWidth" in row;
      rows.push({
        ...row,
        path,
        width,
        height,
        displayWidth: display[0],
        displayHeight: display[1],
        pivot: { x: 0.5, y: Math.round((above / height) * 1e5) / 1e5 },
        ...(state.dock && {
          dock: {
            ...at([
              structure.origin[0] + state.dock.radius * Math.SQRT1_2,
              structure.origin[1] + state.dock.radius * Math.SQRT1_2,
              structure.origin[2],
            ]),
            outward: [0, 1],
            width: state.dock.width,
          },
        }),
        ...(state.berths && {
          berths: state.berths.map((berth) => ({
            ...at(berth.at),
            outward: outward(berth.outward),
            width: berth.width,
          })),
        }),
        svgSheet: true,
        ...(same !== undefined && { svgSheetMember: same }),
        ...(intrinsic && { intrinsicWidth: display[0], intrinsicHeight: display[1] }),
      });
      if (same !== undefined) continue;
      const [w, h] = intrinsic ? display : [width, height];
      const root = svgText(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${width} ${height}"><title>${state.title}, ${lit ? "lit" : "dim"}</title>${body(lit)}</svg>`,
      );
      children.push(
        `<svg id="${id}" x="${children.length * width}" y="0" ${root.trimEnd().slice("<svg ".length)}`,
      );
    }
  }
  const wide = children.length * width;
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
  const manifests: Record<string, { assets: Row[] }> = {};
  const shipped = (
    JSON.parse(readFileSync(`${ART}art/projects.json`, "utf8")) as {
      projects: Record<string, Record<string, unknown>>;
    }
  ).projects;
  const projects: Record<string, unknown> = {};
  for (const structure of STRUCTURES) {
    const drawn = draw(structure);
    const { text, rows } = sheet(drawn);
    writeIfChanged(`${ART}${directory(structure.manifest).slice(1)}${structure.file}`, text);
    (manifests[structure.manifest] ??= { assets: [] }).assets.push(...rows);
    if (structure.anchor) {
      // The overlay's pivot from its base's pivot, in the base's frame px; its frame holds only
      // what the base leaves visible, so it draws in front.
      const [x, y] = place(structure, structure.anchor.base);
      const entry = shipped[structure.anchor.project];
      if (!entry) throw new Error(`projects.json has no ${structure.anchor.project}`);
      projects[structure.anchor.project] = {
        ...entry,
        anchors: [{ x: round(-x), y: round(-y), layer: "front", phase: 0 }],
      };
    }
    for (const { state, size } of drawn.states) {
      console.log(
        `${state.title}: frame ${drawn.width} by ${drawn.height}, pivot y ${drawn.above}, drawn ${size[0].toFixed(1)} by ${size[1].toFixed(1)} display px`,
      );
    }
  }
  writeIfChanged(ROWS, json({ ...manifests, projects }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
