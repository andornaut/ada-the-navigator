// The on-screen joysticks' and the Use disc's drawing, after Chibi's touch chrome
// (chibis-way-home src/ui/chrome/touchChrome.ts): a hollow ring in a 75 pixel frame (an ink ring 5
// wide round a cream ring 3 wide), an 11 pixel knob (a cream disc on an ink disc 1 wider) and the
// Use disc's action symbols (art/controls.md "Use disc"). Lit parts turn white. Frames are vector
// art, painted at the scene's SVG raster scale (texels per logical px) with antialiased edges and
// shown TOUCH_CHROME_ALPHA opaque.

import { clamp01 } from "@andornaut/game-kit/numbers";

import { TOUCH_CHROME_FRAME } from "../data/layout.ts";
import type { UseAction } from "../model/types.ts";

export { TOUCH_CHROME_FRAME, TOUCH_KNOB_FRAME } from "../data/layout.ts";

export interface Point {
  readonly x: number;
  readonly y: number;
}

export type TouchChromeKind = "aim" | "knob" | "move";
export type TouchChromePose = "held" | "held-left" | "held-right" | "rest";
export const TOUCH_CHROME_POSES: readonly TouchChromePose[] = [
  "rest",
  "held",
  "held-left",
  "held-right",
];

export interface TouchChromeColours {
  readonly cream: number;
  readonly ink: number;
  readonly white: number;
}

// Chibi's cream, ink and white, which Ada's UI palette (public/art/ui/palette.json) shares.
export const TOUCH_CHROME_COLOURS: TouchChromeColours = {
  cream: 0xead4aa,
  ink: 0x181425,
  white: 0xffffff,
};

export const TOUCH_CHROME_ALPHA = 0.85;

// The UI manifest sheet each kind reads its frames, tags and timing from. Both rings use the
// move hint's frames; the aim ring omits the chevrons.
export const TOUCH_CHROME_SHEETS: Readonly<Record<TouchChromeKind, string>> = {
  aim: "ui-move-hint",
  knob: "ui-move-knob",
  move: "ui-move-hint",
};

export function isTouchChromePose(tag: string): tag is TouchChromePose {
  return (TOUCH_CHROME_POSES as readonly string[]).includes(tag);
}

export type TouchChromeLayer =
  | {
      readonly colour: number;
      readonly kind: "disc";
      readonly centre: Point;
      readonly radius: number;
    }
  | {
      readonly colour: number;
      readonly kind: "ring";
      readonly centre: Point;
      readonly inner: number;
      readonly outer: number;
    }
  | {
      readonly colour: number;
      readonly kind: "stroke";
      readonly path: readonly Point[];
      readonly width: number;
    }
  | {
      readonly colour: number;
      /** How far the fill grows past the polygon's edges, in frame px. */
      readonly grow: number;
      readonly kind: "polygon";
      readonly points: readonly Point[];
    }
  | {
      readonly colour: number;
      readonly kind: "rect";
      readonly rect: {
        readonly height: number;
        readonly width: number;
        readonly x: number;
        readonly y: number;
      };
    };

export const TOUCH_CHROME_CENTRE = { x: 37.5, y: 37.5 };
const CENTRE = TOUCH_CHROME_CENTRE;
// The knob's drawn radius, its ink disc, and the move markers' ink stroke width.
export const KNOB_OUTER_RADIUS = 5.5;
export const MARKER_INK_WIDTH = 6;
const LEFT = [
  { x: 18, y: 34 },
  { x: 13, y: 37.5 },
  { x: 18, y: 41 },
] as const;
const RIGHT = LEFT.map(({ x, y }) => ({ x: TOUCH_CHROME_FRAME - x, y }));
export const MOVE_MARKERS: readonly (readonly Point[])[] = [LEFT, RIGHT];

// The ring's outer ink edge, shared by its rendering and the move knob's full-strength centre.
export const TOUCH_RING_OUTER_RADIUS = (TOUCH_CHROME_FRAME - 2) / 2;
export const MOVE_KNOB_REACH = TOUCH_RING_OUTER_RADIUS;

// The layers of one frame, painted in order. The move ring carries Chibi's left and right
// chevrons, each lit while the stick pushes that way; the aim ring is the plain ring. The knob
// lights while held.
export function touchChromeLayers(
  colours: TouchChromeColours,
  kind: TouchChromeKind,
  pose: TouchChromePose,
): readonly TouchChromeLayer[] {
  const layers: TouchChromeLayer[] = [];
  const core = pose === "held" ? colours.white : colours.cream;
  if (kind === "knob") {
    const centre = { x: 5.5, y: 5.5 };
    layers.push({ centre, colour: colours.ink, kind: "disc", radius: KNOB_OUTER_RADIUS });
    layers.push({ centre, colour: core, kind: "disc", radius: KNOB_OUTER_RADIUS - 1 });
    return layers;
  }
  const outer = TOUCH_RING_OUTER_RADIUS;
  layers.push({ centre: CENTRE, colour: colours.ink, inner: outer - 5, kind: "ring", outer });
  layers.push({ centre: CENTRE, colour: core, inner: outer - 4, kind: "ring", outer: outer - 1 });
  if (kind === "move") {
    const stroke = (path: readonly Point[], colour: number) => {
      layers.push({ colour: colours.ink, kind: "stroke", path, width: MARKER_INK_WIDTH });
      layers.push({ colour, kind: "stroke", path, width: MARKER_INK_WIDTH - 2 });
    };
    stroke(LEFT, pose === "held-left" ? colours.white : colours.cream);
    stroke(RIGHT, pose === "held-right" ? colours.white : colours.cream);
  }
  return layers;
}

/** The Use disc's poses: at rest, the 60 ms press frame, then held until release. */
export type UseDiscPose = "held" | "press" | "rest";
export const USE_DISC_POSES: readonly UseDiscPose[] = ["rest", "press", "held"];
/** The press frame's length before the disc shows held. */
export const USE_PRESS_MS = 60;

// An arc about centre of radius, from one angle to another in degrees (clockwise from +x, y down),
// in 24 segments.
function arc(centre: Point, radius: number, from: number, to: number): Point[] {
  return Array.from({ length: 25 }, (_, index) => {
    const angle = ((from + ((to - from) * index) / 24) * Math.PI) / 180;
    return { x: centre.x + radius * Math.cos(angle), y: centre.y + radius * Math.sin(angle) };
  });
}

// One symbol part, its core in the frame's px: Chibi's model draws each over an ink layer 1 wider
// each side (a stroke's ink 2 wider than its core).
type SymbolPart =
  | { readonly centre: Point; readonly kind: "disc"; readonly radius: number }
  | {
      readonly centre: Point;
      readonly inner: number;
      readonly kind: "ring";
      readonly outer: number;
    }
  | { readonly kind: "polygon"; readonly points: readonly Point[] }
  | { readonly kind: "stroke"; readonly path: readonly Point[]; readonly width: number };

// The symbols' cores with each one's whole-px shift already applied (art/controls.md "Use disc"),
// so each one's drawn bounds, ink included, centre on the ring's centre.
export const USE_SYMBOLS: Readonly<Record<UseAction, readonly SymbolPart[]>> = {
  deliver: [
    {
      kind: "stroke",
      path: [
        { x: 22, y: 30 },
        { x: 39, y: 30 },
        { x: 39, y: 45 },
        { x: 22, y: 45 },
        { x: 22, y: 30 },
      ],
      width: 3,
    },
    {
      kind: "stroke",
      path: [
        { x: 30.5, y: 30 },
        { x: 30.5, y: 45 },
      ],
      width: 3,
    },
    {
      kind: "stroke",
      path: [
        { x: 43, y: 37.5 },
        { x: 52, y: 37.5 },
      ],
      width: 3,
    },
    {
      kind: "stroke",
      path: [
        { x: 48, y: 33 },
        { x: 52.5, y: 37.5 },
        { x: 48, y: 42 },
      ],
      width: 3,
    },
  ],
  deposit: [
    {
      kind: "stroke",
      path: [
        { x: 37.5, y: 23 },
        { x: 37.5, y: 42 },
      ],
      width: 3,
    },
    {
      kind: "stroke",
      path: [
        { x: 32.5, y: 37 },
        { x: 37.5, y: 42 },
        { x: 42.5, y: 37 },
      ],
      width: 3,
    },
    {
      kind: "stroke",
      path: [
        { x: 25, y: 41 },
        { x: 25, y: 53 },
        { x: 50, y: 53 },
        { x: 50, y: 41 },
      ],
      width: 3,
    },
  ],
  // The hangar arch over a filled ship: flying into a hangar.
  dock: [
    {
      kind: "stroke",
      path: [{ x: 24, y: 53 }, ...arc({ x: 37.5, y: 36 }, 13.5, 180, 360), { x: 51, y: 53 }],
      width: 3,
    },
    {
      kind: "polygon",
      points: [
        { x: 37.5, y: 31 },
        { x: 45, y: 49 },
        { x: 37.5, y: 44.5 },
        { x: 30, y: 49 },
      ],
    },
  ],
  salvage: [
    {
      kind: "stroke",
      path: [{ x: 29, y: 27 }, ...arc({ x: 37.5, y: 40 }, 8.5, 180, 0), { x: 46, y: 27 }],
      width: 4,
    },
  ],
  talk: [28.5, 37.5, 46.5].map((x) => ({ centre: { x, y: 37.5 }, kind: "disc", radius: 4 })),
  tow: [
    { centre: { x: 42.5, y: 24 }, inner: 2.5, kind: "ring", outer: 4 },
    {
      kind: "stroke",
      path: [{ x: 42.5, y: 28.5 }, ...arc({ x: 36.5, y: 48 }, 6, 0, 180), { x: 30.5, y: 43 }],
      width: 3,
    },
  ],
  use: [
    { centre: CENTRE, inner: 6, kind: "ring", outer: 10 },
    { centre: CENTRE, kind: "disc", radius: 3 },
  ],
};

// Salvage's magnet pole gaps: ink rects over its core.
const SALVAGE_GAPS = [
  { height: 1.5, width: 8, x: 25, y: 31.5 },
  { height: 1.5, width: 8, x: 42, y: 31.5 },
] as const;

/**
 * One Use disc frame: the open ring (its radii 1 larger in the press frame) and the action's
 * symbol, each part's ink before every core, cream at rest and white while pressed or held.
 */
export function useDiscLayers(
  colours: TouchChromeColours,
  action: UseAction,
  pose: UseDiscPose,
): readonly TouchChromeLayer[] {
  const core = pose === "rest" ? colours.cream : colours.white;
  const outer = 36.5 + (pose === "press" ? 1 : 0);
  const layers: TouchChromeLayer[] = [
    { centre: CENTRE, colour: colours.ink, inner: outer - 5, kind: "ring", outer },
    { centre: CENTRE, colour: core, inner: outer - 4, kind: "ring", outer: outer - 1 },
  ];
  const parts = USE_SYMBOLS[action];
  const paint = (part: SymbolPart, colour: number, grow: number): TouchChromeLayer =>
    part.kind === "disc"
      ? { centre: part.centre, colour, kind: "disc", radius: part.radius + grow }
      : part.kind === "ring"
        ? {
            centre: part.centre,
            colour,
            inner: part.inner - grow,
            kind: "ring",
            outer: part.outer + grow,
          }
        : part.kind === "polygon"
          ? { colour, grow, kind: "polygon", points: part.points }
          : { colour, kind: "stroke", path: part.path, width: part.width + 2 * grow };
  layers.push(...parts.map((part) => paint(part, colours.ink, 1)));
  layers.push(...parts.map((part) => paint(part, core, 0)));
  if (action === "salvage") {
    layers.push(
      ...SALVAGE_GAPS.map((rect) => ({ colour: colours.ink, kind: "rect" as const, rect })),
    );
  }
  return layers;
}

/** The Use callout's navy face (art/destinations.md "Use callout"). */
export const USE_CALLOUT_FACE = 0x262b44;

/**
 * The Use callout's frame in logical px: the ink disc of radius 13 about O and its tail to 17
 * below O. O sits USE_CALLOUT_CENTRE from the frame's top left.
 */
export const USE_CALLOUT_FRAME = { height: 30, width: 26 } as const;
export const USE_CALLOUT_CENTRE: Point = { x: 13, y: 13 };
/** From O down to the tail's tip, which sits USE_CALLOUT_GAP above the destination's top. */
export const USE_CALLOUT_TAIL = 17;
export const USE_CALLOUT_GAP = 3;
/** The callout's fade in and out, with cubicOut; reduced motion shows and hides at once. */
export const USE_CALLOUT_FADE_MS = 150;
const CALLOUT_SYMBOL_SCALE = 0.39;

/**
 * The Use callout for an action (art/destinations.md "Use callout"): an ink disc and tail, a
 * cream rim and tail over it, a navy face, and the action's Use disc symbol cores in cream,
 * scaled by 0.39 about the ring centre placed on O, with no ink.
 */
export function useCalloutLayers(
  colours: TouchChromeColours,
  action: UseAction,
): readonly TouchChromeLayer[] {
  const o = USE_CALLOUT_CENTRE;
  const local = (x: number, y: number): Point => ({ x: o.x + x, y: o.y + y });
  const symbol = (point: Point): Point => ({
    x: o.x + (point.x - CENTRE.x) * CALLOUT_SYMBOL_SCALE,
    y: o.y + (point.y - CENTRE.y) * CALLOUT_SYMBOL_SCALE,
  });
  const layers: TouchChromeLayer[] = [
    { centre: o, colour: colours.ink, kind: "disc", radius: 13 },
    {
      colour: colours.ink,
      grow: 0,
      kind: "polygon",
      points: [local(-4, 10), local(4, 10), local(0, 17)],
    },
    { centre: o, colour: colours.cream, kind: "disc", radius: 12 },
    {
      colour: colours.cream,
      grow: 0,
      kind: "polygon",
      points: [local(-2.6, 9.8), local(2.6, 9.8), local(0, 15.2)],
    },
    { centre: o, colour: USE_CALLOUT_FACE, kind: "disc", radius: 10.5 },
  ];
  for (const part of USE_SYMBOLS[action]) {
    if (part.kind === "disc") {
      layers.push({
        centre: symbol(part.centre),
        colour: colours.cream,
        kind: "disc",
        radius: part.radius * CALLOUT_SYMBOL_SCALE,
      });
    } else if (part.kind === "ring") {
      layers.push({
        centre: symbol(part.centre),
        colour: colours.cream,
        inner: part.inner * CALLOUT_SYMBOL_SCALE,
        kind: "ring",
        outer: part.outer * CALLOUT_SYMBOL_SCALE,
      });
    } else if (part.kind === "polygon") {
      layers.push({
        colour: colours.cream,
        grow: 0,
        kind: "polygon",
        points: part.points.map(symbol),
      });
    } else {
      layers.push({
        colour: colours.cream,
        kind: "stroke",
        path: part.path.map(symbol),
        width: part.width * CALLOUT_SYMBOL_SCALE,
      });
    }
  }
  return layers;
}

/**
 * The callout's centre O in display px above a destination's pivot: its tail tip USE_CALLOUT_GAP
 * above the destination's drawn top, `top` display px above the pivot.
 */
export function useCalloutLift(top: number): number {
  return top + USE_CALLOUT_GAP + USE_CALLOUT_TAIL;
}

/** The callout's alpha `ms` into a fade in (or out) with cubicOut; reduced motion is instant. */
export function useCalloutAlpha(ms: number, reducedMotion: boolean, showing: boolean): number {
  const t = reducedMotion ? 1 : Math.min(1, Math.max(0, ms / USE_CALLOUT_FADE_MS));
  const eased = 1 - (1 - t) ** 3;
  return showing ? eased : 1 - eased;
}

/** A layer list's drawn bounds in frame px, ink included. */
export function layerBounds(layers: readonly TouchChromeLayer[]): {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
} {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  const take = (x0: number, y0: number, x1: number, y1: number) => {
    left = Math.min(left, x0);
    top = Math.min(top, y0);
    right = Math.max(right, x1);
    bottom = Math.max(bottom, y1);
  };
  for (const layer of layers) {
    if (layer.kind === "rect") {
      const { rect } = layer;
      take(rect.x, rect.y, rect.x + rect.width, rect.y + rect.height);
    } else if (layer.kind === "stroke") {
      const half = layer.width / 2;
      for (const point of layer.path) {
        take(point.x - half, point.y - half, point.x + half, point.y + half);
      }
    } else if (layer.kind === "polygon") {
      for (const point of layer.points) {
        take(
          point.x - layer.grow,
          point.y - layer.grow,
          point.x + layer.grow,
          point.y + layer.grow,
        );
      }
    } else {
      const radius = layer.kind === "disc" ? layer.radius : layer.outer;
      take(
        layer.centre.x - radius,
        layer.centre.y - radius,
        layer.centre.x + radius,
        layer.centre.y + radius,
      );
    }
  }
  return { bottom, left, right, top };
}

// The speed line from a stick's origin to the thumb: a cream stroke SPEED_LINE_WIDTH wide with an
// ink fringe 1 pixel wide on each side and round ends. It is drawn from a capsule frame whose ends
// are SPEED_LINE_CAP round and whose middle stretches to the line's length.
export const SPEED_LINE_WIDTH = 2;
export const SPEED_LINE_CAP = SPEED_LINE_WIDTH / 2 + 1;
export const SPEED_LINE_CAPSULE = {
  height: 2 * SPEED_LINE_CAP,
  width: 2 * SPEED_LINE_CAP + SPEED_LINE_WIDTH,
} as const;

// The capsule's layers: the stroke along its middle, from one cap's centre to the other's.
export function speedLineLayers(colours: TouchChromeColours): readonly TouchChromeLayer[] {
  const path = [
    { x: SPEED_LINE_CAP, y: SPEED_LINE_CAP },
    { x: SPEED_LINE_CAPSULE.width - SPEED_LINE_CAP, y: SPEED_LINE_CAP },
  ];
  return [
    { colour: colours.ink, kind: "stroke", path, width: SPEED_LINE_WIDTH + 2 },
    { colour: colours.cream, kind: "stroke", path, width: SPEED_LINE_WIDTH },
  ];
}

// Where the capsule draws for a line: its start, its length between cap centres and its angle.
export function speedLinePlacement(line: { readonly from: Point; readonly to: Point }): {
  readonly angle: number;
  readonly from: Point;
  readonly length: number;
} {
  return {
    angle: Math.atan2(line.to.y - line.from.y, line.to.x - line.from.x),
    from: line.from,
    length: Math.hypot(line.to.x - line.from.x, line.to.y - line.from.y),
  };
}

function segmentDistance(point: Point, from: Point, to: Point): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const t = clamp01(((point.x - from.x) * dx + (point.y - from.y) * dy) / (dx * dx + dy * dy));
  return Math.hypot(point.x - from.x - t * dx, point.y - from.y - t * dy);
}

// Coverage changes only within one texel of each geometric boundary, at texels per frame pixel.
function coverage(texels: number, distance: number): number {
  return clamp01(0.5 - distance * texels);
}

// The signed distance from a point to a closed polygon's edge: negative inside.
function polygonDistance(point: Point, points: readonly Point[]): number {
  let distance = Infinity;
  let inside = false;
  for (let index = 0, last = points.length - 1; index < points.length; last = index++) {
    const a = points[last]!;
    const b = points[index]!;
    distance = Math.min(distance, segmentDistance(point, a, b));
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < a.x + ((point.y - a.y) * (b.x - a.x)) / (b.y - a.y)
    ) {
      inside = !inside;
    }
  }
  return inside ? -distance : distance;
}

// The straight RGBA of the layers at a point in frame pixels, painted at texels per frame pixel.
export function touchChromePixel(
  texels: number,
  layers: readonly TouchChromeLayer[],
  point: Point,
): readonly [number, number, number, number] {
  let alpha = 0;
  let red = 0;
  let green = 0;
  let blue = 0;
  for (const layer of layers) {
    let amount: number;
    if (layer.kind === "rect") {
      const { rect } = layer;
      amount =
        coverage(texels, Math.max(rect.x - point.x, point.x - rect.x - rect.width)) *
        coverage(texels, Math.max(rect.y - point.y, point.y - rect.y - rect.height));
    } else if (layer.kind === "stroke") {
      let distance = Infinity;
      for (let index = 1; index < layer.path.length; index++) {
        distance = Math.min(
          distance,
          segmentDistance(point, layer.path[index - 1]!, layer.path[index]!),
        );
      }
      amount = coverage(texels, distance - layer.width / 2);
    } else if (layer.kind === "polygon") {
      amount = coverage(texels, polygonDistance(point, layer.points) - layer.grow);
    } else {
      const distance = Math.hypot(point.x - layer.centre.x, point.y - layer.centre.y);
      amount =
        layer.kind === "disc"
          ? coverage(texels, distance - layer.radius)
          : coverage(texels, distance - layer.outer) - coverage(texels, distance - layer.inner);
    }
    const remaining = 1 - amount;
    red = ((layer.colour >> 16) & 255) * amount + red * remaining;
    green = ((layer.colour >> 8) & 255) * amount + green * remaining;
    blue = (layer.colour & 255) * amount + blue * remaining;
    alpha = amount + alpha * remaining;
  }
  if (alpha === 0) {
    return [0, 0, 0, 0];
  }
  return [
    Math.round(red / alpha),
    Math.round(green / alpha),
    Math.round(blue / alpha),
    Math.round(alpha * 255),
  ];
}
