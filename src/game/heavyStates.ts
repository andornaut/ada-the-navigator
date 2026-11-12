import type { EnemyState } from "../model/enemyAi.ts";
import type { PartSprite } from "./enemyArt.ts";

// Which heavy shows the Disabled banner, and a salvaged heavy's dimming (art/heavies.md
// "States"), for the scene to draw.

/** A salvaged heavy mixes each colour this far toward its Rec. 601 grey, then draws at `alpha`. */
export const SALVAGED = { alpha: 0.6, grey: 0.85 } as const;

/** Rec. 601 luma weights. */
const LUMA = [0.299, 0.587, 0.114] as const;

/** Whether a heavy shows the Disabled banner: disabled and not yet salvaged. */
export function showsBanner(enemy: Pick<EnemyState, "disabled" | "salvaged">): boolean {
  return enemy.disabled && !enemy.salvaged;
}

/**
 * The salvaged grey as a 4 x 5 row-major colour matrix (Phaser's ColorMatrix): each channel
 * `c` becomes `c + grey (L - c)` with `L` the Rec. 601 grey; alpha is unchanged.
 */
export function salvagedMatrix(grey = SALVAGED.grey): number[] {
  const rows = [0, 1, 2].flatMap((channel) => [
    ...LUMA.map((weight, index) => grey * weight + (index === channel ? 1 - grey : 0)),
    0,
    0,
  ]);
  return [...rows, 0, 0, 0, 1, 0];
}

/** An RGB colour (0 to 255 each) through the salvaged grey, for checks against the matrix. */
export function salvagedColour(rgb: readonly [number, number, number], grey = SALVAGED.grey) {
  const luma = LUMA.reduce((sum, weight, index) => sum + weight * rgb[index]!, 0);
  return rgb.map((channel) => channel + grey * (luma - channel)) as [number, number, number];
}

/** The drawn bounds of composed sprites about the hull sprite position, in display px. */
export function spritesBounds(sprites: readonly Pick<PartSprite, "frame" | "offset">[]): {
  bottom: number;
  left: number;
  right: number;
  top: number;
} {
  let bounds = { bottom: -Infinity, left: Infinity, right: -Infinity, top: Infinity };
  for (const { frame, offset } of sprites) {
    const left = offset.x - frame.pivot.x * frame.displayWidth!;
    const top = offset.y - frame.pivot.y * frame.displayHeight!;
    bounds = {
      bottom: Math.max(bounds.bottom, top + frame.displayHeight!),
      left: Math.min(bounds.left, left),
      right: Math.max(bounds.right, left + frame.displayWidth!),
      top: Math.min(bounds.top, top),
    };
  }
  return bounds;
}
