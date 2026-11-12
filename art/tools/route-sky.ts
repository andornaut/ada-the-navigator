// The route map's backdrop (art/route-sky.md): an evening sky of stars and stellar phenomena
// behind the chart, and a ground strip with the afterglow and the grass Ada and Penny stand on.
// The sky is dimmed behind every chart mark (the guard), and the build fails if a mark's ground
// is brighter than the guard's cap. art/tools/storybook.ts draws Ada and Penny's sprites.
import { fileURLToPath } from "node:url";

import { blankImage, type RgbaImage } from "@andornaut/art-kit/rgbaImage";

import { placeEntries } from "./manifest.ts";
import { rgb, type Rgb } from "./oklab.ts";
import { writePng } from "./paint.ts";
import { Random } from "./random.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));

// The sky canvas in logical px at 2 image px each. Its top-centre sits on the play view's
// top-centre, so a play view point (x, y) is canvas point (x + SKY.offset, y).
export const SKY = { width: 960, height: 540, density: 2, offset: 120 } as const;
// The ground strip: its bottom on the view's bottom, its centre on the play view's centre. The
// grass line runs `grass` below its top, with the afterglow above it.
export const GROUND = { width: 960, height: 120, density: 2, grass: 86 } as const;
// Ada and Penny on the ground canvas: each sprite's foot centre, left of Earth (play x 160).
export const FIGURES = {
  ada: { x: SKY.offset + 93, y: 112 },
  penny: { x: SKY.offset + 116, y: 112 },
} as const;

// The chart the guard keeps dark, in play view px (art/layout.md "Galaxy selector"): one circular
// arc through the end markers' centres and its top, the six markers at equal angles along it.
export const ARC = { x: 360, halfWidth: 264, ends: 122, top: 46 } as const;
const sag = ARC.ends - ARC.top;
const RADIUS = (ARC.halfWidth ** 2 + sag ** 2) / (2 * sag);
const SPAN = Math.asin(ARC.halfWidth / RADIUS);
const onArc = (angle: number) =>
  [ARC.x + RADIUS * Math.sin(angle), ARC.top + RADIUS * (1 - Math.cos(angle))] as const;
export const CENTRES: readonly (readonly [number, number])[] = Array.from({ length: 6 }, (_, i) =>
  onArc(-SPAN + (i * 2 * SPAN) / 5),
);
// Behind each marker, each label pill (the widest name's pill and 6 to spare each side), every
// leg, and the close X's corner at every view up to the canvas's right edge.
export const GUARD = {
  marker: 21,
  label: { halfWidth: 56, top: 15, bottom: 43 },
  leg: 6,
  corner: { x0: 600, y0: 0, x1: SKY.width - SKY.offset, y1: 56 },
  sigma: 3,
  gain: 1.6,
  // Highest WCAG relative luminance behind a mark: 6.5:1 for the #B8B3C9 dashes and "..."
  // labels, and the marks' own floors on their ink backings.
  cap: 0.028,
} as const;

/* Float sRGB buffers */

class Buffer {
  readonly data: Float32Array;
  readonly width: number;
  readonly height: number;
  readonly density: number;
  constructor(width: number, height: number, density: number) {
    this.width = width;
    this.height = height;
    this.density = density;
    this.data = new Float32Array(width * height * 3);
  }

  // Adds `alpha` of `colour` at each pixel of a window, alpha from `f(x, y)` in logical px.
  add(
    colour: string,
    window: readonly [number, number, number, number],
    f: (x: number, y: number) => number,
  ) {
    const c = rgb(colour).map((v) => v / 255);
    const d = this.density;
    const [x0, y0, x1, y1] = window.map((v, i) =>
      Math.max(0, Math.min(i % 2 === 0 ? this.width : this.height, Math.round(v * d))),
    ) as [number, number, number, number];
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const a = f((px + 0.5) / d, (py + 0.5) / d);
        if (a <= 0) continue;
        const i = (py * this.width + px) * 3;
        for (let k = 0; k < 3; k++) this.data[i + k] = Math.min(1, this.data[i + k]! + c[k]! * a);
      }
    }
  }

  // Lays `colour` over each pixel at alpha `f(x, y)`.
  over(colour: string, f: (x: number, y: number) => number) {
    const c = rgb(colour).map((v) => v / 255);
    for (let py = 0; py < this.height; py++) {
      for (let px = 0; px < this.width; px++) {
        const a = Math.min(1, Math.max(0, f((px + 0.5) / this.density, (py + 0.5) / this.density)));
        if (a <= 0) continue;
        const i = (py * this.width + px) * 3;
        for (let k = 0; k < 3; k++) this.data[i + k] = this.data[i + k]! * (1 - a) + c[k]! * a;
      }
    }
  }

  toImage(alpha?: Float32Array): RgbaImage {
    const image = blankImage(this.width, this.height);
    for (let i = 0; i < this.width * this.height; i++) {
      const a = alpha ? Math.round(255 * alpha[i]!) : 255;
      image.data.set(
        [0, 1, 2]
          .map((k) => Math.round(255 * Math.min(1, Math.max(0, this.data[i * 3 + k]!))))
          .concat(a),
        i * 4,
      );
    }
    return image;
  }
}

const linear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const srgb = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const luminance = (r: number, g: number, b: number) =>
  0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

// A rotated elliptical Gaussian and the window it reaches.
function gauss(cx: number, cy: number, rx: number, ry: number, rot = 0) {
  const [c, s] = [Math.cos(rot), Math.sin(rot)];
  const reach = 3.5 * Math.max(rx, ry);
  return {
    window: [cx - reach, cy - reach, cx + reach, cy + reach] as const,
    at: (x: number, y: number) => {
      const [dx, dy] = [x - cx, y - cy];
      const u = (dx * c + dy * s) / rx;
      const w = (-dx * s + dy * c) / ry;
      return Math.exp(-0.5 * (u * u + w * w));
    },
  };
}

// Smooth value noise in [0, 1] on a lattice `cell` logical px apart.
function valueNoise(seed: number, width: number, height: number, cell: number) {
  const random = new Random(seed);
  const cols = Math.ceil(width / cell) + 2;
  const rows = Math.ceil(height / cell) + 2;
  const lattice = Array.from({ length: cols * rows }, () => random.random());
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const [gx, gy] = [x / cell, y / cell];
    const [ix, iy] = [Math.floor(gx), Math.floor(gy)];
    const [tx, ty] = [smooth(gx - ix), smooth(gy - iy)];
    const v = (i: number, j: number) =>
      lattice[Math.min(rows - 1, j) * cols + Math.min(cols - 1, i)]!;
    const top = v(ix, iy) * (1 - tx) + v(ix + 1, iy) * tx;
    const bottom = v(ix, iy + 1) * (1 - tx) + v(ix + 1, iy + 1) * tx;
    return top * (1 - ty) + bottom * ty;
  };
}

/* The sky */

const SKY_TOP = "#1f1a38"; // in-between ramp, darkest
const SKY_BOTTOM = "#292734"; // space background
const STARS = ["#c4afcc", "#dcc3f2", "#9b82d4", "#70ace8", "#8fe0f2", "#f0bd68"] as const;
const STAR_WEIGHTS = [5, 4, 3, 1, 1, 1] as const;

function weighted(random: Random) {
  const total = STAR_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = random.random() * total;
  for (let i = 0; i < STARS.length; i++) {
    r -= STAR_WEIGHTS[i]!;
    if (r < 0) return STARS[i]!;
  }
  return STARS[0];
}

function stars(sky: Buffer) {
  const random = new Random(11);
  for (let i = 0; i < 1210; i++) {
    const bright = i >= 1100;
    const x = random.uniform(0, SKY.width);
    const y = random.uniform(0, SKY.height);
    const colour = weighted(random);
    const a = bright ? random.uniform(0.55, 0.95) : random.uniform(0.12, 0.45);
    const sigma = bright ? random.uniform(0.55, 0.8) : random.uniform(0.35, 0.55);
    const spikes = bright && random.random() < 0.35;
    const g = gauss(x, y, sigma, sigma);
    const reach = spikes ? 8 : 3;
    sky.add(colour, [x - reach, y - reach, x + reach, y + reach], (px, py) => {
      let v = g.at(px, py) * a;
      if (spikes) {
        const [dx, dy] = [Math.abs(px - x), Math.abs(py - y)];
        v +=
          0.5 *
          a *
          (Math.exp(-0.5 * (dy / 0.35) ** 2 - dx / 2.2) +
            Math.exp(-0.5 * (dx / 0.35) ** 2 - dy / 2.2));
      }
      return v;
    });
  }
}

// A small tilted two-armed spiral galaxy: log-spiral arms as Gaussian beads, then a core.
function spiral(sky: Buffer, cx: number, cy: number, size: number, tilt: number, rot: number) {
  const random = new Random(5);
  const beads: { x: number; y: number; w: number }[] = [];
  for (let arm = 0; arm < 2; arm++) {
    for (let i = 0; i < 70; i++) {
      const t = i / 69;
      const th = arm * Math.PI + t * 3.4;
      const r = size * (0.12 + 0.88 * t);
      const [u, w] = [r * Math.cos(th), r * Math.sin(th) * tilt];
      beads.push({
        x: cx + u * Math.cos(rot) - w * Math.sin(rot),
        y: cy + u * Math.sin(rot) + w * Math.cos(rot),
        w: (1 - 0.7 * t) * random.uniform(0.6, 1),
      });
    }
  }
  const sigma = size * 0.09;
  const reach = size * 1.2;
  const field = (x: number, y: number) =>
    beads.reduce(
      (sum, b) => sum + b.w * Math.exp((-0.5 * ((x - b.x) ** 2 + (y - b.y) ** 2)) / sigma ** 2),
      0,
    );
  // Normalise by the peak of the bead field on a coarse grid.
  let peak = 0;
  for (let y = cy - reach; y <= cy + reach; y += 1) {
    for (let x = cx - reach; x <= cx + reach; x += 1) peak = Math.max(peak, field(x, y));
  }
  sky.add(
    "#b8c1ff",
    [cx - reach, cy - reach, cx + reach, cy + reach],
    (x, y) => (field(x, y) / peak) * 0.55,
  );
  const core = gauss(cx, cy, size * 0.22, size * 0.22 * tilt, rot);
  sky.add("#dcc3f2", core.window, (x, y) => core.at(x, y) * 0.6);
}

// Play view px to sky canvas px.
const P = (x: number, y: number) => [x + SKY.offset, y] as const;

function phenomena(sky: Buffer) {
  // Andromeda's blue: a tilted spiral under the arc, left of its middle.
  spiral(sky, ...P(290, 126), 26, 0.38, -0.25);
  // Cartwheel's coral: a ring galaxy with a cream nucleus, under the arc, right of its middle.
  const [rx, ry] = P(452, 120);
  const outer = gauss(rx, ry, 15, 6.5, 0.15);
  const inner = gauss(rx, ry, 10, 4.2, 0.15);
  sky.add("#f3b6ac", outer.window, (x, y) => Math.max(0, outer.at(x, y) - inner.at(x, y)) * 0.65);
  const nucleus = gauss(rx, ry, 2.2, 1.6);
  sky.add("#ead4aa", nucleus.window, (x, y) => nucleus.at(x, y) * 0.7);
  // Needle's silver: an edge-on galaxy under the arc, left of Andromeda.
  const needle = gauss(...P(200, 148), 26, 2.2, -0.21);
  sky.add("#cfc5bd", needle.window, (x, y) => needle.at(x, y) * 0.45);
  const bulge = gauss(...P(200, 148), 4, 2.4, -0.21);
  sky.add("#ead4aa", bulge.window, (x, y) => bulge.at(x, y) * 0.45);
  // Phantom's violet nebula in its marker hue with a Whirlpool teal knot, over the arc's left end.
  const cloud = valueNoise(8, SKY.width, SKY.height, 22);
  const nebula = gauss(...P(48, 46), 42, 26, 0.4);
  sky.add("#dcbae3", nebula.window, (x, y) => nebula.at(x, y) * (0.2 + 0.25 * cloud(x, y)));
  const knot = gauss(...P(68, 62), 20, 14, 0.4);
  sky.add("#94d3e3", knot.window, (x, y) => knot.at(x, y) * (0.12 + 0.18 * cloud(x, y)));
  // Whirlpool's teal: a planetary nebula ring with a shimmer core, under Andromeda.
  const ring = gauss(...P(600, 196), 7, 7);
  const hole = gauss(...P(600, 196), 4.6, 4.6);
  sky.add("#94d3e3", ring.window, (x, y) => Math.max(0, ring.at(x, y) - hole.at(x, y)) * 0.7);
  const star = gauss(...P(600, 196), 1.1, 1.1);
  sky.add("#8fe0f2", star.window, (x, y) => star.at(x, y) * 0.9);
  // A comet between Whirlpool and Needle, its tail rising to the right.
  const [hx, hy] = P(470, 30);
  sky.add("#8fe0f2", [hx, hy - 20, hx + 52, hy + 6], (x, y) => {
    const t = (x - hx) / 52;
    if (t < 0 || t > 1) return 0;
    return Math.exp(-0.5 * ((y - (hy - (x - hx) * 0.25)) / (0.8 + 3 * t)) ** 2) * (1 - t) * 0.55;
  });
  const head = gauss(hx, hy, 1.4, 1.4);
  sky.add("#dcc3f2", head.window, (x, y) => head.at(x, y) * 0.9);
  // A star cluster under Phantom, for taller views.
  const random = new Random(4);
  for (let i = 0; i < 26; i++) {
    const s = gauss(...P(128 + 9 * normal(random), 196 + 6 * normal(random)), 0.6, 0.6);
    const a = random.uniform(0.4, 0.9);
    sky.add("#dcc3f2", s.window, (x, y) => s.at(x, y) * a);
  }
}

// A standard normal deviate (Box-Muller) from the seeded generator.
function normal(random: Random) {
  const u = 1 - random.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random.random());
}

// The legs: the arc between consecutive markers.
function legPoints(): (readonly [number, number])[] {
  return Array.from({ length: 1201 }, (_, k) => onArc(-SPAN + (k * 2 * SPAN) / 1200));
}

// The guard's footprint on the sky's pixels: 1 inside a chart mark's keep-out, else 0.
function footprint(width: number, height: number, density: number, pad = 0): Float32Array {
  const mask = new Float32Array(width * height);
  const fill = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    inside: (x: number, y: number) => boolean,
  ) => {
    for (
      let py = Math.max(0, Math.floor(y0 * density));
      py < Math.min(height, Math.ceil(y1 * density));
      py++
    ) {
      for (
        let px = Math.max(0, Math.floor(x0 * density));
        px < Math.min(width, Math.ceil(x1 * density));
        px++
      ) {
        if (inside((px + 0.5) / density, (py + 0.5) / density)) mask[py * width + px] = 1;
      }
    }
  };
  const disc = (cx: number, cy: number, r: number) =>
    fill(cx - r, cy - r, cx + r, cy + r, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r);
  // A stadium: the label pill's keep-out with round ends.
  const stadium = (x0: number, y0: number, x1: number, y1: number) => {
    const r = (y1 - y0) / 2;
    const cy = (y0 + y1) / 2;
    fill(x0, y0, x1, y1, (x, y) => {
      const dx = Math.max(0, x0 + r - x, x - (x1 - r));
      return dx * dx + (y - cy) ** 2 <= r * r;
    });
  };
  const { label, corner } = GUARD;
  for (const [mx, my] of CENTRES.map(([cx, cy]) => P(cx, cy))) {
    disc(mx, my, GUARD.marker + pad);
    stadium(
      mx - label.halfWidth - pad,
      my + label.top - pad,
      mx + label.halfWidth + pad,
      my + label.bottom + pad,
    );
  }
  fill(P(corner.x0, 0)[0] - pad, corner.y0, SKY.width, corner.y1 + pad, () => true);
  for (const [x, y] of legPoints()) disc(...P(x, y), GUARD.leg + pad);
  return mask;
}

// Separable Gaussian blur of a single-channel image, edges clamped.
function blurChannel(values: Float32Array, width: number, height: number, sigma: number) {
  const reach = Math.ceil(sigma * 3);
  const kernel = Array.from({ length: 2 * reach + 1 }, (_, i) =>
    Math.exp(-((i - reach) ** 2) / (2 * sigma * sigma)),
  );
  const sum = kernel.reduce((a, b) => a + b, 0);
  const k = kernel.map((v) => v / sum);
  const tmp = new Float32Array(values.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let v = 0;
      for (let i = -reach; i <= reach; i++)
        v += values[y * width + Math.min(width - 1, Math.max(0, x + i))]! * k[i + reach]!;
      tmp[y * width + x] = v;
    }
  }
  const out = new Float32Array(values.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let v = 0;
      for (let i = -reach; i <= reach; i++)
        v += tmp[Math.min(height - 1, Math.max(0, y + i)) * width + x]! * k[i + reach]!;
      out[y * width + x] = v;
    }
  }
  return out;
}

// Caps the sky's luminance at GUARD.cap inside the footprint, feathered by a Gaussian, then
// fails if any footprint pixel is still above the cap.
function guard(sky: Buffer) {
  const { width, height, density } = sky;
  // The cap feathers out from a footprint grown by two sigmas, so it is whole on the marks.
  const mask = footprint(width, height, density);
  const soft = blurChannel(
    footprint(width, height, density, 2 * GUARD.sigma),
    width,
    height,
    GUARD.sigma * density,
  );
  for (let i = 0; i < width * height; i++) {
    const m = Math.min(1, soft[i]! * GUARD.gain);
    if (m <= 0) continue;
    const [r, g, b] = [sky.data[i * 3]!, sky.data[i * 3 + 1]!, sky.data[i * 3 + 2]!];
    const L = luminance(r, g, b);
    if (L <= GUARD.cap) continue;
    const scale = GUARD.cap / L;
    for (let k = 0; k < 3; k++) {
      const v = sky.data[i * 3 + k]!;
      sky.data[i * 3 + k] = v * (1 - m) + srgb(linear(v) * scale) * m;
    }
  }
  for (let i = 0; i < width * height; i++) {
    if (mask[i] === 0) continue;
    const L = luminance(sky.data[i * 3]!, sky.data[i * 3 + 1]!, sky.data[i * 3 + 2]!);
    // The byte rounding of a capped pixel stays within 2% of the cap.
    if (L > GUARD.cap * 1.02) {
      throw new Error(
        `route-sky: luminance ${L.toFixed(4)} behind a chart mark at ${i % width},${Math.floor(i / width)}`,
      );
    }
  }
}

export function routeSky(): RgbaImage {
  const sky = new Buffer(SKY.width * SKY.density, SKY.height * SKY.density, SKY.density);
  const [top, bottom] = [rgb(SKY_TOP), rgb(SKY_BOTTOM)].map((c) => c.map((v) => v / 255));
  for (let py = 0; py < sky.height; py++) {
    const t = py / (sky.height - 1);
    for (let px = 0; px < sky.width; px++) {
      for (let k = 0; k < 3; k++)
        sky.data[(py * sky.width + px) * 3 + k] = top![k]! * (1 - t) + bottom![k]! * t;
    }
  }
  // The Milky Way: a lavender band from the upper left, with a dust lane along it.
  const coarse = valueNoise(3, SKY.width, SKY.height, 30);
  const fine = valueNoise(6, SKY.width, SKY.height, 13);
  const band = (x: number, y: number) => 0.65 * coarse(x, y) + 0.35 * fine(x, y);
  const line = (x: number) => 0.34 * (x - SKY.offset) + 40;
  sky.add("#5f4fa3", [0, 0, SKY.width, SKY.height], (x, y) => {
    const d = (y - line(x)) / 42;
    return d * d > 16 ? 0 : Math.exp(-0.5 * d * d) * (0.1 + 0.18 * band(x, y));
  });
  sky.over(SKY_TOP, (x, y) => Math.exp(-0.5 * ((y - line(x) - 6) / 7) ** 2) * 0.55 * band(x, y));
  stars(sky);
  phenomena(sky);
  guard(sky);
  return sky.toImage();
}

/* The ground */

const AFTERGLOW = "#d68b72"; // space palette obstacle coral
const RIM = "#f0bd68"; // space palette weapon amber
const GRASS = { near: "#293a2c", far: "#3d5638", tip: "#86a65e" } as const;

export function routeGround(): RgbaImage {
  const d = GROUND.density;
  const [w, h] = [GROUND.width * d, GROUND.height * d];
  const ground = new Buffer(w, h, d);
  const alpha = new Float32Array(w * h);
  const random = new Random(9);
  const tufts = Array.from({ length: Math.round(GROUND.width / 5) }, () => ({
    x: random.uniform(-10, GROUND.width + 10),
    height: random.uniform(2, 6),
  }));
  // The sunset sits left of the play view, where the warm light comes from.
  const sun = (x: number) => Math.exp(-0.5 * ((x - (SKY.offset - 40)) / 260) ** 2);
  const edge = (x: number) => GROUND.grass + 3 * Math.sin(x / 47) + 2 * Math.sin(x / 13 + 1.3);
  const tuft = (x: number) =>
    tufts.reduce((top, t) => Math.max(top, t.height * (1 - Math.abs(x - t.x) / 1.6)), 0);
  const [glow, far, near, tip, rim] = [AFTERGLOW, GRASS.far, GRASS.near, GRASS.tip, RIM].map(
    (c) => rgb(c).map((v) => v / 255) as unknown as Rgb,
  );
  const N = 4;
  for (let px = 0; px < w; px++) {
    // 4 by 4 samples per pixel for the grass line's coverage.
    const xs = Array.from({ length: N }, (_, i) => (px + (i + 0.5) / N) / d);
    const tops = xs.map((x) => edge(x) - Math.max(0, tuft(x)));
    const x = (px + 0.5) / d;
    const s = sun(x);
    for (let py = 0; py < h; py++) {
      const y = (py + 0.5) / d;
      let cover = 0;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) if ((py + (j + 0.5) / N) / d > tops[i]!) cover++;
      }
      const grass = cover / (N * N);
      const top = Math.min(...tops);
      const depth = Math.min(1, Math.max(0, (y - edge(x)) / (GROUND.height - GROUND.grass)));
      const lit = y < top + 2 ? 0.45 + 0.45 * s : 0;
      const g = [0, 1, 2].map((k) => {
        const base = far[k]! * (1 - depth) + near[k]! * depth;
        const rimmed = tip[k]! * 0.5 + rim[k]! * 0.5;
        return base * (1 - lit) + rimmed * lit;
      });
      // The afterglow over the sky: coral, rising to 0.28 at the grass line, strongest at the left.
      const t = Math.min(1, Math.max(0, y / GROUND.grass));
      const glowAlpha = t * t * 0.28 * (0.35 + 0.65 * s);
      const i = py * w + px;
      const a = grass + (1 - grass) * glowAlpha;
      alpha[i] = a;
      for (let k = 0; k < 3; k++) {
        ground.data[i * 3 + k] =
          a === 0 ? 0 : (g[k]! * grass + glow[k]! * glowAlpha * (1 - grass)) / a;
      }
    }
  }
  return ground.toImage(alpha);
}

const entry = (id: string, image: RgbaImage, density: number, pivot: { x: number; y: number }) => ({
  id,
  path: `/art/${id}.png`,
  width: image.width,
  height: image.height,
  displayWidth: image.width / density,
  displayHeight: image.height / density,
  facing: "front",
  pivot,
});

if (import.meta.url === `file://${process.argv[1]}`) {
  const sky = routeSky();
  const ground = routeGround();
  writePng(`${art}route-sky.png`, sky, true);
  writePng(`${art}route-ground.png`, ground);
  placeEntries("core", "route-", [
    entry("route-sky", sky, SKY.density, { x: 0.5, y: 0 }),
    {
      ...entry("route-ground", ground, GROUND.density, { x: 0.5, y: 1 }),
      overlays: ["story-ada-skywatch", "story-penny-sitting"],
    },
  ]);
}
