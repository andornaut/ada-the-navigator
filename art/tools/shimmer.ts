// The in-between field: slow diagonal bands of the violet ramp with soft glows and sparkles.
// Positions are design px: the 844 by 390 design frame is 779 by 360 logical px, the view of
// an 844 by 390 phone. A view maps its output pixels onto that frame and may extend past it.
import { blankImage } from "@andornaut/art-kit/rgbaImage";

import { blur, disc, over, rgba } from "./paint.ts";
import { IN_BETWEEN, SHIMMER } from "./palette.ts";
import { Random } from "./random.ts";

export const DESIGN = { width: 844, height: 390 } as const;
// Logical px per design px.
export const LOGICAL_PER_DESIGN = 360 / 390;

export interface View {
  width: number;
  height: number;
  // Output px per design px.
  scale: number;
  // Design px at the output's top-left corner.
  x0: number;
  y0: number;
}

// A view of `width` by `height` logical px centred on the design frame, `density` output px per
// logical px.
export function centredView(width: number, height: number, density: number): View {
  const scale = density * LOGICAL_PER_DESIGN;
  return {
    height: height * density,
    scale,
    width: width * density,
    x0: DESIGN.width / 2 - width / 2 / LOGICAL_PER_DESIGN,
    y0: DESIGN.height / 2 - height / 2 / LOGICAL_PER_DESIGN,
  };
}

const RAMP = [IN_BETWEEN[1], IN_BETWEEN[2], "7f6abd", IN_BETWEEN[3], "c4a6e2"].map((c) => rgba(c));
const TINT = rgba(SHIMMER);
const LIGHT = "dcc3f2";
const SPARK = "f3e6ff";

const lerp = (a: readonly number[], b: readonly number[], t: number) =>
  [0, 1, 2].map((i) => Math.round(a[i]! + (b[i]! - a[i]!) * t));

export interface Field {
  phase?: number;
  // Band contrast; it also scales the glow and sparkle alpha.
  contrast?: number;
  sparkle?: boolean;
}

export function shimmer(view: View, { contrast = 1, phase = 0, sparkle = true }: Field = {}) {
  const image = blankImage(view.width, view.height);
  for (let y = 0; y < view.height; y++) {
    const Y = view.y0 + y / view.scale;
    for (let x = 0; x < view.width; x++) {
      const X = view.x0 + x / view.scale;
      const a = Math.sin(X * 0.011 + Y * 0.02 + phase * 2 * Math.PI);
      const b = Math.sin(X * 0.004 - Y * 0.013 - phase * Math.PI + 1.3);
      const c = Math.sin(X * 0.017 + Y * 0.006 + phase * 2 * Math.PI * 0.7 + 2.1);
      const v = Math.max(0, Math.min(0.999, 0.5 + contrast * (0.22 * a + 0.16 * b + 0.08 * c))) * 4;
      const i = Math.floor(v);
      let colour = lerp(RAMP[i]!, RAMP[Math.min(i + 1, 4)]!, v - i);
      // A faint cool tint in the bright crests.
      if (a > 0.75) {
        colour = lerp(colour, TINT, 0.12 * contrast * (a - 0.75) * 4);
      }
      image.data.set([colour[0]!, colour[1]!, colour[2]!, 255], (y * view.width + x) * 4);
    }
  }
  if (sparkle) {
    const overlay = blankImage(view.width, view.height);
    for (const spot of sparkles(view, phase)) {
      const centre = [(spot.x - view.x0) * view.scale, (spot.y - view.y0) * view.scale] as const;
      const alpha = Math.trunc((spot.glow ? 26 : 200) * spot.tw * contrast);
      disc(overlay, centre, spot.r * view.scale, rgba(spot.colour, alpha));
    }
    blur(overlay, 0.6 * view.scale);
    over(image, overlay);
  }
  return image;
}

interface Spot {
  x: number;
  y: number;
  r: number;
  // Twinkle, 0 to 1.
  tw: number;
  glow: boolean;
  colour: string;
}

// 26 glows and 40 sparkles in the design frame (seed 7, as approved); the area a view adds
// outside it takes the same density from seed 17. A sparkle's colour draw happens only while
// it is lit, so the sequence depends on the phase.
function sparkles(view: View, phase: number): Spot[] {
  const frame = draw(new Random(7), [0, 0, DESIGN.width, DESIGN.height], [26, 40], phase);
  const x1 = view.x0 + view.width / view.scale;
  const y1 = view.y0 + view.height / view.scale;
  const area = ((x1 - view.x0) * (y1 - view.y0)) / (DESIGN.width * DESIGN.height);
  if (area <= 1) {
    return frame;
  }
  const counts = [Math.round(26 * area), Math.round(40 * area)] as const;
  const outside = draw(new Random(17), [view.x0, view.y0, x1, y1], counts, phase).filter(
    ({ x, y }) => x < 0 || y < 0 || x >= DESIGN.width || y >= DESIGN.height,
  );
  return [...frame, ...outside];
}

function draw(
  random: Random,
  [x0, y0, x1, y1]: readonly [number, number, number, number],
  [glows, dots]: readonly [number, number],
  phase: number,
): Spot[] {
  const twinkle = () => (Math.sin(phase * 2 * Math.PI + random.random() * 6.28) + 1) / 2;
  const spots: Spot[] = [];
  for (let i = 0; i < glows; i++) {
    const x = random.uniform(x0, x1);
    const y = random.uniform(y0, y1);
    const r = random.uniform(6, 22);
    spots.push({ colour: LIGHT, glow: true, r, tw: twinkle(), x, y });
  }
  for (let i = 0; i < dots; i++) {
    const x = random.uniform(x0, x1);
    const y = random.uniform(y0, y1);
    const tw = twinkle();
    if (tw > 0.4) {
      spots.push({
        colour: random.random() < 0.5 ? SHIMMER : SPARK,
        glow: false,
        r: 1.5,
        tw,
        x,
        y,
      });
    }
  }
  return spots;
}
