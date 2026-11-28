import { SHOP_GLYPH } from "../data/layout.ts";
import type { ControlSample } from "../input/index.ts";
import type { ContextQuestDetails } from "../model/questObjectLinks.ts";
import { units } from "./layout/css.ts";
import { TOUCH_CHROME_CENTRE } from "./touchChrome.ts";

/** Read the canonical getter only when an accepted Use sample is consumed. */
export function consumeContextQuestUse(
  current: () => ContextQuestDetails | null,
  open: (context: ContextQuestDetails) => boolean,
  sample: ControlSample,
): ControlSample {
  if (!sample.use) {
    return sample;
  }
  const context = current();
  if (!context || !open(context)) {
    return sample;
  }
  return { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
}

/** Canonical target art inside the existing accessible, non-pointer Use button. */
export function createContextQuestIcon(button: HTMLButtonElement) {
  const icon = button.ownerDocument.createElement("img");
  icon.alt = "";
  icon.hidden = true;
  icon.dataset.questUseIcon = "";
  Object.assign(icon.style, {
    height: units(SHOP_GLYPH.icon),
    left: units(TOUCH_CHROME_CENTRE.x),
    objectFit: "contain",
    pointerEvents: "none",
    position: "absolute",
    top: units(TOUCH_CHROME_CENTRE.y),
    transform: "translate(-50%, -50%)",
    width: units(SHOP_GLYPH.icon),
  });
  button.append(icon);
  return {
    set(path: string | null): void {
      icon.hidden = path === null;
      if (path) {
        if (icon.getAttribute("src") !== path) {
          icon.src = path;
        }
      } else {
        icon.removeAttribute("src");
      }
    },
  };
}
