import { createHudNavigationButton } from "./pauseButton.ts";

/** The same Pause hit target carries the three-line Menu glyph outside pausable play. */
export function createNavigationButton(
  root: HTMLElement,
  labels: { readonly menu: string; readonly pause: string },
  activate: () => void,
) {
  const entry = createHudNavigationButton(root, { action: "pause" }, labels.pause, activate);
  entry.button.setAttribute("aria-haspopup", "dialog");
  return {
    ...entry,
    setMode(mode: "pause" | "menu") {
      entry.setMode(mode, labels[mode]);
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
