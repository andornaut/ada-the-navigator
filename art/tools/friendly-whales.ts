// The whales of the friendly object producer (art/friendly-redesign.md): each kind's 16
// headings by 8 swim loop frames, drawn in one square frame per kind.
import { DISPLAY_SCALE } from "./crafts.ts";
import { tonePaths } from "./fleet.ts";
import {
  CALF,
  WHALE,
  whale,
  WHALE_KINDS,
  WHALE_LOOP_FRAMES,
  type WhaleKind,
  WHALES,
} from "./friendly-whale-models.ts";
import { ENEMY_HEADINGS, type Point, projectAt, round } from "./projection.ts";
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

// World units from the pivot to the farthest point of the whale's plan at heading `yaw`, over
// every loop frame: the art's ground offsets at display scale through the inverse of the game's
// (x - y, (x + y) / 2).
export function whaleFootprint(kind: WhaleKind, yaw: number): number {
  let radius = 0;
  for (let loop = 0; loop < WHALE_LOOP_FRAMES; loop++) {
    for (const face of built(kind, yaw, loop)) {
      for (const point of face.points) {
        const [x, y] = view(yaw)(point);
        const [sx, sy] = projectAt(0, 0, [x, y, 0]).map((v) => v * DISPLAY_SCALE);
        radius = Math.max(radius, Math.hypot(sx! / 2 + sy!, sy! - sx! / 2));
      }
    }
  }
  return round(radius);
}

export type DrawnWhale = {
  kind: WhaleKind;
  frame: number;
  // Per heading, its loop frames and its footprint radius in world units.
  headings: { frames: WhaleFrame[]; footprintRadius: number }[];
};

export const drawnWhale = (kind: WhaleKind): DrawnWhale => {
  const frame = whaleFrame(kind);
  return {
    kind,
    frame,
    headings: Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => ({
      frames: Array.from({ length: WHALE_LOOP_FRAMES }, (_, loop) =>
        drawWhale(kind, frame, yaw, loop),
      ),
      footprintRadius: whaleFootprint(kind, yaw),
    })),
  };
};
export const drawnWhales = (): DrawnWhale[] => WHALE_KINDS.map(drawnWhale);

// The manifest that holds each kind's rows, as shipped.
export const WHALE_MANIFEST = {
  whale: "core",
  adult: "core",
  calf: "whirlpool",
  youngCalf: "whirlpool",
} as const;
export const whaleSheetFile = (kind: WhaleKind, yaw: number) => `friendly-${kind}-${yaw}-sheet.svg`;
export const WHALE_DATA_FILE = "friendly-whales.json";

// One heading's loop frames as a sheet of nested roots in a row, each carrying its manifest id.
export function whaleSheet({ frame, headings }: DrawnWhale, yaw: number): string {
  const namespace = 'xmlns="http://www.w3.org/2000/svg"';
  const root = `<svg ${namespace} width="${frame}" height="${frame}" viewBox="0 0 ${frame} ${frame}">`;
  const roots = headings[yaw]!.frames.map(({ id, svg }, index) => {
    if (!svg.startsWith(root) || !svg.endsWith("</svg>")) {
      throw new Error(`Unexpected frame root: ${id}`);
    }
    return `<svg id="${id}" x="${index * frame}" y="0" ${svg.slice("<svg ".length)}`;
  });
  const width = roots.length * frame;
  return `<svg ${namespace} width="${width}" height="${frame}" viewBox="0 0 ${width} ${frame}">${roots.join("")}</svg>\n`;
}

export function whaleRows({ kind, frame, headings }: DrawnWhale, yaw: number, path: string) {
  return headings[yaw]!.frames.map(({ id }, loopFrame) => ({
    id,
    path,
    width: frame,
    height: frame,
    displayWidth: frame * DISPLAY_SCALE,
    displayHeight: frame * DISPLAY_SCALE,
    facing: `world-${yaw}`,
    directionIndex: yaw,
    pivot: { x: 0.5, y: 0.5 },
    kind,
    loopFrame,
    svgSheet: true,
  }));
}

type ShippedKind = {
  kind: WhaleKind;
  title: string;
  loop: { frames: number; idleMs: number; swimMs: number };
  stationaryHeading: number;
};
export type ShippedWhales = { reducedMotion: unknown; family: unknown; kinds: ShippedKind[] };

// The whale data in the shape of the shipped whales.json. The loop timings, the heading each
// kind holds while still, the reduced motion frame and the family's offsets are the shipped
// file's.
export function whaleData(whales: readonly DrawnWhale[], shipped: ShippedWhales) {
  return {
    version: 1,
    displayScale: DISPLAY_SCALE,
    headings: ENEMY_HEADINGS,
    sheets: "/art/whales/friendly-{kind}-{heading}-sheet.svg",
    palette: {
      hull: WHALE.hull,
      throat: WHALE.throat,
      fin: WHALE.fin,
      spots: WHALE.glow[0],
      calfHull: CALF.hull,
      calfThroat: CALF.throat,
      calfFin: CALF.fin,
      calfSpots: CALF.glow[0],
    },
    reducedMotion: shipped.reducedMotion,
    family: shipped.family,
    kinds: whales.map(({ kind, frame, headings }) => {
      const was = shipped.kinds.find((entry) => entry.kind === kind)!;
      if (was.loop.frames !== WHALE_LOOP_FRAMES) throw new Error(`${kind} loop length differs`);
      const { length, spots, pairs } = WHALES[kind];
      return {
        kind,
        title: was.title,
        // Display px from the fluke's tips to the snout.
        length,
        spots: { count: spots.length * (pairs ? 2 : 1), pattern: pairs ? "pairs" : "row" },
        loop: was.loop,
        stationaryHeading: was.stationaryHeading,
        headings: headings.map(({ footprintRadius }, index) => ({
          index,
          frame: { width: frame, height: frame },
          display: { width: frame * DISPLAY_SCALE, height: frame * DISPLAY_SCALE },
          pivot: [0.5, 0.5],
          footprintRadius,
        })),
      };
    }),
  };
}
