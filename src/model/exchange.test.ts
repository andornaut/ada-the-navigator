import { describe, expect, it } from "vitest";

import { confirmExchange, quoteExchange } from "./exchange.ts";

const rates = { buyOre: 9, sellOre: 4 };
const balances = { ore: 20, stardust: 90 };

describe("ore exchange quotes", () => {
  it("previews both balances and the exact price without mutating input", () => {
    expect(quoteExchange(rates, balances, { amount: 10, direction: "buy" })).toMatchObject({
      after: { ore: 30, stardust: 0 },
      before: balances,
      kind: "quote",
      totalPrice: 90,
      unitPrice: 9,
    });
    expect(quoteExchange(rates, balances, { amount: 20, direction: "sell" })).toMatchObject({
      after: { ore: 0, stardust: 170 },
      kind: "quote",
      totalPrice: 80,
      unitPrice: 4,
    });
    expect(balances).toEqual({ ore: 20, stardust: 90 });
  });

  it("rejects insufficient funds or ore and unsafe arithmetic", () => {
    expect(quoteExchange(rates, balances, { amount: 11, direction: "buy" })).toEqual({
      kind: "refused",
      reason: "cantAfford",
    });
    expect(quoteExchange(rates, balances, { amount: 21, direction: "sell" })).toEqual({
      kind: "refused",
      reason: "notEnoughOre",
    });
    expect(
      quoteExchange(rates, balances, { amount: Number.MAX_SAFE_INTEGER, direction: "sell" }),
    ).toEqual({ kind: "refused", reason: "overflow" });
    expect(
      quoteExchange(
        rates,
        { ore: 1, stardust: Number.MAX_SAFE_INTEGER },
        { amount: 1, direction: "sell" },
      ),
    ).toEqual({ kind: "refused", reason: "overflow" });
    expect(
      quoteExchange(
        rates,
        { ore: Number.MAX_SAFE_INTEGER, stardust: 90 },
        { amount: 1, direction: "buy" },
      ),
    ).toEqual({ kind: "refused", reason: "overflow" });
  });

  it.each([0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid amount %s",
    (amount) => {
      expect(quoteExchange(rates, balances, { amount, direction: "buy" })).toEqual({
        kind: "refused",
        reason: "invalidAmount",
      });
    },
  );

  it.each([
    { buyOre: 4, sellOre: 4 },
    { buyOre: 3, sellOre: 4 },
    { buyOre: 9, sellOre: 0 },
  ])("rejects nonpositive spreads or rates %j", (invalid) => {
    expect(quoteExchange(invalid, balances, { amount: 1, direction: "buy" })).toEqual({
      kind: "refused",
      reason: "invalidRates",
    });
  });

  it.each([
    { ore: -1, stardust: 90 },
    { ore: 20, stardust: 0.5 },
    { ore: NaN, stardust: 90 },
  ])("rejects invalid balances %j", (invalid) => {
    expect(quoteExchange(rates, invalid, { amount: 1, direction: "buy" })).toEqual({
      kind: "refused",
      reason: "invalidBalances",
    });
  });

  it("loses Stardust on a buy then sell round trip at any approved positive spread", () => {
    const bought = quoteExchange(rates, balances, { amount: 10, direction: "buy" });
    expect(bought.kind).toBe("quote");
    if (bought.kind !== "quote") {
      throw new Error("Buy quote missing");
    }
    const sold = quoteExchange(rates, bought.after, { amount: 10, direction: "sell" });
    expect(sold).toMatchObject({ after: { ore: 20, stardust: 40 }, kind: "quote" });
  });

  it("revalidates balance, rate and preview changes before confirmation", () => {
    const quote = quoteExchange(rates, balances, { amount: 5, direction: "buy" });
    if (quote.kind !== "quote") {
      throw new Error("Quote missing");
    }
    expect(confirmExchange(rates, balances, quote)).toEqual(quote);
    for (const changed of [
      confirmExchange(rates, { ...balances, ore: 21 }, quote),
      confirmExchange({ ...rates, buyOre: 10 }, balances, quote),
      confirmExchange(rates, balances, { ...quote, totalPrice: 1 }),
      confirmExchange(rates, balances, { ...quote, after: { ore: 999, stardust: 90 } }),
    ]) {
      expect(changed).toEqual({ kind: "refused", reason: "stale" });
    }
  });
});
