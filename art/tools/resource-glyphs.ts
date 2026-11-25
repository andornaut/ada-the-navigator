import type { Frame } from "@andornaut/art-kit/build/grid";

import { ORE_PALETTE, rimmed } from "./ore.ts";
import { INK } from "./palette.ts";

export const PICKUP_SIZE = 9;

export const STARDUST_PALETTE = {
  W: "ffffff",
  L: "fff2cc",
  M: "f4d98a",
  D: "c8a24e",
} as const;

function frame(palette: Readonly<Record<string, string>>, rows: readonly string[]): Frame {
  return rows.map((row) => [...row].map((cell) => palette[cell] ?? null));
}

// The idle four-point star is the common world and UI glyph.
export const STARDUST_REST = frame(STARDUST_PALETTE, [
  "....M....",
  "....M....",
  "...MLD...",
  "..MLWLD..",
  "MMLWWWLDD",
  "..DLWLD..",
  "...DLD...",
  "....D....",
  "....D....",
]);

// A matte ore nugget with the same palette and rim as loose ore in flight: a lit upper-left
// facet, a crease down its crown and one shade facet to the lower right.
export const ORE_PICKUP = frame(
  ORE_PALETTE,
  rimmed([
    "..LL.....",
    ".LLMMS...",
    "LLLMSMS..",
    "LMMMSMMS.",
    ".MMMMMSSD",
    "LMMMSSSDD",
    ".MMMSSSDD",
    "..SDSSDD.",
    "....DD...",
  ]),
);

// Sample the same glyph at the UI's size, reserving one pixel for its permanent ink keyline.
export function resourceIcon(glyph: Frame, size: 16 | 20): Frame {
  const sample = (index: number) => Math.floor(((index - 0.5) * PICKUP_SIZE) / (size - 2));
  const pixels = Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => glyph[sample(y)]?.[sample(x)] ?? null),
  );
  return pixels.map((row, y) =>
    row.map((cell, x) => {
      if (cell !== null) return cell;
      const touchesGlyph = pixels
        .slice(Math.max(0, y - 1), y + 2)
        .some((near) => near.slice(Math.max(0, x - 1), x + 2).some((pixel) => pixel !== null));
      return touchesGlyph ? INK : null;
    }),
  );
}
