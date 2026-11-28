import { ANDROMEDA_REDACT } from "../../data/capitalBosses.ts";
import type { Vec } from "../../data/types.ts";
import type { CapitalBossProgress } from "../capitalBossEncounter.ts";

export interface RedactPlacement {
  readonly site: Vec;
  readonly relay: Vec;
}

export type AndromedaRedactProgress = CapitalBossProgress & RedactPlacement;

/** The shared owner publishes this stable destination through normal discovery and Local Map. */
export function andromedaRelayWaypoint(
  current: AndromedaRedactProgress | undefined,
): (Vec & { readonly id: typeof ANDROMEDA_REDACT.relayId }) | undefined {
  return current?.phase === "resolved"
    ? { ...current.relay, id: ANDROMEDA_REDACT.relayId }
    : undefined;
}
