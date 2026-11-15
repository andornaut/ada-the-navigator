import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { expect, it } from "vitest";

import { exchangeTree } from "./exchangeTree.ts";
it("composes stable native editor, confirmation and status ports without values or transaction facts", () => {
  const copy = {
    buyOre: "Buy",
    cancel: "Cancel",
    confirm: "Confirm",
    help: "Help",
    sellOre: "Sell",
  };
  const tree = exchangeTree(copy);
  validateLayoutTree({ container: ["content"], native: [] }, tree);
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
    "editor",
    "directions",
    "buy",
    "sell",
    "amountLabel",
    "preview",
    "previewActions",
    "action",
    "confirmation",
    "summary",
    "confirmActions",
    "cancel",
    "confirm",
    "status",
  ]);
  expect(JSON.stringify(tree)).not.toMatch(
    /"(?:amount|value|direction|quote|totalPrice|after|disabled)":/,
  );
  expect(JSON.stringify(exchangeTree({ ...copy, buyOre: "Caller buy" }))).toContain(
    '"text":"Caller buy"',
  );
});
