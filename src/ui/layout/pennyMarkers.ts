import { MAP_SYMBOL } from "./mapScreen.ts";

/** Circle-only Penny badge and existing font-body question glyph. */
export const PENNY_MARKER = {
  inset: MAP_SYMBOL.chip / 2 + 14,
  question: { atlasHeight: 64, atlasWidth: 256, height: 12, width: 9, x: 244, y: 0 },
  size: 24,
} as const;
