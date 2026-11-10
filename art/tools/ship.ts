import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type Point = readonly [number, number, number];
type Face = { color: string; layer: number; points: Point[]; twoSided?: boolean };

const white = "#ffffff";
const side = "#d4dfe9";
const rear = "#abbfce";
const output = fileURLToPath(new URL("../../public/art/", import.meta.url));

// Swapping plan axes reverses winding; reverse to retain upward-facing tops.
function plan(z: number, points: readonly (readonly [number, number])[]): Point[] {
  return points.map(([x, y]): Point => [y * 0.32, x * 0.32, z]).toReversed();
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
    // Short mouths follow the outer rear edges immediately inside each wing tip.
    const a: Point = [sign * 64 * 0.32, 63.1 * 0.32 + 0.03, 0.8];
    const b: Point = [sign * 54.5 * 0.32, 60.25 * 0.32 + 0.03, 0.8];
    const mouth: Point[] = [a, b, [b[0], b[1], 3.2], [a[0], a[1], 3.2]];
    faces.push({
      color: "#64caff",
      layer: 2,
      points: sign === 1 ? mouth : mouth.toReversed(),
    });
    if (thrust) {
      faces.push({
        color: "#b9ecff",
        layer: -1,
        points: [
          [a[0], a[1], 2],
          [sign * 18.96, 26.3, 2],
          [b[0], b[1], 2],
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
  const angle = (yaw * Math.PI) / 4 + Math.PI / 2;
  return [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle), z];
}

function visible({ points, twoSided }: Face): boolean {
  if (twoSided) {
    return true;
  }
  const [a, b, c] = points as [Point, Point, Point, ...Point[]];
  const u = b.map((value, i) => value - a[i]!) as unknown as Point;
  const v = c.map((value, i) => value - a[i]!) as unknown as Point;
  const nx = u[1] * v[2] - u[2] * v[1];
  const ny = u[2] * v[0] - u[0] * v[2];
  const nz = u[0] * v[1] - u[1] * v[0];
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

mkdirSync(output, { recursive: true });
for (let yaw = 0; yaw < 8; yaw++) {
  for (const thrust of [false, true]) {
    writeFileSync(`${output}ship-${thrust ? "thrust-" : ""}${yaw}.svg`, svg(yaw, thrust));
  }
}
writeFileSync(`${output}ship.svg`, svg(5, false));
writeFileSync(`${output}ship-thrust.svg`, svg(5, true));
