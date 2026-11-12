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

// The project's Prettier print width (.prettierrc).
const PRINT_WIDTH = 100;

// JSON in Prettier's layout, so generated files pass the lint gate as written. Prettier keeps an
// array of scalars on one line when the line fits the print width. A longer array of numbers fills
// each line with as many items as fit; any other longer array puts one item per line, as
// JSON.stringify does.
export function json(value: unknown): string {
  const text = JSON.stringify(value, null, 2).replace(
    /^( *)(.*)\[\n([^[\]{}]*?)\n *\](,?)$/gm,
    (whole, indent: string, prefix: string, body: string, comma: string) => {
      const items = body.trim().split(/,\s+/);
      const line = `${indent}${prefix}[${items.join(", ")}]${comma}`;
      if (line.length <= PRINT_WIDTH) {
        return line;
      }
      if (!items.every((item) => /^-?\d/.test(item))) {
        return whole;
      }
      const inner = `${indent}  `;
      const lines: string[] = [];
      let current = "";
      for (const [i, item] of items.entries()) {
        const last = i === items.length - 1;
        const next = current === "" ? item : `${current}, ${item}`;
        if (current !== "" && inner.length + next.length + (last ? 0 : 1) > PRINT_WIDTH) {
          lines.push(`${inner}${current},`);
          current = item;
        } else {
          current = next;
        }
      }
      lines.push(`${inner}${current}`);
      return `${indent}${prefix}[\n${lines.join("\n")}\n${indent}]${comma}`;
    },
  );
  // An array holding one one-line array also goes on one line when it fits; Prettier breaks an
  // array of arrays only when it has several.
  let out = text;
  for (let previous = ""; previous !== out;) {
    previous = out;
    out = out.replace(
      /^( *)(.*)\[\n *(\[[^\n]*\])\n *\](,?)$/gm,
      (whole, indent: string, prefix: string, item: string, comma: string) => {
        const line = `${indent}${prefix}[${item}]${comma}`;
        return line.length <= PRINT_WIDTH ? line : whole;
      },
    );
  }
  return `${out}\n`;
}
