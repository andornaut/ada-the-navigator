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
const armour = { top: "#829fb7", side: "#43596f" };
const frameMetal = { top: "#afc4d0", side: "#647b90" };
const hull = { top: "#c9d5dc", side: "#738d9d" };
const dark = { top: "#52677f", side: "#343f55" };
const copper = { top: "#ca916f", side: "#895d58" };
const cyan = { top: "#7fd6cc", side: "#4fa59d" };
const angle = (degrees: number) => (degrees * Math.PI) / 180;

function at(degrees: number, radius: number): readonly [number, number] {
  const a = angle(degrees);
  return [Math.cos(a) * radius, Math.sin(a) * radius];
}

function arc(start: number, end: number, inner: number, outer: number): Plan {
  return [at(start, outer), at(end, outer), at(end, inner), at(start, inner)];
}

// Split habitat arcs. The open sectors expose their trusses and leave two clear gaps.
function habitat(start: number, end: number, raised: boolean): Part[][] {
  const groups: Part[][] = [];
  const floor = raised ? 10 : 3;
  for (let segment = start; segment < end; segment += 15) {
    const plan = arc(segment, segment + 15, 48, 65);
    const joint = segment === start || segment + 15 === end;
    groups.push([
      { plan, z0: floor - 3, z1: floor, ...dark },
      { plan, z0: floor, z1: floor + 8, ...(joint ? copper : armour) },
      ...wallWindows((x, y) => x + y > 0.45, floor + 2, floor + 5, 2, 2, plan),
      { plan: arc(segment + 1, segment + 14, 50, 57), z0: floor + 8, z1: floor + 9, ...frameMetal },
    ]);
  }
  return groups;
}

function model(lit: boolean): Part[][] {
  const groups = [...habitat(60, 210, true), ...habitat(245, 380, false)];

  // Four skinny diagonal ribs tie the half rings to the hub and leave the centre open.
  for (const degrees of [86, 172, 260, 344]) {
    const [x, y] = at(degrees, 36);
    const a = angle(degrees);
    const z = degrees < 200 ? 9 : 4;
    const plan = orientedBox(x, y, a, 32, 6);
    groups.push([
      { plan, z0: z - 4, z1: z, ...dark },
      { plan: orientedBox(x, y, a, 30, 2.4), z0: z, z1: z + 2, ...frameMetal },
    ]);
  }

  const facing = (x: number, y: number) => x + y > 0.4;
  const base = ngon(6, 23, 0, 0, Math.PI / 6);
  const head = orientedPlan(0, 0, angle(30), [
    [-18, -10],
    [11, -10],
    [20, -3],
    [17, 7],
    [-10, 11],
    [-18, 6],
  ]);
  groups.push([
    { plan: base, z0: 0, z1: 19, ...dark },
    ...wallWindows(facing, 8, 13, 2, 3, base, cyan.top),
    { plan: head, z0: 19, z1: 29, ...hull },
    ...wallWindows(facing, 22, 25, 3, 2.6, head, warm),
    { plan: ngon(6, 8, -2, 4, Math.PI / 6), z0: 29, z1: 35, ...armour },
    { plan: ngon(4, 2, -2, 4), z0: 35, z1: 49, ...frameMetal },
    {
      plan: ngon(6, 2.7, -2, 4),
      z0: 49,
      z1: 52,
      top: lit ? blue : blueDim,
      side: lit ? cyan.side : dark.side,
    },
  ]);

  // Three tapered, raised radiator pylons give the station a distinct skyline. They are sealed.
  for (const [heading, low, high] of [
    [102, 18, 37],
    [201, 18, 26],
    [286, 10, 32],
  ] as const) {
    const a = angle(heading);
    const [x, y] = at(heading, 55);
    const plan = orientedPlan(x, y, a, [
      [-7, -5],
      [7, -3],
      [9, 1],
      [2, 5],
      [-7, 3],
    ]);
    groups.push([
      { plan, z0: low, z1: high - 5, ...armour },
      { plan: orientedBox(x, y, a, 12, 3), z0: high - 5, z1: high, ...copper },
      { plan: orientedBox(x, y, a, 9, 1.5), z0: high, z1: high + 1.2, ...cyan },
    ]);
  }

  // Detached-looking utility pods are linked to the habitat by a narrow exposed truss.
  const [outX, outY] = at(317, 70);
  const [trussX, trussY] = at(317, 65);
  groups.push([
    { plan: orientedBox(trussX, trussY, angle(317), 20, 4), z0: 2, z1: 6, ...frameMetal },
    { plan: orientedBox(outX, outY, angle(317), 11, 18), z0: 4, z1: 11, ...dark },
    {
      plan: orientedBox(outX, outY, angle(317), 8, 15),
      z0: 11,
      z1: 14,
      ...hull,
    },
    {
      plan: orientedBox(...at(317, 74), angle(317), 4, 12),
      z0: 14,
      z1: 15,
      ...copper,
    },
  ]);

  // Sealed service module toward the viewer. The angled nose reads as hull plating.
  const module = orientedPlan(...at(45, 39), angle(45), [
    [-17, -7],
    [10, -8],
    [17, -4],
    [17, 5],
    [9, 8],
    [-17, 7],
  ]);
  groups.push([
    { plan: module, z0: 2, z1: 10, ...dark },
    { plan: module, z0: 10, z1: 16, ...hull },
    ...wallWindows(facing, 12, 14.5, 2, 2.6, module, lit ? warm : creamSide),
    { plan: orientedBox(...at(45, 43), angle(45), 14, 4), z0: 16, z1: 18, ...copper },
  ]);

  return groups;
}

const MODEL_SCALE = 1.15;
const polygons = (lit: boolean) =>
  draw(model(lit)).map(({ color, points }) => ({
    color,
    points: points.map(([x, y, z]) => [x * MODEL_SCALE, y * MODEL_SCALE, z * MODEL_SCALE] as const),
  }));

// A larger frame encloses the new structure around the same world anchor.
const width = 224;
const height = 180;
const halfWidth = width / 2;
const above = 81;
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
