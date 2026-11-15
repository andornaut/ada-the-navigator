import type { LayoutNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

export type ExchangeContainer =
  "root" | "editor" | "confirmation" | "directions" | "previewActions" | "confirmActions";
export type ExchangePart =
  | "help"
  | "buy"
  | "sell"
  | "amountLabel"
  | "preview"
  | "action"
  | "summary"
  | "cancel"
  | "confirm"
  | "status";
export type ExchangeSchema = {
  container: { props: { readonly id: ExchangeContainer }; slots: "content" };
  native: { props: { readonly id: ExchangePart; readonly text?: string }; slots: never };
};
export interface ExchangeLayoutCopy {
  readonly buyOre: string;
  readonly cancel: string;
  readonly confirm: string;
  readonly help: string;
  readonly sellOre: string;
}

/** Native input values, preview policy and transaction state remain with the caller. */
export function exchangeTree(copy: ExchangeLayoutCopy): LayoutNode<ExchangeSchema> {
  const part = (id: ExchangePart, text?: string): LayoutNode<ExchangeSchema> => ({
    component: "native",
    key: id,
    kind: "component",
    props: { id, ...(text === undefined ? {} : { text }) },
  });
  const group = (
    id: ExchangeContainer,
    content: readonly LayoutNode<ExchangeSchema>[],
  ): LayoutNode<ExchangeSchema> => ({
    component: "container",
    key: id,
    kind: "component",
    props: { id },
    slots: { content },
  });
  return group("root", [
    part("help", copy.help),
    group("editor", [
      group("directions", [part("buy", copy.buyOre), part("sell", copy.sellOre)]),
      part("amountLabel"),
      part("preview"),
      group("previewActions", [part("action")]),
    ]),
    group("confirmation", [
      part("summary"),
      group("confirmActions", [part("cancel", copy.cancel), part("confirm", copy.confirm)]),
    ]),
    part("status"),
  ]);
}
