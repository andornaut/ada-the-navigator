import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { expect, it } from "vitest";

import { EXCHANGE_AMOUNTS } from "../model/exchange.ts";
import { exchangeTree } from "./exchangeTree.ts";
it("composes caller fixed-action facts without an editor or confirmation controller", () => {
  const actions = (direction: "buy" | "sell") =>
    EXCHANGE_AMOUNTS.map((amount) => ({
      amount,
      direction,
      label: `Caller ${direction} ${amount}`,
    }));
  const tree = exchangeTree({ buy: actions("buy"), sell: actions("sell") });
  validateLayoutTree({ action: [], container: ["content"], native: [] }, tree);
  const ids: string[] = [];
  const visit = (node: typeof tree) => {
    ids.push(node.key);
    if (node.kind === "component" && node.component === "container") {
      for (const child of node.slots!.content!) {
        visit(child);
      }
    }
  };
  visit(tree);
  expect(ids).toEqual([
    "root",
    "help",
    "buy",
    "buy-1",
    "buy-10",
    "buy-100",
    "sell",
    "sell-1",
    "sell-10",
    "sell-100",
    "result",
    "status",
  ]);
  expect(JSON.stringify(tree)).not.toMatch(/"(?:value|quote|totalPrice|after|disabled)":/);
});
