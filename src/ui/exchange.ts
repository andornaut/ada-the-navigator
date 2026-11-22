import type { ControlAvailability } from "@andornaut/game-kit/runtime/ui/controlPresentation";
import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { mountLayout } from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import { IMMEDIATE_EXCHANGE_UNIT_COST } from "../data/exchange.ts";
import { EXCHANGE_COPY } from "../data/exchangeCopy.ts";
import {
  EXCHANGE_AMOUNTS,
  type ExchangeResource,
  type ImmediateExchangeOrder,
  type ImmediateExchangePreview,
  type ImmediateExchangeResult,
} from "../model/exchange.ts";
import { fill } from "../model/shop.ts";
import {
  assertAdaActionBindings,
  assertAdaActionMetadata,
  bindAdaAction,
} from "./actionBinding.ts";
import { type ExchangeActionData, type ExchangeSchema, exchangeTree } from "./exchangeTree.ts";
import { SCROLL } from "./layout/contentCard.ts";
import { QUEST_ROUTE_ARROW } from "./layout/questsScreen.ts";
import { STATION_SPRITES } from "./layout/stationStyle.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { createActions, createButton } from "./modal.ts";
import { inCurrentView } from "./pressScope.ts";

export interface ExchangePort {
  readonly exchangeImmediately: (order: ImmediateExchangeOrder) => ImmediateExchangeResult;
  readonly preview: (order: ImmediateExchangeOrder) => ImmediateExchangePreview;
}

const resourceName = { ore: "ore", stardust: "Stardust" } as const;
const buyLabel = { ore: EXCHANGE_COPY.buyOre, stardust: EXCHANGE_COPY.buyStardust };
const paymentFor = (resource: ExchangeResource): ExchangeResource =>
  resource === "ore" ? "stardust" : "ore";

function exchangeIcon(resource: ExchangeResource): HTMLImageElement {
  const image = document.createElement("img");
  image.className = "ada-exchange-icon";
  image.src = `${STATION_SPRITES}icon-${resource}-20.png`;
  image.alt = "";
  return image;
}

/** Fixed actions use live model validation and a single atomic transaction per activation. */
export function createExchangeView(parent: HTMLElement, port: ExchangePort, onChange: () => void) {
  const root = document.createElement("section");
  root.className = "ada-exchange";
  root.setAttribute("aria-label", EXCHANGE_COPY.title);
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  const containers = { ore: createActions([]), root, stardust: createActions([]) };
  let disposed = false;
  const actions: { button: HTMLButtonElement; order: ImmediateExchangeOrder }[] = [];
  const bindings: ReturnType<typeof bindAdaAction>[] = [];
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
    return preview.reason === "cantAfford" || preview.reason === "notEnoughOre"
      ? { kind: "unavailable", reason: refusal(preview) }
      : { kind: "omitted" };
  };
  const render = () => {
    for (const { button, order } of actions) {
      const state = availability(order);
      button.disabled = state.kind === "omitted";
      button.setAttribute("aria-disabled", String(state.kind === "unavailable"));
    }
  };
  const reportRefusal = (reason: string) => {
    audit();
    status.textContent = reason;
    render();
  };
  const execute = (button: HTMLButtonElement, order: ImmediateExchangeOrder) => {
    audit();
    const outcome = port.exchangeImmediately(order);
    if (outcome.kind === "exchanged") {
      onChange();
      audit();
    }
    status.textContent = refusal(outcome);
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
            const button = createButton(String(order.amount));
            button.className += " ada-exchange-amount";
            const give = resourceName[paymentFor(order.resource)];
            const receive = resourceName[order.resource];
            const cost = IMMEDIATE_EXCHANGE_UNIT_COST * order.amount;
            const label = `Spend ${cost} ${give} to get ${order.amount} ${receive}`;
            button.setAttribute("aria-label", label);
            button.title = label;
            button.append(exchangeIcon(order.resource));
            button.dataset.action = `exchange-${order.resource}-${order.amount}`;
            const binding = bindAdaAction(
              {
                click: {
                  availability: () => availability(order),
                  refuse: reportRefusal,
                  run: () => execute(button, order),
                },
                current: () => !disposed && !root.hidden && inCurrentView(parent, button),
                ownAriaDisabled: "refusal-feedback",
                slopPx: () => SCROLL.dragThreshold * readViewUnit(button),
              },
              button,
            );
            actions.push({ button, order });
            bindings.push(binding);
            return { dispose() {}, element: button, slots: {}, update() {} };
          },
          slots: [],
        },
        container: {
          create(data) {
            const controls = containers[data.id];
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
            rate.textContent = fill(EXCHANGE_COPY.rate, {
              cost: IMMEDIATE_EXCHANGE_UNIT_COST,
              received: resourceName[receive],
              spent: resourceName[give],
            });
            summary.append(heading, rate);
            const direction = document.createElement("span");
            direction.className = "ada-exchange-direction";
            direction.setAttribute("role", "img");
            direction.setAttribute(
              "aria-label",
              `${resourceName[give]} to ${resourceName[receive]}`,
            );
            const namespace = "http://www.w3.org/2000/svg";
            const arrow = document.createElementNS(namespace, "svg");
            arrow.setAttribute("aria-hidden", "true");
            arrow.setAttribute("class", "ada-exchange-arrow");
            arrow.setAttribute("viewBox", QUEST_ROUTE_ARROW.viewBox);
            arrow.setAttribute("fill", "currentColor");
            for (const d of [QUEST_ROUTE_ARROW.shaft, QUEST_ROUTE_ARROW.head]) {
              const path = document.createElementNS(namespace, "path");
              path.setAttribute("d", d);
              arrow.append(path);
            }
            direction.append(exchangeIcon(give), arrow);
            row.append(summary, direction, controls);
            return { dispose() {}, element: row, slots: { content: controls }, update() {} };
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
    for (const binding of bindings) {
      binding.dispose();
    }
    bindings.length = 0;
    mounted.dispose();
    throw error;
  }
  render();
  return {
    back: () => false,
    dispose() {
      disposed = true;
      for (const binding of bindings) {
        binding.dispose();
      }
      bindings.length = 0;
      mounted.dispose();
    },
    isConfirming: () => false,
    render,
    root,
  };
}
