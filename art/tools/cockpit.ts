// Close-up of Ada's ship for the cockpit background: the game's isometric projection at
// heading 12 with a detailed exterior model, a clear bubble canopy and the seats inside.
import { fileURLToPath } from "node:url";

import { blankImage } from "@andornaut/art-kit/rgbaImage";

import {
  blend,
  blur,
  disc,
  fillEllipse,
  fillPolygon,
  filled,
  grey,
  outlinePolygon,
  over,
  polyline,
  region,
  resize,
  rgba,
  type RgbaImage,
  writePng,
  type Xy,
} from "./paint.ts";
import { SPACE_BG } from "./palette.ts";
import { placeEntries } from "./manifest.ts";
import { depth, facesViewer, type Point, rotate, SHIP_HEADINGS } from "./projection.ts";
import { roundHalfEven } from "./random.ts";
import { centredView, DESIGN, shimmer, type View } from "./shimmer.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));

// Logical canvas, centred on the view; 2 image px per logical px.
export const CANVAS = { width: 960, height: 540, density: 2 } as const;
const SS = 3;
// Ship heading 24 of 32 (up-right).
const YAW = 24;
// Design px per model unit, and the design px where the canopy's focus point (0, -3, 5.5) lands.
const K = 11;
const FOCUS: Xy = [422, 150];
const SPEAK_MS = 120;

const RAMPS: Readonly<Record<string, readonly string[]>> = {
  white: ["9aabbf", "abbfce", "c3d1de", "d4dfe9", "ffffff"],
  blue: ["0f4e8f", "1767b3", "2585d0", "4f9fe0"],
  dark: ["1d2234", "262b44", "3a4466", "5a6988"],
  teal: ["2f6a6e", "3d8084", "4f9ea3", "6cb8b9"],
  cream: ["b8ad9a", "d9cbb1", "efe4cf"],
  floor: ["5a6988", "6d7b98", "8b9bb4"],
};
// Light from the upper left, slightly behind the viewer.
const LIGHT = ((v: Point) =>
  v.map((c) => c / Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])) as unknown as Point)([
  -0.25, 0.45, 1,
]);

type Face = Point[];
type Material = string;
type Kind = "base" | "solid" | "fin" | "decal" | "canopy" | "flat";
interface Group {
  name: string;
  faces: [Material, Face][];
  kind: Kind;
}

const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function newell(points: readonly Point[]): Point {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (const [i, a] of points.entries()) {
    const b = points[(i + 1) % points.length]!;
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const n = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  return [nx / n, ny / n, nz / n];
}

// Flat shading: the lit fraction picks a step of the material's ramp.
function shade(material: Material, rotated: readonly Point[]): string {
  const ramp = RAMPS[material]!;
  const v = 0.5 + 0.5 * dot(newell(rotated), LIGHT);
  return ramp[Math.max(0, Math.min(ramp.length - 1, Math.trunc(v * ramp.length)))]!;
}

const area = (poly: readonly Xy[]) =>
  poly.reduce((sum, [x, y], i) => {
    const [nx, ny] = poly[(i + 1) % poly.length]!;
    return sum + x * ny - nx * y;
  }, 0);

// Miter-offset a plan polygon inward by d.
function inset(poly: readonly Xy[], d: number): Xy[] {
  const n = poly.length;
  const sign = area(poly) > 0 ? 1 : -1;
  const normal = (a: Xy, b: Xy): Xy => {
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const length = Math.hypot(ex, ey);
    return [(-ey * sign) / length, (ex * sign) / length];
  };
  return poly.map((p1, i) => {
    const n1 = normal(poly[(i - 1 + n) % n]!, p1);
    const n2 = normal(p1, poly[(i + 1) % n]!);
    let bx = n1[0] + n2[0];
    let by = n1[1] + n2[1];
    const bl = Math.hypot(bx, by) || 1;
    bx /= bl;
    by /= bl;
    const m = d / Math.max(bx * n1[0] + by * n1[1], 0.35);
    return [p1[0] + bx * m, p1[1] + by * m] as const;
  });
}

// Extrude a closed (u, v) profile: along y with the profile in x-z.
function prism(profile: readonly Xy[], a0: number, a1: number): Face[] {
  const f0: Face = profile.map(([u, v]) => [u, a0, v]);
  const f1: Face = profile.map(([u, v]) => [u, a1, v]);
  return [
    f0,
    [...f1].reverse(),
    ...profile.map((_, i): Face => {
      const j = (i + 1) % profile.length;
      return [f0[i]!, f0[j]!, f1[j]!, f1[i]!];
    }),
  ];
}

const centroid = (points: readonly Point[]): Point =>
  [0, 1, 2].map((i) => points.reduce((s, p) => s + p[i]!, 0) / points.length) as unknown as Point;

// Wind every face of a closed solid outward from its centroid.
function orient(faces: readonly Face[]): Face[] {
  const c = centroid(faces.flat());
  return faces.map((f) => {
    const fc = centroid(f);
    const n = newell(f);
    return dot(n, [fc[0] - c[0], fc[1] - c[1], fc[2] - c[2]]) < 0 ? [...f].reverse() : f;
  });
}

const toward = (f: Face, ref: Point): Face => (dot(newell(f), ref) >= 0 ? f : [...f].reverse());

// Side walls of a plan polygon wound outward, plus a chamfer up to an inset top.
function ringFaces(poly: readonly Xy[], z0: number, z1: number, top: readonly Xy[], z2: number) {
  const sign = area(poly) > 0 ? 1 : -1;
  return poly.flatMap((a, i): Face[] => {
    const b = poly[(i + 1) % poly.length]!;
    const on: Point = [(b[1] - a[1]) * sign, -(b[0] - a[0]) * sign, 0];
    const ta = top[i]!;
    const tb = top[(i + 1) % poly.length]!;
    const length = Math.hypot(on[0], on[1]) || 1;
    return [
      toward(
        [
          [a[0], a[1], z0],
          [b[0], b[1], z0],
          [b[0], b[1], z1],
          [a[0], a[1], z1],
        ],
        on,
      ),
      toward(
        [
          [a[0], a[1], z1],
          [b[0], b[1], z1],
          [tb[0], tb[1], z2],
          [ta[0], ta[1], z2],
        ],
        [on[0] / length, on[1] / length, 1],
      ),
    ];
  });
}

const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
  prism(
    [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ],
    y0,
    y1,
  );

const ellipsePoints = (cx: number, cy: number, a: number, b: number, n = 28): Xy[] =>
  Array.from({ length: n }, (_, i) => [
    cx + a * Math.cos((2 * Math.PI * i) / n),
    cy + b * Math.sin((2 * Math.PI * i) / n),
  ]);

const octagon = (cx: number, cz: number, rx: number, rz: number): Xy[] =>
  Array.from({ length: 8 }, (_, k) => [
    cx + rx * Math.cos(Math.PI / 8 + (k * Math.PI) / 4),
    cz + rz * Math.sin(Math.PI / 8 + (k * Math.PI) / 4),
  ]);

const solid = (name: string, material: Material, faces: readonly Face[]): Group => ({
  faces: orient(faces).map((f) => [material, f]),
  kind: "solid",
  name,
});

// The in-game hull plan (art/tools/ship.ts, at 0.32 model units per plan unit), copied so the
// close-up does not change when the sprite model does.
const HULL_PLAN: readonly Xy[] = [
  [-100, 0],
  [64, -67],
  [49, -17],
  [76, 0],
  [49, 17],
  [64, 67],
];
const HULL: Xy[] = HULL_PLAN.map(([px, py]) => [py * 0.32, px * 0.32]);
const FLOOR_Z = 4.7;
const DOME = { a: 7.4, b: 11, c: [0, -4.2, 5] as Point, h: 4.3 };
// Ada's seat is port (-3), upper left on screen at heading 12; Penny's is starboard.
const SEATS = [-3, 3] as const;

function exterior(): Group[] {
  const groups: Group[] = [];
  const top = inset(HULL, 0.9);
  groups.push({
    faces: [
      ...ringFaces(HULL, 0, 3.1, top, 4).map((f): [Material, Face] => ["white", f]),
      ["top", top.map(([x, y]): Point => [x, y, 4])],
    ],
    kind: "base",
    name: "hull",
  });
  // A raised fuselage along the centreline carries the canopy.
  const fuselage: Xy[] = [
    [0, -29.5],
    [3.4, -20],
    [5.6, -8],
    [5.8, 4],
    [4.2, 13],
    [3, 22.5],
    [-3, 22.5],
    [-4.2, 13],
    [-5.8, 4],
    [-5.6, -8],
    [-3.4, -20],
  ];
  const fuselageTop = inset(fuselage, 0.8);
  groups.push({
    faces: [
      ...ringFaces(fuselage, 4, 4.05, fuselageTop, 5).map((f): [Material, Face] => ["white", f]),
      ["top", fuselageTop.map(([x, y]): Point => [x, y, 5])],
    ],
    kind: "base",
    name: "fuselage",
  });
  groups.push(
    solid(
      "spine",
      "white",
      prism(
        [
          [-1.3, 5],
          [1.3, 5],
          [0.8, 6],
          [-0.8, 6],
        ],
        6.2,
        16,
      ),
    ),
  );
  groups.push({ faces: fin(), kind: "fin", name: "fin" });
  for (const sx of [-18.9, 18.9]) {
    const shell = octagon(sx, 3.2, 1.8, 1.6);
    const cone = octagon(sx, 3.2, 1.1, 1);
    const ring = octagon(sx, 3.2, 2, 1.8);
    const faces: [Material, Face][] = prism(shell, 12, 19.6).map((f) => ["white", f]);
    for (let k = 0; k < 8; k++) {
      const [a, b] = [shell[k]!, shell[(k + 1) % 8]!];
      const [ca, cb] = [cone[k]!, cone[(k + 1) % 8]!];
      faces.push([
        "white",
        [
          [a[0], 12, a[1]],
          [b[0], 12, b[1]],
          [cb[0], 9.8, cb[1]],
          [ca[0], 9.8, ca[1]],
        ],
      ]);
    }
    faces.push(["dark", cone.map(([x, z]): Point => [x, 9.8, z])]);
    faces.push(...prism(ring, 19.6, 20.6).map((f): [Material, Face] => ["blue", f]));
    const oriented = orient(faces.map(([, f]) => f));
    groups.push({
      faces: faces.map(([m], i) => [m, oriented[i]!]),
      kind: "solid",
      name: `nacelle${sx}`,
    });
    const mouth = octagon(sx, 3.2, 1.3, 1.15).map(([x, z]): Point => [x, 20.62, z]);
    groups.push({
      faces: [["mouth", toward(mouth, [0, 1, 0])]],
      kind: "decal",
      name: `mouth${sx}`,
    });
  }
  for (const sx of [-6.4, 6.4]) {
    groups.push(solid(`vent${sx}`, "dark", box(sx - 0.45, sx + 0.45, 2.6, 5.6, 4, 4.35)));
  }
  return groups;
}

// A tall swept fin on the rear centreline with a blue cap band and leading-edge strip; "!"
// materials draw after the fin's own faces.
function fin(): [Material, Face][] {
  const profile: readonly Xy[] = [
    [15, 5.6],
    [21.8, 16.8],
    [23.9, 16.8],
    [24.3, 5.6],
  ];
  const half = (z: number) => (z < 6 ? 0.75 : 0.35);
  const faces: Face[] = [];
  for (const side of [-1, 1]) {
    faces.push(profile.map(([y, z]): Point => [side * half(z), y, z]));
  }
  for (const [i, [ya, za]] of profile.entries()) {
    const [yb, zb] = profile[(i + 1) % profile.length]!;
    faces.push([
      [-half(za), ya, za],
      [-half(zb), yb, zb],
      [half(zb), yb, zb],
      [half(za), ya, za],
    ]);
  }
  const out: [Material, Face][] = orient(faces).map((f) => ["white", f]);
  const h = (z: number) => half(z) + 0.02;
  for (const side of [-1, 1]) {
    const strip = (points: readonly (readonly [number, number])[]): Face =>
      toward(
        points.map(([y, z]): Point => [side * h(z), y, z]),
        [side, 0, 0],
      );
    out.push([
      "blue!",
      strip([
        [19.7, 13.6],
        [21.8, 16.8],
        [23.9, 16.8],
        [24.1, 13.6],
      ]),
    ]);
    out.push([
      "blue!",
      strip([
        [15, 5.7],
        [16.3, 5.7],
        [22.4, 16.7],
        [21.8, 16.7],
      ]),
    ]);
  }
  return out;
}

// The cockpit tub: floor, dash, centre console and two seats with reclined backrests.
function interior(): Group[] {
  const [cx, cy] = DOME.c;
  const groups: Group[] = [
    {
      faces: [
        [
          "floor",
          ellipsePoints(cx, cy, DOME.a - 0.5, DOME.b - 0.5).map(([x, y]): Point => [x, y, FLOOR_Z]),
        ],
      ],
      kind: "flat",
      name: "tub",
    },
    solid("dash", "floor", box(-3.4, 3.4, -12.4, -11, FLOOR_Z, 5.5)),
    solid("console", "floor", box(-0.6, 0.6, -10.4, -2.6, FLOOR_Z, 5.4)),
  ];
  for (const sx of SEATS) {
    groups.push(solid(`ped${sx}`, "teal", box(sx - 0.7, sx + 0.7, -3.6, -2.2, FLOOR_Z, 5.3)));
    const cushion: Xy[] = [
      [sx - 1.6, 5.3],
      [sx + 1.6, 5.3],
      [sx + 1.6, 5.85],
      [sx + 1.35, 6.1],
      [sx - 1.35, 6.1],
      [sx - 1.6, 5.85],
    ];
    groups.push(solid(`cush${sx}`, "teal", prism(cushion, -4.7, -1.3)));
    // A reclined tombstone backrest.
    const hw = 1.5;
    const r = 1;
    const top = 8.5;
    const profile: Xy[] = [[sx - hw, 5.3]];
    for (let i = 0; i < 9; i++) {
      const a = Math.PI - (i * Math.PI) / 8;
      profile.push([
        sx + (hw - r) * (Math.cos(a) > 0 ? 1 : -1) + r * Math.cos(a),
        top - r + r * Math.sin(a),
      ]);
    }
    profile.push([sx + hw, 5.3]);
    const lean = (y: number, v: number): Point => [0, y + (0.55 * (v - 5.3)) / 3.2, v];
    const f0: Face = profile.map(([u, v]) => [u, lean(-1.4, v)[1], v]);
    const f1: Face = profile.map(([u, v]) => [u, lean(-0.6, v)[1], v]);
    const faces: [Material, Face][] = [
      ["teal", f0],
      ["teal", [...f1].reverse()],
    ];
    for (let i = 0; i < profile.length; i++) {
      const j = (i + 1) % profile.length;
      const cap = profile[i]![1] > top - 0.35 && profile[j]![1] > top - 0.35;
      faces.push([cap ? "cream" : "teal", [f0[i]!, f0[j]!, f1[j]!, f1[i]!]]);
    }
    const oriented = orient(faces.map(([, f]) => f));
    groups.push({
      faces: faces.map(([m], i) => [m, oriented[i]!]),
      kind: "solid",
      name: `back${sx}`,
    });
  }
  return groups;
}

// Seated tops of Ada's and Penny's heads: Ada's navy hair with a pink bow, Penny's golden head
// and orange ears (Archie's golden dog).
const HEADS: readonly (readonly [Point, number, string])[] = [
  [[-3, -2.6, 7.7], 1.45, "262b44"],
  [[-3.2, -2.9, 8.1], 0.85, "3a4466"],
  [[-3, -2.3, 8.8], 0.5, "f6757a"],
  [[1.95, -2.7, 7.6], 0.6, "f77622"],
  [[4.05, -2.7, 7.6], 0.6, "f77622"],
  [[3, -3, 7.6], 1.2, "feae34"],
  [[3, -3.3, 8.2], 0.55, "fee761"],
];

function domeFaces(nu = 24, nv = 7): Face[] {
  const [cx, cy, cz] = DOME.c;
  const point = (u: number, v: number): Point => [
    cx + DOME.a * Math.cos(v) * Math.cos(u),
    cy + DOME.b * Math.cos(v) * Math.sin(u),
    cz + DOME.h * Math.sin(v),
  ];
  const faces: Face[] = [];
  for (let j = 0; j < nv; j++) {
    const v0 = (j / nv) * (Math.PI / 2);
    const v1 = ((j + 1) / nv) * (Math.PI / 2);
    for (let i = 0; i < nu; i++) {
      const u0 = (i / nu) * 2 * Math.PI;
      const u1 = ((i + 1) / nu) * 2 * Math.PI;
      faces.push(
        j === nv - 1
          ? [point(u0, v0), point(u1, v0), point(u1, v1)]
          : [point(u0, v0), point(u1, v0), point(u1, v1), point(u0, v1)],
      );
    }
  }
  const base = Array.from({ length: nu }, (_, i): Point => [
    cx + DOME.a * Math.cos((2 * Math.PI * i) / nu),
    cy + DOME.b * Math.sin((2 * Math.PI * i) / nu),
    cz,
  ]);
  return orient([...faces, base]).slice(0, -1);
}

// Plate breaks on the hull top (z = 4).
const SEAMS: readonly (readonly Xy[])[] = [
  [
    [-9, 4],
    [-17.5, 17],
  ],
  [
    [9, 4],
    [17.5, 17],
  ],
  [
    [-7.2, -6],
    [-12, 8.5],
  ],
  [
    [7.2, -6],
    [12, 8.5],
  ],
  [
    [-6.2, 10],
    [-15.6, 13.4],
  ],
  [
    [6.2, 10],
    [15.6, 13.4],
  ],
  [
    [-1.6, -24],
    [1.6, -24],
  ],
];

function convex(points: readonly Xy[]): Xy[] {
  const keyed = new Map<string, Xy>();
  for (const [x, y] of points) {
    const p: Xy = [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
    keyed.set(`${p[0]},${p[1]}`, p);
  }
  const sorted = [...keyed.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Xy, a: Xy, b: Xy) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const chain = (list: Xy[]) => {
    const out: Xy[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, p) <= 0) {
        out.pop();
      }
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return [...chain(sorted), ...chain([...sorted].reverse())];
}

export type Astra = { speaking: false } | { speaking: true; frame: number };

export interface Scene {
  seated: boolean;
  astra: Astra;
}

// The untreated model over the in-between field, at the view's resolution.
export function renderModel(view: View, { astra, seated }: Scene): RgbaImage {
  const S = SS * view.scale;
  const width = view.width * SS;
  const height = view.height * SS;
  const lay = blankImage(width, height);
  const focus = rotate(SHIP_HEADINGS, YAW, [0, -3, 5.5]);
  const pivot: Xy = [
    FOCUS[0] - (K * (focus[0] - focus[1]) * Math.sqrt(3)) / 2,
    FOCUS[1] - K * ((focus[0] + focus[1]) / 2 - focus[2]),
  ];
  const proj = (p: Point): Xy => {
    const [x, y, z] = rotate(SHIP_HEADINGS, YAW, p);
    return [
      S * (pivot[0] + (K * (x - y) * Math.sqrt(3)) / 2 - view.x0),
      S * (pivot[1] + K * ((x + y) / 2 - z) - view.y0),
    ];
  };
  const px = (design: number) => Math.max(1, roundHalfEven(S * design));
  const colour = (material: Material, rotated: readonly Point[]) => {
    const m = material.replace("!", "");
    return m === "top" ? "ffffff" : m === "mouth" ? "64caff" : shade(m, rotated);
  };
  const drawGroup = (faces: readonly [Material, Face][], outline?: string) => {
    const items = faces
      .map(([m, f]) => ({ f, m, rotated: f.map((p) => rotate(SHIP_HEADINGS, YAW, p)) }))
      .filter(({ rotated }) => facesViewer(rotated))
      .map((item) => ({ ...item, key: -depth(item.rotated) }))
      .sort((a, b) => Number(a.m.endsWith("!")) - Number(b.m.endsWith("!")) || a.key - b.key);
    for (const { f, m, rotated } of items) {
      const fill = rgba(colour(m, rotated));
      if (outline) {
        outlinePolygon(lay, f.map(proj), fill, rgba(outline), px(1));
      } else {
        fillPolygon(lay, f.map(proj), fill);
      }
    }
  };
  const drawBase = (group: Group) => {
    drawGroup(group.faces.filter(([m]) => m !== "top"));
    for (const [, f] of group.faces.filter(([m]) => m === "top")) {
      fillPolygon(lay, f.map(proj), rgba("ffffff"));
    }
  };
  const groups = exterior();
  drawBase(groups.find(({ name }) => name === "hull")!);
  for (const seam of SEAMS) {
    polyline(
      lay,
      seam.map(([x, y]) => proj([x, y, 4])),
      rgba("c9d4e0"),
      px(1.2),
    );
  }
  for (const sign of [-1, 1]) {
    // The teal pinstripe and blue wing-edge trim.
    polyline(
      lay,
      [proj([sign * 2.6, -25.5, 4]), proj([sign * 18.6, 16.4, 4])],
      rgba("6fb7b3"),
      px(3),
    );
  }
  for (const sign of [-1, 1]) {
    polyline(
      lay,
      [proj([sign * 20.6, 19.9, 4]), proj([sign * 6.2, 15.6, 4])],
      rgba("2585d0"),
      px(2),
    );
  }
  drawBase(groups.find(({ name }) => name === "fuselage")!);
  polyline(lay, [proj([0, -27, 5]), proj([0, -16, 5])], rgba("c9d4e0"), px(1.2));

  const dome = domeFaces();
  const [cx, cy, cz] = DOME.c;
  const rest: Group[] = [
    ...groups.filter(({ name }) => name !== "hull" && name !== "fuselage"),
    { faces: [], kind: "canopy", name: "canopy" },
  ];
  const groupDepth = (g: Group) =>
    g.kind === "canopy"
      ? depth([rotate(SHIP_HEADINGS, YAW, [cx, cy, cz + 1.5])])
      : depth(g.faces.flatMap(([, f]) => f.map((p) => rotate(SHIP_HEADINGS, YAW, p))));
  for (const group of rest.sort((a, b) => -groupDepth(a) - -groupDepth(b))) {
    if (group.kind === "canopy") {
      drawCanopy();
    } else {
      drawGroup(group.faces);
    }
  }
  // Nav lights: coral port wingtip, teal starboard wingtip, blue fin tip.
  const lights: readonly (readonly [Point, string])[] = [
    [[-20.2, 19.2, 4.2], "d68b72"],
    [[20.2, 19.2, 4.2], "65c9bf"],
    [[0, 22.6, 16.4], "70ace8"],
  ];
  for (const [p, c] of lights) {
    const [x, y] = proj(p);
    const r = S * 3.2;
    glow([x, y], r * 2.4, rgba(c, 70), Math.max(0.5, S * 2));
    disc(lay, [x, y], r, rgba(c));
    fillEllipse(lay, [x - r * 0.4, y - r * 0.6, x + r * 0.2, y], rgba("ffffff"));
  }

  function glow(centre: Xy, r: number, fill: ReturnType<typeof rgba>, sigma: number) {
    const layer = blankImage(width, height);
    disc(layer, centre, r, fill);
    blur(layer, sigma, [centre[0] - r, centre[1] - r, centre[0] + r, centre[1] + r]);
    over(lay, layer);
  }

  function drawCanopy() {
    const back: [Face, Point[]][] = [];
    const front: [Face, Point[]][] = [];
    for (const f of dome) {
      const rotated = f.map((p) => rotate(SHIP_HEADINGS, YAW, p));
      (facesViewer(rotated) ? front : back).push([f, rotated]);
    }
    const glass = (faces: readonly [Face, Point[]][], alpha: number) => {
      const layer = blankImage(width, height);
      for (const [f, rotated] of faces) {
        const lit = 0.5 + 0.5 * dot(newell(rotated), LIGHT);
        const tint: [number, number, number, number] = [
          Math.trunc(60 + 180 * lit ** 2),
          Math.trunc(140 + 110 * lit ** 2),
          Math.trunc(215 + 40 * lit),
          Math.trunc(alpha * (0.4 + 1.2 * lit * lit)),
        ];
        fillPolygon(layer, f.map(proj), tint);
      }
      over(lay, layer);
    };
    glass(back, 34);
    const inner = interior();
    const key = (g: Group) =>
      g.kind === "flat"
        ? -1e9
        : -depth(g.faces.flatMap(([, f]) => f.map((p) => rotate(SHIP_HEADINGS, YAW, p))));
    let headsDone = false;
    for (const group of inner.sort((a, b) => key(a) - key(b))) {
      if (group.kind === "flat") {
        for (const [, f] of group.faces) {
          fillPolygon(lay, f.map(proj), rgba(RAMPS.floor![1]!));
        }
        continue;
      }
      if (group.name.startsWith("back") && seated && !headsDone) {
        // The backrests hide all but the tops of the heads.
        for (const [c, r, hc] of HEADS) {
          const [x, y] = proj(c);
          const rr = S * r * 11 * 0.95;
          fillEllipse(lay, [x - rr, y - rr * 0.9, x + rr, y + rr * 0.9], rgba(hc));
        }
        headsDone = true;
      }
      const outlined = ["back", "cush", "ped"].some((p) => group.name.startsWith(p));
      drawGroup(group.faces, outlined ? "2c5f63" : undefined);
    }
    // Astra: a rose-gold lens on the dash that glows warm while she speaks.
    const [ax, ay] = proj([0, -11, 5.3]);
    const rr = S * 2.8;
    disc(lay, [ax, ay], rr * 1.25, rgba("d9a08a"));
    disc(lay, [ax, ay], rr, rgba("3b2a3f"));
    if (astra.speaking) {
      const f = astra.frame;
      glow([ax, ay], rr * [3.2, 3.6, 4, 3.6][f]!, rgba("ffc9a8", 210), S * 3);
      disc(lay, [ax, ay], rr * [0.7, 0.8, 0.9, 0.8][f]!, rgba("fff1e0"));
    } else {
      disc(lay, [ax, ay], rr * 0.45, rgba("9a6470"));
    }
    glass(front, 62);
    // A light edge around the bubble's outline.
    const outline = convex(dome.flatMap((f) => f.map(proj)));
    const edge = blankImage(width, height);
    polyline(edge, [...outline, outline[0]!], [225, 240, 255, 190], px(2), true);
    over(lay, edge);
    // The blue rim where the bubble meets the fuselage.
    const rim = ellipsePoints(cx, cy, DOME.a, DOME.b, 40).map(([x, y]) => proj([x, y, cz]));
    polyline(lay, [...rim, rim[0]!], rgba("1767b3"), px(4), true);
    const lifted = rim.map(([x, y]): Xy => [x, y - S * 1.5]);
    polyline(lay, [...lifted, lifted[0]!], rgba("2585d0"), px(2), true);
    // A soft highlight across the upper left of the bubble.
    const arc = Array.from({ length: 21 }, (_, t) => {
      const u = ((150 + t * 4.5) * Math.PI) / 180;
      const v = (52 * Math.PI) / 180;
      return proj([
        cx + DOME.a * Math.cos(v) * Math.cos(u),
        cy + DOME.b * Math.cos(v) * Math.sin(u),
        cz + DOME.h * Math.sin(v),
      ]);
    });
    const bounds = (points: readonly Xy[], pad: number): [number, number, number, number] => [
      Math.min(...points.map(([x]) => x)) - pad,
      Math.min(...points.map(([, y]) => y)) - pad,
      Math.max(...points.map(([x]) => x)) + pad,
      Math.max(...points.map(([, y]) => y)) + pad,
    ];
    for (const [points, w, alpha, sigma] of [
      [arc, px(7), 150, Math.max(0.5, S * 2.5)],
      [arc.slice(4, 14), px(2), 170, S * 0.6],
    ] as const) {
      const layer = blankImage(width, height);
      polyline(layer, points, [255, 255, 255, alpha], w, true);
      blur(layer, sigma, bounds(points, w));
      over(lay, layer);
    }
  }

  const out = shimmer(view);
  over(out, resize(lay, view.width, view.height));
  return out;
}

// Treatment d: a 1.2 design px blur, 25% desaturation and a haze of the space background from
// 22% at the frame's top to 72% at its bottom (ease-in), held beyond the frame.
export function treat(view: View, image: RgbaImage): RgbaImage {
  const blurred = { ...image, data: image.data.slice() };
  blur(blurred, 1.2 * view.scale);
  const out = blend(blurred, grey(blurred), 0.25);
  const haze = blankImage(view.width, view.height);
  const [r, g, b] = rgba(SPACE_BG);
  for (let y = 0; y < view.height; y++) {
    const t = Math.max(0, Math.min(1, (view.y0 + y / view.scale) / (DESIGN.height - 1)));
    const alpha = Math.trunc(255 * (0.22 + 0.5 * t * t));
    for (let x = 0; x < view.width; x++) {
      haze.data.set([r!, g!, b!, alpha], (y * view.width + x) * 4);
    }
  }
  over(out, haze);
  return out;
}

export const cockpit = (view: View, scene: Scene) => treat(view, renderModel(view, scene));

// Smallest even-aligned rectangle holding every pixel that differs between a and any of others.
function changed(a: RgbaImage, others: readonly RgbaImage[]) {
  let [x0, y0, x1, y1] = [a.width, a.height, -1, -1];
  for (const b of others) {
    for (let y = 0; y < a.height; y++) {
      for (let x = 0; x < a.width; x++) {
        const i = (y * a.width + x) * 4;
        if (
          a.data[i] !== b.data[i] ||
          a.data[i + 1] !== b.data[i + 1] ||
          a.data[i + 2] !== b.data[i + 2]
        ) {
          [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
        }
      }
    }
  }
  x0 -= x0 % 2;
  y0 -= y0 % 2;
  x1 += 2 - (x1 % 2);
  y1 += 2 - (y1 % 2);
  return { height: y1 - y0, width: x1 - x0, x: x0, y: y0 };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const view = centredView(CANVAS.width, CANVAS.height, CANVAS.density);
  const idle: Astra = { speaking: false };
  const empty = cockpit(view, { astra: idle, seated: false });
  const seated = cockpit(view, { astra: idle, seated: true });
  writePng(`${art}cockpit.png`, empty, true);
  writePng(`${art}cockpit-seated.png`, seated, true);
  const speaking = [0, 1, 2, 3].map((frame) =>
    cockpit(view, { astra: { frame, speaking: true }, seated: true }),
  );
  // Astra's glow changes only the pixels round the dash lens, so it ships as patches over
  // either background: the rectangle covers every speaking frame and must match there.
  const patch = changed(seated, speaking);
  const cut = (image: RgbaImage) => region(image, patch.x, patch.y, patch.width, patch.height);
  if (changed(cut(empty), [cut(seated)]).width > 2) {
    throw new Error("The seated heads reach Astra's patch");
  }
  const sheet = filled(rgba(SPACE_BG), patch.width * speaking.length, patch.height);
  speaking.forEach((frame, i) => over(sheet, cut(frame), i * patch.width, 0));
  writePng(`${art}cockpit-astra.png`, sheet, true);

  const d = CANVAS.density;
  const background = (id: string) => ({
    id,
    path: `/art/${id}.png`,
    width: view.width,
    height: view.height,
    displayWidth: CANVAS.width,
    displayHeight: CANVAS.height,
    facing: "front",
    pivot: { x: 0.5, y: 0.5 },
  });
  placeEntries("cockpit", [
    background("cockpit"),
    background("cockpit-seated"),
    {
      id: "cockpit-astra",
      path: "/art/cockpit-astra.png",
      width: sheet.width,
      height: sheet.height,
      displayWidth: patch.width / d,
      displayHeight: patch.height / d,
      facing: "front",
      pivot: { x: 0, y: 0 },
      frameWidth: patch.width,
      frameHeight: patch.height,
      frames: { speak1: 0, speak2: 1, speak3: 2, speak4: 3 },
      loop: [0, 1, 2, 3].map((frame) => ({ frame, name: `speak${frame + 1}`, ms: SPEAK_MS })),
      at: { x: patch.x / d, y: patch.y / d },
    },
  ]);
}
