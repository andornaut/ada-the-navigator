import { EDGE_MARKERS } from "../../data/edgeMarkers.ts";
/** Circle-only Penny badge and existing font-body question glyph. */
export const PENNY_MARKER = {
  inset: 24 / 2 + EDGE_MARKERS.gap,
  question: { atlasHeight: 64, atlasWidth: 256, height: 12, width: 9, x: 244, y: 0 },
  size: 24,
} as const;
