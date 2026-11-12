import { SCREEN } from "../data/screen.ts";

// Needle's edge-on band (art/needle.md "Space look"): one thin line across the sky at a fixed
// angle through a fixed point of the play view, drawn from data rather than a texture, with
// point stars scattered along it from a fixed seed. Like a backdrop haze it is fixed to the
// screen, over the field fill and under the dust specks, backdrop rocks and every play object.

/** One Gaussian layer of the band's profile across the line. */
export interface BandLayer {
  readonly alpha: number;
  readonly sigma: number;
}

/** Point stars along the line: one per `spacing` px, offset across it by a normal of `sigma`. */
export interface BandStars {
  /** The alpha range, low to high; one alpha for every star when both are the same. */
  readonly alpha: readonly [number, number];
  readonly color: string;
  readonly sigma: number;
  readonly size: number;
  readonly spacing: number;
}

export interface BackdropBand {
  /** Degrees on screen, positive clockwise. */
  readonly angle: number;
  readonly color: string;
  readonly profile: readonly BandLayer[];
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

function readStars(value: unknown, color: string): BandStars | undefined {
  const data = fields(value);
  const alpha = Array.isArray(data.alpha) ? data.alpha : [1, 1];
  const starColor = data.color ?? color;
  if (
    !positive(data.spacing) ||
    !finite(data.sigma) ||
    data.sigma < 0 ||
    !positive(data.size) ||
    alpha.length !== 2 ||
    !alpha.every(unit) ||
    typeof starColor !== "string" ||
    !HEX.test(starColor)
  ) {
    return undefined;
  }
  return {
    alpha: [alpha[0] as number, alpha[1] as number],
    color: starColor,
    sigma: data.sigma,
    size: data.size,
    spacing: data.spacing,
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
  const layers = profile.map((layer) => fields(layer));
  if (!layers.every((layer) => unit(layer.alpha) && positive(layer.sigma))) {
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
    profile: layers.map(({ alpha, sigma }) => ({ alpha: alpha as number, sigma: sigma as number })),
    specks,
    stars,
    through: [through[0] as number, through[1] as number],
  };
}

/** The line's alpha `d` logical px across it: the profile's Gaussians summed. */
export function bandAlpha(band: Pick<BackdropBand, "profile">, d: number): number {
  return band.profile.reduce(
    (sum, { alpha, sigma }) => sum + alpha * Math.exp(-((d / sigma) ** 2)),
    0,
  );
}

/** A point star on the band, in logical px of the area it was scattered over. */
export interface BandStar {
  readonly alpha: number;
  readonly x: number;
  readonly y: number;
}

// A fixed-seed generator (mulberry32), so the band looks the same on every flight.
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The fixed seed of every band's stars. */
export const BAND_SEED = 20261112;

/**
 * The band's line in an area `width` by `height` whose top-left is `origin` play-view px: its
 * point and unit direction there.
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
 * Point stars scattered along the line across an area `width` wide: one per `spacing` px of its
 * length on average, each offset across it by a normal of `sigma`, from `seed`.
 */
export function bandStars(
  band: Pick<BackdropBand, "angle" | "through">,
  stars: BandStars,
  area: { readonly height: number; readonly width: number; readonly x: number; readonly y: number },
  seed: number,
): BandStar[] {
  const next = random(seed);
  const { direction, point } = bandLine(band, area);
  const length = area.width / Math.abs(direction.x);
  const count = Math.round(length / stars.spacing);
  const normal = { x: -direction.y, y: direction.x };
  const placed: BandStar[] = [];
  for (let i = 0; i < count; i++) {
    const along = (next() - 0.5) * length;
    // Box-Muller: a normal offset across the line.
    const across =
      stars.sigma * Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
    const [low, high] = stars.alpha;
    placed.push({
      alpha: low + (high - low) * next(),
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
 * Paints the band over BAND_AREA into a canvas `scale` texels per logical px: the line's profile
 * per texel, then the specks and stars from BAND_SEED.
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
  for (const [index, stars] of [band.specks, band.stars].entries()) {
    const [sr, sg, sb] = rgb(stars.color) as [number, number, number];
    const size = stars.size * scale;
    for (const star of bandStars(band, stars, BAND_AREA, BAND_SEED + index)) {
      context.fillStyle = `rgba(${sr},${sg},${sb},${star.alpha})`;
      context.fillRect(star.x * scale - size / 2, star.y * scale - size / 2, size, size);
    }
  }
}
