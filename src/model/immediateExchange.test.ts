import { expect, it } from "vitest";

import { dockedStock } from "../testing/stationStock.ts";
import { EXCHANGE_AMOUNTS, previewImmediateExchange } from "./exchange.ts";

it("buys each fixed quantity at double the cost in the other resource", () => {
  const model = dockedStock(1, "jobs"),
    flight = model.state.flight!;
  const progress = structuredClone(model.state.progress);
  const loadout = structuredClone({
    ammo: flight.ammo,
    levels: flight.levels,
    weapon: flight.weapon,
  });
  for (const amount of EXCHANGE_AMOUNTS) {
    flight.cargo = 1000;
    model.state.economy.stardust = 1000;
    const bought = model.exchangeImmediately({ amount, resource: "ore" });
    expect(bought).toEqual({
      after: { ore: 1000 + amount, stardust: 1000 - 2 * amount },
      amount,
      kind: "exchanged",
      resource: "ore",
      totalPrice: 2 * amount,
    });
    expect(flight.cargo).toBe(1000 + amount);
    expect(model.state.economy.stardust).toBe(1000 - 2 * amount);
    const order = { amount, resource: "stardust" } as const;
    expect(model.previewImmediateExchange(order)).toEqual({
      after: { ore: 1000 - amount, stardust: 1000 - amount },
      amount,
      kind: "quote",
      resource: "stardust",
      totalPrice: 2 * amount,
    });
    expect(model.exchangeImmediately(order).kind).toBe("exchanged");
    expect(flight.cargo).toBe(1000 - amount);
    expect(model.state.economy.stardust).toBe(1000 - amount);
  }
  expect(model.state.progress).toEqual(progress);
  expect({ ammo: flight.ammo, levels: flight.levels, weapon: flight.weapon }).toEqual(loadout);
  expect(model.flightEvents).toEqual([]);
  expect(model.drainPickupFeedback()).toEqual([]);
});
it("refuses invalid quantities, affordability, insufficient ore and overflow without mutation", () => {
  const balances = { ore: 0, stardust: 1 };
  expect(previewImmediateExchange(balances, { amount: 2 as never, resource: "ore" })).toEqual({
    kind: "refused",
    reason: "invalidAmount",
  });
  expect(previewImmediateExchange(balances, { amount: 1, resource: "ore" })).toEqual({
    kind: "refused",
    reason: "cantAfford",
  });
  expect(previewImmediateExchange(balances, { amount: 1, resource: "stardust" })).toEqual({
    kind: "refused",
    reason: "notEnoughOre",
  });
  expect(
    previewImmediateExchange(
      { ore: Number.MAX_SAFE_INTEGER, stardust: 1000 },
      { amount: 1, resource: "ore" },
    ),
  ).toEqual({ kind: "refused", reason: "overflow" });
  expect(balances).toEqual({ ore: 0, stardust: 1 });
});
it("retains dock/dialogue guards and recomputes live balances on every immediate action", () => {
  const model = dockedStock(1, "jobs"),
    flight = model.state.flight!;
  flight.cargo = 2;
  model.state.economy.stardust = 2;
  expect(model.exchangeImmediately({ amount: 1, resource: "ore" }).kind).toBe("exchanged");
  expect(model.exchangeImmediately({ amount: 1, resource: "ore" })).toEqual({
    kind: "refused",
    reason: "cantAfford",
  });
  expect(model.exchangeImmediately({ amount: 1, resource: "stardust" }).kind).toBe("exchanged");
  expect(model.previewImmediateExchange({ amount: 1, resource: "stardust" })).toEqual({
    kind: "refused",
    reason: "notEnoughOre",
  });
  expect(model.exchangeImmediately({ amount: 1, resource: "stardust" })).toEqual({
    kind: "refused",
    reason: "notEnoughOre",
  });
  expect({ ore: flight.cargo, stardust: model.state.economy.stardust }).toEqual({
    ore: 1,
    stardust: 1,
  });
  const before = { ore: flight.cargo, stardust: model.state.economy.stardust };
  model.state.docked = null;
  expect(model.exchangeImmediately({ amount: 1, resource: "stardust" })).toEqual({
    kind: "refused",
    reason: "unavailable",
  });
  expect({ ore: flight.cargo, stardust: model.state.economy.stardust }).toEqual(before);
});
