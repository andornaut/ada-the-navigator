// The Weavers' station and its Loom hall replacement frames. Contract: art/needle.md.
// Usage: node art/tools/needle-station.ts
import { mkdirSync, writeFileSync } from "node:fs";

import { replaceEntries } from "./manifest.ts";
import { svgText } from "./svg-text.ts";
import {
  blueDimSide,
  blueSide,
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
  rose,
  silver,
  silverSide,
  steel,
  steelSide,
  svgFile,
} from "./needle-common.ts";
import { round } from "./projection.ts";
import {
  along,
  BLINK_MS,
  blue,
  blueDim,
  box,
  DESTINATION_SCALE,
  DISPLAY_SCALE,
  dockCollar,
  type Face,
  faces,
  ngon,
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
const HABITAT_LIFT = 11;

function hull(plan: Plan, z0: number, z1: number, top: string, side: string): Part {
  return { plan: orientedPlan(0, 0, RIGHT, plan), z0, z1, top, side };
}

function sparBrace(): Face[] {
  const brace = hull(box(8, -4, 15, 4), -18, 22 + HABITAT_LIFT, silver, steelSide);
  // Lean the upper attachment 30 units left of the spar attachment.
  return faces(brace, ([x, y, z]) => {
    const rise = (z - brace.z0) / (brace.z1 - brace.z0);
    const [dx, dy] = along(RIGHT, -30 * rise, 0);
    return [x + dx, y + dy, z];
  });
}

function habitat(): Part[] {
  const shell = hull(
    [
      [-110, -4],
      [-78, -21],
      [7, -25],
      [43, -14],
      [58, 0],
      [42, 10],
      [-42, 17],
      [-90, 12],
    ],
    22,
    36,
    pearl,
    pearlSide,
  );

  const upperHull = [
    shell,
    hull(
      [
        [-101, -4],
        [-75, -18],
        [8, -22],
        [39, -12],
        [51, -1],
        [39, 1],
        [5, -10],
        [-73, -8],
      ],
      36,
      39,
      lav,
      lavSide,
    ),
    hull(
      [
        [-82, 1],
        [-47, -6],
        [7, -8],
        [43, 2],
        [37, 7],
        [-45, 14],
      ],
      36,
      39,
      glass,
      glassSide,
    ),
    ...wallWindows((nx, ny) => nx + ny > 1.3, 27, 29.4, 5, 4, shell.plan),
    ...[-60, -43, -26, -9, 8, 25].map((u) =>
      hull(
        [
          [u - 4, 1],
          [u + 4, 0],
          [u + 6, 2],
          [u - 3, 4],
        ],
        39,
        39.8,
        rose,
        lavSide,
      ),
    ),
  ];
  return upperHull.map((part) => ({
    ...part,
    z0: part.z0 + HABITAT_LIFT,
    z1: part.z1 + HABITAT_LIFT,
  }));
}

// A swept thermal blade cantilevers above the left approach and leaves the berth plane clear.
function thermalBlade(): Part[] {
  return [
    hull(
      [
        [-185, -11],
        [-162, -22],
        [-105, -30],
        [-62, -26],
        [-54, -19],
        [-91, -16],
        [-148, -8],
        [-174, -6],
      ],
      33,
      42,
      steel,
      steelSide,
    ),
    hull(
      [
        [-176, -11],
        [-159, -19],
        [-106, -27],
        [-74, -23],
        [-105, -21],
        [-151, -13],
      ],
      42,
      44,
      lav,
      lavSide,
    ),
    ...[-159, -144, -129, -114, -99].map((u, i) => {
      const v = -16 - i * 2.1;
      return hull(
        [
          [u - 2, v - 2],
          [u + 2, v - 2],
          [u + 5, v + 2],
          [u + 1, v + 2],
        ],
        44,
        45.4,
        glass,
        glassSide,
      );
    }),
  ];
}

function loomHall(): Part[] {
  // An enlarged glazed chamber interlocks with the right-hand spine.
  const chamber = hull(
    [
      [46, -3],
      [56, -22],
      [78, -26],
      [100, -16],
      [108, -1],
      [98, 11],
      [72, 14],
      [55, 9],
    ],
    5,
    20,
    glass,
    glassSide,
  );
  return [
    chamber,
    ...wallWindows((nx, ny) => nx + ny > 1.2, 10, 13, 3, 3.8, chamber.plan),
    ...[55, 73, 91].map((u) =>
      hull(
        [
          [u - 5, -15],
          [u + 2, -19],
          [u + 14, 6],
          [u + 7, 11],
        ],
        19,
        23,
        lav,
        lavSide,
      ),
    ),
    hull(
      [
        [92, -23],
        [112, -26],
        [125, -22],
        [128, -16],
        [111, -15],
        [98, -12],
      ],
      17,
      24,
      steel,
      steelSide,
    ),
    hull(box(108, -22, 121, -19), 24, 25, pearl, pearlSide),
  ];
}

function beacon(lit: boolean): Part[] {
  const [x, y] = along(RIGHT, -66, 0);
  return [
    {
      plan: ngon(6, 6, x, y),
      z0: 39 + HABITAT_LIFT,
      z1: 49 + HABITAT_LIFT,
      top: steel,
      side: steelSide,
    },
    {
      plan: ngon(6, 2.2, x, y),
      z0: 49 + HABITAT_LIFT,
      z1: 78 + HABITAT_LIFT,
      top: silver,
      side: silverSide,
    },
    {
      plan: box(x - 2.2, y - 2.2, x + 2.2, y + 2.2),
      z0: 78 + HABITAT_LIFT,
      z1: 81.4 + HABITAT_LIFT,
      top: lit ? blue : blueDim,
      side: lit ? blueSide : blueDimSide,
    },
  ];
}

function berth(lit: boolean, angle: number, face: number, shoulder: number): Part[] {
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
  // Fair the collar into the spine and leave the mouth plane and lights in their original places.
  const half = (BERTH_WIDTH + 8) / 2;
  return [
    {
      ...collar!,
      plan: orientedPlan(0, 0, angle, [
        [face - 23, -7],
        [face - 12, -12 + shoulder],
        [face, -half],
        [face, half],
        [face - 12, 12 + shoulder],
        [face - 23, 7],
      ]),
      z1: 12,
    },
    ...mouth,
  ];
}

function station(lit: boolean, hall: boolean): Face[] {
  const [left, right] = BERTHS[hall ? "hall" : "base"];
  const parts: Part[] = [
    // An offset spar leaves open space between its length and the upper hull.
    hull(
      [
        [-6, -8],
        [14, -10],
        [49, 10],
        [43, 15],
        [35, 14],
        [2, 2],
      ],
      -23,
      -14,
      steel,
      steelSide,
    ),
    hull(
      [
        [21, -6],
        [42, 8],
        [37, 10],
        [17, -2],
      ],
      -14,
      -12.5,
      lav,
      lavSide,
    ),
    // The working mouths are recessed into the ends of the structure.
    hull(
      [
        [-122, -8],
        [-70, -11],
        [right[1] - 8, -5],
        [right[1] - 8, 5],
        [-64, 9],
        [-122, 8],
      ],
      12,
      17,
      steel,
      steelSide,
    ),
    ...(hall ? loomHall() : []),
    ...berth(lit, ...left, -3),
    ...berth(lit, ...right, 3),
    ...thermalBlade(),
    hull(box(-91, -13, -67, -1), 14, 34, steel, steelSide),
    ...habitat(),
    ...beacon(lit),
  ];
  return [...sparBrace(), ...polygons([parts])];
}

const variants = { base: false, hall: true } as const;

mkdirSync(OUT, { recursive: true });
const entries = Object.entries(variants).flatMap(([variant, hall]) => {
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
    writeFileSync(
      `${OUT}${name}-${letter}.svg`,
      svgText(svgFile(title, frame.width, frame.height, artwork, DESTINATION_SCALE)),
    );
    return {
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
    };
  });
});

// The station opens Needle's manifest.
replaceEntries(
  "needle",
  (id) => id.startsWith("needle-station-"),
  entries,
  () => true,
);
console.log(
  `station frame ${frame.width} by ${frame.height}, pivot (${frame.halfWidth}, ${frame.above})`,
);
