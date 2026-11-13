import type { Rect } from "@andornaut/game-kit/rect";

import type { LocalMap } from "../model/map.ts";
import { type FogStampBounds, fogStampBounds } from "./layout/mapFog.ts";
import { fogBlur, fogReveal, type MapView, toScreen } from "./layout/mapScreen.ts";

interface FogStamp {
  readonly canvas: HTMLCanvasElement;
  readonly rx: number;
  readonly ry: number;
  readonly sigma: number;
  readonly x: number;
  readonly y: number;
}
// Weak keys release the stamp with its target canvas.
const stamps = new WeakMap<CanvasRenderingContext2D, FogStamp>();
function fogStamp(context: CanvasRenderingContext2D, bounds: FogStampBounds): FogStamp | null {
  const { height, pixels, rx, ry, sigma, width, x, y } = bounds;
  if (!context.canvas?.ownerDocument) {
    return null;
  }
  const previous = stamps.get(context);
  if (pixels > context.canvas.width * context.canvas.height) {
    if (previous) {
      previous.canvas.width = 0;
      previous.canvas.height = 0;
      stamps.delete(context);
    }
    return null;
  }
  if (previous?.rx === rx && previous.ry === ry && previous.sigma === sigma) {
    return previous;
  }
  const canvas = previous?.canvas ?? context.canvas?.ownerDocument.createElement("canvas");
  const raster = canvas?.getContext("2d");
  if (!canvas || !raster) {
    return null;
  }
  canvas.width = width;
  canvas.height = height;
  raster.filter = fogBlur(sigma);
  raster.fillStyle = "#000";
  raster.beginPath();
  raster.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  raster.fill();
  const stamp = { canvas, rx, ry, sigma, x, y };
  stamps.set(context, stamp);
  return stamp;
}

/**
 * Draw the current fog at full device resolution. Bound each filtered operation to its ellipse
 * plus eight Gaussian sigmas and two device pixels; the feather remains inside the clip.
 * One Gaussian stamp per target is retained at the current radii and device scale.
 * The stamp contains no discovery data and never exceeds the target canvas pixel budget.
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
  const bounds = fogStampBounds({
    rx: reveal.rx * px,
    ry: reveal.ry * px,
    sigma: reveal.sigma * px,
  });
  const { clipHeight, clipWidth, padding, rx, ry, sigma } = bounds;
  const stamp = fogStamp(context, bounds);
  context.globalCompositeOperation = "source-over";
  context.filter = "none";
  context.fillStyle = colour;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = "destination-out";
  context.filter = stamp ? "none" : fogBlur(sigma);
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
    if (stamp) {
      context.drawImage(stamp.canvas, x - stamp.x, y - stamp.y);
    } else {
      context.beginPath();
      context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }
  context.globalCompositeOperation = "source-over";
  context.filter = "none";
}
