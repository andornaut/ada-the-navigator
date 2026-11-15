import type { Rect } from "@andornaut/game-kit/rect";

import { CHARTING_ORIGIN, CHARTING_RADIUS } from "../model/map.ts";
import { MAP_COLORS, type MapView, toScreen } from "./layout/mapScreen.ts";

/** The progress outline uses the full canvas; the separate UI layers occlude only their own ink. */
export function drawMapSurveyOutline(
  context: CanvasRenderingContext2D,
  inner: Rect,
  view: MapView,
  px: number,
): void {
  const at = toScreen(inner, view, CHARTING_ORIGIN);
  const rx = CHARTING_RADIUS * Math.SQRT2 * view.scale * px;
  context.save();
  context.beginPath();
  context.rect(0, 0, context.canvas.width, context.canvas.height);
  context.clip();
  context.filter = "none";
  context.globalCompositeOperation = "source-over";
  context.globalAlpha = 0.6;
  context.setLineDash([6 * px, 4 * px]);
  context.lineCap = "butt";
  for (const [width, colour] of [
    [3, MAP_COLORS.ink],
    [1, MAP_COLORS.supporting],
  ] as const) {
    context.lineWidth = width * px;
    context.strokeStyle = colour;
    context.beginPath();
    context.ellipse(at.x * px, at.y * px, rx, rx / 2, 0, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
}
