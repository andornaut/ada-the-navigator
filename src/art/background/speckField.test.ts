import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { describe, expect, it } from "vitest";

import { SCREEN } from "../../data/screen.ts";
import { SPECK_RADIUS, speckField } from "./speckField.ts";

const RULE = { cell: 112, parallax: 0.7 };
const VIEW: Rect = { height: SCREEN.height, width: SCREEN.width, x: 0, y: 0 };

// Every speck of the grid around the screen, as the scene drew them all before culling.
function grid(player: { x: number; y: number }) {
  const { cell, parallax } = RULE;
  const span = Math.ceil(Math.max(SCREEN.width, SCREEN.height) / cell) + 2;
  const gx = Math.floor((player.x * parallax) / cell);
  const gy = Math.floor((player.y * parallax) / cell);
  const points = [];
  for (let x = gx - span; x <= gx + span; x++) {
    for (let y = gy - span; y <= gy + span; y++) {
      const u = x * cell + ((y * 37) % 83) - player.x * parallax;
      const v = y * cell + ((x * 53) % 79) - player.y * parallax;
      points.push({ x: SCREEN.width / 2 + u - v, y: SCREEN.height / 2 + (u + v) / 2 });
    }
  }
  return points;
}

// Whether a speck's circle covers any of view.
function meets(point: { x: number; y: number }, view: Rect) {
  const nearX = Math.max(view.x, Math.min(point.x, view.x + view.width));
  const nearY = Math.max(view.y, Math.min(point.y, view.y + view.height));
  return Math.hypot(point.x - nearX, point.y - nearY) < SPECK_RADIUS;
}

describe("dust specks", () => {
  it.each([
    { x: 0, y: 0 },
    { x: 1234.5, y: -987.25 },
    { x: -40000, y: 25000 },
  ])("draws every speck whose circle meets the view, and few others, at %o", (player) => {
    for (const view of [VIEW, { height: 405, width: 760, x: -20, y: -22 }]) {
      const all = grid(player);
      const { drawn, inScreen } = speckField(RULE, player, view);
      expect(
        all
          .filter((point) => meets(point, view))
          .every((point) => drawn.some((d) => d.x === point.x && d.y === point.y)),
      ).toBe(true);
      expect(drawn.every((point) => all.some((p) => p.x === point.x && p.y === point.y))).toBe(
        true,
      );
      expect(drawn.length).toBeLessThan(all.length / 4);
      expect(inScreen).toEqual(
        all.filter(({ x, y }) => x >= 0 && y >= 0 && x <= SCREEN.width && y <= SCREEN.height),
      );
    }
  });
});
