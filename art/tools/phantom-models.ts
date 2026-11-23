// Blurb settlements in the shared Phantom projection. Contract in art/phantom.md.
import { depth, facesViewer, type Point } from "./projection.ts";
import { along, DOCK, type Face } from "./solid.ts";

export type DockState = "cracked" | "mended";

// The sealed plating retains the decorative dock's world-plane anchor and span.
export const SETTLEMENT_DOCK = { face: 36, mouth: 18 } as const;

type Palette = readonly [light: string, plane: string, shadow: string];
type Section = readonly [x: number, y: number, z: number, major: number, minor: number];
type Axis = "horizontal" | "vertical";

const PEARL: Palette = ["#c4a7dc", "#a487be", "#694f8d"];
const IRIS: Palette = ["#a9b2ed", "#7d89c7", "#4e5794"];
const PLUM: Palette = ["#d9a5cb", "#a876a7", "#694c7e"];
const JADE: Palette = ["#8bd8c6", "#54aeaa", "#356e80"];
const CERULEAN: Palette = ["#92c9db", "#589fb6", "#3e688c"];

const point = ([x, y, z]: Point): Point => [...along(DOCK, y, -x), z];

function surface(points: Point[], color: string): Face {
  return { points: points.map(point), color };
}

function facingFaces(
  [p, q, r, s]: [Point, Point, Point, Point],
  palette: Palette,
  balancedLight: boolean,
): Face[] {
  const a = point(p);
  const b = point(q);
  const c = point(r);
  const d = point(s);
  const points = [a, b, c, d];
  if (!facesViewer(points)) return [];
  // The face diagonals also give a normal at a collapsed end ring.
  const u: Point = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const v: Point = [d[0] - b[0], d[1] - b[1], d[2] - b[2]];
  const normal = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ] as const;
  const [xLight, yLight] = balancedLight ? [0.1, 0.1] : [-0.25, 0.45];
  const light = (xLight * normal[0] + yLight * normal[1] + normal[2]) / Math.hypot(...normal);
  const color = palette[light > 0.6 ? 0 : light > 0.12 ? 1 : 2];
  return [{ color, points }];
}

// Each sculpted shell follows a sequence of elliptical rings, which can lean or flare.
function shell(
  sections: readonly Section[],
  axis: Axis,
  palette: Palette,
  balancedLight = false,
): Face[] {
  const sides = 8;
  const rings = sections.map(([x, y, z, major, minor]) =>
    Array.from({ length: sides }, (_, i): Point => {
      const angle = ((i + 0.5) * 2 * Math.PI) / sides;
      const u = major * Math.cos(angle);
      const v = minor * Math.sin(angle);
      return axis === "vertical" ? [x + u, y + v, z] : [x, y + u, z + v];
    }),
  );
  return rings
    .slice(0, -1)
    .flatMap((ring, j) =>
      ring.flatMap((a, i) => {
        const k = (i + 1) % sides;
        const next = rings[j + 1]!;
        return facingFaces([a, ring[k]!, next[k]!, next[i]!], palette, balancedLight);
      }),
    )
    .sort((a, b) => depth(b.points) - depth(a.points));
}

// Existing inset facets stay in the shell with the surrounding material finish.
function inset(x: number, y: number, z: number, color: string): Face {
  return surface(
    [
      [x - 4.5, y, z - 2],
      [x - 1.3, y - 1, z + 2.7],
      [x + 5, y, z + 2.1],
      [x + 1.6, y + 1, z - 2.5],
    ],
    color,
  );
}

function faceLamp(x: number, y: number, z: number, lit: boolean): Face {
  return surface(
    [
      [x - 2, y, z - 1.5],
      [x + 2, y, z - 1.5],
      [x + 2, y, z + 1.5],
      [x - 2, y, z + 1.5],
    ],
    lit ? "#c3e7e7" : "#53618c",
  );
}

function standardSeam(state: DockState): Face[] {
  const cracked = state === "cracked";
  return [
    surface(
      [
        [cracked ? 13 : 14, 32, cracked ? 7 : 12],
        [7, 34, 10],
        [4, 35, 5],
        [0, 36, 6],
        [-6, 35, 0],
        [1, 37, 3],
        [8, 36, 2.5],
        [10, 35, 6.5],
      ],
      cracked ? "#302842" : "#c8e5d9",
    ),
  ];
}

function pronouncedSeam(state: DockState): Face[] {
  if (state === "cracked") {
    const dark = "#302842";
    return [
      surface(
        [
          [13, 32, 8],
          [7, 34, 10],
          [3, 35, 5],
          [7, 36, 2],
          [9, 35, 6],
        ],
        dark,
      ),
      surface(
        [
          [0, 35, 7],
          [-5, 34, 8],
          [-12, 32, 3],
          [-8, 34, 1],
          [-3, 36, 3],
        ],
        dark,
      ),
    ];
  }

  const outline = surface(
    [
      [15, 31, 13],
      [7, 33, 13],
      [2, 35, 7],
      [-4, 34, 9],
      [-14, 32, 3],
      [-10, 33, 0],
      [-4, 36, 4],
      [3, 37, 3],
      [9, 35, 7],
      [15, 33, 8],
    ],
    "#53618c",
  );
  const seal = surface(
    [
      [13, 32, 12],
      [8, 34, 11.5],
      [2, 36, 6],
      [-4, 35, 7.5],
      [-12, 33, 2.5],
      [-10, 34, 1.5],
      [-4, 36, 5.5],
      [3, 37, 4.5],
      [9, 35, 9],
      [13, 33, 10],
    ],
    "#c8e5d9",
  );
  return [outline, seal];
}

// Fused into the foreground shell, at the old dock face. Pigment and flush lamps read
// through a repaired fracture, while the cracked side has a missing flake and a dead lamp.
function repairPlate(
  palette: Palette,
  lit: boolean,
  state: DockState,
  seam = standardSeam,
): Face[] {
  const cracked = state === "cracked";
  const edge: Point = cracked ? [12, 31, 5] : [17, 30, 13];
  return [
    surface(
      [
        [-22, 18, 8],
        [-11, 31, 0],
        [3, 36, -1],
        [cracked ? 15 : 18, 31, 2],
        [22, 20, 8],
        edge,
        [-5, 26, 14],
      ],
      palette[1],
    ),
    surface([[-22, 18, 8], [-5, 26, 14], edge, [3, 36, 9], [-11, 31, 6]], palette[0]),
    inset(-12, 33, 4, palette[1]),
    inset(13, 33, 3, palette[1]),
    ...seam(state),
    ...[-7.5, 7.5].map((x) => faceLamp(x, 29, 10, lit)),
  ];
}

export function homes(lit: boolean, state: DockState): Face[] {
  const pods = [
    { x: -22, palette: PLUM },
    { x: 0, palette: PEARL },
    { x: 22, palette: IRIS },
  ];
  return [
    ...shell(
      [
        [1, 10, -6, 1, 1],
        [0, 9, -3, 30, 23],
        [1, 6, 4, 28, 24],
        [-1, 4, 9, 20, 17],
        [0, 4, 10, 0, 0],
      ],
      "vertical",
      IRIS,
    ),
    ...pods.flatMap(({ x, palette }) =>
      shell(
        [
          [x, -6, 1, 9.4, 10.5],
          [x, -7, 8, 9.8, 11.5],
          [x, -8, 17, 8, 8.5],
          [x, -9, 22, 4, 4],
          [x, -9, 22, 0, 0],
        ],
        "vertical",
        palette,
        true,
      ),
    ),
    ...shell(
      [
        [5, 15, 1, 14, 12],
        [3, 13, 8, 14, 13],
        [4, 11, 14, 11, 9],
        [9, 10, 21, 0, 0],
      ],
      "vertical",
      IRIS,
    ),
    ...pods.map(({ x }) => faceLamp(x, -1, 15, lit)),
    ...repairPlate(IRIS, lit, state, pronouncedSeam),
  ];
}

export function harbour(lit: boolean, state: DockState): Face[] {
  const starboard: readonly Section[] = [
    [8, 6, 7, 18, 7],
    [20, 3, 8.5, 17, 5],
    [31, -2, 11, 12, 3],
    [40, -10, 14, 0, 0],
  ];
  const port = starboard
    .toReversed()
    .map(([x, y, z, major, minor]): Section => [-x, y, z, major, minor]);
  return [
    ...shell([...port, ...starboard], "horizontal", JADE, true),
    ...shell(
      [
        [0, 7, -4, 9, 20],
        [1, 3, 1, 16, 23],
        [1, -1, 8, 14, 22],
        [-1, -3, 15, 8, 15],
        [-6, -6, 19, 0, 0],
      ],
      "vertical",
      CERULEAN,
    ),
    ...[-24, 24].map((x) => faceLamp(x, 8, 11, lit)),
    ...repairPlate(JADE, lit, state),
  ];
}

export function signal(lit: boolean, state: DockState): Face[] {
  return [
    ...shell(
      [
        [0, 18, -4, 1, 1],
        [0, 16, 0, 22, 18],
        [-2, 10, 6, 20, 20],
        [1, 5, 12, 13, 14],
        [0, 5, 15, 0, 0],
      ],
      "vertical",
      PLUM,
    ),
    ...shell(
      [
        [4, 2, 2, 10, 12],
        [5, 0, 10, 12, 13],
        [2, -3, 20, 10, 9],
        [-5, -5, 28, 7, 7],
        [-10, -6, 37, 5, 5],
        [-10, -7, 43, 0, 0],
      ],
      "vertical",
      PLUM,
    ),
    ...shell(
      [
        [10, 4, 4, 8, 11],
        [13, 3, 11, 8, 9],
        [17, 1, 19, 7, 6],
        [18, 0, 28, 4, 4],
        [14, -1, 37, 1.6, 1.5],
        [7, -2, 43, 0, 0],
      ],
      "vertical",
      IRIS,
    ),
    ...shell(
      [
        [-1, 1, 26, 0, 0],
        [1, 1, 31, 5, 4],
        [0, 0, 37, 6, 5],
        [0, -1, 43, 3.5, 3],
        [2, -2, 46, 0, 0],
      ],
      "vertical",
      lit ? JADE : CERULEAN,
    ),
    inset(1, 5, 36, (lit ? JADE : CERULEAN)[0]),
    ...repairPlate(PLUM, lit, state, pronouncedSeam),
  ];
}
