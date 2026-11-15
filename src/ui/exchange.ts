import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";

import { EXCHANGE_COPY } from "../data/exchangeCopy.ts";
import type { ExchangeOrder, ExchangePreview, ExchangeQuote } from "../model/exchange.ts";
import { bindAdaAction } from "./actionBinding.ts";
import { SCROLL } from "./layout/contentCard.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { createActions, createButton } from "./modal.ts";
import { inCurrentView } from "./pressScope.ts";
import { stardustCount } from "./statusPill.ts";

export interface ExchangePort {
  readonly confirm: (quote: ExchangeQuote) => ExchangePreview;
  readonly preview: (order: ExchangeOrder) => ExchangePreview;
}

/** The station owns balances; this view only requests previews and confirmed transactions. */
export function createExchangeView(parent: HTMLElement, port: ExchangePort, onChange: () => void) {
  const root = document.createElement("section");
  root.className = "ada-exchange";
  root.setAttribute("role", "tabpanel");
  root.setAttribute("aria-label", EXCHANGE_COPY.title);
  const help = document.createElement("p");
  help.textContent = EXCHANGE_COPY.help;
  const editor = document.createElement("div");
  const buy = createButton(EXCHANGE_COPY.buyOre);
  const sell = createButton(EXCHANGE_COPY.sellOre);
  buy.dataset.action = "exchange-buy";
  sell.dataset.action = "exchange-sell";
  const directions = createActions([
    { button: buy, role: "secondary" },
    { button: sell, role: "secondary" },
  ]);
  const label = document.createElement("label");
  label.textContent = EXCHANGE_COPY.amount;
  const amount = document.createElement("input");
  amount.type = "number";
  amount.min = "1";
  amount.step = "1";
  amount.value = "1";
  amount.dataset.action = "exchange-amount";
  label.append(amount);
  const preview = document.createElement("div");
  preview.dataset.exchange = "preview";
  const action = createButton(EXCHANGE_COPY.buyOre);
  action.dataset.action = "exchange-preview";
  editor.append(directions, label, preview, createActions([{ button: action, role: "primary" }]));
  const confirmation = document.createElement("div");
  confirmation.hidden = true;
  confirmation.setAttribute("role", "group");
  confirmation.setAttribute("aria-label", EXCHANGE_COPY.confirm);
  const summary = document.createElement("div");
  summary.dataset.exchange = "confirmation";
  const confirm = createButton(EXCHANGE_COPY.confirm);
  confirm.dataset.action = "exchange-confirm";
  const cancel = createButton(EXCHANGE_COPY.cancel);
  cancel.dataset.action = "exchange-cancel";
  confirmation.append(
    summary,
    createActions([
      { button: cancel, role: "secondary" },
      { button: confirm, role: "primary" },
    ]),
  );
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  root.append(help, editor, confirmation, status);
  parent.append(root);
  let disposed = false;
  const bindings: ReturnType<typeof bindAdaAction>[] = [];
  const register = (element: HTMLButtonElement, run: () => void, active: () => boolean) => {
    bindings.push(
      bindAdaAction(
        {
          click: {
            availability: () => (element.disabled ? { kind: "omitted" } : { kind: "available" }),
            run,
          },
          current: () => !disposed && !root.hidden && active() && inCurrentView(parent, element),
          slopPx: () => SCROLL.dragThreshold * readViewUnit(element),
        },
        element,
      ),
    );
  };
  let direction: ExchangeOrder["direction"] = "buy";
  let pending: ExchangeQuote | undefined;
  const line = (target: HTMLElement, quote: ExchangeQuote): void => {
    target.replaceChildren(
      ...[
        `${quote.direction === "buy" ? EXCHANGE_COPY.buyOre : EXCHANGE_COPY.sellOre}: ${stardustCount(quote.amount)}`,
        `${EXCHANGE_COPY.totalPrice}: ${stardustCount(quote.totalPrice)} Stardust`,
        `${EXCHANGE_COPY.oreAfter}: ${stardustCount(quote.after.ore)}`,
        `${EXCHANGE_COPY.stardustAfter}: ${stardustCount(quote.after.stardust)}`,
      ].map((text) => {
        const row = document.createElement("p");
        row.textContent = text;
        return row;
      }),
    );
  };
  const refusal = (result: ExchangePreview): string =>
    result.kind === "quote"
      ? ""
      : result.reason === "cantAfford"
        ? EXCHANGE_COPY.cantAfford
        : result.reason === "notEnoughOre"
          ? EXCHANGE_COPY.notEnoughOre
          : result.reason === "invalidAmount"
            ? EXCHANGE_COPY.invalidAmount
            : result.reason === "stale"
              ? EXCHANGE_COPY.stale
              : EXCHANGE_COPY.unavailable;
  const render = (): void => {
    buy.setAttribute("aria-pressed", String(direction === "buy"));
    sell.setAttribute("aria-pressed", String(direction === "sell"));
    action.textContent = direction === "buy" ? EXCHANGE_COPY.buyOre : EXCHANGE_COPY.sellOre;
    const quote = port.preview({ amount: Number(amount.value), direction });
    action.disabled = quote.kind === "refused";
    status.textContent = refusal(quote);
    if (quote.kind === "quote") {
      line(preview, quote);
    } else {
      preview.replaceChildren();
    }
  };
  const back = (): boolean => {
    if (!pending) {
      return false;
    }
    pending = undefined;
    confirmation.hidden = true;
    editor.hidden = false;
    render();
    focusTarget(action);
    return true;
  };
  for (const [button, next] of [
    [buy, "buy"],
    [sell, "sell"],
  ] as const) {
    register(
      button,
      () => {
        direction = next;
        render();
      },
      () => !editor.hidden,
    );
  }
  amount.addEventListener("input", render);
  register(
    action,
    () => {
      const quote = port.preview({ amount: Number(amount.value), direction });
      if (quote.kind !== "quote") {
        render();
        return;
      }
      pending = quote;
      line(summary, quote);
      editor.hidden = true;
      confirmation.hidden = false;
      status.textContent = "";
      focusTarget(confirm);
    },
    () => !editor.hidden,
  );
  register(cancel, back, () => !confirmation.hidden);
  register(
    confirm,
    () => {
      const quote = pending;
      if (!quote) {
        return;
      }
      pending = undefined;
      confirm.disabled = true;
      try {
        const result = port.confirm(quote);
        confirmation.hidden = true;
        editor.hidden = false;
        onChange();
        render();
        status.textContent = refusal(result);
        focusTarget(action);
      } finally {
        confirm.disabled = false;
      }
    },
    () => !confirmation.hidden && pending !== undefined,
  );
  render();
  return {
    back,
    dispose() {
      disposed = true;
      for (const binding of bindings) {
        binding.dispose();
      }
      bindings.length = 0;
      amount.removeEventListener("input", render);
      root.remove();
    },
    isConfirming: () => pending !== undefined,
    render,
    root,
  };
}
