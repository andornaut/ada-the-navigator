import type { Rect } from "@andornaut/game-kit/runtime/rect";

/** The highest centered position with room for the notice's laid-out width and height. */
export function scanFeedbackTop(
  occupied: readonly Rect[],
  gap: number,
  center: number,
  notice: Pick<Rect, "width" | "height">,
  minimum: number,
): number {
  const left = center - notice.width / 2;
  const right = center + notice.width / 2;
  let top = Math.ceil(minimum);
  for (const box of occupied) {
    const bottom = box.y + box.height;
    if (
      left < box.x + box.width + gap &&
      right > box.x - gap &&
      top < bottom + gap &&
      top + notice.height + gap > box.y
    ) {
      top = Math.ceil(bottom + gap);
    }
  }
  return top;
}
