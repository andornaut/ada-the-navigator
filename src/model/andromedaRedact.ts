import { CAPITAL_CAPTAINS } from "../data/capitalCaptains.ts";
import type { ConversationLine } from "../data/conversations.ts";
import type { Vec } from "../data/types.ts";
import type { ChapterContext } from "./chapterProtocol.ts";
import { questGuardPlacementContext } from "./flight.ts";
import type { StationPlacementContext } from "./stationPlacement.ts";
import type { FlightEvent, SpaceObject } from "./types.ts";

export const ANDROMEDA_REDACT = {
  captain: CAPITAL_CAPTAINS.captainRedact.name,
  id: "boss:andromeda:broad-wing",
  relayId: "boss:andromeda:relay",
  ship: "Broad Wing",
} as const;

export const ANDROMEDA_REDACT_CUES = {
  approach: {
    speaker: "captainRedact",
    text: "That beacon's lit again. All patrols, move away from the light.",
  },
  hardpoint: {
    speaker: "astra",
    text: "One mount's down. I'm recording where the patrols are heading.",
  },
  resolved: {
    speaker: "astra",
    text: "Their flight log points to a hidden relay. I've added it to the map.",
  },
} as const satisfies Record<string, ConversationLine>;

interface RedactPlacement {
  readonly site: Vec;
  readonly relay: Vec;
}

type RedactOutcome = "defeated" | "salvaged";

export type AndromedaRedactProgress = RedactPlacement &
  (
    | { readonly phase: "active" }
    | { readonly phase: "away"; readonly actor: SpaceObject }
    | { readonly phase: "resolved"; readonly outcome: RedactOutcome }
  );

/** Plan both sites against the supplied clearance context without changing the live flight. */
export type AndromedaRedactPlacementPort = (
  context: StationPlacementContext,
  encounter: typeof ANDROMEDA_REDACT,
) => RedactPlacement | null;

export function andromedaRedactEligible({ flight, progress }: ChapterContext): boolean {
  return flight.galaxy === 5 && progress.stage === 6 && progress.questComplete;
}

/** Only request placement for an eligible, unreserved encounter. */
export function reserveAndromedaRedact(
  context: ChapterContext,
  place: AndromedaRedactPlacementPort,
  current: AndromedaRedactProgress | undefined,
): (AndromedaRedactProgress & { readonly phase: "active" }) | undefined {
  if (current || !andromedaRedactEligible(context)) {
    return undefined;
  }
  const { content, flight } = context;
  const placement = place(questGuardPlacementContext(content, flight), ANDROMEDA_REDACT);
  return placement
    ? { phase: "active", relay: { ...placement.relay }, site: { ...placement.site } }
    : undefined;
}

/** The shared owner publishes this stable destination through normal discovery and Local Map. */
export function andromedaRelayWaypoint(
  current: AndromedaRedactProgress | undefined,
): (Vec & { readonly id: typeof ANDROMEDA_REDACT.relayId }) | undefined {
  return current?.phase === "resolved"
    ? { ...current.relay, id: ANDROMEDA_REDACT.relayId }
    : undefined;
}

interface RedactResolution {
  readonly progress: AndromedaRedactProgress & { readonly phase: "resolved" };
  readonly relay: Vec & { readonly id: typeof ANDROMEDA_REDACT.relayId };
  readonly discovery: Extract<FlightEvent, { type: "discovered" }> & {
    readonly id: typeof ANDROMEDA_REDACT.relayId;
  };
  readonly cue: {
    readonly id: `${typeof ANDROMEDA_REDACT.id}:resolved`;
    readonly line: typeof ANDROMEDA_REDACT_CUES.resolved;
  };
}

/** Invoke after destruction or successful Salvage and commit the returned progress with discovery. */
export function resolveAndromedaRedact(
  context: ChapterContext,
  current: AndromedaRedactProgress | undefined,
  event: { readonly id: string; readonly outcome: RedactOutcome },
): RedactResolution | undefined {
  if (
    current?.phase !== "active" ||
    event.id !== ANDROMEDA_REDACT.id ||
    !andromedaRedactEligible(context)
  ) {
    return undefined;
  }
  const progress = { ...current, outcome: event.outcome, phase: "resolved" } as const;
  return {
    cue: { id: `${ANDROMEDA_REDACT.id}:resolved`, line: ANDROMEDA_REDACT_CUES.resolved },
    discovery: { id: ANDROMEDA_REDACT.relayId, type: "discovered" },
    progress,
    relay: { ...progress.relay, id: ANDROMEDA_REDACT.relayId },
  };
}
