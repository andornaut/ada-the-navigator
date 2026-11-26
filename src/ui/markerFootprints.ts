import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { VIEW_PROPERTIES } from "./layout/css.ts";
import { frameRect, turnOf } from "./layout/frameBox.ts";
import { readViewUnit } from "./layout/viewScale.ts";

const MARKER_SELECTORS = [
  ".ada-status",
  ".ada-shield",
  ".ada-weapon-selector",
  ".ada-ammo",
  ".ada-pips",
  ".ada-ammo-gain",
  ".ada-pause",
  ".ada-use",
  ".ada-status-tick",
  ".ada-conversation",
  ".ada-conversation-name",
  ".ada-conversation-portrait",
  "#game-notice",
  "#save-status",
].join(",");

/**
 * Actual visible HUD and dialogue rectangles, relative to the canvas's logical game area, or those
 * of the elements selectors matches.
 */
export function markerFootprints(
  doc: Pick<Document, "querySelectorAll">,
  host: HTMLElement | null,
  selectors: string = MARKER_SELECTORS,
): Rect[] {
  if (!host) {
    return [];
  }
  const origin = host.getBoundingClientRect();
  const turn = turnOf(host);
  const unit = readViewUnit(host);
  const hostStyle = getComputedStyle(host);
  const left = parseFloat(hostStyle.getPropertyValue(VIEW_PROPERTIES.areaLeft)) || 0;
  const top = parseFloat(hostStyle.getPropertyValue(VIEW_PROPERTIES.areaTop)) || 0;
  const rectangles: Rect[] = [];
  for (const node of doc.querySelectorAll<HTMLElement>(selectors)) {
    if (node.closest("[hidden]") || node.getClientRects().length === 0) {
      continue;
    }
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
      continue;
    }
    const bounds = node.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      continue;
    }
    const box = frameRect(turn, origin, bounds);
    rectangles.push({
      height: box.height / unit,
      width: box.width / unit,
      x: (box.x - left) / unit,
      y: (box.y - top) / unit,
    });
  }
  return rectangles;
}
