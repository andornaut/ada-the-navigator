// Close-up of Ada's ship for the cockpit background: the game's isometric projection at
// heading 24 with the in-game pyramid hull and its opaque canopy enlarged.
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
  over,
  polyline,
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

// Light from the upper left, slightly behind the viewer.
const LIGHT = ((v: Point) =>
  v.map((c) => c / Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])) as unknown as Point)([
  -0.25, 0.45, 1,
]);

type Face = Point[];

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

const centroid = (points: readonly Point[]): Point =>
  [0, 1, 2].map((i) => points.reduce((s, p) => s + p[i]!, 0) / points.length) as unknown as Point;

const toward = (f: Face, ref: Point): Face => (dot(newell(f), ref) >= 0 ? f : [...f].reverse());

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
// surface to the crown. The rings below `band` degrees are the darker lower band.
const CANOPY = { a: 9, b: 9, centre: -3, h: 2.8, segments: 48, rings: 12, band: 30 };
const CROWN = roof(0, CANOPY.centre) + CANOPY.h;

function canopyPoint(theta: number, phi: number): Point {
  const { a, b, centre } = CANOPY;
  const x = a * Math.cos(phi) * Math.cos(theta);
  const y = centre + b * Math.cos(phi) * Math.sin(theta);
  const base = roof(x, y);
  return [x, y, base + (CROWN - base) * Math.sin(phi)];
}

// The dome's facets between ring latitudes (degrees) in `segments` steps, wound outward.
function shell(segments: number, rings: readonly number[]): { band: boolean; face: Face }[] {
  const middle: Point = [0, CANOPY.centre, roof(0, CANOPY.centre) - 2];
  const out: { band: boolean; face: Face }[] = [];
  for (let ring = 0; ring < rings.length - 1; ring++) {
    const [p0, p1] = [rings[ring]!, rings[ring + 1]!].map((r) => (r * Math.PI) / 180) as [
      number,
      number,
    ];
    for (let u = 0; u < segments; u++) {
      const [t0, t1] = [u, u + 1].map((s) => (s / segments) * 2 * Math.PI) as [number, number];
      const face: Face =
        rings[ring + 1] === 90
          ? [canopyPoint(t0, p0), canopyPoint(t1, p0), canopyPoint(t0, p1)]
          : [canopyPoint(t0, p0), canopyPoint(t1, p0), canopyPoint(t1, p1), canopyPoint(t0, p1)];
      out.push({
        band: rings[ring + 1]! <= CANOPY.band,
        face: toward(face, minus(centroid(face), middle)),
      });
    }
  }
  return out;
}

const domeFaces = () =>
  shell(
    CANOPY.segments,
    Array.from({ length: CANOPY.rings + 1 }, (_, r) => (r * 90) / CANOPY.rings),
  );

// The sprite's own 16 by 3 facets; its two facets facing the light most directly carry the
// highlight, so the close-up's highlight covers the same patch of the dome.
function spriteHighlight(): Face[] {
  return shell(16, [0, 30, 60, 90])
    .map(({ face }) => ({ face, light: lit(face) }))
    .toSorted((a, b) => b.light - a.light)
    .slice(0, 2)
    .map(({ face }) => face);
}

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

// The untreated model over the in-between field, at the view's resolution.
export function renderModel(view: View): RgbaImage {
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
      .map(({ item }) => item);
  const paint = (target: RgbaImage, faces: readonly { colour: string; points: Face }[]) => {
    for (const { colour, points } of visible(faces)) {
      fillPolygon(target, points.map(proj), rgba(colour));
    }
  };
  const bounds = (points: readonly Xy[], pad: number): [number, number, number, number] => [
    Math.min(...points.map(([x]) => x)) - pad,
    Math.min(...points.map(([, y]) => y)) - pad,
    Math.max(...points.map(([x]) => x)) + pad,
    Math.max(...points.map(([, y]) => y)) + pad,
  ];
  // A transparent layer in one colour, so blurring it leaves no dark fringe.
  const clear = ([r, g, b]: ReturnType<typeof rgba>) => filled([r!, g!, b!, 0], width, height);
  // A soft disc of light, optionally kept inside a mask.
  const glow = (
    centre: Xy,
    r: number,
    fill: ReturnType<typeof rgba>,
    sigma: number,
    mask?: RgbaImage,
  ) => {
    const layer = clear(fill);
    disc(layer, centre, r, fill);
    blur(layer, sigma, [centre[0] - r, centre[1] - r, centre[0] + r, centre[1] + r]);
    if (mask) {
      clip(layer, mask);
    }
    over(lay, layer);
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

  function drawCanopy() {
    const dome = domeFaces();
    const silhouette = convex(dome.flatMap(({ face }) => face.map(proj)));
    const mask = blankImage(width, height);
    fillPolygon(mask, silhouette, [255, 255, 255, 255]);
    // Opaque like the sprite: a roof-coloured underlay under the outline hides seams between
    // facets, then the darker lower band in the side colour and the roof colour lifted a little
    // where the light falls.
    fillPolygon(lay, silhouette, rgba(PAINT.canopyRoof));
    for (const { band, points } of visible(
      dome.map(({ band, face }) => ({ band, points: face })),
    )) {
      const light = Math.max(0, lit(points));
      const [r, g, b] = band
        ? mix(PAINT.canopySides, PAINT.canopyRoof, 0.25 * light)
        : mix(PAINT.canopyRoof, PAINT.canopyHighlight, 0.35 * light ** 2);
      fillPolygon(lay, points.map(proj), [r, g, b, 255]);
    }
    // The sprite's highlight facets softened into a specular patch, with a glint at the
    // brightest one.
    const facets = spriteHighlight();
    const spot = clear(rgba(PAINT.canopyHighlight));
    for (const face of facets) {
      fillPolygon(spot, face.map(proj), rgba(PAINT.canopyHighlight));
    }
    blur(spot, S * 5, bounds(facets.flat().map(proj), px(16)));
    clip(spot, mask);
    over(lay, spot);
    glow(proj(centroid(facets[0]!)), S * 4, rgba("ffffff", 150), S * 2, mask);
    // A thin rim of light along the upper left edge.
    const arc = Array.from({ length: 21 }, (_, t) =>
      proj(canopyPoint(((140 + t * 5) * Math.PI) / 180, (35 * Math.PI) / 180)),
    );
    const rim = clear(rgba("ffffff"));
    polyline(rim, arc, [255, 255, 255, 90], px(1.6), true);
    blur(rim, S * 0.8, bounds(arc, px(2)));
    clip(rim, mask);
    over(lay, rim);
    // The dark blue seam where the canopy meets the hull, on the near arc; the dome hides the
    // far one.
    const facing = (theta: number) => {
      const out = rotate(SHIP_HEADINGS, YAW, [Math.cos(theta), Math.sin(theta), 0]);
      return out[0] + out[1] > 0;
    };
    // Start on the far arc so the near arc is one run.
    const start = Array.from({ length: 96 }, (_, u) => u).find((u) => !facing((u / 48) * Math.PI))!;
    const near = Array.from({ length: 97 }, (_, u) => ((start + u) / 48) * Math.PI)
      .filter(facing)
      .map((theta) => proj(canopyPoint(theta, 0)));
    polyline(lay, near, rgba(PAINT.recess), px(2.5), true);
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

export const cockpit = (view: View) => treat(view, renderModel(view));

if (import.meta.url === `file://${process.argv[1]}`) {
  const view = centredView(CANVAS.width, CANVAS.height, CANVAS.density);
  // The opaque canopy hides the seats, so the empty and seated backgrounds are one image.
  const image = cockpit(view);
  writePng(`${art}cockpit.png`, image, true);
  writePng(`${art}cockpit-seated.png`, image, true);

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
  placeEntries("core", "cockpit", [background("cockpit"), background("cockpit-seated")]);
}
