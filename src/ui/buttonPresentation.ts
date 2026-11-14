import "@andornaut/game-kit/web/ui/dom/controls.css";
import "@andornaut/game-kit/web/ui/dom/controlPresentation.css";

import {
  setButtonFrame,
  setButtonRole,
  setButtonSize,
  setControlPlacement,
} from "@andornaut/game-kit/web/ui/dom/buttonLayout";
import {
  createDisclosure,
  createPageDivider,
  setPageDivider,
} from "@andornaut/game-kit/web/ui/dom/controlPresentation";

import { DETAILS_DISCLOSURE_STYLE, PAGE_DIVIDER_STYLE } from "./layout/controlPresentation.ts";
import { BUTTON_METRICS, TEXT_BUTTON } from "./layout/controls.ts";
export { DETAILS_DISCLOSURE_STYLE, PAGE_DIVIDER_STYLE } from "./layout/controlPresentation.ts";
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

/** Details/navigation rows opt in explicitly; action buttons receive no disclosure automatically. */
export function createAdaDisclosure(document: Document): SVGSVGElement {
  return createDisclosure(document, DETAILS_DISCLOSURE_STYLE);
}

/** Presentation only. The published adapter retains availability guards and caller action dispatch. */
export function presentAdaButton<A extends string>(
  button: HTMLButtonElement,
  label: ChildNode,
  initial: AdaButtonProps<A>,
): AdaButtonPresentation<A> {
  const document = button.ownerDocument;
  const element = document.createElement("div");
  element.className = "ada-button-presentation ui-control-row";
  element.style.setProperty("--ui-unit", "var(--ada-unit, 1)");
  const faceLabel = document.createElement("span");
  faceLabel.className = "ui-control-label";
  faceLabel.append(label);
  button.classList.add("ui-control-button");
  button.append(faceLabel);
  const reason = document.createElement("p");
  reason.className = "ada-button-reason";
  reason.hidden = true;
  element.append(button, reason);
  let disposed = false;
  const update = (props: AdaButtonProps<A>) => {
    if (disposed) {
      return;
    }
    label.nodeValue = props.label;
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
  update(initial);
  return {
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      element.remove();
    },
    element,
    reason,
    update,
  };
}
