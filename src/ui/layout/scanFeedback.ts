import type { Rect } from "@andornaut/game-kit/runtime/rect";

import type { Vec } from "../../model/types.ts";
import { SPACING } from "./tokens.ts";

export interface ScanFeedbackLayout {
  readonly anchor: Vec;
  readonly area: Rect;
  readonly blocked: readonly Rect[];
  readonly height: number;
  readonly previousTop?: number;
  readonly progress: number;
  readonly reducedMotion: boolean;
  readonly width: number;
}
const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

/** Use the actual projected target and occupied UI rectangles; never shrink or obscure text. */
export function scanFeedbackRect(context: ScanFeedbackLayout): Rect | null {
  const { anchor, area, blocked, height, reducedMotion, width } = context;
  if (!(width > 0 && height > 0) || width > area.width || height > area.height) {
    return null;
  }
  const clampX = (x: number) => Math.max(area.x, Math.min(x, area.x + area.width - width));
  const clampY = (y: number) => Math.max(area.y, Math.min(y, area.y + area.height - height));
  const origin = { x: clampX(anchor.x - width / 2), y: clampY(anchor.y - height / 2) };
  const progress = reducedMotion ? 0 : Math.max(0, Math.min(1, context.progress));
  const desired = { x: origin.x, y: origin.y + (area.y - origin.y) * progress };
  const gap = SPACING.rowGap;
  const xs = new Set([desired.x, area.x, area.x + area.width - width]);
  const ys = new Set([desired.y, area.y, area.y + area.height - height]);
  if (context.previousTop !== undefined) {
    ys.add(context.previousTop);
  }
  for (const box of blocked) {
    xs.add(clampX(box.x - width - gap));
    xs.add(clampX(box.x + box.width + gap));
    ys.add(clampY(box.y - height - gap));
    ys.add(clampY(box.y + box.height + gap));
  }
  const candidates = [...xs].flatMap((x) => [...ys].map((y) => ({ height, width, x, y })));
  const distance = (box: Rect) => (box.x - desired.x) ** 2 + (box.y - desired.y) ** 2;
  return (
    candidates
      .filter(
        (box) =>
          box.y <= (context.previousTop ?? origin.y) &&
          !blocked.some((occupied) => overlaps(box, occupied)),
      )
      .sort((a, b) => distance(a) - distance(b) || a.y - b.y || a.x - b.x)[0] ?? null
  );
}
