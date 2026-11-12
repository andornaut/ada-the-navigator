// Needle's Avi (heron) portraits as 32 px storybook and 22 px compact sheets. Elder Loom: silver
// feathers, a white crest plume, a braided plume over the shoulder, pilot goggles pushed up, a
// long yellow beak and a lavender tunic with a pearl collar and a rose thread badge. Reed and the
// station keepers Sedge, Willow and Marsh: one neutral frame each.
// Contract: art/needle.md (Elder Loom's portrait) and art/conversation.md (Cast portraits).
// Usage: node art/tools/needle-portraits.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Frame } from "@andornaut/art-kit/grid";
import type { Tag } from "@andornaut/art-kit/raster";
import { writeSpriteSheet } from "@andornaut/art-kit/spriteSheet";
import { format, resolveConfig } from "prettier";

import {
  blank,
  blush,
  COMPACT,
  crop,
  dots,
  ellipse,
  eyeHappy,
  eyeOpen,
  fill,
  FULL,
  get,
  has,
  headset,
  INK,
  type Mask,
  paint,
  type Point,
  polygon,
  rect,
  set,
  shoulders,
  stamp,
  tilted,
  WHITE,
} from "./bust.ts";
import { writePortraits } from "./bust-sheets.ts";
import { replaceEntries } from "./manifest.ts";

const output = fileURLToPath(new URL("../../public/art/needle/portraits/", import.meta.url));

const MS = 1000;
const FRAMES = ["happy", "neutral"] as const;
type Mood = (typeof FRAMES)[number];
// The compact crop's top-left in the 32 frame: the crest's base to the beak's tip.
const CROP: Point = [5, 2];

const SILVER = { base: "c9ccd8", light: WHITE, shade: "9097ab" };
const PLUME = { base: WHITE, shade: "c0cbdc" };
const TUNIC = { base: "c4afcc", light: "dccce2", shade: "9b88a8" };
const COLLAR = { base: "e9e3da", shade: "b3aba1" };
const ROSE = "e8968c";
const ROSE_SHADE = "b55088";
const STRAP = "4a4360";
const GOGGLE = "6f6688";
const GLASS = "8fd6e0";
const BEAK = { k: INK, p: "f6757a", y: "f2c45a", Y: "c98d3a" };

function loom(mood: Mood): Frame {
  const frame = blank();
  // The braided plume falls over the left shoulder: a plait every third row.
  const braid = polygon([
    [6.5, 11.5],
    [9.5, 12.5],
    [7.5, 31.5],
    [3.5, 31.5],
  ]);
  paint(frame, braid, SILVER);
  for (let y = 14; y < 31; y += 3) {
    for (let x = 3; x < 10; x++) {
      if (has(braid, x, y) && get(frame, x, y) !== INK) set(frame, x, y, SILVER.shade);
    }
    const first = [3, 4, 5, 6, 7, 8, 9].find(
      (x) => has(braid, x, y + 1) && get(frame, x, y + 1) !== INK,
    );
    if (first !== undefined) set(frame, first, y + 1, SILVER.light);
  }
  paint(frame, shoulders([6, 8, 10, 11, 11, 11, 11]), TUNIC);
  paint(
    frame,
    polygon([
      [10.5, 24.5],
      [15.5, 29.5],
      [20.5, 24.5],
      [20.5, 26.5],
      [15.5, 31.5],
      [10.5, 26.5],
    ]),
    COLLAR,
  );
  paint(frame, rect(14, 20, 17, 26), { base: SILVER.base, shade: SILVER.shade, shadeDepth: 1 });
  // The rose thread badge and the braid's rose tie.
  paint(frame, rect(20, 27, 22, 29), { base: ROSE });
  paint(frame, rect(3, 28, 7, 29), { base: ROSE, shade: ROSE_SHADE });
  // White crest plumes sweep back from the crown.
  paint(frame, tilted(8.6, 3.4, 1.8, 6, -66), PLUME);
  paint(frame, tilted(11.6, 2.3, 1.6, 4.6, -56), PLUME);
  const head = ellipse(15.5, 13.8, 9.4, 8.6);
  paint(frame, head, SILVER);
  // Pilot goggles pushed up on the crown.
  for (let x = 0; x < FULL; x++) {
    if (has(head, x, 8) && get(frame, x, 8) !== INK) set(frame, x, 8, STRAP);
  }
  for (const gx of [10, 17]) {
    paint(frame, rect(gx, 6, gx + 4, 10), { base: GOGGLE });
    fill(frame, rect(gx + 1, 7, gx + 3, 9), GLASS);
    set(frame, gx + 1, 7, WHITE);
  }
  // White brow tufts.
  dots(
    frame,
    [
      [9, 12],
      [10, 12],
      [11, 11],
      [20, 11],
      [21, 12],
      [22, 12],
    ],
    WHITE,
  );
  const [lx, rx, ey] = [10, 19, 13];
  if (mood === "happy") {
    eyeHappy(frame, lx, ey + 1);
    eyeHappy(frame, rx, ey + 1);
    blush(frame, lx - 2, rx + 3, ey + 3);
    // The long beak, open.
    stamp(
      frame,
      13,
      16,
      ["kyyyyk", "kpppYk", "kkkkkk", ".kyYk.", ".kyYk.", "..kk..", "..k..."],
      BEAK,
    );
  } else {
    eyeOpen(frame, lx, ey);
    eyeOpen(frame, rx, ey);
    stamp(
      frame,
      13,
      16,
      ["kyyyyk", ".kyyYk", ".kyYk.", ".kyYk.", "..kYk.", "..kk..", "..k..."],
      BEAK,
    );
  }
  return frame;
}

const sheets = [
  { key: "loom", make: loom, size: FULL },
  { key: "loom-compact", make: (mood: Mood) => crop(loom(mood), CROP), size: COMPACT },
] as const;

mkdirSync(output, { recursive: true });
const entries = [];
for (const { key, make, size } of sheets) {
  const tags: Tag[] = FRAMES.map((name) => [name, [make(name)], [MS]]);
  await writeSpriteSheet(
    { data: `${output}${key}.json`, sheet: `${output}${key}.png` },
    { key },
    tags,
  );
  const path = `${output}${key}.json`;
  writeFileSync(
    path,
    await format(readFileSync(path, "utf8"), { ...(await resolveConfig(path)), filepath: path }),
  );
  entries.push({
    id: size === FULL ? "loom-portrait" : "loom-portrait-compact",
    path: `/art/needle/portraits/${key}.png`,
    width: size * FRAMES.length,
    height: size,
    ...(size === COMPACT ? { displayWidth: size * 2, displayHeight: size * 2 } : {}),
    facing: "front",
    pivot: { x: 0.5, y: 0.5 },
    frameWidth: size,
    frameHeight: size,
    frames: Object.fromEntries(FRAMES.map((name, i) => [name, i])),
  });
}

replaceEntries("needle", (id) => id.startsWith("loom-portrait"), entries);
console.log(`wrote ${entries.map(({ id }) => id).join(", ")}`);

// The Avi cast ----------------------------------------------------------------------------

type Feathers = { base: string; shade: string; light: string };
type Plume = readonly [number, number, number, number, number];

// A tunic with the pearl collar, the slender neck, an optional scarf, crest plumes and the head.
// Returns the head.
function avi(
  frame: Frame,
  feathers: Feathers,
  tunic: Feathers,
  plumes: readonly Plume[],
  plume: { base: string; shade: string },
  scarf?: () => void,
): Mask {
  paint(frame, shoulders([6, 8, 10, 11, 11, 11, 11]), tunic);
  paint(
    frame,
    polygon([
      [10.5, 24.5],
      [15.5, 29.5],
      [20.5, 24.5],
      [20.5, 26.5],
      [15.5, 31.5],
      [10.5, 26.5],
    ]),
    COLLAR,
  );
  paint(frame, rect(14, 20, 17, 26), {
    base: feathers.base,
    shade: feathers.shade,
    shadeDepth: 1,
  });
  scarf?.();
  for (const [cx, cy, rx, ry, degrees] of plumes)
    paint(frame, tilted(cx, cy, rx, ry, degrees), plume);
  const head = ellipse(15.5, 13.8, 9.4, 8.6);
  paint(frame, head, feathers);
  return head;
}

// Open eyes and the long beak, closed.
function aviFace(frame: Frame): void {
  eyeOpen(frame, 10, 13);
  eyeOpen(frame, 19, 13);
  stamp(
    frame,
    13,
    16,
    ["kyyyyk", ".kyyYk", ".kyYk.", ".kyYk.", "..kYk.", "..kk..", "..k..."],
    BEAK,
  );
}

const CUP = "3a4466";
const PEARL_FEATHERS = { base: "e9e3da", light: WHITE, shade: "b3aba1" };
const SLATE_PLUME = { base: "5a6988", shade: "3a4466" };
const LEAF = "8fae6a";
const LEAF_LIGHT = "b5cf8f";

function reed(): Frame {
  const frame = blank();
  const head = avi(
    frame,
    PEARL_FEATHERS,
    TUNIC,
    [
      [8.6, 3.4, 1.8, 6, -66],
      [11.6, 2.3, 1.6, 4.6, -56],
    ],
    SLATE_PLUME,
    () => {
      // A rose thread scarf.
      paint(frame, ellipse(15.5, 23.4, 6.2, 1.8), { base: ROSE, shade: ROSE_SHADE });
      paint(frame, rect(18, 24, 20, 29), { base: ROSE, shade: ROSE_SHADE });
    },
  );
  // The heron's grey crown stripe.
  for (const y of [6, 7]) {
    for (let x = 0; x < FULL; x++) {
      if (has(head, x, y) && get(frame, x, y) !== INK) set(frame, x, y, "8b9bb4");
    }
  }
  aviFace(frame);
  return frame;
}

function sedge(): Frame {
  const frame = blank();
  const head = avi(
    frame,
    { base: "aab8d4", light: "dfe6f2", shade: "7684a6" },
    { base: LEAF, light: LEAF_LIGHT, shade: "5f7d45" },
    [
      [8, 4, 1.6, 7, -70],
      [11.2, 2.6, 1.5, 5.2, -60],
      [13.6, 2, 1.2, 3.6, -45],
    ],
    { base: "3a4466", shade: "262b44" },
  );
  // The great heron's dark brow stripe.
  for (const y of [9, 10]) {
    for (let x = 0; x < FULL; x++) {
      if ((x < 13 || x > 18) && has(head, x, y) && get(frame, x, y) !== INK) {
        set(frame, x, y, "3a4466");
      }
    }
  }
  headset(frame, { accent: LEAF_LIGHT, cup: CUP, left: [4, 11], mic: [20, 20], right: [24, 11] });
  aviFace(frame);
  return frame;
}

function willow(): Frame {
  const frame = blank();
  avi(
    frame,
    { base: "ece6f0", light: WHITE, shade: "b9b0c4" },
    TUNIC,
    [
      [5.6, 12, 1.6, 7.2, 18],
      [7.4, 11, 1.5, 7.4, 10],
      [25.6, 12, 1.6, 7.2, -18],
    ],
    { base: TUNIC.light, shade: TUNIC.shade },
  );
  // A lavender shawl and willow leaves in the crown.
  paint(frame, ellipse(15.5, 24.2, 9.8, 2.4), { base: "b7a6e0", shade: "8f7cc0" });
  stamp(frame, 10, 3, [".g...g.", "gGg.gGg", ".g...g."], { g: LEAF, G: LEAF_LIGHT });
  headset(frame, { accent: TUNIC.light, cup: CUP, left: [4, 12], mic: [20, 20], right: [24, 12] });
  aviFace(frame);
  return frame;
}

function marsh(): Frame {
  const frame = blank();
  const head = avi(
    frame,
    { base: "e0cfa8", light: "f6ecd2", shade: "b39d74" },
    { base: "a8916a", light: "c9b48c", shade: "7a6548" },
    [],
    { base: "7a6548", shade: "4a3e2e" },
  );
  // A short spiky crest and a bittern's brown streaks.
  stamp(frame, 12, 2, ["k.k.k", "bkbkb", "bbbbb"], { b: "7a6548", k: INK });
  for (const [x, y] of [
    [9, 9],
    [11, 8],
    [20, 8],
    [22, 9],
    [8, 17],
    [23, 17],
  ] as const) {
    if (has(head, x, y)) set(frame, x, y, "a8916a");
  }
  headset(frame, { accent: "c9b48c", cup: CUP, left: [4, 11], mic: [20, 20], right: [24, 11] });
  aviFace(frame);
  return frame;
}

const CAST = ["reed", "sedge", "willow", "marsh"];
const cast = await writePortraits(
  "needle",
  "needle/portraits",
  [
    { compact: [5, 2], frames: [["neutral", reed()]], key: "reed" },
    { compact: [5, 2], frames: [["neutral", sedge()]], key: "sedge" },
    { compact: [5, 2], frames: [["neutral", willow()]], key: "willow" },
    { compact: [5, 2], frames: [["neutral", marsh()]], key: "marsh" },
  ],
  (id) => CAST.some((key) => id === `${key}-portrait` || id === `${key}-portrait-compact`),
);
console.log(`wrote ${cast.join(", ")}`);
