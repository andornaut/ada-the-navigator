import { createPauseButton, disposePauseButton } from "./pauseButton.ts";

/** The same Pause hit target carries the three-line Menu glyph outside pausable play. */
export function createNavigationButton(
  root: HTMLElement,
  labels: { readonly menu: string; readonly pause: string },
  activate: () => void,
) {
  const button = createPauseButton(root, labels.pause, activate);
  button.setAttribute("aria-haspopup", "dialog");
  return {
    button,
    dispose: () => disposePauseButton(button),
    setMode(mode: "pause" | "menu") {
      button.dataset.navigation = mode;
      button.dataset.action = mode;
      button.setAttribute("aria-label", labels[mode]);
      button.title = labels[mode];
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
