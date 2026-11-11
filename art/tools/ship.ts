import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type Point = readonly [number, number, number];
type Face = { color: string; layer: number; points: Point[]; twoSided?: boolean };

const white = "#ffffff";
const side = "#d4dfe9";
const rear = "#abbfce";
const output = fileURLToPath(new URL("../../public/art/", import.meta.url));
// Heading k faces world angle k * 360 / HEADINGS degrees; UP projects straight up.
const HEADINGS = 16;
const UP = 10;

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

function model(yaw: number, thrust: boolean): Face[] {
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
  faces.push({ color: white, layer: 3, points: hull });
  for (let i = 0; i < hull.length; i++) {
    const a = hull[(i + 1) % hull.length]!;
    const b = hull[i]!;
    faces.push({
      color: i === 0 || i === 5 ? side : rear,
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
  const roof = plan(7.5, [
    [-55, 0],
    [-24, -27],
    [24, -25],
    [35, 0],
    [24, 25],
    [-24, 27],
  ]);
  // Flat hexagonal roof and opaque vertical sides share the selected footprint.
  for (let i = 0; i < roof.length; i++) {
    const a = roof[(i + 1) % roof.length]!;
    const b = roof[i]!;
    faces.push({
      color: "#1767b3",
      layer: 5,
      points: [a, b, [b[0], b[1], 4], [a[0], a[1], 4]],
    });
  }
  faces.push({ color: "#2585d0", layer: 6, points: roof });
  const tail = rotate(yaw, [0, 18.5, 0]);
  faces.push({
    color: white,
    layer: tail[0] + tail[1] > 0 ? 4 : 7,
    points: [
      [0, 12.16, 4],
      [0, 24, 4],
      [0, 21.44, 8],
    ],
    twoSided: true,
  });
  return faces;
}

function rotate(yaw: number, [x, y, z]: Point): Point {
  const angle = (yaw * Math.PI) / (HEADINGS / 2) + Math.PI / 2;
  return [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle), z];
}

function visible({ points, twoSided }: Face): boolean {
  if (twoSided) {
    return true;
  }
  // A full polygon normal also handles the concave delta outline.
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (const [i, a] of points.entries()) {
    const b = points[(i + 1) % points.length]!;
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return -nx - ny + Math.sqrt(3) * nz > 0.00001;
}

function depth({ points }: Face): number {
  return points.reduce((sum, [x, y, z]) => sum + x + y - Math.sqrt(3) * z, 0) / points.length;
}

function svg(yaw: number, thrust: boolean): string {
  const polygons = model(yaw, thrust)
    .map((face) => ({ ...face, points: face.points.map((point) => rotate(yaw, point)) }))
    .filter(visible)
    .sort((a, b) => a.layer - b.layer || depth(b) - depth(a))
    .map(({ color, points }) => {
      const projected = points.map(
        ([x, y, z]) =>
          `${(48 + ((x - y) * Math.sqrt(3)) / 2).toFixed(2)},${(48 + (x + y) / 2 - z).toFixed(2)}`,
      );
      return `  <polygon fill="${color}" points="${projected.join(" ")}"/>`;
    });
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">',
    `  <title>Ship ${yaw}${thrust ? " thrust" : " idle"}</title>`,
    ...polygons,
    "</svg>",
    "",
  ].join("\n");
}

const round = (value: number) => Math.round(value * 1000) / 1000 + 0;

// Linear part of the frame projection: ship units on the z = 0 plane to frame px.
function vector(yaw: number, point: Point): [number, number] {
  const [x, y] = rotate(yaw, point);
  return [round(((x - y) * Math.sqrt(3)) / 2), round((x + y) / 2)];
}

// Speed jets: Tech draws halo, outer and core triangles per mouth behind the idle frame.
function jets(): string {
  const headings = Array.from({ length: HEADINGS }, (_, yaw) => ({
    index: yaw,
    mouths: [-1, 1].map((sign) => {
      const [a, b] = mouthEdge(sign);
      const [x, y] = rotate(yaw, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 2]);
      return {
        anchor: [round(48 + ((x - y) * Math.sqrt(3)) / 2), round(48 + (x + y) / 2 - 2)],
        axis: vector(yaw, [0, 1, 0]),
        half: vector(yaw, [(a[0] - b[0]) / 2, (a[1] - b[1]) / 2, 0]),
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
  // Prettier keeps arrays of scalars on one line.
  const text = JSON.stringify(contract, null, 2).replace(
    /\[\s+([^[\]{}]*?)\s+\]/g,
    (_, items: string) => `[${items.split(/,\s+/).join(", ")}]`,
  );
  return `${text}\n`;
}

mkdirSync(output, { recursive: true });
writeFileSync(`${output}ship-jets.json`, jets());
for (let yaw = 0; yaw < HEADINGS; yaw++) {
  for (const thrust of [false, true]) {
    writeFileSync(`${output}ship-${thrust ? "thrust-" : ""}${yaw}.svg`, svg(yaw, thrust));
  }
}
writeFileSync(`${output}ship.svg`, svg(UP, false));
writeFileSync(`${output}ship-thrust.svg`, svg(UP, true));
