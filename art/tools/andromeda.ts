// Andromeda's destinations and story craft: the settlers' station, the settlements, the guide
// beacons, Pip's mail scooter and the two project world changes. Usage: node art/tools/andromeda.ts
// writes public/art/andromeda/ and replaces its own entries in place in Andromeda's manifest.
// Contract: art/andromeda.md.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import * as m from "./andromeda-models.ts";
import { jetsFile } from "./crafts.ts";
import { replaceEntries } from "./manifest.ts";
import { noses } from "./nose.ts";
import { writeProjects } from "./projects.ts";
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
  DESTINATION_SCALE,
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

// SVG at its display size (frame * DISPLAY_SCALE * scale) with the viewBox in frame px, as
// Cartwheel's art.
function svgFile(title: string, frame: Layout, faces: readonly Face[], scale = 1): string {
  const shapes = faces.map(({ color, points }) => {
    const projected = points.map((point) => {
      const [x, y] = frameXY(frame, point);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return `  <polygon fill="${color}" points="${projected.join(" ")}"/>`;
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(frame.width * DISPLAY_SCALE * scale)}" height="${round(frame.height * DISPLAY_SCALE * scale)}" viewBox="0 0 ${frame.width} ${frame.height}">`,
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

// Every fixed asset here is a destination or a change to one, drawn at the destination scale.
function writeFixed(frame: Layout, item: Fixed) {
  writeFileSync(
    `${output}${item.file}.svg`,
    svgFile(item.title, frame, item.faces, DESTINATION_SCALE),
  );
}

function fixedEntry(frame: Layout, item: Fixed, extra: Record<string, unknown>, blink = true) {
  return {
    id: item.id,
    path: `${PATH}${item.file}.svg`,
    width: frame.width,
    height: frame.height,
    displayWidth: round(frame.width * DISPLAY_SCALE * DESTINATION_SCALE),
    displayHeight: round(frame.height * DISPLAY_SCALE * DESTINATION_SCALE),
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
const stationEntries = station.map((item) =>
  fixedEntry(stationFrame, item, { station: "settlers" }),
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
      { nose: noses((yaw) => headingFaces(craft, yaw), frame, craft) },
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

// Pip's scooter is also a Phantom finale ally, so its frames are shared art in core. Andromeda's
// manifest drops them first, so no id is ever in both.
const isPip = (id: string) => /^craft-pip-\d+$/.test(id);
replaceEntries("andromeda", isPip, []);
replaceEntries("core", isPip, writeCraft(m.pip));

// ---------------------------------------------------------------- world changes

// Screen outlines of two convex faces overlap with positive area (separating axis test).
function overlaps(p: Face, q: Face): boolean {
  const outline = (face: Face) => face.points.map((point) => projectAt(0, 0, point));
  const [pa, pb] = [outline(p), outline(q)];
  for (const poly of [pa, pb]) {
    for (const [i, [x0, y0]] of poly.entries()) {
      const [x1, y1] = poly[(i + 1) % poly.length]!;
      const [nx, ny] = [y0 - y1, x1 - x0];
      if (Math.hypot(nx, ny) < 1e-9) continue;
      const span = (points: [number, number][]) => points.map(([x, y]) => x * nx + y * ny);
      const [sa, sb] = [span(pa), span(pb)];
      if (Math.max(...sa) <= Math.min(...sb) + 1e-6 || Math.max(...sb) <= Math.min(...sa) + 1e-6) {
        return false;
      }
    }
  }
  return true;
}

// An overlay must draw the same pixels in either layer as one depth sort with its base: the
// generator fails if any overlay face, placed at its site, overlaps any base face on screen.
function checkClear(
  name: string,
  base: readonly Face[],
  overlay: Part[][],
  [sx, sy]: Point2,
  levels: readonly number[] = [],
) {
  const placed = polygons(
    overlay.map((group) => group.map((part) => shiftPart(sx, sy, part))),
    undefined,
    levels,
  );
  for (const face of placed) {
    if (base.some((under) => overlaps(under, face))) {
      throw new Error(`${name} overlaps its base`);
    }
  }
}
const shiftPart = (dx: number, dy: number, part: Part): Part => ({
  ...part,
  plan: part.plan.map(([x, y]) => [x + dx, y + dy] as const),
});

// An overlay anchor: the overlay pivot (its site on the world plane) from the base pivot, frame px.
function siteAnchor([sx, sy]: Point2, layer: "behind" | "front", phase: 0 | 1) {
  const [x, y] = projectAt(0, 0, [sx, sy, 0]);
  return { x: round(x), y: round(y), layer, phase };
}

// Courier school: an overlay pair beside the settlers' station, with one berth at its pier.
for (const lit of [true, false])
  checkClear(
    "courier school",
    polygons(m.station(lit), undefined, m.STATION_LEVELS),
    m.courierSchool(lit),
    m.SCHOOL.site,
    m.SCHOOL_LEVELS,
  );
const school = pair(
  "station-settlers-school",
  "settlers-school",
  "Courier school",
  m.courierSchool,
  m.SCHOOL_LEVELS,
);
const schoolFrame = layout(allFaces(school));
for (const item of school) writeFixed(schoolFrame, item);
const schoolBerth = dockAt(schoolFrame, m.SCHOOL.pierFace, m.SCHOOL.mouth, m.SCHOOL.across);
const schoolEntries = school.map((item) =>
  fixedEntry(schoolFrame, item, {
    overlay: true,
    station: "settlers",
    project: "courierSchool",
    berths: [schoolBerth],
  }),
);
replaceEntries(
  "andromeda",
  (id) => /^station-settlers-school-[ab]$/.test(id),
  schoolEntries,
  (id) => id.startsWith("outpost-"),
);

// Spare beacon: an overlay pair beside the relit beacon.
for (const lit of [true, false])
  checkClear("spare beacon", polygons(m.beacon("relit", lit)), m.spareBeacon(lit), m.SPARE_SITE);
const spare = pair("beacon-guide-spare", "beacon-spare", "Spare guide beacon", m.spareBeacon);
const spareFrame = layout(allFaces(spare));
for (const item of spare) writeFixed(spareFrame, item);
const spareEntries = spare.map((item) =>
  fixedEntry(spareFrame, item, { overlay: true, beacon: "guide", project: "spareBeacon" }),
);
replaceEntries(
  "andromeda",
  (id) => /^beacon-guide-spare-[ab]$/.test(id),
  spareEntries,
  (id) => /^(enemy-|craft-|andromeda-haze)|portrait/.test(id),
);

// Both sit behind their base: their sites are farther from the viewer than the base pivot.
writeProjects({
  courierSchool: {
    station: "settlers",
    kind: "overlay",
    frames: school.map(({ id }) => id),
    anchors: [siteAnchor(m.SCHOOL.site, "behind", 0)],
  },
  spareBeacon: {
    beacon: "guide",
    state: "relit",
    kind: "overlay",
    frames: spare.map(({ id }) => id),
    anchors: [siteAnchor(m.SPARE_SITE, "behind", 0)],
  },
});
