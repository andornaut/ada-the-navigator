// Ada's draw order among the objects she flies through. Play objects sort by pivot screen y
// (playDepth); while Ada's drawn bounds overlap a fly-through object's, she draws above it, so
// she is never hidden. Solid objects (rocks, enemies, debris) keep the plain sort: Ada never
// overlaps them.

/** A drawn rectangle in screen px. */
export interface DrawnBox {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
}

/** What a sprite's drawn rectangle is read from: its pivot, display size and origin. */
export interface Placed {
  readonly displayHeight: number;
  readonly displayWidth: number;
  readonly originX: number;
  readonly originY: number;
  readonly x: number;
  readonly y: number;
}

/** A fly-through object's drawn rectangle and Phaser depth this frame. */
export interface PassableDraw {
  readonly box: DrawnBox;
  readonly depth: number;
}

/**
 * Ada's layers below her hull, by depth offset: her jets, the jets' and hull's keylines, then
 * her tow line. A lift clears the lowest of them.
 */
export const ADA_LAYERS = { jetKeyline: -2e-6, jets: -1e-6, towLine: -3e-6 } as const;

// Above an overlapped object and its parts (1e-7 apart) with Ada's lowest layer still above it.
const LIFT = 5e-6;

/**
 * The edge markers' layer (model/edge-markers.ts): above every play object, Ada at her highest
 * lift, the shots and indicators (3) and the destruction flash (4). The HTML HUD stays above the
 * canvas.
 */
export const EDGE_MARKER_DEPTH = 5;

/**
 * The Use callout's layer (art/destinations.md "Use callout"): in front of every play object, the
 * shots, indicators and destruction flash, behind the edge markers and the HUD.
 */
export const USE_CALLOUT_DEPTH = 4.5;

/** A sprite's drawn rectangle from its pivot, display size and origin. */
export function drawnBox(sprite: Placed): DrawnBox {
  const left = sprite.x - sprite.originX * sprite.displayWidth;
  const top = sprite.y - sprite.originY * sprite.displayHeight;
  return {
    bottom: top + sprite.displayHeight,
    left,
    right: left + sprite.displayWidth,
    top,
  };
}

/** The smallest rectangle holding a box and points, such as Ada's hull and her jet flames. */
export function boxWith(box: DrawnBox, points: readonly { x: number; y: number }[]): DrawnBox {
  return points.reduce<DrawnBox>(
    (held, point) => ({
      bottom: Math.max(held.bottom, point.y),
      left: Math.min(held.left, point.x),
      right: Math.max(held.right, point.x),
      top: Math.min(held.top, point.y),
    }),
    box,
  );
}

/** Whether two drawn rectangles share any area. */
export function overlaps(a: DrawnBox, b: DrawnBox): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/**
 * Ada's hull depth: her own pivot depth, or just above the frontmost fly-through object her
 * drawn bounds overlap, whichever is higher. Objects she does not overlap keep their sort, so one
 * further forward still draws in front of her.
 */
export function adaDepth(
  passable: readonly PassableDraw[],
  ada: DrawnBox,
  pivotDepth: number,
): number {
  return passable.reduce(
    (depth, drawn) => (overlaps(ada, drawn.box) ? Math.max(depth, drawn.depth + LIFT) : depth),
    pivotDepth,
  );
}

/**
 * The backdrop layers (art/backdrop.md), back to front over the field's background fill: the sky
 * (L0), the fixed layers (Andromeda's haze, Needle's band), far items and planets (L2), the
 * plates (L1, multiply then screen), the stars (L3) and the dust streaks (L4); then the backdrop
 * rocks (-1), the landmarks, the dust specks on the field ink (0) and every play object.
 */
export const BACKDROP_DEPTH = {
  far: -2.7,
  fixed: -2.8,
  multiply: -2.5,
  planets: -2.6,
  screen: -2.4,
  sky: -2.9,
  stars: -2.3,
  streaks: -2.2,
} as const;
