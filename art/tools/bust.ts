// Authored chibi bust portraits in the conversation format (art/conversation.md): 32 px masks
// painted as ink-edged parts with a lower-right shade and an upper-left light, face stamps and
// the 22 px compact crop.
import type { Colour, Frame } from "@andornaut/art-kit/grid";

export const FULL = 32;
export const COMPACT = 22;
export const INK = "181425";
export const WHITE = "ffffff";
export const BLUSH = "f6757a";
const SWEAT = "2ce8f5";
const SWEAT_DEEP = "0099db";

export type Point = readonly [number, number];
/** Covered pixels, indexed [y][x]. */
export type Mask = readonly (readonly boolean[])[];

export const blank = (): Frame =>
  Array.from({ length: FULL }, () => Array.from({ length: FULL }, (): Colour => null));

const maskOf = (test: (x: number, y: number) => boolean): Mask =>
  Array.from({ length: FULL }, (_, y) => Array.from({ length: FULL }, (_, x) => test(x, y)));

export const has = (mask: Mask, x: number, y: number): boolean => mask[y]?.[x] ?? false;

/** Pixel centres at integer coordinates inside the ellipse. */
export const ellipse = (cx: number, cy: number, rx: number, ry: number): Mask =>
  maskOf((x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1);

export function tilted(cx: number, cy: number, rx: number, ry: number, degrees: number): Mask {
  const a = (degrees * Math.PI) / 180;
  const [c, s] = [Math.cos(a), Math.sin(a)];
  return maskOf((x, y) => {
    const [dx, dy] = [x - cx, y - cy];
    return ((dx * c + dy * s) / rx) ** 2 + ((-dx * s + dy * c) / ry) ** 2 <= 1;
  });
}

/** Inclusive corners. */
export const rect = (x0: number, y0: number, x1: number, y1: number): Mask =>
  maskOf((x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1);

export const polygon = (points: readonly Point[]): Mask =>
  maskOf((px, py) => {
    let hit = false;
    for (const [i, [ax, ay]] of points.entries()) {
      const [bx, by] = points[(i + 1) % points.length]!;
      if (ay > py !== by > py && px < ax + ((bx - ax) * (py - ay)) / (by - ay)) {
        hit = !hit;
      }
    }
    return hit;
  });

export const union = (...masks: Mask[]): Mask => maskOf((x, y) => masks.some((m) => has(m, x, y)));
export const above = (mask: Mask, row: number): Mask =>
  maskOf((x, y) => y < row && has(mask, x, y));
export const minus = (mask: Mask, ...cut: Mask[]): Mask =>
  maskOf((x, y) => has(mask, x, y) && !cut.some((m) => has(m, x, y)));
export const without = (mask: Mask, points: readonly Point[]): Mask =>
  maskOf((x, y) => has(mask, x, y) && !points.some(([px, py]) => px === x && py === y));

/** Rows from `top` down, each `widths[i]` either side of `centre`. */
export const shoulders = (widths: readonly number[], top = 25, centre = 15.5): Mask =>
  maskOf((x, y) => y >= top && y - top < widths.length && Math.abs(x - centre) <= widths[y - top]!);

const edgeOf = (mask: Mask, x: number, y: number): boolean =>
  has(mask, x, y) &&
  [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].some(([dx, dy]) => !has(mask, x + dx!, y + dy!));

export function set(frame: Frame, x: number, y: number, colour: Colour): void {
  const row = frame[y];
  if (row && x >= 0 && x < row.length) {
    row[x] = colour;
  }
}

export const get = (frame: Frame, x: number, y: number): Colour => frame[y]?.[x] ?? null;

export function fill(frame: Frame, mask: Mask, colour: string): void {
  for (const [y, row] of mask.entries()) {
    for (const [x, on] of row.entries()) {
      if (on) set(frame, x, y, colour);
    }
  }
}

export function dots(frame: Frame, points: readonly Point[], colour: string): void {
  for (const [x, y] of points) set(frame, x, y, colour);
}

type Paint = {
  base: string;
  shade?: string;
  light?: string;
  outline?: boolean;
  shadeDepth?: number;
  rim?: string;
  rimDark?: string;
};

/**
 * One part: a 1 px ink inner edge (unless `outline` is false), the base colour, a lower-right
 * shade crescent `shadeDepth` deep on the right and 1 deep below, and a 1 px upper-left light.
 * `rim` and `rimDark` light dark fur instead: `rim` along the inner edge except the lower right,
 * `rimDark` down the right side.
 */
export function paint(frame: Frame, mask: Mask, options: Paint): void {
  const { base, light, outline = true, rim, rimDark, shade, shadeDepth = 2 } = options;
  const covered: Point[] = [];
  for (const [y, row] of mask.entries()) {
    for (const [x, on] of row.entries()) {
      if (on) covered.push([x, y]);
    }
  }
  if (covered.length === 0) return;
  const cx = covered.reduce((sum, [x]) => sum + x, 0) / covered.length;
  const cy = covered.reduce((sum, [, y]) => sum + y, 0) / covered.length;
  const edge = maskOf((x, y) => outline && edgeOf(mask, x, y));
  const inner = maskOf((x, y) => has(mask, x, y) && !has(edge, x, y));
  for (const [x, y] of covered) {
    if (has(edge, x, y)) {
      set(frame, x, y, INK);
      continue;
    }
    let colour = base;
    if (shade) {
      const right =
        x >= cx &&
        Array.from({ length: shadeDepth }, (_, d) => d + 1).some((d) => !has(inner, x + d, y));
      const low = y >= cy && !has(inner, x, y + 1);
      if (right || low) colour = shade;
    }
    const upperLeft = !has(inner, x - 1, y) || !has(inner, x, y - 1);
    if (light && x < cx && y < cy && upperLeft) {
      colour = light;
    }
    if (rim && upperLeft && !(y > cy + 2 && x > cx)) {
      colour = rim;
    }
    if (rimDark && !has(inner, x + 1, y) && x > cx) {
      colour = rimDark;
    }
    set(frame, x, y, colour);
  }
}

/** A row-string stamp; `.` leaves the frame as it is. */
export function stamp(
  frame: Frame,
  x: number,
  y: number,
  rows: readonly string[],
  palette: Readonly<Record<string, string>>,
): void {
  for (const [j, row] of rows.entries()) {
    for (const [i, key] of [...row].entries()) {
      if (key !== ".") set(frame, x + i, y + j, palette[key]!);
    }
  }
}

/** Bresenham line, one pixel wide. */
export function line([x0, y0]: Point, [x1, y1]: Point): Point[] {
  const points: Point[] = [];
  const [dx, dy] = [Math.abs(x1 - x0), -Math.abs(y1 - y0)];
  const [sx, sy] = [x0 < x1 ? 1 : -1, y0 < y1 ? 1 : -1];
  let [x, y, error] = [x0, y0, dx + dy];
  for (;;) {
    points.push([x, y]);
    if (x === x1 && y === y1) return points;
    const twice = 2 * error;
    if (twice >= dy) {
      error += dy;
      x += sx;
    }
    if (twice <= dx) {
      error += dx;
      y += sy;
    }
  }
}

// Faces ------------------------------------------------------------------------------------

/** A 3 wide open eye `tall` high with a white glint at its top left. */
export function eyeOpen(frame: Frame, x: number, y: number, tall = 3): void {
  fill(frame, rect(x, y, x + 2, y + tall - 1), INK);
  set(frame, x, y, WHITE);
}

/** A closed happy eye, an arc 3 wide and 2 high. */
export function eyeHappy(frame: Frame, x: number, y: number): void {
  dots(
    frame,
    [
      [x + 1, y],
      [x, y + 1],
      [x + 2, y + 1],
    ],
    INK,
  );
}

/** Worried brows over eyes at `lx` and `rx`: the inner ends raised. */
export function browsWorried(
  frame: Frame,
  lx: number,
  rx: number,
  y: number,
  colour: string,
): void {
  dots(
    frame,
    [
      [lx, y],
      [lx + 1, y],
      [lx + 2, y - 1],
      [rx, y - 1],
      [rx + 1, y],
      [rx + 2, y],
    ],
    colour,
  );
}

export function blush(frame: Frame, lx: number, rx: number, y: number, colour = BLUSH): void {
  dots(
    frame,
    [
      [lx, y],
      [lx + 1, y],
      [rx, y],
      [rx + 1, y],
    ],
    colour,
  );
}

/** The set's sweat drop: two cyan pixels over a blue base, its tip at (x, y). */
export function sweat(frame: Frame, x: number, y: number): void {
  dots(
    frame,
    [
      [x, y],
      [x, y + 1],
      [x - 1, y + 1],
    ],
    SWEAT,
  );
  dots(
    frame,
    [
      [x, y + 2],
      [x - 1, y + 2],
    ],
    SWEAT_DEEP,
  );
}

/** The compact frame: the 22 x 22 window at `origin`, pixels copied exactly. */
export const crop = (frame: Frame, [ox, oy]: Point): Frame =>
  frame.slice(oy, oy + COMPACT).map((row) => row.slice(ox, ox + COMPACT));

/** The mask reflected about the frame's vertical centre line. */
export const mirror = (mask: Mask): Mask => maskOf((x, y) => has(mask, FULL - 1 - x, y));

/** Fur: a 1 px bump outward from every `period`-th edge pixel (by `7x + 3y + phase`). */
export function fuzz(mask: Mask, period: number, phase: number): Mask {
  const out = mask.map((row) => [...row]);
  for (const [y, row] of mask.entries()) {
    for (const x of row.keys()) {
      if (!edgeOf(mask, x, y) || (x * 7 + y * 3 + phase) % period !== 0) continue;
      const free = (
        [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ] as const
      ).find(([nx, ny]) => nx >= 0 && nx < FULL && ny >= 0 && ny < FULL && !has(mask, nx, ny));
      if (free) out[free[1]]![free[0]] = true;
    }
  }
  return out;
}

type Headset = {
  cup: string;
  accent: string;
  left: Point;
  right: Point;
  mic: Point;
  band?: readonly Point[];
};

/**
 * The station keepers' headset: an optional ink band, two 4 x 6 ear cups with an accent light
 * and an ink mic boom from the right cup to `mic`, tipped with the accent.
 */
export function headset(frame: Frame, { accent, band = [], cup, left, mic, right }: Headset): void {
  dots(frame, band, INK);
  for (const [x0, y0] of [left, right]) {
    paint(
      frame,
      without(rect(x0, y0, x0 + 3, y0 + 5), [
        [x0, y0],
        [x0 + 3, y0],
        [x0, y0 + 5],
        [x0 + 3, y0 + 5],
      ]),
      { base: cup },
    );
    dots(
      frame,
      [
        [x0 + 1, y0 + 2],
        [x0 + 2, y0 + 2],
        [x0 + 1, y0 + 3],
        [x0 + 2, y0 + 3],
      ],
      accent,
    );
  }
  dots(frame, line([right[0] + 1, right[1] + 5], mic), INK);
  dots(
    frame,
    [
      [mic[0], mic[1]],
      [mic[0] - 1, mic[1]],
    ],
    accent,
  );
}

/** The set's neutral face: two open eyes `gap` apart from (`ex`, `ey`) and a 2 px mouth. */
export function faceNeutral(
  frame: Frame,
  {
    ex,
    ey,
    gap,
    mouth = INK,
    my,
    tall = 3,
  }: {
    ex: number;
    ey: number;
    gap: number;
    my: number;
    mouth?: string;
    tall?: number;
  },
): void {
  eyeOpen(frame, ex, ey, tall);
  eyeOpen(frame, ex + gap, ey, tall);
  const mx = Math.round((2 * ex + gap + 2) / 2 - 1.5);
  dots(
    frame,
    [
      [mx + 1, my],
      [mx + 2, my],
    ],
    mouth,
  );
}
