import type { Rect } from "@andornaut/game-kit/runtime/rect";
import {
  type ControlAvailability,
  invokeControl,
} from "@andornaut/game-kit/runtime/ui/controlPresentation";
import type { LayoutNode } from "@andornaut/game-kit/runtime/ui/layoutTree";
import {
  type LayoutComponentPorts,
  type LayoutOptions,
  mountLayout,
} from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import {
  assertAdaActionBindings,
  assertAdaActionMetadata,
  bindAdaAction,
} from "./actionBinding.ts";
import { presentAdaButtonContent } from "./buttonPresentation.ts";
import { type CardSize, SCROLL } from "./layout/contentCard.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { type ButtonRole, createActions, createCard, setFooterAction } from "./modal.ts";
import { createProse } from "./prose.ts";
import { createStandardTextAction } from "./standardTextAction.ts";

export interface AdaCardProps<A extends string> {
  /** Footer-only confirmations omit the empty content slot without reserving a gap. */
  readonly body?: boolean;
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
  update(props: AdaButtonProps<A>): void;
  dispose(): void;
}

export interface AdaLayoutContext<A extends string> {
  readonly actionRoot: HTMLElement;
  readonly actions: ReadonlyMap<A, () => void>;
  readonly availability: (action: A) => ControlAvailability;
  readonly onUnavailable?: (reason: string) => void;
}

function standardButton<A extends string>(
  context: AdaLayoutContext<A>,
  initial: AdaButtonProps<A>,
  dispatch: (id: A) => void,
) {
  let current = initial;
  let disposed = false;
  const root = context.actionRoot;
  const reason = root.ownerDocument.createElement("p");
  const kit = createStandardTextAction(root, initial.label, {
    availability: () => context.availability(current.actionId),
    current: () => !disposed,
    reason,
    ...(context.onUnavailable
      ? {
          refuse: (message: string) => {
            kit.refresh();
            context.onUnavailable?.(message);
          },
        }
      : {}),
    run: () => dispatch(current.actionId),
  });
  const button = kit.element;
  const presentation = presentAdaButtonContent<A>(button, kit.setLabel, reason);
  const update = (next: AdaButtonProps<A>) => {
    current = next;
    button.dataset.action = next.actionId;
    presentation.update(next);
    kit.refresh();
    presentation.element.hidden = button.hidden;
  };
  const dispose = () => {
    disposed = true;
    kit.dispose();
    presentation.dispose();
  };
  try {
    update(initial);
    assertAdaActionMetadata(presentation.element);
  } catch (error) {
    dispose();
    throw error;
  }
  return { dispose, element: presentation.element, slots: {}, update };
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
      create: (initial) => standardButton(context, initial, dispatch),
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
        body.hidden = initial.body === false;
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
        const update = (next: AdaCardProps<A>) => {
          current = next;
          body.hidden = next.body === false;
          parts.title.textContent = next.title;
          parts.frame.setAttribute("aria-label", next.title);
          parts.frame.dataset.cardSize = next.size;
          parts.close.setAttribute("aria-label", next.closeLabel);
          parts.close.dataset.action = next.closeAction;
          setFooterAction(next.footerAction, footer);
        };
        update(initial);
        try {
          assertAdaActionMetadata(parts.frame);
        } catch (error) {
          disposed = true;
          registered.dispose();
          fits.delete(parts.fit);
          parts.dispose();
          throw error;
        }
        return {
          dispose() {
            disposed = true;
            registered.dispose();
            fits.delete(parts.fit);
            parts.dispose();
          },
          element: parts.frame,
          slots: { body, footer, header: parts.header },
          update,
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
  const audit = () => {
    assertAdaActionMetadata(options.host);
    if (options.host.isConnected) {
      assertAdaActionBindings(options.host);
    }
  };
  const mounted = mountLayout({ ...options, components: ports.components }, tree);
  try {
    audit();
  } catch (error) {
    mounted.dispose();
    throw error;
  }
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
    fit() {
      if (!disposed) {
        ports.fit();
      }
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
      try {
        audit();
      } catch (error) {
        disposed = true;
        mounted.dispose();
        throw error;
      }
      currentTree = next;
    },
  };
}
