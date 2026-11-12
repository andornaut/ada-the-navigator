// Cartwheel's story art: the mining hub with its two project world changes, the mooring buoy,
// and the non-hostile story craft (the miner, two regular visitors and the blocking pilot) in
// sixteen headings with speed jets. Usage: node art/tools/cartwheel.ts [--alternates <dir>]
// writes public/art/cartwheel/ and its manifest entries; `--alternates` also writes the unused
// visitor and blocker designs to <dir> for review.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { hauler, HAULER_LEVELS, HAULER_MOUTH_WIDTH, HAULER_MOUTHS } from "./cartwheel-craft.ts";
import { jetsFile } from "./crafts.ts";
import { cube, hcyl, part, scaleGroups } from "./hull-shapes.ts";
import { replaceEntries } from "./manifest.ts";
import { noses } from "./nose.ts";
import { ORE_SOLID } from "./ore.ts";
import {
  anchor,
  ENEMY_HEADINGS,
  json,
  type Point,
  projectAt,
  rotate,
  round,
  vector,
} from "./projection.ts";
import {
  along,
  at,
  BLINK_MS,
  blue,
  blueDim,
  box,
  cream,
  creamSide,
  DISPLAY_SCALE,
  HUB_SCALE,
  DOCK,
  closedCollar,
  dockCollar,
  type Face,
  facing,
  ngon,
  orientedBox,
  orientedPlan,
  type Part,
  type Plan,
  polygons,
  wallWindows,
  warm,
} from "./solid.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const output = `${art}cartwheel/`;
const PAD = 4;
// Frames are multiples of 16 px, so display sizes (frame * 0.4375) are whole px.
const STEP = 16;

// ---------------------------------------------------------------- palette
// Hub: cool slate structure with ore (art/tools/ore.ts) where deposits collect.
const slate = "#9aaccb";
const slateSide = "#6a7c9e";
const slateDark = "#4e5d7a";
const slateCap = "#c3cfe2";
const ore = ORE_SOLID.top;
const oreLit = ORE_SOLID.lit;
const oreSide = ORE_SOLID.side;
const oreDim = ORE_SOLID.dim;
const steelDark = "#6e7482";
const steelDarkSide = "#4f5462";
// Wear on the unrepaired hub: mismatched patch plates, rust streaks and scorched deck plating.
const patch = "#b3a68a";
const patchSide = "#857a62";
const rust = "#9a5f48";
const scorch = "#a39784";

// ---------------------------------------------------------------- shared parts
function beacon(x: number, y: number, z0: number, height: number, lit: boolean): Part[] {
  const light = lit ? blue : blueDim;
  return [
    {
      plan: box(x - 0.8, y - 0.8, x + 0.8, y + 0.8),
      z0,
      z1: z0 + height,
      top: steelDark,
      side: steelDarkSide,
    },
    {
      plan: box(x - 2, y - 2, x + 2, y + 2),
      z0: z0 + height,
      z1: z0 + height + 3,
      top: light,
      side: light,
    },
  ];
}

// Ore heaped in an open top: a flat ore surface with lumps of a fixed lump size.
function oreHeap(cx: number, cy: number, r: number, z: number, lumps: number): Part[] {
  const out: Part[] = [
    { plan: ngon(8, r, cx, cy, Math.PI / 8), z0: z - 0.6, z1: z, top: ore, side: oreSide },
  ];
  for (let i = 0; i < lumps; i++) {
    const a = 0.9 + i * 2.4;
    const d = r * (0.2 + (0.6 * ((i * 37) % 10)) / 10);
    const [lx, ly] = [cx + Math.cos(a) * d, cy + Math.sin(a) * d];
    const s = 1.6 + (i % 3) * 0.7;
    out.push({
      plan: orientedBox(lx, ly, a, s * 1.4, s),
      z0: z,
      z1: z + s * 0.9,
      top: oreLit,
      side: ore,
    });
  }
  return out;
}

// A light cube of side `size` centred at (x, y) from z0.
function lamp(x: number, y: number, z0: number, size: number, color: string): Part {
  const h = size / 2;
  return { plan: box(x - h, y - h, x + h, y + h), z0, z1: z0 + size, top: color, side: color };
}

// ---------------------------------------------------------------- hub
// A slate collection tower with an open ore hopper on a round cream deck, two banded silos
// behind, and three docking piers fanned toward the viewer: the live dock and two free berths.
const PIER_FACE = 115;
const SIDE_FACE = 99;
const SIDE_MOUTH = 23;
const SPREAD = 0.95;
const DECK_R = 68;
const DECK_TOP = 11;
const TOWER_R = 34;
const TOWER_TOP = 68;
const CAP_TOP = 74.4;
// The second docking bay's pier, between the live dock and the left free berth.
const BAY_ANGLE = DOCK + 0.42;
const BAY_FACE = 140;
const BAY_MOUTH = 30;

type HubState = { repaired: boolean };

function silos(): Part[][] {
  return [-1, 1].map((side) => {
    const [sx, sy] = at(-46.5, side * 37);
    return [
      { plan: ngon(12, 17, sx, sy, Math.PI / 12), z0: 0, z1: 59, top: slateCap, side: creamSide },
      { plan: ngon(12, 17.4, sx, sy, Math.PI / 12), z0: 40, z1: 46.5, top: ore, side: oreSide },
      {
        plan: ngon(12, 17.4, sx, sy, Math.PI / 12),
        z0: 12.4,
        z1: 15.5,
        top: slate,
        side: slateSide,
      },
    ];
  });
}

// The cap ring as eight segments. The worn hub's two front segments are broken down to low
// dark stubs, notching the hopper rim.
function capRing(repaired: boolean): Part[] {
  const outer = ngon(8, 40.3, 0, 0, Math.PI / 8);
  const inner = ngon(8, 33.3, 0, 0, Math.PI / 8);
  const broken = repaired ? [] : [0, 7];
  return Array.from({ length: 8 }, (_, i): Part => {
    const plan = [outer[i]!, outer[(i + 1) % 8]!, inner[(i + 1) % 8]!, inner[i]!];
    return broken.includes(i)
      ? { plan, z0: 62, z1: 65.5, top: steelDark, side: steelDarkSide }
      : { plan, z0: 62, z1: CAP_TOP, top: slateCap, side: slateSide };
  });
}

function hubParts(lit: boolean, { repaired }: HubState): Part[][] {
  const groups: Part[][] = [...silos()];
  const deck = ngon(8, DECK_R, 0, 0, Math.PI / 8);
  const deckGroup: Part[] = [
    { plan: deck, z0: 0, z1: DECK_TOP, top: cream, side: creamSide },
    ...wallWindows(facing, 3.5, 6.5, 3, 3, deck),
  ];
  if (repaired) {
    // Rim lights round the restored deck, alternating with the blink.
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      const [x, y] = [Math.cos(a) * (DECK_R - 3), Math.sin(a) * (DECK_R - 3)];
      deckGroup.push(lamp(x, y, DECK_TOP, 2.4, (i % 2 === 0) === lit ? blue : blueDim));
    }
  } else {
    // Scorched plating on the deck top and one patched deck wall.
    for (const [d, a, angle, l, w] of [
      [48, 30, 0.4, 16, 9],
      [44, -40, -0.3, 11, 7],
      [-20, 52, 1.1, 13, 6],
    ] as const) {
      deckGroup.push({
        plan: orientedBox(...at(d, a), DOCK + angle, l, w),
        z0: DECK_TOP,
        z1: DECK_TOP,
        top: scorch,
        side: scorch,
      });
    }
    deckGroup.push(...wallWindows((nx, ny) => nx > 0.9 && ny < -0.2, 2, 9, 1, 14, deck, patch));
  }
  groups.push(deckGroup);
  // Side piers (drawn behind the tower's front), each with a free berth. The worn hub's right
  // berth lights stay out.
  for (const s of [-1, 1]) {
    const angle = DOCK + s * SPREAD;
    const dead = !repaired && s === -1;
    groups.push([
      {
        plan: orientedBox(...along(angle, 77.5, 0), angle, 37, 15.5),
        z0: 1.5,
        z1: 11,
        top: cream,
        side: creamSide,
      },
      ...dockCollar(lit && !dead, SIDE_FACE, SIDE_MOUTH, 32.5, slate, slateSide, 15.5, angle),
    ]);
  }
  const tower = ngon(8, TOWER_R, 0, 0, Math.PI / 8);
  const towerGroup: Part[] = [
    { plan: tower, z0: DECK_TOP, z1: TOWER_TOP, top: slate, side: slateSide },
  ];
  for (const [row, z] of [22, 33, 44].entries()) {
    const panes = wallWindows(facing, z, z + 3, 3, 3, tower);
    towerGroup.push(
      ...panes.map((pane, i) =>
        // Half the worn tower's rooms are dark.
        !repaired && (row + i) % 2 === 1 ? { ...pane, top: slateDark, side: slateDark } : pane,
      ),
    );
  }
  const front = (nx: number, ny: number) => nx > 0.6 && ny > 0.6;
  const left = (nx: number, ny: number) => nx < 0.2 && ny > 0.9;
  const right = (nx: number, ny: number) => nx > 0.9 && ny < 0.2;
  if (repaired) {
    // A lit ore band below the restored cap.
    towerGroup.push(...wallWindows(facing, 53, 57, 1, 24, tower, lit ? ore : oreDim));
  } else {
    // Patch plates over the window bands and rust streaks below the broken cap.
    const plate = (part: Part): Part => ({ ...part, side: patchSide });
    towerGroup.push(
      ...wallWindows(front, 27, 39, 1, 10, tower, patch).map(plate),
      ...wallWindows(right, 15, 21, 1, 14, tower, patch).map(plate),
      ...wallWindows(left, 47, 61, 2, 2.2, tower, rust),
      ...wallWindows(front, 50, 61, 3, 2.2, tower, rust),
      ...wallWindows(right, 52, 61, 1, 2.2, tower, rust),
    );
  }
  towerGroup.push(
    ...capRing(repaired),
    {
      plan: ngon(8, 33.3, 0, 0, Math.PI / 8),
      z0: CAP_TOP - 0.6,
      z1: CAP_TOP - 0.1,
      top: slateDark,
      side: slateDark,
    },
    ...oreHeap(0, 0, 29.5, CAP_TOP + 0.2, 12),
  );
  groups.push(towerGroup);
  groups.push(beacon(-24.8, -24.8, CAP_TOP, 24.8, lit));
  // Crates of deposited ore beside the tower; the worn hub has one crate knocked flat.
  for (const [d, a, angle] of [
    [37, -50, DOCK],
    [46.5, -37, repaired ? DOCK : DOCK + 0.5],
  ] as const) {
    const [cx, cy] = at(d, a);
    const flat = !repaired && angle !== DOCK;
    groups.push([
      {
        plan: orientedBox(cx, cy, angle, 11, 11),
        z0: DECK_TOP,
        z1: DECK_TOP + (flat ? 6 : 9.3),
        top: slate,
        side: slateSide,
      },
      ...(flat
        ? []
        : [
            {
              plan: orientedBox(cx, cy, angle, 8.5, 8.5),
              z0: DECK_TOP + 9.3,
              z1: DECK_TOP + 9.9,
              top: ore,
              side: ore,
            },
          ]),
    ]);
  }
  groups.push([
    { plan: orientedBox(...at(87, 0), DOCK, 50, 25), z0: 1.5, z1: 14, top: cream, side: creamSide },
    ...closedCollar(lit, PIER_FACE, 56, slate, slateSide, 21.7),
  ]);
  return groups;
}

// The second docking bay project: a new pier and collar off the deck's front left, in fresh
// cap slate with an ore sign band. Drawn as an overlay on either hub state.
function bayParts(lit: boolean): Part[][] {
  const length = BAY_FACE - 4 - DECK_R + 6;
  return [
    [
      {
        plan: orientedBox(...along(BAY_ANGLE, DECK_R - 6 + length / 2, 0), BAY_ANGLE, length, 20),
        z0: 1.5,
        z1: 10,
        top: cream,
        side: creamSide,
      },
      ...dockCollar(lit, BAY_FACE, BAY_MOUTH, 42, slateCap, slateSide, 18, BAY_ANGLE),
      {
        plan: orientedBox(...along(BAY_ANGLE, BAY_FACE + 0.6, 0), BAY_ANGLE, 0.6, 34),
        z0: 19,
        z1: 21.4,
        top: lit ? ore : oreDim,
        side: lit ? ore : oreDim,
      },
    ],
  ];
}

// ---------------------------------------------------------------- mooring buoy
// A cream buoy with a beacon and three mooring arms where the story craft hold between scenes.
const BUOY_ARMS = [DOCK + Math.PI / 2, DOCK - Math.PI / 2, DOCK + Math.PI + 0.35];
const BUOY_R = 19;
const ARM_END = 31;

function buoyParts(lit: boolean): Part[][] {
  const groups: Part[][] = [];
  for (const [i, angle] of BUOY_ARMS.entries()) {
    const [ex, ey] = along(angle, ARM_END, 0);
    const eye = (i % 2 === 0) === lit ? blue : blueDim;
    groups.push([
      {
        plan: orientedBox(
          ...along(angle, (BUOY_R + ARM_END) / 2, 0),
          angle,
          ARM_END - BUOY_R + 2,
          2.4,
        ),
        z0: 5,
        z1: 7.4,
        top: steelDark,
        side: steelDarkSide,
      },
      { plan: ngon(8, 2.6, ex, ey, Math.PI / 8), z0: 3.8, z1: 8.6, top: cream, side: creamSide },
      lamp(ex, ey, 8.6, 2.4, eye),
    ]);
  }
  const deck = ngon(10, BUOY_R, 0, 0, Math.PI / 10);
  groups.push([
    { plan: deck, z0: 0, z1: 11.6, top: cream, side: creamSide },
    ...wallWindows(facing, 4.5, 7.5, 1, 3, deck),
    ...[
      [1, 0, 4.4],
      [0.7, 4.4, 8.7],
      [0.4, 8.7, 11.6],
    ].map(([k, z0, z1], i, all): Part => ({
      plan: ngon(10, 13 * k!, 0, 0, Math.PI / 10),
      z0: 11.6 + z0!,
      z1: 11.6 + z1!,
      top: i === all.length - 1 ? warm : cream,
      side: creamSide,
    })),
  ]);
  groups.push(beacon(0, 0, 23.2, 12, lit));
  groups.push(dockCollar(lit, BUOY_R + 3, 13, 20, cream, creamSide, 10));
  return groups;
}

// ---------------------------------------------------------------- fixed frames
type Fixed = {
  id: string;
  path: string;
  title: string;
  frames: { a: Face[]; b: Face[] };
  // Display size is frame * DISPLAY_SCALE * scale: HUB_SCALE for the hub and its changes.
  scale: number;
};

// Frame px of a model point on a fixed frame with the pivot at (halfWidth, above).
type Layout = { halfWidth: number; above: number; width: number; height: number };

// One frame over every listed frame: pivot on the vertical centre line, whole display px, and
// a pivot height that is an exact five-decimal fraction.
function layout(faces: readonly Face[]): Layout {
  const all = faces.flatMap(({ points }) => points);
  const xs = all.map((point) => projectAt(0, 0, point)[0]);
  const ys = all.map((point) => projectAt(0, 0, point)[1]);
  const half = Math.max(-Math.min(...xs), Math.max(...xs)) + PAD;
  const halfWidth = Math.ceil(half / (STEP / 2)) * (STEP / 2);
  const minAbove = Math.ceil(-Math.min(...ys) + PAD);
  const minBelow = Math.ceil(Math.max(...ys) + PAD);
  for (let height = Math.ceil((minAbove + minBelow) / STEP) * STEP; ; height += STEP) {
    for (let above = minAbove; above <= height - minBelow; above++) {
      if ((above * 100000) % height === 0) {
        return { halfWidth, above, width: halfWidth * 2, height };
      }
    }
  }
}

const frameXY = ({ halfWidth, above }: Layout, point: Point) => projectAt(halfWidth, above, point);

// SVG at display size (frame * DISPLAY_SCALE * scale) with the viewBox in frame px.
function svgFile(
  title: string,
  width: number,
  height: number,
  faces: readonly Face[],
  place: (p: Point) => [number, number],
  scale = 1,
) {
  const shapes = faces.map(({ color, points }) => {
    const projected = points.map((point) => {
      const [x, y] = place(point);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return `  <polygon fill="${color}" points="${projected.join(" ")}"/>`;
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(width * DISPLAY_SCALE * scale)}" height="${round(height * DISPLAY_SCALE * scale)}" viewBox="0 0 ${width} ${height}">`,
    `  <title>${title}</title>`,
    ...shapes,
    "</svg>",
    "",
  ].join("\n");
}

// Screen direction of a world-plane axis, normalized, for dock and mooring outward vectors.
function screenAxis(angle: number): [number, number] {
  const [x, y] = [Math.cos(angle), Math.sin(angle)];
  const [sx, sy] = [((x - y) * Math.sqrt(3)) / 2, (x + y) / 2];
  const length = Math.hypot(sx, sy);
  return [round(sx / length), round(sy / length)];
}

// A dock mouth centred `face` along `angle` on the world plane, in the station dock schema.
function dockAt(frame: Layout, angle: number, face: number, mouthWidth: number) {
  const [x, y] = frameXY(frame, [...along(angle, face, 0), 0]);
  return {
    x: round(x),
    y: round(y),
    outward: screenAxis(angle),
    width: round((mouthWidth * Math.sqrt(3)) / Math.SQRT2),
  };
}

function fixedEntry(frame: Layout, item: Fixed, letter: "a" | "b", extra: Record<string, unknown>) {
  return {
    id: `${item.id}-${letter}`,
    path: `/art/cartwheel/${item.path}-${letter}.svg`,
    width: frame.width,
    height: frame.height,
    displayWidth: round(frame.width * DISPLAY_SCALE * item.scale),
    displayHeight: round(frame.height * DISPLAY_SCALE * item.scale),
    facing: "fixed",
    pivot: { x: 0.5, y: frame.above / frame.height },
    frameMs: BLINK_MS,
    ...extra,
  };
}

function writeFixed(dir: string, frame: Layout, item: Fixed) {
  for (const letter of ["a", "b"] as const) {
    writeFileSync(
      `${dir}${item.path}-${letter}.svg`,
      svgFile(
        `${item.title} ${letter.toUpperCase()}`,
        frame.width,
        frame.height,
        item.frames[letter],
        (point) => frameXY(frame, point),
        item.scale,
      ),
    );
  }
}

const blink = (build: (lit: boolean) => Part[][]) => ({
  a: polygons(build(true)),
  b: polygons(build(false)),
});

const hubWorn: Fixed = {
  id: "outpost-hub",
  path: "hub",
  title: "Cartwheel hub, worn",
  frames: blink((lit) => hubParts(lit, { repaired: false })),
  scale: HUB_SCALE,
};
const hubRepaired: Fixed = {
  id: "outpost-hub-repaired",
  path: "hub-repaired",
  title: "Cartwheel hub, repaired",
  frames: blink((lit) => hubParts(lit, { repaired: true })),
  scale: HUB_SCALE,
};
const hubBay: Fixed = {
  id: "outpost-hub-bay",
  path: "hub-bay",
  title: "Cartwheel hub, second docking bay",
  frames: blink(bayParts),
  scale: HUB_SCALE,
};
const buoy: Fixed = {
  id: "mooring-buoy",
  path: "mooring-buoy",
  title: "Cartwheel mooring buoy",
  frames: blink(buoyParts),
  scale: 1,
};

// Screen outlines of two convex faces overlap with positive area (separating axis test).
function overlaps(a: Face, b: Face): boolean {
  const outline = (face: Face) => face.points.map((point) => projectAt(0, 0, point));
  const [pa, pb] = [outline(a), outline(b)];
  for (const poly of [pa, pb]) {
    for (const [i, [x0, y0]] of poly.entries()) {
      const [x1, y1] = poly[(i + 1) % poly.length]!;
      const [nx, ny] = [y0 - y1, x1 - x0];
      if (Math.hypot(nx, ny) < 1e-9) {
        continue;
      }
      const span = (points: [number, number][]) => points.map(([x, y]) => x * nx + y * ny);
      const [sa, sb] = [span(pa), span(pb)];
      if (Math.max(...sa) <= Math.min(...sb) + 1e-6 || Math.max(...sb) <= Math.min(...sa) + 1e-6) {
        return false;
      }
    }
  }
  return true;
}

// The bay overlay drawn over either hub state must match a full render: no hub face that the
// full render draws after a bay face may overlap it.
for (const repaired of [false, true]) {
  for (const lit of [true, false]) {
    const bay = new Set(polygons(bayParts(lit)).map((face) => JSON.stringify(face)));
    const full = polygons([...hubParts(lit, { repaired }), ...bayParts(lit)]);
    const drawn: Face[] = [];
    for (const face of full) {
      if (bay.has(JSON.stringify(face))) {
        drawn.push(face);
      } else if (drawn.some((under) => overlaps(under, face))) {
        throw new Error(`a ${repaired ? "repaired" : "worn"} hub face covers the bay overlay`);
      }
    }
  }
}

const hubFrame = layout(
  [hubWorn, hubRepaired, hubBay].flatMap(({ frames }) => [...frames.a, ...frames.b]),
);
const buoyFrame = layout([...buoy.frames.a, ...buoy.frames.b]);

// ---------------------------------------------------------------- craft
// Craft models use the enemy heading convention: local forward is -y, heading k faces world
// angle k * 22.5 degrees. Plans are written in (u forward, v across) through `FWD`.
const FWD = -Math.PI / 2;
const uv = (u: number, v: number) => along(FWD, u, v);
const craftPlan = (local: Plan) => orientedPlan(0, 0, FWD, local);
const craftBox = (u: number, v: number, length: number, width: number) =>
  orientedBox(...uv(u, v), FWD, length, width);

// `visible` tests a local wall normal against the heading's view.
type Craft = {
  name: string;
  title: string;
  build: (visible: (nx: number, ny: number) => boolean) => Part[][];
  // Heights parts rest on (hull top, then cab top): groups based there draw after those below.
  levels: readonly number[];
  // Jet mouths as (u, v, z) at the engine faces, all `mouthWidth` wide.
  mouths: readonly (readonly [number, number, number])[];
  mouthWidth: number;
};

// Miner: the tri-hull ore hauler, shared with the stranded hauler (cartwheel-craft.ts).
const miner: Craft = {
  name: "miner",
  title: "Cartwheel miner",
  levels: HAULER_LEVELS,
  mouthWidth: HAULER_MOUTH_WIDTH,
  mouths: HAULER_MOUTHS,
  build: (visible) => hauler({ powered: true }, visible),
};

// Visitors: a loaf shuttle in distinct pastel hulls, none coral, amber or Ada's blue. A rounded
// passenger body with a bevelled roof, a wide warm window band, a roof cupola, engines on the rear
// corners and blue tail lights; no wings. Design units, built at SHUTTLE_SCALE.
const SHUTTLE_SCALE = 1.45;
function shuttle(
  name: string,
  title: string,
  top: string,
  side: string,
  rear: string,
  roof: string,
): Craft {
  const k = SHUTTLE_SCALE;
  return {
    name,
    title,
    levels: [9.4 * k],
    mouthWidth: 3.2 * k,
    mouths: (
      [
        [-15.8, -5.4, 5.2],
        [-15.8, 5.4, 5.2],
      ] as const
    ).map(([u, v, z]) => [u * k, v * k, z * k] as const),
    build: (visible) => {
      const body = craftPlan([
        [-12, -7.5],
        [10, -7.5],
        [13.5, -6],
        [14.5, 0],
        [13.5, 6],
        [10, 7.5],
        [-12, 7.5],
      ]);
      const upper = craftPlan([
        [-11, -6.6],
        [9.4, -6.6],
        [12.4, -5],
        [13.2, 0],
        [12.4, 5],
        [9.4, 6.6],
        [-11, 6.6],
      ]);
      const engine = { top: steelDark, side: steelDarkSide, front: "flat", back: "flat" } as const;
      // Wall windows go on the unscaled plan, so the model scales as one.
      return scaleGroups(k, [
        ...[-1, 1].map((s) => hcyl(-15.5, -9, s * 5.4, 5.2, 2.4, engine)),
        [
          part(body, 1.5, 8.4, top, side, rear),
          ...wallWindows(visible, 5, 7.4, 3, 2.6, body, warm),
        ],
        [part(upper, 8.4, 9.4, top, side, rear)],
        [
          part(
            craftPlan([
              [-9, -4],
              [7, -4],
              [10, -2.5],
              [10, 2.5],
              [7, 4],
              [-9, 4],
            ]),
            9.4,
            10.2,
            roof,
            side,
          ),
        ],
        [part(craftBox(13.3, 0, 1, 7), 5.6, 8, warm, warm)],
        [part(craftBox(-3, 0, 7, 6), 10.2, 11.6, top, side), cube(-5, 0, 11.6, 1.4, blue)],
        [cube(-12.6, -6.4, 7.4, 1.2, blue)],
        [cube(-12.6, 6.4, 7.4, 1.2, blue)],
      ]);
    },
  };
}

const visitor1 = shuttle(
  "visitor1",
  "Cartwheel visitor, sage",
  "#a7c49a",
  "#728f66",
  "#5a7351",
  "#bdd4b2",
);
const visitor2 = shuttle(
  "visitor2",
  "Cartwheel visitor, periwinkle",
  "#aab0e6",
  "#7379b4",
  "#5b6093",
  "#c0c5ee",
);
// The mock-up's third visitor, kept as an alternate.
const visitor3 = shuttle(
  "visitor3",
  "Cartwheel visitor, pale cream",
  "#e9e2d6",
  "#b4ab9c",
  "#8f877a",
  "#f3eee6",
);

// Blocking pilot, design A: a chartreuse wedge with a wide graphite ram bar, white high beams and
// oversized graphite engine pods. Pushy without Gadget's coral, pincers, visor or insignia, and
// clear of the holodisk magenta and the claim-jumpers' rust.
const chartreuse = "#b6dd30";
const chartreuseSide = "#84a41e";
const chartreuseRear = "#617c18";
const graphite = "#7d7a92";
const graphiteSide = "#5e5b72";
const beam = "#fffbea";

const blockerRam: Craft = {
  name: "blocker",
  title: "Cartwheel blocking pilot",
  levels: [9.5, 14],
  mouthWidth: 6,
  mouths: [
    [-26, -15, 7],
    [-26, 15, 7],
  ],
  build: (visible) => {
    const hull = craftPlan([
      [18, -7],
      [18, 7],
      [4, 12],
      [-20, 12],
      [-23, 8],
      [-23, -8],
      [-20, -12],
      [4, -12],
    ]);
    const cab = craftPlan([
      [8, -5],
      [8, 5],
      [-4, 6.5],
      [-10, 6.5],
      [-10, -6.5],
      [-4, -6.5],
    ]);
    const groups: Part[][] = [
      ...[-1, 1].map((s): Part[] => [
        { plan: craftBox(-14, s * 15, 24, 8), z0: 2.5, z1: 11, top: graphite, side: graphiteSide },
        {
          plan: craftBox(-14, s * 15, 6, 8.6),
          z0: 2.2,
          z1: 11.3,
          top: chartreuse,
          side: chartreuseSide,
        },
      ]),
      [{ plan: hull, z0: 2, z1: 9.5, top: chartreuse, side: chartreuseSide, rear: chartreuseRear }],
      [
        { plan: cab, z0: 9.5, z1: 14, top: chartreuse, side: chartreuseSide, rear: chartreuseRear },
        ...wallWindows((nx, ny) => visible(nx, ny) && ny < -0.5, 10.3, 13, 1, 6, cab),
      ],
      [{ plan: craftBox(-16, 0, 12, 2), z0: 9.5, z1: 17, top: graphite, side: graphiteSide }],
      ...[-1, 1].map((s): Part[] => [
        { plan: craftBox(19.5, s * 7, 5, 3), z0: 3, z1: 7, top: graphite, side: graphiteSide },
      ]),
      [{ plan: craftBox(23, 0, 3.5, 34), z0: 1.5, z1: 8, top: graphite, side: graphiteSide }],
      [-1, 1].map((s) => lamp(...uv(25.4, s * 13), 3, 3.2, beam)),
    ];
    return groups;
  },
};

// Blocking pilot, design B: a grey plough tug with a wide chartreuse V-blade and roof beams.
const tug = "#9a9cad";
const tugSide = "#6c6e80";
const tugRear = "#555666";
const blade = "#c8d64a";
const bladeSide = "#8f9a2e";

const blockerPlough: Craft = {
  name: "blocker",
  title: "Cartwheel blocking pilot, plough",
  levels: [11, 18],
  mouthWidth: 6,
  mouths: [
    [-23, -5, 7],
    [-23, 5, 7],
  ],
  build: (visible) => {
    const hull = craftPlan(box(-19, -11, 12, 11));
    const cab = craftBox(-5, 0, 12, 15);
    return [
      [{ plan: craftBox(-21, 0, 4, 16), z0: 3, z1: 11, top: graphite, side: graphiteSide }],
      [{ plan: hull, z0: 2, z1: 11, top: tug, side: tugSide, rear: tugRear }],
      [
        { plan: cab, z0: 11, z1: 18, top: tug, side: tugSide, rear: tugRear },
        ...wallWindows(visible, 13.5, 16, 1, 7, cab),
      ],
      [
        {
          plan: craftPlan([
            [12, -19],
            [22, 0],
            [12, 19],
            [9, 19],
            [18, 0],
            [9, -19],
          ]),
          z0: 1,
          z1: 9,
          top: blade,
          side: bladeSide,
        },
      ],
      [-1, 1].map((s) => lamp(...uv(1.6, s * 5.5), 18, 2.8, beam)),
    ];
  },
};

const craftView = (yaw: number) => (point: Point) => rotate(ENEMY_HEADINGS, yaw, point);

// A local wall normal faces the viewer at this heading.
const visibleAt = (yaw: number) => (nx: number, ny: number) => {
  const [x, y] = rotate(ENEMY_HEADINGS, yaw, [nx, ny, 0]);
  return facing(x, y);
};

const headingFaces = (craft: Craft, yaw: number) =>
  polygons(craft.build(visibleAt(yaw)), craftView(yaw), craft.levels);

// Smallest square frame, a multiple of 16 px, holding every heading with padding.
function craftFrame(craft: Craft): number {
  let extent = 0;
  for (let yaw = 0; yaw < ENEMY_HEADINGS; yaw++) {
    for (const { points } of headingFaces(craft, yaw)) {
      for (const point of points) {
        const [x, y] = projectAt(0, 0, point);
        extent = Math.max(extent, Math.abs(x), Math.abs(y));
      }
    }
  }
  return Math.ceil((2 * (extent + PAD)) / STEP) * STEP;
}

const cartwheelJets = {
  outer: ["#c9a978", "#ffe9b8"] as [string, string],
  core: ["#efe4cf", "#ffffff"] as [string, string],
};

function writeCraft(dir: string, craft: Craft) {
  const frame = craftFrame(craft);
  const centre = frame / 2;
  for (let yaw = 0; yaw < ENEMY_HEADINGS; yaw++) {
    writeFileSync(
      `${dir}${craft.name}-${yaw}.svg`,
      svgFile(`${craft.title} ${yaw}`, frame, frame, headingFaces(craft, yaw), (point) =>
        projectAt(centre, centre, point),
      ),
    );
  }
  const half = craft.mouthWidth / 2;
  writeFileSync(
    `${dir}${craft.name}-jets.json`,
    jetsFile(
      frame,
      (yaw) =>
        craft.mouths.map(([u, v, z]) => ({
          anchor: anchor(ENEMY_HEADINGS, centre, yaw, [...uv(u, v), z]),
          axis: vector(ENEMY_HEADINGS, yaw, [0, 1, 0]),
          half: vector(ENEMY_HEADINGS, yaw, [-half, 0, 0]),
        })),
      cartwheelJets,
      { nose: noses((yaw) => headingFaces(craft, yaw), frame, craft) },
    ),
  );
  const display = round(frame * DISPLAY_SCALE);
  return Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => ({
    id: `craft-${craft.name}-${yaw}`,
    path: `/art/cartwheel/${craft.name}-${yaw}.svg`,
    width: frame,
    height: frame,
    displayWidth: display,
    displayHeight: display,
    facing: `world-${yaw}`,
    directionIndex: yaw,
    pivot: { x: 0.5, y: 0.5 },
    craft: craft.name,
  }));
}

// ---------------------------------------------------------------- export
mkdirSync(output, { recursive: true });
for (const item of [hubWorn, hubRepaired, hubBay]) {
  writeFixed(output, hubFrame, item);
}
writeFixed(output, buoyFrame, buoy);

// Free berths left then right on screen.
const berths = [1, -1].map((s) => dockAt(hubFrame, DOCK + s * SPREAD, SIDE_FACE, SIDE_MOUTH));
const hubEntries = [
  ...(["a", "b"] as const).map((letter) =>
    fixedEntry(hubFrame, hubWorn, letter, {
      berths,
      destination: "hub",
      variant: "worn",
    }),
  ),
  ...(["a", "b"] as const).map((letter) =>
    fixedEntry(hubFrame, hubRepaired, letter, {
      berths,
      destination: "hub",
      variant: "repaired",
      project: "hub-repairs",
    }),
  ),
  ...(["a", "b"] as const).map((letter) =>
    fixedEntry(hubFrame, hubBay, letter, {
      overlay: true,
      destination: "hub",
      project: "second-docking-bay",
      berths: [dockAt(hubFrame, BAY_ANGLE, BAY_FACE, BAY_MOUTH)],
    }),
  ),
];
const moorings = BUOY_ARMS.map((angle) => {
  const [x, y] = frameXY(buoyFrame, [...along(angle, ARM_END, 0), 0]);
  return { x: round(x), y: round(y), outward: screenAxis(angle) };
});
const buoyEntries = (["a", "b"] as const).map((letter) =>
  fixedEntry(buoyFrame, buoy, letter, { moorings }),
);

const crafts = [miner, visitor1, visitor2, blockerRam];
const craftEntries = crafts.flatMap((craft) => writeCraft(output, craft));

// Cartwheel's manifest opens with the hub and the buoy; the story craft follow the claim jumpers.
replaceEntries(
  "cartwheel",
  (id) => id.startsWith("outpost-hub-") || id.startsWith("mooring-buoy-"),
  [...hubEntries, ...buoyEntries],
  () => true,
);
// The miner is also a Black Eye finale ally, so its frames are shared art in core; the other
// story craft are Cartwheel's alone. Cartwheel's entries go first, so no id is ever in both.
const craftIds = (names: readonly string[]) => new RegExp(`^craft-(${names.join("|")})-\\d+$`);
const SHARED = ["miner"];
const isShared = (entry: { id: string }) => craftIds(SHARED).test(entry.id);
replaceEntries(
  "cartwheel",
  (id) => craftIds(crafts.map(({ name }) => name)).test(id),
  craftEntries.filter((entry) => !isShared(entry)),
  (id) => id.startsWith("cartwheel-debris-") || id.startsWith("craft-stranded-"),
);
replaceEntries("core", (id) => craftIds(SHARED).test(id), craftEntries.filter(isShared));

const flag = process.argv.indexOf("--alternates");
if (flag !== -1) {
  const dir = `${process.argv[flag + 1] ?? "alternates"}/`;
  mkdirSync(dir, { recursive: true });
  const alternates = [visitor3, { ...blockerPlough, name: "blocker-plough" }];
  const entries = alternates.flatMap((craft) => writeCraft(dir, craft));
  writeFileSync(`${dir}alternates.json`, json(entries));
}
