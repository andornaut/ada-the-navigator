import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Shared generator colours as six lowercase hex digits without "#".
const space = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../public/art/space-palette.json", import.meta.url)),
    "utf8",
  ),
) as { colors: Record<string, string>; inBetween: { ramp: string[]; shimmer: string } };
const hex = (colour: string) => colour.slice(1).toLowerCase();

export const INK = "181425";

// The colour that must meet a signal's contrast floor on a field. On a light field (`tint.light`)
// Tech draws the ink keyline under every keylined object and destination, so the keyline meets
// the floor and the fill stays as drawn (art/galaxies.md "Light fields"); on a dark field the
// fill itself must.
export const floorColour = (light: boolean, fill: string): string => (light ? `#${INK}` : fill);
export const SPACE_BG = hex(space.colors.background!);
// The in-between dimension, darkest to lightest, and its cool sparkle.
export const IN_BETWEEN = space.inBetween.ramp.map(hex) as [string, string, string, string, string];
export const SHIMMER = hex(space.inBetween.shimmer);

// 4 by 4 ordered-dither thresholds, 0 to 15.
export const BAYER: readonly (readonly number[])[] = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
