// The Weavers' station and its Loom hall replacement frames. Contract: art/needle.md.
// Usage: node art/tools/needle-station.ts
import { mkdirSync } from "node:fs";

import { replaceEntries } from "./manifest.ts";
import { writeStationFrames } from "./primary-station-sheets.ts";
import { svgText } from "./svg-text.ts";
import {
  dockAt,
  glass,
  glassSide,
  lav,
  lavSide,
  type Layout,
  LEFT,
  OUT,
  pearl,
  pearlSide,
  placed,
  PUBLIC,
  RIGHT,
  silver,
  silverSide,
  steel,
  steelSide,
  svgFile,
} from "./needle-common.ts";
import { round } from "./projection.ts";
import {
  BLINK_MS,
  blue,
  blueDim,
  box,
  DESTINATION_SCALE,
  DISPLAY_SCALE,
  dockCollar,
  type Face,
  orientedPlan,
  type Part,
  type Plan,
  polygons,
  wallWindows,
} from "./solid.ts";

// Story-craft mouths on the world plane, measured from the fixed pivot.
const BERTH_WIDTH = 20;
const BERTHS = {
  base: [
    [LEFT, 130],
    [RIGHT, 74],
  ],
  hall: [
    [LEFT, 130],
    [RIGHT, 114],
  ],
} as const;

const frame: Layout = { width: 480, height: 160, halfWidth: 240, above: 110 };

function hull(plan: Plan, z0: number, z1: number, top: string, side: string): Part {
  return { plan: orientedPlan(0, 0, RIGHT, plan), z0, z1, top, side };
}

// Centred on the midpoint of the base berths. The funded right berth retains its longer reach.
const HABITAT_AXIS = -28;
const SUPPORT_OFFSET = 29;
const POD_OFFSET = 72;
const DECK_MARKER_PITCH = 10.4;

function panel(
  offset: number,
  length: number,
  width: number,
  z0: number,
  z1: number,
  top: string,
  side: string,
): Part {
  const u = HABITAT_AXIS + offset;
  return hull(box(u - length / 2, -width / 2, u + length / 2, width / 2), z0, z1, top, side);
}

function habitat(lit: boolean): Part[] {
  const shell = panel(0, 104, 54, 42, 54, steel, steelSide);
  // The two top equipment blocks sit inside a clearly visible deck plane.
  return [
    shell,
    panel(0, 84, 46, 54, 57, glass, glassSide),
    ...[-24, 24].map((offset) => panel(offset, 29, 32, 57, 60, lav, lavSide)),
    panel(0, 12, 19, 57, 62, pearl, pearlSide),
    panel(0, 5, 9, 62, 63, lit ? blue : blueDim, glassSide),
    ...Array.from({ length: 9 }, (_, index) => {
      const centre = HABITAT_AXIS + (index - 4) * DECK_MARKER_PITCH;
      const mark = lit ? blue : blueDim;
      return hull(box(centre - 1.8, 24, centre + 1.8, 27), 54, 54, mark, mark);
    }),
  ];
}

function sidePods(hall: boolean, lit: boolean): Part[] {
  return [-1, 1].flatMap((side) => {
    const offset = side * POD_OFFSET;
    const shell = panel(offset, 30, 37, 28, 49, steel, steelSide);
    return [
      panel(side * 53, 20, 10, 42, 46, pearl, pearlSide),
      shell,
      panel(offset, 27, 31, 49, 53, lav, lavSide),
      ...(hall
        ? [
            panel(offset, 25, 24, 53, 61, pearl, pearlSide),
            ...[-7, 0, 7].map((rib) =>
              panel(offset + rib, 3, 18, 61, 62, lit ? lav : glass, lavSide),
            ),
            ...wallWindows((nx, ny) => nx + ny > 1.4, 34, 37, 3, 3.5, shell.plan),
          ]
        : [panel(offset, 19, 21, 53, 55, glass, glassSide)]),
    ];
  });
}

function berth(lit: boolean, angle: number, face: number): Part[] {
  const [collar, ...mouth] = dockCollar(
    lit,
    face,
    BERTH_WIDTH,
    BERTH_WIDTH + 8,
    steel,
    steelSide,
    10,
    angle,
  );
  const half = (BERTH_WIDTH + 8) / 2;
  // The mirrored housings keep the existing mouth plane and contacts.
  return [
    { ...collar!, plan: orientedPlan(0, 0, angle, box(face - 18, -half, face, half)), z1: 12 },
    ...mouth,
  ];
}

function station(lit: boolean, hall: boolean): Face[] {
  const [left, right] = BERTHS[hall ? "hall" : "base"];
  const parts: Part[] = [
    // A straight common spine keeps both fixed approaches clear at their original planes.
    hull(box(-left[1] + 8, -6, right[1] - 8, 6), 0, 10, steel, steelSide),
    ...[-SUPPORT_OFFSET, SUPPORT_OFFSET].map((offset) =>
      panel(offset, 10, 14, 9, 43, silver, silverSide),
    ),
    ...[-POD_OFFSET, POD_OFFSET].map((offset) => panel(offset, 7, 12, 8, 31, steel, steelSide)),
    ...berth(lit, ...left),
    ...berth(lit, ...right),
    ...sidePods(hall, lit),
    ...habitat(lit),
  ];
  return polygons([parts]);
}

const variants = { base: false, hall: true } as const;

mkdirSync(OUT, { recursive: true });
const frames = Object.entries(variants).flatMap(([variant, hall]) => {
  const name = hall ? "station-hall" : "station";
  const berths = BERTHS[variant as keyof typeof BERTHS].map(([angle, face]) =>
    dockAt(frame, angle, face, BERTH_WIDTH),
  );
  return (["a", "b"] as const).map((letter) => {
    const artwork = placed(frame.halfWidth, frame.above, station(letter === "a", hall));
    for (const { points } of artwork) {
      if (points.some(([x, y]) => x < 4 || x > frame.width - 4 || y < 4 || y > frame.height - 4)) {
        throw new Error(`Needle station ${variant} exceeds its fixed frame`);
      }
    }
    const title = `Weavers' station${hall ? ", Loom hall" : ""} ${letter.toUpperCase()}`;
    return {
      root: svgText(svgFile(title, frame.width, frame.height, artwork, DESTINATION_SCALE)),
      entry: {
        id: `needle-${name}-${letter}`,
        path: `${PUBLIC}${name}-${letter}.svg`,
        width: frame.width,
        height: frame.height,
        displayWidth: round(frame.width * DISPLAY_SCALE * DESTINATION_SCALE),
        displayHeight: round(frame.height * DISPLAY_SCALE * DESTINATION_SCALE),
        facing: "fixed",
        pivot: { x: 0.5, y: frame.above / frame.height },
        frameMs: BLINK_MS,
        berths,
        destination: "station",
        variant: hall ? "loom-hall" : "base",
        ...(hall ? { project: "loomHall" } : {}),
      },
    };
  });
});

// The station opens Needle's manifest.
replaceEntries(
  "needle",
  (id) => id.startsWith("needle-station-"),
  writeStationFrames("needle", OUT, PUBLIC, 2, frames),
  () => true,
);
console.log(
  `station frame ${frame.width} by ${frame.height}, pivot (${frame.halfWidth}, ${frame.above})`,
);
