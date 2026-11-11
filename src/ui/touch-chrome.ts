// The on-screen joysticks' drawing, after Chibi's touch chrome: a hollow ring in a 75 pixel frame
// (an ink ring 5 wide round a cream ring 3 wide) and an 11 pixel knob (a cream disc on an ink
// disc 1 wider). Lit parts turn white. Frames are rendered TOUCH_CHROME_SCALE times larger with
// antialiased edges and shown TOUCH_CHROME_ALPHA opaque.

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

export const TOUCH_CHROME_SCALE = 4;
export const TOUCH_CHROME_FRAME = 75;
export const TOUCH_KNOB_FRAME = 11;
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

// How far the move knob's centre may be drawn from the ring's centre: its outer edge then stays
// inside the markers' inner edge, the marker ink nearest the centre.
export const MOVE_KNOB_REACH = Math.floor(
  CENTRE.x - (Math.max(...LEFT.map(({ x }) => x)) + MARKER_INK_WIDTH / 2) - KNOB_OUTER_RADIUS,
);

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
  const outer = 36.5;
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

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function segmentDistance(point: Point, from: Point, to: Point): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const t = clamp01(((point.x - from.x) * dx + (point.y - from.y) * dy) / (dx * dx + dy * dy));
  return Math.hypot(point.x - from.x - t * dx, point.y - from.y - t * dy);
}

// Coverage changes only within one high-resolution texel of each geometric boundary.
function coverage(distance: number): number {
  return clamp01(0.5 - distance * TOUCH_CHROME_SCALE);
}

// The straight RGBA of the layers at a point in frame pixels.
export function touchChromePixel(
  layers: readonly TouchChromeLayer[],
  point: Point,
): readonly [number, number, number, number] {
  let alpha = 0;
  let red = 0;
  let green = 0;
  let blue = 0;
  for (const layer of layers) {
    let amount: number;
    if (layer.kind === "stroke") {
      let distance = Infinity;
      for (let index = 1; index < layer.path.length; index++) {
        distance = Math.min(
          distance,
          segmentDistance(point, layer.path[index - 1]!, layer.path[index]!),
        );
      }
      amount = coverage(distance - layer.width / 2);
    } else {
      const distance = Math.hypot(point.x - layer.centre.x, point.y - layer.centre.y);
      amount =
        layer.kind === "disc"
          ? coverage(distance - layer.radius)
          : coverage(distance - layer.outer) - coverage(distance - layer.inner);
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
