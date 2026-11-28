import { SCREEN } from "../../data/screen.ts";

// Needle's edge-on band (art/needle.md "Flat band"): one thin line across the sky at a fixed
// angle through a fixed point of the play view, drawn from data rather than a texture: two flat
// strips along the line and point stars on an even pitch, offset across it by a fixed cycle.
// Like a backdrop haze it is fixed to the screen, over the field fill and under the dust specks,
// backdrop rocks and every play object.

/** One flat strip across the line: `alpha` within `halfWidth` logical px either side of it. */
export interface BandStrip {
  readonly alpha: number;
  readonly halfWidth: number;
}

/**
 * Point stars along the line: star `i` sits `-extent + i pitch` px along it from its point, up
 * to `extent`, and `offsets[i mod n]` px across it.
 */
export interface BandStars {
  readonly alpha: number;
  readonly color: string;
  readonly extent: number;
  readonly offsets: readonly number[];
  readonly pitch: number;
  readonly size: number;
}

export interface BackdropBand {
  /** Degrees on screen, positive clockwise. */
  readonly angle: number;
  readonly color: string;
  readonly profile: readonly BandStrip[];
  readonly specks: BandStars;
  readonly stars: BandStars;
  /** The line's point as fractions of the play view. */
  readonly through: readonly [number, number];
}

const HEX = /^#[0-9a-f]{6}$/iu;
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;
const unit = (value: unknown): value is number => finite(value) && value >= 0 && value <= 1;
const fields = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

/** A star row; `alpha` defaults to 1 and `color` to the band's. */
function readStars(value: unknown, color: string): BandStars | undefined {
  const data = fields(value);
  const alpha = data.alpha ?? 1;
  const starColor = data.color ?? color;
  const offsets = data.offsets;
  if (
    !positive(data.pitch) ||
    !finite(data.extent) ||
    data.extent < 0 ||
    !Array.isArray(offsets) ||
    offsets.length === 0 ||
    !offsets.every(finite) ||
    !positive(data.size) ||
    !unit(alpha) ||
    typeof starColor !== "string" ||
    !HEX.test(starColor)
  ) {
    return undefined;
  }
  return {
    alpha,
    color: starColor,
    extent: data.extent,
    offsets: offsets as number[],
    pitch: data.pitch,
    size: data.size,
  };
}

/**
 * A version 1 band.json on the backdrop layer, fixed to the view (anchor `view`, parallax 0);
 * undefined if any part is missing or malformed, so the galaxy draws no band.
 */
export function readBackdropBand(value: unknown): BackdropBand | undefined {
  const data = fields(value);
  const through = data.through;
  const profile = data.profile;
  if (
    data.version !== 1 ||
    data.layer !== "backdrop" ||
    data.anchor !== "view" ||
    data.parallax !== 0 ||
    typeof data.color !== "string" ||
    !HEX.test(data.color) ||
    !finite(data.angle) ||
    !Array.isArray(through) ||
    through.length !== 2 ||
    !through.every(unit) ||
    !Array.isArray(profile) ||
    profile.length === 0
  ) {
    return undefined;
  }
  const strips = profile.map((strip) => fields(strip));
  if (!strips.every((strip) => unit(strip.alpha) && positive(strip.halfWidth))) {
    return undefined;
  }
  const specks = readStars(data.specks, data.color);
  const stars = readStars(data.stars, data.color);
  if (!specks || !stars) {
    return undefined;
  }
  return {
    angle: data.angle,
    color: data.color,
    profile: strips.map(({ alpha, halfWidth }) => ({
      alpha: alpha as number,
      halfWidth: halfWidth as number,
    })),
    specks,
    stars,
    through: [through[0] as number, through[1] as number],
  };
}

/** The line's alpha `d` logical px across it: the alphas of the strips that reach `d`, summed. */
export function bandAlpha(band: Pick<BackdropBand, "profile">, d: number): number {
  return band.profile.reduce(
    (sum, { alpha, halfWidth }) => (Math.abs(d) <= halfWidth ? sum + alpha : sum),
    0,
  );
}

/** A point star on the band, in logical px of the area it lies in. */
export interface BandStar {
  readonly alpha: number;
  readonly x: number;
  readonly y: number;
}

/**
 * The band's line in an area whose top-left is `origin` play-view px: its point and unit
 * direction there.
 */
export function bandLine(
  band: Pick<BackdropBand, "angle" | "through">,
  origin: { readonly x: number; readonly y: number },
): { readonly direction: { x: number; y: number }; readonly point: { x: number; y: number } } {
  const radians = (band.angle * Math.PI) / 180;
  return {
    direction: { x: Math.cos(radians), y: Math.sin(radians) },
    point: {
      x: band.through[0] * SCREEN.width - origin.x,
      y: band.through[1] * SCREEN.height - origin.y,
    },
  };
}

/**
 * A star row's stars in `area`: star `i` at `-extent + i pitch` px along the line from its point
 * and `offsets[i mod n]` px across it, toward the line's normal (its direction turned 90 degrees
 * clockwise); stars outside the area are left out.
 */
export function bandStars(
  band: Pick<BackdropBand, "angle" | "through">,
  stars: BandStars,
  area: { readonly height: number; readonly width: number; readonly x: number; readonly y: number },
): BandStar[] {
  const { direction, point } = bandLine(band, area);
  const normal = { x: -direction.y, y: direction.x };
  const count = Math.floor((2 * stars.extent) / stars.pitch) + 1;
  const placed: BandStar[] = [];
  for (let i = 0; i < count; i++) {
    const along = -stars.extent + i * stars.pitch;
    const across = stars.offsets[i % stars.offsets.length]!;
    placed.push({
      alpha: stars.alpha,
      x: point.x + direction.x * along + normal.x * across,
      y: point.y + direction.y * along + normal.y * across,
    });
  }
  return placed.filter(({ x, y }) => x >= 0 && y >= 0 && x <= area.width && y <= area.height);
}

/** The band's drawn area in play-view px: the backdrop haze's 960 by 480, centred on the view. */
export const BAND_AREA = {
  height: 480,
  width: 960,
  x: (SCREEN.width - 960) / 2,
  y: (SCREEN.height - 480) / 2,
} as const;

const rgb = (hex: string) => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));

/**
 * Paints the band over BAND_AREA into a canvas `scale` texels per logical px: the line's strips
 * per texel, then the specks and stars.
 */
export function paintBand(
  band: BackdropBand,
  context: CanvasRenderingContext2D,
  scale: number,
): void {
  const width = Math.round(BAND_AREA.width * scale);
  const height = Math.round(BAND_AREA.height * scale);
  const image = context.createImageData(width, height);
  const { direction, point } = bandLine(band, BAND_AREA);
  const [r, g, b] = rgb(band.color) as [number, number, number];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Distance across the line, in logical px, from the texel's centre.
      const dx = (x + 0.5) / scale - point.x;
      const dy = (y + 0.5) / scale - point.y;
      const alpha = bandAlpha(band, Math.abs(dy * direction.x - dx * direction.y));
      const at = (y * width + x) * 4;
      image.data[at] = r;
      image.data[at + 1] = g;
      image.data[at + 2] = b;
      image.data[at + 3] = Math.round(Math.min(1, alpha) * 255);
    }
  }
  context.putImageData(image, 0, 0);
  for (const stars of [band.specks, band.stars]) {
    const [sr, sg, sb] = rgb(stars.color) as [number, number, number];
    const size = stars.size * scale;
    for (const star of bandStars(band, stars, BAND_AREA)) {
      context.fillStyle = `rgba(${sr},${sg},${sb},${star.alpha})`;
      context.fillRect(star.x * scale - size / 2, star.y * scale - size / 2, size, size);
    }
  }
}
