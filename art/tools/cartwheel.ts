// Cartwheel's story art: the mining hub with its two project world changes, the mooring buoy,
// and the non-hostile story craft (the miner, two regular visitors and the blocking pilot) in
// sixteen headings with speed jets. Usage: node art/tools/cartwheel.ts [--alternates <dir>]
// writes public/art/cartwheel/ and its manifest entries; `--alternates` also writes the unused
// visitor and blocker designs to <dir> for review.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { hauler, HAULER_LEVELS, HAULER_MOUTH_WIDTH, HAULER_MOUTHS } from "./cartwheel-craft.ts";
import { svgText } from "./svg-text.ts";
import { jetsFile } from "./crafts.ts";
import { cube, hcyl, part, scaleGroups } from "./hull-shapes.ts";
import { mergeSidecars, readManifest, replaceEntries, sidecarsIn, writeOnce } from "./manifest.ts";
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
import { writeStoryHull } from "./story-hull-sheet.ts";
import {
  along,
  BLINK_MS,
  blue,
  blueDim,
  box,
  cream,
  creamSide,
  DISPLAY_SCALE,
  HUB_SCALE,
  DOCK,
  dockCollar,
  type Face,
  facing,
  mouthInner,
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
// Second-bay overlay and shared fittings.
const ore = ORE_SOLID.top;
const oreDim = ORE_SOLID.dim;
const steelDark = "#6e7482";
const steelDarkSide = "#4f5462";
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

// A light cube of side `size` centred at (x, y) from z0.
function lamp(x: number, y: number, z0: number, size: number, color: string): Part {
  const h = size / 2;
  return { plan: box(x - h, y - h, x + h, y + h), z0, z1: z0 + size, top: color, side: color };
}

// ---------------------------------------------------------------- hub
const SIDE_FACE = 99;
const SIDE_MOUTH = 23;
const SPREAD = 0.95;
const hubFrame: Layout = { halfWidth: 152, above: 180, width: 304, height: 320 };
// The plates and fixed story contacts share the original drawing coordinates.
const hubDesignPivot = { x: 120, y: 135 };
// The funded berth sits on the forward plate edge from (88, 190) to (123, 198).
const BAY_ANGLE = DOCK + 0.42;
const BAY_MOUTH = 30;
const bayBerth = {
  x: hubFrame.halfWidth + (108 - hubDesignPivot.x),
  y: round(hubFrame.above + (190 + ((108 - 88) * 8) / 35 - hubDesignPivot.y)),
  outward: screenAxis(BAY_ANGLE),
  width: round((BAY_MOUTH * Math.sqrt(3)) / Math.SQRT2),
};

// Use the dock geometry for the story approach, with muted guide rails and a shadowed recess.
const serviceTones = new Map([
  [mouthInner, "#2e3844"],
  [warm, "#52656a"],
  [blue, "#526976"],
  [blueDim, "#3c4c59"],
]);

function serviceCollar(...geometry: Parameters<typeof dockCollar>): Part[] {
  return dockCollar(...geometry).map((part) => ({
    ...part,
    top: serviceTones.get(part.top) ?? part.top,
    side: serviceTones.get(part.side) ?? part.side,
  }));
}

function hubBerths(lit: boolean, repaired: boolean): Part[][] {
  return [1, -1].map((side) =>
    serviceCollar(
      lit && (repaired || side === 1),
      SIDE_FACE,
      SIDE_MOUTH,
      32.5,
      "#42535a",
      "#303c49",
      15.5,
      DOCK + side * SPREAD,
    ),
  );
}

// Armor and the flush guide are drawn relative to the original hub pivot.
function face(color: string, plan: Plan): Face {
  return {
    color,
    points: plan.map(([x, y]) => {
      const across = (x - hubDesignPivot.x) / Math.sqrt(3);
      return [across, -across, hubDesignPivot.y - y];
    }),
  };
}

const HUB_AXIS = Math.PI / 12;
const panelFace = (colour: string, plan: Plan) =>
  face(colour, orientedPlan(110, 96, HUB_AXIS, plan));

function panelOval(rx: number, ry: number): Plan {
  return ngon(12, 1, 0, 0, Math.PI / 12).map(([x, y]) => [rx * x, ry * y]);
}

function radiatorShoulders(lit: boolean, repaired: boolean): Face[] {
  return [-1, 1].flatMap((side) => {
    const plate = (colour: string, plan: Plan) =>
      face(
        colour,
        plan.map(([x, y]) => [hubDesignPivot.x + side * x, y]),
      );
    const light = lit && (repaired || side === 1) ? "#9ac7c2" : "#617685";
    return [
      plate("#303c49", [
        [68, 100],
        [100, 93],
        [128, 106],
        [140, 120],
        [132, 132],
        [117, 137],
        [75, 136],
      ]),
      plate("#506673", orientedBox(112, 113, Math.PI / 8, 36, 16)),
      ...[-7, 7].map((offset) =>
        plate(light, orientedPlan(112, 113, Math.PI / 8, box(offset - 3, -3, offset + 3, 3))),
      ),
    ];
  });
}

function hubArmor(lit: boolean, repaired: boolean): Face[] {
  const signal = lit ? blue : blueDim;
  const panel = repaired ? "#638f8b" : "#4b7275";
  const window = repaired ? (lit ? "#a3d8cb" : "#6e9294") : lit ? "#80aa9f" : "#536f79";
  return [
    ...radiatorShoulders(lit, repaired),
    // Preserve the lower plate outer edge and the upper shell's tilted silhouette.
    face("#303743", [
      [10, 161],
      [24, 137],
      [49, 133],
      [65, 111],
      [164, 103],
      [186, 121],
      [212, 135],
      [230, 159],
      [218, 177],
      [186, 169],
      [166, 183],
      [140, 186],
      [123, 198],
      [88, 190],
      [76, 174],
      [51, 167],
      [24, 178],
    ]),
    face("#455966", [
      [10, 161],
      [24, 137],
      [49, 133],
      [76, 144],
      [78, 155],
      [52, 158],
      [24, 170],
    ]),
    face("#506b73", [
      [165, 110],
      [186, 121],
      [212, 135],
      [230, 159],
      [212, 162],
      [189, 148],
      [168, 144],
    ]),
    face("#344e57", [
      [33, 110],
      [40, 77],
      [58, 47],
      [82, 31],
      [121, 24],
      [153, 37],
      [177, 63],
      [188, 92],
      [181, 124],
      [155, 152],
      [119, 168],
      [85, 161],
      [57, 145],
      [41, 127],
    ]),
    face("#769192", [
      [40, 77],
      [58, 47],
      [82, 31],
      [121, 24],
      [139, 34],
      [102, 45],
      [72, 61],
      [53, 88],
    ]),
    face("#354b61", [
      [57, 145],
      [68, 140],
      [112, 134],
      [147, 115],
      [170, 91],
      [181, 101],
      [174, 122],
      [151, 146],
      [119, 161],
      [85, 155],
    ]),
    face("#4f596c", [
      [121, 24],
      [153, 37],
      [177, 63],
      [188, 92],
      [181, 124],
      [174, 122],
      [181, 101],
      [169, 88],
      [154, 51],
      [139, 34],
    ]),
    panelFace("#668a8c", panelOval(62, 56)),
    panelFace("#294653", panelOval(55, 48)),
    panelFace(panel, [
      [-33, -19],
      [-27, -25],
      [27, -25],
      [33, -19],
      [33, 19],
      [27, 25],
      [-27, 25],
      [-33, 19],
    ]),
    panelFace(window, box(-22, -2, 22, 2)),
    face("#394657", [
      [113, 26],
      [116, 13],
      [120, 12],
      [119, 26],
    ]),
    face(signal, [
      [115, 14],
      [116, 10],
      [121, 9],
      [121, 13],
    ]),
  ];
}

function hubFaces(lit: boolean, repaired: boolean): Face[] {
  // Grow the upper envelope while the side mouths, lower keel and flush plate stay put.
  const upperStretch = 1.3;
  const deckZ = hubDesignPivot.y - 166;
  const armor = hubArmor(lit, repaired).map(({ color, points }) => ({
    color,
    points: points.map(([x, y, z]): Point => [
      x,
      y,
      z + Math.max(0, z - deckZ) * (upperStretch - 1),
    ]),
  }));
  return [...armor, ...polygons(hubBerths(lit, repaired))];
}

// The project lights a flush guide on the plate, above the world-plane berth point.
function bayFaces(lit: boolean): Face[] {
  return [
    face("#202b36", [
      [98, 184],
      [112, 181],
      [117, 184],
      [102, 188],
    ]),
    face(lit ? ore : oreDim, [
      [102, 184.5],
      [111, 182.5],
      [113, 183.5],
      [104, 186],
    ]),
  ];
}

// ---------------------------------------------------------------- mooring buoy
// A cream buoy with a beacon and three mooring arms where the story craft hold between scenes.
const BUOY_ARMS = [DOCK + Math.PI / 2, DOCK - Math.PI / 2, DOCK + Math.PI + 0.35];
const BUOY_R = 19;
const BUOY_CORE_GROWTH = 1.45;
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
  const core: Part[] = [
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
    ...beacon(0, 0, 23.2, 12, lit),
  ];
  // The body grows between the original arm tips. Story craft use their old world offsets.
  groups.push(
    core.map(({ plan, z0, z1, ...material }): Part => ({
      ...material,
      plan: plan.map(([x, y]) => [x * BUOY_CORE_GROWTH, y * BUOY_CORE_GROWTH]),
      z0: z0 * BUOY_CORE_GROWTH,
      z1: z1 * BUOY_CORE_GROWTH,
    })),
  );
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
      svgText(
        svgFile(
          `${item.title} ${letter.toUpperCase()}`,
          frame.width,
          frame.height,
          item.frames[letter],
          (point) => frameXY(frame, point),
          item.scale,
        ),
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
  frames: { a: hubFaces(true, false), b: hubFaces(false, false) },
  scale: HUB_SCALE,
};
const hubRepaired: Fixed = {
  id: "outpost-hub-repaired",
  path: "hub-repaired",
  title: "Cartwheel hub, repaired",
  frames: { a: hubFaces(true, true), b: hubFaces(false, true) },
  scale: HUB_SCALE,
};
const hubBay: Fixed = {
  id: "outpost-hub-bay",
  path: "hub-bay",
  title: "Cartwheel hub, second docking bay",
  frames: { a: bayFaces(true), b: bayFaces(false) },
  scale: HUB_SCALE,
};
const buoy: Fixed = {
  id: "mooring-buoy",
  path: "mooring-buoy",
  title: "Cartwheel mooring buoy",
  frames: blink(buoyParts),
  scale: 1,
};

// Keep the shared attachment frame fixed and check that all four edges retain padding.
for (const { frames } of [hubWorn, hubRepaired, hubBay]) {
  for (const { points } of [...frames.a, ...frames.b]) {
    for (const point of points) {
      const [x, y] = frameXY(hubFrame, point);
      if (x < PAD || x > hubFrame.width - PAD || y < PAD || y > hubFrame.height - PAD) {
        throw new Error("Cartwheel hub art exceeds its shared frame");
      }
    }
  }
}
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
          ...wallWindows(visible, 5, 7.4, 1, 4.4, body, warm),
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
        [part(craftBox(-3, 0, 7, 6), 10.2, 11.6, roof, side)],
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
      ]),
      [{ plan: hull, z0: 2, z1: 9.5, top: chartreuse, side: chartreuseSide, rear: chartreuseRear }],
      [
        { plan: cab, z0: 9.5, z1: 14, top: chartreuse, side: chartreuseSide, rear: chartreuseRear },
        ...wallWindows((nx, ny) => visible(nx, ny) && ny < -0.5, 10.3, 13, 1, 6, cab),
      ],
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

// A craft's jets file: mouths, colours and nose per heading.
function craftJets(craft: Craft): string {
  const frame = craftFrame(craft);
  const centre = frame / 2;
  const half = craft.mouthWidth / 2;
  return jetsFile(
    frame,
    (yaw) =>
      craft.mouths.map(([u, v, z]) => ({
        anchor: anchor(ENEMY_HEADINGS, centre, yaw, [...uv(u, v), z]),
        axis: vector(ENEMY_HEADINGS, yaw, [0, 1, 0]),
        half: vector(ENEMY_HEADINGS, yaw, [-half, 0, 0]),
      })),
    cartwheelJets,
    { nose: noses((yaw) => headingFaces(craft, yaw), frame, craft) },
  );
}

// Writes a craft's frames and returns their entries.
function writeCraft(
  dir: string,
  craft: Craft,
  installed: ReturnType<typeof readManifest>["assets"] = [],
) {
  const frame = craftFrame(craft);
  const centre = frame / 2;
  const display = round(frame * DISPLAY_SCALE);
  const frames = Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => ({
    entry: {
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
    },
    root: svgText(
      svgFile(`${craft.title} ${yaw}`, frame, frame, headingFaces(craft, yaw), (point) =>
        projectAt(centre, centre, point),
      ),
    ),
  }));
  return writeStoryHull(installed, dir, craft.name, frames);
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
      berths: [bayBerth],
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
const SHARED = ["miner"];
const installed = {
  core: readManifest("core").assets,
  cartwheel: readManifest("cartwheel").assets,
};
const craftEntries = crafts.flatMap((craft) =>
  writeCraft(output, craft, installed[SHARED.includes(craft.name) ? "core" : "cartwheel"]),
);

// Cartwheel's manifest opens with the hub and the buoy; the story craft follow the claim jumpers.
replaceEntries(
  "cartwheel",
  (id) => id.startsWith("outpost-hub-") || id.startsWith("mooring-buoy-"),
  [...hubEntries, ...buoyEntries],
  () => true,
);
// The miner is also a Phantom finale ally, so its frames are shared art in core; the other
// story craft are Cartwheel's alone. Cartwheel's entries go first, so no id is ever in both.
const craftIds = (names: readonly string[]) => new RegExp(`^craft-(${names.join("|")})-\\d+$`);
const isShared = (entry: { id: string }) => craftIds(SHARED).test(entry.id);
replaceEntries(
  "cartwheel",
  (id) => craftIds(crafts.map(({ name }) => name)).test(id),
  craftEntries.filter((entry) => !isShared(entry)),
  (id) => id.startsWith("cartwheel-debris-") || id.startsWith("craft-stranded-"),
);
replaceEntries("core", (id) => craftIds(SHARED).test(id), craftEntries.filter(isShared));
// Each craft's jets sit beside its frames; crafts with the same jets (the visitors are one
// shuttle in two colours) use the first one's file.
const ownsCraft = (craft: string) => crafts.some(({ name }) => name === craft);
const jets = writeOnce(
  "/art/cartwheel/",
  new Map(),
  new Map(crafts.map((craft) => [`${craft.name}-jets.json`, craftJets(craft)])),
);
const sidecars = sidecarsIn(jets);
const only = (names: readonly string[]) =>
  Object.fromEntries(Object.entries(sidecars).filter(([name]) => names.includes(name)));
const names = crafts.map(({ name }) => name);
mergeSidecars("cartwheel", ownsCraft, only(names.filter((name) => !SHARED.includes(name))));
mergeSidecars("core", ownsCraft, only(SHARED));

const flag = process.argv.indexOf("--alternates");
if (flag !== -1) {
  const dir = `${process.argv[flag + 1] ?? "alternates"}/`;
  mkdirSync(dir, { recursive: true });
  const alternates = [visitor3, { ...blockerPlough, name: "blocker-plough" }];
  const entries = alternates.flatMap((craft) => {
    writeFileSync(`${dir}${craft.name}-jets.json`, craftJets(craft));
    return writeCraft(dir, craft);
  });
  writeFileSync(`${dir}alternates.json`, json(entries));
}
