// Storybook cockpit interior seen from behind the seats: a retro-futurist convertible under a
// glass canopy, with Astra's face on the dash and the holodisk drive in the centre stack.
// Drawn at 3x and reduced with Lanczos filtering in the 844 by 390 design frame; Archie's pixel
// sprites of Ada and Penny sit in the seats at 3x by nearest neighbour.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { arc, rectangle } from "@andornaut/art-kit/draw";
import { decodePng } from "@andornaut/art-kit/png";
import { resizeNearest } from "@andornaut/art-kit/raster";
import { blankImage } from "@andornaut/art-kit/rgbaImage";

import {
  blur,
  fillEllipse,
  fillPolygon,
  over,
  polyline,
  resize,
  rgba,
  type RgbaImage,
  roundedRect,
  type Xy,
} from "./paint.ts";
import { roundHalfEven } from "./random.ts";
import { DESIGN, shimmer } from "./shimmer.ts";

const sources = fileURLToPath(new URL("../sources/", import.meta.url));
const SS = 3;
const W = DESIGN.width;
const H = DESIGN.height;

const CHROME = "efe6d6";
const CHROME_SH = "c9bfae";
const DASH = "e6d9c2";
const DASH_LIP = "f6efe1";
const DASH_SH = "cbbca3";
const TRIM = "6fb7b3";
const SEAT = "4f9ea3";
const SEAT_SH = "3d8084";
const SEAT_HI = "6cb8b9";
const PIPING = "efe4cf";
const CARPET = "4a3d5c";
const CARPET_D = "3e3350";
const CORAL = "e07a6a";
const PLUM = "3b2a3f";
const NOSE = "e8eaf2";
const NOSE_SH = "c5cbdb";
const NOSE_BLUE = "5d97cf";
const CRT_BEZEL = "d8cdb6";
const CRT_GLASS = "1d3a3a";
const CRT_LINE = "65c9bf";
const PLAYER = "c6c3d4";
const PLAYER_SH = "9f9bb3";
const LED_AMBER = "f0bd68";
const SLOT_DARK = "24202e";
const LED_DARK = "2a1f2a";
// Astra's teal (see the conversation portraits).
const ASTRA_INK = "181425";
const ASTRA_GLOW = "1d4a63";
const ASTRA_SHADE = "2a7b96";
const ASTRA_RING = "47b2cc";
const ASTRA_LIGHT = "8fe0f2";
const ASTRA_GLINT = "d6f7fc";
const ASTRA_WHITE = "ffffff";
const ASTRA_FACE = "1f1a38";
// Holodisk pearl and magenta.
export const PEARL = ["ffffff", "d9dff0", "a3aacb"] as const;
export const HOLO = ["ffb3ec", "e868c8", "a83a96"] as const;

const ASTRA_C: Xy = [422, 224];
const PLAYER_BOX = [386, 266, 460, 300] as const;
const SLOT = [394, 273, 450, 277] as const;
const SEAT_L = 300;
const SEAT_R = 544;

const S = (v: number) => roundHalfEven(v * SS);
const P = (points: readonly Xy[]): Xy[] => points.map(([x, y]) => [S(x), S(y)]);
const layer = () => blankImage(W * SS, H * SS);

function rrect(
  image: RgbaImage,
  [x0, y0, x1, y1]: readonly [number, number, number, number],
  r: number,
  fill: string,
  ring = 0,
) {
  roundedRect(image, [S(x0), S(y0), S(x1), S(y1)], S(r), rgba(fill), ring ? S(ring) : 0);
}

const ell = (image: RgbaImage, [x, y]: Xy, r: number, fill: string, ry = r) =>
  fillEllipse(image, [S(x - r), S(y - ry), S(x + r), S(y + ry)], rgba(fill));

function round(image: RgbaImage, points: readonly Xy[], width: number, fill: string) {
  polyline(image, P(points), rgba(fill), S(width), true);
  for (const [x, y] of points) {
    ell(image, [x, y], width / 2, fill);
  }
}

// A rounded bubble outline: a superellipse half from 26 to 818 design px.
const CANOPY: Xy[] = Array.from({ length: 61 }, (_, i) => {
  const t = (Math.PI * i) / 60;
  const c = Math.cos(t);
  return [
    422 - 398 * Math.sign(c) * Math.abs(c) ** (2 / 3.2),
    262 - 250 * Math.abs(Math.sin(t)) ** (2 / 3.2),
  ];
});

export type Player = "half" | "in" | "done";
export type Hand = "hold" | "push" | "retract";
export interface DashScene {
  astra?: { frame: number };
  player?: Player;
  hand?: Hand;
}

// A point on a pointy-top hexagon of vertex radius r at `angle` (radians, 0 pointing right).
function hexPoint([cx, cy]: Xy, r: number, angle: number): Xy {
  const sector = Math.floor((angle + Math.PI / 2) / (Math.PI / 3));
  const normal = -Math.PI / 2 + Math.PI / 6 + sector * (Math.PI / 3);
  const reach = (r * Math.cos(Math.PI / 6)) / Math.cos(angle - normal);
  return [cx + reach * Math.cos(angle), cy + reach * Math.sin(angle)];
}

const hexagon = (c: Xy, r: number): Xy[] =>
  Array.from({ length: 6 }, (_, k) => hexPoint(c, r, -Math.PI / 2 + (k * Math.PI) / 3));

const deg = (d: number) => (d * Math.PI) / 180;

// Astra's face on the dash, as her portrait: an ink-edged hexagon ring lit from the upper left, a
// dark face with an inner hexagon line, two eye lights and a voice-line mouth. Lit (`astra` set):
// white eyes and mouth, a catch-light on the ring and a soft teal halo. Dormant: dim eyes and mouth
// and the ring one step darker.
function astraLayer(astra: DashScene["astra"]): RgbaImage {
  const lay = layer();
  const [cx, cy] = ASTRA_C;
  const poly = (points: readonly Xy[], fill: string, alpha = 255) =>
    fillPolygon(lay, P(points), rgba(fill, alpha));
  if (astra) {
    const r = [44, 48, 52, 48][astra.frame]!;
    const halo = layer();
    fillEllipse(halo, [S(cx - r), S(cy - r), S(cx + r), S(cy + r)], rgba(ASTRA_LIGHT, 90));
    blur(halo, S(10), [S(cx - r), S(cy - r), S(cx + r), S(cy + r)]);
    over(lay, halo);
  }
  poly(hexagon(ASTRA_C, 29), ASTRA_INK);
  poly(hexagon(ASTRA_C, 27), astra ? ASTRA_RING : ASTRA_SHADE);
  // The lower-right half of the ring, from -45 to 135 degrees, in shade.
  poly(
    [-45, -30, 30, 90, 135].map((d) => hexPoint(ASTRA_C, 27, deg(d))),
    astra ? ASTRA_SHADE : ASTRA_GLOW,
  );
  if (astra) {
    poly(
      [
        hexPoint(ASTRA_C, 26.5, deg(-132)),
        hexPoint(ASTRA_C, 26.5, deg(-108)),
        hexPoint(ASTRA_C, 22, deg(-108)),
        hexPoint(ASTRA_C, 22, deg(-132)),
      ],
      ASTRA_GLINT,
    );
  }
  poly(hexagon(ASTRA_C, 22), ASTRA_FACE);
  poly(hexagon(ASTRA_C, 15.5), ASTRA_GLOW);
  poly(hexagon(ASTRA_C, 13.5), ASTRA_FACE);
  for (const side of [-1, 1]) {
    const x = cx + side * 8;
    if (astra) {
      const glow = layer();
      fillEllipse(glow, [S(x - 6), S(cy - 9), S(x + 6), S(cy + 3)], rgba(ASTRA_LIGHT, 160));
      blur(glow, S(2.4), [S(x - 8), S(cy - 11), S(x + 8), S(cy + 5)]);
      over(lay, glow);
    }
    rrect(lay, [x - 3, cy - 6, x + 3, cy], 1, astra ? ASTRA_WHITE : ASTRA_SHADE);
  }
  const mouth = astra ? [14, 20, 22, 20][astra.frame]! : 10;
  rrect(
    lay,
    [cx - mouth / 2, cy + 6, cx + mouth / 2, cy + 9],
    1,
    astra ? ASTRA_WHITE : ASTRA_SHADE,
  );
  return lay;
}

function disk(image: RgbaImage, [x, y]: Xy, w = 22, h = 7) {
  const e = (rx: number, ry: number, fill: string, dx0 = -rx, dy0 = -ry, dx1 = rx, dy1 = ry) =>
    fillEllipse(image, [S(x + dx0), S(y + dy0), S(x + dx1), S(y + dy1)], rgba(fill));
  e(w + 1, h + 1, "9f9bb3");
  e(w, h, "e9edf6");
  e(w * 0.72, h * 0.72, HOLO[1]);
  e(0, 0, HOLO[0], -w * 0.5, -h * 0.62, w * 0.1, -h * 0.1);
  e(w * 0.3, h * 0.34, PEARL[1]);
  e(w * 0.12, h * 0.16, SLOT_DARK);
}

// Ada's arm reaching from the pilot seat to the centre stack.
function hand(state: Hand): RgbaImage {
  const lay = layer();
  const shoulder: Xy = [338, 292];
  const tip: Xy = ({ hold: [398, 300], push: [402, 284], retract: [372, 300] } as const)[state];
  if (state === "hold") {
    disk(lay, [424, 300]);
  }
  round(lay, [shoulder, tip], 13, "733e39");
  round(lay, [shoulder, tip], 10, "b86f50");
  round(lay, [shoulder, [shoulder[0] + 10, shoulder[1] + 1]], 14, "feae34");
  round(lay, [shoulder, [shoulder[0] + 9, shoulder[1]]], 11, "fee761");
  ell(lay, tip, 8, "733e39");
  ell(lay, tip, 6.6, "b86f50");
  ell(lay, [tip[0] + 2, tip[1] - 2], 2.4, "c28569");
  return resize(lay, W, H);
}

// Idle frames of Archie's sprites (walker-ada frame 14, dog-penny frame 20), at 3x.
const sprite = (name: string) => {
  const image = decodePng(readFileSync(`${sources}${name}.png`));
  return resizeNearest(image.width * 3, image.height * 3, image);
};

export function dash({ astra, hand: arm, player }: DashScene): RgbaImage {
  const lay = layer();
  // The ship's nose ahead, seen over the dash.
  fillPolygon(
    lay,
    P([
      [250, 214],
      [422, 150],
      [594, 214],
    ]),
    rgba(NOSE),
  );
  fillPolygon(
    lay,
    P([
      [422, 150],
      [594, 214],
      [422, 214],
    ]),
    rgba(NOSE_SH),
  );
  polyline(
    lay,
    P([
      [330, 196],
      [422, 162],
      [514, 196],
    ]),
    rgba(NOSE_BLUE),
    S(4),
    true,
  );

  // Glass: a soft tint and reflection streaks inside the canopy.
  const glass = layer();
  fillPolygon(glass, P(CANOPY), [255, 255, 255, 16]);
  const streak = (box: readonly number[], a0: number, a1: number, alpha: number, width: number) =>
    arc(
      { fill: [255, 255, 255, alpha], width: S(width) },
      { x0: S(box[0]!), y0: S(box[1]!), x1: S(box[2]!), y1: S(box[3]!) },
      a0,
      a1,
      glass,
    );
  streak([90, 40, 420, 420], 200, 250, 70, 5);
  streak([110, 58, 430, 430], 205, 240, 45, 3);
  streak([560, 36, 760, 330], 290, 320, 55, 4);
  over(lay, glass);

  // Canopy frame and ribs.
  for (const sign of [-1, 1]) {
    const rib = Array.from({ length: 11 }, (_, k): Xy => [
      422 + sign * (110 + 60 * (k / 10) ** 1.6),
      14 + (192 * k) / 10,
    ]);
    round(lay, rib, 6, CHROME_SH);
  }
  round(lay, CANOPY, 13, CHROME_SH);
  round(
    lay,
    CANOPY.map(([x, y]) => [x, y - 2]),
    9,
    CHROME,
  );

  // Dash: a rounded 60s console with a teal trim band.
  const top: Xy[] = Array.from({ length: 41 }, (_, i) => {
    const t = i / 40;
    return [36 + t * (808 - 36), 210 - 22 * Math.sin(Math.PI * t)];
  });
  fillPolygon(lay, P([[36, 222], ...top, [808, 222], [808, 300], [36, 300]]), rgba(DASH));
  polyline(lay, P(top), rgba(DASH_LIP), S(5), true);
  polyline(lay, P(top.map(([x, y]) => [x, y + 12])), rgba(TRIM), S(4), true);
  rectangle({ fill: rgba(DASH_SH) }, { x0: S(36), y0: S(282), x1: S(808), y1: S(300) }, lay);

  // Left: a CRT star map, toggles and a knob.
  rrect(lay, [138, 214, 236, 270], 10, CRT_BEZEL);
  rrect(lay, [146, 220, 228, 262], 9, CRT_GLASS);
  for (let k = 0; k < 5; k++) {
    polyline(
      lay,
      P([
        [152, 226 + k * 8],
        [222, 226 + k * 8],
      ]),
      rgba("2a5552"),
      S(1),
    );
  }
  const stars: Xy[] = [
    [160, 250],
    [180, 236],
    [200, 244],
    [214, 230],
  ];
  for (let i = 0; i < 3; i++) {
    polyline(lay, P([stars[i]!, stars[i + 1]!]), rgba(CRT_LINE), S(1.5));
  }
  for (const star of stars) {
    ell(lay, star, 2.4, CRT_LINE);
  }
  for (let i = 0; i < 4; i++) {
    const x = 66 + i * 16;
    rrect(lay, [x - 4, 238, x + 4, 258], 3, DASH_SH);
    ell(lay, [x, 238], 4.5, i % 2 === 0 ? CORAL : TRIM);
  }
  ell(lay, [256, 254], 9, DASH_SH);
  ell(lay, [256, 252], 8, CHROME);
  polyline(
    lay,
    P([
      [256, 252],
      [261, 247],
    ]),
    rgba(PLUM),
    S(2),
  );

  // Right: an 80s LED bargraph and knobs.
  rrect(lay, [596, 216, 712, 252], 6, PLAYER_SH);
  rrect(lay, [596, 214, 712, 250], 6, PLAYER);
  rrect(lay, [606, 224, 702, 240], 2, LED_DARK);
  for (let i = 0; i < 10; i++) {
    const colour = i < 6 ? TRIM : i < 9 ? LED_AMBER : CORAL;
    rrect(lay, [610 + i * 9, 228, 615 + i * 9, 236], 1, i < 5 ? colour : "4a3a48");
  }
  for (let i = 0; i < 3; i++) {
    ell(lay, [742 + i * 18, 246], 6, DASH_SH);
    ell(lay, [742 + i * 18, 244], 5, CHROME);
  }

  over(lay, astraLayer(astra));

  // Side doors and the rear carpet.
  rectangle({ fill: rgba(CARPET) }, { x0: 0, y0: S(296), x1: S(W), y1: S(H) }, lay);
  for (let x = -20; x < 860; x += 36) {
    polyline(
      lay,
      P([
        [x, 390],
        [x + 40, 296],
      ]),
      rgba(CARPET_D),
      S(2),
    );
  }
  for (const side of [0, 1]) {
    const door: Xy[] = [
      [0, 236],
      [34, 222],
      [120, 258],
      [150, 390],
      [0, 390],
    ];
    const points = side ? door.map(([x, y]): Xy => [W - x, y]) : door;
    fillPolygon(lay, P(points), rgba(DASH));
    polyline(lay, P(points.slice(0, 3)), rgba(CHROME), S(6), true);
    const stripe: Xy[] = side
      ? [
          [W, 300],
          [W - 138, 316],
        ]
      : [
          [0, 300],
          [138, 316],
        ];
    polyline(lay, P(stripe), rgba(TRIM), S(5));
  }

  // Centre stack: the slot-loading holodisk drive above a lever.
  rrect(lay, [374, 262, 470, 378], 12, DASH_SH);
  rrect(lay, [378, 258, 466, 372], 12, DASH);
  const [x0, y0, x1, y1] = PLAYER_BOX;
  rrect(lay, [x0, y0, x1, y1 + 2], 5, PLAYER_SH);
  rrect(lay, [x0, y0, x1, y1], 5, PLAYER);
  rrect(lay, SLOT, 2, SLOT_DARK);
  rrect(lay, [392, 284, 424, 295], 2, LED_DARK);
  const loaded = player === "in" || player === "done";
  for (let i = 0; i < 4; i++) {
    rrect(lay, [395 + i * 7, 287, 400 + i * 7, 292], 1, loaded ? LED_AMBER : "6b4b2a");
  }
  [DASH_LIP, DASH_LIP, CORAL].forEach((colour, i) => {
    rrect(lay, [428 + i * 9, 284, 435 + i * 9, 295], 2, colour);
  });
  ell(lay, [455, 275], 2.4, loaded ? HOLO[0] : HOLO[2]);
  polyline(
    lay,
    P([
      [422, 350],
      [428, 318],
    ]),
    rgba(CHROME_SH),
    S(4),
  );
  ell(lay, [428, 316], 7, CORAL);
  ell(lay, [426, 313], 2.6, "f2a596");

  if (player === "half") {
    // The far half of the disk is already inside the dash.
    const half = layer();
    disk(half, [422, 276]);
    half.data.fill(0, 0, half.width * S(276) * 4);
    over(lay, half);
  }
  if (player === "in") {
    polyline(
      lay,
      P([
        [422, 266],
        [422, 254],
      ]),
      rgba(HOLO[0]),
      S(3),
    );
  }
  if (player === "done") {
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI) / 6;
      ell(lay, [ASTRA_C[0] + 34 * Math.cos(a), ASTRA_C[1] + 34 * Math.sin(a)], 2.4, HOLO[0]);
    }
  }

  // Rounded 60s bucket seats side by side, seen from behind.
  const seats = layer();
  for (const cx of [SEAT_L, SEAT_R]) {
    rrect(seats, [cx - 80, 284, cx + 80, 420], 56, SEAT_SH);
    rrect(seats, [cx - 76, 280, cx + 76, 414], 54, SEAT);
    rrect(seats, [cx - 66, 290, cx + 66, 404], 46, PIPING, 3);
    for (const k of [-30, 0, 30]) {
      polyline(
        seats,
        P([
          [cx + k, 304],
          [cx + k, 390],
        ]),
        rgba(SEAT_SH),
        S(2),
      );
    }
    fillEllipse(seats, [S(cx - 52), S(285), S(cx - 14), S(297)], rgba(SEAT_HI));
  }
  const out = shimmer({ height: H, scale: 1, width: W, x0: 0, y0: 0 });
  over(out, resize(lay, W, H));
  // Ada in the port seat, Penny in the starboard seat; the seat backs cover their lower halves.
  const ada = sprite("walker-ada-idle");
  const penny = sprite("dog-penny-idle");
  over(out, ada, SEAT_L - ada.width / 2, 290 - (15 + 34) * 3);
  over(out, penny, SEAT_R - Math.floor(penny.width / 2), 290 - (11 + 24) * 3);
  over(out, resize(seats, W, H));
  if (arm) {
    over(out, hand(arm));
  }
  return out;
}
