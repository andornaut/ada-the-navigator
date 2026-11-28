import type { LayoutNode } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { setButtonRole } from "@andornaut/game-kit/runtime/web/ui/dom/buttonLayout";
import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { type MountedLayout, mountLayout } from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import { assertAdaActionBindings, assertAdaActionMetadata } from "../actions/index.ts";
import { SCROLL, SPACING } from "../layout/index.ts";
import { readViewUnit } from "../layoutDom/index.ts";
import { createActions, createCard, setFooterAction } from "../modal.ts";
import { createStandardCloseAction } from "../modalClose.ts";
import { createModalLayer } from "../modalLayer.ts";
import { createStandardTextAction } from "../standardTextAction.ts";

interface ShipPaintScheme {
  readonly id: string;
  readonly name: string;
  readonly swatch?: string;
}

type PaintLayout = { tile: { props: ShipPaintScheme; slots: never } };
const PAINT_COLUMNS = 3;

function paintTree(schemes: readonly ShipPaintScheme[]): LayoutNode<PaintLayout> {
  return {
    children: Array.from({ length: Math.ceil(schemes.length / PAINT_COLUMNS) }, (_, row) => ({
      children: Array.from({ length: PAINT_COLUMNS }, (_, column): LayoutNode<PaintLayout> => {
        const scheme = schemes[row * PAINT_COLUMNS + column];
        return scheme
          ? { component: "tile", key: scheme.id, kind: "component", props: scheme }
          : { children: [], gap: 0, key: `empty:${column}`, kind: "stack", padding: 0 };
      }),
      gap: SPACING.gap,
      key: `row:${row}`,
      kind: "columns",
      padding: 0,
      sizing: { mode: "equal" },
    })),
    gap: SPACING.gap,
    key: "paints",
    kind: "stack",
    padding: 0,
  };
}

export interface ShipPaintOptions {
  readonly applyLabel: string;
  readonly current: () => string;
  readonly inUseLabel: string;
  readonly schemes: () => readonly ShipPaintScheme[];
  readonly select: (id: string) => void;
  readonly title: string;
}

export function createShipPaintCard(
  root: HTMLElement,
  options: ShipPaintOptions & {
    readonly backLabel: string;
    readonly closeLabel: string;
    readonly onClose: () => void;
  },
) {
  const modal = document.createElement("div");
  modal.className = "ada-modal";
  modal.hidden = true;
  let disposed = false;
  let leave: (() => void) | undefined;
  let selected = "";
  const current = () => !disposed && !modal.hidden;
  const closeX = createStandardCloseAction(root, "close-ship-paint", options.closeLabel, {
    current,
    run: close,
    slopPx: (button) => SCROLL.dragThreshold * readViewUnit(button),
    slopThreshold: SCROLL.dragThreshold,
  });
  const parts = createCard({ close: closeX.element, size: "large", title: options.title });
  parts.card.dataset.dialog = "ship-paint";
  const grid = document.createElement("div");
  grid.className = "ada-ship-paint-grid";
  const dismiss = createStandardTextAction(root, options.backLabel, {
    availability: () => ({ kind: "available" }),
    current,
    run: close,
  });
  dismiss.element.dataset.action = "dismiss-ship-paint";
  dismiss.element.classList.add("ada-primary");
  setButtonRole("primary", dismiss.element);
  const footer = createActions([{ button: dismiss.element, role: "primary" }]);
  setFooterAction("back", footer);
  parts.body.append(grid, footer);
  modal.append(parts.frame);
  assertAdaActionMetadata(modal);
  root.append(modal);
  const layer = createModalLayer(modal);
  let mounted: MountedLayout<PaintLayout> | undefined;
  const actions = new Map<string, ReturnType<typeof createStandardTextAction>>();

  function hide(): void {
    modal.hidden = true;
    leave?.();
    leave = undefined;
    for (const action of actions.values()) {
      action.dispose();
    }
    actions.clear();
    mounted?.dispose();
    mounted = undefined;
  }

  function close(): void {
    if (current()) {
      hide();
      options.onClose();
    }
  }

  function apply(id: string): void {
    const previous = selected;
    const focused = document.activeElement === actions.get(id)?.element;
    options.select(id);
    selected = options.current();
    if (!current() || selected === previous) {
      return;
    }
    for (const [scheme, action] of actions) {
      action.setLabel(scheme === selected ? options.inUseLabel : options.applyLabel);
      action.refresh();
    }
    if (focused && selected === id) {
      focusTarget(actions.get(previous)?.element ?? dismiss.element);
    }
    parts.fit();
  }

  const createApplyButton = (id: string, descriptionId: string) => {
    const action = createStandardTextAction(
      root,
      id === selected ? options.inUseLabel : options.applyLabel,
      {
        availability: () => (id === selected ? { kind: "disabled" } : { kind: "available" }),
        current,
        run: () => apply(id),
      },
    );
    const button = action.element;
    button.dataset.action = "apply-ship-paint";
    button.setAttribute("aria-describedby", descriptionId);
    setButtonRole("secondary", button);
    actions.set(id, action);
    assertAdaActionMetadata(button);
    return button;
  };

  const mountPaints = () =>
    mountLayout<PaintLayout>(
      {
        components: {
          tile: {
            create({ id, name, swatch }) {
              const tile = document.createElement("div");
              tile.className = "ada-ship-paint-tile";
              tile.dataset.paint = id;
              const heading = document.createElement("div");
              heading.className = "ada-ship-paint-name";
              if (swatch) {
                const image = document.createElement("img");
                image.className = "ada-ship-paint-swatch";
                image.alt = "";
                image.src = swatch;
                heading.append(image);
              }
              const label = document.createElement("span");
              label.id = `ada-ship-paint-name-${id}`;
              label.textContent = name;
              heading.append(label);
              tile.append(heading, createApplyButton(id, label.id));
              return { dispose() {}, element: tile, slots: {}, update() {} };
            },
            slots: [],
          },
        },
        host: grid,
      },
      paintTree(options.schemes()),
    );

  return {
    close,
    dispose() {
      disposed = true;
      hide();
      layer.dispose();
      closeX.dispose();
      dismiss.dispose();
      parts.dispose();
      modal.remove();
    },
    isOpen: current,
    open() {
      if (disposed || current()) {
        return;
      }
      selected = options.current();
      try {
        mounted = mountPaints();
        assertAdaActionBindings(modal);
        modal.hidden = false;
        parts.fit();
        leave = layer.open({ close, focus: dismiss.element }, parts.frame);
      } catch (error) {
        hide();
        throw error;
      }
    },
  };
}
