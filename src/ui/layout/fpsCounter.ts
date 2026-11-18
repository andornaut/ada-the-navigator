import { LOADING_LAYER } from "../loadingBar.ts";

/** Above every game layer, the loading bar included, and outside the game area's bands. */
export const FPS_LAYER = LOADING_LAYER + 10;

/** CSS px from the safe-area edges of the device viewport. */
export const FPS_INSET = 8;

// The readout is sized in device CSS px, not the game area's logical px: it belongs to the device
// viewport. It sits in the view host, whose --ada-safe-* carry the safe-area insets the game's
// HUD keeps clear of, so it keeps to the same corner rules in a turned frame too.
export const FPS_STYLE = `
.ada-fps{
  position:absolute;
  right:calc(var(--ada-safe-right, 0px) + ${FPS_INSET}px);
  bottom:calc(var(--ada-safe-bottom, 0px) + ${FPS_INSET}px);
  z-index:${FPS_LAYER};
  padding:2px 6px;
  border-radius:4px;
  background:#000000b3;
  color:#ededed;
  font:12px/16px ui-monospace,monospace;
  pointer-events:none
}`;
