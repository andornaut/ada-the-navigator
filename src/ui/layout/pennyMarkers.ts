import { MAP_SYMBOL } from "./mapScreen.ts";

/** Existing map chip and font-body question glyph, with the indicator's triangle geometry. */
export const PENNY_MARKER = {
  arrow: { base: -5, height: 12, offset: MAP_SYMBOL.chip / 2 + 4, stroke: 2, tip: 8, width: 15 },
  inset: MAP_SYMBOL.chip / 2 + 14,
  question: { atlasHeight: 64, atlasWidth: 256, height: 12, width: 9, x: 244, y: 0 },
  size: MAP_SYMBOL.chip,
} as const;
