import { type JetDisplay, jetOccluderRegions, jetPlumes, type ShipJets } from "../art/index.ts";
import type { Vec } from "../model/types.ts";
import { COLOURS } from "./layout/index.ts";

/** Draws the shared projected plumes in logical canvas coordinates at the caller-selected hull order. */
export function drawShipJets(
  context: CanvasRenderingContext2D,
  jets: ShipJets,
  display: JetDisplay,
  heading: number,
  centre: Vec,
  alpha = 1,
  white = 0,
): void {
  context.save();
  for (const plume of jetPlumes(jets, display, heading, 1)) {
    context.beginPath();
    for (const [index, point] of plume.points.entries()) {
      const x = centre.x + point.x;
      const y = centre.y + point.y;
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.closePath();
    context.globalAlpha = alpha * plume.alpha;
    context.fillStyle = `#${plume.color.toString(16).padStart(6, "0")}`;
    context.fill();
    if (white > 0) {
      context.globalAlpha = alpha * plume.alpha * white;
      context.fillStyle = COLOURS.white;
      context.fill();
    }
  }
  context.restore();
}

/** Redraws the same hull image inside the plume occluders, over the plumes drawn in front. */
export function drawShipTail(
  context: CanvasRenderingContext2D,
  jets: ShipJets,
  display: JetDisplay,
  heading: number,
  centre: Vec,
  drawHull: () => void,
): void {
  const regions = jetOccluderRegions(jets, display, heading);
  if (!regions.length) {
    return;
  }
  context.save();
  context.beginPath();
  for (const region of regions) {
    for (const [index, point] of region.entries()) {
      if (index === 0) {
        context.moveTo(centre.x + point.x, centre.y + point.y);
      } else {
        context.lineTo(centre.x + point.x, centre.y + point.y);
      }
    }
    context.closePath();
  }
  context.clip();
  drawHull();
  context.restore();
}
