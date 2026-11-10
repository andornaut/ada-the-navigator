import type { FrameTurn } from "@andornaut/game-kit/view/pagePoint";

import type { Vector } from "./state.ts";

interface Dimensions {
  readonly height: number;
  readonly width: number;
}

/** CSS pixels per game pixel along the displayed frame axes. */
export function movementCssScale(
  turn: FrameTurn,
  gameSize: Dimensions,
  canvas: Dimensions,
): Vector {
  return {
    x: (turn === 0 ? canvas.width : canvas.height) / gameSize.width,
    y: (turn === 0 ? canvas.height : canvas.width) / gameSize.height,
  };
}
