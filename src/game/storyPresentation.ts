import { ROUTE } from "../data/galaxies.ts";
import type { GalaxyNumber } from "../data/types.ts";
import type { FlightState, GameState } from "../model/types.ts";

type LaunchHistory = Pick<GameState, "started" | "selectedGalaxy"> & {
  readonly flight: Pick<FlightState, "galaxy"> | null;
};

/** The durable launch history, independent of map previews and unlock progress. */
export function lastPlayedGalaxy(state: LaunchHistory): GalaxyNumber {
  return state.flight?.galaxy ?? (state.started ? state.selectedGalaxy : ROUTE[0]!);
}

/** Ordinary ABOARD pages reuse the galaxy backdrop; registered holodisk art stays unchanged. */
export function aboardGalaxy(
  state: LaunchHistory,
  page: { readonly background: string; readonly holodisk?: boolean } | null | undefined,
): GalaxyNumber | null {
  return page?.background === "aboard" && !page.holodisk ? lastPlayedGalaxy(state) : null;
}
