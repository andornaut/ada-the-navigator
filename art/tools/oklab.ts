import { oklabToSrgb, rgb as parseRgb } from "@andornaut/art-kit/build/colour";

// Oklab conversion on sRGB bytes: linear sRGB through the Oklab M1 and M2 matrices, clamped
// and rounded half to even on the way back.
export type Rgb = readonly [number, number, number];

// Generator palettes provide six-digit hexadecimal colours, optionally prefixed with #.
export function rgb(hex: string): Rgb {
  return parseRgb(hex.replace("#", ""));
}

export { srgbToOklab as toOklab } from "@andornaut/art-kit/build/colour";

export function fromOklab(L: number, a: number, b: number): Rgb {
  return oklabToSrgb({ gamut: "clip", rounding: "half-even" }, [L, a, b]);
}

export const hex = (c: Rgb) => `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
