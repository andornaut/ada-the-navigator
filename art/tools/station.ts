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
  ngon,
  orientedBox,
  orientedPlan,
  type Part,
  type Plan,
  polygons as draw,
  wallWindows,
  warm,
} from "./solid.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const sand = { top: "#dac69b", side: "#9a815f" };
const insetSand = { top: "#c5b086", side: "#9a815f" };
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

const front = (x: number, y: number) => x + y > 0.55;

// Paired open arcs with wide deck sectors and a single light on every other segment.
function habitat(start: number, end: number, floor: number, lit: boolean): Part[][] {
  const groups: Part[][] = [];
  for (let segment = start; segment < end; segment += 15) {
    const index = (segment - start) / 15;
    const plan = arc(segment, segment + 15, 48, 65);
    groups.push([
      { plan, z0: floor - 3, z1: floor, ...dark },
      { plan, z0: floor, z1: floor + 9, ...dark },
      {
        plan: arc(segment, segment + 15, 49.4, 63.3),
        z0: floor + 9,
        z1: floor + 9,
        ...(Math.floor(index / 2) % 2 ? insetSand : sand),
      },
      ...(index % 2 === 0
        ? wallWindows(front, floor + 2, floor + 5, 1, 4.4, plan, lit ? warm : "#998968")
        : []),
    ]);
  }
  return groups;
}

function model(lit: boolean): Part[][] {
  const groups = [...habitat(60, 210, 10, lit), ...habitat(245, 380, 3, lit)];

  // Identical spars in mirrored pairs around the station's forward axis.
  for (const degrees of [92, 178, 272, 358]) {
    const [x, y] = at(degrees, 36);
    const z = degrees < 200 ? 9 : 4;
    groups.push([
      { plan: orientedBox(x, y, angle(degrees), 32, 6), z0: z - 4, z1: z, ...frameMetal },
    ]);
  }

  const base = ngon(6, 23, 0, 0, Math.PI / 6);
  const lid = ngon(6, 18, 0, 0, Math.PI / 6);
  groups.push([
    { plan: base, z0: 0, z1: 19, ...dark },
    { plan: lid, z0: 19, z1: 29, ...ivory },
    ...wallWindows(front, 22, 25.5, 1, 6.4, lid, lit ? warm : creamSide),
    { plan: ngon(6, 8, 0, 0, Math.PI / 6), z0: 29, z1: 35, ...sand },
    { plan: orientedBox(-2, 4, angle(45), 3.2, 3.2), z0: 35, z1: 49, ...frameMetal },
    {
      plan: ngon(6, 2.7, -2, 4),
      z0: 49,
      z1: 52,
      top: lit ? blue : blueDim,
      side: lit ? "#57888b" : dark.side,
    },
  ]);

  // Matched rear end caps follow the same axis as the ring supports.
  const endCap = (plan: Plan) => orientedPlan(...at(201, 55), angle(201), plan);
  const cap = endCap([
    [-8, -12],
    [4.5, -12],
    [4.5, 0.75],
    [-8, 0.75],
  ]);
  const plating = endCap([
    [-6.6, -10.6],
    [3.1, -10.6],
    [3.1, -0.65],
    [-6.6, -0.65],
  ]);
  const mirror = (plan: Plan): Plan => plan.map(([x, y]) => [y, x]);
  for (const [shell, plate, floor] of [
    [cap, plating, 18],
    [mirror(cap), mirror(plating), 12],
  ] as const) {
    groups.push([
      { plan: shell, z0: floor, z1: 27.2, ...dark },
      { plan: plate, z0: 27.2, z1: 27.2, ...sand },
    ]);
  }

  // The outboard end stays sealed within its existing reach.
  const outboard = orientedBox(...at(317, 70), angle(317), 11, 18);
  groups.push([
    { plan: orientedBox(...at(317, 65), angle(317), 20, 4), z0: 2, z1: 6, ...frameMetal },
    { plan: outboard, z0: 4, z1: 11, ...dark },
    { plan: orientedBox(...at(317, 70), angle(317), 8, 15), z0: 11, z1: 14, ...sand },
    { plan: orientedBox(...at(317, 74), angle(317), 4, 12), z0: 14, z1: 15, ...ivory },
  ]);

  const nose = orientedPlan(...at(45, 39), angle(45), [
    [-17, -7],
    [10, -8],
    [17, -4],
    [17, 5],
    [9, 8],
    [-17, 7],
  ]);
  groups.push([
    { plan: nose, z0: 2, z1: 10, ...dark },
    { plan: nose, z0: 10, z1: 16, ...sand },
    { plan: orientedBox(...at(45, 43), angle(45), 14, 4), z0: 16, z1: 18, ...ivory },
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
