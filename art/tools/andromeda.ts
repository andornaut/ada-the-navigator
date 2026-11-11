// Andromeda's destinations and story craft: the settlers' station, the settlements, the guide
// beacons, Pip's mail scooter and the two project world changes. Usage: node art/tools/andromeda.ts
// writes public/art/andromeda/ and replaces its own entries in place in Andromeda's manifest.
// Contract: art/andromeda.md.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import * as m from "./andromeda-models.ts";
import { replaceEntries } from "./manifest.ts";
import { type Point, projectAt, round } from "./projection.ts";
import { along, BLINK_MS, DISPLAY_SCALE, DOCK, type Face, type Part, polygons } from "./solid.ts";

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

// A blink pair, frame A lit and frame B the other phase.
function pair(id: string, file: string, title: string, build: (lit: boolean) => Part[][]): Fixed[] {
  return (["a", "b"] as const).map((letter) => ({
    id: `${id}-${letter}`,
    file: `${file}-${letter}`,
    title: `${title} ${letter.toUpperCase()}`,
    faces: polygons(build(letter === "a")),
  }));
}

const allFaces = (items: readonly Fixed[]) => items.flatMap(({ faces }) => faces);

mkdirSync(output, { recursive: true });

// ---------------------------------------------------------------- settlers' station

// Every Andromeda station draws this pair in place of the trading station, with its live dock.
const station = pair("station-settlers", "settlers-station", "Settlers' station", m.station);
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
