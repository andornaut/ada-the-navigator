export interface ExchangeRates {
  readonly buyOre: number;
  readonly sellOre: number;
}

export const EXCHANGE_RATES: ExchangeRates = { buyOre: 2, sellOre: 1 };

export const IMMEDIATE_EXCHANGE_UNIT_COST = 2;
