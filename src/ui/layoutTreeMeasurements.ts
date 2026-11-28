import type { Rect } from "@andornaut/game-kit/runtime/rect";
import {
  type LayoutMeasurement,
  type LayoutObservation,
  type LayoutPath,
  layoutReport,
  type LayoutSchema,
} from "@andornaut/game-kit/runtime/ui/layoutTree";
import type {
  LayoutMeasureContext,
  MountedLayout,
} from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import { frameRect, type PageBox, turnOf } from "./layoutDom/index.ts";

interface PhysicalNode {
  readonly element: HTMLElement;
  readonly path: LayoutPath;
}

const right = (rect: Rect) => rect.x + rect.width;
const bottom = (rect: Rect) => rect.y + rect.height;
const intersects = (a: Rect, b: Rect) =>
  Math.min(right(a), right(b)) > Math.max(a.x, b.x) &&
  Math.min(bottom(a), bottom(b)) > Math.max(a.y, b.y);
const intersection = (a: Rect, b: Rect): Rect => ({
  height: Math.max(0, Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y)),
  width: Math.max(0, Math.min(right(a), right(b)) - Math.max(a.x, b.x)),
  x: Math.max(a.x, b.x),
  y: Math.max(a.y, b.y),
});
const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x - 0.01 &&
  inner.y >= outer.y - 0.01 &&
  right(inner) <= right(outer) + 0.01 &&
  bottom(inner) <= bottom(outer) + 0.01;

/** Measures physical DOM in the same caller-supplied base units as the viewport. */
export function measurePhysicalLayout(
  context: {
    readonly host: HTMLElement;
    readonly nodes: readonly PhysicalNode[];
    readonly unit: number;
  },
  view: LayoutMeasureContext,
  element: HTMLElement,
): LayoutMeasurement | null {
  const { host, nodes, unit } = context;
  if (!Number.isFinite(unit) || unit <= 0 || !element.isConnected || !host.contains(element)) {
    return null;
  }
  const doc = element.ownerDocument;
  const win = doc.defaultView;
  if (!win || !doc.createRange || !doc.createTreeWalker) {
    return null;
  }
  const turn = turnOf(host);
  const origin = host.getBoundingClientRect();
  // Every box in the frame's own axes, CSS px from the host's top-left corner, so a quarter turn
  // of the page frame neither swaps sizes nor moves boxes.
  const inFrame = (box: PageBox) => frameRect(turn, origin, box);
  const bounds = inFrame(element.getBoundingClientRect());
  const style = win.getComputedStyle(element);
  if (
    !bounds.width ||
    !bounds.height ||
    style.display === "none" ||
    style.visibility === "hidden"
  ) {
    return null;
  }
  const logical = (rect: Rect): Rect => ({
    height: rect.height / unit,
    width: rect.width / unit,
    x: rect.x / unit,
    y: rect.y / unit,
  });
  const drawn = logical(bounds);
  let clipBounds = view.viewport;
  for (
    let parent = element.parentElement;
    parent && host.contains(parent);
    parent = parent.parentElement
  ) {
    const css = win.getComputedStyle(parent);
    const xClip = /^(auto|scroll|hidden|clip)$/.test(css.overflowX);
    const yClip = /^(auto|scroll|hidden|clip)$/.test(css.overflowY);
    if (!xClip && !yClip) {
      continue;
    }
    const box = inFrame(parent.getBoundingClientRect());
    const borderLeft = Number.parseFloat(css.borderLeftWidth) || 0;
    const borderRight = Number.parseFloat(css.borderRightWidth) || 0;
    const borderTop = Number.parseFloat(css.borderTopWidth) || 0;
    const borderBottom = Number.parseFloat(css.borderBottomWidth) || 0;
    const gutterX = parent.offsetWidth - parent.clientWidth - borderLeft - borderRight;
    const gutterY = parent.offsetHeight - parent.clientHeight - borderTop - borderBottom;
    const clip = logical({
      height: Math.max(0, box.height - borderTop - borderBottom - (gutterY > 1 ? gutterY : 0)),
      width: Math.max(0, box.width - borderLeft - borderRight - (gutterX > 1 ? gutterX : 0)),
      x: box.x + borderLeft,
      y: box.y + borderTop,
    });
    const constrained = {
      height: yClip ? clip.height : clipBounds.height,
      width: xClip ? clip.width : clipBounds.width,
      x: xClip ? clip.x : clipBounds.x,
      y: yClip ? clip.y : clipBounds.y,
    };
    clipBounds = intersection(clipBounds, constrained);
  }
  // Scroll/client sizes round to integers; text ranges retain subpixel overflow.
  const deltaWidth = element.scrollWidth - element.clientWidth;
  const deltaHeight = element.scrollHeight - element.clientHeight;
  const extraWidth = deltaWidth > 1 ? deltaWidth : 0;
  const extraHeight = deltaHeight > 1 ? deltaHeight : 0;
  const required = {
    ...drawn,
    height: (bounds.height + extraHeight) / unit,
    width: (bounds.width + extraWidth) / unit,
  };
  const wrappedLines: Rect[] = [];
  const walker = doc.createTreeWalker(element, 4);
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    if (!text.textContent?.trim()) {
      continue;
    }
    const range = doc.createRange();
    range.selectNodeContents(text);
    for (const line of range.getClientRects()) {
      if (!line.width || !line.height) {
        continue;
      }
      const rect = logical(inFrame(line));
      wrappedLines.push(rect);
      required.width = Math.max(right(required), right(rect)) - Math.min(required.x, rect.x);
      required.height = Math.max(bottom(required), bottom(rect)) - Math.min(required.y, rect.y);
      required.x = Math.min(required.x, rect.x);
      required.y = Math.min(required.y, rect.y);
    }
    range.detach();
  }
  let allocation = drawn;
  if (element.classList?.contains("ada-card-frame")) {
    const modal = element.closest<HTMLElement>(".ada-modal");
    if (modal) {
      const modalBox = inFrame(modal.getBoundingClientRect());
      const modalStyle = win.getComputedStyle(modal);
      const left = Number.parseFloat(modalStyle.paddingLeft) || 0;
      const right = Number.parseFloat(modalStyle.paddingRight) || 0;
      const top = Number.parseFloat(modalStyle.paddingTop) || 0;
      const bottom = Number.parseFloat(modalStyle.paddingBottom) || 0;
      allocation = logical({
        height: Math.max(0, modal.clientHeight - top - bottom),
        width: Math.max(0, modal.clientWidth - left - right),
        x: modalBox.x + modal.clientLeft + left,
        y: modalBox.y + modal.clientTop + top,
      });
    }
  }
  const available = intersection(allocation, clipBounds);
  const clipped =
    !contains(clipBounds, required) ||
    (/^(auto|scroll|hidden|clip)$/.test(style.overflowX) &&
      (required.x < drawn.x - 0.01 || right(required) > right(drawn) + 0.01)) ||
    (/^(auto|scroll|hidden|clip)$/.test(style.overflowY) &&
      (required.y < drawn.y - 0.01 || bottom(required) > bottom(drawn) + 0.01));
  const overlaps = nodes
    .filter((other) => {
      if (
        other.element === element ||
        element.contains(other.element) ||
        other.element.contains(element)
      ) {
        return false;
      }
      const otherStyle = win.getComputedStyle(other.element);
      if (otherStyle.display === "none" || otherStyle.visibility === "hidden") {
        return false;
      }
      return intersects(drawn, logical(inFrame(other.element.getBoundingClientRect())));
    })
    .map(({ path }) => [...path]);
  return { available, clipped, overlaps, required, wrappedLines };
}

/** One current keyed DOM snapshot, including native card title/close controls. No model cache. */
export function createPhysicalLayoutInspector(unit: () => number, host: HTMLElement) {
  const nodes = new Map<HTMLElement, PhysicalNode>();
  let collecting = false;
  let measuring = false;
  const observations: LayoutObservation[] = [];
  return {
    dispose() {
      nodes.clear();
      observations.length = 0;
    },
    inspect<S extends LayoutSchema>(viewport: Rect, mounted: Pick<MountedLayout<S>, "inspect">) {
      nodes.clear();
      observations.length = 0;
      collecting = true;
      let initial;
      try {
        initial = mounted.inspect(viewport);
      } finally {
        collecting = false;
      }
      if (!nodes.size) {
        return { observations: [], report: initial };
      }
      measuring = true;
      try {
        mounted.inspect(viewport);
      } finally {
        measuring = false;
      }
      for (const node of nodes.values()) {
        if (node.path.at(-2) === "$native") {
          observations.push({
            measurement: measurePhysicalLayout(
              { host, nodes: [...nodes.values()], unit: unit() },
              { path: node.path, viewport },
              node.element,
            ),
            path: node.path,
          });
        }
      }
      return {
        observations: observations.map((entry) => ({ ...entry })),
        report: layoutReport(viewport, observations),
      };
    },
    measure(view: LayoutMeasureContext, element: HTMLElement): LayoutMeasurement | null {
      if (collecting) {
        nodes.set(element, { element, path: [...view.path] });
        for (const [name, selector] of [
          ["title", ":scope > .ada-card > header > :is(h1,h2)"],
          ["close", ":scope > .ada-close"],
        ] as const) {
          const child = element.querySelector<HTMLElement>(selector);
          if (child) {
            nodes.set(child, { element: child, path: [...view.path, "$native", name] });
          }
        }
        return null;
      }
      if (!measuring) {
        return null;
      }
      const measurement = measurePhysicalLayout(
        { host, nodes: [...nodes.values()], unit: unit() },
        view,
        element,
      );
      observations.push({ measurement, path: [...view.path] });
      return measurement;
    },
  };
}
