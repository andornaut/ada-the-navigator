import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type Point = readonly [number, number, number];
type Face = { color: string; points: Point[]; twoSided?: boolean };

const white = "#ffffff";
const side = "#d4dfe9";
const rear = "#abbfce";
const output = fileURLToPath(new URL("../../public/art/", import.meta.url));

function model(thrust: boolean): Face[] {
  const faces: Face[] = [];
  const nose: Point = [0, -25, 3];
  const left: Point = [-16, 17, 3];
  const right: Point = [16, 17, 3];
  // Counterclockwise top and outward sides of the shallow triangular solid.
  faces.push({ color: white, points: [nose, right, left] });
  const rim = [nose, left, right];
  for (let i = 0; i < rim.length; i++) {
    const a = rim[i]!;
    const b = rim[(i + 1) % rim.length]!;
    faces.push({
      color: i === 1 ? rear : side,
      points: [a, b, [b[0], b[1], -2], [a[0], a[1], -2]],
    });
  }
  for (const sign of [-1, 1]) {
    const root: Point = [sign * 7, 0, 2];
    const tip: Point = [sign * 25, 20, 2];
    const heel: Point = [sign * 9, 17, 2];
    const top = sign === 1 ? [root, tip, heel] : [root, heel, tip];
    faces.push({ color: white, points: top });
    // The third wing edge is buried inside the central hull.
    for (const [a, b] of [
      [root, tip],
      [tip, heel],
    ] as [Point, Point][]) {
      const edge = sign === 1 ? [b, a] : [a, b];
      const [start, end] = edge as [Point, Point];
      faces.push({
        color: side,
        points: [start, end, [end[0], end[1], 0], [start[0], start[1], 0]],
      });
    }
    faces.push({
      color: "#64caff",
      points: [
        [sign * 9 - 2, 17.1, -1],
        [sign * 9 + 2, 17.1, -1],
        [sign * 9 + 2, 17.1, 2],
        [sign * 9 - 2, 17.1, 2],
      ],
    });
    if (thrust) {
      faces.push({
        color: "#b9ecff",
        points: [
          [sign * 9 - 2, 17.2, 0],
          [sign * 9, 25, 0],
          [sign * 9 + 2, 17.2, 0],
        ],
        twoSided: true,
      });
    }
  }
  // The opaque canopy covers about one quarter of the central hull top.
  const base: Point[] = [
    [-7, -6, 3.1],
    [7, -6, 3.1],
    [7, 7, 3.1],
    [-7, 7, 3.1],
  ];
  for (let i = 0; i < base.length; i++) {
    faces.push({
      color: i % 2 === 0 ? "#1767b3" : "#2585d0",
      points: [base[i]!, base[(i + 1) % base.length]!, [0, -4, 13]],
    });
  }
  faces.push({
    color: white,
    points: [
      [0, 9, 3],
      [0, 19, 3],
      [0, 17, 11],
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
  const polygons = model(thrust)
    .map((face) => ({ ...face, points: face.points.map((point) => rotate(yaw, point)) }))
    .filter(visible)
    .sort((a, b) => depth(b) - depth(a))
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
