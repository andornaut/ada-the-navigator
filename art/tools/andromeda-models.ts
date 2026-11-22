// Andromeda's solid models in the station family's projection (solid.ts) and the story craft
// heading convention (crafts.ts): the settlers' station and its courier school, the settlements,
// the guide beacons and the spare beacon, and Pip's mail scooter. Contract: art/andromeda.md.
import { tiers } from "./cartwheel-craft.ts";
import { ball, craftBox, cube as hsCube, disc, hcyl, part, scaleGroups } from "./hull-shapes.ts";
import {
  along,
  blue,
  blueDim,
  box,
  cream,
  creamSide,
  DOCK,
  closedCollar,
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

const alloy = ["#d5e1eb", "#758ba8"] as const;
const truss = ["#8096af", "#425775"] as const;
const ice = ["#7cc5e5", "#3d719b"] as const;
const coral = ["#ef9f8e", "#a85b60"] as const;
const cells = ["#335c96", "#243f67"] as const;
const orbitalBox = (distance: number, across: number, length: number, width: number) =>
  orientedBox(...along(DOCK, distance, across), DOCK, length, width);

// The cross-truss carries separate solar leaves, with the bus visible through the gaps.
function solarLeaf(distance: number, across: number, length: number, width: number, z: number) {
  return [
    part(orbitalBox(distance, across, length, width), z, z + 1.3, ...truss),
    ...[-1, 0, 1].map((row) =>
      part(
        orbitalBox(distance + (row * length) / 3, across, length / 3 - 0.8, width - 1.3),
        z + 1.3,
        z + 1.7,
        ...cells,
      ),
    ),
  ];
}

// Chamfered pressure modules with warm observation windows and a coloured equipment casing.
function habitat(
  distance: number,
  across: number,
  length: number,
  width: number,
  z: number,
  height: number,
  casing: readonly [string, string],
): Part[] {
  const u = length / 2;
  const v = width / 2;
  const walls = orientedPlan(...along(DOCK, distance, across), DOCK, [
    [-u, -v + 3],
    [-u + 3, -v],
    [u - 3, -v],
    [u, -v + 3],
    [u, v - 3],
    [u - 3, v],
    [-u + 3, v],
    [-u, v - 3],
  ]);
  return [
    part(walls, z, z + height, ...alloy),
    ...wallWindows(facing, z + 3, z + 6, 2, 2.8, walls),
    part(
      orbitalBox(distance, across, length - 5, width - 5),
      z + height,
      z + height + 2,
      ...casing,
    ),
  ];
}

export const SCHOOL_LEVELS = [4.6] as const;

const STATION_APPROACH = 90;

// An occupied orbital complex with a cross-truss, a raised concourse and a sealed service spur.
export function station(lit: boolean): Part[][] {
  const groups: Part[][] = [
    [
      part(orbitalBox(0, 0, 3, 126), 3, 7, ...truss),
      part(orbitalBox(-5, 0, 2, 126), 5, 8, ...alloy),
      part(orbitalBox(5, 0, 2, 126), 5, 8, ...alloy),
    ],
    [
      part(orbitalBox(8, 0, 86, 24), 0, 10, ...truss),
      part(orbitalBox(-15, 0, 44, 32), 9, 14, ...alloy),
    ],
    [
      part(orbitalBox(-23, -20, 8, 29), 6, 11, ...truss),
      part(orbitalBox(-25, -17, 8, 16), 17, 21, ...alloy),
      ...habitat(-23, -30, 22, 19, 11, 13, coral),
      part(orbitalBox(-25, -36, 3, 3), 26, 37, ...truss),
      part(orbitalBox(-25, -24, 3, 3), 26, 37, ...truss),
      part(orbitalBox(-25, -30, 4, 17), 36, 39, ...alloy),
      part(orbitalBox(-23, -30, 1, 9), 38, 43, ...ice),
    ],
    habitat(-19, 0, 32, 25, 14, 20, ice),
    habitat(18, 22, 29, 24, 8, 14, coral),
    habitat(21, -23, 37, 24, 8, 17, ice),
    habitat(29, 0, 24, 22, 10, 10, coral),
  ];
  for (const side of [-1, 1]) {
    const across = side * 54;
    groups.push(
      [
        part(orbitalBox(-4, across, 60, 3), 6, 9, ...alloy),
        ...solarLeaf(-21, across - side, 26, 20, 9),
        ...solarLeaf(17, across - side, 18, 20, 9),
      ],
      [cube(...along(DOCK, 5, side * 61), 7, 3.8, lit ? blue : blueDim)],
    );
  }

  const boom = orientedPlan(0, 0, DOCK, [
    [46, -12],
    [55, -13],
    [76, -7],
    [85, -7],
    [85, 7],
    [76, 7],
    [55, 13],
    [46, 12],
  ]);
  const foot = orientedPlan(...along(DOCK, STATION_APPROACH, 0), DOCK, [
    [-7, -8],
    [-5, -13],
    [-3, -13],
    [0, -8],
    [0, 8],
    [-3, 13],
    [-5, 13],
    [-7, 8],
  ]);
  groups.push([
    part(boom, 1, 9, ...truss),
    part(orbitalBox(65, 0, 29, 6), 9, 11, ...ice),
    part(foot, -2, 10, ...alloy),
    part(orbitalBox(STATION_APPROACH - 2, 0, 2, 10), 10, 11, lit ? warm : a.creamRear, a.creamRear),
  ]);
  groups.push([
    part(orbitalBox(-24, 0, 4, 4), 36, 47, ...truss),
    part(orbitalBox(-24, 0, 4, 17), 46, 49, ...alloy),
    cube(...along(DOCK, -24, 0), 49, 4, lit ? blue : blueDim),
  ]);
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

// Hamlet is a compact habitation cluster with a coral utility spine and a single solar bank.
export function hamlet(lit: boolean): Part[][] {
  const { collar, face, height } = HAMLET_DOCK;
  return [
    [part(orbitalBox(0, 0, 8, 52), 1, 5, ...truss), part(orbitalBox(5, 0, 50, 13), 1, 6, ...alloy)],
    solarLeaf(-10, -20, 20, 16, 5),
    habitat(0, 2, 24, 17, 6, 14, coral),
    habitat(4, 17, 22, 18, 5, 11, coral),
    habitat(10, -14, 16, 15, 5, 9, ice),
    [
      part(orbitalBox(-6, 21, 10, 3), 5, 7, ...alloy),
      part(orbitalBox(-6, 21, 6, 1.3), 7, 7.5, ...ice),
    ],
    [
      ...closedCollar(lit, face, collar, ...alloy, height),
      part(orbitalBox(face - 4, 0, 6, 15), height + 4, height + 6, ...coral),
    ],
  ];
}

// Lamp House is a tall relay satellite with offset solar leaves and an elevated antenna array.
export function lampHouse(lit: boolean): Part[][] {
  const { collar, face, height } = LAMPHOUSE_DOCK;
  return [
    [
      part(orbitalBox(-4, 0, 7, 40), 2, 7, ...truss),
      part(orbitalBox(3, 3, 39, 13), 0, 8, ...alloy),
    ],
    solarLeaf(-10, -15, 24, 13, 7),
    solarLeaf(8, -15, 10, 13, 7),
    habitat(-6, 6, 23, 19, 8, 12, ice),
    [
      part(orbitalBox(-5, 6, 5, 5), 22, 37, ...truss),
      part(orbitalBox(-5, 4, 5, 26), 32, 38, ...alloy),
      ...[-4, 4, 12].map((across) => part(orbitalBox(-2, across, 1, 6), 33, 37, ...ice)),
      part(orbitalBox(-3, 4, 2, 20), 38, 38.65, ...truss),
      cube(...along(DOCK, -3, 4), 38, 2.2, lit ? a.marker : a.markerDeep),
    ],
    [
      ...closedCollar(lit, face, collar, ...alloy, height),
      part(orbitalBox(face - 4, 0, 6, 11), height + 4, height + 6, ...coral),
    ],
  ];
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

// A pod scooter: a round cream cab pod with warm bow panes and headlights between two periwinkle
// pannier pods on short struts, twin small engines astern and the marker courier lamp on a mast
// over the cab; no fin or wings. Design units, built at PIP_SCALE.
const PIP_SCALE = 1.5;
const capCream = "#f7f0e2";
const podCap = "#a9b3f4";
export const pip: StoryCraft = {
  name: "pip",
  title: "Pip's mail scooter",
  levels: [13 * PIP_SCALE],
  mouthWidth: 2.6 * PIP_SCALE,
  mouths: (
    [
      [-11.6, -2.6, 5.4],
      [-11.6, 2.6, 5.4],
    ] as const
  ).map(([u, v, z]) => [u * PIP_SCALE, v * PIP_SCALE, z * PIP_SCALE] as const),
  build: () => {
    const engine = {
      top: a.steelDark,
      side: a.steelDarkSide,
      front: "flat",
      back: "flat",
    } as const;
    return scaleGroups(PIP_SCALE, [
      ...[-1, 1].map((s) => hcyl(-11, -5, s * 2.6, 5.4, 1.9, engine)),
      ...[-1, 1].map((s) => [part(craftBox(-1, s * 6.5, 2, 4), 4.6, 6.4, creamSide, creamSide)]),
      [
        ...ball(2.5, 0, 6.6, 6.6, cream, creamSide, capCream),
        ...[-1, 1].map((s) => part(craftBox(7.2, s * 1.8, 0.7, 2.2), 8.4, 10.2, warm, warm)),
      ],
      ...[-1, 1].map((s) => [
        ...ball(-1.5, s * 10, 6, 4, a.markerDim, a.markerDark, podCap, 10),
        part(craftBox(-1.5, s * 10, 5.4, 1.2), 9.4, 10.2, podCap, a.markerDark),
      ]),
      [hsCube(8, -3.4, 4.6, 1.2, warm)],
      [hsCube(8, 3.4, 4.6, 1.2, warm)],
      [
        part(craftBox(1, 0, 0.8, 0.8), 13, 16.4, a.steelDark, a.steelDark),
        disc(1, 0, 1.4, 16.4, 18.4, a.marker, a.markerDark, 8),
      ],
    ]);
  },
};
