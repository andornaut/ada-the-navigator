import {
  NEEDLE_CADENCE,
  SUNFLOWER_CAPITAL_BOSS,
  WHIRLPOOL_CAPITAL_BOSS,
} from "../data/capitalBosses.ts";
import { LANCE_TELL } from "../data/enemyCatalog.ts";
import { HEAVY_SIGNATURES } from "../data/enemySignatures.ts";
import type { GalaxyNumber } from "../data/types.ts";
import {
  CROSSBOW_WARNING,
  type CrossbowTimingState,
  type HammerTutorialState,
  MANTA_FIRST_APPROACH_SECONDS,
  type MantaEscortState,
  type PendingAuthoredLance,
} from "./earlyEncounterPatterns.ts";

export type EarlyEncounterState =
  | ({ readonly kind: "hammer" } & HammerTutorialState)
  | ({ readonly kind: "manta" } & MantaEscortState)
  | ({ readonly kind: "crossbow" } & CrossbowTimingState);

export const EARLY_ENCOUNTER_CUES = {
  crossbow: {
    speaker: "astra",
    text: "Crossbow fires to one side at a time. Look for the marked lane.",
  },
  hammer: {
    speaker: "astra",
    text: "Wait for the aim line to stop moving. Then dodge. Aim for the glowing mount.",
  },
  manta: {
    speaker: "astra",
    text: "The escorts are taking turns. Use the gap between passes.",
  },
} as const satisfies Record<EarlyEncounterState["kind"], { speaker: "astra"; text: string }>;

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

/** Continue can resume a still-open first warning that never reached the box. */
export function earlyEncounterCueDue(state: EarlyEncounterState): boolean {
  if (state.kind === "hammer") {
    return state.phase === "telling";
  }
  const stop = state.kind === "manta" ? MANTA_FIRST_APPROACH_SECONDS : CROSSBOW_WARNING;
  return state.elapsed < stop;
}

export function pendingEarlyLance(
  state: EarlyEncounterState | undefined,
): PendingAuthoredLance | undefined {
  if (state?.kind === "hammer" && state.phase === "telling") {
    return state.tell;
  }
  return state?.kind === "crossbow" ? state.pendingLance : undefined;
}
