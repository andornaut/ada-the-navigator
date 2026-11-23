// Stranded craft export, shared by every galaxy's tow craft (cartwheel-props.ts and
// stranded-craft.ts): sixteen headings in the enemy convention, each the smallest square frame
// (a multiple of 16 px, 4 px padding) round a centred pivot, an optional lit and dim blink pair,
// and the tow point per heading. Contract: art/cartwheel-props.md "Stranded craft".
import { writeFileSync } from "node:fs";

import { packAtlas } from "@andornaut/art-kit/build/atlasLayout";

import type { Facing, Part, Plan } from "./cartwheel-craft.ts";
import { DISPLAY_SCALE } from "./crafts.ts";
import {
  depth,
  ENEMY_HEADINGS,
  facesViewer,
  type Point,
  projectAt,
  rotate,
  round,
} from "./projection.ts";
import { svgText } from "./svg-text.ts";

type Face = { color: string; points: Point[] };

// The viewBox stays in frame px; the intrinsic size is the display size, so the frame
// rasterizes at the size it is drawn.
function svg(title: string, w: number, h: number, polygons: readonly string[]): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w * DISPLAY_SCALE}" height="${h * DISPLAY_SCALE}" viewBox="0 0 ${w} ${h}">`,
    `  <title>${title}</title>`,
    ...polygons,
    "</svg>",
    "",
  ].join("\n");
}

const points = (list: readonly (readonly [number, number])[]) =>
  list.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");

// ------------------------------------------------------------------ solids

// Every face of an extruded part in local units: bottom, sides, top, each wound outward.
// Rear-facing walls (behind the centre, running across the craft) take the rear shade, as in
// crafts.ts.
function partFaces(part: Part): Face[] {
  const at = (plan: Plan, z: number) => plan.map(([x, y]): Point => [x, y, z]);
  const plan = facesViewer(at(part.plan, part.z1)) ? part.plan : part.plan.toReversed();
  const faces: Face[] = [{ color: part.side, points: at(plan, part.z0).toReversed() }];
  for (const [i, a] of plan.entries()) {
    const b = plan[(i + 1) % plan.length]!;
    const rear =
      part.rear !== undefined &&
      (a[1] + b[1]) / 2 > 0 &&
      Math.abs(a[1] - b[1]) < Math.abs(a[0] - b[0]);
    faces.push({
      color: rear ? part.rear! : part.side,
      points: [
        [b[0], b[1], part.z1],
        [a[0], a[1], part.z1],
        [a[0], a[1], part.z0],
        [b[0], b[1], part.z0],
      ],
    });
  }
  faces.push({ color: part.top, points: at(plan, part.z1) });
  return faces;
}

// A craft pose: local tilt (roll about the forward axis, then pitch, radians), the heading and the
// model scale. Heading k faces world angle k * 22.5 degrees, as for the enemies.
export type Pose = { roll: number; pitch: number; yaw: number; scale: number };

export function posed({ pitch, roll, scale, yaw }: Pose, [x, y, z]: Point): Point {
  const [x1, z1] = [
    x * Math.cos(roll) + z * Math.sin(roll),
    -x * Math.sin(roll) + z * Math.cos(roll),
  ];
  const [y2, z2] = [
    y * Math.cos(pitch) - z1 * Math.sin(pitch),
    y * Math.sin(pitch) + z1 * Math.cos(pitch),
  ];
  const [rx, ry, rz] = rotate(ENEMY_HEADINGS, yaw, [x1 * scale, y2 * scale, z2 * scale]);
  return [rx, ry, rz];
}

// A craft-local wall normal faces the viewer when its posed normal leans toward the view.
export const facingAt =
  (pose: Pose): Facing =>
  (nx, ny) => {
    const [wx, wy] = rotate(ENEMY_HEADINGS, pose.yaw, [nx, ny, 0]);
    return wx + wy > 0.3;
  };

// Groups draw far to near by their first part's centre; groups based at or above a level
// (hull top, cab top) draw after those below it. Parts in a group keep list order.
export function craftFaces(
  groups: readonly Part[][],
  levels: readonly number[],
  pose: Pose,
): Face[] {
  return groups
    .map((group) => {
      const first = group[0]!;
      const centre = first.plan.map(([x, y]) => posed(pose, [x, y, (first.z0 + first.z1) / 2]));
      const layer = levels.filter((level) => first.z0 >= level).length;
      return { depth: depth(centre), group, layer };
    })
    .sort((a, b) => a.layer - b.layer || b.depth - a.depth)
    .flatMap(({ group }) =>
      group.flatMap(partFaces).map(({ color, points: list }) => ({
        color,
        points: list.map((p) => posed(pose, p)),
      })),
    )
    .filter(({ points: list }) => facesViewer(list));
}

export interface CraftSpec {
  id: string;
  title: string;
  scale: number;
  roll: number;
  pitch: number;
  levels: readonly number[];
  tow: readonly [number, number, number];
  // Frame names and the model for each; one name for a craft without a blink.
  frames: readonly { name: string; build: (facing: Facing) => Part[][] }[];
}

export const BLINK_MS = 700;

type InstalledFrame = { id: string; path?: unknown; svgSheet?: unknown };

// Writes the frames to `dir` (public path `path`) and returns the tow data entry and the
// manifest entries.
export function exportStranded(
  installed: readonly InstalledFrame[],
  spec: CraftSpec,
  dir: string,
  path: string,
) {
  const prefix = `craft-${spec.id}-`;
  const sheet = `${spec.id}-sheet.svg`;
  const current = installed.filter(({ id }) => id.startsWith(prefix));
  const packed = current.some(({ svgSheet }) => svgSheet === true);
  if (
    packed &&
    (spec.frames.length !== 1 ||
      spec.frames[0]!.name !== "" ||
      current.length !== ENEMY_HEADINGS ||
      current.some(
        ({ id, path: framePath, svgSheet }, yaw) =>
          id !== `${prefix}${yaw}` || framePath !== path + sheet || svgSheet !== true,
      ))
  ) {
    throw new Error(`Incomplete stranded sheet selection: ${spec.id}`);
  }
  const poses = Array.from({ length: ENEMY_HEADINGS }, (_, yaw): Pose => ({
    pitch: spec.pitch,
    roll: spec.roll,
    scale: spec.scale,
    yaw,
  }));
  const drawn = poses.map((pose) =>
    spec.frames.map(({ build, name }) => ({
      faces: craftFaces(build(facingAt(pose)), spec.levels, pose),
      name,
    })),
  );
  // The smallest square frame, a multiple of 16 px, holding every heading with 4 px padding
  // around a centred pivot, as for the story craft.
  const reach = Math.max(
    ...drawn
      .flat()
      .flatMap(({ faces }) => faces.flatMap((f) => f.points.map((p) => projectAt(0, 0, p))))
      .map(([x, y]) => Math.max(Math.abs(x), Math.abs(y))),
  );
  const size = Math.ceil((2 * (reach + 4)) / 16) * 16;
  const c = size / 2;
  const entries = [];
  const headings = [];
  const roots: string[] = [];
  for (const [yaw, frames] of drawn.entries()) {
    for (const { faces, name } of frames) {
      const file = name ? `${spec.id}-${yaw}-${name}` : `${spec.id}-${yaw}`;
      const polygons = faces.map(
        ({ color, points: list }) =>
          `  <polygon fill="${color}" points="${points(list.map((p) => projectAt(c, c, p)))}"/>`,
      );
      const root = svgText(
        svg(`${spec.title} ${yaw}${name ? ` ${name}` : ""}`, size, size, polygons),
      );
      if (packed) {
        roots.push(root.trimEnd());
      } else {
        writeFileSync(`${dir}${file}.svg`, root);
      }
      entries.push({
        id: `craft-${file}`,
        path: packed ? path + sheet : `${path}${file}.svg`,
        width: size,
        height: size,
        displayWidth: size * DISPLAY_SCALE,
        displayHeight: size * DISPLAY_SCALE,
        facing: `world-${yaw}`,
        directionIndex: yaw,
        pivot: { x: 0.5, y: 0.5 },
        ...(packed ? { svgSheet: true as const } : {}),
        ...(name ? { blink: name, frameMs: BLINK_MS } : {}),
        craft: spec.id,
      });
    }
    const [tx, ty] = projectAt(c, c, posed(poses[yaw]!, spec.tow));
    headings.push({ index: yaw, tow: [round(tx), round(ty)] });
  }
  if (packed) {
    // Raw-sized cells keep each nested root at its standalone intrinsic size.
    const wide = size * 4;
    const layout = packAtlas({ compare: () => 0, extrude: 0, maxSize: wide, widths: [wide] }, [
      { rectangles: roots.map(() => ({ width: size, height: size })), value: spec.id },
    ])?.pages[0];
    if (!layout || layout.placed[0]?.at.length !== ENEMY_HEADINGS) {
      throw new Error(`Cannot pack stranded sheet: ${spec.id}`);
    }
    const frames = roots.map((root, yaw) => {
      const { x, y } = layout.placed[0]!.at[yaw]!;
      return `<svg id="${prefix}${yaw}" x="${x}" y="${y}" ${root.slice("<svg ".length)}`;
    });
    writeFileSync(
      dir + sheet,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${wide}" height="${layout.height}" viewBox="0 0 ${wide} ${layout.height}">${frames.join("")}</svg>\n`,
    );
  }
  const data = {
    id: spec.id,
    frame: size,
    display: size * DISPLAY_SCALE,
    ...(spec.frames.length > 1
      ? { blink: spec.frames.map(({ name }) => name), frameMs: BLINK_MS }
      : {}),
    headings,
  };
  return { data, entries };
}
