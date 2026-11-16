import type { Rect } from "@andornaut/game-kit/runtime/rect";

import type { Vec } from "../../model/types.ts";
import { SPACING } from "./tokens.ts";
export interface ScanFeedbackLayout {
  readonly anchor: Vec;
  readonly area: Rect;
  readonly blocked: readonly Rect[];
  readonly height: number;
  readonly path?: ScanFeedbackPath;
  readonly progress: number;
  readonly reducedMotion: boolean;
  readonly width: number;
}
const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
export interface ScanFeedbackPath {
  readonly area: Rect;
  readonly from: Rect;
  readonly top: number;
}
/** Choose a fixed vertical corridor around the HUD once, never around changing dialogue. */
export function scanFeedbackPath(context: ScanFeedbackLayout): ScanFeedbackPath | null {
  const { anchor, area, blocked, height, width } = context;
  if (!(width > 0 && height > 0) || width > area.width || height > area.height) {
    return null;
  }
  const clampX = (x: number) => Math.max(area.x, Math.min(x, area.x + area.width - width));
  const clampY = (y: number) => Math.max(area.y, Math.min(y, area.y + area.height - height));
  const origin = { x: clampX(anchor.x - width / 2), y: clampY(anchor.y - height / 2) };
  const gap = SPACING.rowGap;
  const xs = new Set([origin.x, area.x, area.x + area.width - width]);
  const ys = new Set([origin.y, area.y]);
  for (const box of blocked) {
    xs.add(clampX(box.x - width - gap));
    xs.add(clampX(box.x + box.width + gap));
    ys.add(clampY(box.y - height - gap));
    ys.add(clampY(box.y + box.height + gap));
  }
  const distance = (box: Rect) => (box.x - origin.x) ** 2 + (box.y - origin.y) ** 2;
  const from = [...xs]
    .flatMap((x) => [...ys].map((y) => ({ height, width, x, y })))
    .filter((box) => box.y <= origin.y && !blocked.some((occupied) => overlaps(box, occupied)))
    .sort((a, b) => distance(a) - distance(b) || a.y - b.y || a.x - b.x)[0];
  if (!from) {
    return null;
  }
  const above = blocked.filter(
    (box) => box.x < from.x + width && box.x + box.width > from.x && box.y + box.height <= from.y,
  );
  return {
    area: { ...area },
    from,
    top: Math.min(from.y, Math.max(area.y, ...above.map((box) => box.y + box.height + gap))),
  };
}
/** Interpolate the retained path without moving sideways or hopping over occupied rectangles. */
export function scanFeedbackRect(context: ScanFeedbackLayout): Rect | null {
  const path = context.path ?? scanFeedbackPath(context);
  if (!path) {
    return null;
  }
  const progress = context.reducedMotion ? 0 : Math.max(0, Math.min(1, context.progress));
  return { ...path.from, y: path.from.y + (path.top - path.from.y) * progress };
}
