import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { replaceEntries } from "./manifest.ts";
import { SVG_DECIMALS, svgText } from "./svg-text.ts";
import { projectAt, round } from "./projection.ts";
import {
  BLINK_MS,
  blue,
  blueDim,
  creamSide,
  DESTINATION_SCALE,
  DISPLAY_SCALE,
  orientedBox,
  type Part,
  type Plan,
  polygons as draw,
  wallWindows,
  warm,
} from "./solid.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const sand = { top: "#dac69b", side: "#9a815f" };
const ivory = { top: "#ebd8ae", side: "#aa9370" };
const frameMetal = { top: "#59646a", side: "#35434b" };
const dark = { top: "#3d494f", side: "#2c373d" };

const angle = (degrees: number) => (degrees * Math.PI) / 180;

function at(degrees: number, radius: number): readonly [number, number] {
  const a = angle(degrees);
  return [Math.cos(a) * radius, Math.sin(a) * radius];
}

function arc(start: number, end: number, inner: number, outer: number): Plan {
  return [at(start, outer), at(end, outer), at(end, inner), at(start, inner)];
}

const FORWARD = 45;
const GAP = 36;
const PITCH = 18;
const SECTORS = 8;
const RING_OUTER = 70.55;
const RING_INNER = 51.5;
const RING_FLOOR = 5.79;
const RING_DECK = 16.8;
const CAP_RADIUS = 61;
const CAP_TOP = 21.71;

const front = (x: number, y: number) => x + y > 0.9;

// Each sector has one equally spaced lamp on the outside face. The dark seams
// between pairs of sectors divide each arc into four equal deck panels.
function habitat(start: number, lit: boolean): Part[][] {
  return Array.from({ length: SECTORS }, (_, index) => {
    const first = start + index * PITCH;
    const last = first + PITCH;
    const mid = (first + last) / 2;
    const [nx, ny] = at(mid, 1);
    const plan = arc(first, last, RING_INNER, RING_OUTER);
    return [
      { plan, z0: RING_FLOOR, z1: RING_DECK, ...dark },
      {
        plan: arc(
          first + (index % 2 === 0 ? 0.8 : 0),
          last - (index % 2 === 1 ? 0.8 : 0),
          RING_INNER + 1.5,
          RING_OUTER - 1.7,
        ),
        z0: RING_DECK,
        z1: RING_DECK,
        ...sand,
      },
      ...wallWindows((x, y) => x * nx + y * ny > 0.96, 9, 12, 1, 4.4, plan, lit ? warm : "#998968"),
    ];
  });
}

function model(lit: boolean): Part[][] {
  const first = FORWARD + GAP / 2;
  const arcs = [first, first + 180];
  const groups = arcs.flatMap((start) => habitat(start, lit));

  // Two identical rectangular caps on each opposing arc.
  for (const start of arcs) {
    for (const index of [0, SECTORS - 1]) {
      const degrees = start + (index + 0.5) * PITCH;
      const [x, y] = at(degrees, CAP_RADIUS);
      groups.push([
        { plan: orientedBox(x, y, angle(degrees), 12, 12), z0: RING_DECK, z1: CAP_TOP, ...dark },
        { plan: orientedBox(x, y, angle(degrees), 9, 9), z0: CAP_TOP, z1: CAP_TOP, ...sand },
      ]);
    }
  }

  // One crossbar per quadrant. All four use the same height, cross-section and radius.
  for (const degrees of [90, 180, 270, 360]) {
    groups.push([
      {
        plan: orientedBox(...at(degrees, 37), angle(degrees), 36, 5),
        z0: 7,
        z1: 11,
        ...frameMetal,
      },
    ]);
  }

  const core = (along: number, across: number) => orientedBox(0, 0, angle(FORWARD), along, across);
  const plate = core(24, 29);
  groups.push([
    { plan: core(32, 35), z0: 0, z1: 18, ...dark },
    { plan: plate, z0: 18, z1: 28, ...ivory },
    ...wallWindows(front, 21, 25, 2, 4.4, plate, lit ? warm : creamSide),
    { plan: core(11, 11), z0: 28, z1: 32, ...sand },
    { plan: core(3, 3), z0: 32, z1: 47, ...frameMetal },
    {
      plan: core(4.4, 4.4),
      z0: 47,
      z1: 50,
      top: lit ? blue : blueDim,
      side: lit ? "#57888b" : dark.side,
    },
  ]);

  return groups;
}

const MODEL_SCALE = 1.15 * 1.25;
const polygons = (lit: boolean) =>
  draw(model(lit)).map(({ color, points }) => ({
    color,
    points: points.map(([x, y, z]) => [x * MODEL_SCALE, y * MODEL_SCALE, z * MODEL_SCALE] as const),
  }));

// A larger frame encloses the new structure around the same world anchor.
const width = 280;
const height = 220;
const halfWidth = width / 2;
const above = 99;
for (const { points } of [...polygons(true), ...polygons(false)]) {
  for (const point of points) {
    const [x, y] = projectAt(halfWidth, above, point);
    if (x < 2 || x > width - 2 || y < 2 || y > height - 2) {
      throw new Error(`Sunflower station geometry exceeds its safe frame at ${x}, ${y}`);
    }
  }
}

function svg(frame: "a" | "b"): string {
  const shapes = polygons(frame === "a").map(({ color, points }) => {
    const projected = points.map((point) => {
      const [x, y] = projectAt(halfWidth, above, point);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return `  <polygon fill="${color}" points="${projected.join(" ")}"/>`;
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `  <title>Station ${frame.toUpperCase()}</title>`,
    ...shapes,
    "</svg>",
    "",
  ].join("\n");
}

const entries = (["a", "b"] as const).map((frame) => ({
  id: `station-${frame}`,
  path: `/art/station-${frame}.svg`,
  width,
  height,
  displayWidth: round(width * DISPLAY_SCALE * DESTINATION_SCALE),
  displayHeight: round(height * DISPLAY_SCALE * DESTINATION_SCALE),
  facing: "fixed",
  pivot: { x: 0.5, y: above / height },
  frameMs: BLINK_MS,
}));

for (const frame of ["a", "b"] as const) {
  writeFileSync(`${art}station-${frame}.svg`, svgText(svg(frame), SVG_DECIMALS.station));
}

// Station entries keep their place; without any, they go before the discovery cache and the
// enemy entries.
replaceEntries(
  "core",
  (id) => id.startsWith("station-"),
  entries,
  (id) => id === "discovery-cache" || id.startsWith("enemy-"),
);
