import {
  setButtonFrame,
  setButtonRole,
  setButtonSize,
  setControlPlacement,
} from "@andornaut/game-kit/runtime/web/ui/dom/buttonLayout";
import {
  createPageDivider,
  setPageDivider,
} from "@andornaut/game-kit/runtime/web/ui/dom/controlPresentation";

import { PAGE_DIVIDER_STYLE } from "./layout/controlPresentation.ts";
import { BUTTON_METRICS, TEXT_BUTTON } from "./layout/controls.ts";
export { PAGE_DIVIDER_STYLE } from "./layout/controlPresentation.ts";
import type { AdaButtonPresentation, AdaButtonProps } from "./layoutTree.ts";

/** Apply once on the shared page/modal root used by production and mocks. */
export function applyAdaControlTheme(root: HTMLElement): void {
  root.style.setProperty("--ui-unit", "var(--ada-unit, 1)");
  setPageDivider(PAGE_DIVIDER_STYLE, root);
}

/** One shared page/modal separator, with orientation independent of its visual tokens. */
export function createAdaPageDivider(
  document: Document,
  axis: "horizontal" | "vertical" = "vertical",
): HTMLHRElement {
  const divider = createPageDivider(document);
  divider.classList.add("ada-page-divider");
  divider.dataset.axis = axis;
  divider.setAttribute("aria-orientation", axis);
  return divider;
}

/** Styles the native button without taking ownership of its content slot. */
export function presentAdaButtonContent<A extends string>(
  button: HTMLButtonElement,
  setLabel: (text: string) => void,
  reason: HTMLElement,
): AdaButtonPresentation<A> {
  const document = button.ownerDocument;
  const element = document.createElement("div");
  element.className = "ada-button-presentation ui-control-row";
  element.style.setProperty("--ui-unit", "var(--ada-unit, 1)");
  button.classList.add("ui-control-button");
  reason.className = "ada-button-reason";
  element.append(button, reason);
  let disposed = false;
  const update = (props: AdaButtonProps<A>) => {
    if (disposed) {
      return;
    }
    setLabel(props.label);
    button.classList.toggle("ada-primary", props.role === "primary");
    button.classList.toggle("ada-compact", props.size === "compact");
    setButtonRole(props.role, button);
    setButtonSize(BUTTON_METRICS, props.size ?? "ordinary", button);
    setControlPlacement(props.align ?? "top", element);
    const style = document.defaultView?.getComputedStyle(button);
    setButtonFrame(
      {
        borderWidths: {
          bottom: Number.parseFloat(style?.borderBottomWidth ?? "0") || 0,
          left: Number.parseFloat(style?.borderLeftWidth ?? "0") || 0,
          right: Number.parseFloat(style?.borderRightWidth ?? "0") || 0,
          top: Number.parseFloat(style?.borderTopWidth ?? "0") || 0,
        },
        faceInsets: { bottom: TEXT_BUTTON.lipHeight, left: 0, right: 0, top: 0 },
      },
      button,
    );
  };
  return {
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      element.remove();
    },
    element,
    update,
  };
}
