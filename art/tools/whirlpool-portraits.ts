// Whirlpool's speakers: Marlo the trapped whale and the whale family, and the Voron (squid)
// station keepers Ripple, Coral and Brine, each one neutral frame in the conversation format.
// The whales' compact frames are drawn natively at a smaller size. Contract:
// art/conversation.md (Cast portraits).
// Usage: node art/tools/whirlpool-portraits.ts
import type { Frame } from "@andornaut/art-kit/grid";

import {
  blank,
  blush,
  dots,
  ellipse,
  eyeOpen,
  faceNeutral,
  get,
  has,
  headset,
  INK,
  type Mask,
  mirror,
  paint,
  type Point,
  polygon,
  rect,
  set,
  stamp,
  tilted,
  union,
  WHITE,
} from "./bust.ts";
import { writePortraits } from "./bust-sheets.ts";

// The Voron --------------------------------------------------------------------------------

type Skin = { base: string; shade: string; light: string };
const SEAFOAM: Skin = { base: "8fe0cf", light: "d2f7ee", shade: "4fb3a9" };
const PINK: Skin = { base: "f5b3c8", light: "ffe0ea", shade: "d27a9a" };
const DEEP: Skin = { base: "7cc0dd", light: "c0e6f4", shade: "3f7fa6" };
const SUCKER = "f6c2c8";
const GLOW = "2ce8f5";
const CUP = "3a4466";
const NAVY_STRIPE = "124e89";

// Arms, the two waving outer arms, the fins and the mantle.
function voron(skin: Skin, mantle: Mask, fins: Mask, arms: readonly number[]): Frame {
  const frame = blank();
  for (const x of arms) {
    paint(frame, ellipse(x, 26.5, 2.2, 5.2), { base: skin.base, shade: skin.shade });
    set(frame, Math.trunc(x), 28, SUCKER);
    set(frame, Math.trunc(x), 30, SUCKER);
  }
  for (const [cx, degrees] of [
    [4.5, 30],
    [26.5, -30],
  ] as const) {
    paint(frame, tilted(cx, 24.5, 2.1, 4.6, degrees), { base: skin.base, shade: skin.shade });
  }
  paint(frame, union(fins, mirror(fins)), skin);
  paint(frame, mantle, skin);
  return frame;
}

const voronFace = (frame: Frame) => faceNeutral(frame, { ex: 10, ey: 13, gap: 9, my: 18 });

function ripple(): Frame {
  const frame = voron(
    SEAFOAM,
    union(ellipse(15.5, 11.5, 8.4, 9.6), ellipse(15.5, 17.5, 10.2, 5.8)),
    polygon([
      [9.5, 4.5],
      [3.5, 8.5],
      [8.5, 12.5],
    ]),
    [8.5, 12, 15.5, 19, 22.5],
  );
  dots(
    frame,
    [
      [12, 5],
      [18, 6],
      [15, 4],
      [10, 8],
      [21, 9],
    ],
    GLOW,
  );
  set(frame, 15, 4, WHITE);
  // A sailor collar.
  paint(frame, ellipse(15.5, 22.5, 7.5, 2), { base: WHITE, shade: "c0cbdc" });
  for (let x = 10; x < 22; x++) {
    if (get(frame, x, 22) !== INK) set(frame, x, 22, NAVY_STRIPE);
  }
  const band: Point[] = [];
  for (let x = 9; x < 23; x++) band.push([x, x >= 12 && x <= 19 ? 2 : 3]);
  headset(frame, { accent: GLOW, band, cup: CUP, left: [4, 12], mic: [20, 19], right: [24, 12] });
  voronFace(frame);
  // Ripple rings on the mantle.
  dots(
    frame,
    [
      [13, 8],
      [14, 7],
      [15, 7],
      [16, 7],
      [17, 8],
    ],
    SEAFOAM.shade,
  );
  return frame;
}

function coral(): Frame {
  const frame = voron(
    PINK,
    union(ellipse(15.5, 12, 9.6, 9), ellipse(15.5, 17.5, 10.4, 5.8)),
    polygon([
      [7.5, 6.5],
      [2.5, 11.5],
      [7.5, 14.5],
    ]),
    [9, 13, 18, 22],
  );
  dots(
    frame,
    [
      [11, 6],
      [20, 6],
      [15, 4],
      [9, 10],
      [22, 10],
    ],
    GLOW,
  );
  // A shell clip and a pearl necklace.
  stamp(frame, 19, 3, [".kk.", "kssk", "kSsk", ".kk."], { k: INK, s: "ead4aa", S: "c28569" });
  for (let x = 10; x < 22; x += 2) set(frame, x, 23, WHITE);
  headset(frame, { accent: GLOW, cup: CUP, left: [4, 13], mic: [20, 19], right: [24, 13] });
  voronFace(frame);
  return frame;
}

function brine(): Frame {
  const frame = voron(
    DEEP,
    union(
      polygon([
        [15.5, 0.5],
        [24.5, 11.5],
        [24.5, 16.5],
        [6.5, 16.5],
        [6.5, 11.5],
      ]),
      ellipse(15.5, 17.5, 10, 5.8),
    ),
    polygon([
      [9.5, 7.5],
      [4.5, 12.5],
      [8.5, 15.5],
    ]),
    [7.5, 11, 15.5, 20, 23.5],
  );
  dots(
    frame,
    [
      [13, 8],
      [18, 8],
      [15, 5],
      [11, 11],
      [20, 11],
    ],
    GLOW,
  );
  // A captain's cap on the mantle's point.
  paint(frame, rect(11, 5, 20, 7), { base: WHITE, shade: "c0cbdc" });
  for (let x = 12; x < 20; x++) set(frame, x, 7, NAVY_STRIPE);
  paint(frame, rect(10, 8, 21, 9), { base: INK });
  dots(
    frame,
    [
      [11, 8],
      [12, 8],
    ],
    "5a6988",
  );
  dots(
    frame,
    [
      [15, 6],
      [16, 6],
    ],
    "fee761",
  );
  headset(frame, { accent: GLOW, cup: CUP, left: [4, 13], mic: [20, 19], right: [24, 13] });
  voronFace(frame);
  return frame;
}

// The whales -------------------------------------------------------------------------------

type WhaleColours = {
  hull: string;
  shade: string;
  light: string;
  throat: string;
  groove: string;
  glow: string;
  core: string;
};
const MARLO: WhaleColours = {
  core: "f7f2ff",
  glow: "cbb8ee",
  groove: "a9a1d0",
  hull: "aaa5e6",
  light: "bfbaef",
  shade: "7c76c4",
  throat: "e6e0f8",
};
// The family: paler and softer, with blush and no throat grooves.
const FAMILY: WhaleColours = {
  core: "fbf8ff",
  glow: "d8c9f4",
  groove: "eeeafb",
  hull: "c9c4f2",
  light: "e2dff8",
  shade: "958ecb",
  throat: "eeeafb",
};
const SMILE = "2c2660";

type WhaleShape = {
  body: readonly [number, number, number, number];
  fins: readonly [number, number, number, number, number];
  throat: number;
  grooves: readonly number[];
  glows: readonly Point[];
  core: Point;
  eyes: readonly [number, number];
  eyeRow: number;
  mouth: number;
  smile: number;
  cheeks: boolean;
};

const SHAPES = {
  family: {
    body: [15.5, 16.6, 13, 11.6],
    cheeks: true,
    core: [15, 6],
    eyeRow: 14,
    eyes: [9, 20],
    fins: [3.5, 27, 3.8, 2, 25],
    glows: [
      [12, 7],
      [15, 6],
      [16, 6],
      [19, 7],
    ],
    grooves: [],
    mouth: 18,
    smile: 3,
    throat: 21,
  },
  familyCompact: {
    body: [15.5, 15.8, 9.8, 8.8],
    cheeks: true,
    core: [15, 8],
    eyeRow: 13,
    eyes: [10, 18],
    fins: [6.5, 23.5, 2.4, 1.3, 25],
    glows: [
      [12, 9],
      [15, 8],
      [16, 8],
      [19, 9],
    ],
    grooves: [],
    mouth: 17,
    smile: 2,
    throat: 19,
  },
  marlo: {
    body: [15.5, 17, 14.6, 12.6],
    cheeks: false,
    core: [15, 5],
    eyeRow: 15,
    eyes: [8, 21],
    fins: [3, 27.5, 4.2, 2.2, 25],
    glows: [
      [11, 7],
      [15, 5],
      [16, 5],
      [20, 7],
    ],
    grooves: [24, 27],
    mouth: 19,
    smile: 3,
    throat: 21,
  },
  marloCompact: {
    body: [15.5, 15.6, 10.6, 9.2],
    cheeks: false,
    core: [15, 7],
    eyeRow: 13,
    eyes: [9, 19],
    fins: [6, 24, 2.8, 1.5, 25],
    glows: [
      [12, 8],
      [15, 7],
      [16, 7],
      [19, 8],
    ],
    grooves: [22],
    mouth: 17,
    smile: 2,
    throat: 19,
  },
} satisfies Record<string, WhaleShape>;

// A whale's face filling the frame: fins, the hull, a pale throat, crown glow spots, eyes and
// the wide smile lifted at its ends.
function whale(colours: WhaleColours, shape: WhaleShape): Frame {
  const frame = blank();
  const [bx, by, brx, bry] = shape.body;
  const [fx, fy, frx, fry, fd] = shape.fins;
  const body = ellipse(bx, by, brx, bry);
  paint(frame, union(tilted(fx, fy, frx, fry, -fd), tilted(31 - fx, fy, frx, fry, fd)), {
    base: colours.hull,
    shade: colours.shade,
  });
  paint(frame, body, { base: colours.hull, light: colours.light, shade: colours.shade });
  for (let y = shape.throat; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const colour = get(frame, x, y);
      if (!has(body, x, y) || colour === INK || colour === null) continue;
      set(frame, x, y, colours.throat);
      if (shape.grooves.includes(y) && has(body, x + 1, y) && has(body, x - 1, y)) {
        set(frame, x, y, colours.groove);
      }
    }
  }
  dots(frame, shape.glows, colours.glow);
  set(frame, ...shape.core, colours.core);
  const [lx, rx] = shape.eyes;
  eyeOpen(frame, lx, shape.eyeRow);
  eyeOpen(frame, rx, shape.eyeRow);
  if (shape.cheeks) blush(frame, lx - 2, rx + 3, shape.eyeRow + 3);
  const c = Math.trunc(bx);
  const w = shape.smile;
  const smile: Point[] = [];
  for (let x = c - w + 1; x < c + w + 1; x++) smile.push([x, shape.mouth + 1]);
  smile.push([c - w, shape.mouth], [c + w + 1, shape.mouth]);
  dots(frame, smile, SMILE);
  return frame;
}

const KEYS = ["marlo", "family", "ripple", "coral", "brine"];
const ids = await writePortraits(
  "whirlpool",
  "whirlpool/portraits",
  [
    {
      compact: [5, 5],
      frames: [["neutral", whale(MARLO, SHAPES.marlo)]],
      key: "marlo",
      small: [whale(MARLO, SHAPES.marloCompact)],
    },
    {
      compact: [5, 5],
      frames: [["neutral", whale(FAMILY, SHAPES.family)]],
      key: "family",
      small: [whale(FAMILY, SHAPES.familyCompact)],
    },
    { compact: [5, 2], frames: [["neutral", ripple()]], key: "ripple" },
    { compact: [5, 2], frames: [["neutral", coral()]], key: "coral" },
    { compact: [5, 2], frames: [["neutral", brine()]], key: "brine" },
  ],
  (id) => KEYS.some((key) => id === `${key}-portrait` || id === `${key}-portrait-compact`),
);
console.log(`wrote ${ids.join(", ")}`);
