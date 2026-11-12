// Phantom's destinations: the three Blurb settlements, each in a cracked and a mended state with
// an A/B blink. Usage: node art/tools/phantom.ts writes public/art/phantom/ and replaces its
// own entries in place in Phantom's manifest. Contract: art/phantom.md.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import * as m from "./phantom-models.ts";
import { replaceEntries } from "./manifest.ts";
import { type Point, projectAt, round } from "./projection.ts";
import {
  along,
  BLINK_MS,
  DESTINATION_SCALE,
  DISPLAY_SCALE,
  DOCK,
  type Face,
  polygons,
} from "./solid.ts";

const output = fileURLToPath(new URL("../../public/art/phantom/", import.meta.url));
const PATH = "/art/phantom/";
const PAD = 4;
const STEP = 16;

// ---------------------------------------------------------------- frames

type Layout = { halfWidth: number; above: number; width: number; height: number };

// One frame over every listed face, with the pivot on the vertical centre line: width and height
// are multiples of 16 px and the pivot height is an exact five-decimal fraction.
function layout(faces: readonly Face[]): Layout {
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

const frameXY = ({ above, halfWidth }: Layout, point: Point) => projectAt(halfWidth, above, point);

// SVG at its display size with the viewBox in frame px.
function svgFile(title: string, frame: Layout, faces: readonly Face[]): string {
  const shapes = faces.map(({ color, points }) => {
    const projected = points.map((point) => {
      const [x, y] = frameXY(frame, point);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return `  <polygon fill="${color}" points="${projected.join(" ")}"/>`;
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(frame.width * DISPLAY_SCALE * DESTINATION_SCALE)}" height="${round(frame.height * DISPLAY_SCALE * DESTINATION_SCALE)}" viewBox="0 0 ${frame.width} ${frame.height}">`,
    `  <title>${title}</title>`,
    ...shapes,
    "</svg>",
    "",
  ].join("\n");
}

// A dock mouth `face` along the dock axis on the world plane, in the station dock schema.
function dockAt(frame: Layout, face: number, mouthWidth: number) {
  const [x, y] = frameXY(frame, [...along(DOCK, face, 0), 0]);
  return {
    x: round(x),
    y: round(y),
    outward: [0, 1],
    width: round((mouthWidth * Math.sqrt(3)) / Math.SQRT2),
  };
}

// ---------------------------------------------------------------- settlements

type Item = { id: string; file: string; title: string; faces: readonly Face[]; state: m.DockState };

// The three settlements in story order. Each design's four sprites share one frame and pivot, so a
// state change or a blink swaps the sprite in place.
const settlements = [
  { variant: "homes", title: "Blurb homes", build: m.homes },
  { variant: "harbour", title: "Blurb harbour", build: m.harbour },
  { variant: "signal", title: "Blurb signal", build: m.signal },
] as const;

mkdirSync(output, { recursive: true });
const entries = settlements.flatMap(({ build, title, variant }) => {
  const items: Item[] = (["cracked", "mended"] as const).flatMap((state) =>
    (["a", "b"] as const).map((letter) => ({
      id: `outpost-${variant}-${state}-${letter}`,
      file: `${variant}-${state}-${letter}`,
      title: `${title}, ${state} ${letter.toUpperCase()}`,
      faces: polygons(build(letter === "a", state), undefined, m.SETTLEMENT_LEVELS),
      state,
    })),
  );
  const frame = layout(items.flatMap(({ faces }) => faces));
  const dock = dockAt(frame, m.SETTLEMENT_DOCK.face, m.SETTLEMENT_DOCK.mouth);
  return items.map((item) => {
    writeFileSync(`${output}${item.file}.svg`, svgFile(item.title, frame, item.faces));
    return {
      id: item.id,
      path: `${PATH}${item.file}.svg`,
      width: frame.width,
      height: frame.height,
      displayWidth: round(frame.width * DISPLAY_SCALE * DESTINATION_SCALE),
      displayHeight: round(frame.height * DISPLAY_SCALE * DESTINATION_SCALE),
      facing: "fixed",
      pivot: { x: 0.5, y: frame.above / frame.height },
      frameMs: BLINK_MS,
      dock,
      outpost: "settlement",
      variant,
      state: item.state,
    };
  });
});
replaceEntries(
  "phantom",
  (id) => /^outpost-(homes|harbour|signal)-(cracked|mended)-[ab]$/.test(id),
  entries,
);
