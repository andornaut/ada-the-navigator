// Ada's storybook sprites: crisp pixel art composited over the treated storybook backgrounds.
// The head is her portrait's neutral frame (art/sources/face-walker-ada.png, Archie's
// face-walker-ada) with a rounded crown, one 1 px shine per eye, blush, a small smile and no chin
// line; the body is a front view in Archie's walker-ada colours, about 2.5 heads tall. Each pose
// is a layer of palette keys over the head. art/tools/storybook.ts places them per background.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { decodePng } from "@andornaut/art-kit/png";
import { blankImage, type RgbaImage } from "@andornaut/art-kit/rgbaImage";

import { rgb, type Rgb } from "./oklab.ts";

const sources = fileURLToPath(new URL("../sources/", import.meta.url));

// Palette keys: the portrait's colours, walker-ada's body colours, and the sprite's additions.
const PALETTE: Readonly<Record<string, string>> = {
  H: "#181425", // ink edge
  s: "#262b44", // hair
  k: "#3a4466", // hair light
  h: "#b55088", // bow
  y: "#f6757a", // bow light, blush
  w: "#b86f50", // skin
  L: "#c28569", // skin light (walker-ada's legs)
  D: "#9c5a42", // skin shade: the neck under the chin, the arms' undersides
  O: "#733e39", // nose, mouth
  n: "#3a1f24", // inside the yawning mouth
  p: "#ffffff", // eye shine
  P: "#fee761", // shirt
  m: "#feae34", // shirt shade
  b: "#0099db", // shorts
  B: "#124e89", // shorts shade
  W: "#ffffff", // shoe
  c: "#c0cbdc", // shoe shade
  q: "#f6757a", // sole
  r: "#7a4a32", // recorder
  e: "#5a3424", // recorder shade
  R: "#efe4c8", // recorder ring
};
// The sprite canvas: 44 px wide, the head's centre line at x 21.5.
export const SPRITE_WIDTH = 44;
const HEAD_X = 6; // the portrait's column 0
const HEAD_ROWS = 25; // the crown row, then the portrait's rows 3 to 26

type Grid = string[][];

// The portrait's neutral frame as palette keys.
function portrait(): Grid {
  const image = decodePng(readFileSync(`${sources}face-walker-ada.png`));
  const key = new Map<string, string>();
  for (const k of ["H", "s", "k", "h", "y", "w", "O", "p", "P", "m"]) {
    key.set(PALETTE[k]!, k);
  }
  return Array.from({ length: 32 }, (_, y) =>
    Array.from({ length: 32 }, (_, x) => {
      const i = (y * image.width + 32 + x) * 4;
      if (image.data[i + 3] === 0) return ".";
      const hex = `#${[0, 1, 2].map((c) => image.data[i + c]!.toString(16).padStart(2, "0")).join("")}`;
      const k = key.get(hex);
      if (!k) throw new Error(`face-walker-ada has an unknown colour ${hex}`);
      return k;
    }),
  );
}

const set = (grid: Grid, x: number, y: number, k: string) => {
  grid[y]![x] = k;
};
const text = (grid: Grid, x: number, y: number, row: string) => {
  [...row].forEach((k, i) => set(grid, x + i, y, k));
};

export type Face = "open" | "yawn";

// The head on the sprite canvas, rows 0 to 24.
function head(face: Face): Grid {
  const p = portrait();
  // One shine per eye, at its top left: the lower-right shines go.
  set(p, 13, 17, "H");
  set(p, 20, 17, "H");
  // Soft blush inside the face outline, under the outer eye corners.
  for (const x of [10, 11, 20, 21]) set(p, x, 21, "y");
  // A small smile: the mouth's corners stay and its middle drops a row.
  set(p, 15, 22, "w");
  set(p, 16, 22, "w");
  set(p, 15, 23, "O");
  set(p, 16, 23, "O");
  // No chin line: the chin is skin, the neck under it in shade.
  for (let x = 13; x <= 18; x++) {
    set(p, x, 24, "w");
    for (const y of [25, 26]) if (p[y]![x] === "w") set(p, x, y, "D");
  }
  const grid: Grid = Array.from({ length: HEAD_ROWS }, () => Array<string>(SPRITE_WIDTH).fill("."));
  for (let y = 3; y <= 26; y++) {
    p[y]!.forEach((k, x) => {
      if (k !== ".") set(grid, HEAD_X + x, y - 2, k);
    });
  }
  // The crown rounded into an oval: one more row on top and softer steps.
  text(grid, 20, 0, "HHHH");
  text(grid, 18, 1, "HHkkkkHH");
  text(grid, 16, 2, "HHkkkkksssHH");
  if (face === "yawn") {
    // Eyes shut in a yawn: each a lid line, its outer end turned down.
    for (let y = 13; y <= 16; y++) {
      for (const x of [17, 18, 19, 24, 25, 26]) set(grid, x, y, "w");
    }
    for (const x of [17, 18, 19, 24, 25, 26]) set(grid, x, 15, "H");
    set(grid, 17, 14, "H");
    set(grid, 26, 14, "H");
    // A small open mouth in place of the smile.
    for (let x = 19; x <= 24; x++) {
      for (const y of [19, 20, 21]) if (grid[y]![x] === "O") set(grid, x, y, "w");
    }
    for (const [x, y] of [
      [21, 19],
      [22, 19],
      [20, 20],
      [23, 20],
      [20, 21],
      [23, 21],
      [21, 22],
      [22, 22],
    ] as const) {
      set(grid, x, y, "O");
    }
    for (const [x, y] of [
      [21, 20],
      [22, 20],
      [21, 21],
      [22, 21],
    ] as const) {
      set(grid, x, y, "n");
    }
  }
  return grid;
}

// The body and each pose over the head: every px they set, "." where the head shows. Weight on
// her left leg; torso and legs about equal (shoulder 25 to hip 40, hip to sole 54).
const PLAYING = [
  "............................................",
  "............................................",
  "............................................",
  "............................................",
  "............................................",
  "............................................",
  "............................................",
  "............................................",
  "............................................",
  "............................................",
  "............................................",
  "............................................",
  "............................................",
  "............................................",
  "............................................",
  "............................................",
  "............................................",
  "............................................",
  "............................................",
  ".........H........................H.........",
  "............................................",
  "........H............re............H........",
  "........Hs...........re...........sH........",
  "........Hs..........re..H.........sH........",
  "........H...........HHHHwHH........H........",
  "........HssssHPPPPPHwwwHwwwHHHsssssH........",
  ".........HsssHHHPPPHwwwHwwwwwwHsssH.........",
  ".........HssHwwwHPPrHHHPHwwwwwwHHsH.........",
  "..........HHwwwHPPPrePPPPHHwwwwwwH..........",
  "..........HwwwHHPPPrePPPPPmHHwwwwwH.........",
  ".........HwwwwwwHHHHPPPPPPmmmHDDDDDH........",
  "........HwwwwwwwHwwwHPPPPPmmmmHHDDDDH.......",
  ".......HDDDDDDDDHwwwHPPPPPmmmmmHHHDH........",
  "........HDDDHHHHPHHHPPPPPPmmmmmH..H.........",
  ".........HHHPPPPPrePPPPPPPmmmmmmH...........",
  "...........HPPPPrreePPPPPPmmmmmmH...........",
  "..........HPPPPHHHHHHPPPPPmmmmmmmH..........",
  "...........HHHHHmmmmmmmmmmmmHHHHH...........",
  ".............HbbHHHHHHHHHHHHBBH.............",
  ".............HbbbbbbbHbbbbBBBBH.............",
  ".............HbbbbbbbHHbbbBBBBH.............",
  "..............HHHHHHH..HHHHHHH..............",
  "..............HwLwwwH..HwLwwwH..............",
  "..............HwLwwwH..HwLwwwH..............",
  "..............HwLwwwH..HwLwwwH..............",
  "..............HwLLwwH..HwLwwwH..............",
  "..............HwLwwwH..HwLLwwH..............",
  "..............HwLwwwH..HwLwwwH..............",
  "..............HwLwwwH..HwLwwwH..............",
  "..............HHHHHHH..HwLwwwH..............",
  ".............HWWWWWWH..HHHHHHH..............",
  "............HWWWWWWWWH.HWWWWWWH.............",
  "............HccccccccHHWWWWWWWWH............",
  ".............HqqqqqqH.HccccccccH............",
  "..............HHHHHH...HqqqqqqH.............",
] as const;

const WAKING = [
  "............................................",
  "............................................",
  "............................................",
  "............................................",
  "............................................",
  "........HHHH...................HHHH.........",
  ".......Hwwww...................wwwwH........",
  ".......Hwwww...................wwwwH........",
  ".......HwwwwH..................wwwwH........",
  "........HHH.H....................HHH........",
  "........HwwwH...................wwwH........",
  ".......HwwwH.....................wwwH.......",
  ".......HwwwH.....................wwwH.......",
  ".......HwwwH.....................wwwH.......",
  ".......HwwwH......................wwwH......",
  "......Hwww........................wwwH......",
  "......HwwwH.......................wwwH......",
  "......HwwwH.......................wwwH......",
  ".....HwwwH........................HwwwH.....",
  ".....HwwwH........................HwwwH.....",
  "......HwwwH.......................wwwH......",
  ".......HwwwH.....................wwwH.......",
  "........HwwwH..................HwwwH........",
  "........HHwwwH.................HwwwH........",
  "........H.wwwH................Hwww.H........",
  "........HsHwwwHPPPPPDDDDPPmmHHwwwHsH........",
  ".........HsHwwwHPPPPPPPPPPmmHwwwHsH.........",
  ".........HssHwwwHPPPPPPPPPmHwwwHssH.........",
  "..........HsHHHHPPPPPPPPPPmmHHHHsH..........",
  "...........HHPPPPPPPPPPPPPmmmmmHH...........",
  "............HPPPPPPPPPPPPPmmmmmH............",
  "............HPPPPPPPPPPPPPmmmmmH............",
  "............HPPPPPPPPPPPPPmmmmmH............",
  "............HPPPPPPPPPPPPPmmmmmH............",
  "...........HPPPPPPPPPPPPPPmmmmmmH...........",
  "...........HPPPPPPPPPPPPPPmmmmmmH...........",
  "..........HPPPPPPPPPPPPPPPmmmmmmmH..........",
  "...........HHHHHmmmmmmmmmmmmHHHHH...........",
  ".............HbbHHHHHHHHHHHHBBH.............",
  ".............HbbbbbbbHbbbbBBBBH.............",
] as const;

const DUVET = [
  "................................................",
  "...........HHHHHffffffffffffffffHHHHH...........",
  "........HHHffffffffffffffffffffffffffHHH........",
  ".....HHHffffffffffffffffffffffffffffffffHHH.....",
  "....HfffffddddddddddfffffffffffffffffffffffH....",
  "...HffffffffffffffffffffffffdddddddddddfffffH...",
  "..HffffffffffffffffffffffffffffffffffffffffffH..",
  ".HddddddddddddddddddddddddddddddddddddddddddddH.",
  "HddddddddddddddddddddddddddddddddddddddddddddddH",
] as const;

function compose(face: Face, layer: readonly string[]): Grid {
  const grid = head(face);
  while (grid.length < layer.length) grid.push(Array<string>(SPRITE_WIDTH).fill("."));
  layer.forEach((row, y) => {
    [...row].forEach((k, x) => {
      if (k !== ".") set(grid, x, y, k);
    });
  });
  return grid;
}

function paint(image: RgbaImage, grid: Grid, dx: number, dy: number, colours = PALETTE) {
  grid.forEach((row, y) => {
    row.forEach((k, x) => {
      if (k === ".") return;
      const [r, g, b] = rgb(colours[k]!);
      image.data.set([r, g, b, 255], ((dy + y) * image.width + dx + x) * 4);
    });
  });
}

const INK = rgb(PALETTE.H!);

/** Ada playing the recorder, feet on the canvas row under her shoes; a soft ink shadow under them. */
export function playing(): RgbaImage {
  const image = blankImage(SPRITE_WIDTH, PLAYING.length + 1);
  // The shadow: ink at alpha 60, a 22 by 3 lozenge under the shoes; the sprite draws over it.
  for (let y = 0; y < 3; y++) {
    for (let x = y === 1 ? 0 : 2; x <= (y === 1 ? 21 : 19); x++) {
      image.data.set([...INK, 60], ((53 + y) * image.width + 9 + x) * 4);
    }
  }
  paint(image, compose("open", PLAYING), 0, 0);
  return image;
}

/** Her feet's centre on the playing sprite, in sprite px: x on the head's centre line. */
export const PLAYING_FEET = { x: 21.5, y: PLAYING.length } as const;

/**
 * Ada waking with a stretch and a yawn, kneeling up in bed under the duvet's bunched edge. The
 * duvet takes the morning background's treated blanket colour, `blanket`, and a fold shade.
 */
export function waking(blanket: Rgb): RgbaImage {
  const image = blankImage(SPRITE_WIDTH + 4, WAKING.length + 2);
  paint(image, compose("yawn", WAKING), 2, 0);
  const shade = blanket.map((c) => Math.max(0, c - 24)) as unknown as Rgb;
  DUVET.forEach((row, y) => {
    [...row].forEach((k, x) => {
      if (k === ".") return;
      const c = k === "H" ? INK : k === "d" ? shade : blanket;
      image.data.set([...c, 255], ((33 + y) * image.width + x) * 4);
    });
  });
  return image;
}

/** The waking sprite's centre line and height, in sprite px. */
export const WAKING_CENTRE = 23.5;
export const WAKING_HEIGHT = WAKING.length + 2;
