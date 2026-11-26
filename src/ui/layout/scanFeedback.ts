import type { Rect } from "@andornaut/game-kit/runtime/rect";

/** Width of the centered lower column between the visible touch controls. */
export function shortNoticeWidth(
  occupied: readonly Rect[],
  { bottom, center, gap, top }: { bottom: number; center: number; gap: number; top: number },
): number {
  let halfWidth = center;
  for (const box of occupied) {
    if (box.width <= 0 || box.height <= 0 || box.y >= bottom + gap || box.y + box.height <= top) {
      continue;
    }
    const distance = box.x + box.width / 2 < center ? center - box.x - box.width : box.x - center;
    halfWidth = Math.min(halfWidth, distance - gap);
  }
  return Math.max(0, Math.floor(2 * halfWidth));
}
