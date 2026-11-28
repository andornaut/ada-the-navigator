import type { ControlAvailability } from "@andornaut/game-kit/runtime/ui/controlPresentation";
import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { mountLayout } from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";
import { REFUSAL_ATTRIBUTES } from "@andornaut/game-kit/runtime/web/ui/dom/refusalCue";

import { IMMEDIATE_EXCHANGE_UNIT_COST } from "../data/exchange.ts";
import { EXCHANGE_COPY } from "../data/exchangeCopy.ts";
import { uiIconUrl } from "../data/uiIconUrl.ts";
import {
  EXCHANGE_AMOUNTS,
  type ExchangeRefusal,
  type ExchangeResource,
  type ImmediateExchangeOrder,
  type ImmediateExchangePreview,
  type ImmediateExchangeResult,
} from "../model/exchange.ts";
import { fill } from "../model/shop.ts";
import { assertAdaActionBindings, assertAdaActionMetadata } from "./actionBinding.ts";
import { type ExchangeActionData, type ExchangeSchema, exchangeTree } from "./exchangeTree.ts";
import { inCurrentView } from "./pressScope.ts";
import { refuse } from "./refusal.ts";
import { createStandardTextAction } from "./standardTextAction.ts";

export interface ExchangePort {
  readonly exchangeImmediately: (order: ImmediateExchangeOrder) => ImmediateExchangeResult;
  readonly preview: (order: ImmediateExchangeOrder) => ImmediateExchangePreview;
}

const resourceName = { ore: "ore", stardust: "Stardust" } as const;
const buyLabel = { ore: EXCHANGE_COPY.buyOre, stardust: EXCHANGE_COPY.buyStardust };
const paymentFor = (resource: ExchangeResource): ExchangeResource =>
  resource === "ore" ? "stardust" : "ore";
const isUnaffordable = (reason: ExchangeRefusal["reason"]): boolean =>
  reason === "cantAfford" || reason === "notEnoughOre";

function exchangeIcon(resource: ExchangeResource): HTMLImageElement {
  const image = document.createElement("img");
  image.className = "ada-exchange-icon";
  image.src = uiIconUrl(`icon-${resource}-20`);
  image.alt = "";
  return image;
}

/** Fixed actions use live model validation and a single atomic transaction per activation. */
export function createExchangeView(
  actionRoot: HTMLElement,
  parent: HTMLElement,
  port: ExchangePort,
  reducedMotion: () => boolean,
  onChange: () => void,
) {
  const root = document.createElement("section");
  root.className = "ada-exchange";
  root.setAttribute("aria-label", EXCHANGE_COPY.title);
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  let disposed = false;
  const actions: ReturnType<typeof createStandardTextAction>[] = [];
  const refusal = (value: ImmediateExchangePreview | ImmediateExchangeResult): string =>
    value.kind !== "refused"
      ? ""
      : value.reason === "cantAfford"
        ? EXCHANGE_COPY.cantAfford
        : value.reason === "notEnoughOre"
          ? EXCHANGE_COPY.notEnoughOre
          : value.reason === "invalidAmount"
            ? EXCHANGE_COPY.invalidAmount
            : value.reason === "stale"
              ? EXCHANGE_COPY.stale
              : EXCHANGE_COPY.unavailable;
  const audit = () => {
    try {
      assertAdaActionMetadata(root);
      if (root.isConnected) {
        assertAdaActionBindings(root);
      }
    } catch (error) {
      root.hidden = true;
      throw error;
    }
  };
  const availability = (order: ImmediateExchangeOrder): ControlAvailability => {
    const preview = port.preview(order);
    if (preview.kind !== "refused") {
      return { kind: "available" };
    }
    return isUnaffordable(preview.reason)
      ? { kind: "unavailable", reason: refusal(preview) }
      : { kind: "omitted" };
  };
  const render = () => {
    for (const action of actions) {
      action.refresh();
    }
  };
  const reportStatus = (reason: string, visuallyHidden: boolean) => {
    status.toggleAttribute("data-exchange-affordability", visuallyHidden);
    status.textContent = reason;
  };
  const reportRefusal = (button: HTMLButtonElement, reason: string) => {
    reportStatus(reason, true);
    // The regular cue has a shake throughout its red/off phases. Reduced motion holds red.
    if (
      !button.hasAttribute(REFUSAL_ATTRIBUTES.red) &&
      !button.hasAttribute(REFUSAL_ATTRIBUTES.shake)
    ) {
      refuse(button, reducedMotion());
    }
  };
  const execute = (button: HTMLButtonElement, order: ImmediateExchangeOrder) => {
    audit();
    const outcome = port.exchangeImmediately(order);
    if (outcome.kind === "exchanged") {
      onChange();
      audit();
    }
    if (outcome.kind === "refused" && isUnaffordable(outcome.reason)) {
      reportRefusal(button, refusal(outcome));
    } else {
      reportStatus(refusal(outcome), false);
    }
    render();
    focusTarget(button);
  };
  const data = (resource: ExchangeResource): readonly ExchangeActionData[] =>
    EXCHANGE_AMOUNTS.map((amount) => ({ amount, resource }));
  const mounted = mountLayout<ExchangeSchema>(
    {
      components: {
        action: {
          create(initial) {
            const order = initial;
            const action = createStandardTextAction(actionRoot, String(order.amount), {
              availability: () => {
                const state = availability(order);
                return state.kind === "omitted" ? { kind: "disabled" } : state;
              },
              current: (): boolean =>
                !disposed && !root.hidden && inCurrentView(parent, action.element),
              refuse: (reason) => {
                audit();
                reportRefusal(action.element, reason);
                render();
              },
              run: (): void => execute(action.element, order),
            });
            const button = action.element;
            button.classList.add("ada-exchange-amount");
            const give = resourceName[paymentFor(order.resource)];
            const receive = resourceName[order.resource];
            const cost = IMMEDIATE_EXCHANGE_UNIT_COST * order.amount;
            const label = `Spend ${cost} ${give} to get ${order.amount} ${receive}`;
            button.setAttribute("aria-label", label);
            button.title = label;
            button.append(exchangeIcon(order.resource));
            button.dataset.action = `exchange-${order.resource}-${order.amount}`;
            actions.push(action);
            return { dispose() {}, element: button, slots: {}, update() {} };
          },
          slots: [],
        },
        container: {
          create(data) {
            if (data.id === "root") {
              return { dispose() {}, element: root, slots: { content: root }, update() {} };
            }
            const receive = data.id;
            const give = paymentFor(receive);
            const row = document.createElement("section");
            row.className = "ada-exchange-row";
            row.setAttribute("aria-label", buyLabel[receive]);
            const summary = document.createElement("div");
            const heading = document.createElement("h3");
            heading.textContent = buyLabel[receive];
            const rate = document.createElement("p");
            rate.className = "ada-exchange-rate";
            const values = {
              cost: IMMEDIATE_EXCHANGE_UNIT_COST,
              received: resourceName[receive],
              spent: resourceName[give],
            };
            const visual = document.createElement("span");
            visual.className = "ada-exchange-rate-visual";
            visual.setAttribute("aria-hidden", "true");
            for (const part of EXCHANGE_COPY.rate
              .split(/(\{received\}|\{spent\})/u)
              .filter(Boolean)) {
              if (part === "{received}" || part === "{spent}") {
                visual.append(exchangeIcon(part === "{received}" ? receive : give));
              } else {
                const text = document.createElement("span");
                text.textContent = fill(part, values).trim();
                visual.append(text);
              }
            }
            const spoken = document.createElement("span");
            spoken.className = "ada-exchange-rate-spoken";
            spoken.textContent = fill(EXCHANGE_COPY.rate, values);
            rate.append(visual, spoken);
            summary.append(heading, rate);
            row.append(summary);
            return { dispose() {}, element: row, slots: { content: row }, update() {} };
          },
          slots: ["content"],
        },
        native: {
          create() {
            return { dispose() {}, element: status, slots: {}, update() {} };
          },
          slots: [],
        },
      },
      host: parent,
    },
    exchangeTree({ ore: data("ore"), stardust: data("stardust") }),
  );
  try {
    audit();
  } catch (error) {
    disposed = true;
    for (const action of actions) {
      action.dispose();
    }
    actions.length = 0;
    mounted.dispose();
    throw error;
  }
  render();
  return {
    back: () => false,
    dispose() {
      disposed = true;
      for (const action of actions) {
        action.dispose();
      }
      actions.length = 0;
      mounted.dispose();
    },
    isConfirming: () => false,
    render,
    root,
  };
}
