// Isometric dioramas for the storybook backgrounds: convex solids in model units, flat-shaded in
// Oklab, painted back to front, supersampled, then muted by treatment d (blur, desaturation and
// a haze that thickens toward the story panel).
//
// Positions are design px: the 844 by 390 design frame is 779 by 360 logical px, the view of an
// 844 by 390 phone. A canvas maps its output pixels onto that frame and extends past it.
import { writeFileSync } from "node:fs";

import { polygon } from "@andornaut/art-kit/draw";
import { encodeRgbPng } from "@andornaut/art-kit/png";
import { blankImage, type RgbaImage } from "@andornaut/art-kit/rgbaImage";

import { fromOklab, type Rgb, rgb, toOklab } from "./oklab.ts";
import { type Point, projectAt } from "./projection.ts";

export type { Point, Rgb, RgbaImage };
export { rgb };
export type Face = readonly Point[];

export const DESIGN = { width: 844, height: 390 } as const;
// Logical px per design px.
const LOGICAL_PER_DESIGN = 360 / 390;
const SS = 2;
export const R3 = Math.sqrt(3) / 2;

export interface Canvas {
  // Logical size, centred on the design frame, and output px per logical px.
  width: number;
  height: number;
  density: number;
}

interface View {
  width: number;
  height: number;
  // Output px per design px, and the design px at the output's top-left corner.
  scale: number;
  x0: number;
  y0: number;
}

function view({ density, height, width }: Canvas, supersample = 1): View {
  return {
    height: height * density * supersample,
    scale: density * supersample * LOGICAL_PER_DESIGN,
    width: width * density * supersample,
    x0: DESIGN.width / 2 - width / 2 / LOGICAL_PER_DESIGN,
    y0: DESIGN.height / 2 - height / 2 / LOGICAL_PER_DESIGN,
  };
}

// Ramp position of an output row on the design frame's height, held at both ends past it.
function rampAt(v: View, y: number): number {
  return Math.min(1, Math.max(0, (v.y0 + (y + 0.5) / v.scale) / DESIGN.height));
}

function shade(material: string, dl: number): Rgb {
  const [L, a, b] = toOklab(rgb(material));
  return fromOklab(L + dl, a, b);
}

/* Solids: each a list of planar faces of one convex body */

export function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  return [
    [
      [x0, y0, z1],
      [x1, y0, z1],
      [x1, y1, z1],
      [x0, y1, z1],
    ],
    [
      [x0, y0, z0],
      [x0, y1, z0],
      [x1, y1, z0],
      [x1, y0, z0],
    ],
    [
      [x1, y0, z0],
      [x1, y1, z0],
      [x1, y1, z1],
      [x1, y0, z1],
    ],
    [
      [x0, y0, z0],
      [x0, y0, z1],
      [x0, y1, z1],
      [x0, y1, z0],
    ],
    [
      [x0, y1, z0],
      [x0, y1, z1],
      [x1, y1, z1],
      [x1, y1, z0],
    ],
    [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y0, z1],
      [x0, y0, z1],
    ],
  ] as Face[];
}

function ring(cx: number, cy: number, r: number, n: number, z: number, rot: number, sy = 1) {
  return Array.from({ length: n }, (_, i): Point => {
    const a = rot + (2 * Math.PI * i) / n;
    return [cx + r * Math.cos(a), cy + sy * r * Math.sin(a), z];
  });
}

// A flat ring of n points: rugs, ponds, holes and the rock's glow line.
export function octagon(cx: number, cy: number, r: number, z: number, n = 8, rot = 0.39, sy = 1) {
  return ring(cx, cy, r, n, z, rot, sy);
}

export function frustum(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  n: number,
  z0: number,
  z1: number,
  rot = 0,
): Face[] {
  const a = ring(cx, cy, r0, n, z0, rot);
  const b = ring(cx, cy, r1, n, z1, rot);
  return [b, a, ...a.map((p, i) => [p, a[(i + 1) % n]!, b[(i + 1) % n]!, b[i]!])];
}

export const prism = (cx: number, cy: number, r: number, n: number, z0: number, z1: number) =>
  frustum(cx, cy, r, r, n, z0, z1);

export function gable(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  const ym = (y0 + y1) / 2;
  return [
    [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, ym, z1],
      [x0, ym, z1],
    ],
    [
      [x0, y1, z0],
      [x0, ym, z1],
      [x1, ym, z1],
      [x1, y1, z0],
    ],
    [
      [x0, y0, z0],
      [x0, ym, z1],
      [x0, y1, z0],
    ],
    [
      [x1, y0, z0],
      [x1, y1, z0],
      [x1, ym, z1],
    ],
    [
      [x0, y0, z0],
      [x0, y1, z0],
      [x1, y1, z0],
      [x1, y0, z0],
    ],
  ] as Face[];
}

// A convex slab under a planar quad (the slide).
export function slab(top: Face, dz: number): Face[] {
  const bottom = top.map(([x, y, z]): Point => [x, y, z - dz]);
  return [
    top,
    [...bottom].reverse(),
    ...top.map((p, i) => [
      p,
      bottom[i]!,
      bottom[(i + 1) % top.length]!,
      top[(i + 1) % top.length]!,
    ]),
  ];
}

// Decals on a plane facing +x, +y or +z.
export const onX = (x: number, y0: number, y1: number, z0: number, z1: number): Face => [
  [x, y0, z0],
  [x, y1, z0],
  [x, y1, z1],
  [x, y0, z1],
];
export const onY = (y: number, x0: number, x1: number, z0: number, z1: number): Face => [
  [x0, y, z0],
  [x0, y, z1],
  [x1, y, z1],
  [x1, y, z0],
];
export const onZ = (z: number, x0: number, x1: number, y0: number, y1: number): Face => [
  [x0, y0, z],
  [x1, y0, z],
  [x1, y1, z],
  [x0, y1, z],
];

function newell(face: Face): Point {
  let [nx, ny, nz] = [0, 0, 0];
  for (const [i, a] of face.entries()) {
    const b = face[(i + 1) % face.length]!;
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return [nx, ny, nz];
}

/* Scene */

export type Decal = readonly [Face, string];
type Painted = readonly [Face, Rgb];

export interface Glow {
  at: Point;
  // Radius in model units, colour and peak alpha.
  radius: number;
  colour: Rgb;
  peak: number;
}

export class Scene {
  readonly k: number;
  readonly pivot: readonly [number, number];
  readonly layers: [number, readonly Painted[]][][] = [[], [], []];
  readonly glows: Glow[] = [];

  // k: design px per model unit; pivot: design px of the model origin.
  constructor(k: number, pivot: readonly [number, number]) {
    this.k = k;
    this.pivot = pivot;
  }

  // Faces facing the viewer at +(1, 1, 1) take the material shaded by their +x and +y normal;
  // decals paint over them. Layers draw in order, solids in a layer by ascending key.
  solid(faces: readonly Face[], material: string, layer = 2, key?: number, decals: Decal[] = []) {
    const points = faces.flat();
    const c = [0, 1, 2].map((i) => points.reduce((s, p) => s + p[i]!, 0) / points.length);
    const out: Painted[] = [];
    for (const face of faces) {
      let n = newell(face);
      const fc = [0, 1, 2].map((i) => face.reduce((s, p) => s + p[i]!, 0) / face.length);
      if (n.reduce((s, v, i) => s + v * (fc[i]! - c[i]!), 0) < 0) {
        n = [-n[0], -n[1], -n[2]];
      }
      if (n[0] + n[1] + n[2] <= 1e-6) continue;
      const length = Math.hypot(...n) || 1;
      const nx = Math.max(0, n[0] / length);
      const ny = Math.max(0, n[1] / length);
      out.push([face, shade(material, -0.07 * nx - 0.13 * ny)]);
    }
    for (const [face, colour] of decals) out.push([face, rgb(colour)]);
    this.layers[layer]!.push([key ?? c[0]! + c[1]! + c[2]! * 0.5, out]);
  }

  // Design px of a model point.
  project([x, y, z]: Point): [number, number] {
    return projectAt(this.pivot[0], this.pivot[1], [this.k * x, this.k * y, this.k * z]);
  }
}

// The scene on the canvas over a vertical backdrop ramp, supersampled and box-downsampled,
// with glows composited over the solids.
export function render(canvas: Canvas, backdrop: readonly [string, string], scene: Scene) {
  const big = view(canvas, SS);
  const image = blankImage(big.width, big.height);
  const [top, bottom] = backdrop.map(rgb) as [Rgb, Rgb];
  const row = new Uint8Array(big.width * 4);
  for (let y = 0; y < big.height; y++) {
    const t = rampAt(big, y);
    const c = [0, 1, 2, 3].map((i) =>
      i === 3 ? 255 : Math.round(top[i]! + (bottom[i]! - top[i]!) * t),
    );
    for (let x = 0; x < big.width; x++) row.set(c, x * 4);
    image.data.set(row, y * big.width * 4);
  }
  const at = (p: Point) => {
    const [dx, dy] = scene.project(p);
    return { x: (dx - big.x0) * big.scale, y: (dy - big.y0) * big.scale };
  };
  for (const layer of scene.layers) {
    for (const [, faces] of [...layer].sort((a, b) => a[0] - b[0])) {
      for (const [face, [r, g, b]] of faces) polygon({ fill: [r, g, b, 255] }, face.map(at), image);
    }
  }
  const out = downsample(SS, image);
  const v = view(canvas);
  for (const glow of scene.glows) {
    const [dx, dy] = scene.project(glow.at);
    addGlow(
      out,
      (dx - v.x0) * v.scale,
      (dy - v.y0) * v.scale,
      glow.radius * scene.k * v.scale,
      glow,
    );
  }
  return out;
}

function downsample(factor: number, source: RgbaImage): RgbaImage {
  const width = source.width / factor;
  const height = source.height / factor;
  const out = blankImage(width, height);
  const n = factor * factor;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let ch = 0; ch < 4; ch++) {
        let sum = 0;
        for (let j = 0; j < factor; j++) {
          for (let i = 0; i < factor; i++) {
            sum += source.data[((y * factor + j) * source.width + x * factor + i) * 4 + ch]!;
          }
        }
        out.data[(y * width + x) * 4 + ch] = Math.round(sum / n);
      }
    }
  }
  return out;
}

// 32 nested ellipses (height 0.6 of width), alpha rising toward the centre, blurred by a tenth
// of the radius and composited over the image. Colour and alpha blur as separate channels.
function addGlow(image: RgbaImage, cx: number, cy: number, r: number, glow: Glow) {
  const { width, height } = image;
  const rings = 32;
  const alpha = new Float64Array(width * height);
  const cover = new Float64Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rho = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) / 0.6) / r;
      const i = Math.max(1, Math.ceil(rho * rings));
      if (i > rings) continue;
      alpha[y * width + x] = Math.trunc(Math.min(255, glow.peak) * (1 - (i - 1) / rings) ** 1.4);
      cover[y * width + x] = 1;
    }
  }
  const sigma = r / 10;
  boxBlur(sigma, width, height, alpha);
  boxBlur(sigma, width, height, cover);
  for (let i = 0; i < width * height; i++) {
    const a = alpha[i]! / 255;
    if (a <= 0) continue;
    for (let ch = 0; ch < 3; ch++) {
      const src = Math.round(glow.colour[ch]! * cover[i]!);
      image.data[i * 4 + ch] = Math.round(src * a + image.data[i * 4 + ch]! * (1 - a));
    }
  }
}

// Gaussian blur of standard deviation sigma as three extended box passes per axis, with edge
// pixels repeated (Gwosdek et al. 2011, as Pillow's GaussianBlur).
function boxBlur(sigma: number, width: number, height: number, plane: Float64Array) {
  const passes = 3;
  const s2 = (sigma * sigma) / passes;
  const L = Math.sqrt(12 * s2 + 1);
  const l = Math.floor((L - 1) / 2);
  const radius = l + ((2 * l + 1) * (l * (l + 1) - 3 * s2)) / (6 * (s2 - (l + 1) * (l + 1)));
  const edge = Math.floor(radius);
  const inner = 1 / (radius * 2 + 1);
  const outer = (1 - (edge * 2 + 1) * inner) / 2;
  const line = (count: number, get: (i: number) => number, set: (i: number, v: number) => void) => {
    const src = Float64Array.from({ length: count }, (_, i) => get(i));
    const at = (i: number) => src[Math.min(count - 1, Math.max(0, i))]!;
    let sum = 0;
    for (let i = -edge; i <= edge; i++) sum += at(i);
    for (let i = 0; i < count; i++) {
      set(i, sum * inner + (at(i - edge - 1) + at(i + edge + 1)) * outer);
      sum += at(i + edge + 1) - at(i - edge);
    }
  };
  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < height; y++) {
      line(
        width,
        (x) => plane[y * width + x]!,
        (x, v) => (plane[y * width + x] = v),
      );
    }
  }
  for (let pass = 0; pass < passes; pass++) {
    for (let x = 0; x < width; x++) {
      line(
        height,
        (y) => plane[y * width + x]!,
        (y, v) => (plane[y * width + x] = v),
      );
    }
  }
}

/* Treatment d */

export const TREATMENT = {
  // Gaussian blur, design px.
  blur: 1.2,
  desaturate: 0.25,
  haze: "#efe8ef",
  // Haze alpha: top + (bottom - top) * t^2 down the design frame, held past it.
  hazeTop: 0.18,
  hazeBottom: 0.63,
} as const;

export function treatmentD(canvas: Canvas, image: RgbaImage): RgbaImage {
  const { height, width } = image;
  const v = view(canvas);
  const planes = [0, 1, 2].map((ch) =>
    Float64Array.from({ length: width * height }, (_, i) => image.data[i * 4 + ch]!),
  );
  for (const plane of planes) boxBlur(TREATMENT.blur * v.scale, width, height, plane);
  const haze = rgb(TREATMENT.haze);
  const out = blankImage(width, height);
  for (let y = 0; y < height; y++) {
    const t = rampAt(v, y);
    const a = Math.trunc(
      255 * (TREATMENT.hazeTop + (TREATMENT.hazeBottom - TREATMENT.hazeTop) * t * t),
    );
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const c = planes.map((p) => Math.min(255, Math.max(0, Math.round(p[i]!))));
      // ITU-R 601-2 luma, as Pillow's "L" conversion.
      const luma = (c[0]! * 19595 + c[1]! * 38470 + c[2]! * 7471 + 0x8000) >> 16;
      for (let ch = 0; ch < 3; ch++) {
        const muted = c[ch]! + (luma - c[ch]!) * TREATMENT.desaturate;
        out.data[i * 4 + ch] = Math.round((haze[ch]! * a + muted * (255 - a)) / 255);
      }
      out.data[i * 4 + 3] = 255;
    }
  }
  return out;
}

const PNG = { deflateLevel: 9, deflateStrategy: 0, filterType: -1 };

export function writePng(path: string, image: RgbaImage): void {
  writeFileSync(path, encodeRgbPng(PNG, image));
}
