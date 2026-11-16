import { expect, it } from "vitest";

import { EXCHANGE_RATES } from "../data/exchange.ts";
import { dockedStock } from "../testing/stationStock.ts";
import { EXCHANGE_AMOUNTS, exchangeImmediately } from "./exchange.ts";

it("applies each fixed quantity once at current buy2/sell1 rates with one fungible ore balance", () => {
  const model = dockedStock(1, "jobs"),
    flight = model.state.flight!;
  const progress = structuredClone(model.state.progress);
  const loadout = structuredClone({
    ammo: flight.ammo,
    levels: flight.levels,
    weapon: flight.weapon,
  });
  for (const amount of EXCHANGE_AMOUNTS) {
    flight.cargo = 100;
    model.state.economy.stardust = 1000;
    const bought = model.exchangeImmediately({ amount, direction: "buy" });
    expect(bought.kind).toBe("exchanged");
    expect(flight.cargo).toBe(100 + amount);
    expect(model.state.economy.stardust).toBe(1000 - amount * EXCHANGE_RATES.buyOre);
    const sold = model.exchangeImmediately({ amount, direction: "sell" });
    expect(sold.kind).toBe("exchanged");
    expect(flight.cargo).toBe(100);
    expect(model.state.economy.stardust).toBe(
      1000 - amount * (EXCHANGE_RATES.buyOre - EXCHANGE_RATES.sellOre),
    );
  }
  expect(model.state.progress).toEqual(progress);
  expect({ ammo: flight.ammo, levels: flight.levels, weapon: flight.weapon }).toEqual(loadout);
  expect(model.flightEvents).toEqual([]);
  expect(model.drainPickupFeedback()).toEqual([]);
});
it("refuses invalid quantities, affordability, insufficient ore and overflow without mutation", () => {
  const balances = { ore: 0, stardust: 1 };
  expect(
    exchangeImmediately(EXCHANGE_RATES, balances, { amount: 2 as never, direction: "buy" }),
  ).toEqual({ kind: "refused", reason: "invalidAmount" });
  expect(exchangeImmediately(EXCHANGE_RATES, balances, { amount: 1, direction: "buy" })).toEqual({
    kind: "refused",
    reason: "cantAfford",
  });
  expect(exchangeImmediately(EXCHANGE_RATES, balances, { amount: 1, direction: "sell" })).toEqual({
    kind: "refused",
    reason: "notEnoughOre",
  });
  expect(
    exchangeImmediately(
      EXCHANGE_RATES,
      { ore: Number.MAX_SAFE_INTEGER, stardust: 1000 },
      { amount: 1, direction: "buy" },
    ),
  ).toEqual({ kind: "refused", reason: "overflow" });
  expect(balances).toEqual({ ore: 0, stardust: 1 });
});
it("retains dock/dialogue guards and recomputes live balances on every immediate action", () => {
  const model = dockedStock(1, "jobs"),
    flight = model.state.flight!;
  flight.cargo = 2;
  model.state.economy.stardust = 2;
  expect(model.exchangeImmediately({ amount: 1, direction: "buy" }).kind).toBe("exchanged");
  expect(model.exchangeImmediately({ amount: 1, direction: "buy" })).toEqual({
    kind: "refused",
    reason: "cantAfford",
  });
  const before = { ore: flight.cargo, stardust: model.state.economy.stardust };
  model.state.docked = null;
  expect(model.exchangeImmediately({ amount: 1, direction: "sell" })).toEqual({
    kind: "refused",
    reason: "unavailable",
  });
  expect({ ore: flight.cargo, stardust: model.state.economy.stardust }).toEqual(before);
});
