import { validateLayoutTree } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { expect, it } from "vitest";

import { EXCHANGE_AMOUNTS, type ExchangeResource } from "../model/exchange.ts";
import { exchangeTree } from "./exchangeTree.ts";
import { BUTTON_GAP } from "./layout/tokens.ts";

it("composes caller fixed-action facts without an editor or confirmation controller", () => {
  const actions = (resource: ExchangeResource) =>
    EXCHANGE_AMOUNTS.map((amount) => ({
      amount,
      resource,
    }));
  const tree = exchangeTree({ ore: actions("ore"), stardust: actions("stardust") });
  validateLayoutTree({ action: [], container: ["content"], native: [] }, tree);
  const ids: string[] = [];
  const visit = (node: typeof tree) => {
    ids.push(node.key);
    if (node.kind === "component" && node.component === "container") {
      for (const child of node.slots!.content!) {
        visit(child);
      }
    } else if (node.kind !== "component") {
      expect(node).toMatchObject({
        gap: BUTTON_GAP,
        kind: "columns",
        padding: 0,
        sizing: { mode: "intrinsic" },
      });
      node.children.forEach(visit);
    }
  };
  visit(tree);
  expect(ids).toEqual([
    "root",
    "stardust",
    "quantities",
    "stardust-1",
    "stardust-10",
    "stardust-100",
    "ore",
    "quantities",
    "ore-1",
    "ore-10",
    "ore-100",
    "status",
  ]);
  expect(JSON.stringify(tree)).not.toMatch(/"(?:value|quote|totalPrice|after|disabled)":/);
});
