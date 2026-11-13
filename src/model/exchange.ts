export interface ExchangeRates {
  readonly buyOre: number;
  readonly sellOre: number;
}

export interface ExchangeBalances {
  readonly ore: number;
  readonly stardust: number;
}

export interface ExchangeOrder {
  readonly amount: number;
  readonly direction: "buy" | "sell";
}

export interface ExchangeQuote extends ExchangeOrder {
  readonly after: ExchangeBalances;
  readonly before: ExchangeBalances;
  readonly kind: "quote";
  readonly totalPrice: number;
  readonly unitPrice: number;
}

export type ExchangeRefusal = {
  readonly kind: "refused";
  readonly reason:
    | "cantAfford"
    | "invalidAmount"
    | "invalidBalances"
    | "invalidRates"
    | "notEnoughOre"
    | "overflow"
    | "stale"
    | "unavailable";
};
export type ExchangePreview = ExchangeQuote | ExchangeRefusal;

const whole = (amount: number): boolean => Number.isSafeInteger(amount) && amount >= 0;

/** Quotes an exact integer exchange without mutating the balances. */
export function quoteExchange(
  rates: ExchangeRates,
  balances: ExchangeBalances,
  order: ExchangeOrder,
): ExchangePreview {
  if (
    !whole(rates.buyOre) ||
    !whole(rates.sellOre) ||
    rates.sellOre === 0 ||
    rates.buyOre <= rates.sellOre
  ) {
    return { kind: "refused", reason: "invalidRates" };
  }
  if (!whole(balances.ore) || !whole(balances.stardust)) {
    return { kind: "refused", reason: "invalidBalances" };
  }
  if (!whole(order.amount) || order.amount === 0 || !["buy", "sell"].includes(order.direction)) {
    return { kind: "refused", reason: "invalidAmount" };
  }
  const unitPrice = order.direction === "buy" ? rates.buyOre : rates.sellOre;
  const totalPrice = order.amount * unitPrice;
  if (!whole(totalPrice)) {
    return { kind: "refused", reason: "overflow" };
  }
  if (order.direction === "buy" && totalPrice > balances.stardust) {
    return { kind: "refused", reason: "cantAfford" };
  }
  if (order.direction === "sell" && order.amount > balances.ore) {
    return { kind: "refused", reason: "notEnoughOre" };
  }
  const after =
    order.direction === "buy"
      ? { ore: balances.ore + order.amount, stardust: balances.stardust - totalPrice }
      : { ore: balances.ore - order.amount, stardust: balances.stardust + totalPrice };
  if (!whole(after.ore) || !whole(after.stardust)) {
    return { kind: "refused", reason: "overflow" };
  }
  return {
    after,
    amount: order.amount,
    before: { ...balances },
    direction: order.direction,
    kind: "quote",
    totalPrice,
    unitPrice,
  };
}

/** Revalidates the exact preview before its owner atomically applies the balances. */
export function confirmExchange(
  rates: ExchangeRates,
  balances: ExchangeBalances,
  quote: ExchangeQuote,
): ExchangePreview {
  const fresh = quoteExchange(rates, balances, quote);
  if (fresh.kind === "refused") {
    return fresh;
  }
  if (
    quote.before.ore !== fresh.before.ore ||
    quote.before.stardust !== fresh.before.stardust ||
    quote.after.ore !== fresh.after.ore ||
    quote.after.stardust !== fresh.after.stardust ||
    quote.unitPrice !== fresh.unitPrice ||
    quote.totalPrice !== fresh.totalPrice
  ) {
    return { kind: "refused", reason: "stale" };
  }
  return fresh;
}
