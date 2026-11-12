// Sunflower's speakers as Bumbles (bees): Clover the grower, Rivet the workshop, Patch the
// salvager and the station keepers Saffron, Bramble and Nectar, each one neutral frame in the
// conversation format. Contract: art/conversation.md (Cast portraits).
// Usage: node art/tools/sunflower-portraits.ts
import type { Frame } from "@andornaut/art-kit/grid";

import {
  above,
  blank,
  dots,
  ellipse,
  faceNeutral,
  fill,
  fuzz,
  get,
  has,
  headset,
  INK,
  line,
  type Mask,
  paint,
  type Point,
  polygon,
  rect,
  set,
  shoulders,
  stamp,
  tilted,
  union,
  WHITE,
} from "./bust.ts";
import { writePortraits } from "./bust-sheets.ts";

type Fur = { base: string; shade: string; light: string };
const YELLOW: Fur = { base: "fee761", light: "fff4b8", shade: "f4b93a" };
const SAFFRON: Fur = { base: "f9b941", light: "ffe08a", shade: "d98a2b" };
const LEMON: Fur = { base: "fff39a", light: "fffbe0", shade: "f2d65a" };
const STRIPE = "4a2e2a";
const WING = { base: "e4eefa", light: WHITE, shade: "a9bdd6" };
const LEAF = "63c74d";
const LEAF_SHADE = "3e8948";
const LEAF_DEEP = "265c42";
const LEAF_LIGHT = "a3e07a";
const STEEL = "8b9bb4";
const STEEL_SHADE = "5a6988";
const SILVER = "c0cbdc";
const GLASS = "2ce8f5";
const RED = { base: "e43b44", light: "f6757a", shade: "a22633" };
const CUP = "3a4466";
const BODY_WIDTHS = [7, 9, 11, 12, 12, 12, 12];

// Wings, the striped body, an optional vest, the fuzzy head and antennae. Returns the head.
function bee(
  frame: Frame,
  fur: Fur,
  {
    head = [10.6, 9.3, 15.4],
    tips = "ball",
    vest,
    wings = [2.8, 5.2],
  }: {
    head?: readonly [number, number, number];
    tips?: "ball" | "curl" | "heart";
    vest?: readonly [string, string];
    wings?: readonly [number, number];
  } = {},
): Mask {
  for (const [cx, degrees] of [
    [5.2, -35],
    [25.8, 35],
  ] as const) {
    paint(frame, tilted(cx, 20.5, wings[0], wings[1], degrees), WING);
  }
  const body = shoulders(BODY_WIDTHS);
  paint(frame, body, { base: fur.base, shade: fur.shade });
  for (const y of [27, 28, 31]) {
    for (let x = 0; x < 32; x++) {
      if (has(body, x, y) && get(frame, x, y) !== INK) set(frame, x, y, STRIPE);
    }
  }
  if (vest) {
    paint(
      frame,
      polygon([
        [9.5, 31.5],
        [10.5, 25.5],
        [14.5, 25.5],
        [15.5, 29],
        [16.5, 25.5],
        [20.5, 25.5],
        [21.5, 31.5],
      ]),
      { base: vest[0], shade: vest[1] },
    );
  }
  const [rx, ry, cy] = head;
  const mask = fuzz(ellipse(15.5, cy, rx, ry), 3, 1);
  for (const sx of [-1, 1]) {
    const base: Point = [Math.trunc(15.5 + sx * 3.5), Math.trunc(cy - ry + 1.6)];
    const right = sx > 0 ? 1 : 0;
    if (tips === "curl") {
      const [tx, ty] = [Math.trunc(15.5 + sx * 6.5) + right, 3];
      dots(frame, line(base, [tx, ty]), INK);
      dots(
        frame,
        [
          [tx + sx, ty - 1],
          [tx + 2 * sx, ty],
          [tx + sx, ty + 1],
        ],
        INK,
      );
    } else if (tips === "heart") {
      const [tx, ty] = [Math.trunc(15.5 + sx * 7) + right, 3];
      dots(frame, line(base, [tx, ty + 1]), INK);
      stamp(frame, tx - 1, ty - 2, ["p.p", "ppp", ".p."], { p: "f6757a" });
    } else {
      const [tx, ty] = [Math.trunc(15.5 + sx * 7.5) + right, 2];
      dots(frame, line(base, [tx, ty]), INK);
      fill(frame, rect(tx - 1, ty - 1, tx, ty), INK);
      set(frame, tx - 1, ty - 1, "fee761");
    }
  }
  paint(frame, mask, fur);
  return mask;
}

// The role voices share one Bumble with a role's clothes and headwear.
function roleVoice(role: "grower" | "salvager" | "workshop"): Frame {
  const frame = blank();
  for (const [cx, degrees] of [
    [5.2, -35],
    [25.8, 35],
  ] as const) {
    paint(frame, tilted(cx, 20.5, 2.8, 5.2, degrees), WING);
  }
  if (role === "salvager") {
    // A scrap backpack behind the right shoulder: a pipe and a dented tank.
    paint(frame, rect(25, 9, 27, 20), { base: STEEL, shade: STEEL_SHADE });
    dots(
      frame,
      [
        [26, 10],
        [26, 11],
      ],
      SILVER,
    );
    paint(frame, rect(22, 16, 30, 26), { base: STEEL, light: SILVER, shade: STEEL_SHADE });
    dots(
      frame,
      [
        [24, 19],
        [25, 19],
        [28, 23],
      ],
      "b86f50",
    );
    dots(
      frame,
      [
        [29, 18],
        [29, 21],
      ],
      INK,
    );
  }
  const body = shoulders(BODY_WIDTHS);
  paint(frame, body, { base: YELLOW.base, shade: YELLOW.shade });
  for (const y of [27, 28, 31]) {
    for (let x = 0; x < 32; x++) {
      if (has(body, x, y) && get(frame, x, y) !== INK) set(frame, x, y, STRIPE);
    }
  }
  if (role === "grower") {
    // Green overalls.
    paint(frame, union(rect(11, 27, 20, 31), rect(10, 25, 11, 31), rect(20, 25, 21, 31)), {
      base: LEAF_SHADE,
      shade: LEAF_DEEP,
    });
    dots(
      frame,
      [
        [15, 29],
        [16, 29],
      ],
      "feae34",
    );
  } else if (role === "workshop") {
    // An orange apron with a wrench.
    paint(
      frame,
      polygon([
        [10.5, 31.5],
        [11.5, 25.5],
        [19.5, 25.5],
        [20.5, 31.5],
      ]),
      { base: "f77622", shade: "be4a2f" },
    );
    dots(
      frame,
      [
        [13, 28],
        [14, 28],
        [15, 28],
        [16, 29],
        [16, 27],
      ],
      SILVER,
    );
  } else {
    // Backpack straps.
    const straps: Point[] = [9, 10, 11, 12, 13].map((x): Point => [
      x,
      25 + Math.floor((x - 9) / 2),
    ]);
    straps.push(...[18, 19, 20, 21, 22].map((x): Point => [x, 25 + Math.floor((22 - x) / 2)]));
    dots(frame, straps, "733e39");
  }
  const head = fuzz(ellipse(15.5, 15.4, 10.6, 9.3), 3, 1);
  for (const sx of [-1, 1]) {
    const base: Point = [Math.trunc(15.5 + sx * 3.5), 7];
    const tip: Point = [Math.trunc(15.5 + sx * 7.5) + (sx > 0 ? 1 : 0), 2];
    dots(frame, line(base, tip), INK);
    fill(frame, rect(tip[0] - 1, tip[1] - 1, tip[0], tip[1]), INK);
    set(frame, tip[0] - 1, tip[1] - 1, "fee761");
  }
  paint(frame, head, YELLOW);
  if (role === "grower") {
    paint(frame, above(ellipse(15.5, 8, 7.6, 3.4), 10), {
      base: LEAF,
      light: LEAF_LIGHT,
      shade: LEAF_SHADE,
    });
    stamp(frame, 12, 1, ["gg.....", ".gGk...", "...k.GG", "...kgg.", "...k..."], {
      g: LEAF,
      G: LEAF_SHADE,
      k: LEAF_DEEP,
    });
  } else if (role === "workshop") {
    for (let x = 0; x < 32; x++) {
      if (has(head, x, 10) && get(frame, x, 10) !== INK) set(frame, x, 10, STEEL_SHADE);
    }
    for (const gx of [9, 18]) {
      paint(frame, rect(gx, 8, gx + 4, 12), { base: STEEL });
      fill(frame, rect(gx + 1, 9, gx + 3, 11), GLASS);
      set(frame, gx + 1, 9, WHITE);
    }
  } else {
    paint(frame, above(ellipse(15.5, 8.6, 9.8, 3.8), 11), RED);
    stamp(frame, 3, 9, [".kk.", "kRRk", "kRk.", ".k.."], { k: INK, R: RED.shade });
    dots(
      frame,
      [
        [11, 7],
        [17, 8],
        [20, 7],
      ],
      WHITE,
    );
  }
  faceNeutral(frame, { ex: 10, ey: 14, gap: 9, my: 20 });
  return frame;
}

function clover(): Frame {
  const frame = roleVoice("grower");
  // The sprout gives way to a three-leaf clover on the leaf cap.
  for (let x = 10; x < 22; x++) {
    for (let y = 0; y < 5; y++) {
      if ([LEAF, LEAF_SHADE, LEAF_DEEP].includes(get(frame, x, y) ?? "")) set(frame, x, y, null);
    }
  }
  stamp(frame, 12, 0, [".gg.gg.", "gGggGgg", ".gggggk", "..gGg..", "...k..."], {
    g: LEAF,
    G: LEAF_LIGHT,
    k: LEAF_DEEP,
  });
  return frame;
}

function rivet(): Frame {
  const frame = roleVoice("workshop");
  dots(
    frame,
    [
      [12, 26],
      [18, 26],
    ],
    SILVER,
  );
  return frame;
}

function patch(): Frame {
  const frame = roleVoice("salvager");
  // A stitched patch on the bandana.
  stamp(frame, 17, 6, ["cc", "cc"], { c: "ead4aa" });
  set(frame, 19, 6, INK);
  return frame;
}

function saffron(): Frame {
  const frame = blank();
  bee(frame, SAFFRON, { head: [11.2, 9, 15.6], vest: [LEAF, LEAF_SHADE] });
  // A purple crocus by the right antenna.
  stamp(frame, 21, 4, [".p.", "pyp", ".pg", "..g"], { g: LEAF_SHADE, p: "b55088", y: "fee761" });
  const band: Point[] = [];
  for (let x = 7; x < 25; x++) band.push([x, x >= 11 && x <= 20 ? 6 : 7]);
  headset(frame, {
    accent: "fee761",
    band,
    cup: CUP,
    left: [3, 12],
    mic: [21, 21],
    right: [25, 12],
  });
  faceNeutral(frame, { ex: 10, ey: 14, gap: 9, my: 20 });
  return frame;
}

function bramble(): Frame {
  const frame = blank();
  const head = bee(frame, YELLOW, {
    head: [10.2, 10, 15.6],
    tips: "curl",
    vest: ["b86f50", "733e39"],
  });
  for (const y of [10, 11]) {
    for (let x = 0; x < 32; x++) {
      const colour = get(frame, x, y);
      if (has(head, x, y) && colour !== INK && colour !== null) set(frame, x, y, STRIPE);
    }
  }
  // A tilted bramble beret with two berries.
  paint(frame, above(tilted(14, 7.2, 8.2, 3.2, -8), 10), {
    base: LEAF_SHADE,
    light: LEAF,
    shade: LEAF_DEEP,
  });
  stamp(frame, 18, 3, ["k.k", "rkr"], { k: LEAF_DEEP, r: RED.base });
  headset(frame, { accent: RED.base, cup: CUP, left: [4, 12], mic: [21, 21], right: [24, 12] });
  faceNeutral(frame, { ex: 10, ey: 15, gap: 9, my: 21 });
  return frame;
}

function nectar(): Frame {
  const frame = blank();
  bee(frame, LEMON, {
    head: [9.6, 8.4, 16.2],
    tips: "heart",
    vest: ["f6a5c0", "d27a9a"],
    wings: [3.4, 6],
  });
  // A pink bow on the crown.
  stamp(frame, 17, 6, ["pp.pp", "pPkPp", "pp.pp"], { k: INK, p: "f6757a", P: "b55088" });
  headset(frame, { accent: "f6757a", cup: CUP, left: [4, 13], mic: [21, 21], right: [24, 13] });
  faceNeutral(frame, { ex: 10, ey: 15, gap: 9, my: 21 });
  return frame;
}

const KEYS = ["clover", "rivet", "patch", "saffron", "bramble", "nectar"];
const ids = await writePortraits(
  "sunflower",
  "sunflower/portraits",
  [
    { compact: [5, 1], frames: [["neutral", clover()]], key: "clover" },
    { compact: [5, 3], frames: [["neutral", rivet()]], key: "rivet" },
    { compact: [5, 3], frames: [["neutral", patch()]], key: "patch" },
    { compact: [5, 2], frames: [["neutral", saffron()]], key: "saffron" },
    { compact: [5, 2], frames: [["neutral", bramble()]], key: "bramble" },
    { compact: [5, 2], frames: [["neutral", nectar()]], key: "nectar" },
  ],
  (id) => KEYS.some((key) => id === `${key}-portrait` || id === `${key}-portrait-compact`),
);
console.log(`wrote ${ids.join(", ")}`);
