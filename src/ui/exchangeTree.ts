import type { LayoutNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

import type { ExchangeAmount } from "../model/exchange.ts";

export type ExchangeDirection = "buy" | "sell";
export interface ExchangeActionData {
  readonly amount: ExchangeAmount;
  readonly direction: ExchangeDirection;
  readonly label: string;
}
export type ExchangeSchema = {
  container: { props: { readonly id: "root" | ExchangeDirection }; slots: "content" };
  action: { props: ExchangeActionData; slots: never };
  native: { props: { readonly id: "help" | "result" | "status" }; slots: never };
};

/** The caller supplies canonical quantity and copy facts; transactions remain model-owned. */
export function exchangeTree(data: {
  readonly buy: readonly ExchangeActionData[];
  readonly sell: readonly ExchangeActionData[];
}): LayoutNode<ExchangeSchema> {
  return {
    component: "container",
    key: "root",
    kind: "component",
    props: { id: "root" },
    slots: {
      content: [
        { component: "native", key: "help", kind: "component", props: { id: "help" } },
        ...(["buy", "sell"] as const).map<LayoutNode<ExchangeSchema>>((direction) => ({
          component: "container",
          key: direction,
          kind: "component",
          props: { id: direction },
          slots: {
            content: data[direction].map((action) => ({
              component: "action",
              key: `${action.direction}-${action.amount}`,
              kind: "component",
              props: action,
            })),
          },
        })),
        { component: "native", key: "result", kind: "component", props: { id: "result" } },
        { component: "native", key: "status", kind: "component", props: { id: "status" } },
      ],
    },
  };
}
