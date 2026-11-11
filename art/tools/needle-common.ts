// Shared parts of the Needle generators: the Weaver palette, frame layout, SVG output and dock
// points in the station family's schema. Contract: art/needle.md.
import { fileURLToPath } from "node:url";

import { type Point, projectAt, round } from "./projection.ts";
import { DISPLAY_SCALE, type Face } from "./solid.ts";

export const OUT = fileURLToPath(new URL("../../public/art/needle/", import.meta.url));
export const PUBLIC = "/art/needle/";

// Needle's field (public/art/galaxies.json `needle`), for the contrast checks.
export const FIELD = "#26221F";
export const MARKER = "#CFC5BD";

// Weaver palette.
export const pearl = "#e9e3da";
export const pearlSide = "#b3aba1";
export const pearlRear = "#8f877e";
export const silver = "#cfc5bd";
export const silverSide = "#9d948b";
export const lav = "#c4afcc";
export const lavSide = "#8f7c9c";
export const rose = "#e3b7c0";
export const roseSide = "#a9808a";
export const sage = "#b9cfae";
export const sageSide = "#83987a";
export const glass = "#6f6688";
export const glassSide = "#4a4360";
export const steel = "#8d8a99";
export const steelSide = "#625f70";
export const blueSide = "#5687ba";
export const blueDimSide = "#33475f";
export const lamp = "#ffe9b8";

// Screen axes on the world plane, as fixed-art plan angles: right, left, up (far).
export const RIGHT = -Math.PI / 4;
export const LEFT = (3 * Math.PI) / 4;
export const BACK = (-3 * Math.PI) / 4;

const PAD = 4;
const STEP = 16;

export type Layout = { halfWidth: number; above: number; width: number; height: number };

// One frame over every listed face set: the pivot on the vertical centre line, frame sides in
// multiples of 16 px and a pivot height that is an exact five-decimal fraction.
export function layout(faces: readonly Face[]): Layout {
  const all = faces.flatMap(({ points }) => points);
  const xs = all.map((point) => projectAt(0, 0, point)[0]);
  const ys = all.map((point) => projectAt(0, 0, point)[1]);
  const half = Math.max(-Math.min(...xs), Math.max(...xs)) + PAD;
  const halfWidth = Math.ceil(half / (STEP / 2)) * (STEP / 2);
  const minAbove = Math.ceil(-Math.min(...ys) + PAD);
  const minBelow = Math.ceil(Math.max(...ys) + PAD);
  for (let height = Math.ceil((minAbove + minBelow) / STEP) * STEP; ; height += STEP) {
    for (let above = minAbove; above <= height - minBelow; above++) {
      if ((above * 100000) % height === 0) {
        return { halfWidth, above, width: halfWidth * 2, height };
      }
    }
  }
}

// The smallest square frame, a multiple of 16 px, holding every point around a centred pivot.
export function squareFrame(points: readonly Point[]): number {
  const extent = Math.max(
    ...points.map((point) => {
      const [x, y] = projectAt(0, 0, point);
      return Math.max(Math.abs(x), Math.abs(y));
    }),
  );
  return Math.ceil((2 * (extent + PAD)) / STEP) * STEP;
}

export type Polygon = {
  color: string;
  points: readonly (readonly [number, number])[];
  opacity?: number;
};

// SVG at display size (frame times 0.4375) with the viewBox in frame px.
export function svgFile(
  title: string,
  width: number,
  height: number,
  polygons: readonly Polygon[],
) {
  const shapes = polygons.map(({ color, opacity, points }) => {
    const pts = points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
    const alpha = opacity === undefined ? "" : ` fill-opacity="${opacity}"`;
    return `  <polygon fill="${color}"${alpha} points="${pts}"/>`;
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(width * DISPLAY_SCALE)}" height="${round(height * DISPLAY_SCALE)}" viewBox="0 0 ${width} ${height}">`,
    `  <title>${title}</title>`,
    ...shapes,
    "</svg>",
    "",
  ].join("\n");
}

// Faces placed in a frame with the pivot at (x, y) frame px.
export const placed = (x: number, y: number, faces: readonly Face[]): Polygon[] =>
  faces.map(({ color, points }) => ({ color, points: points.map((p) => projectAt(x, y, p)) }));

// Screen direction of a world-plane plan axis, normalized.
export function screenAxis(angle: number): [number, number] {
  const [x, y] = [Math.cos(angle), Math.sin(angle)];
  const [sx, sy] = [((x - y) * Math.sqrt(3)) / 2, (x + y) / 2];
  const length = Math.hypot(sx, sy);
  return [round(sx / length), round(sy / length)];
}

// A dock or berth `face` along plan axis `angle` on the world plane, `width` model units across:
// its point in frame px, its outward screen direction and its drawn width across the axis.
export function dockAt(frame: Layout, angle: number, face: number, width: number) {
  const [x, y] = projectAt(frame.halfWidth, frame.above, [
    Math.cos(angle) * face,
    Math.sin(angle) * face,
    0,
  ]);
  return {
    x: round(x),
    y: round(y),
    outward: screenAxis(angle),
    width: round((width * Math.sqrt(3)) / Math.SQRT2),
  };
}

// WCAG contrast of two sRGB colours.
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [la, lb] = [lum(a), lum(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
