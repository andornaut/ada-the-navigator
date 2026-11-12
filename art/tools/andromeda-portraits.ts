// Andromeda's Munix (android) portraits, a pearl dome with a screen face, LED eyes and a beacon
// antenna, as 32 px sheets and 22 px compact crops in the conversation format: Pip under the
// courier cap, Wick (the settler sheet) under the brimmed hat, the settlements' greeter in a rose
// bobble hat, and the station keepers Lumen, Dial and Cog, one neutral frame each.
// Contract: art/andromeda.md (Portraits) and art/conversation.md (Cast portraits).
// Usage: node art/tools/andromeda-portraits.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Frame } from "@andornaut/art-kit/grid";
import type { Tag } from "@andornaut/art-kit/raster";
import { writeSpriteSheet } from "@andornaut/art-kit/spriteSheet";
import { format, resolveConfig } from "prettier";

import {
  above,
  blank,
  COMPACT,
  crop,
  dots,
  ellipse,
  fill,
  FULL,
  get,
  INK,
  line,
  paint,
  type Point,
  polygon,
  rect,
  set,
  shoulders,
  stamp,
  sweat,
  union,
  WHITE,
} from "./bust.ts";
import { writePortraits } from "./bust-sheets.ts";
import { replaceEntries } from "./manifest.ts";

const output = fileURLToPath(new URL("../../public/art/andromeda/portraits/", import.meta.url));

const PEARL = { base: "e9e3da", light: "ffffff", shade: "b3aba1" };
const PERI = { base: "8f9cf0", light: "b9c2f7", shade: "5b6093" };
const METAL = { base: "8b9bb4", shade: "5a6988" };
const SCREEN = "232845";
const SCREEN_GLINT = "4b5578";
const LED = "8ff3ff";
const LED_BLUSH = "f6757a";
const BEACON = "fee761";
const STRAP = "e4a672";
const BUCKLE = "feae34";
const HAT = { base: "b86f50", light: "d08a68", shade: "733e39" };
const COAT = { base: "c28569", light: "d9a07c", shade: "8a5a44" };

type Mood = "happy" | "neutral" | "worried";
type Role = "pip" | "settler";
const MOODS: readonly Mood[] = ["happy", "neutral", "worried"];

// The screen face: eyes at `lx` and `rx` from row `ey`, the mouth on row `my`. Happy shows LED
// arcs, a smile and pink cheek LEDs; neutral tall LEDs and a short line; worried slanted brows
// and a wobble.
function ledFace(frame: Frame, mood: Mood, lx: number, rx: number, ey: number, my: number): void {
  const c = Math.floor((lx + rx + 2) / 2);
  if (mood === "happy") {
    for (const x of [lx, rx]) {
      dots(
        frame,
        [
          [x, ey + 1],
          [x + 1, ey],
          [x + 2, ey + 1],
        ],
        LED,
      );
    }
    dots(
      frame,
      [
        [c - 3, my - 1],
        [c - 2, my],
        [c - 1, my],
        [c, my],
        [c + 1, my],
        [c + 2, my - 1],
      ],
      LED,
    );
    dots(
      frame,
      [
        [lx - 1, my - 1],
        [lx, my - 1],
        [rx + 2, my - 1],
        [rx + 3, my - 1],
      ],
      LED_BLUSH,
    );
    return;
  }
  for (const x of [lx, rx]) {
    fill(frame, rect(x, ey, x + 1, ey + 2), LED);
    set(frame, x, ey, WHITE);
  }
  if (mood === "worried") {
    dots(
      frame,
      [
        [lx, ey - 1],
        [lx + 1, ey - 2],
        [rx + 1, ey - 1],
        [rx, ey - 2],
      ],
      LED,
    );
    dots(
      frame,
      [
        [c - 3, my],
        [c - 2, my - 1],
        [c - 1, my],
        [c, my - 1],
        [c + 1, my],
        [c + 2, my - 1],
      ],
      LED,
    );
  } else {
    dots(
      frame,
      [
        [c - 2, my],
        [c - 1, my],
        [c, my],
        [c + 1, my],
      ],
      LED,
    );
  }
}

// A stalk from `base` up to a beacon-lit ball whose top is row `top`.
function antenna(frame: Frame, x: number, top: number, base: number): void {
  if (base >= top + 3) dots(frame, line([x, base], [x, top + 3]), INK);
  stamp(frame, x - 1, top, [".kk.", "kBWk", "kBBk", ".kk."], { B: BEACON, k: INK, W: WHITE });
}

function munix(role: Role, mood: Mood): Frame {
  const frame = blank();
  const body = shoulders([7, 9, 11, 12, 12, 12, 12]);
  if (role === "pip") {
    paint(frame, body, PERI);
    // Satchel strap and buckle, and a panel seam.
    dots(frame, [...line([8, 25], [18, 31]), ...line([9, 25], [19, 31])], STRAP);
    dots(
      frame,
      [
        [13, 28],
        [14, 28],
      ],
      BUCKLE,
    );
    for (let x = 19; x < 27; x++) {
      if (get(frame, x, 29) !== INK) set(frame, x, 29, PERI.shade);
    }
  } else {
    // Coat, pearl collar and periwinkle tie.
    paint(frame, body, COAT);
    paint(
      frame,
      polygon([
        [11.5, 24.5],
        [15.5, 28.5],
        [19.5, 24.5],
      ]),
      { base: PEARL.base, outline: false, shade: PEARL.shade },
    );
    const tie: Point[] = [26, 27, 28, 29].flatMap((y): Point[] => [
      [15, y],
      [16, y],
    ]);
    dots(frame, [...tie, [15, 30]], PERI.shade);
  }
  paint(frame, rect(13, 21, 18, 25), METAL);
  // Ear discs with a glint.
  for (const cx of [5.6, 25.4]) {
    paint(frame, ellipse(cx, 15, 2.4, 3.2), { base: PERI.base, shade: PERI.shade });
    set(frame, Math.trunc(cx), 14, WHITE);
  }
  paint(frame, ellipse(15.5, 14.6, 10, 9), PEARL);
  // The seam over the crown.
  for (let x = 9; x < 23; x++) {
    const colour = get(frame, x, 7);
    if (colour !== INK && colour !== null) set(frame, x, 7, PEARL.shade);
  }
  paint(frame, ellipse(15.5, 15.8, 7, 5), { base: SCREEN });
  dots(
    frame,
    [
      [11, 12],
      [12, 12],
    ],
    SCREEN_GLINT,
  );
  if (role === "pip") {
    antenna(frame, 19, 0, 5);
    paint(frame, above(ellipse(15.5, 7.8, 8.4, 3.6), 10), PERI);
    paint(frame, rect(4, 8, 14, 9), { base: PERI.shade });
    dots(
      frame,
      [
        [15, 6],
        [16, 6],
      ],
      WHITE,
    );
  } else {
    antenna(frame, 22, 0, 6);
    paint(frame, ellipse(15.5, 8.6, 12.6, 1.8), { base: HAT.base, shade: HAT.shade });
    paint(frame, above(ellipse(15.5, 5.8, 6.6, 4.4), 9), HAT);
    for (let x = 10; x < 22; x++) {
      if (get(frame, x, 7) !== INK) set(frame, x, 7, PERI.shade);
    }
  }
  ledFace(frame, mood, 11, 19, 14, 18);
  if (mood === "worried") sweat(frame, 24, 9);
  return frame;
}

// The 22 px window's origin: the antenna ball's lower half and the hat or cap to the chin.
const CROP: Point = [5, 2];
const FRAME_MS = 1000;
const PORTRAITS = [
  { id: "pip-portrait", key: "pip", role: "pip" },
  { id: "settler-portrait", key: "settler", role: "settler" },
] as const;

// Sprite data goes through the project's Prettier settings so the files stay Prettier-clean.
async function prettify(path: string): Promise<void> {
  const options = await resolveConfig(path);
  writeFileSync(path, await format(readFileSync(path, "utf8"), { ...options, filepath: path }));
}

function entry(id: string, key: string, size: number) {
  return {
    id,
    path: `/art/andromeda/portraits/${key}.png`,
    width: size * MOODS.length,
    height: size,
    ...(size === COMPACT ? { displayWidth: size * 2, displayHeight: size * 2 } : {}),
    facing: "front",
    pivot: { x: 0.5, y: 0.5 },
    frameWidth: size,
    frameHeight: size,
    frames: Object.fromEntries(MOODS.map((name, i) => [name, i])),
  };
}

mkdirSync(output, { recursive: true });
const entries: ReturnType<typeof entry>[] = [];
for (const { id, key, role } of PORTRAITS) {
  const frames = MOODS.map((mood) => munix(role, mood));
  for (const [sheet, size, list] of [
    [key, FULL, frames],
    [`${key}-compact`, COMPACT, frames.map((frame) => crop(frame, CROP))],
  ] as const) {
    const tags: Tag[] = MOODS.map((name, i) => [name, [list[i]!], FRAME_MS]);
    await writeSpriteSheet(
      { data: `${output}${sheet}.json`, sheet: `${output}${sheet}.png` },
      { key: sheet },
      tags,
    );
    await prettify(`${output}${sheet}.json`);
    entries.push(entry(size === FULL ? id : `${id}-compact`, sheet, size));
  }
}

// Full sheets then compact sheets, last in Andromeda's manifest.
const ordered = entries.toSorted(
  (p, q) =>
    Number(p.id.endsWith("-compact")) - Number(q.id.endsWith("-compact")) ||
    p.id.localeCompare(q.id),
);
replaceEntries("andromeda", (id) => /^(pip|settler)-portrait(-compact)?$/.test(id), ordered);

// The Munix cast --------------------------------------------------------------------------

type Shell = { base: string; shade: string; light: string };

// The neck, ear discs (or bigger dial ears), the dome with its crown seam and the screen.
function dome(
  frame: Frame,
  {
    ears = { base: PERI.base, shade: PERI.shade },
    screen = [7, 5],
    shell = PEARL,
    dial = false,
  }: {
    ears?: { base: string; shade: string };
    screen?: readonly [number, number];
    shell?: Shell;
    dial?: boolean;
  } = {},
): void {
  paint(frame, rect(13, 21, 18, 25), METAL);
  for (const cx of [5.6, 25.4]) {
    const x = Math.trunc(cx);
    if (dial) {
      paint(frame, ellipse(cx, 15, 3.2, 3.4), ears);
      dots(
        frame,
        [
          [x, 13],
          [x, 14],
        ],
        WHITE,
      );
    } else {
      paint(frame, ellipse(cx, 15, 2.4, 3.2), ears);
      set(frame, x, 14, WHITE);
    }
  }
  paint(frame, ellipse(15.5, 14.6, 10, 9), shell);
  for (let x = 9; x < 23; x++) {
    const colour = get(frame, x, 7);
    if (colour !== INK && colour !== null) set(frame, x, 7, shell.shade);
  }
  paint(frame, ellipse(15.5, 15.8, screen[0], screen[1]), { base: SCREEN });
  dots(
    frame,
    [
      [11, 12],
      [12, 12],
    ],
    SCREEN_GLINT,
  );
}

// Neutral LED eyes and mouth in `led`.
function leds(frame: Frame, led: string): void {
  for (const x of [11, 19]) {
    fill(frame, rect(x, 14, x + 1, 16), led);
    set(frame, x, 14, WHITE);
  }
  dots(
    frame,
    [14, 15, 16, 17].map((x): Point => [x, 18]),
    led,
  );
}

// The keepers' mic boom from the right ear.
function mic(frame: Frame, from: Point = [24, 17]): void {
  dots(frame, line(from, [20, 20]), INK);
  set(frame, 20, 20, BEACON);
}

function lumen(): Frame {
  const frame = blank();
  paint(frame, shoulders([7, 9, 11, 12, 12, 12, 12]), PERI);
  dome(frame);
  // A lantern antenna: a tall stalk and a big lit lamp with a glow ring.
  dots(frame, line([15, 5], [15, 3]), INK);
  stamp(frame, 12, -1, ["..kkk..", ".kyyyk.", "kyWWyyk", "kyWyyyk", ".kyyyk.", "..kkk.."], {
    k: INK,
    W: WHITE,
    y: BEACON,
  });
  dots(
    frame,
    [
      [11, 1],
      [20, 1],
      [10, 3],
      [21, 3],
    ],
    BEACON,
  );
  leds(frame, "ffe9a0");
  mic(frame);
  return frame;
}

function dial(): Frame {
  const frame = blank();
  paint(frame, shoulders([8, 10, 12, 13, 13, 13, 13]), PEARL);
  for (let x = 5; x < 27; x++) {
    if (get(frame, x, 28) !== INK) set(frame, x, 28, PERI.base);
  }
  dome(frame, {
    dial: true,
    ears: { base: PEARL.base, shade: PEARL.shade },
    shell: { base: "b9c2f7", light: "e4e8ff", shade: PERI.base },
  });
  // Twin short antennae with lit tips.
  for (const x of [11, 20]) {
    dots(
      frame,
      [
        [x, 5],
        [x, 4],
      ],
      INK,
    );
    stamp(frame, x - 1, 2, ["kk", "Bk"], { B: BEACON, k: INK });
    set(frame, x, 2, BEACON);
  }
  leds(frame, LED);
  mic(frame, [25, 18]);
  return frame;
}

function cog(): Frame {
  const frame = blank();
  paint(frame, shoulders([7, 9, 11, 12, 12, 12, 12]), {
    base: PERI.shade,
    light: PERI.base,
    shade: "3e4377",
  });
  // A cog crown in place of an antenna, a lit hub at its centre.
  const teeth = (
    [
      [15, 0],
      [16, 0],
      [11, 2],
      [20, 2],
      [10, 5],
      [21, 5],
    ] as const
  ).map(([x, y]) => rect(x, y, x, y));
  paint(frame, union(ellipse(15.5, 4.2, 4.4, 3.6), ...teeth), { base: "c0cbdc", shade: "8b9bb4" });
  fill(frame, ellipse(15.5, 4.2, 1.4, 1.2), BEACON);
  dome(frame, {
    ears: { base: PERI.shade, shade: "3e4377" },
    screen: [7.4, 4.6],
    shell: { base: "c0cbdc", light: WHITE, shade: "8b9bb4" },
  });
  leds(frame, "9ff7a0");
  mic(frame);
  return frame;
}

// The settlements' greeter: a Munix in a rose bobble hat and a rose sweater with a periwinkle
// stripe, the antenna through the hat; unlike Wick, no brimmed hat or brown coat.
const ROSE = { base: "f2a7c6", light: "ffd0e4", shade: "c46f98" };

function greeter(): Frame {
  const frame = blank();
  paint(frame, shoulders([7, 9, 11, 12, 12, 12, 12]), ROSE);
  for (let x = 0; x < FULL; x++) {
    const colour = get(frame, x, 28);
    if (colour !== INK && colour !== null) set(frame, x, 28, PERI.base);
  }
  paint(
    frame,
    polygon([
      [11.5, 24.5],
      [15.5, 28.5],
      [19.5, 24.5],
    ]),
    { base: PEARL.base, outline: false, shade: PEARL.shade },
  );
  dome(frame);
  antenna(frame, 22, 0, 6);
  paint(frame, above(ellipse(15.5, 8, 8.6, 4.4), 10), ROSE);
  for (let x = 8; x < 24; x++) {
    const colour = get(frame, x, 9);
    if (colour !== INK && colour !== null) set(frame, x, 9, ROSE.shade);
  }
  paint(frame, ellipse(15.5, 2.6, 2.4, 2.2), { base: WHITE, shade: "c0cbdc" });
  leds(frame, LED);
  return frame;
}

const CAST = ["settler-greeter", "lumen", "dial", "cog"];
const cast = await writePortraits(
  "andromeda",
  "andromeda/portraits",
  [
    { compact: [5, 1], frames: [["neutral", greeter()]], key: "settler-greeter" },
    { compact: [5, 1], frames: [["neutral", lumen()]], key: "lumen" },
    { compact: [5, 2], frames: [["neutral", dial()]], key: "dial" },
    { compact: [5, 1], frames: [["neutral", cog()]], key: "cog" },
  ],
  (id) => CAST.some((key) => id === `${key}-portrait` || id === `${key}-portrait-compact`),
);
console.log(`wrote ${cast.join(", ")}`);
