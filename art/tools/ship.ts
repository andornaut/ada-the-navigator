import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

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

// Swapping plan axes reverses winding; reverse to retain upward-facing tops.
function plan(z: number, points: readonly (readonly [number, number])[]): Point[] {
  return points.map(([x, y]): Point => [y * 0.32, x * 0.32, z]).toReversed();
}

// Short mouths follow the outer rear edges immediately inside each wing tip.
function mouthEdge(sign: number): [Point, Point] {
  return [
    [sign * 64 * 0.32, 63.1 * 0.32 + 0.03, 0.8],
    [sign * 54.5 * 0.32, 60.25 * 0.32 + 0.03, 0.8],
  ];
}

function model(yaw: number, thrust: boolean, paint: Paint): Face[] {
  const faces: Face[] = [];
  const hull = plan(4, [
    [-100, 0],
    [64, -67],
    [49, -17],
    [76, 0],
    [49, 17],
    [64, 67],
  ]);
  // One continuous concave delta top includes both rear wing corners.
  faces.push({ color: paint.top, layer: 3, points: hull });
  for (let i = 0; i < hull.length; i++) {
    const a = hull[(i + 1) % hull.length]!;
    const b = hull[i]!;
    faces.push({
      color: i === 0 || i === 5 ? paint.frontSides : paint.rearSides,
      layer: 2,
      points: [a, b, [b[0], b[1], 0], [a[0], a[1], 0]],
    });
  }
  for (const sign of [-1, 1]) {
    const [a, b] = mouthEdge(sign);
    const mouth: Point[] = [a, b, [b[0], b[1], 3.2], [a[0], a[1], 3.2]];
    faces.push({
      color: "#64caff",
      layer: 2,
      points: sign === 1 ? mouth : mouth.toReversed(),
    });
    if (thrust) {
      // Long pale outer flame with a shorter white core stays legible at 42px.
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      faces.push({
        color: "#b9ecff",
        layer: -2,
        points: [
          [mx + (a[0] - mx) * 1.6, my + (a[1] - my) * 1.6, 2],
          [mx, my + 16, 2],
          [mx + (b[0] - mx) * 1.6, my + (b[1] - my) * 1.6, 2],
        ],
        twoSided: true,
      });
      faces.push({
        color: white,
        layer: -1,
        points: [
          [mx + (a[0] - mx) * 0.8, my + (a[1] - my) * 0.8, 2],
          [mx, my + 9, 2],
          [mx + (b[0] - mx) * 0.8, my + (b[1] - my) * 0.8, 2],
        ],
        twoSided: true,
      });
    }
  }
  dome(faces, yaw, paint);
  fin(faces, yaw, paint);
  return faces;
}

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

// World light for the canopy highlight, from above and screen-left of the viewer.
const LIGHT = unit([-0.25, 0.45, 1]);

// Canopy: opaque faceted half-ellipsoid on the hull top. Semi-axes a (across) and
// b (along), height h above the hull, centre on local Y; ring latitudes in degrees.
const DOME = { a: 9.2, b: 12.8, centre: -4.2, h: 5.5, rings: [0, 30, 60, 90], segments: 16 };

function dome(faces: Face[], yaw: number, paint: Paint): void {
  const { a, b, centre, h, rings, segments } = DOME;
  const at = (u: number, v: number): Point => {
    const theta = (u / segments) * 2 * Math.PI;
    const phi = (v * Math.PI) / 180;
    return [
      a * Math.cos(phi) * Math.cos(theta),
      centre + b * Math.cos(phi) * Math.sin(theta),
      4 + h * Math.sin(phi),
    ];
  };
  const middle: Point = [0, centre, 4];
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
  const lit = shell.map((points) => dot(unit(rotate(SHIP_HEADINGS, yaw, normal(points))), LIGHT));
  const brightest = new Set(
    lit
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

// Fin: tapered vertical fin on the rear centreline with a swept leading edge.
// Profile is (localY, z): leading base, leading tip, trailing tip, trailing base.
// Each flank carries a leading-edge stripe that ends at `stripe` on the base and tip.
const FIN = {
  half: { base: 1.2, tip: 0.6 },
  profile: [
    [14.5, 4],
    [21.5, 12.5],
    [23.6, 12.5],
    [24.2, 4],
  ],
  stripe: { base: 18, tip: 22.6 },
} as const;

function fin(faces: Face[], yaw: number, paint: Paint): void {
  const { half, profile, stripe } = FIN;
  const [[y0, z0], [y1, z1], [y2], [y3]] = profile;
  const at = (sign: number, y: number, z: number): Point => [
    sign * (z > z0 ? half.tip : half.base),
    y,
    z,
  ];
  const outline = (sign: number) => profile.map(([y, z]) => at(sign, y, z));
  const [left, right] = [outline(-1), outline(1)];
  const centre: Point = [0, 21, 7];
  // The tail draws after the canopy when the rear points toward the viewer.
  const rear = rotate(SHIP_HEADINGS, yaw, [0, 18.5, 0]);
  const layer = rear[0] + rear[1] > 0 ? 7 : 4;
  for (const sign of [-1, 1]) {
    const band = [
      at(sign, y0, z0),
      at(sign, y1, z1),
      at(sign, stripe.tip, z1),
      at(sign, stripe.base, z0),
    ];
    const body = [
      at(sign, stripe.base, z0),
      at(sign, stripe.tip, z1),
      at(sign, y2, z1),
      at(sign, y3, z0),
    ];
    const facing = outward(centre, body);
    const color =
      dot(unit(rotate(SHIP_HEADINGS, yaw, normal(facing))), LIGHT) > 0
        ? paint.frontSides
        : paint.rearSides;
    faces.push({ color, layer, points: facing });
    faces.push({ color: paint.canopyRoof, layer, points: outward(centre, band) });
  }
  // Edges in profile order: leading edge, tip, trailing edge.
  const edgeColors = [paint.canopyRoof, paint.canopyRoof, paint.canopySides];
  for (const [i, color] of edgeColors.entries()) {
    const points = [left[i]!, left[i + 1]!, right[i + 1]!, right[i]!];
    faces.push({ color, layer, points: outward(centre, points) });
  }
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
      const [a, b] = mouthEdge(sign);
      return {
        anchor: anchor(SHIP_HEADINGS, 48, yaw, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 2]),
        axis: vector(SHIP_HEADINGS, yaw, [0, 1, 0]),
        half: vector(SHIP_HEADINGS, yaw, [(a[0] - b[0]) / 2, (a[1] - b[1]) / 2, 0]),
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

mkdirSync(output, { recursive: true });
writeFileSync(`${output}ship-jets.json`, jets());
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
  width: 96,
  height: 96,
  displayWidth: 42,
  displayHeight: 42,
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
const manifestPath = `${output}manifest.json`;
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { assets: { id: string }[] };
const isShip = ({ id }: { id: string }) => id === "ship" || id.startsWith("ship-");
const others = manifest.assets.filter((asset) => !isShip(asset));
manifest.assets = [...entries, ...others];
writeFileSync(manifestPath, json(manifest));
