import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { editManifest } from "./manifest.ts";
import {
  anchor,
  depth,
  facesViewer,
  SHIP_HEADINGS,
  json,
  type Point,
  projectAt,
  rotate,
  vector,
} from "./projection.ts";

// A silhouette face draws the convex hull of its projected points, as an underlay that
// hides antialiasing seams between the facets of a convex solid.
type Face = {
  color: string;
  layer: number;
  points: Point[];
  silhouette?: boolean;
  twoSided?: boolean;
};

// The five authored paint colours; the canopy highlight derives from canopyRoof.
// Mouths and thrust flames keep their own colours on every scheme.
interface Paint {
  readonly canopyRoof: string;
  readonly canopySides: string;
  readonly frontSides: string;
  readonly rearSides: string;
  // Hull top.
  readonly top: string;
}

interface Scheme {
  readonly id: string;
  readonly name: string;
  readonly paint: Paint;
  readonly price: number;
}

const white = "#ffffff";
// Classic is the free default and writes the unprefixed ship frames.
const SCHEMES: readonly Scheme[] = [
  {
    id: "classic",
    name: "Classic",
    paint: {
      canopyRoof: "#2585d0",
      canopySides: "#1767b3",
      frontSides: "#d4dfe9",
      rearSides: "#abbfce",
      top: white,
    },
    price: 0,
  },
  {
    id: "cobalt",
    name: "Cobalt",
    paint: {
      canopyRoof: "#eef5ff",
      canopySides: "#b4c8e6",
      frontSides: "#4f7fd0",
      rearSides: "#3a62a8",
      top: "#6f9ff0",
    },
    price: 50,
  },
  {
    id: "seafoam",
    name: "Seafoam",
    paint: {
      canopyRoof: "#14697a",
      canopySides: "#0d4c59",
      frontSides: "#a7dcc9",
      rearSides: "#80bba8",
      top: "#d4f6ea",
    },
    price: 50,
  },
  {
    id: "graphite",
    name: "Graphite",
    paint: {
      canopyRoof: "#59d0ff",
      canopySides: "#2a92cc",
      frontSides: "#858ea4",
      rearSides: "#666f86",
      top: "#aab2c4",
    },
    price: 50,
  },
  {
    id: "iris",
    name: "Iris",
    paint: {
      canopyRoof: "#3a2b8c",
      canopySides: "#271c66",
      frontSides: "#b2a0ec",
      rearSides: "#8f7cd0",
      top: "#d9ccff",
    },
    price: 50,
  },
];
const [classic] = SCHEMES;
const output = fileURLToPath(new URL("../../public/art/", import.meta.url));
// UP projects straight up.
const UP = 20;
// Frame and display size in px.
const FRAME = 96;
const DISPLAY = 42;

// Swapping plan axes reverses winding; reverse to retain upward-facing tops.
function plan(z: number, points: readonly (readonly [number, number])[]): Point[] {
  return points.map(([x, y]): Point => [y * 0.32, x * 0.32, z]).toReversed();
}

// Hull: a pyramid on the swept delta plan. The frames, speed jets and nose all derive from
// the model definitions in this module, so a model swap regenerates them together.
const HULL = {
  // Plan outline: nose, wing tip, rear notch, tail, notch, wing tip.
  plan: [
    [-100, 0],
    [64, -67],
    [49, -17],
    [76, 0],
    [49, 17],
    [64, 67],
  ],
  // Vertical edge strip round the plan; the upper faces start at its top.
  skirt: 1.2,
  // The ridge runs low from the nose to the shoulder at the canopy's rear edge, then
  // climbs steeply to the rear-centre apex. Local (x, y, z).
  shoulder: [0, 6, 7.5],
  apex: [0, 17, 15],
  // Rear faces lean forward from the skirt top, degrees from horizontal.
  lean: 76,
} as const;

// A plane as n . p = d.
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
  // The plan perpendicular that points rearward (positive Y).
  const sign = Math.sign(ex) / Math.hypot(ex, ey);
  const lean = (HULL.lean * Math.PI) / 180;
  const n: Point = [-ey * sign * Math.sin(lean), ex * sign * Math.sin(lean), Math.cos(lean)];
  return { d: dot(n, a), n };
}

// The point common to three planes.
function meet(p: Plane, q: Plane, r: Plane): Point {
  const [qr, rp, pq] = [cross(q.n, r.n), cross(r.n, p.n), cross(p.n, q.n)];
  const det = dot(p.n, qr);
  const at = (i: number) => (p.d * qr[i]! + q.d * rp[i]! + r.d * pq[i]!) / det;
  return [at(0), at(1), at(2)];
}

// Named hull vertices. The swept plan's notches lie ahead of the apex, so the rear is
// split into planar faces: a wall leaning up from each wing's trailing edge, and a tail
// side from each notch up to the apex and down the single tail ridge to the tail tip.
// A wing's corner is where its wall, its steep face and its tail side meet.
function vertices() {
  const [tipR, notchR, tail, notchL, tipL, nose] = plan(HULL.skirt, HULL.plan) as [
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

// Upper faces, each a planar polygon wound to face up: per side the wing face, which
// carries the canopy, then the steep face, the wall, which holds the mouth, and the tail
// side, which rise behind the canopy.
type Part = "side" | "steep" | "wall" | "wing";

function upperFaces(): { part: Part; points: Point[] }[] {
  const v = vertices();
  const up = (points: Point[]) => (normal(points)[2] < 0 ? points.toReversed() : points);
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

// Wing roof height under the canopy: the lower of the two wing planes.
function roof(x: number, y: number): number {
  const v = vertices();
  const height = ({ d, n }: Plane) => (d - n[0] * x - n[1] * y) / n[2];
  return Math.min(
    height(through(v.nose, v.tipL, v.shoulder)),
    height(through(v.nose, v.shoulder, v.tipR)),
  );
}

// Nose: the midpoint of the plan's forward-most vertices at the skirt top (local forward
// is negative Y).
function nose(): Point {
  const hull = plan(HULL.skirt, HULL.plan);
  const front = Math.min(...hull.map(([, y]) => y));
  const tip = hull.filter(([, y]) => y === front);
  const mean = (axis: number) => tip.reduce((sum, point) => sum + point[axis]!, 0) / tip.length;
  return [mean(0), mean(1), mean(2)];
}

// Engine mouths on the wing walls: |x| from inner to outer, z from the skirt top up by
// low and high, the top kept 0.6 under the wall's top edge.
const MOUTHS = { inner: 9.5, outer: 15, low: 0.3, high: 2.6 };

// Mouth quad on the sign side's wall, lifted 0.03 off it, wound outward: outer low,
// inner low, inner high, outer high.
function mouth(sign: number): Point[] {
  const v = vertices();
  const [tip, notch, corner] =
    sign === 1 ? [v.tipR, v.notchR, v.cornerR] : [v.tipL, v.notchL, v.cornerL];
  const { d, n } = leaning(tip, notch);
  const at = (x: number, z: number): Point => [x, (d - n[0] * x - n[2] * z) / n[1] + 0.03, z];
  const edge = (x: number) => tip[2] + ((corner[2] - tip[2]) * (x - tip[0])) / (corner[0] - tip[0]);
  const { high, inner, low, outer } = MOUTHS;
  const z0 = HULL.skirt + low;
  const top = (x: number) => Math.min(HULL.skirt + high, edge(x) - 0.6);
  const quad = [
    at(sign * outer, z0),
    at(sign * inner, z0),
    at(sign * inner, top(sign * inner)),
    at(sign * outer, top(sign * outer)),
  ];
  return sign === 1 ? quad : quad.toReversed();
}

// Mouth middle and half width along its base, outer minus inner over two.
function mouthAxis(sign: number): { half: Point; middle: Point } {
  const quad = mouth(sign);
  const [outerLow, innerLow] = sign === 1 ? [quad[0]!, quad[1]!] : [quad[3]!, quad[2]!];
  const middle = quad.reduce<Point>(
    (sum, [x, y, z]) => [sum[0] + x / 4, sum[1] + y / 4, sum[2] + z / 4],
    [0, 0, 0],
  );
  const half: Point = [(outerLow[0] - innerLow[0]) / 2, (outerLow[1] - innerLow[1]) / 2, 0];
  return { half, middle };
}

// Light below which a wing face prefers the rear side colour, and below which a steep
// face or tail side prefers the front side colour over the top colour.
const SHADE = { back: 0.45, wing: 0.6 };

// Upper faces take the paint in light order among the visible ones. The walls are the
// canopy side colour, a blue band round the mouths. The brightest other face is top. Wing
// faces prefer front sides at light SHADE.wing or more and rear sides below it; steep
// faces and tail sides prefer top at SHADE.back or more and front sides below it, so the
// tail reads white with blue-grey shade. Each face takes its first preference that no
// brighter face sharing an edge with it already has, so neighbouring planes differ.
function shade(yaw: number, paint: Paint, upper: readonly { part: Part; points: Point[] }[]) {
  const key = (p: Point) => p.map((c) => c.toFixed(4)).join(",");
  const edges = upper.map(({ points }) =>
    points.map((p, j) => [key(p), key(points[(j + 1) % points.length]!)].toSorted().join("|")),
  );
  const touches = (i: number, j: number) => edges[i]!.some((edge) => edges[j]!.includes(edge));
  const ranked = upper
    .map(({ part, points }, i) => ({
      i,
      light: lit(yaw, points),
      part,
      shown: facesViewer(turned(yaw, points)),
    }))
    .filter(({ shown }) => shown)
    .toSorted((a, b) => b.light - a.light);
  const { frontSides, rearSides, top } = paint;
  const prefer = (part: Part, light: number, brightest: boolean): string[] =>
    part === "wall"
      ? [paint.canopySides]
      : brightest
        ? [top]
        : part === "wing"
          ? light >= SHADE.wing
            ? [frontSides, rearSides]
            : [rearSides, frontSides]
          : light >= SHADE.back
            ? [top, frontSides]
            : [frontSides, top];
  const color = new Map<number, string>();
  const lead = ranked.find(({ part }) => part !== "wall");
  for (const [rank, { i, light, part }] of ranked.entries()) {
    const taken = new Set(
      ranked
        .slice(0, rank)
        .filter(({ i: j }) => touches(i, j))
        .map(({ i: j }) => color.get(j)),
    );
    const options = prefer(part, light, lead?.i === i);
    color.set(i, options.find((option) => !taken.has(option)) ?? options[0]!);
  }
  return color;
}

function model(yaw: number, thrust: boolean, paint: Paint): Face[] {
  const faces: Face[] = [];
  const outline = plan(HULL.skirt, HULL.plan);
  // Skirt: edges 0 and 5 (the right wing's trailing and leading edges) in the front side
  // colour, the rest in the rear side colour.
  for (let i = 0; i < outline.length; i++) {
    const a = outline[(i + 1) % outline.length]!;
    const b = outline[i]!;
    faces.push({
      color: i === 0 || i === 5 ? paint.frontSides : paint.rearSides,
      layer: 2,
      points: [a, b, [b[0], b[1], 0], [a[0], a[1], 0]],
    });
  }
  const upper = upperFaces();
  const color = shade(yaw, paint, upper);
  // Faces behind the canopy draw after it when the rear points toward the viewer,
  // otherwise with the wing faces before it. The mouths draw last.
  const rear = rotate(SHIP_HEADINGS, yaw, [0, 1, 0]);
  const tailLayer = rear[0] + rear[1] > 0 ? 6 : 3;
  for (const [i, { part, points }] of upper.entries()) {
    const layer = part === "wing" ? 3 : tailLayer;
    faces.push({ color: color.get(i) ?? paint.rearSides, layer, points });
  }
  for (const sign of [-1, 1]) {
    faces.push({ color: "#64caff", layer: 6.5, points: mouth(sign) });
    if (thrust) {
      // Long pale outer flame with a shorter white core stays legible at 42px.
      const { half, middle } = mouthAxis(sign);
      const [mx, my, mz] = middle;
      const flame = (width: number, length: number): Point[] => [
        [mx - half[0] * width, my - half[1] * width, mz],
        [mx, my + length, mz],
        [mx + half[0] * width, my + half[1] * width, mz],
      ];
      faces.push({ color: "#b9ecff", layer: -2, points: flame(1.6, 16), twoSided: true });
      faces.push({ color: white, layer: -1, points: flame(0.8, 9), twoSided: true });
    }
  }
  canopy(faces, yaw, paint);
  return faces;
}

const turned = (yaw: number, points: readonly Point[]) =>
  points.map((point) => rotate(SHIP_HEADINGS, yaw, point));

// Newell normal of a polygon, unnormalized.
function normal(points: readonly Point[]): Point {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (const [i, a] of points.entries()) {
    const b = points[(i + 1) % points.length]!;
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return [nx, ny, nz];
}

function unit([x, y, z]: Point): Point {
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
}

const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Wind a face of a convex solid so its normal points away from the solid's centre.
function outward(centre: Point, points: Point[]): Point[] {
  const mid = points.reduce<Point>(
    (sum, [x, y, z]) => [
      sum[0] + x / points.length,
      sum[1] + y / points.length,
      sum[2] + z / points.length,
    ],
    [0, 0, 0],
  );
  const offset: Point = [mid[0] - centre[0], mid[1] - centre[1], mid[2] - centre[2]];
  return dot(normal(points), offset) < 0 ? points.toReversed() : points;
}

// World light for shading, from above and screen-left of the viewer.
const LIGHT = unit([-0.25, 0.45, 1]);

// World-space light on a local face at this heading.
function lit(yaw: number, points: readonly Point[]): number {
  return dot(unit(rotate(SHIP_HEADINGS, yaw, normal(points))), LIGHT);
}

// Canopy: a faceted dome on the wing roof, its rear edge at the shoulder. Plan semi-axes
// a (across) and b (along), centre on local Y. The base ring lies on the roof; the crown
// is level, h above the roof at the centre, and each ring rises sin(latitude) of the way
// from the roof to the crown. Ring latitudes in degrees.
const CANOPY = { a: 9, b: 9, centre: -3, h: 2.8, rings: [0, 30, 60, 90], segments: 16 };

function canopy(faces: Face[], yaw: number, paint: Paint): void {
  const { a, b, centre, h, rings, segments } = CANOPY;
  const crown = roof(0, centre) + h;
  const at = (u: number, v: number): Point => {
    const theta = (u / segments) * 2 * Math.PI;
    const phi = (v * Math.PI) / 180;
    const x = a * Math.cos(phi) * Math.cos(theta);
    const y = centre + b * Math.cos(phi) * Math.sin(theta);
    const base = roof(x, y);
    return [x, y, base + (crown - base) * Math.sin(phi)];
  };
  const middle: Point = [0, centre, roof(0, centre) - 2];
  const shell: Point[][] = [];
  for (let ring = 0; ring < rings.length - 1; ring++) {
    const [low, high] = [rings[ring]!, rings[ring + 1]!];
    for (let u = 0; u < segments; u++) {
      const points =
        high === 90
          ? [at(u, low), at(u + 1, low), at(u, high)]
          : [at(u, low), at(u + 1, low), at(u + 1, high), at(u, high)];
      shell.push(outward(middle, points));
    }
  }
  // The lowest ring takes the side colour and the rest the roof colour; the two
  // facets facing the light most directly take the highlight.
  const light = shell.map((points) => lit(yaw, points));
  const brightest = new Set(
    light
      .map((value, i) => [value, i] as const)
      .toSorted((x, y) => y[0] - x[0])
      .slice(0, 2)
      .map(([, i]) => i),
  );
  for (const [i, points] of shell.entries()) {
    const color = brightest.has(i)
      ? highlight(paint.canopyRoof)
      : i < segments
        ? paint.canopySides
        : paint.canopyRoof;
    faces.push({ color, layer: 5, points });
  }
  faces.push({
    color: paint.canopyRoof,
    layer: 4.5,
    points: shell.flat(),
    silhouette: true,
    twoSided: true,
  });
}

// Canopy highlight: the roof colour mixed 45 percent toward white.
function highlight(roof: string): string {
  const channels = [1, 3, 5].map((i) => Number.parseInt(roof.slice(i, i + 2), 16));
  return `#${channels
    .map((c) =>
      Math.round(c + (255 - c) * 0.45)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function visible(face: Face): boolean {
  return face.twoSided === true || facesViewer(face.points);
}

// Monotone chain hull of 2D points, counterclockwise in screen coordinates.
function convexHull(points: readonly (readonly [number, number])[]): [number, number][] {
  const sorted = points
    .map(([x, y]): [number, number] => [Number(x.toFixed(2)), Number(y.toFixed(2))])
    .toSorted((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const chain = (input: [number, number][]) => {
    const out: [number, number][] = [];
    for (const point of input) {
      while (out.length >= 2 && cross(out.at(-2)!, out.at(-1)!, point) <= 0) {
        out.pop();
      }
      out.push(point);
    }
    return out.slice(0, -1);
  };
  return [...chain(sorted), ...chain(sorted.toReversed())];
}

function svg(yaw: number, thrust: boolean, scheme: Scheme = classic!): string {
  const polygons = model(yaw, thrust, scheme.paint)
    .map((face) => ({
      ...face,
      points: face.points.map((point) => rotate(SHIP_HEADINGS, yaw, point)),
    }))
    .filter(visible)
    .sort((a, b) => a.layer - b.layer || depth(b.points) - depth(a.points))
    .map(({ color, points, silhouette }) => {
      const projected = points.map((point) => projectAt(48, 48, point));
      const outline = silhouette === true ? convexHull(projected) : projected;
      const text = outline.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`);
      return `  <polygon fill="${color}" points="${text.join(" ")}"/>`;
    });
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">',
    `  <title>Ship ${yaw}${thrust ? " thrust" : " idle"}${scheme === classic ? "" : ` ${scheme.name}`}</title>`,
    ...polygons,
    "</svg>",
    "",
  ].join("\n");
}

// Speed jets: Tech draws halo, outer and core triangles per mouth behind the idle frame.
function jets(): string {
  const headings = Array.from({ length: SHIP_HEADINGS }, (_, yaw) => ({
    index: yaw,
    mouths: [-1, 1].map((sign) => {
      const { half, middle } = mouthAxis(sign);
      return {
        anchor: anchor(SHIP_HEADINGS, 48, yaw, middle),
        axis: vector(SHIP_HEADINGS, yaw, [0, 1, 0]),
        half: vector(SHIP_HEADINGS, yaw, half),
      };
    }),
  }));
  const contract = {
    version: 1,
    frame: 96,
    length: { base: 6, scale: 24, exponent: 2 },
    layers: [
      {
        name: "halo",
        color: "#70ace8",
        width: 2.4,
        length: 1.1,
        alpha: { from: 0.6, to: 1, max: 0.5 },
      },
      { name: "outer", colors: ["#5b93cc", "#b9ecff"], width: 1.6, length: 1 },
      { name: "core", colors: ["#8cc4f0", "#ffffff"], width: 0.8, length: 0.55 },
    ],
    headings,
  };
  return json(contract);
}

// Nose per heading in frame px, projected like the frames; shots leave from here.
function noses(): string {
  return json({
    version: 1,
    frame: FRAME,
    displayScale: DISPLAY / FRAME,
    noses: Array.from({ length: SHIP_HEADINGS }, (_, yaw) =>
      anchor(SHIP_HEADINGS, FRAME / 2, yaw, nose()),
    ),
  });
}

mkdirSync(output, { recursive: true });
writeFileSync(`${output}ship-jets.json`, jets());
writeFileSync(`${output}ship-nose.json`, noses());
for (let yaw = 0; yaw < SHIP_HEADINGS; yaw++) {
  for (const thrust of [false, true]) {
    writeFileSync(`${output}ship-${thrust ? "thrust-" : ""}${yaw}.svg`, svg(yaw, thrust));
  }
}
writeFileSync(`${output}ship.svg`, svg(UP, false));
writeFileSync(`${output}ship-thrust.svg`, svg(UP, true));

// Paint schemes: idle frames only; speed jets are unpainted and drawn behind them.
const painted = SCHEMES.filter((scheme) => scheme !== classic);
for (const scheme of painted) {
  mkdirSync(`${output}paint/${scheme.id}`, { recursive: true });
  for (let yaw = 0; yaw < SHIP_HEADINGS; yaw++) {
    writeFileSync(`${output}paint/${scheme.id}/ship-${yaw}.svg`, svg(yaw, false, scheme));
  }
}
writeFileSync(
  `${output}ship-paint.json`,
  json({
    version: 1,
    schemes: SCHEMES.map(({ id, name, paint, price }) => ({
      id,
      name,
      price,
      ...paint,
      canopyHighlight: highlight(paint.canopyRoof),
    })),
  }),
);

// Ship entries open the manifest: the up aliases, then idle and thrust per heading, then
// the paint frames, which mirror ship-N with their own path and a paint id.
const entry = (id: string, path: string, yaw: number) => ({
  id,
  path,
  width: FRAME,
  height: FRAME,
  displayWidth: DISPLAY,
  displayHeight: DISPLAY,
  facing: `world-${yaw}`,
  directionIndex: yaw,
  pivot: { x: 0.5, y: 0.5 },
});
const yaws = Array.from({ length: SHIP_HEADINGS }, (_, yaw) => yaw);
const entries = [
  entry("ship", "/art/ship.svg", UP),
  entry("ship-thrust", "/art/ship-thrust.svg", UP),
  ...yaws.flatMap((yaw) => [
    entry(`ship-${yaw}`, `/art/ship-${yaw}.svg`, yaw),
    entry(`ship-thrust-${yaw}`, `/art/ship-thrust-${yaw}.svg`, yaw),
  ]),
  ...painted.flatMap((scheme) =>
    yaws.map((yaw) => ({
      ...entry(`ship-${scheme.id}-${yaw}`, `/art/paint/${scheme.id}/ship-${yaw}.svg`, yaw),
      paint: scheme.id,
    })),
  ),
];
const isShip = ({ id }: { id: string }) => id === "ship" || id.startsWith("ship-");
editManifest("core", (manifest) => {
  manifest.assets = [...entries, ...manifest.assets.filter((asset) => !isShip(asset))];
  manifest.shipNose = "/art/ship-nose.json";
});
