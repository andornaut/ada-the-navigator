import type { Rect } from "@andornaut/game-kit/runtime/rect";

import type { Vec } from "../../model/types.ts";
import { hudRect, type Insets, playView, type Size } from "./playView.ts";
import { SPACING } from "./tokens.ts";

export interface ScanFeedbackLayout {
  readonly anchor: Vec;
  readonly area: Rect;
  /** The shown HUD and touch controls; the receipt keeps SPACING.gap clear of each. */
  readonly blocked: readonly Rect[];
  readonly dialogue: readonly Rect[];
  readonly height: number;
  readonly width: number;
}

/** The HUD controls' rect, the game area clamped by the safe rect, in game-area px. */
export function scanFeedbackArea(insets: Insets, view: Size): Rect {
  const hud = hudRect(insets, view);
  const play = playView(view);
  return { ...hud, x: hud.x - play.x, y: hud.y - play.y };
}

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const grown = (box: Rect, by: number): Rect => ({
  height: box.height + 2 * by,
  width: box.width + 2 * by,
  x: box.x - by,
  y: box.y - by,
});
/** Choose a fixed position near the projected target, clear of the controls and dialogue. */
export function scanFeedbackRect(context: ScanFeedbackLayout): Rect | null {
  const { anchor, area, dialogue, height, width } = context;
  if (!(width > 0 && height > 0) || width > area.width || height > area.height) {
    return null;
  }
  const gap = SPACING.gap;
  const controls = context.blocked.map((box) => grown(box, gap));
  const minX = area.x;
  const maxX = area.x + area.width - width;
  const minY = area.y;
  const maxY = area.y + area.height - height;
  const clampX = (x: number) => Math.max(minX, Math.min(x, maxX));
  const clampY = (y: number) => Math.max(minY, Math.min(y, maxY));
  const at = (x: number, y: number): Rect => ({ height, width, x, y });
  // A start overlapping the conversation box moves SPACING.gap below it.
  const clearOfDialogue = (box: Rect): Rect => {
    let placed = box;
    for (let pass = 0; pass < dialogue.length; pass++) {
      const hit = dialogue.filter((part) => overlaps(placed, part));
      if (!hit.length) {
        break;
      }
      placed = { ...placed, y: Math.max(...hit.map((part) => part.y + part.height + gap)) };
    }
    return placed;
  };
  const fits = (box: Rect) =>
    box.y <= maxY &&
    !controls.some((control) => overlaps(box, control)) &&
    !dialogue.some((part) => overlaps(box, part));
  const centred = at(anchor.x - width / 2, anchor.y - height / 2);
  const origin = at(clampX(centred.x), clampY(centred.y));
  // Each place along x or y where a control or the dialogue starts or stops meeting the start.
  const xs = [origin.x];
  const ys = [origin.y];
  for (const box of [...controls, ...dialogue]) {
    xs.push(clampX(box.x - width), clampX(box.x + box.width));
    ys.push(clampY(box.y - height), clampY(box.y + box.height));
  }
  for (const part of dialogue) {
    ys.push(clampY(part.y + part.height + gap));
  }
  const edgeX = origin.x !== centred.x;
  const edgeY = origin.y !== centred.y;
  if (edgeX || edgeY) {
    const nearest = (places: readonly Rect[], from: Rect) =>
      places
        .map(clearOfDialogue)
        .filter(fits)
        .sort(
          (a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y),
        )[0];
    // The edge nearest the target: the one it lies the least way past.
    const pastX = edgeX ? Math.abs(centred.x - origin.x) : Infinity;
    const pastY = edgeY ? Math.abs(centred.y - origin.y) : Infinity;
    const alongX = pastY <= pastX;
    const centre = alongX
      ? clampX(area.x + (area.width - width) / 2)
      : clampY(area.y + (area.height - height) / 2);
    const start = alongX ? origin.x : origin.y;
    const between = (value: number) =>
      Math.min(start, centre) - 1e-9 <= value && value <= Math.max(start, centre) + 1e-9;
    const slid = (alongX ? [...xs, centre] : [...ys, centre])
      .filter(between)
      .map((value) => (alongX ? at(value, origin.y) : at(origin.x, value)));
    const bottom = at(origin.x, maxY);
    const from =
      nearest(slid, origin) ??
      nearest(
        [...xs, centre].map((x) => at(x, maxY)),
        bottom,
      );
    if (from) {
      return from;
    }
  }
  const start = clearOfDialogue(origin);
  const distance = (box: Rect) => (box.x - start.x) ** 2 + (box.y - start.y) ** 2;
  const from = [...xs, minX, maxX]
    .flatMap((x) => [...ys, minY].map((y) => at(x, y)))
    .filter((box) => box.y <= start.y && fits(box))
    .sort((a, b) => distance(a) - distance(b) || a.y - b.y || a.x - b.x)[0];
  return from ?? (fits(start) ? start : null);
}
