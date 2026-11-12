import type { EnemyArchetype } from "./enemy-catalog.ts";

// Edge markers (gameplay/rules.md "Space encounters and feedback"): where seen off-screen
// enemies, heavies and stations are, at the game area's edge.

/** The three marker kinds, each with its own look. */
export type EdgeMarkerKind = "enemy" | "heavy" | "station";

export const EDGE_MARKERS = {
  /** The marker's centre sits this many logical px in from the game area's border. */
  inset: 8,
  /** A marked object past this many world units from Ada is forgotten, for every kind. */
  range: 1400,
} as const;

/**
 * Each kind's glyph in logical px: a filled disc for enemies and heavies, an unfilled diamond
 * with a 2 stroke inside its extent for stations.
 */
export const EDGE_MARKER_GLYPHS = {
  enemy: { disc: 6 },
  heavy: { disc: 10 },
  station: { diamond: 10, stroke: 2 },
} as const;

/** The enemy and heavy discs' red. Placeholder until the space palette's threat role. */
export const EDGE_MARKER_THREAT_PLACEHOLDER = 0xff6b6b;

/**
 * A light field's ink outline around each glyph, in logical px: a disc over an ink disc this much
 * larger in radius, the diamond over an ink stroke this much wider on each side. Placeholder until
 * the light field's markerOutline.
 */
export const EDGE_MARKER_OUTLINE_PLACEHOLDER = 1;

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
