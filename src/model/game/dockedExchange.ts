import type { ExchangeBalances } from "../exchange.ts";
import type { FlightState, GameState } from "../types.ts";

/** Read the live balances only when the existing docked Exchange actions are available. */
export function dockedExchange(
  state: Readonly<Pick<GameState, "dialogue" | "docked" | "economy" | "flight" | "mode">>,
): { readonly balances: ExchangeBalances; readonly flight: FlightState } | null {
  const flight = state.flight;
  if (state.mode !== "space" || !flight || !state.docked || state.dialogue) {
    return null;
  }
  return { balances: { ore: flight.cargo, stardust: state.economy.stardust }, flight };
}
