// Andromeda's solid models in the station family's projection (solid.ts) and the story craft
// heading convention (crafts.ts): the settlers' station and its courier school, the settlements,
// the guide beacons and the spare beacon, and Pip's mail scooter. Contract: art/andromeda.md.
import { tiers } from "./cartwheel-craft.ts";
import {
  along,
  approachLights,
  blue,
  blueDim,
  box,
  cream,
  creamSide,
  DOCK,
  dockCollar,
  facing,
  ngon,
  orientedBox,
  orientedPlan,
  type Part,
  type Plan,
  wallWindows,
  warm,
} from "./solid.ts";

// ---------------------------------------------------------------- palette

export const andromeda = {
  pearl: "#e4e2ef",
  pearlSide: "#a9a6c2",
  pearlDark: "#7d7a9c",
  pearlInset: "#d6d3e6",
  roof: "#8d94c4",
  roofSide: "#5f6594",
  marker: "#b8c1ff",
  markerDim: "#8f9cf0",
  markerDark: "#6f78b8",
  markerDeep: "#4a5080",
  glassDark: "#2a2d48",
  glassDarkSide: "#22253c",
  white: "#ffffff",
  slate: "#8d9bb0",
  slateSide: "#6e7482",
  slateCap: "#b9c3d3",
  steelDark: "#6e7482",
  steelDarkSide: "#4f5462",
  scrape: "#cfcde0",
  warmDim: "#a08f78",
  creamRear: "#a08f78",
} as const;
const a = andromeda;

const cube = (x: number, y: number, z0: number, size: number, color: string): Part => ({
  plan: box(x - size / 2, y - size / 2, x + size / 2, y + size / 2),
  z0,
  z1: z0 + size,
  top: color,
  side: color,
});

const shift = (dx: number, dy: number, part: Part): Part => ({
  ...part,
  plan: part.plan.map(([x, y]) => [x + dx, y + dy] as const),
});

const degrees = (d: number) => (d * Math.PI) / 180;
const polar = (angle: number, r: number) => [Math.cos(angle) * r, Math.sin(angle) * r] as const;

// A cottage: cream walls with warm windows on facing walls and a two-step slate-blue roof.
function cottage(
  cx: number,
  cy: number,
  angle: number,
  length: number,
  width: number,
  z: number,
  height: number,
): Part[] {
  const walls = orientedBox(cx, cy, angle, length, width);
  return [
    { plan: walls, z0: z, z1: z + height, top: cream, side: creamSide },
    ...wallWindows(facing, z + height * 0.35, z + height * 0.7, 2, 2.4, walls),
    {
      plan: orientedBox(cx, cy, angle, length + 1.5, width + 1.5),
      z0: z + height,
      z1: z + height + 2,
      top: a.roof,
      side: a.roofSide,
    },
    {
      plan: orientedBox(cx, cy, angle, length + 1.5, width * 0.45),
      z0: z + height + 2,
      z1: z + height + 4,
      top: a.roof,
      side: a.roofSide,
    },
  ];
}

// A pearl float: a deck with a lighter inset top.
function float(n: number, r: number, height: number, cx = 0, cy = 0): Part[] {
  return [
    { plan: ngon(n, r, cx, cy, Math.PI / n), z0: 0, z1: height, top: a.pearl, side: a.pearlSide },
    {
      plan: ngon(n, r - 3, cx, cy, Math.PI / n),
      z0: height,
      z1: height + 0.6,
      top: a.pearlInset,
      side: a.pearlSide,
    },
  ];
}

// ---------------------------------------------------------------- settlers' station

// The live dock: mouth width and face distance on the dock axis, as on the trading station.
export const STATION = { deckR: 52, dockFace: 90, mouth: 30, collar: 42, height: 16 } as const;

// A lantern station: a pearl deck ringed by cottages, a striped lighthouse whose lantern carries
// the galaxy marker, a post depot, two tanks and the family dock arm toward the viewer.
export function station(lit: boolean): Part[][] {
  const groups: Part[][] = [];
  const { deckR } = STATION;
  groups.push([
    { plan: ngon(20, deckR, 0, 0, Math.PI / 20), z0: 0, z1: 6, top: a.pearl, side: a.pearlSide },
    {
      plan: ngon(20, deckR - 4, 0, 0, Math.PI / 20),
      z0: 6,
      z1: 7,
      top: a.pearlInset,
      side: a.pearlSide,
    },
  ]);
  // Warm rim lamps on every other segment of the facing rim.
  for (let i = 0; i < 20; i += 2) {
    const angle = (2 * Math.PI * (i + 0.5)) / 20;
    if (Math.cos(angle) + Math.sin(angle) < 0.2) continue;
    groups.push([cube(...polar(angle, deckR + 0.4), 2, 2.2, lit ? warm : a.warmDim)]);
  }
  // Cottages around the deck, clear of the dock axis.
  for (const d of [120, 165, 215, 260, 320, 0]) {
    const angle = degrees(d);
    groups.push(cottage(...polar(angle, 36), angle + Math.PI / 2, 15, 11, 7, 9));
  }
  // Post depot: a cream hall with a periwinkle sign band.
  const depot = degrees(285);
  const [px, py] = polar(depot, 20);
  const hall = orientedBox(px, py, depot + Math.PI / 2, 22, 13);
  groups.push([
    { plan: hall, z0: 7, z1: 19, top: cream, side: creamSide },
    ...wallWindows(facing, 10, 14, 3, 2.6, hall),
    {
      plan: orientedBox(px, py, depot + Math.PI / 2, 22.6, 13.6),
      z0: 15,
      z1: 17,
      top: a.markerDark,
      side: a.markerDark,
    },
    {
      plan: orientedBox(px, py, depot + Math.PI / 2, 22, 13),
      z0: 19,
      z1: 20,
      top: a.roof,
      side: a.roofSide,
    },
  ]);
  // Lighthouse: banded pearl tower, cream gallery, marker lantern, cap and blue mast beacon.
  const tower = ngon(12, 12.2, 0, 0, Math.PI / 12);
  groups.push([
    ...tiers(
      0,
      0,
      14,
      7,
      [
        [1, 0, 10],
        [0.93, 10, 16],
        [0.9, 16, 26],
        [0.86, 26, 32],
        [0.83, 32, 42],
      ],
      a.pearl,
      a.pearlSide,
      a.pearl,
      12,
    ),
    {
      plan: ngon(12, 13.4, 0, 0, Math.PI / 12),
      z0: 17,
      z1: 22,
      top: a.markerDark,
      side: a.markerDeep,
    },
    {
      plan: ngon(12, 12.4, 0, 0, Math.PI / 12),
      z0: 33,
      z1: 38,
      top: a.markerDark,
      side: a.markerDeep,
    },
    ...wallWindows(facing, 26.5, 30.5, 1, 2.6, tower),
    { plan: ngon(12, 16, 0, 0, Math.PI / 12), z0: 49, z1: 51, top: cream, side: creamSide },
    {
      plan: ngon(12, 8.5, 0, 0, Math.PI / 12),
      z0: 51,
      z1: 60,
      top: lit ? a.marker : a.markerDim,
      side: lit ? a.markerDim : a.markerDark,
    },
    ...(lit ? [cube(0, 0, 54, 4, a.white)] : []),
    { plan: ngon(12, 10.5, 0, 0, Math.PI / 12), z0: 60, z1: 62, top: a.roof, side: a.roofSide },
    { plan: ngon(12, 6, 0, 0, Math.PI / 12), z0: 62, z1: 65, top: a.roof, side: a.roofSide },
    { plan: box(-0.9, -0.9, 0.9, 0.9), z0: 65, z1: 72, top: a.slate, side: a.slateSide },
    cube(0, 0, 72, 3.4, lit ? blue : blueDim),
  ]);
  // Fuel tanks behind.
  for (const [d, r] of [
    [235, 44],
    [250, 30],
  ] as const) {
    groups.push(
      tiers(
        ...polar(degrees(d), r),
        6,
        7,
        [
          [0.8, 0, 1.5],
          [1, 1.5, 10],
          [0.75, 10, 12],
        ],
        a.slate,
        a.slateSide,
        a.slateCap,
        10,
      ),
    );
  }
  // Dock arm, collar, mouth, corner lights and approach lights.
  const at = (distance: number, across: number) => along(DOCK, distance, across);
  const arm = orientedBox(...at((deckR - 4 + 82) / 2, 0), DOCK, 82 - (deckR - 4), 20);
  groups.push([
    { plan: arm, z0: 1, z1: 11, top: a.pearl, side: a.pearlSide },
    ...wallWindows((nx, ny) => nx + ny > -0.2 && Math.abs(nx - ny) > 0.5, 5, 8, 2, 2.6, arm),
    ...dockCollar(
      lit,
      STATION.dockFace,
      STATION.mouth,
      STATION.collar,
      cream,
      creamSide,
      STATION.height,
    ),
  ]);
  groups.push(approachLights(lit, STATION.dockFace));
  return groups;
}

// ---------------------------------------------------------------- courier school

// Beside the station at the screen left: a training pad with a classroom, a short pier toward the
// viewer with its own narrow collar, and a slalom of four training buoys whose lamps alternate
// warm and marker. Plan positions are from the school's own pivot, the pad centre.
export const SCHOOL = {
  // The pad centre from the station's pivot, plan units.
  site: polar(degrees(150), 104),
  pierFace: 30,
  mouth: 16,
  collar: 22,
  height: 10,
  // The pier's sideways offset from the pad centre.
  across: 4,
} as const;

export function courierSchool(lit: boolean): Part[][] {
  const groups: Part[][] = [float(10, 19, 4)];
  groups.push(cottage(-5, -4, DOCK + Math.PI / 2, 14, 10, 4.6, 8));
  const pierAt = (distance: number, across: number) => along(DOCK, distance, across);
  const pier = orientedBox(...pierAt(22, SCHOOL.across), DOCK, 14, 11);
  groups.push([
    { plan: pier, z0: 1, z1: 7, top: a.pearl, side: a.pearlSide },
    ...dockCollar(
      lit,
      SCHOOL.pierFace,
      SCHOOL.mouth,
      SCHOOL.collar,
      cream,
      creamSide,
      SCHOOL.height,
      DOCK,
      SCHOOL.across,
    ),
  ]);
  for (const [k, [distance, across]] of (
    [
      [44, -14],
      [56, 2],
      [68, -14],
      [80, 2],
    ] as const
  ).entries()) {
    const [bx, by] = pierAt(distance, across);
    const on = (k % 2 === 0) === lit;
    groups.push([
      ...tiers(
        bx,
        by,
        3.2,
        0,
        [
          [1, 0, 2],
          [0.5, 2, 7],
        ],
        a.slate,
        a.slateSide,
        a.slate,
        8,
      ),
      cube(bx, by, 7, 2.6, on ? (k % 2 === 0 ? warm : a.marker) : a.markerDeep),
    ]);
  }
  return groups;
}

// ---------------------------------------------------------------- settlements

// Decorative docks, as on Sunflower's outposts: Ada uses a settlement without docking.
export const HAMLET_DOCK = { face: 34, mouth: 18, collar: 26, height: 10 } as const;
export const LAMPHOUSE_DOCK = { face: 30, mouth: 16, collar: 24, height: 10 } as const;

// Hamlet: three cottages on a round float, a marker lamp post and a small dock.
export function hamlet(lit: boolean): Part[][] {
  const groups: Part[][] = [float(12, 26, 5)];
  for (const [d, length, width, height] of [
    [200, 14, 10, 9],
    [275, 12, 10, 11],
    [345, 13, 9, 8],
  ] as const) {
    const angle = degrees(d);
    groups.push(cottage(...polar(angle, 12), angle + Math.PI / 2, length, width, 5.6, height));
  }
  const [lx, ly] = polar(2.2, 19);
  groups.push([
    {
      plan: box(lx - 0.9, ly - 0.9, lx + 0.9, ly + 0.9),
      z0: 5.6,
      z1: 20,
      top: a.slate,
      side: a.slateSide,
    },
    cube(lx, ly, 20, 3.4, lit ? a.marker : a.markerDeep),
  ]);
  const { collar, face, height, mouth } = HAMLET_DOCK;
  groups.push(dockCollar(lit, face, mouth, collar, cream, creamSide, height));
  return groups;
}

// Lamp house: a tall house with a rooftop marker lantern, a shed, a mailbox post and a small dock.
export function lampHouse(lit: boolean): Part[][] {
  const groups: Part[][] = [float(10, 22, 5)];
  const [hx, hy] = polar(degrees(250), 5);
  const walls = orientedBox(hx, hy, DOCK + Math.PI / 2, 15, 13);
  groups.push([
    { plan: walls, z0: 5.6, z1: 27, top: cream, side: creamSide },
    ...wallWindows(facing, 9, 12.5, 2, 2.4, walls),
    ...wallWindows(facing, 17, 20.5, 2, 2.4, walls),
    {
      plan: orientedBox(hx, hy, DOCK + Math.PI / 2, 16.5, 14.5),
      z0: 27,
      z1: 29,
      top: a.roof,
      side: a.roofSide,
    },
    {
      plan: orientedBox(hx, hy, DOCK + Math.PI / 2, 10, 9),
      z0: 29,
      z1: 31,
      top: a.roof,
      side: a.roofSide,
    },
    {
      plan: ngon(8, 3.6, hx, hy, Math.PI / 8),
      z0: 31,
      z1: 36,
      top: lit ? a.marker : a.markerDeep,
      side: lit ? a.markerDim : a.markerDeep,
    },
    { plan: ngon(8, 4.4, hx, hy, Math.PI / 8), z0: 36, z1: 37.5, top: a.roof, side: a.roofSide },
  ]);
  const shed = degrees(330);
  groups.push(cottage(...polar(shed, 13), shed + Math.PI / 2, 8, 7, 5.6, 6));
  const [mx, my] = polar(2.0, 15);
  groups.push([
    {
      plan: box(mx - 0.7, my - 0.7, mx + 0.7, my + 0.7),
      z0: 5.6,
      z1: 11,
      top: a.slate,
      side: a.slateSide,
    },
    {
      plan: box(mx - 2.2, my - 1.6, mx + 2.2, my + 1.6),
      z0: 11,
      z1: 14,
      top: a.markerDim,
      side: a.markerDark,
    },
  ]);
  const { collar, face, height, mouth } = LAMPHOUSE_DOCK;
  groups.push(dockCollar(lit, face, mouth, collar, cream, creamSide, height));
  return groups;
}

// ---------------------------------------------------------------- guide beacons

export type BeaconState = "lit" | "dented" | "relit";

// A guide beacon: a pearl float with three fins, a banded tower, a cream gallery, the marker
// lantern and a cap. `dented` is dark with the head knocked askew, the gallery caved in on the
// front, a crease and a scrape on the tower, never scorched. `relit` stands straight again with
// a cream patch plate over the crease. `bright` is blink frame A of a lit beacon.
export function beacon(state: BeaconState, bright: boolean): Part[][] {
  const lit = state !== "dented";
  const on = lit && bright;
  const glass = !lit ? a.glassDark : on ? a.marker : a.markerDim;
  const glassSide = !lit ? a.glassDarkSide : on ? a.markerDim : a.markerDark;
  const [dx, dy] = state === "dented" ? [2.2, -1.2] : [0, 0];
  const head = (k: number, part: Part) => shift(dx * k, dy * k, part);
  const ring = ngon(12, 8.4, 0, 0, Math.PI / 12);
  // The front of the gallery, toward the viewer, caves in.
  const gallery: Plan =
    state === "dented"
      ? ring.map(([x, y], i) => (i === 1 || i === 2 ? ([x * 0.62, y * 0.62] as const) : [x, y]))
      : ring;
  const groups: Part[][] = [100, 220, 340].map((d) => [
    {
      plan: orientedBox(...polar(degrees(d), 12), degrees(d), 9, 2.4),
      z0: 0.5,
      z1: 3.5,
      top: a.pearl,
      side: a.pearlSide,
    },
  ]);
  const front = Math.PI / 4 + Math.PI / 2;
  const tower: Part[] = [
    { plan: ngon(12, 9, 0, 0, Math.PI / 12), z0: 0, z1: 4, top: a.pearl, side: a.pearlSide },
    ...tiers(
      0,
      0,
      6,
      4,
      [
        [1, 0, 8],
        [0.9, 8, 16],
        [0.8, 16, 24],
      ],
      a.pearl,
      a.pearlSide,
      a.pearl,
      12,
    ),
    {
      plan: ngon(12, 5.7, 0, 0, Math.PI / 12),
      z0: 12,
      z1: 16,
      top: a.markerDark,
      side: a.markerDeep,
    },
  ];
  if (state === "dented") {
    tower.push(
      {
        plan: orientedBox(4.2, 2.6, front, 4.4, 0.6),
        z0: 6,
        z1: 11,
        top: a.pearlDark,
        side: a.pearlDark,
      },
      { plan: orientedBox(3, 4.4, front, 2.6, 0.6), z0: 17, z1: 19, top: a.scrape, side: a.scrape },
    );
  }
  if (state === "relit") {
    tower.push({
      plan: orientedBox(4.2, 2.6, front, 4.8, 0.7),
      z0: 5.5,
      z1: 11.5,
      top: cream,
      side: cream,
    });
  }
  groups.push(tower);
  groups.push([
    head(1, { plan: gallery, z0: 28, z1: 29.6, top: cream, side: creamSide }),
    head(1.6, {
      plan: ngon(8, 4.6, 0, 0, Math.PI / 8),
      z0: 29.6,
      z1: 37,
      top: glass,
      side: glassSide,
    }),
    ...(on ? [cube(0, 0, 31.5, 3, a.white)] : []),
    head(2.2, {
      plan: ngon(8, 5.6, 0, 0, Math.PI / 8),
      z0: 37,
      z1: 38.6,
      top: a.roof,
      side: a.roofSide,
    }),
    head(2.6, {
      plan: ngon(8, 2.6, 0, 0, Math.PI / 8),
      z0: 38.6,
      z1: 41,
      top: a.roof,
      side: a.roofSide,
    }),
  ]);
  return groups;
}

// ---------------------------------------------------------------- spare beacon

// The spare's cradle centre from the relit beacon's pivot, plan units: behind and to the left.
export const SPARE_SITE = [-34, 30] as const;

// A spare beacon held upright in a slate cradle on a small pad, its lantern on standby (a steady
// dim marker) beside a blue standby light that blinks. Plan positions are from the cradle centre.
export function spareBeacon(lit: boolean): Part[][] {
  return [
    [
      { plan: ngon(10, 12, 0, 0, Math.PI / 10), z0: 0, z1: 3, top: a.slate, side: a.slateSide },
      ...[-1, 1].map((s): Part => ({
        plan: orientedBox(s * 6, -s * 6, DOCK, 3, 3),
        z0: 3,
        z1: 14,
        top: a.slate,
        side: a.slateSide,
      })),
    ],
    [
      ...tiers(
        0,
        0,
        5,
        3,
        [
          [1, 0, 7],
          [0.9, 7, 14],
          [0.8, 14, 20],
        ],
        a.pearl,
        a.pearlSide,
        a.pearl,
        12,
      ),
      {
        plan: ngon(12, 4.75, 0, 0, Math.PI / 12),
        z0: 10,
        z1: 13,
        top: a.markerDark,
        side: a.markerDeep,
      },
      { plan: ngon(12, 7, 0, 0, Math.PI / 12), z0: 23, z1: 24.4, top: cream, side: creamSide },
      {
        plan: ngon(8, 3.8, 0, 0, Math.PI / 8),
        z0: 24.4,
        z1: 30.5,
        top: a.markerDark,
        side: a.markerDeep,
      },
      { plan: ngon(8, 4.7, 0, 0, Math.PI / 8), z0: 30.5, z1: 31.8, top: a.roof, side: a.roofSide },
      { plan: ngon(8, 2.2, 0, 0, Math.PI / 8), z0: 31.8, z1: 33.8, top: a.roof, side: a.roofSide },
    ],
    [cube(...along(DOCK, 11, 0), 3, 2.2, lit ? blue : blueDim)],
  ];
}

// ---------------------------------------------------------------- Pip's mail scooter

// Craft-local plans in (u forward, v across); forward is -y, as for every story craft.
const FWD = -Math.PI / 2;
export const uv = (u: number, v: number) => along(FWD, u, v);
const craftPlan = (local: Plan) => orientedPlan(0, 0, FWD, local);
const craftBox = (u: number, v: number, length: number, width: number) =>
  orientedBox(...uv(u, v), FWD, length, width);

export type StoryCraft = {
  name: string;
  title: string;
  build: (visible: (nx: number, ny: number) => boolean) => Part[][];
  // Heights parts rest on (hull top, then cab top): groups based there draw after those below.
  levels: readonly number[];
  // Jet mouths as (u, v, z) at the engine faces, all `mouthWidth` wide.
  mouths: readonly (readonly [number, number, number])[];
  mouthWidth: number;
};

// A short cream capsule with a warm-lit cab, two periwinkle mail panniers with cream flaps, a tail
// fin carrying the marker courier lamp, twin small engines and two warm headlights.
export const pip: StoryCraft = {
  name: "pip",
  title: "Pip's mail scooter",
  levels: [10, 14],
  mouthWidth: 3,
  mouths: [
    [-19, -4, 6.5],
    [-19, 4, 6.5],
  ],
  build: (visible) => {
    const hull = craftPlan([
      [-15, -6],
      [6, -7],
      [13, -5],
      [16, 0],
      [13, 5],
      [6, 7],
      [-15, 6],
    ]);
    const cab = craftPlan([
      [-1, -4.6],
      [8, -4.6],
      [11, 0],
      [8, 4.6],
      [-1, 4.6],
    ]);
    return [
      ...[-1, 1].map((s): Part[] => [
        {
          plan: craftBox(-3, s * 9.2, 15, 5),
          z0: 3.5,
          z1: 10.5,
          top: a.markerDim,
          side: a.markerDark,
          rear: a.markerDeep,
        },
        { plan: craftBox(1.5, s * 9.2, 4, 5.6), z0: 9, z1: 11, top: cream, side: creamSide },
      ]),
      ...[-1, 1].map((s): Part[] => [
        {
          plan: craftBox(-15.5, s * 4, 6, 4.6),
          z0: 4,
          z1: 9,
          top: a.steelDark,
          side: a.steelDarkSide,
        },
      ]),
      [
        { plan: hull, z0: 3, z1: 10, top: cream, side: creamSide, rear: a.creamRear },
        ...wallWindows(
          (nx, ny) => visible(nx, ny) && Math.abs(nx) > 0.9,
          5.5,
          8,
          1,
          3,
          hull,
          a.markerDark,
        ),
      ],
      [
        { plan: cab, z0: 10, z1: 14, top: cream, side: creamSide, rear: a.creamRear },
        ...wallWindows(visible, 10.8, 13.2, 1, 3.6, cab),
      ],
      [
        { plan: craftBox(-11, 0, 7, 1.6), z0: 10, z1: 18, top: a.markerDim, side: a.markerDark },
        { plan: craftBox(-12, 0, 2.6, 2.6), z0: 18, z1: 20.6, top: a.marker, side: a.marker },
      ],
      [-1, 1].map((s) => cube(...uv(14, s * 3.2), 5.5, 1.8, warm)),
    ];
  },
};
