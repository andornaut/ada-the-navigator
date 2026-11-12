import type { EnemyArchetype } from "./enemy-catalog.ts";

// Edge markers (gameplay/rules.md "Space encounters and feedback"): where seen off-screen
// enemies, heavies and stations are, at the game area's edge.

/** The three marker kinds, each with its own look. */
export type EdgeMarkerKind = "enemy" | "heavy" | "station";

export const EDGE_MARKERS = {
  /** The marker's outermost drawn pixel, its light-field outline included, sits this far in. */
  gap: 1,
  /** A marked object past this many world units from Ada is forgotten, for every kind. */
  range: 1400,
} as const;

/**
 * Each kind's glyph in logical px: a filled disc for enemies and heavies, in the space palette's
 * threat, an unfilled diamond with a 2 stroke inside its extent for stations, in pointOfInterest.
 * A light field outlines each in ink (lightField.markerOutline).
 */
export const EDGE_MARKER_GLYPHS = {
  enemy: { disc: 6 },
  heavy: { disc: 10 },
  station: { diamond: 10, stroke: 2 },
} as const;

/**
 * How far in from the game area's edge a marker's centre sits: half its glyph's drawn extent,
 * plus the ink `outline` drawn around it (0 on a dark field), plus EDGE_MARKERS.gap.
 */
export function edgeMarkerInset(outline: number, kind: EdgeMarkerKind): number {
  const glyph: { readonly diamond?: number; readonly disc?: number } = EDGE_MARKER_GLYPHS[kind];
  return (glyph.disc ?? glyph.diamond ?? 0) / 2 + outline + EDGE_MARKERS.gap;
}

/** Each enemy archetype's kind: the large ships are heavies, every other enemy an enemy. */
export const ENEMY_MARKER_KINDS: Readonly<Record<EnemyArchetype, EdgeMarkerKind>> = {
  capital: "heavy",
  fighter: "enemy",
  frigate: "heavy",
  interceptor: "enemy",
  platform: "heavy",
  retaliator: "enemy",
  swarm: "enemy",
};
