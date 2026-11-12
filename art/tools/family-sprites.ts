// Ada's family as storybook pixel sprites, crisp over the treated backgrounds like Ada's own:
// Mom (Trista) and Dad (Bin) from the Archie repository's walkers, and the cats Archie and Kiwi.
// Each parent's head is the walker's portrait neutral frame pixel for pixel
// (art/sources/face-walker-trista.png, face-walker-mr-b.png), as Ada's is hers, on an adult build
// (Mom about 3 heads, Dad about 3.4) in the walker sprite's outfit colours, with ink edges and
// flat shading. The walkers have no door gesture, thumbs-up or seated pose; those are drawn here.
// art/tools/storybook.ts places the sprites over their backgrounds.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { decodePng } from "@andornaut/art-kit/png";
import { blankImage, type RgbaImage } from "@andornaut/art-kit/rgbaImage";

import { PALETTE as ADA } from "./ada-sprites.ts";
import { rgb } from "./oklab.ts";

const sources = fileURLToPath(new URL("../sources/", import.meta.url));

type Grid = string[][];
type Xy = readonly [number, number];
type Spans = Readonly<Record<number, readonly [number, number]>>;
type Mask = Set<string>;
type Fill = string | ((x: number, y: number) => string);

const INK = "#181425";
// The sprite canvas: 44 px wide with the body's centre line at x 21.5, as Ada's.
const WIDTH = 44;
// Rows above the head's top, for the trim.
const TOP = 8;
// The centre line, in sprite px.
export const CENTRE = 21.5;

/* Grids and parts */

const grid = (w: number, h: number): Grid =>
  Array.from({ length: h }, () => Array<string>(w).fill("."));

function put(g: Grid, x: number, y: number, k: string) {
  if (y >= 0 && y < g.length && x >= 0 && x < g[0]!.length) g[y]![x] = k;
}

const at = (x: number, y: number) => `${x},${y}`;
const xy = (p: string) => p.split(",").map(Number) as unknown as Xy;

function spans(rows: Spans, dy = 0): Mask {
  const m: Mask = new Set();
  for (const [y, [x0, x1]] of Object.entries(rows)) {
    for (let x = x0; x <= x1; x++) m.add(at(x, Number(y) + dy));
  }
  return m;
}

const run = (y0: number, y1: number, x0: number, x1: number): Spans =>
  Object.fromEntries(Array.from({ length: y1 - y0 + 1 }, (_, i) => [y0 + i, [x0, x1] as const]));

function union(...masks: Mask[]): Mask {
  return new Set(masks.flatMap((m) => [...m]));
}

function disc(cx: number, cy: number, r: number, ry = r): Mask {
  const m: Mask = new Set();
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      if (((x - cx) / r) ** 2 + ((y - cy) / ry) ** 2 <= 1) m.add(at(x, y));
    }
  }
  return m;
}

function tri(a: Xy, b: Xy, c: Xy): Mask {
  const m: Mask = new Set();
  const side = (p: Xy, q: Xy, r: Xy) =>
    (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  for (
    let y = Math.floor(Math.min(a[1], b[1], c[1]));
    y <= Math.ceil(Math.max(a[1], b[1], c[1]));
    y++
  ) {
    for (
      let x = Math.floor(Math.min(a[0], b[0], c[0]));
      x <= Math.ceil(Math.max(a[0], b[0], c[0]));
      x++
    ) {
      const d = [side([x, y], a, b), side([x, y], b, c), side([x, y], c, a)];
      if (!(d.some((v) => v < 0) && d.some((v) => v > 0))) m.add(at(x, y));
    }
  }
  return m;
}

// A limb along a polyline of centre points, `h` px each side of it across its run: a 3 px stroke
// and its ink edge with h 2, stepping 1 px at a time.
function limb(path: readonly Xy[], h = 2): Mask {
  const m: Mask = new Set();
  for (let i = 0; i + 1 < path.length; i++) {
    const [x0, y0] = path[i]!;
    const [x1, y1] = path[i + 1]!;
    const steep = Math.abs(y1 - y0) >= Math.abs(x1 - x0);
    const n = Math.max(Math.abs(y1 - y0), Math.abs(x1 - x0));
    for (let s = 0; s <= n; s++) {
      const t = n === 0 ? 0 : s / n;
      const cx = Math.round(x0 + (x1 - x0) * t);
      const cy = Math.round(y0 + (y1 - y0) * t);
      for (let d = -h; d <= h; d++) m.add(steep ? at(cx + d, cy) : at(cx, cy + d));
    }
  }
  return m;
}

// Paint a part. "inner" turns its own edge px ink, separating it from what it overlaps; "none"
// paints it flat.
function part(g: Grid, m: Mask, fill: Fill, outline: "inner" | "none" = "inner") {
  const f = typeof fill === "string" ? () => fill : fill;
  for (const p of m) {
    const [x, y] = xy(p);
    const edge = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].some(([dx, dy]) => !m.has(at(x + dx!, y + dy!)));
    put(g, x, y, outline === "inner" && edge ? "H" : f(x, y));
  }
}

function toImage(g: Grid, colours: Readonly<Record<string, string>>): RgbaImage {
  const image = blankImage(g[0]!.length, g.length);
  g.forEach((row, y) =>
    row.forEach((k, x) => {
      if (k === ".") return;
      const c = k === "H" ? INK : colours[k];
      if (!c) throw new Error(`no colour for key ${k}`);
      image.data.set([...rgb(c), 255], (y * image.width + x) * 4);
    }),
  );
  return image;
}

// The grid's painted box: the grid inside it and its offset.
function trim(g: Grid) {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -1, -1];
  g.forEach((row, y) =>
    row.forEach((k, x) => {
      if (k === ".") return;
      [x0, x1, y0, y1] = [Math.min(x0, x), Math.max(x1, x), Math.min(y0, y), Math.max(y1, y)];
    }),
  );
  return { g: g.slice(y0, y1 + 1).map((row) => row.slice(x0, x1 + 1)), dx: x0, dy: y0 };
}

/** A sprite and its centre line in its own px. */
export interface Sprite {
  image: RgbaImage;
  centre: number;
}

function sprite(g: Grid, colours: Readonly<Record<string, string>>, centre = CENTRE): Sprite {
  const t = trim(g);
  return { image: toImage(t.g, colours), centre: centre - t.dx };
}

/* Adult builds */

// Torso spans (with their ink edge), from the neck under the chin to the hip.
const MOM_TORSO: Spans = {
  23: [18, 25],
  24: [16, 27],
  25: [14, 29],
  ...run(26, 31, 13, 30),
  ...run(32, 34, 14, 29),
  ...run(35, 37, 15, 28),
};
const DAD_TORSO: Spans = {
  23: [18, 25],
  24: [15, 28],
  25: [13, 30],
  ...run(26, 43, 12, 31),
  ...run(44, 47, 13, 30),
};

function legs(g: Grid, y0: number, y1: number, [l0, l1]: Xy, [r0, r1]: Xy, fill: Fill) {
  part(g, spans(run(y0, y1, l0, l1)), fill);
  part(g, spans(run(y0, y1, r0, r1)), fill);
}

// Rounded shoes, their lower two rows in the sole colour.
function shoes(g: Grid, y: number, centres: readonly number[], w: number) {
  for (const cx of centres) {
    const m = spans({
      [y]: [cx - w, cx + w],
      [y + 1]: [cx - w - 1, cx + w + 1],
      [y + 2]: [cx - w - 1, cx + w + 1],
      [y + 3]: [cx - w, cx + w],
    });
    part(g, m, (_x, yy) => (yy >= y + 2 ? "f" : "F"));
  }
}

// An arm: shoulder, elbow and hand as a 3 px stroke with its ink edge, sleeve where `sleeve`
// holds (shaded on the right), skin elsewhere, and a round hand.
function arm(g: Grid, path: readonly Xy[], sleeve: (x: number, y: number) => boolean) {
  part(g, limb(path), (x, y) => (sleeve(x, y) ? (x >= 30 ? "t" : "T") : "w"));
  const [hx, hy] = path[path.length - 1]!;
  part(g, disc(hx, hy, 2.4), "w");
}

/* The walkers' heads */

type Walker = "trista" | "mr-b";
const KEYS = "0123456789";

// The portrait's neutral frame (frame 1), rows from..25, each colour a key; the portrait's
// row r lands on sprite row oy + r - 3 and its column x on x + 6, centring it on 21.5.
function head(g: Grid, who: Walker, oy: number, from: number): Record<string, string> {
  const image = decodePng(readFileSync(`${sources}face-walker-${who}.png`));
  const keys = new Map<string, string>();
  for (let y = from; y <= 25; y++) {
    for (let x = 0; x < 32; x++) {
      const i = (y * image.width + 32 + x) * 4;
      if (image.data[i + 3] === 0) continue;
      const hex = `#${[0, 1, 2].map((c) => image.data[i + c]!.toString(16).padStart(2, "0")).join("")}`;
      if (hex !== INK && !keys.has(hex)) keys.set(hex, KEYS[keys.size]!);
      put(g, x + 6, oy + y - 3, hex === INK ? "H" : keys.get(hex)!);
    }
  }
  return Object.fromEntries([...keys].map(([hex, k]) => [k, hex]));
}

/* Mom: Trista */

// walker-trista's colours: skin, cardigan, top, skirt, tights, shoes, buttons and apple tote.
const TRISTA: Readonly<Record<string, string>> = {
  w: "#e8b796", // skin
  T: "#3e8948", // cardigan
  t: "#265c42", // cardigan shade
  E: "#63c74d", // cardigan light
  A: "#ffffff", // top
  a: "#c0cbdc", // top shade
  U: "#9a6a4a", // skirt
  u: "#523a2c", // skirt shade
  N: "#3a4466", // tights
  n: "#262b44", // tights shade
  F: "#733e39", // shoes
  f: "#3e2731", // soles
  g: "#feae34", // buttons
  K: "#ead4aa", // tote
  Q: "#e4a672", // tote shade and straps
  R: "#e43b44", // apple
};

function tote(g: Grid, x: number, y: number) {
  part(
    g,
    limb(
      [
        [x - 2, y],
        [x - 2, y + 3],
      ],
      0,
    ),
    "Q",
    "none",
  );
  part(
    g,
    limb(
      [
        [x + 2, y],
        [x + 2, y + 3],
      ],
      0,
    ),
    "Q",
    "none",
  );
  part(g, spans(run(y + 3, y + 12, x - 4, x + 4)), (bx) => (bx >= x + 2 ? "Q" : "K"));
  for (const [ax, ay] of [
    [-1, 6],
    [0, 6],
    [1, 6],
    [-1, 7],
    [0, 7],
    [1, 7],
    [0, 8],
  ] as const) {
    put(g, x + ax, y + ay, "R");
  }
  put(g, x, y + 5, "E");
}

/**
 * Mom at the front door: Trista's copper bob and glasses, her green cardigan open over a white
 * top, brown skirt and navy tights; her right hand open toward the door, the apple tote in her
 * left. Feet on the bottom row.
 */
export function momAtDoor(): Sprite {
  const g = grid(WIDTH, TOP + 73);
  const oy = TOP;
  legs(g, oy + 51, oy + 67, [15, 20], [23, 28], (x) =>
    (x >= 19 && x <= 20) || x >= 27 ? "n" : "N",
  );
  shoes(g, oy + 67, [17, 26], 2);
  const skirt: Spans = {
    ...run(40, 41, 14, 29),
    ...run(42, 44, 13, 30),
    ...run(45, 47, 12, 31),
    ...run(48, 51, 11, 32),
  };
  part(g, spans(skirt, oy), (x) => (x >= 27 ? "u" : "U"));
  part(g, spans({ ...MOM_TORSO, 38: [15, 28], ...run(39, 41, 14, 29) }, oy), (x) =>
    x >= 26 ? "t" : x <= 14 ? "E" : "T",
  );
  // The white top in the cardigan's opening, gold buttons down its left edge.
  for (let y = oy + 24; y <= oy + 41; y++) {
    for (let x = 20; x <= 23; x++) put(g, x, y, x === 23 ? "a" : "A");
    put(g, 19, y, "H");
    put(g, 24, y, "H");
  }
  for (const y of [28, 32, 36]) put(g, 18, oy + y, "g");
  arm(
    g,
    [
      [13, oy + 28],
      [11, oy + 36],
      [5, oy + 35],
    ],
    (x) => x > 8,
  );
  arm(
    g,
    [
      [30, oy + 28],
      [32, oy + 37],
      [31, oy + 45],
    ],
    (_x, y) => y < oy + 42,
  );
  tote(g, 31, oy + 46);
  const face = head(g, "trista", oy, 3);
  return sprite(g, { ...TRISTA, ...face });
}

/* Dad: Bin */

// walker-mr-b's colours: skin, T-shirt, jeans and their pale seams, trainers.
const BIN: Readonly<Record<string, string>> = {
  w: "#733e39", // skin
  T: "#a77bd9", // T-shirt
  t: "#6d4bb0", // T-shirt shade
  U: "#262b44", // jeans
  u: "#3a4466", // jeans shade
  V: "#8b9bb4", // jeans seams
  F: "#ffffff", // trainers
  f: "#e43b44", // soles
};

type DadPose = "thumbs" | "seated";

function dad(pose: DadPose, withArms: boolean): { g: Grid; colours: Record<string, string> } {
  const g = grid(WIDTH, TOP + 79);
  const oy = TOP;
  if (pose === "thumbs") {
    part(g, spans(run(47, 49, 13, 30), oy), (x) => (x >= 27 ? "u" : "U"));
    legs(g, oy + 49, oy + 73, [13, 20], [23, 30], (x) =>
      x === 14 || x === 29 ? "V" : x >= 27 || (x >= 18 && x <= 20) ? "u" : "U",
    );
    shoes(g, oy + 73, [16, 27], 3);
  }
  part(g, spans(DAD_TORSO, oy), (x) => (x >= 27 ? "t" : "T"));
  const sleeve = (_x: number, y: number) => y < oy + 34;
  if (withArms && pose === "thumbs") {
    // His right arm relaxed; his left forearm up across his chest to a thumbs-up.
    arm(
      g,
      [
        [12, oy + 28],
        [10, oy + 38],
        [11, oy + 48],
      ],
      sleeve,
    );
    arm(
      g,
      [
        [31, oy + 28],
        [33, oy + 39],
        [27, oy + 35],
      ],
      (x, y) => y < oy + 34 && x > 31,
    );
    part(
      g,
      limb(
        [
          [27, oy + 33],
          [27, oy + 29],
        ],
        1,
      ),
      "w",
    );
  } else if (withArms) {
    // Forearms resting on the table, hands either side of his plate.
    arm(
      g,
      [
        [12, oy + 27],
        [9, oy + 38],
        [16, oy + 43],
      ],
      sleeve,
    );
    arm(
      g,
      [
        [31, oy + 27],
        [34, oy + 38],
        [27, oy + 43],
      ],
      sleeve,
    );
  }
  const face = head(g, "mr-b", oy, 4);
  return { g, colours: { ...BIN, ...face } };
}

/** Dad looking in at Ada's bedroom door: a thumbs-up. Feet on the bottom row. */
export function dadAtDoor(): Sprite {
  const { g, colours } = dad("thumbs", true);
  return sprite(g, colours);
}

/**
 * Dad seated at dinner, his torso to the table and forearms on it: the whole seated figure and
 * its arms alone (the px the arms change), the latter shown over the table when the table hides
 * the rest. Both share the trimmed box.
 */
export function dadAtDinner(): { figure: Sprite; arms: RgbaImage } {
  const { g: full, colours } = dad("seated", true);
  const bare = dad("seated", false).g;
  const t = trim(full);
  const arms = t.g.map((row, y) => row.map((k, x) => (bare[y + t.dy]![x + t.dx] === k ? "." : k)));
  return {
    figure: { image: toImage(t.g, colours), centre: CENTRE - t.dx },
    arms: toImage(arms, colours),
  };
}

/* The cats: Archie, a round ginger tabby, and Kiwi, a slim grey tabby */

export type Cat = "archie" | "kiwi";

const CATS: Readonly<Record<Cat, Readonly<Record<string, string>>>> = {
  archie: {
    o: "#f77622", // coat
    r: "#be4a2f", // stripes
    d: "#c95e1a", // coat shade
    c: "#ead4aa", // muzzle, chest and paws
    e: "#63c74d", // eyes
    n: "#f6757a", // nose and inner ears
    p: "#ffffff", // eye shine
  },
  kiwi: {
    o: "#8b9bb4",
    r: "#5a6988",
    d: "#6f7f9a",
    c: "#ffffff",
    e: "#fee761",
    n: "#f6757a",
    p: "#ffffff",
  },
};

// Tabby coat: stripes every third column on the upper half, the right side in shade.
const coat =
  (cx: number, cy: number): Fill =>
  (x, y) =>
    (x - cx + 40) % 3 === 0 && y < cy + 2 ? "r" : x > cx + 3 ? "d" : "o";

const tail = (path: readonly Xy[]): [Mask, Fill] => [
  limb(path, 1),
  (x, y) => ((x + y) % 3 === 0 ? "r" : "o"),
];

/** Sitting up on the bed, watching, the tail tip raised behind. Paws on the bottom row. */
export function catSitting(cat: Cat): Sprite {
  const round = cat === "archie";
  const g = grid(22, 22);
  const cx = 10.5;
  part(
    g,
    ...(round
      ? tail([
          [15, 19],
          [18, 17],
          [19, 13],
          [18, 10],
        ])
      : tail([
          [14, 20],
          [18, 19],
          [20, 15],
          [19, 9],
          [20, 7],
        ])),
  );
  const body = round
    ? union(disc(cx, 13.5, 4.6, 4), disc(cx, 17, 6.6, 3.6))
    : union(disc(cx, 13.5, 3.7, 4.2), disc(cx, 17.4, 5.0, 3.2));
  part(g, body, coat(cx, 15));
  for (const p of disc(cx, round ? 14.5 : 14, round ? 2.4 : 2, 2.6)) put(g, ...xy(p), "c");
  for (const px of [cx - 2.2, cx + 2.2]) part(g, disc(px, 20, 1.6, 1.2), "c");
  const head = round ? disc(cx, 7.5, 6.2, 5) : disc(cx, 7.5, 5.2, 4.6);
  const ears = round
    ? union(tri([4.5, 5], [5.2, 0.5], [9, 3]), tri([16.5, 5], [15.8, 0.5], [12, 3]))
    : union(tri([5.3, 5], [5.5, -1], [9, 3]), tri([15.7, 5], [15.5, -1], [12, 3]));
  part(g, union(head, ears), coat(cx, 7.5));
  for (const [x, y] of round
    ? [
        [6, 3],
        [15, 3],
      ]
    : [
        [6, 3],
        [15, 3],
        [6, 2],
        [15, 2],
      ]) {
    put(g, x!, y!, "n");
  }
  for (const [x, y] of [
    [9, 9],
    [10, 9],
    [11, 9],
    [12, 9],
    [10, 10],
    [11, 10],
  ] as const) {
    put(g, x, y, "c");
  }
  for (const ex of [7, 13]) {
    put(g, ex, 6, "p");
    put(g, ex + 1, 6, "H");
    put(g, ex, 7, "e");
    put(g, ex + 1, 7, "H");
  }
  put(g, 10, 8, "n");
  put(g, 11, 8, "n");
  put(g, 10, 9, "H");
  put(g, 11, 9, "H");
  return sprite(g, CATS[cat], cx);
}

/** Curled asleep in a loaf, head on the left, tail wrapped along the front. Bottom row down. */
export function catCurled(cat: Cat): Sprite {
  const round = cat === "archie";
  const g = grid(26, 15);
  part(g, round ? disc(14, 8.5, 9.5, 5.4) : disc(14, 9, 9, 4.6), coat(15, 8));
  const head = round ? disc(7.5, 7.5, 5.4, 4.6) : disc(7.5, 8, 4.8, 4.2);
  const ears = round
    ? union(tri([3, 5], [3.4, 1], [6.5, 3.4]), tri([12, 5], [11.4, 1], [8.6, 3.4]))
    : union(tri([3.4, 6], [3.4, 0.6], [6.5, 4]), tri([11.6, 6], [11.6, 0.6], [8.5, 4]));
  part(g, union(head, ears), coat(7.5, 8));
  put(g, 4, 3, "n");
  put(g, 11, 3, "n");
  for (const [x, y] of [
    [6, 9],
    [7, 9],
    [8, 9],
    [9, 9],
    [7, 10],
    [8, 10],
  ] as const) {
    put(g, x, y, "c");
  }
  // Closed eyes: soft downward arcs.
  for (const ex of [4, 10]) {
    put(g, ex, 7, "H");
    put(g, ex + 1, 8, "H");
    put(g, ex + 2, 7, "H");
  }
  put(g, 7, 9, "n");
  put(g, 8, 9, "n");
  part(
    g,
    ...tail([
      [23, 10],
      [21, 13],
      [14, 13],
      [10, 12.5],
    ]),
  );
  return sprite(g, CATS[cat], 13);
}

/* Ada and Penny watching the sky: the route map's ground layer */

// Evening light on a sprite: every colour but its outline mixed `DUSK.amount` toward the space
// background, then a warm rim on the sunset side (the viewer's left) and along the top edges of
// the left half, inside the outline. The outline is the ink edge, or the walker's own outline.
const DUSK = { colour: "#292734", amount: 0.2, rim: "#f0bd68", rimMix: 0.65 } as const;

function eveningLight(image: RgbaImage, outlines: readonly string[] = [INK]): RgbaImage {
  const { width, height, data } = image;
  const lines = outlines.map(rgb);
  const dusk = rgb(DUSK.colour);
  const rim = rgb(DUSK.rim);
  const i = (x: number, y: number) => (y * width + x) * 4;
  const opaque = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && data[i(x, y) + 3]! > 0;
  const isInk = (x: number, y: number) =>
    opaque(x, y) && lines.some((line) => [0, 1, 2].every((c) => data[i(x, y) + c] === line[c]));
  const out = blankImage(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!opaque(x, y)) continue;
      const p = i(x, y);
      if (isInk(x, y)) {
        out.data.set(data.subarray(p, p + 4), p);
        continue;
      }
      const edge = (nx: number, ny: number) => !opaque(nx, ny) || isInk(nx, ny);
      const lit = edge(x - 1, y) || (x < width * 0.55 && edge(x, y - 1));
      const c = [0, 1, 2].map((k) => {
        const v = data[p + k]! * (1 - DUSK.amount) + dusk[k]! * DUSK.amount;
        return Math.round(lit ? v * (1 - DUSK.rimMix) + rim[k]! * DUSK.rimMix : v);
      });
      out.data.set([...c, 255], p);
    }
  }
  return out;
}

// Archie's back-view walker (art/sources/walker-ada-idle.png): its painted box (30 by 55, as
// Ada's 30 by 56 storybook sprites), its centre line and the hair's hem, and each of its colours
// as a part and Ada's palette key. Its brown outline, and the hair colours it reuses as outline
// below the hair, join the part they border; the redraw gives every silhouette Ada's ink edge.
const WALKER_BACK = { x: 9, y: 15, width: 30, height: 55, centre: 15, hairBottom: 33 } as const;
type WalkerPart = "bow" | "hair" | "ear" | "shirt" | "arms" | "shorts" | "legs" | "shoes";
const WALKER_HAIR = ["#262b44", "#3a4466", "#5a6988", "#8b9bb4", "#181425"];
const WALKER_KEYS: Readonly<Record<string, string>> = {
  "#262b44": "s", // hair
  "#3a4466": "k", // hair strand
  "#5a6988": "k", // hair light
  "#8b9bb4": "k", // hair rim
  "#181425": "s", // hair shade
  "#b55088": "h", // bow
  "#fee761": "P", // shirt
  "#feae34": "m", // shirt shade
  "#b86f50": "w", // skin
  "#c28569": "L", // skin light
  "#0099db": "b", // shorts
  "#124e89": "B", // shorts shade
  "#ffffff": "W", // shoe
  "#c0cbdc": "c", // shoe shade
};
// Ada's fit: the head (hair, ear and bow) scaled about the hair's hem centre, and the body's widths,
// as fractions of the walker's.
export const ADA_FIT = { head: 0.9, body: 0.9 } as const;

function walkerParts() {
  const walker = decodePng(readFileSync(`${sources}walker-ada-idle.png`));
  const { width, height, hairBottom } = WALKER_BACK;
  const parts = new Map<string, WalkerPart>();
  const keys = new Map<string, string>();
  const opaque: string[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = ((WALKER_BACK.y + y) * walker.width + WALKER_BACK.x + x) * 4;
      if (walker.data[i + 3] === 0) continue;
      const c = `#${[0, 1, 2].map((k) => walker.data[i + k]!.toString(16).padStart(2, "0")).join("")}`;
      opaque.push(at(x, y));
      let p: WalkerPart | undefined;
      if (c === "#f6757a") p = y < 6 ? "bow" : "shoes";
      else if (c === "#b55088") p = "bow";
      else if (WALKER_HAIR.includes(c)) p = y <= hairBottom ? "hair" : undefined;
      else if (c === "#fee761" || c === "#feae34") p = "shirt";
      else if (c === "#b86f50" || c === "#c28569") p = y < 30 ? "ear" : y < 45 ? "arms" : "legs";
      else if (c === "#0099db" || c === "#124e89") p = "shorts";
      else if (c === "#ffffff" || c === "#c0cbdc") p = "shoes";
      if (!p) continue;
      parts.set(at(x, y), p);
      keys.set(at(x, y), c === "#f6757a" ? (p === "bow" ? "y" : "q") : WALKER_KEYS[c]!);
    }
  }
  // Each outline px joins the part most of its neighbours belong to.
  for (let pass = 0; pass < 4; pass++) {
    for (const p of opaque) {
      if (parts.has(p)) continue;
      const [x, y] = xy(p);
      const votes = new Map<WalkerPart, number>();
      for (const [dx, dy, w] of [
        [1, 0, 2],
        [-1, 0, 2],
        [0, 1, 2],
        [0, -1, 2],
        [1, 1, 1],
        [-1, 1, 1],
        [1, -1, 1],
        [-1, -1, 1],
      ] as const) {
        const n = parts.get(at(x + dx, y + dy));
        if (n) votes.set(n, (votes.get(n) ?? 0) + w);
      }
      const best = [...votes].sort((l, r) => r[1] - l[1])[0];
      if (best) parts.set(p, best[0]);
    }
  }
  return { parts, keys };
}

/**
 * Ada from behind, looking up at the sky, redrawn from Archie's back-view walker in Ada's sprite
 * style: her wavy hair, the bow on her crown, the shirt whose sleeves cover her shoulders, her
 * forearms and hands at her sides, the two-tone shorts, legs and shoes. Each part is the walker's
 * resampled by area to `fit` (the head in both axes about the hem's centre, the body across),
 * coloured from the walker's px in Ada's palette and hair colours, with Ada's ink edge round the
 * silhouette, then the evening light. Feet on the bottom row; scale 1.
 */
export function adaSkywatch(fit: { head: number; body: number } = ADA_FIT): Sprite {
  const { parts, keys } = walkerParts();
  const { width, height, centre, hairBottom } = WALKER_BACK;
  const head = (p: WalkerPart) => p === "hair" || p === "bow" || p === "ear";
  // A target point's source point for a part.
  const source = (p: WalkerPart, x: number, y: number) =>
    head(p)
      ? [centre + (x - centre) / fit.head, hairBottom + 1 + (y - hairBottom - 1) / fit.head]
      : [centre + (x - centre) / fit.body, y];
  const N = 4;
  const g = grid(width, height);
  const owner = new Map<string, WalkerPart>();
  for (const name of ["legs", "shoes", "arms", "shorts", "shirt", "hair", "ear", "bow"] as const) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let cover = 0;
        for (let i = 0; i < N; i++) {
          for (let j = 0; j < N; j++) {
            const [sx, sy] = source(name, x + (i + 0.5) / N, y + (j + 0.5) / N);
            if (parts.get(at(Math.floor(sx!), Math.floor(sy!))) === name) cover++;
          }
        }
        if (cover * 2 < N * N) continue;
        const [sx, sy] = source(name, x + 0.5, y + 0.5);
        const s = at(Math.floor(sx!), Math.floor(sy!));
        const k = parts.get(s) === name ? keys.get(s) : undefined;
        put(g, x, y, k ?? "H");
        owner.set(at(x, y), name);
      }
    }
  }
  // Ada's ink edge round the silhouette.
  const ink = [...owner].filter(([p]) => {
    const [x, y] = xy(p);
    return [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].some(([dx, dy]) => !owner.has(at(x + dx!, y + dy!)));
  });
  for (const [p] of ink) put(g, ...xy(p), "H");
  return { ...sprite(g, ADA, centre), image: eveningLight(sprite(g, ADA, centre).image) };
}

// Archie's Penny: golden coat, shade and highlight, ears, and her blue harness.
const PENNY: Readonly<Record<string, string>> = {
  o: "#feae34", // coat
  d: "#f77622", // coat shade, ears
  l: "#fee761", // coat highlight
  b: "#0099db", // harness light
  B: "#124e89", // harness
};

/**
 * Penny sitting beside Ada, from behind, her head lifted so her muzzle shows above her crown, her
 * ears hanging, her harness across her back and her tail curled on the grass to her right.
 * Archie's dog-penny colours at Ada's storybook scale. Paws on the bottom row; scale 1.
 */
export function pennySitting(): Sprite {
  const g = grid(28, 31);
  const cx = 12.5;
  const coat: Fill = (x, y) => (x > cx + 3 ? "d" : x < cx - 1 && y < 22 ? "l" : "o");
  part(
    g,
    limb(
      [
        [18, 29],
        [22, 29],
        [25, 27],
        [25, 25],
      ],
      1,
    ),
    (x) => (x > 22 ? "d" : "o"),
  );
  const body = union(disc(cx, 19.5, 7, 7.5), disc(cx, 25.5, 9, 4.2));
  part(g, body, coat);
  for (const px of [cx - 6.5, cx + 6.5]) part(g, disc(px, 29, 2.2, 1.4), coat);
  for (const [y, k] of [
    [15, "b"],
    [16, "B"],
    [17, "B"],
  ] as const) {
    for (let x = 0; x < 28; x++) if (g[y]![x] !== "." && g[y]![x] !== "H") put(g, x, y, k);
  }
  // Her head over the neck, the muzzle lifted above the crown, ears hanging at its sides.
  part(g, union(disc(cx, 9.5, 7, 5.5), disc(cx, 4.5, 3.6, 2)), coat);
  part(g, union(disc(cx - 6.5, 11, 2.3, 4), disc(cx + 6.5, 11, 2.3, 4)), "d");
  return { ...sprite(g, PENNY, cx), image: eveningLight(sprite(g, PENNY, cx).image) };
}
