import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { editManifest } from "./manifest.ts";
import { projectAt, round } from "./projection.ts";
import {
  BLINK_MS,
  blue,
  blueDim,
  box,
  cream,
  creamSide,
  DISPLAY_SCALE,
  DOCK,
  mouth,
  mouthInner,
  ngon,
  orientedBox,
  type Part,
  type Plan,
  polygons as draw,
  wallWindows,
  warm,
} from "./solid.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const PAD = 4;

const lavender = "#c4afcc";
const lavenderSide = "#8f7c9c";
const lavenderDark = "#6f5f7d";
const spoke = "#b5a2c0";
const hub = "#dccfe2";
const hubSide = "#a08cad";
const craneTop = "#d9cbb1";
const glass = "#7fd6cc";
const glassSide = "#4fa59d";
const glassCap = "#c4efe8";
const blueSide = "#5687ba";
const blueDimSide = "#33475f";

const R_IN = 54;
const R_OUT = 65;
const DOCK_FACE = 88;
const DOCK_MOUTH = 31;

// Groups draw far to near by their first part; parts inside a group keep list order.
function model(lit: boolean): Part[][] {
  const groups: Part[][] = [];
  const segments = 24;
  for (let i = 0; i < segments; i++) {
    const [a0, a1] = [(2 * Math.PI * i) / segments, (2 * Math.PI * (i + 1)) / segments];
    const plan: Plan = [
      [R_OUT * Math.cos(a0), R_OUT * Math.sin(a0)],
      [R_OUT * Math.cos(a1), R_OUT * Math.sin(a1)],
      [R_IN * Math.cos(a1), R_IN * Math.sin(a1)],
      [R_IN * Math.cos(a0), R_IN * Math.sin(a0)],
    ];
    const ring: Part[] = [{ plan, z0: 0, z1: 7, top: lavender, side: lavenderSide }];
    if (i % 2 === 0) {
      ring.push(...wallWindows((nx, ny) => nx + ny > 0.9, 2.5, 4.5, 1, 2.4, plan));
    }
    groups.push(ring);
  }

  // Four spokes on the screen diagonals, clear of the dock axis.
  for (const degrees of [0, 90, 180, 270]) {
    const a = (degrees * Math.PI) / 180;
    const mid = (21 + R_IN) / 2;
    const plan = orientedBox(mid * Math.cos(a), mid * Math.sin(a), a, R_IN - 21 + 2, 6);
    groups.push([{ plan, z0: 2, z1: 5.5, top: spoke, side: lavenderDark }]);
  }

  // Hub: tall octagon with windows, cream cap, mast and beacon.
  const facing = (nx: number, ny: number) => nx + ny > 0.3;
  const hubPlan = ngon(8, 23, 0, 0, Math.PI / 8);
  groups.push([
    { plan: hubPlan, z0: 0, z1: 18, top: hub, side: hubSide },
    ...wallWindows(facing, 9, 13, 2, 3.2, hubPlan),
    { plan: ngon(8, 13, 0, 0, Math.PI / 8), z0: 18, z1: 23, top: cream, side: creamSide },
    { plan: box(-1.3, -1.3, 1.3, 1.3), z0: 23, z1: 38, top: hub, side: hubSide },
    {
      plan: box(-2.4, -2.4, 2.4, 2.4),
      z0: 38,
      z1: 41.5,
      top: lit ? blue : blueDim,
      side: lit ? blueSide : blueDimSide,
    },
  ]);

  // Greenhouses: stepped glass domes on the ring.
  const ringMid = (R_IN + R_OUT) / 2;
  for (const degrees of [135, 315, 245]) {
    const a = (degrees * Math.PI) / 180;
    const [cx, cy] = [ringMid * Math.cos(a), ringMid * Math.sin(a)];
    groups.push([
      { plan: ngon(6, 10.5, cx, cy), z0: 7, z1: 9.5, top: lavender, side: lavenderSide },
      { plan: ngon(6, 9, cx, cy), z0: 9.5, z1: 15, top: glass, side: glassSide },
      { plan: ngon(6, 5, cx, cy), z0: 15, z1: 18, top: glassCap, side: glass },
    ]);
  }

  // Workshop: cream block with lit windows and a crane rail.
  const w = (205 * Math.PI) / 180;
  const [wx, wy] = [ringMid * Math.cos(w), ringMid * Math.sin(w)];
  const workshop = orientedBox(wx, wy, w + Math.PI / 2, 24, 15);
  groups.push([
    { plan: workshop, z0: 7, z1: 17, top: cream, side: creamSide },
    ...wallWindows(facing, 11, 14, 3, 2.6, workshop),
    {
      plan: orientedBox(wx, wy, w + Math.PI / 2, 24, 4),
      z0: 17,
      z1: 19,
      top: craneTop,
      side: creamSide,
    },
  ]);

  // Dock: arm toward the viewer, cream collar, dark mouth, lit floor and blue frame lights.
  const [ux, uy] = [Math.cos(DOCK), Math.sin(DOCK)];
  const [vx, vy] = [-uy, ux];
  const at = (distance: number, across: number) =>
    [ux * distance + vx * across, uy * distance + vy * across] as const;
  const armMid = (R_OUT - 2 + 80) / 2;
  const arm = orientedBox(...at(armMid, 0), DOCK, 80 - (R_OUT - 2), 20);
  const frameLight = lit ? blue : blueDim;
  groups.push([
    { plan: arm, z0: 1, z1: 11, top: hub, side: hubSide },
    ...wallWindows((nx, ny) => nx + ny > -0.2 && Math.abs(nx - ny) > 0.5, 5, 8, 2, 2.6, arm),
    { plan: orientedBox(...at(84, 0), DOCK, 8, 42), z0: -3, z1: 20, top: cream, side: creamSide },
    {
      plan: orientedBox(...at(DOCK_FACE + 0.3, 0), DOCK, 0.6, DOCK_MOUTH),
      z0: 0,
      z1: 16,
      top: mouth,
      side: mouth,
    },
    {
      plan: orientedBox(...at(DOCK_FACE + 0.6, 0), DOCK, 0.6, 22),
      z0: 3.5,
      z1: 12.5,
      top: mouthInner,
      side: mouthInner,
    },
    {
      plan: orientedBox(...at(DOCK_FACE + 0.9, 0), DOCK, 0.6, 24),
      z0: 0.6,
      z1: 2.2,
      top: warm,
      side: warm,
    },
    ...[-1, 1].flatMap((side) =>
      [1.5, 14.5].map((z): Part => ({
        plan: orientedBox(...at(DOCK_FACE + 0.9, side * 18.5), DOCK, 1.4, 3.6),
        z0: z - 1.8,
        z1: z + 1.8,
        top: frameLight,
        side: frameLight,
      })),
    ),
  ]);

  // Approach-light pairs in front of the mouth blink opposite the frame lights.
  const approach = lit ? blueDim : blue;
  groups.push(
    [
      [102, 10],
      [118, 7],
    ].flatMap(([distance, across]) =>
      [-1, 1].map((side): Part => {
        const [lx, ly] = at(distance!, side * across!);
        return {
          plan: box(lx - 2, ly - 2, lx + 2, ly + 2),
          z0: 5,
          z1: 7.5,
          top: approach,
          side: approach,
        };
      }),
    ),
  );
  return groups;
}

const polygons = (lit: boolean) => draw(model(lit));

// Frame bounds over both blink frames, with the pivot (hub base) on the vertical centre line.
const all = [...polygons(true), ...polygons(false)].flatMap(({ points }) => points);
const xs = all.map((point) => projectAt(0, 0, point)[0]);
const ys = all.map((point) => projectAt(0, 0, point)[1]);
const halfWidth = Math.ceil(Math.max(-Math.min(...xs), Math.max(...xs)) + PAD);
const above = Math.ceil(-Math.min(...ys) + PAD);
const width = halfWidth * 2;
// Extra rows below keep the normalized pivot an exact five-decimal value.
let height = above + Math.ceil(Math.max(...ys) + PAD);
while ((above * 100000) % height !== 0) {
  height++;
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

// Dock entrance: the mouth's centre on the z = 0 plane, opening toward screen-down.
const [entranceX, entranceY] = projectAt(halfWidth, above, [
  Math.cos(DOCK) * DOCK_FACE,
  Math.sin(DOCK) * DOCK_FACE,
  0,
]);
const dock = {
  x: round(entranceX),
  y: round(entranceY),
  outward: [0, 1],
  width: round((DOCK_MOUTH * Math.sqrt(3)) / Math.SQRT2),
};

const entries = (["a", "b"] as const).map((frame) => ({
  id: `station-${frame}`,
  path: `/art/station-${frame}.svg`,
  width,
  height,
  displayWidth: round(width * DISPLAY_SCALE),
  displayHeight: round(height * DISPLAY_SCALE),
  facing: "fixed",
  pivot: { x: 0.5, y: above / height },
  frameMs: BLINK_MS,
  dock,
}));

for (const frame of ["a", "b"] as const) {
  writeFileSync(`${art}station-${frame}.svg`, svg(frame));
}

// Station entries sit before the discovery cache and the enemy entries.
editManifest("core", (manifest) => {
  const kept = manifest.assets.filter(({ id }) => !id.startsWith("station-"));
  const later = kept.findIndex(({ id }) => id === "discovery-cache" || id.startsWith("enemy-"));
  const insert = later === -1 ? kept.length : later;
  manifest.assets = [...kept.slice(0, insert), ...entries, ...kept.slice(insert)];
});
