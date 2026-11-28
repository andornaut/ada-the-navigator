import type { LayoutNode } from "@andornaut/game-kit/runtime/ui/layoutTree";

import type { ExchangeAmount, ExchangeResource } from "../../model/exchange.ts";
import { BUTTON_GAP } from "../layout/index.ts";

export interface ExchangeActionData {
  readonly amount: ExchangeAmount;
  readonly resource: ExchangeResource;
}
export type ExchangeSchema = {
  container: { props: { readonly id: "root" | ExchangeResource }; slots: "content" };
  action: { props: ExchangeActionData; slots: never };
  native: { props: { readonly id: "status" }; slots: never };
};

/** The caller supplies canonical quantity and copy facts; transactions remain model-owned. */
export function exchangeTree(data: {
  readonly ore: readonly ExchangeActionData[];
  readonly stardust: readonly ExchangeActionData[];
}): LayoutNode<ExchangeSchema> {
  return {
    component: "container",
    key: "root",
    kind: "component",
    props: { id: "root" },
    slots: {
      content: [
        ...(["stardust", "ore"] as const).map<LayoutNode<ExchangeSchema>>((resource) => ({
          component: "container",
          key: resource,
          kind: "component",
          props: { id: resource },
          slots: {
            content: [
              {
                children: data[resource].map((action) => ({
                  component: "action",
                  key: `${action.resource}-${action.amount}`,
                  kind: "component",
                  props: action,
                })),
                gap: BUTTON_GAP,
                key: "quantities",
                kind: "columns",
                padding: 0,
                sizing: { mode: "intrinsic" },
              },
            ],
          },
        })),
        { component: "native", key: "status", kind: "component", props: { id: "status" } },
      ],
    },
  };
}
