import type { Rect } from "@andornaut/game-kit/rect";

import type { LocalMap } from "../model/map.ts";
import { fogBlur, fogReveal, type MapView, toScreen } from "./layout/mapScreen.ts";

/**
 * Draw the current fog at full device resolution. Bound each filtered operation to its ellipse
 * plus eight Gaussian sigmas and two device pixels; the feather remains inside the clip.
 * No map data or raster is retained between calls.
 */
export function drawMapFog(
  context: CanvasRenderingContext2D,
  inner: Rect,
  current: MapView,
  map: Pick<LocalMap, "explored" | "places" | "player">,
  px: number,
  colour: string,
  width: number,
  height: number,
): void {
  const reveal = fogReveal(current.scale);
  const rx = reveal.rx * px;
  const ry = reveal.ry * px;
  const sigma = reveal.sigma * px;
  const padding = Math.ceil(8 * sigma + 2);
  const clipWidth = Math.ceil(2 * rx) + 2 * padding + 2;
  const clipHeight = Math.ceil(2 * ry) + 2 * padding + 2;
  context.globalCompositeOperation = "source-over";
  context.filter = "none";
  context.fillStyle = colour;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = "destination-out";
  context.filter = fogBlur(sigma);
  context.fillStyle = "#000";
  for (const point of [...map.explored, ...map.places, map.player]) {
    const at = toScreen(inner, current, point);
    const x = at.x * px;
    const y = at.y * px;
    const left = Math.floor(x - rx) - padding;
    const top = Math.floor(y - ry) - padding;
    if (left >= width || top >= height || left + clipWidth <= 0 || top + clipHeight <= 0) {
      continue;
    }
    context.save();
    context.beginPath();
    context.rect(left, top, clipWidth, clipHeight);
    context.clip();
    context.beginPath();
    context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  context.globalCompositeOperation = "source-over";
  context.filter = "none";
}
