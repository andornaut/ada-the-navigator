// The whales of the friendly object producer (art/friendly-redesign.md): each kind's 16
// headings by 8 swim loop frames, drawn in one square frame per kind.
import { DISPLAY_SCALE } from "./crafts.ts";
import { tonePaths } from "./fleet.ts";
import { whale, WHALE_LOOP_FRAMES, type WhaleKind, WHALES } from "./friendly-whale-models.ts";
import { ENEMY_HEADINGS, type Point, projectAt } from "./projection.ts";
import { LIGHT, meshPlace } from "./solid.ts";
import { svgText } from "./svg-text.ts";
import { type V2, visibleFragments } from "./visible.ts";

// Mesh space to view space at heading `yaw`: forward +x turns to the heading's world angle.
const view =
  (yaw: number) =>
  ([x, y, z]: Point): Point => {
    const a = (yaw * 2 * Math.PI) / ENEMY_HEADINGS;
    return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z];
  };
const lightAt = (yaw: number): Point => view(-yaw)(LIGHT);
const pathData = (loops: readonly V2[][]) =>
  loops.map((loop) => `M${loop.map(([x, y]) => `${x},${y}`).join("L")}Z`).join("");
const px = (value: number) => Math.round(value * 100) / 100 + 0;
const eight = (value: number) => Math.ceil(value / 8) * 8;

// A whale at heading `yaw` and loop frame `loop`, or at rest without one, in frame px.
const built = (kind: WhaleKind, yaw: number, loop?: number) =>
  meshPlace(whale(kind, lightAt(yaw), loop), 0, 1 / DISPLAY_SCALE);

// The square frame, in frame px, that fits every heading and loop frame of a kind with 1 px of
// margin about the pivot at its centre, the middle of the body.
export function whaleFrame(kind: WhaleKind): number {
  let extent = 0;
  for (let yaw = 0; yaw < ENEMY_HEADINGS; yaw++) {
    for (let loop = 0; loop < WHALE_LOOP_FRAMES; loop++) {
      for (const face of built(kind, yaw, loop)) {
        for (const point of face.points) {
          extent = Math.max(extent, ...projectAt(0, 0, view(yaw)(point)).map(Math.abs));
        }
      }
    }
  }
  return eight(2 * Math.ceil(extent) + 2);
}

export type WhaleFrame = {
  id: string;
  svg: string;
  silhouette: string;
  // Drawn extents in frame px: left, top, right, bottom.
  drawn: readonly [number, number, number, number];
};

// One frame of a kind: heading `yaw` at loop frame `loop`, or the rest pose without one.
export function drawWhale(kind: WhaleKind, frame: number, yaw: number, loop?: number): WhaleFrame {
  const centre = frame / 2;
  const visible = visibleFragments(built(kind, yaw, loop), view(yaw)).map((fragment) => ({
    ...fragment,
    points: fragment.points.map(([x, y]): V2 => [x + centre, y + centre]),
  }));
  const paths = tonePaths(visible);
  const id = `whale-${kind}-${yaw}-${loop ?? "rest"}`;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${frame}" height="${frame}" viewBox="0 0 ${frame} ${frame}">`,
    `<title>${WHALES[kind].title} ${yaw} ${loop ?? "rest"}</title>`,
    ...paths.map(({ fill, loops }) => `<path fill="${fill}" d="${pathData(loops)}"/>`),
    "</svg>",
  ].join("");
  const xs = visible.flatMap(({ points }) => points.map(([x]) => x));
  const ys = visible.flatMap(({ points }) => points.map(([, y]) => y));
  return {
    id,
    svg: svgText(svg),
    silhouette: pathData(paths[0]!.loops),
    drawn: [px(Math.min(...xs)), px(Math.min(...ys)), px(Math.max(...xs)), px(Math.max(...ys))],
  };
}
