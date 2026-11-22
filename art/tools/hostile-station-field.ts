import { DISPLAY_SCALE } from "./crafts.ts";
import type { V2 } from "./silhouette.ts";

type Layout = {
  frame: number;
  headings: {
    collision: V2[][];
    banner: V2;
    hardpoints: { anchor: V2; pivot: V2; collision: Record<string, V2[][]> }[];
  }[];
};

type Field = {
  frame: number;
  inset: number;
  span: number;
};

export function rebaseStationField(raw: string) {
  const layout = JSON.parse(raw) as Layout;
  const xs = layout.headings[0]!.collision.flat().map(([x]) => x);
  const span = (Math.max(...xs) - Math.min(...xs)) * 1.5;
  // Keep at least eight raw px around the field, rounded up to the existing frame multiple.
  const frame = Math.ceil((span + 16) / 8) * 8;
  const inset = (frame - layout.frame) / 2;
  const shift = ([x, y]: V2): V2 => [
    Math.round((x + inset) * 1000) / 1000,
    Math.round((y + inset) * 1000) / 1000,
  ];
  const parts = (value: V2[][]): V2[][] => value.map((polygon) => polygon.map(shift));

  return {
    field: { frame, inset, span },
    layout: JSON.stringify({
      ...layout,
      frame,
      headings: layout.headings.map((heading) => ({
        ...heading,
        collision: parts(heading.collision),
        banner: shift(heading.banner),
        hardpoints: heading.hardpoints.map((hardpoint) => ({
          ...hardpoint,
          anchor: shift(hardpoint.anchor),
          pivot: shift(hardpoint.pivot),
          collision: Object.fromEntries(
            Object.entries(hardpoint.collision).map(([state, value]) => [state, parts(value)]),
          ),
        })),
      })),
    }),
  };
}

export function stationFieldSvg(field: Field, light: boolean, hull: string): string {
  const { frame, inset, span } = field;
  const centre = frame / 2;
  const display = frame * DISPLAY_SCALE;
  const rx = span / 2 - 4;
  const ry = rx / 1.75;
  const point = (degrees: number): V2 => {
    const angle = (degrees * Math.PI) / 180;
    return [centre + rx * Math.cos(angle), centre + ry * Math.sin(angle)];
  };
  const arc = (from: number, to: number) =>
    `M ${point(from).join(" ")} A ${rx} ${ry} 0 0 1 ${point(to).join(" ")}`;
  const guides = [0, 46, 90, 134, 180, 226, 270, 314].map((angle) => arc(angle - 12, angle + 12));
  const segments = guides.join(" ");
  const nodes = [26, 113, 201, 292]
    .map(point)
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5"/>`)
    .join("");
  const [glow, line, mark] = light
    ? ["#5575b6", "#4268a7", "#604b97"]
    : ["#4c74d6", "#99baff", "#d6c7ff"];
  // Group opacity applies after compositing, so even overlapping strokes stay below 0.5.
  const perimeter =
    `<g opacity="0.46"><path d="${segments}" fill="none" stroke="${glow}" stroke-width="8" stroke-opacity="0.45" stroke-linecap="round"/>` +
    `<path d="${segments}" fill="none" stroke="${line}" stroke-width="3.5" stroke-linecap="round"/>` +
    `<g fill="${mark}">${nodes}</g></g>`;

  const padded = hull
    .replace(
      /^<svg[^>]*>/,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${display}" height="${display}" viewBox="0 0 ${frame} ${frame}">`,
    )
    .replace(/<\/title>/, `</title>${perimeter}<g transform="translate(${inset} ${inset})">`)
    .replace("</svg>", "</g></svg>");
  return padded;
}
