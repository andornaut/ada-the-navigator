import type { EnemyActorKind } from "./enemyActors.ts";
import { TARGET_MARKER_RANGE } from "./targetMarkers.ts";

// Edge markers (gameplay/rules.md "Space encounters and feedback"): where seen off-screen
// enemies, heavies, route guards and stations are, at the game area's edge.

/** Marker kinds retain each actor's native identity. */
export type EdgeMarkerKind = "enemy" | "guard" | "heavy" | "hostileStation" | "station";

export const EDGE_MARKERS = {
  /**
   * The marker's outermost drawn pixel, its light-field outline included, sits this far inside
   * the safe game area (safeGameArea).
   */
  gap: 1,
  /** Compatibility view of the shared ordinary range; leaving range hides without forgetting. */
  range: TARGET_MARKER_RANGE,
} as const;

/**
 * Each kind's glyph in logical px (art/space-palette.md "Edge markers"): a filled disc for
 * enemies, heavies, guards and hostile stations, in the space palette's threat, the guard's with
 * an ink bar across its centre and a hostile station's the heavy's disc; an unfilled diamond with
 * a 2 stroke inside its extent for stations, in pointOfInterest. A field with foreground edges
 * outlines each in its edge colour (lightField.markerOutline), ink on a light field and white on
 * Phantom; the guard's bar adds none.
 */
export const EDGE_MARKER_GLYPHS = {
  enemy: { disc: 6 },
  guard: { bar: { height: 2, width: 7 }, disc: 12 },
  heavy: { disc: 12 },
  hostileStation: { disc: 12 },
  station: { diamond: 12, stroke: 2 },
} as const;

/**
 * How far in from the game area's edge a marker's centre sits: half its glyph's drawn extent,
 * plus the `outline` drawn around it (0 on a field without foreground edges), plus
 * EDGE_MARKERS.gap.
 */
export function edgeMarkerInset(outline: number, kind: EdgeMarkerKind): number {
  const glyph: { readonly diamond?: number; readonly disc?: number } = EDGE_MARKER_GLYPHS[kind];
  return (glyph.disc ?? glyph.diamond ?? 0) / 2 + outline + EDGE_MARKERS.gap;
}

/**
 * The kind an enemy's marker takes while it still blocks a route, in place of its archetype's:
 * a heavy guarding a route is a guard until it is disabled.
 */
export const BLOCKING_MARKER_KINDS: Readonly<Partial<Record<EdgeMarkerKind, EdgeMarkerKind>>> = {
  heavy: "guard",
};

/** Each enemy archetype's kind: the large ships are heavies, every other enemy an enemy. */
export const ENEMY_MARKER_KINDS: Readonly<Record<EnemyActorKind, EdgeMarkerKind>> = {
  capital: "heavy",
  fighter: "enemy",
  frigate: "heavy",
  hostileStation: "hostileStation",
  interceptor: "enemy",
  platform: "heavy",
  retaliator: "enemy",
  swarm: "enemy",
};
