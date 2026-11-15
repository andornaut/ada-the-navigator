import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { VIEW_PROPERTIES } from "./layout/css.ts";
import { readViewUnit } from "./layout/viewScale.ts";

const SELECTORS = [
  ".ada-status",
  ".ada-shield",
  ".ada-weapon-selector",
  ".ada-ammo",
  ".ada-pips",
  ".ada-ammo-gain",
  ".ada-pause",
  ".ada-settings-open",
  ".ada-use",
  ".ada-status-tick",
  ".ada-conversation",
  ".ada-conversation-name",
  ".ada-conversation-portrait",
  "#game-notice",
  "#save-status",
].join(",");

/** Actual visible HUD and dialogue rectangles, relative to the canvas's logical game area. */
export function markerFootprints(
  doc: Pick<Document, "querySelectorAll">,
  host: HTMLElement | null,
): Rect[] {
  if (!host) {
    return [];
  }
  const origin = host.getBoundingClientRect();
  const unit = readViewUnit(host);
  const left = parseFloat(getComputedStyle(host).getPropertyValue(VIEW_PROPERTIES.areaLeft)) || 0;
  const rectangles: Rect[] = [];
  for (const node of doc.querySelectorAll<HTMLElement>(SELECTORS)) {
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
    rectangles.push({
      height: bounds.height / unit,
      width: bounds.width / unit,
      x: (bounds.left - origin.left - left) / unit,
      y: (bounds.top - origin.top) / unit,
    });
  }
  return rectangles;
}
