import {
  NEEDLE_CADENCE,
  SUNFLOWER_CAPITAL_BOSS,
  WHIRLPOOL_CAPITAL_BOSS,
} from "../data/capitalBosses.ts";
import { LANCE_TELL } from "../data/enemyCatalog.ts";
import { HEAVY_SIGNATURES } from "../data/enemySignatures.ts";
import type { GalaxyNumber } from "../data/types.ts";
import type {
  CrossbowTimingState,
  HammerTutorialState,
  MantaEscortState,
  PendingAuthoredLance,
} from "./earlyEncounterPatterns.ts";

export type EarlyEncounterState =
  | ({ readonly kind: "hammer" } & HammerTutorialState)
  | ({ readonly kind: "manta" } & MantaEscortState)
  | ({ readonly kind: "crossbow" } & CrossbowTimingState);

export const EARLY_LANCE_MOUNT = HEAVY_SIGNATURES.capital.lance.mount;
export const EARLY_LANCE_SECONDS = LANCE_TELL.trackSeconds + LANCE_TELL.lockSeconds;

export function earlyEncounterKind(
  galaxy: GalaxyNumber,
  id: string,
): EarlyEncounterState["kind"] | undefined {
  if (galaxy === 1 && id === SUNFLOWER_CAPITAL_BOSS.id) {
    return "hammer";
  }
  if (galaxy === 3 && id === WHIRLPOOL_CAPITAL_BOSS.id) {
    return "manta";
  }
  if (galaxy === 4 && id === NEEDLE_CADENCE.id) {
    return "crossbow";
  }
  return undefined;
}

export function pendingEarlyLance(
  state: EarlyEncounterState | undefined,
): PendingAuthoredLance | undefined {
  if (state?.kind === "hammer" && state.phase === "telling") {
    return state.tell;
  }
  return state?.kind === "crossbow" ? state.pendingLance : undefined;
}
