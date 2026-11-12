// Every card's close X (public/art/ui/sprites/ui-close.png, art/ui.md): the map's close glyph
// (art/tools/close-glyph.ts, map-close.svg) on its 20 grid at (2, 2) in each 24 frame, so the
// cards, the galaxy map and the local map share one X on whole pixels. Normal: the X in cream with
// no face. Pressed: the X in white on the pressed face, a 24 square without its corner pixels.
// The frames, tags and data stay ui-close.json's. Usage: node art/tools/card-close.ts
import { fileURLToPath } from "node:url";

import { blankImage } from "@andornaut/art-kit/rgbaImage";

import { CLOSE_GLYPH } from "./close-glyph.ts";
import { rgb } from "./oklab.ts";
import { writePng } from "./paint.ts";

const FRAME = 24;
const OFFSET = (FRAME - CLOSE_GLYPH.length) / 2;
const COLOURS = { normal: "#ead4aa", pressed: "#ffffff", face: "#403d55" } as const;
const output = fileURLToPath(new URL("../../public/art/ui/sprites/ui-close.png", import.meta.url));

const image = blankImage(2 * FRAME, FRAME);
const set = (x: number, y: number, colour: string) =>
  image.data.set([...rgb(colour), 255], (y * image.width + x) * 4);
for (let y = 0; y < FRAME; y++) {
  for (let x = 0; x < FRAME; x++) {
    const corner = (x === 0 || x === FRAME - 1) && (y === 0 || y === FRAME - 1);
    if (!corner) set(FRAME + x, y, COLOURS.face);
  }
}
CLOSE_GLYPH.forEach((row, y) =>
  [...row].forEach((cell, x) => {
    if (cell !== "#") return;
    set(OFFSET + x, OFFSET + y, COLOURS.normal);
    set(FRAME + OFFSET + x, OFFSET + y, COLOURS.pressed);
  }),
);
writePng(output, image);
