// Smooth-raster helpers for painted backgrounds and effects: supersampled shapes drawn with
// art-kit's Pillow-compatible primitives, Lanczos resampling, Gaussian blur and blends.
import { writeFileSync } from "node:fs";

import { ellipse, line, polygon } from "@andornaut/art-kit/draw";
import { encodeRgbaPng, encodeRgbPng } from "@andornaut/art-kit/png";
import type { Rgba } from "@andornaut/art-kit/raster";
import { composite, gaussianBlur, grayscale, resizeLanczos3 } from "@andornaut/art-kit/raster";
import { blankImage, type RgbaImage } from "@andornaut/art-kit/rgbaImage";

export type { RgbaImage };
export type Xy = readonly [number, number];

export function rgba(hex: string, alpha = 255): Rgba {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
    alpha,
  ];
}

export function filled(colour: Rgba, width: number, height: number): RgbaImage {
  const image = blankImage(width, height);
  for (let i = 0; i < width * height; i++) {
    image.data.set(colour, i * 4);
  }
  return image;
}

const at = (points: readonly Xy[]) => points.map(([x, y]) => ({ x, y }));

export function fillPolygon(image: RgbaImage, points: readonly Xy[], colour: Rgba): void {
  polygon({ fill: colour }, at(points), image);
}

export function outlinePolygon(
  image: RgbaImage,
  points: readonly Xy[],
  colour: Rgba,
  outline: Rgba,
  width: number,
): void {
  polygon({ fill: colour, outline, width }, at(points), image);
}

export function fillEllipse(
  image: RgbaImage,
  [x0, y0, x1, y1]: readonly [number, number, number, number],
  colour: Rgba,
): void {
  ellipse({ fill: colour }, { x0, y0, x1: Math.max(x0, x1), y1: Math.max(y0, y1) }, image);
}

export function disc(image: RgbaImage, [x, y]: Xy, r: number, colour: Rgba, ry = r): void {
  fillEllipse(image, [x - r, y - ry, x + r, y + ry], colour);
}

// A polyline; `joints` rounds the inner joints of lines wider than 4 like Pillow's "curve".
export function polyline(
  image: RgbaImage,
  points: readonly Xy[],
  colour: Rgba,
  width: number,
  joints = false,
): void {
  line({ fill: colour, width }, at(points), image);
  if (joints && width > 4) {
    for (const [x, y] of points.slice(1, -1)) {
      fillEllipse(
        image,
        [x - width / 2 + 1, y - width / 2 + 1, x + width / 2 - 1, y + width / 2 - 1],
        colour,
      );
    }
  }
}

// Filled rounded rectangle; with `ring`, only the band `ring` px inside its edge.
export function roundedRect(
  image: RgbaImage,
  [x0, y0, x1, y1]: readonly [number, number, number, number],
  radius: number,
  colour: Rgba,
  ring = 0,
): void {
  const inside = (x: number, y: number, inset: number) => {
    const r = Math.max(0, radius - inset);
    const ax = x0 + inset;
    const ay = y0 + inset;
    const bx = x1 - inset;
    const by = y1 - inset;
    if (x < ax || x > bx || y < ay || y > by) {
      return false;
    }
    const dx = x < ax + r ? ax + r - x : x > bx - r ? x - (bx - r) : 0;
    const dy = y < ay + r ? ay + r - y : y > by - r ? y - (by - r) : 0;
    return dx * dx + dy * dy <= r * r;
  };
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(image.height - 1, Math.ceil(y1)); y++) {
    for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(image.width - 1, Math.ceil(x1)); x++) {
      if (inside(x, y, 0) && !(ring > 0 && inside(x, y, ring))) {
        image.data.set(colour, (y * image.width + x) * 4);
      }
    }
  }
}

export function over(target: RgbaImage, source: RgbaImage, x = 0, y = 0): void {
  composite({ x, y }, source, target);
}

// Region of an image, with pixels outside it clear.
export function region(source: RgbaImage, x: number, y: number, width: number, height: number) {
  const out = blankImage(width, height);
  for (let row = 0; row < height; row++) {
    const sy = y + row;
    if (sy < 0 || sy >= source.height) {
      continue;
    }
    for (let col = 0; col < width; col++) {
      const sx = x + col;
      if (sx >= 0 && sx < source.width) {
        out.data.set(
          source.data.subarray((sy * source.width + sx) * 4, (sy * source.width + sx) * 4 + 4),
          (row * width + col) * 4,
        );
      }
    }
  }
  return out;
}

// Generator callers provide positive integer image sizes.
export function resize(source: RgbaImage, width: number, height: number): RgbaImage {
  return resizeLanczos3(width, height, source);
}

// Generator callers use finite positive sigma. Blur the expanded ROI with repeated edges;
// replace its raw RGBA bytes in place and leave pixels outside it unchanged.
export function blur(
  image: RgbaImage,
  sigma: number,
  bounds: readonly [number, number, number, number] = [0, 0, image.width, image.height],
): void {
  const reach = Math.ceil(sigma * 3);
  const x0 = Math.max(0, Math.floor(bounds[0]) - reach);
  const y0 = Math.max(0, Math.floor(bounds[1]) - reach);
  const x1 = Math.min(image.width, Math.ceil(bounds[2]) + reach);
  const y1 = Math.min(image.height, Math.ceil(bounds[3]) + reach);
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 || h <= 0) {
    return;
  }
  const out = gaussianBlur({ sigma }, region(image, x0, y0, w, h));
  for (let row = 0; row < h; row++) {
    image.data.set(
      out.data.subarray(row * w * 4, (row + 1) * w * 4),
      ((row + y0) * image.width + x0) * 4,
    );
  }
}

// a toward b by t per channel, truncated like Pillow's Image.blend.
export function blend(a: RgbaImage, b: RgbaImage, t: number): RgbaImage {
  const out = blankImage(a.width, a.height);
  for (let i = 0; i < a.data.length; i++) {
    out.data[i] = Math.min(
      255,
      Math.max(0, Math.trunc(a.data[i]! + t * (b.data[i]! - a.data[i]!))),
    );
  }
  return out;
}

// ITU-R 601-2 luma, as Pillow's convert("L").
export function grey(source: RgbaImage): RgbaImage {
  const plane = grayscale(source);
  const out = blankImage(source.width, source.height);
  for (let i = 0; i < plane.data.length; i++) {
    const l = plane.data[i]!;
    out.data.set([l, l, l, 255], i * 4);
  }
  return out;
}

const PNG = { deflateLevel: 9, deflateStrategy: 0, filterType: -1 };

// Opaque images drop the alpha channel.
export function writePng(path: string, image: RgbaImage, opaque = false): void {
  writeFileSync(path, opaque ? encodeRgbPng(PNG, image) : encodeRgbaPng(PNG, image));
}
