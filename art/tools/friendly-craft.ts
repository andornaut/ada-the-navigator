// The friendly craft of the friendly object producer (art/friendly-redesign.md): each craft's
// 16 headings as one sheet of nested roots, its jets and nose or its tow points, and its
// collision parts per heading. art/tools/friendly.ts writes the files and stages the rows.
import { DISPLAY_SCALE, jetsFile } from "./crafts.ts";
import { traceEnemyFills } from "./enemy-outline.ts";
import { tonePaths } from "./fleet.ts";
import {
  type CraftBuild,
  type FriendlyCraft,
  friendlyCrafts,
  LAMP_BUOY_FIT,
  LAMP_BUOY_RIM,
} from "./friendly-craft-models.ts";
import { noseDistance } from "./nose.ts";
import { ENEMY_HEADINGS, type Point, projectAt, round } from "./projection.ts";
import { type Fill, TOLERANCES } from "./silhouette.ts";
import { BLINK_MS, LIGHT, type Mesh, meshPlace } from "./solid.ts";
import { svgText } from "./svg-text.ts";
import { type Fragment, type V2, visibleFragments } from "./visible.ts";

// The jet triangle's base as a share of the drive port's diameter.
const MOUTH_SHARE = 0.75;
// Ada's level one jet ramps, slow to fast.
const JET_COLORS = {
  outer: ["#5b93cc", "#b9ecff"] as [string, string],
  core: ["#8cc4f0", "#ffffff"] as [string, string],
};
const COLUMNS = 4;

const identity = (point: Point) => point;
const degrees = (yaw: number) => (yaw * 360) / ENEMY_HEADINGS;
// Mesh space to view space at heading `yaw`: forward +x turns to the heading's world angle.
const view =
  (yaw: number) =>
  ([x, y, z]: Point): Point => {
    const a = (degrees(yaw) * Math.PI) / 180;
    return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z];
  };
// The light in mesh space at heading `yaw`.
const lightAt = (yaw: number): Point => view(-yaw)(LIGHT);
const colour = ({ slot, tones }: Fragment) => tones[slot];
const pathData = (loops: readonly V2[][]) =>
  loops.map((loop) => `M${loop.map(([x, y]) => `${x},${y}`).join("L")}Z`).join("");
const px = (value: number) => Math.round(value * 100) / 100 + 0;
const eight = (value: number) => Math.ceil(value / 8) * 8;

export type CraftFrame = {
  id: string;
  yaw: number;
  blink?: "a" | "b";
  svg: string;
  silhouette: string;
  // Drawn extents in frame px: left, top, right, bottom.
  drawn: readonly [number, number, number, number];
  collision: V2[][];
};
export type DrawnCraft = FriendlyCraft & {
  // The square frame in frame px; the pivot is its centre.
  frame: number;
  frames: CraftFrame[];
  // Per heading: the drive ports, the nose tip and the tow point in frame px, and the world
  // distance from the pivot to the point under the nose.
  headings: {
    mouths: { anchor: V2; axis: V2; half: V2 }[];
    tip: V2;
    distance: number;
  }[];
};

const span = (values: readonly number[]) => [Math.min(...values), Math.max(...values)] as const;

// A craft's build in frame px with the middle of its length and height at the origin, so the
// frame's centre is the middle of the hull at every heading. `place` takes a model point to it.
function placed(craft: FriendlyCraft) {
  const first = craft.model(lightAt(0), true);
  const points = first.mesh.flatMap((face) => face.points);
  let k = 1 / DISPLAY_SCALE;
  if (craft.fixed) {
    const drawn = points.map((p) => projectAt(0, 0, p));
    const [x0, x1] = span(drawn.map(([x]) => x));
    const [y0, y1] = span(drawn.map(([, y]) => y));
    k *= Math.min(LAMP_BUOY_FIT[0] / (x1 - x0), LAMP_BUOY_FIT[1] / (y1 - y0));
  }
  const [l0, l1] = span(points.map(([l]) => l));
  const [z0, z1] = span(points.map(([, , z]) => z));
  const offset: Point = [craft.fixed ? 0 : (-k * (l0 + l1)) / 2, 0, (-k * (z0 + z1)) / 2];
  const place = ([x, y, z]: Point): Point => [
    x * k + offset[0],
    y * k + offset[1],
    z * k + offset[2],
  ];
  const build = (yaw: number, lit: boolean): CraftBuild => {
    const { mesh, mouths } = craft.model(lightAt(yaw), lit);
    return {
      mesh: meshPlace(mesh, 0, k, offset),
      mouths: mouths.map(({ at, radius }) => ({ at: place(at), radius: radius * k })),
    };
  };
  return { build, place, k };
}

// The nose tip: the top of the hull's forward-most points, on their middle.
function noseTip(mesh: Mesh): Point {
  const points = mesh.flatMap((face) => face.points);
  const reach = Math.max(...points.map(([l]) => l));
  const front = points.filter(([l]) => reach - l < 1e-6);
  const [w0, w1] = span(front.map(([, w]) => w));
  return [reach, (w0 + w1) / 2, Math.max(...front.map(([, , z]) => z))];
}

export function drawCraft(craft: FriendlyCraft): DrawnCraft {
  const { build, place, k } = placed(craft);
  const turn = (yaw: number) => (craft.fixed ? identity : view(yaw));
  const yaws = Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => yaw);
  const states = craft.blink ? ([true, false] as const) : ([true] as const);
  const built = yaws.map((yaw) => states.map((lit) => build(yaw, lit)));
  const extent = Math.max(
    ...built.flatMap((byState, yaw) =>
      byState.flatMap(({ mesh }) =>
        mesh.flatMap((face) =>
          face.points.flatMap((p) => projectAt(0, 0, turn(yaw)(p)).map(Math.abs)),
        ),
      ),
    ),
  );
  const frame = eight(2 * Math.ceil(extent) + 2);
  const centre = frame / 2;
  const at = (yaw: number, point: Point): V2 => {
    const [x, y] = projectAt(centre, centre, turn(yaw)(point));
    return [round(x), round(y)];
  };
  const frames: CraftFrame[] = [];
  for (const [index, lit] of states.entries()) {
    for (const yaw of yaws) {
      const blink = craft.blink ? (["a", "b"] as const)[index]! : undefined;
      const id = `craft-${craft.name}-${yaw}${blink ? `-${blink}` : ""}`;
      const visible = visibleFragments(built[yaw]![index]!.mesh, turn(yaw)).map((fragment) => ({
        ...fragment,
        points: fragment.points.map(([x, y]): V2 => [x + centre, y + centre]),
      }));
      const traced = traceEnemyFills(
        id,
        visible.map((fragment): Fill => ({
          color: colour(fragment),
          points: fragment.points.map(([x, y]): V2 => [px(x), px(y)]),
        })),
        [frame, frame],
        TOLERANCES,
      );
      const paths = tonePaths(visible);
      const svg = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${frame}" height="${frame}" viewBox="0 0 ${frame} ${frame}">`,
        `<title>${craft.title} ${yaw}${blink ? ` ${blink.toUpperCase()}` : ""}${lit ? "" : " dark"}</title>`,
        ...traced.tips.map(
          ({ color, points }) =>
            `<polygon fill="${color}" points="${points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ")}"/>`,
        ),
        ...paths.map(({ fill, loops }) => `<path fill="${fill}" d="${pathData(loops)}"/>`),
        "</svg>",
      ].join("");
      const xs = visible.flatMap(({ points }) => points.map(([x]) => x));
      const ys = visible.flatMap(({ points }) => points.map(([, y]) => y));
      frames.push({
        id,
        yaw,
        ...(blink ? { blink } : {}),
        svg: svgText(svg),
        silhouette: pathData(paths[0]!.loops),
        drawn: [px(Math.min(...xs)), px(Math.min(...ys)), px(Math.max(...xs)), px(Math.max(...ys))],
        collision: traced.collision,
      });
    }
  }
  const headings = yaws.map((yaw) => {
    const { mesh, mouths } = built[yaw]![0]!;
    // The lamp buoy makes fast at its float's rim on the side it faces.
    const rim = view(yaw)([LAMP_BUOY_RIM.radius * k, 0, 0]);
    const float = place([0, 0, LAMP_BUOY_RIM.height]);
    const tip: Point = craft.fixed
      ? [float[0] + rim[0], float[1] + rim[1], float[2]]
      : noseTip(mesh);
    const unit = (point: Point): V2 => {
      const [x, y] = projectAt(0, 0, view(yaw)(point));
      return [round(x), round(y)];
    };
    return {
      mouths: mouths.map(({ at: centreOf, radius }) => ({
        anchor: at(yaw, centreOf),
        axis: unit([-1, 0, 0]),
        half: unit([0, -radius * MOUTH_SHARE, 0]),
      })),
      tip: at(yaw, tip),
      distance: noseDistance(craft.fixed ? LAMP_BUOY_RIM.radius * k : tip[0], yaw),
    };
  });
  return { ...craft, frame, frames, headings };
}

export const drawnCrafts = (): DrawnCraft[] => friendlyCrafts().map(drawCraft);

export const craftSheetFile = ({ name }: FriendlyCraft) => `friendly-${name}-sheet.svg`;
export const craftJetsFile = ({ name }: FriendlyCraft) => `friendly-${name}-jets.json`;
export const PHANTOM_JETS_FILE = "friendly-craft-jets.json";
export const TOW_FILE = "friendly-tow.json";
// The tow line, in logical px: a steel cable from Ada's pivot to the craft's tow point, with one
// clamp block at the craft end and a light-field ink stroke under the cable. Cartwheel's tow file
// holds it for every galaxy. The clamp runs `before` px along the line toward Ada to `after` px
// past the tow point and `across` px wide, with a lit band `face.depth` px deep on its
// screen-upper edge.
export const TOW_LINE = {
  layers: [
    { name: "outer", color: "#4F5462", width: 3 },
    { name: "core", color: "#B8BFC9", width: 1.4 },
  ],
  lightInk: 4.2,
  clamp: {
    color: "#4F5462",
    before: 3.2,
    after: 2.6,
    across: 5.2,
    face: { color: "#B8BFC9", depth: 2.2 },
  },
} as const;

// The frames as one sheet of nested roots, four to a row, each carrying its manifest id.
export function craftSheet({ frame, frames }: DrawnCraft): string {
  const namespace = 'xmlns="http://www.w3.org/2000/svg"';
  const root = `<svg ${namespace} width="${frame}" height="${frame}" viewBox="0 0 ${frame} ${frame}">`;
  const roots = frames.map(({ id, svg }, index) => {
    if (!svg.startsWith(root) || !svg.endsWith("</svg>")) {
      throw new Error(`Unexpected frame root: ${id}`);
    }
    const [x, y] = [(index % COLUMNS) * frame, Math.floor(index / COLUMNS) * frame];
    return `<svg id="${id}" x="${x}" y="${y}" ${svg.slice("<svg ".length)}`;
  });
  const [width, height] = [COLUMNS * frame, Math.ceil(frames.length / COLUMNS) * frame];
  return `<svg ${namespace} width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${roots.join("")}</svg>\n`;
}

export function craftRows(craft: DrawnCraft, path: string) {
  const { frame, name } = craft;
  return craft.frames.map(({ id, yaw, blink }) => ({
    id,
    path,
    width: frame,
    height: frame,
    displayWidth: frame * DISPLAY_SCALE,
    displayHeight: frame * DISPLAY_SCALE,
    facing: `world-${yaw}`,
    directionIndex: yaw,
    pivot: { x: 0.5, y: 0.5 },
    ...(blink ? { blink, frameMs: BLINK_MS } : {}),
    craft: name,
    svgSheet: true,
  }));
}

const collisionAt = (craft: DrawnCraft, yaw: number) =>
  craft.frames.find((frame) => frame.yaw === yaw)!.collision;

// A craft's jets file, in the shape of the shipped story craft's: the speed jets per heading
// with that heading's collision parts, and the nose per heading.
export function craftJets(craft: DrawnCraft): string {
  return jetsFile(
    craft.frame,
    (yaw) => craft.headings[yaw]!.mouths,
    JET_COLORS,
    { nose: craft.headings.map(({ distance, tip }) => ({ distance, tip })) },
    (yaw) => ({ collision: collisionAt(craft, yaw) }),
  );
}

// A stranded craft's entry in its galaxy's tow file: the tow point per heading, at the bow,
// with that heading's collision parts.
export function craftTow(craft: DrawnCraft) {
  return {
    id: craft.name,
    frame: craft.frame,
    display: craft.frame * DISPLAY_SCALE,
    ...(craft.blink ? { blink: ["a", "b"], frameMs: BLINK_MS } : {}),
    headings: craft.headings.map(({ tip }, index) => ({
      index,
      tow: tip,
      collision: collisionAt(craft, index),
    })),
  };
}
