// Close-up of Ada's ship for the cockpit background: the game's isometric projection at
// heading 24 with the in-game pyramid hull, a clear canopy and the seats inside.
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

// The Classic paint of the in-game ship (art/tools/ship.ts).
const PAINT = {
  canopyHighlight: "87bce5",
  canopyRoof: "2585d0",
  canopySides: "1767b3",
  frontSides: "d4dfe9",
  mouth: "64caff",
  rearSides: "abbfce",
  recess: "0f4e8f",
  top: "ffffff",
} as const;

const RAMPS: Readonly<Record<string, readonly string[]>> = {
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
interface Group {
  name: string;
  faces: [Material, Face][];
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

const turned = (points: readonly Point[]) => points.map((p) => rotate(SHIP_HEADINGS, YAW, p));
const lit = (points: readonly Point[]) => dot(newell(turned(points)), LIGHT);

// Flat shading: the lit fraction picks a step of the material's ramp.
function shade(material: Material, rotated: readonly Point[]): string {
  const ramp = RAMPS[material]!;
  const v = 0.5 + 0.5 * dot(newell(rotated), LIGHT);
  return ramp[Math.max(0, Math.min(ramp.length - 1, Math.trunc(v * ramp.length)))]!;
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

const solid = (name: string, material: Material, faces: readonly Face[]): Group => ({
  faces: orient(faces).map((f) => [material, f]),
  name,
});

// The in-game pyramid hull (art/tools/ship.ts), copied so the close-up does not change when
// the sprite model does.
const HULL = {
  plan: [
    [-100, 0],
    [64, -67],
    [49, -17],
    [76, 0],
    [49, 17],
    [64, 67],
  ],
  skirt: 1.2,
  shoulder: [0, 6, 7.5],
  apex: [0, 17, 15],
  lean: 76,
} as const;

// Swapping plan axes reverses winding; reverse to retain upward-facing tops.
function plan(z: number): Point[] {
  return HULL.plan.map(([x, y]): Point => [y * 0.32, x * 0.32, z]).toReversed();
}

type Plane = { readonly d: number; readonly n: Point };

const minus = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

const cross = (a: Point, b: Point): Point => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

function through(p: Point, q: Point, r: Point): Plane {
  const n = cross(minus(q, p), minus(r, p));
  return { d: dot(n, p), n };
}

// The rear-facing plane that rises from plan edge a-b at the lean.
function leaning(a: Point, b: Point): Plane {
  const [ex, ey] = [b[0] - a[0], b[1] - a[1]];
  const sign = Math.sign(ex) / Math.hypot(ex, ey);
  const lean = (HULL.lean * Math.PI) / 180;
  const n: Point = [-ey * sign * Math.sin(lean), ex * sign * Math.sin(lean), Math.cos(lean)];
  return { d: dot(n, a), n };
}

function meet(p: Plane, q: Plane, r: Plane): Point {
  const [qr, rp, pq] = [cross(q.n, r.n), cross(r.n, p.n), cross(p.n, q.n)];
  const det = dot(p.n, qr);
  const at = (i: number) => (p.d * qr[i]! + q.d * rp[i]! + r.d * pq[i]!) / det;
  return [at(0), at(1), at(2)];
}

function vertices() {
  const [tipR, notchR, tail, notchL, tipL, nose] = plan(HULL.skirt) as [
    Point,
    Point,
    Point,
    Point,
    Point,
    Point,
  ];
  const { apex, shoulder } = HULL;
  const corner = (tip: Point, notch: Point) =>
    meet(through(shoulder, tip, apex), leaning(tip, notch), through(notch, tail, apex));
  return {
    apex,
    cornerL: corner(tipL, notchL),
    cornerR: corner(tipR, notchR),
    nose,
    notchL,
    notchR,
    shoulder,
    tail,
    tipL,
    tipR,
  };
}

type Part = "side" | "steep" | "wall" | "wing";

function upperFaces(): { part: Part; points: Point[] }[] {
  const v = vertices();
  const up = (points: Point[]) => (newell(points)[2] < 0 ? points.toReversed() : points);
  const sides = [
    [v.tipL, v.notchL, v.cornerL],
    [v.tipR, v.notchR, v.cornerR],
  ] as const;
  const faces = (part: Part, pick: (side: (typeof sides)[number]) => Point[]) =>
    sides.map((side) => ({ part, points: up(pick(side)) }));
  return [
    ...faces("wing", ([tip]) => [v.nose, tip, v.shoulder]),
    ...faces("steep", ([tip, , corner]) => [v.shoulder, tip, corner, v.apex]),
    ...faces("wall", ([tip, notch, corner]) => [tip, notch, corner]),
    ...faces("side", ([, notch, corner]) => [notch, v.tail, v.apex, corner]),
  ];
}

// Hull surface height under the canopy: the lower of the two wing planes.
function roof(x: number, y: number): number {
  const v = vertices();
  const height = ({ d, n }: Plane) => (d - n[0] * x - n[1] * y) / n[2];
  return Math.min(
    height(through(v.nose, v.tipL, v.shoulder)),
    height(through(v.nose, v.shoulder, v.tipR)),
  );
}

// The sprite's paint rule at this heading: walls in the canopy side colour, the brightest other
// face top, wing faces front sides at light 0.6 or more (else rear sides), steep faces and tail
// sides top at 0.45 or more (else front sides), each taking its first preference that no
// brighter neighbour sharing an edge already has.
function hullColours(upper: readonly { part: Part; points: Point[] }[]): Map<number, string> {
  const key = (p: Point) => p.map((c) => c.toFixed(4)).join(",");
  const edges = upper.map(({ points }) =>
    points.map((p, j) => [key(p), key(points[(j + 1) % points.length]!)].toSorted().join("|")),
  );
  const touches = (i: number, j: number) => edges[i]!.some((edge) => edges[j]!.includes(edge));
  const ranked = upper
    .map(({ part, points }, i) => ({
      i,
      light: lit(points),
      part,
      shown: facesViewer(turned(points)),
    }))
    .filter(({ shown }) => shown)
    .toSorted((a, b) => b.light - a.light);
  const { frontSides, rearSides, top } = PAINT;
  const prefer = (part: Part, light: number, brightest: boolean): string[] =>
    part === "wall"
      ? [PAINT.canopySides]
      : brightest
        ? [top]
        : part === "wing"
          ? light >= 0.6
            ? [frontSides, rearSides]
            : [rearSides, frontSides]
          : light >= 0.45
            ? [top, frontSides]
            : [frontSides, top];
  const colour = new Map<number, string>();
  const lead = ranked.find(({ part }) => part !== "wall");
  for (const [rank, { i, light, part }] of ranked.entries()) {
    const taken = new Set(
      ranked
        .slice(0, rank)
        .filter(({ i: j }) => touches(i, j))
        .map(({ i: j }) => colour.get(j)),
    );
    const options = prefer(part, light, lead?.i === i);
    colour.set(i, options.find((option) => !taken.has(option)) ?? options[0]!);
  }
  return colour;
}

// Engine mouth on the sign side's wall, |x| inset from inner to outer and z from the skirt top
// by low to high (kept 0.6 under the wall's top edge), lifted 0.03 off the wall.
function mouth(sign: number, inset = 0): Face {
  const v = vertices();
  const [tip, notch, corner] =
    sign === 1 ? [v.tipR, v.notchR, v.cornerR] : [v.tipL, v.notchL, v.cornerL];
  const { d, n } = leaning(tip, notch);
  const at = (x: number, z: number): Point => [x, (d - n[0] * x - n[2] * z) / n[1] + 0.03, z];
  const edge = (x: number) => tip[2] + ((corner[2] - tip[2]) * (x - tip[0])) / (corner[0] - tip[0]);
  const [inner, outer] = [9.5 + inset, 15 - inset];
  const z0 = HULL.skirt + 0.3 + inset;
  const top = (x: number) => Math.min(HULL.skirt + 2.6, edge(x) - 0.6) - inset;
  return toward(
    [
      at(sign * outer, z0),
      at(sign * inner, z0),
      at(sign * inner, top(sign * inner)),
      at(sign * outer, top(sign * outer)),
    ],
    [0, 1, 0],
  );
}

// The sprite's chubby canopy, finer: plan semi-axes a and b round local Y centre, the crown
// level h above the hull at the centre, each ring rising sin(latitude) of the way from the hull
// surface to the crown. The rings below `band` degrees are the blue sill.
const CANOPY = { a: 9, b: 9, centre: -3, h: 2.8, segments: 48, rings: 12, band: 30 };
const CROWN = roof(0, CANOPY.centre) + CANOPY.h;

function canopyPoint(theta: number, phi: number): Point {
  const { a, b, centre } = CANOPY;
  const x = a * Math.cos(phi) * Math.cos(theta);
  const y = centre + b * Math.cos(phi) * Math.sin(theta);
  const base = roof(x, y);
  return [x, y, base + (CROWN - base) * Math.sin(phi)];
}

function domeFaces(): { band: boolean; face: Face }[] {
  const { band, rings, segments } = CANOPY;
  const middle: Point = [0, CANOPY.centre, roof(0, CANOPY.centre) - 2];
  const out: { band: boolean; face: Face }[] = [];
  for (let ring = 0; ring < rings; ring++) {
    const [p0, p1] = [ring, ring + 1].map((r) => (r / rings) * (Math.PI / 2)) as [number, number];
    for (let u = 0; u < segments; u++) {
      const [t0, t1] = [u, u + 1].map((s) => (s / segments) * 2 * Math.PI) as [number, number];
      const face: Face =
        ring === rings - 1
          ? [canopyPoint(t0, p0), canopyPoint(t1, p0), canopyPoint(t0, p1)]
          : [canopyPoint(t0, p0), canopyPoint(t1, p0), canopyPoint(t1, p1), canopyPoint(t0, p1)];
      const mid = centroid(face);
      out.push({
        band: (p1 * 180) / Math.PI <= band,
        face: toward(face, minus(mid, middle)),
      });
    }
  }
  return out;
}

// The cockpit tub under the canopy, sunk into the hull: a floor ring inset from the canopy's
// base and kept under the hull surface, and the tub's inner walls between them.
const FLOOR_Z = 3.8;

function tub(): { floor: Face; walls: Face[] } {
  const { centre, segments } = CANOPY;
  const base = Array.from({ length: segments }, (_, u) =>
    canopyPoint((u / segments) * 2 * Math.PI, 0),
  );
  const floor = base.map(([x, y, z]): Point => [
    x * 0.9,
    centre + (y - centre) * 0.9,
    Math.min(FLOOR_Z, z - 0.4),
  ]);
  const walls = base.map((a, u): Face => {
    const j = (u + 1) % segments;
    const face: Face = [a, base[j]!, floor[j]!, floor[u]!];
    const mid = centroid(face);
    return toward(face, [-mid[0], centre - mid[1], 0]);
  });
  return { floor, walls };
}

// Seats sit on the tub floor; Ada's is port (-3), upper left on screen at heading 24, Penny's
// starboard. Astra's lens sits on the dash's rear face at (0, -9, 5.3).
const SEATS = [-3, 3] as const;
const LENS: Point = [0, -9, 5.3];

function interior(): Group[] {
  const f = FLOOR_Z;
  const groups: Group[] = [
    solid("dash", "floor", box(-1.8, 1.8, -9.4, -9, f, 5.6)),
    solid("console", "floor", box(-0.5, 0.5, -9, -3.5, f, 4.5)),
  ];
  for (const sx of SEATS) {
    groups.push(solid(`ped${sx}`, "teal", box(sx - 0.7, sx + 0.7, -2.4, -1, f, f + 0.5)));
    const c0 = f + 0.5;
    const cushion: Xy[] = [
      [sx - 1.6, c0],
      [sx + 1.6, c0],
      [sx + 1.6, c0 + 0.45],
      [sx + 1.35, c0 + 0.7],
      [sx - 1.35, c0 + 0.7],
      [sx - 1.6, c0 + 0.45],
    ];
    groups.push(solid(`cush${sx}`, "teal", prism(cushion, -3.5, -0.1)));
    // A reclined tombstone backrest.
    const hw = 1.5;
    const r = 1;
    const top = c0 + 2.7;
    const profile: Xy[] = [[sx - hw, c0]];
    for (let i = 0; i < 9; i++) {
      const a = Math.PI - (i * Math.PI) / 8;
      profile.push([
        sx + (hw - r) * (Math.cos(a) > 0 ? 1 : -1) + r * Math.cos(a),
        top - r + r * Math.sin(a),
      ]);
    }
    profile.push([sx + hw, c0]);
    const lean = (y: number, v: number) => y + (0.55 * (v - c0)) / 2.7;
    const f0: Face = profile.map(([u, v]) => [u, lean(-0.2, v), v]);
    const f1: Face = profile.map(([u, v]) => [u, lean(0.6, v), v]);
    const faces: [Material, Face][] = [
      ["teal", f0],
      ["teal", [...f1].reverse()],
    ];
    for (let i = 0; i < profile.length; i++) {
      const j = (i + 1) % profile.length;
      const cap = profile[i]![1] > top - 0.35 && profile[j]![1] > top - 0.35;
      faces.push([cap ? "cream" : "teal", [f0[i]!, f0[j]!, f1[j]!, f1[i]!]]);
    }
    const oriented = orient(faces.map(([, face]) => face));
    groups.push({ faces: faces.map(([m], i) => [m, oriented[i]!]), name: `back${sx}` });
  }
  return groups;
}

// Seated tops of Ada's and Penny's heads: Ada's navy hair with a pink bow, Penny's golden head
// and orange ears (Archie's golden dog).
const HEADS: readonly (readonly [Point, number, string])[] = [
  [[-3, -1.4, 6.55], 1.3, "262b44"],
  [[-3.2, -1.7, 6.9], 0.76, "3a4466"],
  [[-3, -1.1, 7.5], 0.45, "f6757a"],
  [[1.95, -1.5, 6.45], 0.54, "f77622"],
  [[4.05, -1.5, 6.45], 0.54, "f77622"],
  [[3, -1.8, 6.45], 1.08, "feae34"],
  [[3, -2.1, 7], 0.5, "fee761"],
];

function convex(points: readonly Xy[]): Xy[] {
  const keyed = new Map<string, Xy>();
  for (const [x, y] of points) {
    const p: Xy = [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
    keyed.set(`${p[0]},${p[1]}`, p);
  }
  const sorted = [...keyed.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const crossXy = (o: Xy, a: Xy, b: Xy) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const chain = (list: Xy[]) => {
    const out: Xy[] = [];
    for (const p of list) {
      while (out.length >= 2 && crossXy(out[out.length - 2]!, out[out.length - 1]!, p) <= 0) {
        out.pop();
      }
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return [...chain(sorted), ...chain([...sorted].reverse())];
}

// Keep a layer's pixels only where the mask is drawn.
function clip(layer: RgbaImage, mask: RgbaImage): void {
  for (let i = 3; i < layer.data.length; i += 4) {
    layer.data[i] = Math.round((layer.data[i]! * mask.data[i]!) / 255);
  }
}

const mix = (a: string, b: string, t: number): [number, number, number] => {
  const [ar, ag, ab] = rgba(a);
  const [br, bg, bb] = rgba(b);
  return [ar! + (br! - ar!) * t, ag! + (bg! - ag!) * t, ab! + (bb! - ab!) * t].map(Math.round) as [
    number,
    number,
    number,
  ];
};

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
  // Visible faces, far to near.
  const visible = <T extends { points: Face }>(faces: readonly T[]) =>
    faces
      .map((item) => ({ item, rotated: turned(item.points) }))
      .filter(({ rotated }) => facesViewer(rotated))
      .toSorted((a, b) => depth(b.rotated) - depth(a.rotated))
      .map(({ item, rotated }) => ({ ...item, rotated }));
  const paint = (target: RgbaImage, faces: readonly { colour: string; points: Face }[]) => {
    for (const { colour, points } of visible(faces)) {
      fillPolygon(target, points.map(proj), rgba(colour));
    }
  };
  const drawGroup = (target: RgbaImage, faces: readonly [Material, Face][], outline?: string) => {
    const items = visible(faces.map(([m, points]) => ({ m, points })));
    for (const { m, points, rotated } of items) {
      const fill = rgba(shade(m, rotated));
      if (outline) {
        outlinePolygon(target, points.map(proj), fill, rgba(outline), px(1));
      } else {
        fillPolygon(target, points.map(proj), fill);
      }
    }
  };

  // Skirt: the right wing's trailing and leading edges front sides, the rest rear sides.
  const outline = plan(HULL.skirt);
  const skirt = outline.map((b, i) => {
    const a = outline[(i + 1) % outline.length]!;
    return {
      colour: i === 0 || i === 5 ? PAINT.frontSides : PAINT.rearSides,
      points: [a, b, [b[0], b[1], 0], [a[0], a[1], 0]] as Face,
    };
  });
  const upper = upperFaces();
  const colours = hullColours(upper);
  const hull = upper.map(({ part, points }, i) => ({
    colour: colours.get(i) ?? PAINT.rearSides,
    part,
    points,
  }));
  paint(lay, skirt);
  paint(
    lay,
    hull.filter(({ part }) => part === "wing"),
  );
  // Plate seams on the wing faces, a shade darker than each face.
  const v = vertices();
  const lerp = (a: Point, b: Point, t: number): Point => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
  for (const [i, tip] of [v.tipL, v.tipR].entries()) {
    const [r, g, b] = mix(hull[i]!.colour, PAINT.rearSides, 0.45);
    for (const [from, to] of [
      [lerp(v.nose, tip, 0.62), lerp(v.shoulder, tip, 0.5)],
      [lerp(v.nose, tip, 0.3), lerp(v.nose, v.shoulder, 0.55)],
    ] as const) {
      polyline(lay, [proj(from), proj(to)], [r, g, b, 255], px(1.2));
    }
  }
  drawCanopy();
  // The rear points toward the viewer at this heading, so the tail faces draw after the canopy.
  paint(
    lay,
    hull.filter(({ part }) => part !== "wing"),
  );
  for (const sign of [-1, 1]) {
    fillPolygon(lay, mouth(sign).map(proj), rgba(PAINT.recess));
    fillPolygon(lay, mouth(sign, 0.3).map(proj), rgba(PAINT.mouth));
  }
  // Nav lights: coral port wingtip, teal starboard wingtip, blue tail apex.
  const lights: readonly (readonly [Point, string, number])[] = [
    [[-20.6, 19.9, 1.3], "d68b72", 3.2],
    [[20.6, 19.9, 1.3], "65c9bf", 3.2],
    [[0, 17, 15], "70ace8", 2.4],
  ];
  for (const [p, c, size] of lights) {
    const [x, y] = proj(p);
    const r = S * size;
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
    const dome = domeFaces();
    const back = dome.filter(({ face }) => !facesViewer(turned(face)));
    const front = dome.filter(({ face }) => facesViewer(turned(face)));
    // Blue glass: the sill band denser in the canopy side colour, the rest the roof colour
    // lifted toward the highlight where the light falls.
    const glass = (faces: readonly { band: boolean; face: Face }[], alpha: number) => {
      const layer = blankImage(width, height);
      for (const { band, face } of faces) {
        const light = Math.max(0, lit(face));
        const [r, g, b] = band
          ? mix(PAINT.canopySides, PAINT.canopyRoof, light * 0.5)
          : mix(PAINT.canopyRoof, PAINT.canopyHighlight, light ** 2);
        const a = band ? Math.min(255, alpha * 2.2) : alpha * (0.6 + 0.8 * light ** 2);
        fillPolygon(layer, face.map(proj), [r, g, b, Math.round(a)]);
      }
      over(lay, layer);
    };
    const silhouette = convex(dome.flatMap(({ face }) => face.map(proj)));
    // The dark blue seam where the canopy meets the hull: the far arc behind the tub, the near
    // arc over the glass.
    const stroke = (run: readonly Xy[]) => {
      if (run.length > 1) {
        polyline(lay, run, rgba(PAINT.recess), px(2.5), true);
      }
    };
    const seam = (near: boolean) => {
      let run: Xy[] = [];
      for (let u = 0; u <= 96; u++) {
        const theta = (u / 96) * 2 * Math.PI;
        const out = rotate(SHIP_HEADINGS, YAW, [Math.cos(theta), Math.sin(theta), 0]);
        if (out[0] + out[1] > 0 === near) {
          run.push(proj(canopyPoint(theta, 0)));
        } else {
          stroke(run);
          run = [];
        }
      }
      stroke(run);
    };
    glass(back, 40);
    seam(false);
    // The tub and seats, clipped to the canopy's outline: the near hull hides the rest.
    const inside = blankImage(width, height);
    const { floor, walls } = tub();
    drawGroup(
      inside,
      walls.map((w): [Material, Face] => ["dark", w]),
    );
    fillPolygon(inside, floor.map(proj), rgba(RAMPS.floor![1]!));
    const key = (g: Group) => -depth(g.faces.flatMap(([, f]) => turned(f)));
    let headsDone = false;
    for (const group of interior().toSorted((a, b) => key(a) - key(b))) {
      if (group.name.startsWith("back") && seated && !headsDone) {
        // The backrests hide all but the tops of the heads.
        for (const [c, r, hc] of HEADS) {
          const [x, y] = proj(c);
          const rr = S * r * 11 * 0.95;
          fillEllipse(inside, [x - rr, y - rr * 0.9, x + rr, y + rr * 0.9], rgba(hc));
        }
        headsDone = true;
      }
      const outlined = ["back", "cush", "ped"].some((p) => group.name.startsWith(p));
      drawGroup(inside, group.faces, outlined ? "2c5f63" : undefined);
    }
    const mask = blankImage(width, height);
    fillPolygon(mask, silhouette, [255, 255, 255, 255]);
    clip(inside, mask);
    over(lay, inside);
    // Astra: a rose-gold lens on the dash that glows warm while she speaks.
    const [ax, ay] = proj(LENS);
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
    glass(front, 64);
    // A light edge around the canopy's outline.
    const edge = blankImage(width, height);
    polyline(edge, [...silhouette, silhouette[0]!], [225, 240, 255, 150], px(2), true);
    over(lay, edge);
    seam(true);
    // A soft highlight across the upper left of the canopy.
    const arc = Array.from({ length: 21 }, (_, t) =>
      proj(canopyPoint(((150 + t * 4.5) * Math.PI) / 180, (55 * Math.PI) / 180)),
    );
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
  placeEntries("core", "cockpit", [
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
