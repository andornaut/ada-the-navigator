// Andromeda's destinations and story craft: the settlers' station, the settlements, the guide
// beacons, Pip's mail scooter and the two project world changes. Usage: node art/tools/andromeda.ts
// writes public/art/andromeda/ and replaces its own entries in place in Andromeda's manifest.
// Contract: art/andromeda.md.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import * as m from "./andromeda-models.ts";
import { jetsFile } from "./crafts.ts";
import { replaceEntries } from "./manifest.ts";
import {
  anchor,
  ENEMY_HEADINGS,
  type Point,
  projectAt,
  rotate,
  round,
  vector,
} from "./projection.ts";
import {
  along,
  BLINK_MS,
  DISPLAY_SCALE,
  DOCK,
  type Face,
  facing,
  type Part,
  polygons,
} from "./solid.ts";

const output = fileURLToPath(new URL("../../public/art/andromeda/", import.meta.url));
const PATH = "/art/andromeda/";
const PAD = 4;
const STEP = 16;

// ---------------------------------------------------------------- frames

type Layout = { halfWidth: number; above: number; width: number; height: number };

// One frame over every listed face, with the pivot on the vertical centre line: width and height
// are multiples of 16 px and the pivot height is an exact five-decimal fraction.
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

// SVG at its display size with the viewBox in frame px, as Cartwheel's art.
function svgFile(title: string, frame: Layout, faces: readonly Face[]): string {
  const shapes = faces.map(({ color, points }) => {
    const projected = points.map((point) => {
      const [x, y] = frameXY(frame, point);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return `  <polygon fill="${color}" points="${projected.join(" ")}"/>`;
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(frame.width * DISPLAY_SCALE)}" height="${round(frame.height * DISPLAY_SCALE)}" viewBox="0 0 ${frame.width} ${frame.height}">`,
    `  <title>${title}</title>`,
    ...shapes,
    "</svg>",
    "",
  ].join("\n");
}

// Screen direction of a world-plane axis, normalized, for dock outward vectors.
function screenAxis(angle: number): [number, number] {
  const [x, y] = [Math.cos(angle), Math.sin(angle)];
  const [sx, sy] = [((x - y) * Math.sqrt(3)) / 2, (x + y) / 2];
  const length = Math.hypot(sx, sy);
  return [round(sx / length), round(sy / length)];
}

// A dock mouth `face` along `angle` (shifted `across`) on the world plane, in the station schema.
function dockAt(frame: Layout, face: number, mouthWidth: number, across = 0, angle = DOCK) {
  const [x, y] = frameXY(frame, [...along(angle, face, across), 0]);
  return {
    x: round(x),
    y: round(y),
    outward: screenAxis(angle),
    width: round((mouthWidth * Math.sqrt(3)) / Math.SQRT2),
  };
}

type Fixed = { id: string; file: string; title: string; faces: readonly Face[] };

function writeFixed(frame: Layout, item: Fixed) {
  writeFileSync(`${output}${item.file}.svg`, svgFile(item.title, frame, item.faces));
}

function fixedEntry(frame: Layout, item: Fixed, extra: Record<string, unknown>, blink = true) {
  return {
    id: item.id,
    path: `${PATH}${item.file}.svg`,
    width: frame.width,
    height: frame.height,
    displayWidth: round(frame.width * DISPLAY_SCALE),
    displayHeight: round(frame.height * DISPLAY_SCALE),
    facing: "fixed",
    pivot: { x: 0.5, y: frame.above / frame.height },
    ...(blink ? { frameMs: BLINK_MS } : {}),
    ...extra,
  };
}

// A blink pair, frame A lit and frame B the other phase. `levels` are the deck heights buildings
// rest on.
function pair(
  id: string,
  file: string,
  title: string,
  build: (lit: boolean) => Part[][],
  levels: readonly number[] = [],
): Fixed[] {
  return (["a", "b"] as const).map((letter) => ({
    id: `${id}-${letter}`,
    file: `${file}-${letter}`,
    title: `${title} ${letter.toUpperCase()}`,
    faces: polygons(build(letter === "a"), undefined, levels),
  }));
}

const allFaces = (items: readonly Fixed[]) => items.flatMap(({ faces }) => faces);

mkdirSync(output, { recursive: true });

// ---------------------------------------------------------------- settlers' station

// Every Andromeda station draws this pair in place of the trading station, with its live dock.
const station = pair(
  "station-settlers",
  "settlers-station",
  "Settlers' station",
  m.station,
  m.STATION_LEVELS,
);
const stationFrame = layout(allFaces(station));
for (const item of station) writeFixed(stationFrame, item);
const stationDock = dockAt(stationFrame, m.STATION.dockFace, m.STATION.mouth);
const stationEntries = station.map((item) =>
  fixedEntry(stationFrame, item, { dock: stationDock, station: "settlers" }),
);
replaceEntries(
  "andromeda",
  (id) => /^station-settlers-[ab]$/.test(id),
  stationEntries,
  () => true,
);

// ---------------------------------------------------------------- settlements

// Andromeda's outposts, in the outpost schema: role `settlement`, one entry pair per design. Docks
// are decorative, as on Sunflower's outposts.
const settlements = [
  { variant: "hamlet", title: "Hamlet", build: m.hamlet, dock: m.HAMLET_DOCK },
  { variant: "lamphouse", title: "Lamp house", build: m.lampHouse, dock: m.LAMPHOUSE_DOCK },
] as const;
const settlementEntries = settlements.flatMap(({ build, dock, title, variant }) => {
  const items = pair(
    `outpost-${variant}`,
    variant,
    `Settlement, ${title.toLowerCase()}`,
    build,
    m.SETTLEMENT_LEVELS,
  );
  const frame = layout(allFaces(items));
  for (const item of items) writeFixed(frame, item);
  const at = dockAt(frame, dock.face, dock.mouth);
  return items.map((item) => fixedEntry(frame, item, { dock: at, outpost: "settlement", variant }));
});
replaceEntries(
  "andromeda",
  (id) => /^outpost-(hamlet|lamphouse)-[ab]$/.test(id),
  settlementEntries,
  (id) => !id.startsWith("station-settlers-"),
);

// ---------------------------------------------------------------- guide beacons

// The chain's beacons share one frame and pivot, so a state change swaps sprites in place. Lit and
// relit beacons blink; the dark, dented beacon is a single frame.
const beacons: (Fixed & { state: m.BeaconState; blink: boolean })[] = [
  ...(["lit", "relit"] as const).flatMap((state) =>
    pair(`beacon-guide-${state}`, `beacon-${state}`, `Guide beacon, ${state}`, (lit) =>
      m.beacon(state, lit),
    ).map((item) => ({ ...item, state, blink: true })),
  ),
  {
    id: "beacon-guide-dented",
    file: "beacon-dented",
    title: "Guide beacon, dark and dented",
    faces: polygons(m.beacon("dented", false)),
    state: "dented",
    blink: false,
  },
];
const beaconFrame = layout(allFaces(beacons));
for (const item of beacons) writeFixed(beaconFrame, item);
const beaconEntries = beacons.map((item) =>
  fixedEntry(beaconFrame, item, { beacon: "guide", state: item.state }, item.blink),
);
replaceEntries(
  "andromeda",
  (id) => /^beacon-guide-((lit|relit)-[ab]|dented)$/.test(id),
  beaconEntries,
  (id) => /^(enemy-|craft-|andromeda-haze)|portrait/.test(id),
);

// ---------------------------------------------------------------- Pip's mail scooter

// Sixteen headings in the enemy convention: heading k faces world angle k * 22.5 degrees.
const craftView = (yaw: number) => (point: Point) => rotate(ENEMY_HEADINGS, yaw, point);
const visibleAt = (yaw: number) => (nx: number, ny: number) => {
  const [x, y] = rotate(ENEMY_HEADINGS, yaw, [nx, ny, 0]);
  return facing(x, y);
};
const headingFaces = (craft: m.StoryCraft, yaw: number) =>
  polygons(craft.build(visibleAt(yaw)), craftView(yaw), craft.levels);

// Smallest square frame, a multiple of 16 px, holding every heading with padding.
function craftFrame(craft: m.StoryCraft): number {
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

// The nose tip: the midpoint of the forward-most top edge of the craft's solid parts, nearest the
// centre line (ties to negative v). Window panes are left out: they stand 0.6 proud of their walls
// only so they render.
function noseTip(craft: m.StoryCraft): { reach: number; tip: Point } {
  const parts = craft.build(() => false).flat();
  const reach = Math.max(...parts.flatMap(({ plan }) => plan.map(([, y]) => -y)));
  const edges = parts.flatMap(({ plan, z1 }) => {
    const front = plan.filter(([, y]) => Math.abs(y + reach) < 1e-9).map(([x]) => x);
    return front.length === 0 ? [] : [{ v: (Math.min(...front) + Math.max(...front)) / 2, z: z1 }];
  });
  const { v, z } = edges.sort(
    (p, q) => Math.abs(p.v) - Math.abs(q.v) || p.v - q.v || q.z - p.z,
  )[0]!;
  return { reach, tip: [...m.uv(reach, v), z] };
}

// World units from the pivot to the point under the nose tip on the centre line at heading `yaw`:
// the art's projection at display scale through the inverse of the game's (x - y, (x + y) / 2).
function noseDistance(reach: number, yaw: number): number {
  const [x, y] = projectAt(0, 0, rotate(ENEMY_HEADINGS, yaw, [...m.uv(reach, 0), 0]));
  const [sx, sy] = [x * DISPLAY_SCALE, y * DISPLAY_SCALE];
  return round(Math.hypot(sy + sx / 2, sy - sx / 2));
}

type Point2 = readonly [number, number];
const segmentDistance = ([px, py]: Point2, [ax, ay]: Point2, [bx, by]: Point2) => {
  const [ex, ey] = [bx - ax, by - ay];
  const t = Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey)));
  return Math.hypot(px - ax - t * ex, py - ay - t * ey);
};

// Per heading, the drawn tip in frame px and the nose distance in world units. Fails unless each
// tip lies within 0.5 frame px of an edge of a face the heading's frame draws.
function noses(craft: m.StoryCraft, frame: number) {
  const centre = frame / 2;
  const { reach, tip } = noseTip(craft);
  return Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => {
    const point = anchor(ENEMY_HEADINGS, centre, yaw, tip);
    const gap = Math.min(
      ...headingFaces(craft, yaw).flatMap(({ points }) => {
        const drawn = points.map((p) => projectAt(centre, centre, p));
        return drawn.map((p, i) => segmentDistance(point, p, drawn[(i + 1) % drawn.length]!));
      }),
    );
    if (gap > 0.5) {
      throw new Error(`${craft.name}-${yaw} nose is ${gap.toFixed(2)} frame px off the hull`);
    }
    return { distance: noseDistance(reach, yaw), tip: point };
  });
}

// The civil story-craft jets, shared with Cartwheel's story craft.
const civilJets = {
  outer: ["#c9a978", "#ffe9b8"] as [string, string],
  core: ["#efe4cf", "#ffffff"] as [string, string],
};

function writeCraft(craft: m.StoryCraft) {
  const frame = craftFrame(craft);
  const centre = frame / 2;
  const square: Layout = { halfWidth: centre, above: centre, width: frame, height: frame };
  for (let yaw = 0; yaw < ENEMY_HEADINGS; yaw++) {
    writeFileSync(
      `${output}${craft.name}-${yaw}.svg`,
      svgFile(`${craft.title} ${yaw}`, square, headingFaces(craft, yaw)),
    );
  }
  const half = craft.mouthWidth / 2;
  writeFileSync(
    `${output}${craft.name}-jets.json`,
    jetsFile(
      frame,
      (yaw) =>
        craft.mouths.map(([u, v, z]) => ({
          anchor: anchor(ENEMY_HEADINGS, centre, yaw, [...m.uv(u, v), z]),
          axis: vector(ENEMY_HEADINGS, yaw, [0, 1, 0]),
          half: vector(ENEMY_HEADINGS, yaw, [-half, 0, 0]),
        })),
      civilJets,
      { nose: noses(craft, frame) },
    ),
  );
  const display = round(frame * DISPLAY_SCALE);
  return Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => ({
    id: `craft-${craft.name}-${yaw}`,
    path: `${PATH}${craft.name}-${yaw}.svg`,
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

// Story craft follow the drones, before the portraits.
replaceEntries(
  "andromeda",
  (id) => /^craft-pip-\d+$/.test(id),
  writeCraft(m.pip),
  (id) => id.includes("portrait"),
);
