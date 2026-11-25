import { SCREEN } from "../data/screen.ts";
import type { Vec } from "../model/types.ts";
import { COLOURS, UNLISTED_COLOURS } from "./layout/colours.ts";
import { COMPACT_VIEWPORT, font, fromAreaLeft, fromAreaTop, units } from "./layout/css.ts";
import { COMPACT_DISABLED_BANNER } from "./layout/playView.ts";
import { TYPE } from "./layout/tokens.ts";

// The Disabled banner over each disabled heavy (art/heavies.md "Disabled banner"): an HTML
// element in the overlay layer over the canvas, placed each frame on the heavy's projected banner
// point in game-area logical px. It is visual status, hidden from assistive technology.

/** Art's banner: a threat-red face with a 1 px ink border, 6 px insets and an ink label. */
export const DISABLED_BANNER = {
  border: 1,
  face: UNLISTED_COLOURS.disabledBannerFace,
  height: 24,
  ink: COLOURS.ink,
  inset: 6,
  label: TYPE.label,
  radius: 4,
} as const;

const { border, face, height, ink, inset, label, radius } = DISABLED_BANNER;

export const DISABLED_BANNER_STYLE = `
.ada-banners{
  position:absolute;
  inset:0;
  overflow:hidden;
  pointer-events:none;
  z-index:1
}

.ada-disabled-banner{
  position:absolute;
  box-sizing:border-box;
  display:flex;
  align-items:center;
  height:${units(height)};
  padding:0 ${units(inset - border)};
  border:${units(border)} solid ${ink};
  border-radius:${units(radius)};
  background:${face};
  color:${ink};
  font:${font(label)};
  white-space:nowrap;
  transform:translate(-50%,-50%)
}
@media ${COMPACT_VIEWPORT}{
  .ada-disabled-banner{padding:${units(COMPACT_DISABLED_BANNER.top)} ${units(
    inset - border - COMPACT_DISABLED_BANNER.sideInsetReduction,
  )} 0}
}
`;

/** Whether a banner centred on game-area point `at` shows: only while its centre is in the area. */
export function bannerOnScreen(at: Vec): boolean {
  return at.x >= 0 && at.x <= SCREEN.width && at.y >= 0 && at.y <= SCREEN.height;
}

/** One banner to show this frame: its heavy's id and centre in game-area logical px. */
export interface PlacedBanner {
  readonly at: Vec;
  readonly id: string;
}

/**
 * The banner layer in `parent`, its elements made by `doc`: `place` shows one banner per entry
 * whose centre is in the game area, reusing each heavy's element, and removes the rest.
 */
export function createBannerLayer(
  doc: Pick<Document, "createElement">,
  parent: Pick<HTMLElement, "append">,
  text: string,
): { destroy(): void; place(banners: readonly PlacedBanner[]): void } {
  const layer = doc.createElement("div");
  layer.className = "ada-banners";
  layer.setAttribute("aria-hidden", "true");
  parent.append(layer);
  const elements = new Map<string, HTMLElement>();
  return {
    destroy() {
      layer.remove();
      elements.clear();
    },
    place(banners) {
      const shown = new Set<string>();
      for (const { at, id } of banners) {
        if (!bannerOnScreen(at)) {
          continue;
        }
        let element = elements.get(id);
        if (!element) {
          element = doc.createElement("div");
          element.className = "ada-disabled-banner";
          element.textContent = text;
          layer.append(element);
          elements.set(id, element);
        }
        element.style.left = fromAreaLeft(at.x);
        element.style.top = fromAreaTop(at.y);
        shown.add(id);
      }
      for (const [id, element] of elements) {
        if (!shown.has(id)) {
          element.remove();
          elements.delete(id);
        }
      }
    },
  };
}
