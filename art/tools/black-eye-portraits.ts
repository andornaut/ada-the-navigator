// Black Eye's speakers as Blurbs (goo): Dollop, the third settlement's Blurb, and the settlements'
// greeter, each one neutral frame in the conversation format. General Gadget, Black Eye's keeper
// once the chapter is complete, uses his named portrait (art/conversation.md).
// Contract: art/conversation.md (Cast portraits) and art/black-eye.md (Portraits).
// Usage: node art/tools/black-eye-portraits.ts
import type { Frame } from "@andornaut/art-kit/grid";

import {
  blank,
  dots,
  ellipse,
  faceNeutral,
  fill,
  has,
  type Mask,
  paint,
  rect,
  set,
  stamp,
  tilted,
  union,
  WHITE,
} from "./bust.ts";
import { writePortraits } from "./bust-sheets.ts";

type Goo = { base: string; shade: string; light: string };
const ORCHID: Goo = { base: "e48fd4", light: "ffd6f4", shade: "b05aa6" };
const VIOLET: Goo = { base: "a896ec", light: "dcd4ff", shade: "7462c4" };
const AMBER = { base: "f0bd68", shade: "b98a40" };

// A jelly blob whose top is row `top`, over three drips that run off the frame's bottom edge.
function slime(top: number): Mask {
  return union(
    ellipse(15.5, 18.4, 12.8, 18.4 - top),
    ...(
      [
        [7.5, 31.5],
        [15.5, 30.5],
        [23.5, 31.5],
      ] as const
    ).map(([cx, bottom]) => ellipse(cx, 27, 2.6, bottom - 27)),
  );
}

// The blob painted with a glossy highlight and three bubbles inside.
function goo(colours: Goo, body: Mask): Frame {
  const frame = blank();
  paint(frame, body, { ...colours, shadeDepth: 3 });
  const gloss = tilted(10, 12, 1.4, 2.6, 30);
  fill(
    frame,
    gloss.map((row, y) => row.map((on, x) => on && has(body, x, y))),
    colours.light,
  );
  dots(
    frame,
    [
      [9, 11],
      [9, 12],
      [10, 10],
    ],
    WHITE,
  );
  for (const [x, y] of [
    [22, 23],
    [12, 26],
    [24, 15],
  ] as const) {
    dots(
      frame,
      [
        [x, y],
        [x + 1, y],
        [x, y + 1],
      ],
      colours.light,
    );
  }
  return frame;
}

// Dollop: an orchid blob curling up to a cream-dollop peak, with blush.
function dollop(): Frame {
  const curl = union(tilted(17, 5.2, 2.6, 3.8, 32), ellipse(14.6, 2.8, 2.2, 1.8));
  const frame = goo(ORCHID, union(slime(7.5), curl));
  dots(
    frame,
    [
      [16, 4],
      [17, 5],
      [17, 6],
    ],
    ORCHID.shade,
  );
  faceNeutral(frame, { ex: 10, ey: 15, gap: 9, my: 21, tall: 4 });
  dots(
    frame,
    [
      [8, 19],
      [9, 19],
      [22, 19],
      [23, 19],
    ],
    "f6757a",
  );
  return frame;
}

// The settlements' greeter: a rounder violet-blue blob with no peak, a floating bubble and an
// amber scarf with a red patch.
function settler(): Frame {
  const frame = goo(VIOLET, slime(6));
  stamp(frame, 23, 0, [".ll.", "l..l", "l..l", ".ll."], { l: VIOLET.light });
  set(frame, 24, 1, WHITE);
  paint(frame, ellipse(15.5, 24.4, 11.4, 2.2), AMBER);
  paint(frame, rect(19, 25, 21, 30), AMBER);
  stamp(frame, 9, 24, ["pp"], { p: "e43b44" });
  faceNeutral(frame, { ex: 10, ey: 13, gap: 9, my: 19, tall: 4 });
  return frame;
}

const KEYS = ["dollop", "blurb-settler"];
const ids = await writePortraits(
  "black-eye",
  "black-eye/portraits",
  [
    { compact: [5, 2], frames: [["neutral", dollop()]], key: "dollop" },
    { compact: [5, 3], frames: [["neutral", settler()]], key: "blurb-settler" },
  ],
  (id) => KEYS.some((key) => id === `${key}-portrait` || id === `${key}-portrait-compact`),
);
console.log(`wrote ${ids.join(", ")}`);
