// Enemy fleet models (art/enemy-redesign.md): each ship is one set of connected solids in mesh
// space (forward +x, port +y, up +z), authored in display px at game scale and scaled to its
// contract span by the producer. Helpers take stations `l` along the hull, half-breadths `w` to
// port and heights `z`.
import type { Point } from "./projection.ts";
import {
  type Mesh,
  meshBox,
  meshExtrude,
  meshFace,
  meshLoft,
  meshScale,
  meshTube,
  type Tones,
} from "./solid.ts";

export const FLEET_FAMILIES = ["coral", "claim", "garnet", "needle"] as const;
export type FleetFamily = (typeof FLEET_FAMILIES)[number];
export type JetRamps = { outer: [string, string]; core: [string, string] };
// A family's materials, each in three flat tones. The industrial stems' role paint (`cargo`,
// `saddle`, `mining`, `scoop`, `metal`) is the same in every family.
export type Paint = {
  hull: Tones;
  plate: Tones;
  turret: Tones;
  collar: Tones;
  gun: Tones;
  glow: Tones;
  dark: Tones;
  cargo: Tones;
  saddle: Tones;
  mining: Tones;
  scoop: Tones;
  metal: Tones;
  // Cold armour of the frigates, and its shaded underside.
  armour: Tones;
  under: Tones;
};

const INK = [0x18, 0x14, 0x25] as const;
const hex = (channels: readonly number[]) =>
  `#${channels.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
// `colour` at strength k over ink.
export function shade(colour: string, k: number): string {
  return hex(
    [1, 3, 5].map((at, i) =>
      Math.round(parseInt(colour.slice(at, at + 2), 16) * k + INK[i]! * (1 - k) * 0.55),
    ),
  );
}
const mat = (top: string): Tones => [top, shade(top, 0.76), shade(top, 0.56)];
// An emitter keeps its colour on lit and left faces.
const glow = (colour: string): Tones => [colour, colour, shade(colour, 0.85)];

const AMBER: Tones = ["#f0bd68", "#b98a40", "#8a6630"];
const VISOR: Tones = ["#2a2433", "#1e1a26", "#16131c"];
const paint = (
  hull: Tones,
  plate: string,
  turret: string,
  gun: Tones,
  dark: Tones,
  armour: Tones,
): Paint => ({
  hull,
  plate: mat(plate),
  turret: mat(turret),
  collar: mat(shade(turret, 0.78)),
  gun,
  glow: glow(gun[0]),
  dark,
  cargo: ["#8a9db2", "#516681", "#3b4c64"],
  saddle: ["#6c6383", "#45435a", "#24263b"],
  mining: ["#65a097", "#467971", "#355d58"],
  scoop: ["#3a6864", "#294946", "#1f3836"],
  metal: mat("#a1aaa0"),
  armour,
  under: [armour[1], armour[2], shade(armour[2], 0.8)],
});

export const FLEET_PAINT: Readonly<Record<FleetFamily, Paint>> = {
  coral: paint(["#d68b72", "#a8654f", "#7f4b3d"], "#e6a890", "#c27a62", AMBER, VISOR, [
    "#809caa",
    "#58717f",
    "#405563",
  ]),
  claim: paint(
    ["#bd7042", "#924e28", "#703921"],
    "#b5a998",
    "#a95e30",
    ["#fa6d38", "#bc4524", "#8c331b"],
    ["#2b1d1c", "#1f1514", "#17100f"],
    ["#8d9f89", "#627967", "#43594b"],
  ),
  garnet: paint(["#e47485", "#b0495b", "#823643"], "#deb7b6", "#c65c6d", AMBER, VISOR, [
    "#9b91af",
    "#706985",
    "#514c68",
  ]),
  needle: paint(["#d65b6c", "#a14350", "#75313a"], "#d7cfc9", "#b44858", AMBER, VISOR, [
    "#879eaf",
    "#607889",
    "#40586a",
  ]),
};

// Speed jet ramps, slow to fast, per family.
export const FLEET_JETS: Readonly<Record<FleetFamily, JetRamps>> = {
  coral: { outer: ["#b8644c", "#f0a07c"], core: ["#d68b72", "#ffe2c8"] },
  claim: { outer: ["#bc4524", "#fa6d38"], core: ["#fa6d38", "#ffebda"] },
  garnet: { outer: ["#c1445c", "#fb8898"], core: ["#e47485", "#ffe0e0"] },
  needle: { outer: ["#993847", "#ed7477"], core: ["#d65b6c", "#ffe7e9"] },
};

// ------------------------------------------------------------------ authoring helpers

// Box from station l0 to l1, breadth w0 to w1 and height z0 to z1.
function bx(
  mesh: Mesh,
  l0: number,
  l1: number,
  w0: number,
  w1: number,
  z0: number,
  z1: number,
  tones: Tones,
): void {
  meshBox(mesh, [l0, w0, z0], [l1, w1, z1], tones);
}

// Hull station: l, half-breadth, keel and deck heights, then the deck chamfer's drop and inset.
type Station = readonly [l: number, hw: number, zb: number, zt: number, cz?: number, cw?: number];

const section = ([l, hw, zb, zt, cz = 0, cw = 0]: Station, w0: number): Point[] => [
  [l, w0 - hw, zb],
  [l, w0 + hw, zb],
  [l, w0 + hw, zt - cz],
  [l, w0 + hw - cw, zt],
  [l, w0 - hw + cw, zt],
  [l, w0 - hw, zt - cz],
];

// Hull lofted through its stations, centred on breadth w0.
function hull(mesh: Mesh, stations: readonly Station[], tones: Tones, w0 = 0): void {
  meshLoft(
    mesh,
    stations.map((station) => section(station, w0)),
    tones,
  );
}

// A pair of wings from a one-side planform of (l, w), t thick with its underside at z.
function wing(
  mesh: Mesh,
  plan: readonly (readonly [number, number])[],
  z: number,
  t: number,
  tones: Tones,
): void {
  for (const side of [1, -1]) {
    meshExtrude(
      mesh,
      plan.map(([l, w]): Point => [l, side * w, z]),
      [0, 0, t],
      tones,
    );
  }
}

// A pair of thick tapering wings from a one-side planform of (l, w): underside at zb, top at
// zr on the root and zt on the tip. Returns the top's height at breadth w.
function wedge(
  mesh: Mesh,
  plan: readonly (readonly [number, number])[],
  zb: number,
  zr: number,
  zt: number,
  tones: Tones,
): (w: number) => number {
  const breadths = plan.map(([, w]) => w);
  const [w0, w1] = [Math.min(...breadths), Math.max(...breadths)];
  const top = (w: number) => zr + ((zt - zr) * (Math.abs(w) - w0)) / (w1 - w0);
  for (const side of [1, -1]) {
    const points = plan.map(([l, w]) => [l, side * w] as const);
    const area = points.reduce((sum, a, i) => {
      const b = points[(i + 1) % points.length]!;
      return sum + a[0] * b[1] - b[0] * a[1];
    }, 0);
    const sign = area > 0 ? 1 : -1;
    const upper = points.map(([l, w]): Point => [l, w, top(w)]);
    const lower = points.map(([l, w]): Point => [l, w, zb]);
    meshFace(mesh, upper, [0, 0, 1], tones);
    meshFace(mesh, lower, [0, 0, -1], tones);
    for (const [i, a] of points.entries()) {
      const j = (i + 1) % points.length;
      const b = points[j]!;
      meshFace(
        mesh,
        [lower[i]!, lower[j]!, upper[j]!, upper[i]!],
        [sign * (b[1] - a[1]), sign * (a[0] - b[0]), 0],
        tones,
      );
    }
  }
  return top;
}

// Fore-and-aft tube at breadth w and height z: radius r at its aft end l0 and r1 at l1.
function pod(
  mesh: Mesh,
  l0: number,
  l1: number,
  w: number,
  z: number,
  r: number,
  tones: Tones,
  sides: number,
  ends: { r1?: number; aft?: Tones } = {},
): void {
  meshTube(mesh, [l0, w, z], [l1, w, z], r, ends.r1 ?? r, tones, sides, {
    ...(ends.aft ? { cap0: ends.aft } : {}),
  });
}

// ------------------------------------------------------------------ craft

// One solid group of a craft. A `loose` part breaks off whole in the destruction effect; the
// others break along the craft's wedge cuts.
export type FleetPart = { name: string; loose?: true; mesh: Mesh };
// A drive mouth: the centre of its aft disc and the disc's radius.
export type FleetMouth = { at: Point; radius: number };
// An aimed weapon mount: the centre of its collar's foot on the deck, and the collar's radius.
export type FleetMount = { at: Point; radius: number };
// A frigate's hardpoints. The engine is one hardpoint about `at`, with its drive solids intact
// and wrecked. Each weapon mount stands on the deck at `at`; `capped` mounts also have a capped
// plate for the route positions that leave them unarmed. Ids follow the shipped layout: `port`
// is the mount to port on screen, at negative breadth.
export type FleetHeavy = {
  engine: { at: Point; intact: Mesh; destroyed: Mesh };
  mounts: { id: string; at: Point; capped: boolean }[];
};
export type FleetCraft = {
  archetype: "swarm" | "fighter" | "interceptor" | "retaliator" | "frigate";
  // The frame key of the shipped rows the craft replaces: `enemy-{stem}-{index}`.
  stem: string;
  // The sidecar key and file stem.
  key: string;
  design: string;
  parts: FleetPart[];
  mouths: FleetMouth[];
  // The shot origin of a craft whose weapon is a hull port: the centre of the flush port.
  muzzle?: Point;
  // The aimed launcher of a retaliator, which carries the `pod` top.
  mount?: FleetMount;
  // The engine and weapon mounts of a frigate.
  heavy?: FleetHeavy;
  // The families that fly the craft, when not all of them.
  families?: readonly FleetFamily[];
  // Where a family's rows go when not under `stem` in the family's own manifest.
  rows?: Partial<Record<FleetFamily, { stem: string; manifest?: "whirlpool" }>>;
  // The material of the destruction flecks.
  fleck: Tones;
  // Destruction wedge cut angles in degrees about the origin, forward at -90 and port at 0.
  cuts: number[];
};

// Small craft are drawn 1.35 times their authored height.
const TALL = 1.35;
const solid = (name: string, build: (mesh: Mesh) => void, loose = false): FleetPart => {
  const mesh: Mesh = [];
  build(mesh);
  return { name, mesh, ...(loose ? { loose: true as const } : {}) };
};
const part = (name: string, build: (mesh: Mesh) => void, loose = false): FleetPart => {
  const { mesh, ...rest } = solid(name, build, loose);
  return { ...rest, mesh: meshScale(mesh, [1, 1, TALL]) };
};
const mouth = (l: number, w: number, z: number, radius: number): FleetMouth => ({
  at: [l, w, z * TALL],
  radius,
});

// Pincer drone: blunt slug, one plate band, two forward-swept blades, a drive cone and a flush
// nose port for the Laser.
function pincer(p: Paint): FleetCraft {
  return {
    archetype: "swarm",
    stem: "swarm",
    key: "fleetSwarm",
    design: "Pincer drone",
    parts: [
      part("body", (m) => {
        hull(
          m,
          [
            [6.5, 1.4, 1.2, 3.0, 0.5, 0.5],
            [3.5, 2.6, 0.8, 4.2, 0.9, 0.9],
            [-3.5, 2.6, 0.8, 4.2, 0.9, 0.9],
          ],
          p.hull,
        );
        bx(m, -1.6, 0.8, -2.8, 2.8, 0.7, 4.4, p.plate);
        wing(
          m,
          [
            [-3.5, 2.4],
            [2.0, 7.5],
            [5.0, 7.5],
            [-0.2, 2.4],
          ],
          1.6,
          1.1,
          p.hull,
        );
        bx(m, 6.2, 6.9, -1.0, 1.0, 1.5, 2.8, p.gun);
      }),
      part(
        "drive",
        (m) => pod(m, -6.8, -3.2, 0, 2.5, 2.7, p.dark, 12, { r1: 1.6, aft: p.glow }),
        true,
      ),
      part("visor", (m) => bx(m, 2.3, 4.1, -1.4, 1.4, 3.6, 4.5, p.dark), true),
    ],
    mouths: [mouth(-6.8, 0, 2.5, 2.7)],
    muzzle: [6.9, 0, 2.15 * TALL],
    fleck: p.hull,
    cuts: [-90, -10, 80, 170],
  };
}

// Arrowhead: wedge fuselage, two swept wings, an engine pod on each wing and three flush ports
// for the Multi-Laser at the nose and wing roots.
function arrowhead(p: Paint): FleetCraft {
  return {
    archetype: "fighter",
    stem: "fighter",
    key: "fleetFighter",
    design: "Arrowhead",
    parts: [
      part("body", (m) => {
        hull(
          m,
          [
            [12, 0.9, 1.4, 2.6],
            [6, 2.2, 0.9, 4.0, 0.8, 0.7],
            [-5, 2.8, 0.6, 4.6, 0.9, 0.8],
            [-10, 2.4, 0.8, 4.2, 0.8, 0.7],
          ],
          p.hull,
        );
        wing(
          m,
          [
            [3, 2],
            [-3, 9.4],
            [-9, 9.4],
            [-8.5, 2],
          ],
          1.4,
          1.1,
          p.plate,
        );
        bx(m, 11.6, 12.4, -1.05, 1.05, 1.3, 2.7, p.gun);
        for (const side of [1, -1]) {
          bx(m, 0.2, 2.4, side * 3.3, side * 4.8, 1.5, 2.9, p.gun);
        }
      }),
      ...[1, -1].map((side) =>
        part(
          side === 1 ? "port engine" : "starboard engine",
          (m) => {
            pod(m, -11.5, -2.5, side * 5.6, 3.4, 1.7, p.dark, 10, { aft: p.glow });
            pod(m, -2.5, -1.0, side * 5.6, 3.4, 1.7, p.dark, 10, { r1: 0.8 });
          },
          true,
        ),
      ),
      part("visor", (m) => bx(m, 1, 5, -1.3, 1.3, 3.8, 4.9, p.dark), true),
    ],
    mouths: [mouth(-11.5, 5.6, 3.4, 1.7), mouth(-11.5, -5.6, 3.4, 1.7)],
    // The fan of three leaves from the nose port.
    muzzle: [12.4, 0, 2 * TALL],
    fleck: p.hull,
    cuts: [-90, -25, 55, 125, 205],
  };
}

// Spear: one hull tapering to its own point, an engine housing, two forward-swept aft fins, a
// drive cone and a flush emitter nose cap for the Phaser.
function spear(p: Paint): FleetCraft {
  return {
    archetype: "interceptor",
    stem: "interceptor",
    key: "fleetInterceptor",
    design: "Spear",
    parts: [
      part("body", (m) => {
        hull(
          m,
          [
            [22, 0.6, 1.8, 2.8],
            [19, 0.99, 1.62, 3.22, 0.18, 0.18],
          ],
          p.gun,
        );
        hull(
          m,
          [
            [19, 0.99, 1.62, 3.22, 0.18, 0.18],
            [12, 1.9, 1.2, 4.2, 0.6, 0.6],
            [2, 2.6, 1.0, 5.0, 0.8, 0.8],
            [-9, 2.6, 1.0, 5.0, 0.8, 0.8],
          ],
          p.hull,
        );
        bx(m, -3, -0.5, -2.8, 2.8, 0.9, 5.2, p.plate);
        hull(
          m,
          [
            [-8, 3.4, 0.8, 5.6, 1, 1],
            [-15, 3.4, 0.8, 5.6, 1, 1],
          ],
          p.hull,
        );
        wing(
          m,
          [
            [-14, 3.2],
            [-9, 3.2],
            [-1.5, 9.4],
            [-5.5, 9.4],
          ],
          2.0,
          1.1,
          p.plate,
        );
      }),
      part(
        "drive",
        (m) => pod(m, -20.2, -14.5, 0, 3.2, 3.6, p.dark, 14, { r1: 2.0, aft: p.glow }),
        true,
      ),
      part("visor", (m) => bx(m, 3.5, 7, -1.4, 1.4, 4.4, 5.3, p.dark), true),
    ],
    mouths: [mouth(-20.2, 0, 3.2, 3.6)],
    muzzle: [22, 0, 2.3 * TALL],
    fleck: p.hull,
    cuts: [-90, -20, 70, 110, 200],
  };
}

// ------------------------------------------------------------------ weapon mounts

// Mount radius of a weapon top, and of the launcher in the Cargo Hauler's spine well.
const MOUNT_RADIUS = 4.6;
const WELL_RADIUS = 3.8;
const COLLAR_HEIGHT = 1.2;

// The round collar of a mount, standing on the deck at `at`: the mount's base.
export function collar(p: Paint, { at, radius }: FleetMount): Mesh {
  const mesh: Mesh = [];
  meshTube(mesh, at, [at[0], at[1], at[2] + COLLAR_HEIGHT], radius, radius, p.collar, 16);
  return mesh;
}
// The pivot of the mount's top: the centre of the collar's upper face.
export const mountPivot = ({ at }: FleetMount): Point => [at[0], at[1], at[2] + COLLAR_HEIGHT];

// A weapon top about its pivot at the origin, muzzle toward +x, with its shot origins.
export type FleetTop = { mesh: Mesh; muzzles: Point[] };

// Rapid Missile `pod`: a low flat box launcher with two bright cells on its face and no barrel.
// Each cell is a shot origin.
export function podTop(p: Paint, r: number): FleetTop {
  const mesh: Mesh = [];
  bx(mesh, -0.85 * r, 0.95 * r, -0.85 * r, 0.85 * r, 0, 0.55 * r, p.turret);
  for (const side of [1, -1]) {
    bx(mesh, 0.95 * r, 1.1 * r, side * 0.12 * r, side * 0.7 * r, 0.1 * r, 0.46 * r, p.gun);
  }
  return {
    mesh,
    muzzles: [1, -1].map((side): Point => [1.1 * r, side * 0.41 * r, 0.28 * r]),
  };
}

// A destroyed mount: a low scorched stump with a breach.
export function stump(p: Paint, { at, radius }: FleetMount): Mesh {
  const mesh: Mesh = [];
  const top = at[2] + COLLAR_HEIGHT * 0.6;
  const breach: Tones = [p.dark[2], p.dark[2], p.dark[2]];
  meshTube(mesh, at, [at[0], at[1], top], radius, radius, p.dark, 16);
  meshTube(
    mesh,
    [at[0], at[1], top],
    [at[0], at[1], top + 0.1],
    0.6 * radius,
    0.6 * radius,
    breach,
    12,
  );
  return mesh;
}

// An unarmed mount: the collar closed by a low plate.
export function capped(p: Paint, mount: FleetMount): Mesh {
  const mesh = collar(p, mount);
  const [l, w, z] = mountPivot(mount);
  meshTube(mesh, [l, w, z], [l, w, z + 0.5], 0.7 * mount.radius, 0.7 * mount.radius, p.plate, 12);
  return mesh;
}

// Laser `gun`: one narrow block along the aim with a bright muzzle face.
export function gunTop(p: Paint, r: number): FleetTop {
  const mesh: Mesh = [];
  bx(mesh, -0.9 * r, 1.1 * r, -0.36 * r, 0.36 * r, 0, 0.62 * r, p.turret);
  bx(mesh, 1.1 * r, 1.3 * r, -0.3 * r, 0.3 * r, 0.1 * r, 0.52 * r, p.gun);
  return { mesh, muzzles: [[1.3 * r, 0, 0.31 * r]] };
}

// Heavy Missile `rail`: a dark sled carrying one large missile.
export function railTop(p: Paint, r: number): FleetTop {
  const mesh: Mesh = [];
  bx(mesh, -1.0 * r, 1.2 * r, -0.5 * r, 0.5 * r, 0, 0.3 * r, p.dark);
  pod(mesh, -0.9 * r, 0.9 * r, 0, 0.66 * r, 0.38 * r, p.plate, 12);
  pod(mesh, 0.9 * r, 1.6 * r, 0, 0.66 * r, 0.38 * r, p.gun, 12, { r1: 0.06 * r });
  return { mesh, muzzles: [[1.6 * r, 0, 0.66 * r]] };
}

export const FRIGATE_TOPS = { gun: gunTop, rail: railTop } as const;
export const FRIGATE_MOUNT_RADIUS = MOUNT_RADIUS;

// ------------------------------------------------------------------ retaliators

const nozzles = (m: Mesh, p: Paint, l0: number, l1: number, z: number, r: number, r1: number) => {
  for (const w of [-5.5, 0, 5.5]) pod(m, l0, l1, w, z, r, p.dark, 12, { r1, aft: p.glow });
};

// Manta gunship: tall centre body, two thick wedge wings, two short dark intake lobes that end
// behind the nose, three stern mouths and the launcher sunk into the deck.
function manta(p: Paint): FleetCraft {
  return {
    archetype: "retaliator",
    stem: "retaliator",
    key: "fleetRetaliator",
    design: "Manta gunship",
    parts: [
      solid("body", (m) => {
        wedge(
          m,
          [
            [12, 6],
            [4, 12],
            [-3, 28.15],
            [-8, 27.2],
            [-9.5, 14],
            [-15, 6],
          ],
          1,
          10,
          3.5,
          p.hull,
        );
        hull(
          m,
          [
            [17, 2.5, 2, 7, 1, 1],
            [8, 7, 0, 13, 3, 2],
            [-10, 8, 0, 15, 3, 2],
            [-16, 6, 1, 12, 2, 2],
          ],
          p.plate,
        );
        for (const side of [1, -1]) bx(m, -17, -16, side * 2.8, side * 6.2, 4, 9, p.glow);
        bx(m, -17, -16, -1.7, 1.7, 4, 9, p.glow);
      }),
      ...[1, -1].map((side) =>
        solid(
          side === 1 ? "port intake" : "starboard intake",
          (m) =>
            hull(
              m,
              [
                [16, 1.0, 3, 6],
                [11, 2.2, 1, 9, 1, 1],
                [2, 2.2, 1, 9, 1, 1],
              ],
              p.dark,
              side * 10,
            ),
          true,
        ),
      ),
      solid("visor", (m) => bx(m, 4.5, 8.5, -3, 3, 13, 15, p.dark), true),
    ],
    mouths: [-4.5, 0, 4.5].map((w) => ({ at: [-17, w, 6.5] as Point, radius: 1.7 })),
    mount: { at: [-5, 0, 13.6], radius: MOUNT_RADIUS },
    fleck: p.hull,
    cuts: [-90, -30, 30, 90, 150, 210],
  };
}

// Cargo Hauler: bow cab, slim spine, two plain cargo blocks a side of unequal length with a gap
// between them, a stern engine house with three nozzles and the launcher in a well on the spine.
function cargoHauler(p: Paint): FleetCraft {
  const window: Tones = [p.saddle[2], p.saddle[2], p.saddle[2]];
  const house: Tones = [p.saddle[1], p.saddle[2], p.saddle[2]];
  return {
    archetype: "retaliator",
    stem: "retaliatorCargoHauler",
    key: "fleetRetaliatorCargoHauler",
    design: "Cargo Hauler",
    parts: [
      solid("body", (m) => {
        hull(
          m,
          [
            [30, 3.5, 2, 7, 1, 1],
            [25, 7, 0, 11, 2.5, 2],
            [19, 7, 0, 11, 2.5, 2],
          ],
          p.cargo,
        );
        bx(m, 21, 24, -4.6, 4.6, 10.8, 12, window);
        hull(
          m,
          [
            [20, 3.6, 2, 7, 1, 1],
            [-22, 3.6, 2, 7, 1, 1],
          ],
          p.cargo,
        );
        for (const side of [1, -1]) {
          bx(m, 0, 17, side * 4.4, side * 28.15, 1, 9, p.saddle);
          bx(m, -18, -8, side * 4.4, side * 23, 1, 8, p.saddle);
        }
        bx(m, -27, -20, -9, 9, 1, 10, house);
      }),
      solid("nozzles", (m) => nozzles(m, p, -30, -26, 5.5, 2.8, 1.9), true),
    ],
    mouths: [-5.5, 0, 5.5].map((w) => ({ at: [-30, w, 5.5] as Point, radius: 2.8 })),
    mount: { at: [-4, 0, 7], radius: WELL_RADIUS },
    fleck: p.saddle,
    cuts: [-90, -45, 0, 45, 90, 180],
  };
}

// Mining Freighter: split bow with a cutter drum between the prongs, main hull, two side scoops,
// a stern with three nozzles and the launcher sunk into the deck.
function miningFreighter(p: Paint): FleetCraft {
  return {
    archetype: "retaliator",
    stem: "retaliatorMiningFreighter",
    key: "fleetRetaliatorMiningFreighter",
    design: "Mining Freighter",
    parts: [
      solid("body", (m) => {
        for (const side of [1, -1]) {
          hull(
            m,
            [
              [25, 2.0, 3, 7],
              [15, 4.6, 0, 12, 2.5, 1.5],
              [3, 4.6, 0, 12, 2.5, 1.5],
            ],
            p.mining,
            side * 9.4,
          );
          hull(
            m,
            [
              [11, 4.2, 2, 8, 1, 1],
              [7, 6.15, 0, 12, 2.5, 1.5],
              [-11, 6.15, 0, 12, 2.5, 1.5],
            ],
            p.scoop,
            side * 22,
          );
          bx(m, 11, 11.6, side * 19.6, side * 24.4, 3, 7, p.dark);
        }
        hull(
          m,
          [
            [7, 16, 0, 16, 3.5, 2],
            [-12, 16, 0, 16, 3.5, 2],
          ],
          p.mining,
        );
        hull(
          m,
          [
            [-11, 11, 1, 14, 3, 2],
            [-21, 9, 2, 12, 2, 2],
          ],
          p.mining,
        );
      }),
      solid(
        "cutter",
        (m) => {
          meshTube(m, [16, -5.2, 5], [16, 5.2, 5], 3.6, 3.6, p.metal, 14);
          bx(m, 15, 17, -0.8, 0.8, 1, 9, p.gun);
        },
        true,
      ),
      solid("visor", (m) => bx(m, 2.5, 5.5, -5, 5, 16, 18.4, p.dark), true),
      solid("nozzles", (m) => nozzles(m, p, -25, -20.5, 7, 3.2, 2.1), true),
    ],
    mouths: [-5.5, 0, 5.5].map((w) => ({ at: [-25, w, 7] as Point, radius: 3.2 })),
    mount: { at: [-5, 0, 15], radius: MOUNT_RADIUS },
    fleck: p.mining,
    cuts: [-90, -30, 30, 90, 150, 210],
  };
}

// ------------------------------------------------------------------ frigates

// A short pedestal in armour under a mount on a sloped deck.
const pedestal = (m: Mesh, p: Paint, l: number, w: number, z0: number, z1: number) =>
  meshTube(m, [l, w, z0], [l, w, z1], MOUNT_RADIUS * 1.15, MOUNT_RADIUS * 1.15, p.armour, 16);

// A drive cone: its dark nozzle flaring aft from l1 to l0, with the glow in its mouth while the
// engine runs. A wrecked cone loses its flared lip and its mouth is dark, the first with one ember.
function driveCone(
  m: Mesh,
  p: Paint,
  w: number,
  z: number,
  l0: number,
  l1: number,
  state: "intact" | "destroyed" | "ember",
): void {
  if (state === "intact") {
    pod(m, l0, l1, w, z, 6.6, p.dark, 18, { r1: 4.4, aft: p.glow });
    return;
  }
  const cut = l0 + (l1 - l0) * 0.25;
  const breach: Tones = [p.dark[2], p.dark[2], p.dark[2]];
  pod(m, cut, l1, w, z, 5.4, p.dark, 18, { r1: 4.4, aft: breach });
  if (state === "ember") bx(m, cut - 0.4, cut, w - 1.2, w + 1.2, z - 1.2, z + 1.2, p.gun);
}

// Slim delta: fine prow, narrow hull, low ridge citadel, thick wedge wings set aft and twin
// drive cones in one stern block. `port` and `starboard` stand on wing pedestals, `spine` on the
// main hull aft of the citadel and `bow` on a prow pedestal.
function slimDelta(p: Paint): FleetCraft {
  const wingMount = { l: -22, w: 29 };
  let deck = 0;
  const body = solid("body", (m) => {
    hull(
      m,
      [
        [50, 3, -3, 3],
        [34, 6, -5, 3],
        [-40, 6, -5, 3],
      ],
      p.under,
    );
    hull(
      m,
      [
        [66, 2.5, 4, 9, 1, 1],
        [52, 7, 1, 14, 3, 2],
        [30, 8, 0, 15, 3, 2],
      ],
      p.armour,
    );
    hull(
      m,
      [
        [32, 10, 0, 18, 4, 3],
        [-36, 10, 0, 18, 4, 3],
      ],
      p.armour,
    );
    // The one band in the family's hull colour.
    hull(
      m,
      [
        [27, 10.3, -0.1, 18.3, 4.1, 3.1],
        [22, 10.3, -0.1, 18.3, 4.1, 3.1],
      ],
      p.hull,
    );
    hull(
      m,
      [
        [-4, 6, 18, 21.5, 2, 2],
        [-22, 6.5, 18, 23.5, 2, 2],
      ],
      p.armour,
    );
    const top = wedge(
      m,
      [
        [10, 9],
        [-12, 46.9],
        [-30, 46.9],
        [-38, 28],
        [-38, 9],
      ],
      2,
      12,
      5,
      p.armour,
    );
    deck = top(wingMount.w);
    for (const side of [1, -1]) {
      pedestal(m, p, wingMount.l, side * wingMount.w, deck - 2, deck + 1);
    }
    pedestal(m, p, 40, 0, 13, 15);
    bx(m, 46, 49, -3.6, 3.6, 13.7, 14.9, p.dark);
  });
  const engine = (wrecked: boolean): Mesh => {
    const m: Mesh = [];
    bx(m, -48, -34, -11, 11, 1, 16, p.dark);
    driveCone(m, p, 5.5, 8.32, -59, -46, wrecked ? "ember" : "intact");
    driveCone(m, p, -5.5, 8.32, -59, -46, wrecked ? "destroyed" : "intact");
    return m;
  };
  return {
    archetype: "frigate",
    stem: "frigate",
    key: "fleetFrigate",
    design: "Slim delta",
    families: ["coral", "claim"],
    parts: [body],
    mouths: [5.5, -5.5].map((w) => ({ at: [-59, w, 8.32] as Point, radius: 6.6 })),
    heavy: {
      engine: { at: [-41, 0, 8.5], intact: engine(false), destroyed: engine(true) },
      mounts: [
        { id: "port", at: [wingMount.l, -wingMount.w, deck + 1], capped: false },
        { id: "starboard", at: [wingMount.l, wingMount.w, deck + 1], capped: false },
        { id: "spine", at: [-29, 0, 18], capped: true },
        { id: "bow", at: [40, 0, 15], capped: true },
      ],
    },
    fleck: p.armour,
    cuts: [],
  };
}

// Twin hull: two parallel hulls on a low bridge deck, a centre command pod and one drive cone
// per hull. `port` and `starboard` stand one on each hull, `spine` and `bow` on the centre pod.
function twinHull(p: Paint): FleetCraft {
  const beam = 38.4;
  const body = solid("body", (m) => {
    for (const side of [1, -1]) {
      hull(
        m,
        [
          [54, 2.5, 4, 9, 1, 1],
          [42, 8.5, 0, 17, 4, 3],
          [-36, 8.5, 0, 17, 4, 3],
          [-43, 7, 2, 15, 3, 2],
        ],
        p.armour,
        side * beam,
      );
      hull(
        m,
        [
          [-14, 6, 17, 22, 2, 2],
          [-36, 6, 17, 22, 2, 2],
        ],
        p.under,
        side * beam,
      );
    }
    bx(m, -22, 20, -31, 31, 5, 11, p.under);
    hull(
      m,
      [
        [34, 3.5, 8, 13, 1, 1],
        [24, 8, 5, 21, 4, 3],
        [-16, 8, 5, 21, 4, 3],
        [-22, 6, 8, 18, 3, 2],
      ],
      p.armour,
    );
    // The one band in the family's hull colour.
    hull(
      m,
      [
        [21, 8.2, 4.9, 21.2, 4.1, 3.1],
        [16, 8.2, 4.9, 21.2, 4.1, 3.1],
      ],
      p.hull,
    );
    bx(m, 24.5, 27.5, -4, 4, 20.2, 21.8, p.dark);
  });
  const engine = (wrecked: boolean): Mesh => {
    const m: Mesh = [];
    driveCone(m, p, beam, 8.5, -54, -42, wrecked ? "ember" : "intact");
    driveCone(m, p, -beam, 8.5, -54, -42, wrecked ? "destroyed" : "intact");
    return m;
  };
  return {
    archetype: "frigate",
    stem: "frigateTwin",
    key: "fleetFrigateTwin",
    design: "Twin hull",
    families: ["coral", "garnet", "needle"],
    // Whirlpool alone flies the coral Twin hull, so its rows are Whirlpool's; Andromeda and Needle
    // fly it as their family's frigate.
    rows: {
      coral: { stem: "frigateTwin", manifest: "whirlpool" },
      garnet: { stem: "frigate" },
      needle: { stem: "frigate" },
    },
    parts: [body],
    mouths: [beam, -beam].map((w) => ({ at: [-54, w, 8.5] as Point, radius: 6.6 })),
    heavy: {
      engine: { at: [-48, 0, 8.5], intact: engine(false), destroyed: engine(true) },
      mounts: [
        { id: "port", at: [10, -beam, 17], capped: false },
        { id: "starboard", at: [10, beam, 17], capped: false },
        { id: "spine", at: [-9, 0, 21], capped: true },
        { id: "bow", at: [8, 0, 21], capped: true },
      ],
    },
    fleck: p.armour,
    cuts: [],
  };
}

export const fleet = (p: Paint): FleetCraft[] => [
  pincer(p),
  arrowhead(p),
  spear(p),
  manta(p),
  cargoHauler(p),
  miningFreighter(p),
  slimDelta(p),
  twinHull(p),
];
