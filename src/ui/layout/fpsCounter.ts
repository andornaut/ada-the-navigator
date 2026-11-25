import { LOADING_LAYER } from "../loadingBar.ts";
import { pixels } from "./css.ts";

/** Above every game layer, the loading bar included, and outside the game area's bands. */
export const FPS_LAYER = LOADING_LAYER + 10;

/** CSS px from the safe-area edges of the device viewport. */
export const FPS_INSET = 8;

/** The readout's box and monospace type, in device CSS px. */
const FPS_BOX = { lineHeight: 16, padding: { x: 6, y: 2 }, radius: 4, size: 12 } as const;

// The readout is sized in device CSS px, not the game area's logical px: it belongs to the device
// viewport. It sits in the view host, whose --ada-safe-* carry the safe-area insets the game's
// HUD keeps clear of, so it keeps to the same corner rules in a turned frame too.
export const FPS_STYLE = `
.ada-fps{
  position:absolute;
  right:calc(var(--ada-safe-right, 0px) + ${pixels(FPS_INSET)});
  bottom:calc(var(--ada-safe-bottom, 0px) + ${pixels(FPS_INSET)});
  z-index:${FPS_LAYER};
  padding:${pixels(FPS_BOX.padding.y)} ${pixels(FPS_BOX.padding.x)};
  border-radius:${pixels(FPS_BOX.radius)};
  background:#000000b3;
  color:#ededed;
  font:${pixels(FPS_BOX.size)}/${pixels(FPS_BOX.lineHeight)} ui-monospace,monospace;
  pointer-events:none
}`;
