// Enemy fleet models (art/enemy-redesign.md): each ship is one set of connected solids in mesh
// space (forward +x, port +y, up +z), authored in display px at game scale and scaled to its
// contract span by the producer. Helpers take stations `l` along the hull, half-breadths `w` to
// port and heights `z`.
import type { Point } from "./projection.ts";
import {
  type Mesh,
  meshBox,
  meshExtrude,
  meshLoft,
  meshScale,
  meshTube,
  type Tones,
} from "./solid.ts";

export const FLEET_FAMILIES = ["coral", "claim", "garnet", "needle"] as const;
export type FleetFamily = (typeof FLEET_FAMILIES)[number];
export type JetRamps = { outer: [string, string]; core: [string, string] };
// Materials of the small craft, each in three flat tones.
export type Paint = { hull: Tones; plate: Tones; gun: Tones; glow: Tones; dark: Tones };

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
const paint = (hull: Tones, plate: string, gun: Tones, dark: Tones): Paint => ({
  hull,
  plate: mat(plate),
  gun,
  glow: glow(gun[0]),
  dark,
});

export const FLEET_PAINT: Readonly<Record<FleetFamily, Paint>> = {
  coral: paint(["#d68b72", "#a8654f", "#7f4b3d"], "#e6a890", AMBER, VISOR),
  claim: paint(
    ["#bd7042", "#924e28", "#703921"],
    "#b5a998",
    ["#fa6d38", "#bc4524", "#8c331b"],
    ["#2b1d1c", "#1f1514", "#17100f"],
  ),
  garnet: paint(["#e47485", "#b0495b", "#823643"], "#deb7b6", AMBER, VISOR),
  needle: paint(["#d65b6c", "#a14350", "#75313a"], "#d7cfc9", AMBER, VISOR),
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
export type FleetCraft = {
  archetype: "swarm" | "fighter" | "interceptor";
  // The sidecar key and file stem.
  key: string;
  design: string;
  parts: FleetPart[];
  mouths: FleetMouth[];
  // Destruction wedge cut angles in degrees about the origin, forward at -90 and port at 0.
  cuts: number[];
};

// Small craft are drawn 1.35 times their authored height.
const TALL = 1.35;
const part = (name: string, build: (mesh: Mesh) => void, loose = false): FleetPart => {
  const mesh: Mesh = [];
  build(mesh);
  return { name, mesh: meshScale(mesh, [1, 1, TALL]), ...(loose ? { loose: true as const } : {}) };
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
    cuts: [-90, -10, 80, 170],
  };
}

// Arrowhead: wedge fuselage, two swept wings, an engine pod on each wing and three flush ports
// for the Multi-Laser at the nose and wing roots.
function arrowhead(p: Paint): FleetCraft {
  return {
    archetype: "fighter",
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
    cuts: [-90, -25, 55, 125, 205],
  };
}

// Spear: one hull tapering to its own point, an engine housing, two forward-swept aft fins, a
// drive cone and a flush emitter nose cap for the Phaser.
function spear(p: Paint): FleetCraft {
  return {
    archetype: "interceptor",
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
    cuts: [-90, -20, 70, 110, 200],
  };
}

export const smallCraft = (p: Paint): FleetCraft[] => [pincer(p), arrowhead(p), spear(p)];
