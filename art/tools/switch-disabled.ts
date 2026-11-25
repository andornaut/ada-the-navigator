// The switch's disabled frames (art/controls.md, Disabled states): `on-disabled` and
// `off-disabled`, drawn from the sheet's own `on` and `off` frames and appended to it. The track
// and its edge take the disabled face colour, the knob the disabled mark colour without its
// shade, and the tick or cross moves from the track onto the knob in the disabled face colour.
// The first two frames are copied unchanged. Run after art/tools/controls.ts, which writes them.
// Usage: node art/tools/switch-disabled.ts
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { decodePng } from "@andornaut/art-kit/build/png";
import { blankImage } from "@andornaut/art-kit/build/rgbaImage";

import { rgb } from "./oklab.ts";
import { writePng } from "./paint.ts";
import { prettify } from "./sprite-sheet.ts";

const [WIDTH, HEIGHT] = [32, 16];
const INK = "181425";
const KNOB = ["ffffff", "c9c4d8"];
const FACE = "#2f2d3d";
const MARK = "#9a96ad";
const sprites = fileURLToPath(new URL("../../public/art/ui/sprites/", import.meta.url));

const source = decodePng(readFileSync(`${sprites}ui-switch.png`));
const image = blankImage(4 * WIDTH, HEIGHT);
const colourAt = (frame: number, x: number, y: number): string | null => {
  const at = (y * source.width + frame * WIDTH + x) * 4;
  if (source.data[at + 3] === 0) return null;
  return [0, 1, 2].map((c) => source.data[at + c]!.toString(16).padStart(2, "0")).join("");
};
const set = (frame: number, x: number, y: number, colour: string) =>
  image.data.set([...rgb(colour), 255], (y * image.width + frame * WIDTH + x) * 4);

for (const frame of [0, 1]) {
  // The knob is the white run that an ink ring closes; the mark is the white on the track.
  const cells = Array.from({ length: HEIGHT }, (_, y) =>
    Array.from({ length: WIDTH }, (_, x) => colourAt(frame, x, y)),
  );
  const knobSide = frame === 0 ? (x: number) => x >= WIDTH / 2 : (x: number) => x < WIDTH / 2;
  const knob: [number, number][] = [];
  const mark: [number, number][] = [];
  for (const [y, row] of cells.entries()) {
    for (const [x, colour] of row.entries()) {
      if (colour === null) continue;
      set(frame, x, y, `#${colour}`);
      if (KNOB.includes(colour) && knobSide(x)) knob.push([x, y]);
      else if (colour === KNOB[0]) mark.push([x, y]);
      set(
        frame + 2,
        x,
        y,
        colour === INK ? `#${INK}` : KNOB.includes(colour) && knobSide(x) ? MARK : FACE,
      );
    }
  }
  const middle = (points: readonly [number, number][], axis: 0 | 1) =>
    (Math.min(...points.map((p) => p[axis])) + Math.max(...points.map((p) => p[axis]))) / 2;
  const [dx, dy] = [
    Math.round(middle(knob, 0) - middle(mark, 0)),
    Math.round(middle(knob, 1) - middle(mark, 1)),
  ];
  for (const [x, y] of mark) {
    if (!knob.some(([kx, ky]) => kx === x + dx && ky === y + dy)) {
      throw new Error(`The ${frame === 0 ? "tick" : "cross"} does not fit the knob`);
    }
    set(frame + 2, x + dx, y + dy, FACE);
  }
}
writePng(`${sprites}ui-switch.png`, image);

type Data = {
  frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
  meta: { size: { w: number; h: number }; frameTags: { name: string; from: number; to: number }[] };
};
const path = `${sprites}ui-switch.json`;
const data = JSON.parse(readFileSync(path, "utf8")) as Data;
const first = data.frames["ui-switch 0.aseprite"]!;
for (const index of [2, 3]) {
  data.frames[`ui-switch ${index}.aseprite`] = {
    ...first,
    frame: { ...first.frame, x: index * WIDTH },
  };
}
data.meta.size = { w: 4 * WIDTH, h: HEIGHT };
data.meta.frameTags = [
  ...data.meta.frameTags.filter(({ from }) => from < 2),
  { ...data.meta.frameTags[0]!, name: "on-disabled", from: 2, to: 2 },
  { ...data.meta.frameTags[0]!, name: "off-disabled", from: 3, to: 3 },
];
writeFileSync(path, JSON.stringify(data));
await prettify(path);
