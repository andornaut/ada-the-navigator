// Whirlpool's own station, entered by Use: the Eddy, a pale teal ramp that spirals in and up to a
// tower, as a whirlpool's eddy, with salvaged debris plates on the tower's skirt and current
// chevrons on the ramp that light in sequence, flowing inward. Four frames; no dock. Contract:
// art/whirlpool.md (Station).
// Usage: node art/tools/whirlpool-station.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { contrast } from "@andornaut/art-kit/colour";

import { replaceEntries } from "./manifest.ts";
import { layout, placed, svgFile } from "./needle-common.ts";
import { round } from "./projection.ts";
import {
  along,
  blue,
  blueDim,
  box,
  closedCollar,
  cream,
  creamSide,
  DESTINATION_SCALE,
  DISPLAY_SCALE,
  DOCK,
  facing,
  ngon,
  orientedBox,
  type Part,
  type Plan,
  polygons,
  wallWindows,
  warm,
} from "./solid.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const OUT = `${art}whirlpool/`;
const PATH = "/art/whirlpool/";

// Four frames of 350 ms: the beacon and windows lit on 0 and 1 and dim on 2 and 3 (the
// station's 700 ms blink), while the chevron chase moves one step inward per frame.
const FRAMES = 4;
const FRAME_MS = 350;

const C = {
  ramp: "#c8eef5",
  rampSide: "#7aa4ae",
  rampRear: "#6d8f97",
  tower: "#dff6fa",
  towerSide: "#a9cfd8",
  chevron: "#f7f2ff",
  chevronDim: "#5b8089",
  plate: "#5b8089",
  plateSide: "#3e636c",
  windowDim: "#a08f78",
  blueSide: "#5687ba",
  blueDimSide: "#33475f",
} as const;

// The spiral ramp: 30 segments over 1.3 turns, radius 66 to 24, 11 wide, rising from 3 to 16
// as it winds in, starting at 100 degrees in plan.
const RAMP = { segments: 30, turns: 1.3, outer: 66, inner: 24, width: 11, start: 100 };

function eddy(frame: number): Part[][] {
  const lit = frame < FRAMES / 2;
  const groups: Part[][] = [];
  const at = (t: number) => ({
    a: (RAMP.start * Math.PI) / 180 + t * RAMP.turns * 2 * Math.PI,
    r: RAMP.outer + (RAMP.inner - RAMP.outer) * t,
  });
  for (let i = 0; i < RAMP.segments; i++) {
    const [t0, t1] = [i / RAMP.segments, (i + 1) / RAMP.segments];
    const [p, q] = [at(t0), at(t1)];
    const edge = (s: { a: number; r: number }, offset: number) =>
      [(s.r + offset) * Math.cos(s.a), (s.r + offset) * Math.sin(s.a)] as const;
    const plan: Plan = [
      edge(p, RAMP.width / 2),
      edge(q, RAMP.width / 2),
      edge(q, -RAMP.width / 2),
      edge(p, -RAMP.width / 2),
    ];
    const z1 = 3 + 13 * t1;
    const part: Part[] = [{ plan, z0: 0, z1, top: C.ramp, side: C.rampSide, rear: C.rampRear }];
    // A chevron on every other segment pointing inward along the ramp; chevron k is lit on
    // frames where (k + frame) mod 4 is 0, so the lit chevrons step inward each frame.
    if (i % 2 === 1) {
      const m = at((t0 + t1) / 2);
      const [cx, cy] = [m.r * Math.cos(m.a), m.r * Math.sin(m.a)];
      const tangent = m.a + Math.PI / 2;
      const k = (i - 1) / 2;
      const colour = (k + frame) % FRAMES === 0 ? C.chevron : C.chevronDim;
      for (const side of [-1, 1]) {
        const [ox, oy] = along(tangent, -1.2, side * 2.2);
        part.push({
          plan: orientedBox(cx + ox, cy + oy, tangent + side * 0.7, 5, 1.6),
          z0: z1,
          z1: z1 + 0.6,
          top: colour,
          side: colour,
        });
      }
    }
    groups.push(part);
  }
  // Salvaged debris plates on the tower's skirt, in the river debris' field-matter tones.
  for (const degrees of [200, 250, 300]) {
    const a = (degrees * Math.PI) / 180;
    groups.push([
      {
        plan: orientedBox(21 * Math.cos(a), 21 * Math.sin(a), a + Math.PI / 2, 9, 2),
        z0: 2,
        z1: 9,
        top: C.plate,
        side: C.plateSide,
      },
    ]);
  }
  // The tower: a hexagon with two rows of warm windows, a cream cap, the mast and the beacon.
  const tower = ngon(6, 16, 0, 0, Math.PI / 6);
  const windows = lit ? warm : C.windowDim;
  groups.push([
    { plan: tower, z0: 0, z1: 28, top: C.tower, side: C.towerSide },
    ...wallWindows(facing, 11, 15, 2, 3, tower, windows),
    ...wallWindows(facing, 20, 24, 2, 3, tower, windows),
    { plan: ngon(6, 11, 0, 0, Math.PI / 6), z0: 28, z1: 32, top: cream, side: creamSide },
    { plan: box(-1.3, -1.3, 1.3, 1.3), z0: 32, z1: 42, top: C.tower, side: C.towerSide },
    {
      plan: box(-2.4, -2.4, 2.4, 2.4),
      z0: 42,
      z1: 45.5,
      top: lit ? blue : blueDim,
      side: lit ? C.blueSide : C.blueDimSide,
    },
  ]);
  // The arm toward the viewer ends in the station family's closed collar: no mouth.
  const [from, face] = [58, 86];
  const arm = orientedBox(...along(DOCK, (from + face - 4) / 2, 0), DOCK, face - 4 - from, 16);
  groups.push([
    { plan: arm, z0: 1, z1: 9, top: C.tower, side: C.towerSide },
    ...wallWindows(
      (nx, ny) => nx + ny > -0.2 && Math.abs(nx - ny) > 0.5,
      4.5,
      7.5,
      2,
      2.6,
      arm,
      windows,
    ),
    ...closedCollar(lit, face, 30, cream, creamSide, 13),
  ]);
  return groups;
}

// Whirlpool's floor: the body and every lit lamp at 5:1 or more on the field.
const field = (
  JSON.parse(readFileSync(`${art}galaxies.json`, "utf8")) as {
    galaxies: Record<string, { colors: Record<string, string> }>;
  }
).galaxies.whirlpool!.colors.background!;
const ratio = (colour: string) => contrast(colour.slice(1), field.slice(1));
const FLOOR = { ramp: C.ramp, tower: C.tower, cream, chevron: C.chevron, warm, blue };
for (const [role, colour] of Object.entries(FLOOR)) {
  if (ratio(colour) < 5) {
    throw new Error(`whirlpool station ${role} ${colour} is ${ratio(colour).toFixed(2)}:1`);
  }
}

const frames = Array.from({ length: FRAMES }, (_, k) => polygons(eddy(k)));
const frame = layout(frames.flat());
const scale = DISPLAY_SCALE * DESTINATION_SCALE;
mkdirSync(OUT, { recursive: true });
const entries = frames.map((faces, k) => {
  writeFileSync(
    `${OUT}station-${k}.svg`,
    svgFile(
      `Whirlpool station ${k}`,
      frame.width,
      frame.height,
      placed(frame.halfWidth, frame.above, faces),
      DESTINATION_SCALE,
    ),
  );
  return {
    id: `whirlpool-station-${k}`,
    path: `${PATH}station-${k}.svg`,
    width: frame.width,
    height: frame.height,
    displayWidth: round(frame.width * scale),
    displayHeight: round(frame.height * scale),
    facing: "fixed",
    pivot: { x: 0.5, y: frame.above / frame.height },
    frameMs: FRAME_MS,
    destination: "station",
    frameIndex: k,
  };
});

// The station opens Whirlpool's manifest.
replaceEntries(
  "whirlpool",
  (id) => id.startsWith("whirlpool-station-"),
  entries,
  () => true,
);
console.log(
  `station frame ${frame.width} by ${frame.height}, pivot (${frame.halfWidth}, ${frame.above})`,
);
