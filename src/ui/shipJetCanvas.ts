import { type JetDisplay, jetTriangles, type ShipJets } from "../game/shipJets.ts";
import type { Vec } from "../model/types.ts";

/** Draws the shared projected polygons in logical canvas coordinates at the caller-selected hull order. */
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
  for (const triangle of jetTriangles(jets, display, heading, 1)) {
    context.beginPath();
    for (const [index, point] of triangle.points.entries()) {
      const x = centre.x + point.x;
      const y = centre.y + point.y;
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.closePath();
    context.globalAlpha = alpha * triangle.alpha;
    context.fillStyle = `#${triangle.color.toString(16).padStart(6, "0")}`;
    context.fill();
    if (white > 0) {
      context.globalAlpha = alpha * triangle.alpha * white;
      context.fillStyle = "#ffffff";
      context.fill();
    }
  }
  context.restore();
}
