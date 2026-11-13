import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";
import { buy, requestPurchase, selectPaint, shopRow, shopRows } from "./shop.ts";
import { newEconomy } from "./upgrades.ts";

const ORDER = ["classic", "cobalt", "seafoam", "graphite", "iris", "amber"];
const PRICES = [1500, 2000, 2500, 3000, 3500];

describe("six ship paint schemes", () => {
  it("keeps the existing scheme IDs and shop order, appending Amber as the sixth scheme", () => {
    expect(ECONOMY.paintOrder).toEqual(ORDER);
    expect(Object.keys(ECONOMY.paints).sort()).toEqual([...ORDER].sort());
    expect(ECONOMY.paintPrices).toEqual(PRICES);
    expect(CONTENT.labels[ECONOMY.paints.amber!.label]).toBe("Amber");
    const economy = newEconomy(ECONOMY);
    const rows = shopRows(ECONOMY, economy, 1, "ship").filter(({ item }) => item.kind === "paint");
    expect(rows).toHaveLength(6);
    expect(rows.map(({ price }) => price)).toEqual([null, 1500, 1500, 1500, 1500, 1500]);
  });

  it.each([
    ["amber", "iris", "cobalt", "graphite", "seafoam"],
    ["cobalt", "seafoam", "graphite", "iris", "amber"],
  ])("keeps every unowned paint for sale through all five paid tiers (first %s)", (...order) => {
    const economy = newEconomy(ECONOMY);
    economy.stardust = 12500;
    for (const [index, scheme] of order.entries()) {
      for (const unowned of order.slice(index)) {
        expect(shopRow(ECONOMY, economy, { kind: "paint", scheme: unowned }).price).toBe(
          PRICES[index],
        );
      }
      expect(buy(ECONOMY, { kind: "paint", scheme }, economy)).toEqual({
        kind: "bought",
        price: PRICES[index],
      });
      expect(economy.paint).toBe(scheme);
      expect(selectPaint(ECONOMY, "classic", economy)).toBe(true);
    }
    expect(economy.stardust).toBe(0);
    for (const scheme of ORDER) {
      expect(selectPaint(ECONOMY, scheme, economy)).toBe(true);
      expect(economy.paint).toBe(scheme);
      expect(shopRow(ECONOMY, economy, { kind: "paint", scheme })).toMatchObject({
        owned: true,
        price: null,
      });
    }
  });

  it("restores existing ownership unchanged and offers the fifth paid scheme for 3500", () => {
    const model = new GameModel(CONTENT);
    model.state.economy.paints = ["classic", "cobalt", "seafoam", "graphite", "iris"];
    model.state.economy.paint = "graphite";
    model.state.economy.stardust = 3499;
    const saved = model.save();
    const restored = restoreSave(saved)!;
    expect(restored.economy).toEqual(model.state.economy);
    const item = { kind: "paint", scheme: "amber" } as const;
    expect(shopRow(ECONOMY, restored.economy, item).price).toBe(3500);
    expect(selectPaint(ECONOMY, "amber", restored.economy)).toBe(false);
    expect(requestPurchase(ECONOMY, restored.economy, item)).toEqual({
      kind: "refused",
      reason: "cantAfford",
    });
    restored.economy.stardust++;
    expect(buy(ECONOMY, item, restored.economy)).toEqual({ kind: "bought", price: 3500 });
    expect(restored.economy.stardust).toBe(0);
    expect(restored.economy.paint).toBe("amber");
    const again = restoreSave(JSON.stringify(restored))!;
    expect(again.economy.paints).toEqual(ORDER);
    expect(again.economy.paint).toBe("amber");
  });
});
