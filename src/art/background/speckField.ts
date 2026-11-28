import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { SCREEN } from "../../data/screen.ts";
import type { Vec } from "../../model/types.ts";

/** A dust speck's drawn radius, in logical px. */
export const SPECK_RADIUS = 1;

export interface SpeckRule {
  readonly cell: number;
  readonly parallax: number;
}

/**
 * The dust specks for Ada at `player` (art/backdrop.md): one per `cell` of the debris layer at its
 * parallax, projected as projectLayer does. `drawn` holds each speck whose circle meets `view`, the
 * world rectangle the camera shows; `inScreen` holds each speck centre inside SCREEN, as the jump
 * overlay reads them. The grid spans the whole projected diamond around the screen, so most specks
 * fall outside the view and are not drawn.
 */
export function speckField(
  rule: SpeckRule,
  player: Vec,
  view: Rect,
): { readonly drawn: Vec[]; readonly inScreen: Vec[] } {
  const { cell, parallax } = rule;
  const span = Math.ceil(Math.max(SCREEN.width, SCREEN.height) / cell) + 2;
  const gx = Math.floor((player.x * parallax) / cell);
  const gy = Math.floor((player.y * parallax) / cell);
  const ox = player.x * parallax;
  const oy = player.y * parallax;
  const left = view.x - SPECK_RADIUS;
  const top = view.y - SPECK_RADIUS;
  const right = view.x + view.width + SPECK_RADIUS;
  const bottom = view.y + view.height + SPECK_RADIUS;
  const drawn: Vec[] = [];
  const inScreen: Vec[] = [];
  for (let x = gx - span; x <= gx + span; x++) {
    for (let y = gy - span; y <= gy + span; y++) {
      const u = x * cell + ((y * 37) % 83) - ox;
      const v = y * cell + ((x * 53) % 79) - oy;
      const px = SCREEN.width / 2 + u - v;
      const py = SCREEN.height / 2 + (u + v) / 2;
      if (px >= 0 && py >= 0 && px <= SCREEN.width && py <= SCREEN.height) {
        inScreen.push({ x: px, y: py });
      }
      if (px > left && py > top && px < right && py < bottom) {
        drawn.push({ x: px, y: py });
      }
    }
  }
  return { drawn, inScreen };
}
