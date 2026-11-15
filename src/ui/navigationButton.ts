import { FRAME_LINE } from "./layout/controls.ts";
import { HUD_BUTTON } from "./layout/playView.ts";
import { createPauseButton } from "./pauseButton.ts";

/** The same Pause hit target carries the three-line Menu glyph outside pausable play. */
export function createNavigationButton(
  root: HTMLElement,
  labels: { readonly menu: string; readonly pause: string },
  activate: () => void,
) {
  const button = createPauseButton(root, labels.pause, activate);
  button.setAttribute("aria-haspopup", "dialog");
  const disc = document.createElement("span");
  disc.className = "ada-navigation-disc";
  disc.setAttribute("aria-hidden", "true");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${HUD_BUTTON.glyph} ${HUD_BUTTON.glyph}`);
  svg.setAttribute("aria-hidden", "true");
  for (const y of [FRAME_LINE, HUD_BUTTON.glyph / 2, HUD_BUTTON.glyph - FRAME_LINE]) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(FRAME_LINE / 2));
    line.setAttribute("x2", String(HUD_BUTTON.glyph - FRAME_LINE / 2));
    line.setAttribute("y1", String(y));
    line.setAttribute("y2", String(y));
    line.setAttribute("stroke", "currentColor");
    line.setAttribute("stroke-width", String(FRAME_LINE));
    svg.append(line);
  }
  disc.append(svg);
  button.append(disc);
  return {
    button,
    setMode(mode: "pause" | "menu") {
      button.dataset.navigation = mode;
      button.dataset.action = mode;
      button.setAttribute("aria-label", labels[mode]);
      button.title = labels[mode];
      disc.hidden = mode !== "menu";
    },
  };
}

/** The production dispatcher is also used by the actual-component caller fixture. */
export function activateNavigation(
  context: {
    readonly mapOpen: boolean;
    readonly menu: (origin: HTMLElement) => void;
    readonly pausable: boolean;
    readonly pause: () => void;
  },
  origin: HTMLElement,
): void {
  if (context.pausable && !context.mapOpen) {
    context.pause();
  } else {
    context.menu(origin);
  }
}
