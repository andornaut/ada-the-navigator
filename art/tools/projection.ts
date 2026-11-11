// Shared solid-model projection for ship and enemy frame exports.
export type Point = readonly [number, number, number];

// Heading k of n faces world angle k * 360 / n degrees; local forward is negative Y.
// Ada's ship turns through 32 headings for finer aiming; enemy craft keep 16, so ship
// heading 2k faces enemy heading k.
export const SHIP_HEADINGS = 32;
export const ENEMY_HEADINGS = 16;

export function rotate(headings: number, yaw: number, [x, y, z]: Point): Point {
  const angle = (yaw * Math.PI) / (headings / 2) + Math.PI / 2;
  return [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle), z];
}

// The view direction is (1, 1, 1): the projection collapses it to one screen point and
// raises +z. A face is visible when its outward normal points toward that viewer.
// A full polygon normal also handles concave outlines.
export function facesViewer(points: readonly Point[]): boolean {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (const [i, a] of points.entries()) {
    const b = points[(i + 1) % points.length]!;
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return nx + ny + nz > 0.00001;
}

// Larger values are farther from the viewer at +(1, 1, 1).
export function depth(points: readonly Point[]): number {
  return points.reduce((sum, [x, y, z]) => sum - (x + y + z), 0) / points.length;
}

// Frame px for a rotated point, with the pivot at (pivotX, pivotY).
export function projectAt(pivotX: number, pivotY: number, [x, y, z]: Point): [number, number] {
  return [pivotX + ((x - y) * Math.sqrt(3)) / 2, pivotY + (x + y) / 2 - z];
}

// Frame px for a rotated point, with the pivot at (centre, centre).
export function project(centre: number, point: Point): string {
  const [sx, sy] = projectAt(centre, centre, point);
  return `${sx.toFixed(2)},${sy.toFixed(2)}`;
}

export const round = (value: number) => Math.round(value * 1000) / 1000 + 0;

// Projected frame px of a local point after rotation, rounded for jet contracts.
export function anchor(
  headings: number,
  centre: number,
  yaw: number,
  point: Point,
): [number, number] {
  const [x, y, z] = rotate(headings, yaw, point);
  return [round(centre + ((x - y) * Math.sqrt(3)) / 2), round(centre + (x + y) / 2 - z)];
}

// Linear part of the frame projection: local units on the z = 0 plane to frame px.
export function vector(headings: number, yaw: number, point: Point): [number, number] {
  const [x, y] = rotate(headings, yaw, point);
  return [round(((x - y) * Math.sqrt(3)) / 2), round((x + y) / 2)];
}

// Prettier keeps arrays of scalars on one line.
export function json(value: unknown): string {
  const text = JSON.stringify(value, null, 2).replace(
    /\[\s+([^[\]{}]*?)\s+\]/g,
    (_, items: string) => `[${items.split(/,\s+/).join(", ")}]`,
  );
  return `${text}\n`;
}
