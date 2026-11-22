import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { mountLayout } from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import { EXCHANGE_COPY } from "../data/exchangeCopy.ts";
import {
  EXCHANGE_AMOUNTS,
  type ExchangeResource,
  type ImmediateExchangeOrder,
  type ImmediateExchangePreview,
  type ImmediateExchangeResult,
} from "../model/exchange.ts";
import {
  assertAdaActionBindings,
  assertAdaActionMetadata,
  bindAdaAction,
} from "./actionBinding.ts";
import { type ExchangeActionData, type ExchangeSchema, exchangeTree } from "./exchangeTree.ts";
import { SCROLL } from "./layout/contentCard.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { createActions, createButton } from "./modal.ts";
import { inCurrentView } from "./pressScope.ts";
import { stardustCount } from "./statusPill.ts";

export interface ExchangePort {
  readonly exchangeImmediately: (order: ImmediateExchangeOrder) => ImmediateExchangeResult;
  readonly preview: (order: ImmediateExchangeOrder) => ImmediateExchangePreview;
}

/** Fixed actions use live model validation and a single atomic transaction per activation. */
export function createExchangeView(parent: HTMLElement, port: ExchangePort, onChange: () => void) {
  const root = document.createElement("section");
  root.className = "ada-exchange";
  root.setAttribute("role", "tabpanel");
  root.setAttribute("aria-label", EXCHANGE_COPY.title);
  const result = document.createElement("div");
  result.dataset.exchange = "result";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  const containers = { ore: createActions([]), root, stardust: createActions([]) };
  const parts = { result, status };
  const label = { ore: EXCHANGE_COPY.buyOre, stardust: EXCHANGE_COPY.buyStardust };
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
  const render = () => {
    for (const { button, order } of actions) {
      button.disabled = port.preview(order).kind === "refused";
    }
  };
  const execute = (button: HTMLButtonElement, order: ImmediateExchangeOrder) => {
    audit();
    const outcome = port.exchangeImmediately(order);
    if (outcome.kind === "exchanged") {
      const paymentLabel = outcome.resource === "ore" ? "Stardust" : "Ore";
      result.replaceChildren(
        ...[
          `${label[outcome.resource]}: ${stardustCount(outcome.amount)}`,
          `${EXCHANGE_COPY.totalPrice}: ${stardustCount(outcome.totalPrice)} ${paymentLabel}`,
          `${EXCHANGE_COPY.oreAfter}: ${stardustCount(outcome.after.ore)}`,
          `${EXCHANGE_COPY.stardustAfter}: ${stardustCount(outcome.after.stardust)}`,
        ].map((text) => {
          const line = document.createElement("p");
          line.textContent = text;
          return line;
        }),
      );
      onChange();
      audit();
    }
    status.textContent = refusal(outcome);
    render();
    focusTarget(button);
  };
  const data = (resource: ExchangeResource): readonly ExchangeActionData[] =>
    EXCHANGE_AMOUNTS.map((amount) => ({
      amount,
      label: `${label[resource]} ${stardustCount(amount)}`,
      resource,
    }));
  const mounted = mountLayout<ExchangeSchema>(
    {
      components: {
        action: {
          create(initial) {
            const button = createButton(initial.label);
            const order: ImmediateExchangeOrder = {
              amount: initial.amount,
              resource: initial.resource,
            };
            button.dataset.action = `exchange-${order.resource}-${order.amount}`;
            const binding = bindAdaAction(
              {
                click: {
                  availability: () =>
                    button.disabled ? { kind: "omitted" } : { kind: "available" },
                  run: () => execute(button, order),
                },
                current: () => !disposed && !root.hidden && inCurrentView(parent, button),
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
            const element = containers[data.id];
            return { dispose() {}, element, slots: { content: element }, update() {} };
          },
          slots: ["content"],
        },
        native: {
          create(data) {
            return { dispose() {}, element: parts[data.id], slots: {}, update() {} };
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
