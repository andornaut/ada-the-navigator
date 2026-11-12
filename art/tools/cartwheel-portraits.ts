// Cartwheel's speakers as Cobbles (living rock): Quartz, the hub's voice and a station keeper,
// the keepers Slate and Garnet, Mica the miner and the regular visitors Opal and Jasper, each one
// neutral frame in the conversation format. Contract: art/conversation.md (Cast portraits).
// Usage: node art/tools/cartwheel-portraits.ts
import type { Frame } from "@andornaut/art-kit/grid";

import {
  above,
  blank,
  dots,
  ellipse,
  faceNeutral,
  fill,
  get,
  headset,
  INK,
  line,
  type Mask,
  paint,
  type Point,
  rect,
  set,
  stamp,
  union,
  WHITE,
} from "./bust.ts";
import { writePortraits } from "./bust-sheets.ts";

type Stone = { base: string; shade: string; light: string; top: string; edge: string };
const STONES = {
  garnet: { base: "a8786a", edge: "8c6052", light: "c69a8a", shade: "77503f", top: "dab4a6" },
  jasper: { base: "b37a5c", edge: "94624a", light: "cf9c7e", shade: "7f523b", top: "e0b496" },
  opal: { base: "c2b2b0", edge: "a59595", light: "ddd0ce", shade: "8f7f80", top: "ece2e0" },
  quartz: { base: "c9bcb4", edge: "a99c94", light: "e2d8d0", shade: "958780", top: "efe7e0" },
  slate: { base: "958a90", edge: "7c7177", light: "b7adb2", shade: "675d64", top: "cfc6ca" },
  warm: { base: "a99486", edge: "8c7468", light: "c7b4a6", shade: "7a655b", top: "d6c6ba" },
} satisfies Record<string, Stone>;
const CUP = "3a4466";
const ORE = "65c9bf";
const ORE_LIGHT = "b8f2e8";
const MOUTH = "3e2731";

type Shape = "round" | "slab" | "tall";
const SHAPES: Record<Shape, Mask> = {
  round: union(
    ellipse(15.5, 18.6, 12.4, 11.6),
    ellipse(15.5, 27, 11, 5),
    ellipse(10.5, 9.6, 4.4, 3.2),
  ),
  slab: union(ellipse(15.5, 19.4, 13.4, 10.4), rect(4, 26, 27, 31)),
  tall: union(ellipse(15.5, 17.4, 11, 12.6), ellipse(15.5, 27, 10.6, 5)),
};

// A crystal four wide and four high, its top-left at (x, y).
const crystal = (frame: Frame, x: number, y: number, low: string, high: string) =>
  stamp(frame, x, y, ["..k.", ".kOk", "kooO", "kook"], { k: INK, o: low, O: high });

// The speckled stone body.
function cobble(stone: Stone, shape: Shape): Frame {
  const frame = blank();
  const body = SHAPES[shape].map((row, y) =>
    row.map((on, x) => on && !(y === 31 && (x < 6 || x > 25))),
  );
  paint(frame, body, { base: stone.base, light: stone.light, shade: stone.shade, shadeDepth: 3 });
  for (const [y, row] of body.entries()) {
    for (const [x, on] of row.entries()) {
      if (!on || get(frame, x, y) === INK) continue;
      if ((x * 5 + y * 3) % 11 === 0) set(frame, x, y, stone.edge);
      else if ((x * 7 + y * 5) % 17 === 0) set(frame, x, y, stone.top);
    }
  }
  return frame;
}

// Pebble hands; the right one waves unless `wave` is false.
function hands(frame: Frame, stone: Stone, wave = true): void {
  paint(frame, ellipse(4.5, 27.5, 2.6, 2.3), { base: stone.light, shade: stone.base });
  paint(frame, ellipse(28, wave ? 18 : 26.5, 2.4, 2.3), { base: stone.light, shade: stone.base });
}

function keeperHeadset(frame: Frame, accent: string, top = 5): void {
  const band: Point[] = [];
  for (let x = 9; x < 23; x++) band.push([x, x >= 11 && x <= 20 ? top : top + 1]);
  headset(frame, { accent, band, cup: CUP, left: [2, 13], mic: [21, 21], right: [26, 13] });
}

const face = (frame: Frame, ey = 14, my = 21) =>
  faceNeutral(frame, { ex: 10, ey, gap: 9, mouth: MOUTH, my, tall: 4 });

function quartz(): Frame {
  const frame = cobble(STONES.quartz, "tall");
  crystal(frame, 11, 2, "e9e3f5", WHITE);
  crystal(frame, 15, 0, "c4b8e8", WHITE);
  crystal(frame, 18, 3, "e9e3f5", WHITE);
  hands(frame, STONES.quartz);
  keeperHeadset(frame, "c4b8e8", 6);
  face(frame);
  return frame;
}

function slate(): Frame {
  const frame = cobble(STONES.slate, "slab");
  crystal(frame, 21, 24, ORE, ORE_LIGHT);
  hands(frame, STONES.slate);
  // Layered slate seams.
  for (const y of [12, 25]) {
    for (let x = 5; x < 27; x++) {
      const colour = get(frame, x, y);
      if (colour !== INK && colour !== null) set(frame, x, y, STONES.slate.edge);
    }
  }
  keeperHeadset(frame, ORE, 8);
  face(frame, 15, 21);
  return frame;
}

function garnet(): Frame {
  const frame = cobble(STONES.garnet, "round");
  crystal(frame, 20, 23, "a22633", "f6757a");
  crystal(frame, 22, 6, "a22633", "e43b44");
  hands(frame, STONES.garnet);
  keeperHeadset(frame, "e43b44");
  face(frame);
  return frame;
}

function mica(): Frame {
  const frame = cobble(STONES.warm, "round");
  hands(frame, STONES.warm);
  // Silver mica flakes.
  for (const [x, y] of [
    [8, 20],
    [21, 25],
    [24, 18],
    [12, 27],
  ] as const) {
    stamp(frame, x, y, ["sW"], { s: "c0cbdc", W: WHITE });
  }
  // A hard hat with its lamp.
  paint(frame, above(ellipse(15.5, 8.6, 9, 4.8), 11), {
    base: "feae34",
    light: "fee761",
    shade: "d77643",
  });
  paint(frame, ellipse(15.5, 10.6, 11.4, 1.5), { base: "f77622" });
  paint(frame, rect(14, 3, 17, 7), { base: "c0cbdc" });
  fill(frame, rect(15, 4, 16, 6), "fee761");
  set(frame, 15, 4, WHITE);
  face(frame);
  return frame;
}

function opal(): Frame {
  const frame = cobble(STONES.opal, "tall");
  hands(frame, STONES.opal);
  // Opal shimmer.
  const spots = [
    [9, 22, "f6a5c0"],
    [21, 24, "8ff3ff"],
    [12, 27, "fee761"],
    [23, 19, "b9c2f7"],
    [17, 28, "a8f0c8"],
  ] as const;
  for (const [x, y, colour] of spots) {
    set(frame, x, y, colour);
    set(frame, x + 1, y, colour);
  }
  // A rose scarf with a hanging end.
  paint(frame, ellipse(15.5, 25.4, 10.4, 2.1), { base: "f6757a", shade: "b55088" });
  paint(frame, rect(19, 27, 21, 31), { base: "f6757a", shade: "b55088" });
  face(frame);
  return frame;
}

function jasper(): Frame {
  const frame = cobble(STONES.jasper, "round");
  hands(frame, STONES.jasper, false);
  // Ochre bands.
  for (const y of [20, 24]) {
    for (let x = 4; x < 28; x++) {
      const colour = get(frame, x, y);
      if (colour !== INK && colour !== null) set(frame, x, y, "d9a060");
    }
  }
  // A green bucket hat and a travel bag strap.
  paint(frame, ellipse(15.5, 10, 11, 1.6), { base: "3e8948", shade: "265c42" });
  paint(frame, above(ellipse(15.5, 8.4, 7.4, 4.6), 10), {
    base: "63c74d",
    light: "a3e07a",
    shade: "3e8948",
  });
  dots(frame, line([7, 22], [22, 31]), "733e39");
  face(frame, 14, 20);
  return frame;
}

const KEYS = ["quartz", "slate", "garnet", "mica", "opal", "jasper"];
const ids = await writePortraits(
  "cartwheel",
  "cartwheel/portraits",
  [
    { compact: [5, 2], frames: [["neutral", quartz()]], key: "quartz" },
    { compact: [5, 4], frames: [["neutral", slate()]], key: "slate" },
    { compact: [5, 3], frames: [["neutral", garnet()]], key: "garnet" },
    { compact: [5, 3], frames: [["neutral", mica()]], key: "mica" },
    { compact: [5, 4], frames: [["neutral", opal()]], key: "opal" },
    { compact: [5, 3], frames: [["neutral", jasper()]], key: "jasper" },
  ],
  (id) => KEYS.some((key) => id === `${key}-portrait` || id === `${key}-portrait-compact`),
);
console.log(`wrote ${ids.join(", ")}`);
