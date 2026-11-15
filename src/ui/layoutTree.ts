import "@andornaut/game-kit/runtime/web/ui/dom/layoutTree.css";

import type { Rect } from "@andornaut/game-kit/runtime/rect";
import {
  type ControlAvailability,
  invokeControl,
} from "@andornaut/game-kit/runtime/ui/controlPresentation";
import type { LayoutNode } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { bindButtonAvailability } from "@andornaut/game-kit/runtime/web/ui/dom/controlPresentation";
import {
  type LayoutComponentPorts,
  type LayoutOptions,
  mountLayout,
} from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import { bindAdaAction } from "./actionBinding.ts";
import { type CardSize, SCROLL } from "./layout/contentCard.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import {
  type ButtonRole,
  createActions,
  createButton,
  createCard,
  setFooterAction,
} from "./modal.ts";
import { createProse } from "./prose.ts";

export interface AdaCardProps<A extends string> {
  readonly closeAction: A;
  readonly closeLabel: string;
  readonly footerAction: "back" | "close";
  readonly size: CardSize;
  readonly title: string;
}

export interface AdaButtonProps<A extends string> {
  readonly actionId: A;
  readonly align?: "top" | "center";
  readonly size?: "ordinary" | "compact";
  readonly label: string;
  readonly role: ButtonRole;
}

export type AdaLayoutSchema<A extends string> = {
  button: { props: AdaButtonProps<A>; slots: never };
  card: { props: AdaCardProps<A>; slots: "header" | "body" | "footer" };
  text: { props: { readonly className?: string; readonly text: string }; slots: never };
};

/** Caller-owned DS bindings provide the shared reason placement, skin and sizing. */
export interface AdaButtonPresentation<A extends string> {
  readonly element: HTMLElement;
  readonly reason: HTMLElement;
  update(props: AdaButtonProps<A>): void;
  dispose(): void;
}

export interface AdaLayoutContext<A extends string> {
  readonly actions: ReadonlyMap<A, () => void>;
  readonly availability: (action: A) => ControlAvailability;
  readonly presentButton: (
    button: HTMLButtonElement,
    label: ChildNode,
    props: AdaButtonProps<A>,
  ) => AdaButtonPresentation<A>;
  readonly onUnavailable?: (reason: string) => void;
}

/** Owns only component bindings. The published renderer owns tree reconciliation. */
export function createAdaLayoutPorts<A extends string>(context: AdaLayoutContext<A>) {
  const fits = new Set<() => void>();
  const dispatch = (id: A) =>
    invokeControl(context.availability(id), () => {
      const action = context.actions.get(id);
      if (!action) {
        throw new Error("Unregistered caller action");
      }
      action();
    });
  const components: LayoutComponentPorts<AdaLayoutSchema<A>> = {
    button: {
      create(initial) {
        let current = initial;
        let disposed = false;
        const button = createButton(initial.label, initial.role);
        const label = button.firstChild;
        if (!label || label.nodeType !== 3) {
          throw new Error("Button label text binding is unavailable");
        }
        const presentation = context.presentButton(button, label, initial);
        const binding = bindButtonAvailability(
          {
            getAvailability: () => context.availability(current.actionId),
            reason: presentation.reason,
            ...(context.onUnavailable ? { onUnavailable: context.onUnavailable } : {}),
          },
          button,
        );
        const activate = () => dispatch(current.actionId);
        const registered = bindAdaAction(
          {
            click: { availability: () => context.availability(current.actionId), run: activate },
            current: () => !disposed,
            slopPx: () => SCROLL.dragThreshold * readViewUnit(button),
          },
          button,
        );
        const update = (next: AdaButtonProps<A>) => {
          current = next;
          button.dataset.action = next.actionId;
          label.nodeValue = next.label;
          button.classList.toggle("ada-primary", next.role === "primary");
          presentation.update(next);
          presentation.element.hidden = !binding.refresh().visible;
        };
        update(initial);
        return {
          dispose() {
            disposed = true;
            registered.dispose();
            binding.dispose();
            presentation.dispose();
          },
          element: presentation.element,
          slots: {},
          update,
        };
      },
      slots: [],
    },
    card: {
      create(initial) {
        let current = initial;
        let disposed = false;
        const parts = createCard(initial);
        const body = parts.body.ownerDocument.createElement("div");
        body.style.alignSelf = "stretch";
        body.style.minWidth = "0";
        const footer = createActions([]);
        setFooterAction(initial.footerAction, footer);
        parts.body.append(body, footer);
        fits.add(parts.fit);
        const activate = () => dispatch(current.closeAction);
        const registered = bindAdaAction(
          {
            click: { availability: () => context.availability(current.closeAction), run: activate },
            current: () => !disposed,
            slopPx: () => SCROLL.dragThreshold * readViewUnit(parts.close),
          },
          parts.close,
        );
        return {
          dispose() {
            disposed = true;
            registered.dispose();
            fits.delete(parts.fit);
            parts.dispose();
          },
          element: parts.frame,
          slots: { body, footer, header: parts.header },
          update(next) {
            current = next;
            parts.title.textContent = next.title;
            parts.frame.setAttribute("aria-label", next.title);
            parts.frame.dataset.cardSize = next.size;
            parts.close.setAttribute("aria-label", next.closeLabel);
            parts.close.dataset.action = next.closeAction;
            setFooterAction(next.footerAction, footer);
          },
        };
      },
      slots: ["header", "body", "footer"],
    },
    text: {
      create(initial) {
        const element = createProse(initial.text);
        const update = (next: AdaLayoutSchema<A>["text"]["props"]) => {
          element.className = ["ada-prose", next.className].filter(Boolean).join(" ");
          element.textContent = next.text;
        };
        update(initial);
        return { dispose() {}, element, slots: {}, update };
      },
      slots: [],
    },
  };
  return {
    components,
    dispatch,
    fit: () => {
      for (const fit of fits) {
        fit();
      }
    },
  };
}

/** Runtime and isolated mocks share these ports, tree data and the published renderer. */
export function mountAdaLayout<A extends string>(
  context: AdaLayoutContext<A>,
  options: Omit<LayoutOptions<AdaLayoutSchema<A>>, "components"> & {
    readonly artReady: Promise<void>;
  },
  tree: LayoutNode<AdaLayoutSchema<A>>,
) {
  const ports = createAdaLayoutPorts(context);
  const mounted = mountLayout({ ...options, components: ports.components }, tree);
  let disposed = false;
  let generation = 0;
  let ready = false;
  let currentTree = tree;
  const settle = async () => {
    const revision = ++generation;
    ready = false;
    const doc = options.host.ownerDocument;
    await Promise.all([doc.fonts.ready, options.artReady]);
    await Promise.all([...options.host.querySelectorAll("img")].map((image) => image.decode()));
    if (disposed || revision !== generation) {
      return;
    }
    ports.fit();
    ready = true;
  };
  return {
    dispatch(id: A) {
      if (disposed) {
        throw new Error("Layout has been disposed");
      }
      return ports.dispatch(id);
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      generation++;
      ready = false;
      mounted.dispose();
    },
    inspect(viewport: Rect) {
      if (disposed) {
        throw new Error("Layout has been disposed");
      }
      if (!ready) {
        return {
          diagnostics: [
            {
              available: null,
              kind: "unavailable" as const,
              path: [currentTree.key],
              required: null,
              viewport,
              wrappedLines: [],
            },
          ],
          status: "unavailable" as const,
        };
      }
      return mounted.inspect(viewport);
    },
    settle,
    update(next: LayoutNode<AdaLayoutSchema<A>>) {
      ready = false;
      generation++;
      mounted.update(next);
      currentTree = next;
    },
  };
}
